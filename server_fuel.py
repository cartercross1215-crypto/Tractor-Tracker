#!/usr/bin/env python3
"""Run Tractor Tracker with password-reset diagnostics and add-on scripts."""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus

import server_debug as diagnostics

app = diagnostics.app
original_do_get = app.TractorTrackerHandler.do_GET

# Nearby fuel stations come from OpenStreetMap via Overpass. The browser cannot call
# Overpass directly (the request fails in the browser even though Overpass sends
# Access-Control-Allow-Origin: *), so the server fetches it instead. Going through the
# server also lets us cache, which keeps us inside Overpass's free-use expectations.
OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
STATION_SEARCH_RADIUS_METERS = 8000
STATION_RESULT_LIMIT = 8
STATION_CACHE_SECONDS = 30 * 60
# Round coordinates to ~0.01 degrees (about 0.7 mi) so everyone working the same area
# shares one cache entry instead of each device hitting Overpass.
STATION_CACHE_PRECISION = 2

_station_cache = {}


def _station_address(tags):
    street = " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
    town = ", ".join(filter(None, [tags.get("addr:city"), tags.get("addr:state")]))
    return ", ".join(filter(None, [street, town]))


def _fetch_overpass_stations(latitude, longitude):
    """Return (stations, ok). ok is False when every endpoint failed, which is very
    different from 'this area genuinely has no fuel stations' -- Overpass rate-limits
    per IP, so failures are common and must not be cached as a real empty result."""
    query = (
        f"[out:json][timeout:20];"
        f'nwr["amenity"="fuel"](around:{STATION_SEARCH_RADIUS_METERS},{latitude},{longitude});'
        f"out center tags {STATION_RESULT_LIMIT * 4};"
    )
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")

    for endpoint in OVERPASS_ENDPOINTS:
        try:
            request = urllib.request.Request(
                endpoint,
                data=body,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    # Overpass asks for a contactable User-Agent.
                    "User-Agent": "TractorTracker/1.0 (support@tractortracker.farm)",
                },
            )
            with urllib.request.urlopen(request, timeout=25) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, ValueError, TimeoutError, OSError):
            continue

        stations = []
        for element in payload.get("elements", []):
            center = element.get("center") or {}
            station_lat = element.get("lat", center.get("lat"))
            station_lon = element.get("lon", center.get("lon"))
            if station_lat is None or station_lon is None:
                continue
            tags = element.get("tags", {})
            stations.append({
                "name": tags.get("name") or tags.get("brand") or tags.get("operator") or "Unnamed fuel stop",
                "brand": tags.get("brand", ""),
                "address": _station_address(tags),
                "hasDiesel": tags.get("fuel:diesel") == "yes",
                "latitude": station_lat,
                "longitude": station_lon,
            })
        # A parsed response is authoritative even when empty (genuinely nothing mapped here).
        return stations, True
    return [], False


def handle_fuel_stations(self):
    params = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
    try:
        latitude = float(params.get("latitude", [""])[0])
        longitude = float(params.get("longitude", [""])[0])
    except (TypeError, ValueError):
        self.send_json({"error": "latitude and longitude are required"}, HTTPStatus.BAD_REQUEST)
        return
    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        self.send_json({"error": "latitude or longitude out of range"}, HTTPStatus.BAD_REQUEST)
        return

    key = (round(latitude, STATION_CACHE_PRECISION), round(longitude, STATION_CACHE_PRECISION))
    cached = _station_cache.get(key)
    now = time.time()
    if cached and now - cached[0] < STATION_CACHE_SECONDS:
        self.send_json({"stations": cached[1], "cached": True})
        return

    stations, ok = _fetch_overpass_stations(latitude, longitude)
    if ok:
        _station_cache[key] = (now, stations)
        self.send_json({"stations": stations, "cached": False})
        return

    # Overpass failed (rate limit, timeout, outage). Never cache that as an empty area.
    # Serve an expired entry if we have one -- stale station names are still correct,
    # stations do not move -- otherwise tell the client the lookup was unavailable so it
    # falls back to city/state naming instead of claiming there are no stations nearby.
    if cached:
        self.send_json({"stations": cached[1], "cached": True, "stale": True})
        return
    self.send_json({"stations": [], "unavailable": True})


