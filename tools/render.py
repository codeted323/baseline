"""Render sentence diagrams to a PNG: python3 tools/render.py key1,key2 out.png [natural|puzzle]"""
import sys
from playwright.sync_api import sync_playwright
keys = sys.argv[1].split(','); out = sys.argv[2]; mode = sys.argv[3] if len(sys.argv) > 3 else 'natural'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 760, "height": 400}, device_scale_factor=1)
    import os, pathlib; pg.goto("file://" + os.environ.get("HTML", str(pathlib.Path(__file__).resolve().parent.parent / "dist" / "index.html"))); pg.wait_for_timeout(500)
    pg.evaluate("""([keys, mode]) => {
      const app = document.getElementById('app');
      app.innerHTML = keys.map(k => `<p style="margin:8px 0 2px;font-size:14px">${k}: ${window.BASELINE.SENT[k].s}</p><div class="sheet" style="overflow:visible">${window.BASELINE.svgFor(window.BASELINE.layout(window.BASELINE.SENT[k], mode), { mode: mode === 'puzzle' ? 'puzzle' : 'static' })}</div>`).join('');
      document.querySelector('header').remove();
    }""", [keys, mode])
    pg.wait_for_timeout(200)
    pg.screenshot(path=out, full_page=True)
    b.close()
