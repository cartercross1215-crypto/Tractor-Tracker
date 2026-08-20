#!/usr/bin/env python3
"""Run Tractor Tracker with all add-ons plus map pins."""
from http import HTTPStatus

import server_fuel as base

app = base.app
original_do_get = app.TractorTrackerHandler.do_GET


def map_pin_do_get(self):
    request_path = self.path.split("?", 1)[0]
    if request_path in ("/", "/index.html"):
        index_path = app.APP_DIR / "index.html"
        content = index_path.read_text(encoding="utf-8")
        add_on_scripts = "\n".join([
            '  <script src="fuel-prices.js?v=2"></script>',
            # sw.js is cache-first with no revalidation, so this version MUST be bumped on
            # every change to the file or returning users keep the old copy forever.
            # v=2: station lookup moved onto /api/fuel-stations. v=3: EIA regional prices.
            '  <script src="fuel-location-prices.js?v=4"></script>',
            '  <script src="mode-branding.js?v=1"></script>',
            '  <script src="estimate-builder.js?v=1"></script>',
            '  <script src="estimate-mode-guard.js?v=1"></script>',
            '  <script src="quick-log.js?v=1"></script>',
            '  <script src="season-planner.js?v=1"></script>',
            '  <script src="today-dashboard.js?v=1"></script>',
            '  <script src="map-pins.js?v=1"></script>',
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
            if "map-pins.js" not in content:
                content = content.replace('  <script src="today-dashboard.js?v=1"></script>', '  <script src="today-dashboard.js?v=1"></script>\n  <script src="map-pins.js?v=1"></script>')
        body = content.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return
    original_do_get(self)


app.TractorTrackerHandler.do_GET = map_pin_do_get

if __name__ == "__main__":
    if hasattr(base, "eia_status_summary"):
        print(base.eia_status_summary(), flush=True)
    app.main()
