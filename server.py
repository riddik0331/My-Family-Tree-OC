#!/usr/bin/env python3
"""Family Tree HTTP Server — serves static files, handles media uploads, stores forest data."""

import json
import mimetypes
import os
import uuid
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

PORT = int(os.environ.get("PORT", 8000))
HOST = os.environ.get("HOST", "127.0.0.1")
MEDIA_DIR = Path(__file__).parent / "media"
DATA_DIR = Path(__file__).parent / "data"
DATA_FILE = DATA_DIR / "forest.json"


class FamilyTreeHandler(SimpleHTTPRequestHandler):
    """Custom handler: static files + /api/upload + /api/data."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/data":
            self._handle_get_data()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/upload":
            self._handle_upload()
        elif parsed.path == "/api/data":
            self._handle_save_data()
        else:
            self.send_error(404, "Not Found")

    def _handle_get_data(self):
        """Return saved forest data as JSON."""
        if DATA_FILE.exists():
            body = DATA_FILE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
        else:
            self._json_response(200, {"forest": [], "activeTreeId": None})

    def _handle_save_data(self):
        """Save forest data from POST body."""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        try:
            data = json.loads(body)
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            DATA_FILE.write_bytes(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
            self._json_response(200, {"ok": True})
        except Exception as e:
            self._json_response(500, {"error": f"Save failed: {e}"})

    def _handle_upload(self):
        """Handle multipart file upload, save to media/ with UUID suffix."""
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._json_response(400, {"error": "Expected multipart/form-data"})
            return

        boundary = content_type.split("boundary=")[-1].strip()
        if not boundary:
            self._json_response(400, {"error": "No boundary found"})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            filename, file_data = self._parse_multipart(body, boundary)
            if not filename or not file_data:
                self._json_response(400, {"error": "No file found in upload"})
                return

            MEDIA_DIR.mkdir(parents=True, exist_ok=True)
            ext = Path(filename).suffix or ".bin"
            safe_name = f"{Path(filename).stem}-{uuid.uuid4().hex[:8]}{ext}"
            dest = MEDIA_DIR / safe_name
            dest.write_bytes(file_data)

            self._json_response(200, {"path": f"/media/{safe_name}"})
        except Exception as e:
            self._json_response(500, {"error": f"Upload failed: {e}"})

    def _parse_multipart(self, body: bytes, boundary: str):
        """Extract filename and data from multipart body."""
        boundary_bytes = f"--{boundary}".encode("utf-8")
        parts = body.split(boundary_bytes)
        for part in parts:
            if b"Content-Disposition" not in part:
                continue
            header_end = part.find(b"\r\n\r\n")
            if header_end == -1:
                continue
            headers_raw = part[:header_end].decode("utf-8", errors="replace")
            data = part[header_end + 4 :].rstrip(b"\r\n--")

            filename = None
            for line in headers_raw.split("\r\n"):
                if 'name="file"' in line and "filename=" in line:
                    # Extract filename from the Content-Disposition line
                    start = line.find('filename="')
                    if start != -1:
                        start += len('filename="')
                        end = line.find('"', start)
                        if end != -1:
                            filename = line[start:end]
                    break
            if filename and data:
                return filename, data
        return None, None

    def _json_response(self, status: int, data: dict):
        """Send a JSON response."""
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        """Quiet logging with timestamp."""
        import datetime
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {args[0]} {args[1]} {args[2]}")


def main():
    import sys
    # Force UTF-8 encoding for Windows console
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
    server = HTTPServer((HOST, PORT), FamilyTreeHandler)
    print(f"Family Tree Server running at http://{HOST}:{PORT}")
    print(f"Media directory: {MEDIA_DIR}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
