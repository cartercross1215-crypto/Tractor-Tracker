#!/usr/bin/env python3
"""Run Tractor Tracker with beta polish, map pins, and document add-ons."""
from http import HTTPStatus

import server_map as map_server

app = map_server.app
original_do_get = app.TractorTrackerHandler.do_GET


ADD_ON_SCRIPTS = [
    '  <script src="fuel-prices.js?v=2"></script>',
    '  <script src="fuel-location-prices.js?v=4"></script>',
    '  <script src="mode-branding.js?v=1"></script>',
    '  <script src="estimate-builder.js?v=1"></script>',
    '  <script src="estimate-mode-guard.js?v=1"></script>',
    '  <script src="quick-log.js?v=1"></script>',
    '  <script src="season-planner.js?v=1"></script>',
    '  <script src="today-dashboard.js?v=1"></script>',
    '  <script src="map-pins.js?v=1"></script>',
    '  <script src="beta-ready.js?v=1"></script>',
]


def _script_filename(script_tag):
    marker = 'src="'
    start = script_tag.find(marker)
    if start == -1:
        return script_tag
    start += len(marker)
    end = script_tag.find('"', start)
    src = script_tag[start:end]
    return src.split("?", 1)[0]


def beta_do_get(self):
    request_path = self.path.split("?", 1)[0]
    if request_path in ("/", "/index.html"):
        index_path = app.APP_DIR / "index.html"
        content = index_path.read_text(encoding="utf-8")

        for script in ADD_ON_SCRIPTS:
            filename = _script_filename(script)
            if filename not in content:
                if "</body>" in content:
                    content = content.replace("</body>", f"{script}\n</body>")
                else:
                    content += "\n" + script

        body = content.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return

    original_do_get(self)


app.TractorTrackerHandler.do_GET = beta_do_get


if __name__ == "__main__":
    fuel_base = getattr(map_server, "base", None)
    if fuel_base and hasattr(fuel_base, "eia_status_summary"):
        print(fuel_base.eia_status_summary(), flush=True)
    app.main()
