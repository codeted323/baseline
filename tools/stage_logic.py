"""Quick check of a build: diagram logic, plain-English text rules, explainers. HTML=path python3 tools/stage_logic.py"""
import sys, json, os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests'))
import run
from playwright.sync_api import sync_playwright
html = os.environ.get("HTML", str(ROOT / "dist" / "index.html"))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 390, "height": 844})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + html); pg.wait_for_timeout(500)
    res = pg.evaluate(run.LOGIC_JS)
    print("stats", json.dumps(res["stats"]))
    for e in res["errs"]: print("LOGIC", e)
    items = pg.evaluate("window.BASELINE.steTexts()")
    for i in run.ste_lint(items): print("STE", i)
    texts = pg.evaluate("""() => { const B = window.BASELINE, out = [];
       for (const [k, sp] of Object.entries(B.SENT)) for (const n of B.wordsOf(sp)) { const e = B.explainWord(n); out.push([k, n.w, n.role, e.title, e.extra]); } return out; }""")
    for k, w, role, title, extra in texts:
        if role not in ("V", "SU") and not extra: print(f"EXPLAINER missing for {k}/{w} ({role})")
    for e in errs: print("PAGE", e)
    print("done", len(res["errs"]))
    b.close()
