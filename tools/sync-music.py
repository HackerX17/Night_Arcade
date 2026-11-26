#!/usr/bin/env python3
"""Copy the shared "My music" player (shared/arcade-music.html) into every game page and the hub.

Each page gets its own copy between the arcade-music:start / arcade-music:end markers, so every game
stays a single self-contained page that works offline. Edit shared/arcade-music.html, then run:

    python3 tools/sync-music.py
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SNIPPET = (ROOT / "shared" / "arcade-music.html").read_text(encoding="utf-8").strip() + "\n"
PAGES = ["index.html", "sandblade/index.html", "skyline-leap/index.html", "sandblade-legion/index.html",
         "sandblade-siege/index.html", "chopper-cave/index.html", "iron-sector/index.html",
         "prism-breaker/index.html", "redline-nights/index.html",
         "void-eater/index.html", "nova-strike/index.html",
         "glowline/index.html", "pulse-runner/index.html"]
BLOCK = re.compile(r"<!-- arcade-music:start.*?<!-- arcade-music:end -->\n?", re.S)

for rel in PAGES:
    path = ROOT / rel
    html = path.read_text(encoding="utf-8")
    if BLOCK.search(html):
        html = BLOCK.sub(lambda m: SNIPPET, html, count=1)
    else:
        i = html.find("<script")        # before the page's own scripts, so its key handling runs first
        if i < 0:
            i = html.find("</body>")    # pages without scripts: at the end of the body
        if i < 0:
            sys.exit(f"{rel}: nowhere to insert the player")
        html = html[:i] + SNIPPET + html[i:]
    path.write_text(html, encoding="utf-8")
    print(f"synced {rel}")