# --- Regional fuel prices from the EIA ------------------------------------------------
#
# The EIA publishes retail diesel and gasoline averages weekly (surveyed Monday, posted
# Tuesday ~10am ET). Free, but it needs an API key, so this whole path stays dormant
# until EIA_API_KEY is set on the service -- without it we fall back to the same hardcoded
# starter estimates as before. The key never reaches the browser.
#
# Prices are published per PADD region rather than per state, so we map the farmer's state
# to its PADD. For an Iowa farmer that is PADD 2 (Midwest), which is far closer to reality
# than a single national number.
#
# Red diesel and DEF are deliberately absent: no public source publishes either. Red diesel
# comes off a bulk delivery invoice at a contract price, which the farmer already enters
# manually and which is exact rather than an average.
EIA_API_KEY = os.environ.get("EIA_API_KEY", "").strip()
EIA_ENDPOINT = "https://api.eia.gov/v2/petroleum/pri/gnd/data/"
EIA_PRICE_CACHE_SECONDS = 24 * 60 * 60

_PADD_BY_STATE = {}
for _padd, _states in {
    "R10": "CT DE DC FL GA ME MD MA NH NJ NY NC PA RI SC VT VA WV",
    "R20": "IL IN IA KS KY MI MN MO NE ND OH OK SD TN WI",
    "R30": "AL AR LA MS NM TX",
    "R40": "CO ID MT UT WY",
    "R50": "AK AZ CA HI NV OR WA",
}.items():
    for _code in _states.split():
        _PADD_BY_STATE[_code] = _padd

_STATE_CODE_BY_NAME = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "district of columbia": "DC",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL",
    "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA",
    "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI",
    "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT",
    "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
    "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
    "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA",
    "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN",
    "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA",
    "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
}

# No 2 diesel retail, and regular gasoline retail.
_EIA_SERIES_TEMPLATE = {
    "diesel": "EMD_EPD2D_PTE_{region}_DPG",
    "gasoline": "EMM_EPMR_PTE_{region}_DPG",
}

_eia_price_cache = {}


def _padd_region_for_state(state):
    text = str(state or "").strip()
    if not text:
        return "NUS"
    code = text.upper() if len(text) == 2 else _STATE_CODE_BY_NAME.get(text.lower(), "")
    return _PADD_BY_STATE.get(code, "NUS")


