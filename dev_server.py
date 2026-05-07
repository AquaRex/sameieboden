#!/usr/bin/env python3
"""Local development server for sameieboden.

Serves the static site AND exposes a tiny API used by the in-page editor
(only available when the site is loaded from localhost) to persist edits
back to the repository:

  POST /api/upload   -> { slug, dataUrl }      writes images/<slug>.<ext>
  PUT  /api/items    -> [ {item}, ... ]        writes data/items.json

After editing locally, commit the changed files in `images/` and
`data/items.json` and push to publish.

Run:
    python dev_server.py            # serves on http://localhost:8000
    python dev_server.py 8080       # custom port
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IMAGES_DIR = ROOT / "images"
DATA_DIR = ROOT / "data"
ITEMS_FILE = DATA_DIR / "items.json"

ALLOWED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "[::1]"}
SLUG_RE = re.compile(r"[^a-z0-9._-]+")
EXT_BY_MIME = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


def safe_slug(raw: str) -> str:
    raw = (raw or "").lower().strip()
    raw = raw.replace("æ", "ae").replace("ø", "oe").replace("å", "aa")
    raw = SLUG_RE.sub("-", raw).strip("-")
    return raw or "image"


class Handler(SimpleHTTPRequestHandler):
    # Serve from the project root regardless of cwd
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # --- helpers ---
    def _is_local(self) -> bool:
        host = self.headers.get("Host", "").split(":")[0].strip("[]")
        return host in ALLOWED_HOSTS

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> object:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return None
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def end_headers(self) -> None:  # disable caching during dev
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # --- routing ---
    def do_POST(self) -> None:  # noqa: N802
        if not self._is_local():
            self._send_json(403, {"error": "forbidden"})
            return
        if self.path == "/api/upload":
            self._handle_upload()
        else:
            self._send_json(404, {"error": "not found"})

    def do_PUT(self) -> None:  # noqa: N802
        if not self._is_local():
            self._send_json(403, {"error": "forbidden"})
            return
        if self.path == "/api/items":
            self._handle_save_items()
        else:
            self._send_json(404, {"error": "not found"})

    # --- handlers ---
    def _handle_upload(self) -> None:
        try:
            payload = self._read_json() or {}
            data_url = payload.get("dataUrl", "")
            slug = safe_slug(payload.get("slug", ""))
            if not data_url.startswith("data:"):
                raise ValueError("dataUrl must be a data: URL")
            header, _, b64 = data_url.partition(",")
            mime = header.split(";")[0][5:] or "image/jpeg"
            ext = EXT_BY_MIME.get(mime, "jpg")
            blob = base64.b64decode(b64)
            IMAGES_DIR.mkdir(parents=True, exist_ok=True)
            filename = f"{slug}.{ext}"
            (IMAGES_DIR / filename).write_bytes(blob)
            self._send_json(200, {"path": f"images/{filename}"})
        except Exception as exc:  # surface error to client
            self._send_json(400, {"error": str(exc)})

    def _handle_save_items(self) -> None:
        try:
            payload = self._read_json()
            if not isinstance(payload, list):
                raise ValueError("body must be a JSON array")
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            ITEMS_FILE.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            self._send_json(200, {"ok": True, "count": len(payload)})
        except Exception as exc:
            self._send_json(400, {"error": str(exc)})


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"sameieboden dev server → http://localhost:{port}")
    print("  Edits in the page will write to images/ and data/items.json")
    print("  Stop with Ctrl+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
