"""Mutation check: break one layout constant at a time; the logic test must report errors."""
import sys, collections, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests'))
import run
from playwright.sync_api import sync_playwright
MUTS = {
  'hook length 0': "B.G.HOOK = 0",
  'clause line on the SV line': "B.G.CONN = 0; B.G.CONN_RES = 0",
  'step too short for the word': "B.G.STEP_MIN = 10; B.G.CZPAD = -30",
  'second clause not lowered': "B.G.STEP_DN = -200",
  'verb phrase overlaps': "B.G.AUXGAP = -60",
  'slant spacing collapsed': "B.G.DMIN = 2",
}
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, js in MUTS.items():
        pg = b.new_page(); pg.goto((ROOT / 'dist' / 'index.html').as_uri()); pg.wait_for_timeout(300)
        pg.evaluate(f"() => {{ const B = window.BASELINE; {js}; }}")
        res = pg.evaluate(run.LOGIC_JS)
        kinds = collections.Counter(e.split(': ', 1)[-1].split(' "')[0].split(' near')[0][:60] for e in res['errs'])
        print(f"{name:32} -> {len(res['errs']):4} errors; top: {kinds.most_common(2)}")
        pg.close()
    b.close()