def _fetch_eia_price(series_id):
    query = urllib.parse.urlencode({
        "api_key": EIA_API_KEY,
        "frequency": "weekly",
        "data[0]": "value",
        "facets[series][0]": series_id,
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": "1",
    })
    request = urllib.request.Request(
        f"{EIA_ENDPOINT}?{query}",
        headers={"User-Agent": "TractorTracker/1.0 (support@tractortracker.farm)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, ValueError, TimeoutError, OSError):
        return None

    rows = (payload.get("response") or {}).get("data") or []
    if not rows:
        return None
    try:
        return {"price": float(rows[0]["value"]), "period": rows[0].get("period", "")}
    except (KeyError, TypeError, ValueError):
        return None


def handle_fuel_price(self):
    params = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
    fuel_type = (params.get("fuelType", [""])[0] or "").strip().lower()
    state = params.get("state", [""])[0]

    template = _EIA_SERIES_TEMPLATE.get(fuel_type)
    if not template:
        # Red diesel and DEF have no public price source, by design.
        self.send_json({"unavailable": True, "reason": "no public price source for this fuel"})
        return
    if not EIA_API_KEY:
        self.send_json({"unavailable": True, "reason": "EIA_API_KEY is not set"})
        return

    region = _padd_region_for_state(state)
    series_id = template.format(region=region)

    cached = _eia_price_cache.get(series_id)
    now = time.time()
    if cached and now - cached[0] < EIA_PRICE_CACHE_SECONDS:
        self.send_json({**cached[1], "region": region, "source": "EIA", "cached": True})
        return

    result = _fetch_eia_price(series_id)
    if not result:
        # Do not cache a failure -- same lesson as the station lookup.
        if cached:
            self.send_json({**cached[1], "region": region, "source": "EIA", "cached": True, "stale": True})
            return
        self.send_json({"unavailable": True, "reason": "EIA lookup failed"})
        return

    _eia_price_cache[series_id] = (now, result)
    self.send_json({**result, "region": region, "source": "EIA", "cached": False})


def fuel_price_do_get(self):
    request_path = self.path.split("?", 1)[0]
    if request_path == "/api/fuel-stations":
        handle_fuel_stations(self)
        return
    if request_path == "/api/fuel-price":
        handle_fuel_price(self)
        return
    if request_path in ("/", "/index.html"):
        index_path = app.APP_DIR / "index.html"
        content = index_path.read_text(encoding="utf-8")
        add_on_scripts = "\n".join([
            '  <script src="fuel-prices.js?v=2"></script>',
            # sw.js is cache-first with no revalidation, so this version MUST be bumped on
            # every change to the file or returning users keep the old copy forever.
            # v=2: station lookup moved onto /api/fuel-stations. v=3: EIA regional prices.
            '  <script src="fuel-location-prices.js?v=3"></script>',
            '  <script src="mode-branding.js?v=1"></script>',
            '  <script src="estimate-builder.js?v=1"></script>',
            '  <script src="estimate-mode-guard.js?v=1"></script>',
            '  <script src="quick-log.js?v=1"></script>',
            '  <script src="season-planner.js?v=1"></script>',
            '  <script src="today-dashboard.js?v=1"></script>',
        ])
        if "fuel-prices.js" not in content:
            content = content.replace('  <script src="app.js?v=34"></script>', '  <script src="app.js?v=34"></script>\n' + add_on_scripts)
            content = content.replace('  <script src="app.js?v=35"></script>', '  <script src="app.js?v=35"></script>\n' + add_on_scripts)
        else:
            if "fuel-location-prices.js" not in content:
                content = content.replace('  <script src="fuel-prices.js?v=1"></script>', add_on_scripts)
                content = content.replace('  <script src="fuel-prices.js?v=2"></script>', add_on_scripts)
            if "mode-branding.js" not in content:
                content = content.replace('  <script src="fuel-location-prices.js?v=1"></script>', '  <script src="fuel-location-prices.js?v=1"></script>\n  <script src="mode-branding.js?v=1"></script>')
            if "estimate-builder.js" not in content:
                content = content.replace('  <script src="mode-branding.js?v=1"></script>', '  <script src="mode-branding.js?v=1"></script>\n  <script src="estimate-builder.js?v=1"></script>')
            if "estimate-mode-guard.js" not in content:
                content = content.replace('  <script src="estimate-builder.js?v=1"></script>', '  <script src="estimate-builder.js?v=1"></script>\n  <script src="estimate-mode-guard.js?v=1"></script>')
            if "quick-log.js" not in content:
                content = content.replace('  <script src="estimate-builder.js?v=1"></script>', '  <script src="estimate-builder.js?v=1"></script>\n  <script src="quick-log.js?v=1"></script>')
            if "season-planner.js" not in content:
                content = content.replace('  <script src="quick-log.js?v=1"></script>', '  <script src="quick-log.js?v=1"></script>\n  <script src="season-planner.js?v=1"></script>')
            if "today-dashboard.js" not in content:
                content = content.replace('  <script src="season-planner.js?v=1"></script>', '  <script src="season-planner.js?v=1"></script>\n  <script src="today-dashboard.js?v=1"></script>')
        body = content.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return
    original_do_get(self)


app.TractorTrackerHandler.do_GET = fuel_price_do_get

if __name__ == "__main__":
    app.main()
