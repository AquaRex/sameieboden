#!/usr/bin/env python3
"""Bump cache-busting versions across the site.

Walks index.html and every .js file in js/, replacing `?v=NNN` query
strings on local asset references with a fresh version (defaults to a
Unix timestamp). Run this once after editing JS/CSS code, before
committing and pushing to git. Visitors will then be guaranteed to
fetch the new code, even if they had the old one cached.

You do NOT need to run this when only editing items/images — those
are already cache-safe (items.json fetched no-store; images get
?v= on upload).

Usage:
    python bump_version.py            # uses current timestamp
    python bump_version.py 42         # explicit version
"""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JS_DIR = ROOT / "js"
INDEX = ROOT / "index.html"

# Match `?v=...` up to the next quote/space/closing paren/end-of-line.
# Excludes `$` and `{` so we don't mangle JS template literals like
# `?v=${Date.now()}` that we deliberately keep in the source.
VERSION_RE = re.compile(r"\?v=[^\"'\s\)\$\{\}]*")
# Match relative .js imports/re-exports without a version.
IMPORT_RE = re.compile(
    r"""(?P<keyword>(?:import|export)\b[^"']*?\bfrom\s*|import\s*\(\s*)"""
    r"""(?P<quote>["'])(?P<path>\.{1,2}/[^"']+?\.js)(?P=quote)"""
)


def bump_file(path: Path, version: str) -> int:
    text = path.read_text(encoding="utf-8")
    original = text

    # 1) Replace any existing ?v=... with the new version.
    text = VERSION_RE.sub(f"?v={version}", text)

    # 2) Add ?v=... to relative .js imports that don't have one yet.
    def add_version(m: re.Match) -> str:
        path_part = m.group("path")
        if "?" in path_part:
            return m.group(0)
        return f'{m.group("keyword")}{m.group("quote")}{path_part}?v={version}{m.group("quote")}'

    text = IMPORT_RE.sub(add_version, text)

    if text != original:
        path.write_text(text, encoding="utf-8")
        return 1
    return 0


def main() -> None:
    version = sys.argv[1] if len(sys.argv) > 1 else str(int(time.time()))
    targets = [INDEX, *sorted(JS_DIR.rglob("*.js"))]
    changed = 0
    for p in targets:
        changed += bump_file(p, version)
    print(f"Bumped {changed} file(s) to version {version}")
    print("Commit and push to publish.")


if __name__ == "__main__":
    main()
