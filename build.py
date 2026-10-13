#!/usr/bin/env python3
"""Build the app: one self-contained index.html (in dist/ for the tests and at the top for GitHub Pages).
Usage: python3 build.py [output path]"""
import base64, pathlib, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"

MARK = ('<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" '
        'stroke-width="2.5" stroke-linecap="round" aria-hidden="true">'
        '<line x1="2" y1="13" x2="26" y2="13"/><line x1="11" y1="4" x2="11" y2="21"/>'
        '<line x1="16" y1="13" x2="22" y2="24"/></svg>')
FAV = ("data:image/svg+xml," + (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28' fill='none' stroke='%232346C4' "
    "stroke-width='3' stroke-linecap='round'><line x1='2' y1='13' x2='26' y2='13'/>"
    "<line x1='11' y1='4' x2='11' y2='21'/><line x1='16' y1='13' x2='22' y2='24'/></svg>"))

TEMPLATE = """<!doctype html>
<!--
  Baseline: sentence diagram lessons and practice (Reed–Kellogg system).
  One file. Host it as index.html (for example, on GitHub Pages).
  Font: Atkinson Hyperlegible Next, Copyright 2020-2024 The Atkinson Hyperlegible
  Next Project Authors. SIL Open Font License 1.1, https://openfontlicense.org
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Learn to diagram English sentences: short lessons, a line guide, popup explainers, practice puzzles, long challenge sentences, and a builder for your own sentences.">
<meta name="theme-color" content="#F4F6FA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E131B" media="(prefers-color-scheme: dark)">
<title>Baseline: learn to diagram sentences</title>
<link rel="icon" href="__FAV__">
<style>
__CSS__
</style>
</head>
<body>
<header class="top"><div class="top-in">
  <a class="brand" href="#/">__MARK__<span>Baseline</span></a>
  <nav class="nav" aria-label="Main">
    <a href="#/" data-view="lessons">Lessons</a>
    <a href="#/practice" data-view="practice">Practice</a>
    <a href="#/challenges" data-view="challenges">Challenges</a>
    <a href="#/build" data-view="build">Build</a>
    <a href="#/cards" data-view="cards">Cards</a>
    <a href="#/guide" data-view="guide">Guide</a>
  </nav>
</div></header>
<main id="app"><noscript><p>Baseline needs JavaScript. Turn on JavaScript in your browser.</p></noscript></main>
<dialog id="bdlg" aria-labelledby="bd-word"><div class="dlg-in bd" id="bd-in"></div></dialog>
<dialog id="dlg" aria-labelledby="dlg-title">
  <div class="dlg-in">
    <p class="dlg-word" id="dlg-word"></p>
    <h2 id="dlg-title"></h2>
    <div id="dlg-text"></div>
    <button type="button" class="btn primary" id="dlg-close">Close</button>
  </div>
</dialog>
<script>
__JS__
</script>
</body>
</html>
"""

def check_js(js):
    """Stop the build on a JavaScript syntax error (needs Node.js; skipped without it)."""
    node = shutil.which("node")
    if not node: return
    r = subprocess.run([node, "-e", "new Function(require('fs').readFileSync(0, 'utf8'))"], input=js, text=True, capture_output=True)
    if r.returncode: sys.exit("JavaScript syntax error:\n" + r.stderr.strip().splitlines()[-1])

def build(out=None):
    font = base64.b64encode((SRC / "ahn-sub.woff2").read_bytes()).decode()
    css = (SRC / "styles.css").read_text().replace("__FONT__", font)
    js = "\n".join((SRC / f).read_text() for f in ("data.js", "challenges.js", "engine.js", "builder.js", "app.js"))
    js = "(function () {\n" + js + "\n})();"
    check_js(js)
    html = (TEMPLATE.replace("__CSS__", css).replace("__JS__", js)
            .replace("__MARK__", MARK).replace("__FAV__", FAV))
    outs = [pathlib.Path(out)] if out else [ROOT / "dist" / "index.html", ROOT / "index.html"]   # dist/ for the tests, the top for GitHub Pages
    for o in outs:
        o.parent.mkdir(parents=True, exist_ok=True)
        o.write_text(html)
        print(f"wrote {o} ({o.stat().st_size / 1024:.1f} KB)")

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else None)
