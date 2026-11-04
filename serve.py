# Serves this folder at http://localhost:8765 with browser caching turned off, so a reload always picks up the
# latest rep-counter.html and detector.js. Run: caffeinate -di python3 serve.py
import http.server
import os


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


os.chdir(os.path.dirname(os.path.abspath(__file__)))
http.server.ThreadingHTTPServer(("127.0.0.1", 8765), NoCacheHandler).serve_forever()
