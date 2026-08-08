#!/usr/bin/env python3
"""Run Tractor Tracker with password-reset diagnostics and fuel-price/mode add-ons."""
from http import HTTPStatus

import server_debug as diagnostics

app = diagnostics.app
original_do_get = app.TractorTrackerHandler.do_GET


def fuel_price_do_get(self):
    request_path = self.path.split("?", 1)[0]
    if request_path in ("/", "/index.html"):
        index_path = app.APP_DIR / "index.html"
        content = index_path.read_text(encoding="utf-8")
        add_on_scripts = "\n".join([
            '  <script src="fuel-prices.js?v=2"></script>',
            '  <script src="fuel-location-prices.js?v=1"></script>',
            '  <script src="mode-branding.js?v=1"></script>',
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
