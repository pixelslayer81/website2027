"""Dev server for the stitched site: python's http.server plus Cache-Control:
no-store on every response, so a browser never shows a stale page file
(site.js fetches pages/NN-slug/* at runtime; the plain http.server sends no
cache headers and browsers then keep old copies for a while).

Run from the repo root:  python -I tools/serve.py [port]   (default 8080)
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):  # quiet: only errors
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
