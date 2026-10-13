#!/usr/bin/env python3
"""UX/UI test suite for dist/index.html (Playwright + Chromium).

Groups:
  A. Layout checks on every view and viewport (overflow, clipping, wrapping,
     text size, tap-target size, covered or overlapping controls).
  B. Diagram geometry (text vs text, text vs lines, tap areas) on every
     sentence, natural and puzzle modes, in the real DOM.
  C. Diagram logic invariants from the layout model (Reed–Kellogg rules).
  D. Functional flows (nav, popups, practice, keyboard, progress, reset).
  E. Colour contrast (light and dark).
  F. Simplified Technical English lint on all general text.
"""
import asyncio, http.server, json, re, socketserver, sys, threading, functools, pathlib

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SHOTS = ROOT / "tests" / "shots"
SHOTS.mkdir(exist_ok=True)
PORT = 8765
BASE = f"http://127.0.0.1:{PORT}/index.html"

VIEWPORTS = [(320, 568), (360, 740), (390, 844), (768, 1024), (1280, 800)]
FAILS, WARNS, INFO = [], [], []

def fail(msg): FAILS.append(msg)
def warn(msg): WARNS.append(msg)

def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Q, directory=str(DIST))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

# ---------------------------------------------------------------- in-page JS
GEOM_JS = r"""
() => {
  const out = { overflow: [], offscreen: [], clipped: [], wrapped: [], small: [], targets: [], targetsAAA: [],
                covered: [], overlapCtl: [], svgText: [], svgLine: [], svgHit: [], svgFont: [] };
  const vw = document.documentElement.clientWidth;
  const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0 && !el.closest('[hidden]') && !el.closest('.sr'); };
  const name = el => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '') + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '"');
  // page-level horizontal overflow
  if (document.documentElement.scrollWidth > vw + 0.5) out.overflow.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  const inScroller = el => { for (let p = el.parentElement; p; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return p; } return null; };
  const clipOf = el => { const r = { l: -1e9, t: -1e9, r: 1e9, b: 1e9, by: null };   // visible area inside scroll containers
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a), R = a.getBoundingClientRect(), cut = v => v === 'auto' || v === 'scroll' || v === 'hidden';
      if (cut(cs.overflowX)) { const L = R.left + a.clientLeft; r.l = Math.max(r.l, L); r.r = Math.min(r.r, L + a.clientWidth); r.by = r.by || a; }
      if (cut(cs.overflowY)) { const T = R.top + a.clientTop; r.t = Math.max(r.t, T); r.b = Math.min(r.b, T + a.clientHeight); r.by = r.by || a; }
    }
    return r; };
  // elements outside viewport (horizontal) and clipped text
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('svg') || el.closest('dialog:not([open])') || !vis(el)) return;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 0.5 || r.left < -0.5) && !inScroller(el)) out.offscreen.push(`${name(el)} [${r.left.toFixed(1)}, ${r.right.toFixed(1)}]`);
    const s = getComputedStyle(el);
    if (['BUTTON', 'A', 'H1', 'H2', 'P', 'LABEL', 'SPAN', 'LI', 'SELECT', 'STRONG', 'FIGCAPTION'].includes(el.tagName) && s.overflowX !== 'auto' && s.overflowX !== 'scroll') {
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.clipped.push(`${name(el)} scrollW ${el.scrollWidth} > ${el.clientWidth}`);
    }
  });
  // label wrapping in controls
  document.querySelectorAll('.btn, .chip:not(.bw), .bw-w, .bw-j, .nav a, .dot, select').forEach(el => {   // a word button of the builder has two lines: each line must not wrap
    if (!vis(el) || el.tagName === 'SELECT') return;
    const rg = document.createRange(); rg.selectNodeContents(el);
    const lines = new Set([...rg.getClientRects()].map(r => Math.round(r.top))).size;
    if (lines > 1) out.wrapped.push(`${name(el)} wraps to ${lines} lines`);
  });
  // text size
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const el = n.parentElement;
    if (!n.textContent.trim() || !el || el.closest('svg') || el.closest('dialog:not([open])') || !vis(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 14) out.small.push(`${name(el)} font ${fs}px`);
  }
  // diagram text effective size
  document.querySelectorAll('svg.dg').forEach(svg => {
    const W = +svg.dataset.w, sc = svg.getBoundingClientRect().width / W;
    svg.querySelectorAll('text').forEach(t => {
      const eff = parseFloat(getComputedStyle(t).fontSize) * sc;
      if (eff < 13.9) out.svgFont.push(`"${t.textContent}" ${eff.toFixed(1)}px (scale ${sc.toFixed(2)})`);
    });
  });
  // interactive controls: size, covered, overlap
  const ctl = [...document.querySelectorAll('a[href], button, select, [role="button"], [tabindex="0"]')]
    .filter(el => vis(el) && !el.closest('dialog:not([open])') && !el.disabled && (!document.querySelector('dialog[open]') || el.closest('dialog[open]')));
  const polyOf = el => {
    if (el.closest('svg')) {
      const hit = el.querySelector('.hit'); if (!hit) return null;
      const m = hit.getScreenCTM();
      let pts;
      if (hit.tagName === 'polygon') pts = [...hit.points].map(p => ({ x: p.x, y: p.y }));
      else { const b = hit.getBBox(); pts = [{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}]; }
      return pts.map(p => { const q = new DOMPoint(p.x, p.y).matrixTransform(m); return [q.x, q.y]; });
    }
    const r = el.getBoundingClientRect();
    return [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]];
  };
  const sat = (A, B) => { // convex polygon overlap (strict, 0.5px tolerance)
    for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length], nx = y2 - y1, ny = x1 - x2, L = Math.hypot(nx, ny) || 1;
      const pa = A.map(([x, y]) => (x * nx + y * ny) / L), pb = B.map(([x, y]) => (x * nx + y * ny) / L);
      if (Math.max(...pa) <= Math.min(...pb) + 0.5 || Math.max(...pb) <= Math.min(...pa) + 0.5) return false;
    }
    return true;
  };
  const info = ctl.map(el => ({ el, poly: polyOf(el) })).filter(o => o.poly);
  info.forEach(o => { o.clip = clipOf(o.el); const xs = o.poly.map(p => p[0]), ys = o.poly.map(p => p[1]);   // the visible box of the control
    o.vis = { l: Math.max(Math.min(...xs), o.clip.l), r: Math.min(Math.max(...xs), o.clip.r), t: Math.max(Math.min(...ys), o.clip.t), b: Math.min(Math.max(...ys), o.clip.b) }; });
  info.forEach(({ el, poly, clip }) => {
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    let w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    if (el.closest('svg')) { // rotated rect: use side lengths
      w = Math.hypot(poly[1][0] - poly[0][0], poly[1][1] - poly[0][1]); h = Math.hypot(poly[3][0] - poly[0][0], poly[3][1] - poly[0][1]);
      if (el.classList.contains('dv')) { const t = w; w = Math.min(w, h); h = Math.max(t, h); }
    }
    const inline = el.classList.contains('term');
    // WCAG 2.5.8 spacing exception: an undersized target passes when a 24 px circle
    // on its center does not touch any other target.
    const dPP = (pt, P) => { let inside = true, best = 1e9;
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length];
        const cr = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]); if (cr < 0) inside = false;
        const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(pt[0] - a[0] - t * dx, pt[1] - a[1] - t * dy)); }
      return inside ? 0 : best; };
    const spaced = () => { const c = [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
      return info.every(o => o.el === el || o.clip.by !== clip.by || dPP(c, o.poly) >= 12 || dPP(c, [...o.poly].reverse()) >= 12); };   // neighbors in the same scroll box
    if (!inline && (w < 23.9 || h < 23.9) && !(el.closest('svg') && spaced())) out.targets.push(`${name(el)} ${w.toFixed(1)}x${h.toFixed(1)}`);
    else if (!inline && !el.closest('svg') && (w < 43.9 || h < 43.9)) out.targetsAAA.push(`${name(el)} ${w.toFixed(1)}x${h.toFixed(1)}`);
    // covered? test the centroid (only when on screen)
    const cx = xs.reduce((a, b) => a + b) / xs.length, cy = ys.reduce((a, b) => a + b) / ys.length;
    const cr = clipOf(el);   // skip points that a scroll container clips (the user scrolls to them)
    const clipOK = cx >= cr.l + 1 && cx <= cr.r - 1 && cy >= cr.t + 1 && cy <= cr.b - 1;
    if (clipOK && cy > 0 && cy < innerHeight && cx > 0 && cx < innerWidth) {
      const top = document.elementFromPoint(cx, cy);
      if (top && !el.contains(top) && !(el.closest('svg') && top.closest('.part') === el)) {
        const sc = inScroller(el); const sr = sc && sc.getBoundingClientRect();
        if (!sc || (cx > sr.left && cx < sr.right)) out.covered.push(`${name(el)} covered by ${name(top)}`);
      }
    }
  });
  for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++) {
    const a = info[i], b = info[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (a.clip.by === b.clip.by) { if (sat(a.poly, b.poly)) out.overlapCtl.push(`${name(a.el)} overlaps ${name(b.el)}`); continue; }
    // in different scroll containers: only the visible parts count
    const A = a.vis, B = b.vis;
    if (A.r - A.l > 0.5 && A.b - A.t > 0.5 && B.r - B.l > 0.5 && B.b - B.t > 0.5 && A.l < B.r - 0.5 && B.l < A.r - 0.5 && A.t < B.b - 0.5 && B.t < A.b - 0.5)
      out.overlapCtl.push(`${name(a.el)} overlaps ${name(b.el)} (visible parts)`);
  }
  // diagram internals: text vs text, text vs line
  const ctx = document.createElement('canvas').getContext('2d');
  document.querySelectorAll('svg.dg').forEach((svg, si) => {
    const texts = [...svg.querySelectorAll('text')].map(t => {
      const m = t.getScreenCTM(), b = t.getBBox();
      const em = [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]]
        .map(([x, y]) => { const q = new DOMPoint(x, y).matrixTransform(m); return [q.x, q.y]; });
      const cs = getComputedStyle(t); ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const mt = ctx.measureText(t.textContent), x0 = +t.getAttribute('x') - mt.width / 2, y0 = +t.getAttribute('y');
      const tight = [[x0 - mt.actualBoundingBoxLeft, y0 - mt.actualBoundingBoxAscent], [x0 + mt.actualBoundingBoxRight, y0 - mt.actualBoundingBoxAscent],
        [x0 + mt.actualBoundingBoxRight, y0 + mt.actualBoundingBoxDescent], [x0 - mt.actualBoundingBoxLeft, y0 + mt.actualBoundingBoxDescent]]
        .map(([x, y]) => { const q = new DOMPoint(x, y).matrixTransform(m); return [q.x, q.y]; });
      return { t, em, tight, conj: !!t.closest('.r-CONJ') || !!t.closest('.mk') || !!(t.closest('.slot') && t.parentNode.querySelector('.box')) };
    });
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++)
      if (sat(texts[i].em, texts[j].em)) out.svgText.push(`dg${si} "${texts[i].t.textContent}" vs "${texts[j].t.textContent}"`);
    const segHitsPoly = (p1, p2, P, r) => { // thick segment vs convex polygon
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * r, ny = dx / L * r;
      return sat([[p1[0] + nx, p1[1] + ny], [p2[0] + nx, p2[1] + ny], [p2[0] - nx, p2[1] - ny], [p1[0] - nx, p1[1] - ny]], P);
    };
    svg.querySelectorAll('line.ln').forEach(ln => {
      const m = ln.getScreenCTM();
      const p = (x, y) => { const q = new DOMPoint(+x, +y).matrixTransform(m); return [q.x, q.y]; };
      const a = p(ln.getAttribute('x1'), ln.getAttribute('y1')), b = p(ln.getAttribute('x2'), ln.getAttribute('y2'));
      const half = parseFloat(getComputedStyle(ln).strokeWidth) / 2 * (svg.getBoundingClientRect().width / +svg.dataset.w);
      texts.forEach(tx => {
        if (tx.conj && ln.classList.contains('k-dash')) return; // the conjunction sits on its dashed line, with a mask
        if (segHitsPoly(a, b, tx.tight, half)) out.svgLine.push(`dg${si} line ${ln.getAttribute('class')} touches "${tx.t.textContent}"`);
      });
    });
    // tap areas inside one diagram must not overlap
    const hits = [...svg.querySelectorAll('.part')].map(el => ({ el, poly: polyOf(el) })).filter(o => o.poly);
    for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++)
      if (sat(hits[i].poly, hits[j].poly)) out.svgHit.push(`dg${si} ${name(hits[i].el)} vs ${name(hits[j].el)}`);
  });
  return out;
}
"""

LOGIC_JS = (ROOT / "tests" / "logic.js").read_text()

CONTRAST_JS = r"""
() => {
  const v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rgb = h => { const s = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255); };
  const lum = c => { const [r, g, b] = rgb(c).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const cr = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const pairs = [
    ['ink on paper', '--ink', '--paper', 4.5], ['ink on sheet', '--ink', '--sheet', 4.5], ['muted on paper', '--muted', '--paper', 4.5],
    ['muted on sheet', '--muted', '--sheet', 4.5], ['accent on paper', '--accent', '--paper', 4.5], ['accent on accent-soft', '--accent', '--accent-soft', 4.5],
    ['accent-ink on accent', '--accent-ink', '--accent', 4.5], ['red on red-soft', '--red', '--red-soft', 4.5], ['green on green-soft', '--green', '--green-soft', 4.5],
    ['ink on accent-soft', '--ink', '--accent-soft', 4.5], ['ink on red-soft', '--ink', '--red-soft', 4.5], ['sheet on green', '--sheet', '--green', 4.5], ['sheet on red (wrong comma chip)', '--sheet', '--red', 4.5],
    ['box outline (muted) on sheet', '--muted', '--sheet', 3], ['red box on red-soft', '--red', '--red-soft', 3], ['line on paper (dividers, decorative)', '--line', '--paper', 1.3],
  ];
  return pairs.map(([n, a, b, min]) => ({ n, ratio: +cr(v(a), v(b)).toFixed(2), min }));
}
"""

# ---------------------------------------------------------------- STE lint
STE_ING_OK = {"thing", "something", "nothing", "anything", "everything", "string", "spring", "king", "ring", "sing", "bring", "during"}
# STE allows an -ing word as part of a technical name. Here: "linking verb", "helping verb" and
# "subordinating conjunction" only.
STE_ING_NAMES = {"linking": ("verb", "verbs"), "helping": ("verb", "verbs"), "subordinating": ("conjunction", "conjunctions")}
STE_BANNED = {"should", "would", "may", "might", "could", "shall", "please"}
PASSIVE = re.compile(r"\b(is|are|was|were|be|been|being)\s+(\w+ed|shown|known|given|done|made|written|seen|taken)\b", re.I)
PASSIVE_OK = {"is red", "is shown"}  # none expected; placeholder

def ste_lint(items):
    issues = []
    for it in items:
        text, kind, src = it["text"], it["kind"], it["src"]
        sentences = [s for s in re.split(r"(?<=[.!?])[”\"]?\s+(?=[A-Z“\"(0-9])", text) if s.strip()]
        limit = 20 if kind == "procedure" else 25
        for s in sentences:
            words = re.findall(r"[A-Za-z0-9’'()-]+", s)
            if len(words) > limit:
                issues.append(f"[{src}] {len(words)} words > {limit}: {s}")
        if kind in ("descriptive", "procedure") and len(sentences) > 6:
            issues.append(f"[{src}] {len(sentences)} sentences in one paragraph (max 6)")
        quoted = re.sub(r"“[^”]*”", " ", text)  # quoted example words are not general text
        toks = re.findall(r"[A-Za-z]+", quoted)
        for k, w in enumerate(toks):
            lw = w.lower()
            if lw in STE_BANNED:
                issues.append(f"[{src}] banned word '{w}': {text}")
            name = lw in STE_ING_NAMES and k + 1 < len(toks) and toks[k + 1].lower() in STE_ING_NAMES[lw]
            if lw.endswith("ing") and lw not in STE_ING_OK and len(lw) > 4 and not name:
                issues.append(f"[{src}] -ing form '{w}': {text}")
        for m in PASSIVE.finditer(quoted):
            issues.append(f"[{src}] possible passive '{m.group(0)}': {text}")
    return issues

# ---------------------------------------------------------------- runners
async def new_page(browser, vp, scheme="light", motion="no-preference"):
    ctx = await browser.new_context(viewport={"width": vp[0], "height": vp[1]}, color_scheme=scheme,
                                    reduced_motion=motion, device_scale_factor=1, has_touch=vp[0] < 700)
    page = await ctx.new_page()
    page.errors = []
    page.on("console", lambda m: page.errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: page.errors.append(f"pageerror: {e}"))
    return ctx, page

async def goto(page, hash_):
    await page.evaluate(f"location.hash = {json.dumps(hash_)}")
    await page.wait_for_timeout(120)

def report_geom(tag, g):
    for k, label, sev in [("overflow", "page overflow", fail), ("offscreen", "off-screen", fail), ("clipped", "clipped text", fail),
                          ("wrapped", "label wraps", warn), ("small", "text < 14px", fail), ("svgFont", "diagram text < 14px", fail),
                          ("targets", "tap target < 24px", fail), ("covered", "covered control", fail), ("overlapCtl", "overlapping controls", fail),
                          ("svgText", "diagram text overlap", fail), ("svgLine", "diagram text touches line", fail), ("svgHit", "diagram tap areas overlap", fail)]:
        for m in g[k]:
            sev(f"{tag}: {label}: {m}")
    for m in g["targetsAAA"]:
        INFO.append(f"{tag}: below 44px (AAA): {m}")

async def solve(page):
    """Place every word in its box with clicks, then press Check."""
    plan = await page.evaluate("""() => { const P = window.BASELINE.state(); const used = new Set();
      return P.slots.map((s, k) => { const c = P.chips.find(c => !used.has(c.id) && c.t === s.n.w); used.add(c.id); return [c.id, k]; }); }""")
    for chip, slot in plan:
        await page.click(f'[data-chip="{chip}"]')
        await page.click(f'#pz-sheet [data-s="{slot}"]')
    await page.click('[data-act="check"]')

async def layout_suite(browser):
    for vp in VIEWPORTS:
        ctx, page = await new_page(browser, vp)
        await page.goto(BASE); await page.wait_for_timeout(400)
        nl = await page.evaluate("window.BASELINE.LESSONS.length")
        routes = ["#/", "#/guide", "#/challenges", "#/build", "#/cards"] + [f"#/lesson/{i}" for i in range(1, nl + 1)]
        practice = await page.evaluate("() => window.BASELINE.LESSONS.map((l, i) => l.practice.map((_, j) => `#/practice/${i + 1}/${j + 1}`)).flat()")
        for r in routes + practice:
            await goto(page, r)
            report_geom(f"{vp[0]}x{vp[1]} {r}", await page.evaluate(GEOM_JS))
            if r.startswith("#/practice"):
                # half-filled state with one selected chip (armed boxes)
                await page.click('#pz-bank .chip:not([disabled])')
                report_geom(f"{vp[0]}x{vp[1]} {r} armed", await page.evaluate(GEOM_JS))
                await solve(page)
                await page.wait_for_timeout(50)
                report_geom(f"{vp[0]}x{vp[1]} {r} solved", await page.evaluate(GEOM_JS))
        n_ch = await page.evaluate("window.BASELINE.CHALLENGES.length")
        for n in range(1, n_ch + 1):
            r = f"#/challenge/{n}"
            await ch_goto(page, n)
            report_geom(f"{vp[0]}x{vp[1]} {r}", await page.evaluate(GEOM_JS))
            await page.click('[data-act="show"]'); await page.wait_for_timeout(50)
            report_geom(f"{vp[0]}x{vp[1]} {r} shown", await page.evaluate(GEOM_JS))
            await page.evaluate("localStorage.removeItem('baseline-challenges-v1')")
        for key in ["rv1", "v12"]:
            await page.evaluate(f"localStorage.setItem('baseline-build-v1', JSON.stringify({{ text: window.BASELINE.SENT.{key}.s, jobs: [], started: true, key: '{key}' }}))")
            await page.evaluate("location.hash = '#/build'"); await page.reload(); await page.wait_for_timeout(400)   # the page reads the saved builder at start
            report_geom(f"{vp[0]}x{vp[1]} build {key} no jobs", await page.evaluate(GEOM_JS))
            await page.click('[data-bact="answer"]'); await page.wait_for_timeout(100)
            report_geom(f"{vp[0]}x{vp[1]} build {key} answer", await page.evaluate(GEOM_JS))
            await page.click('#b-words [data-bw="2"]'); await page.wait_for_timeout(100)
            report_geom(f"{vp[0]}x{vp[1]} build {key} job dialog", await page.evaluate(GEOM_JS))
            await page.click('#bd-in [data-bd="change"]'); await page.wait_for_timeout(50)
            report_geom(f"{vp[0]}x{vp[1]} build {key} job list", await page.evaluate(GEOM_JS))
            await page.keyboard.press("Escape")
        await page.evaluate("localStorage.removeItem('baseline-build-v1')")
        await goto(page, "#/cards")
        for deck in ["terms", "lines", "commas", "all"]:
            await page.click(f'[data-fcdeck="{deck}"]')
            for k in range(3):               # a few cards, each side
                if not await page.locator("#fc-card").count(): break
                report_geom(f"{vp[0]}x{vp[1]} cards {deck} {k} front", await page.evaluate(GEOM_JS))
                await page.click("#fc-card"); await page.wait_for_timeout(500)
                report_geom(f"{vp[0]}x{vp[1]} cards {deck} {k} back", await page.evaluate(GEOM_JS))
                await page.click('[data-fc="again"]')
        await page.click(".fc-all summary")
        report_geom(f"{vp[0]}x{vp[1]} cards list", await page.evaluate(GEOM_JS))
        await page.evaluate("localStorage.removeItem('baseline-cards-v1')")
        # dialog open state (a long explainer: the clause conjunction)
        for r in ["#/lesson/6", "#/lesson/9"]:
            await goto(page, r)
            sel = '.part.r-CCONJ' if r.endswith("/9") else '.sheet .part.w >> nth=0'
            await page.click(sel)
            report_geom(f"{vp[0]}x{vp[1]} dialog {r}", await page.evaluate(GEOM_JS))
            await page.keyboard.press("Escape")
        await page.evaluate("localStorage.clear()")
        for e in page.errors: fail(f"{vp[0]}x{vp[1]}: {e}")
        await ctx.close()

async def screenshots(browser):
    shots = [((360, 740), "light", "#/", "home"), ((360, 740), "dark", "#/lesson/9", "lesson9-dark"),
             ((360, 740), "light", "#/practice/7/3", "practice-7-3"), ((1280, 800), "light", "#/lesson/3", "desktop-lesson3"),
             ((320, 568), "light", "#/practice/10/5", "practice-320-10-5"), ((768, 1024), "dark", "#/guide", "guide-tablet-dark"),
             ((390, 844), "light", "#/lesson/2", "lesson2"), ((1280, 800), "light", "#/practice/10/4", "desktop-practice-10-4"),
             ((390, 844), "light", "#/challenges", "challenges"), ((390, 844), "light", "#/challenge/16", "challenge-16"),
             ((1280, 800), "dark", "#/challenge/14", "desktop-challenge-14-dark"), ((390, 844), "light", "#/build", "build"), ((390, 844), "light", "#/cards", "cards"), ((1280, 800), "dark", "#/cards", "desktop-cards-dark")]
    for vp, scheme, route, name in shots:
        ctx, page = await new_page(browser, vp, scheme)
        await page.goto(BASE + route); await page.wait_for_timeout(500)
        await page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)
        await ctx.close()
    # interaction states
    ctx, page = await new_page(browser, (360, 740))
    await page.goto(BASE + "#/practice/6/3"); await page.wait_for_timeout(400)
    await page.click('[data-chip="0"]')
    await page.click('#pz-sheet [data-s="2"]')
    await page.click('[data-chip="2"]')
    await page.screenshot(path=str(SHOTS / "practice-armed.png"), full_page=True)
    await page.click('#pz-sheet [data-s="0"]')
    for c, s in [(1, 1), (3, 3), (4, 4), (5, 5), (6, 6)]:
        try:
            await page.click(f'[data-chip="{c}"]'); await page.click(f'#pz-sheet [data-s="{s}"]')
        except Exception: pass
    await page.click('[data-act="check"]')
    await page.screenshot(path=str(SHOTS / "practice-wrong.png"), full_page=True)
    await page.click('[data-act="show"]'); await page.wait_for_timeout(900)
    await page.click("#pz-sheet .part.w >> nth=3")
    await page.wait_for_timeout(200)
    await page.screenshot(path=str(SHOTS / "practice-dialog.png"))
    await ctx.close()

async def logic_suite(browser):
    ctx, page = await new_page(browser, (390, 844))
    await page.goto(BASE); await page.wait_for_timeout(300)
    res = await page.evaluate(LOGIC_JS)
    for e in res["errs"]: fail(f"logic: {e}")
    INFO.append(f"logic: {json.dumps(res['stats'])}")
    widest = sorted(res["widths"].items(), key=lambda kv: -kv[1])[:5]
    INFO.append("widest diagrams (px at 100%): " + ", ".join(f"{k}={v}" for k, v in widest))
    # how the widest diagram fits at 320 px: scale and scrolling
    max_w = max(res["widths"].values())
    avail320 = 320 - 2 * 16 - 2 * 8 - 2
    INFO.append(f"at 320px: available {avail320}px, widest {max_w}px -> scale {max(0.78, min(1, avail320 / max_w)):.2f}"
                f"{' (scrolls)' if max_w * 0.78 > avail320 else ''}")
    for k, w in res["widths"].items():
        if w * 0.78 > avail320: warn(f"diagram {k} needs horizontal scroll at 320px ({w}px)")
    # explainer text for every word
    texts = await page.evaluate("""() => { const B = window.BASELINE, out = [];
       for (const [k, sp] of Object.entries(B.SENT)) for (const n of B.wordsOf(sp)) { const e = B.explainWord(n); out.push([k, n.w, n.role, e.title, e.extra]); } return out; }""")
    for k, w, role, title, extra in texts:
        if role not in ("V", "SU") and not extra: fail(f"explainer: no sentence line for {k}/{w} ({role})")
    INFO.append(f"explainers checked: {len(texts)} words")
    with open(ROOT / "tests" / "explainers.txt", "w") as f:
        for k, w, role, title, extra in texts: f.write(f"{k:10} {w:10} {role:5} {title:28} {extra}\n")
    for e in page.errors: fail(f"logic page: {e}")
    await ctx.close()

CI_JS = """() => { const P = window.BASELINE.state(), c = P.ci;
  return { has: c.has, req: [...c.req.entries()], opt: [...c.opt.entries()], trap: [...c.trap.keys()], s: P.sp.s, semi: P.semi }; }"""

async def put_mark(page, k, mark):
    """Tap a word of the comma step until it holds the mark (',' once, ';' twice)."""
    for _ in range(2 if mark == ";" else 1):
        await page.click(f'[data-cw="{k}"]')

async def functional_suite(browser):
    for vp in [(360, 740), (1280, 800)]:
        tag = f"func {vp[0]}"
        ctx, page = await new_page(browser, vp)
        await page.goto(BASE); await page.wait_for_timeout(400)
        # nav
        for view, h1 in [("practice", "Practice"), ("challenges", "Challenges"), ("build", "Build a diagram"), ("cards", "Flash cards"), ("guide", "Guide"), ("lessons", "Learn to diagram sentences")]:
            await page.click(f'.nav a[data-view="{view}"]'); await page.wait_for_timeout(120)
            got = await page.text_content("h1")
            if got.strip() != h1: fail(f"{tag}: nav {view} shows h1 '{got}'")
            cur = await page.get_attribute(f'.nav a[data-view="{view}"]', "aria-current")
            if cur != "page": fail(f"{tag}: nav {view} not marked current")
        # start button and pager
        await page.click(".hero .btn.primary"); await page.wait_for_timeout(120)
        if (await page.text_content("h1")).strip() != "Subject and verb": fail(f"{tag}: start button")
        await page.click('.pager a:has-text("Next lesson")'); await page.wait_for_timeout(120)
        if (await page.text_content("h1")).strip() != "Adjectives and adverbs": fail(f"{tag}: next lesson")
        await page.click('.pager a:has-text("Previous lesson")'); await page.wait_for_timeout(120)
        if (await page.text_content("h1")).strip() != "Subject and verb": fail(f"{tag}: previous lesson")
        # glossary popup: open, close by button, Escape, backdrop
        term = page.locator(".term").first
        tname = await term.get_attribute("data-term")
        for how in ["button", "escape", "backdrop"]:
            await term.click(); await page.wait_for_timeout(80)
            if not await page.evaluate("document.getElementById('dlg').open"): fail(f"{tag}: term popup did not open"); continue
            title = await page.text_content("#dlg-title")
            exp = await page.evaluate(f"window.BASELINE.TERMS[{json.dumps(tname)}][0]")
            if title != exp: fail(f"{tag}: term popup title '{title}' != '{exp}'")
            if how == "button": await page.click("#dlg-close")
            elif how == "escape": await page.keyboard.press("Escape")
            else: await page.mouse.click(4, 4)
            await page.wait_for_timeout(80)
            if await page.evaluate("document.getElementById('dlg').open"): fail(f"{tag}: popup did not close by {how}")
            focused = await page.evaluate("document.activeElement && document.activeElement.dataset.term")
            if focused != tname: fail(f"{tag}: focus did not return to the term after {how} ({focused})")
        # word and line explainers in a lesson diagram
        Lmia = await page.evaluate("window.BASELINE.LESSONS.findIndex(l => l.body.some(b => b.ex === 'mia')) + 1")
        await goto(page, f"#/lesson/{Lmia}")
        checks = await page.evaluate("""() => { const B = window.BASELINE; const L = B.getLayout('mia', 'natural');
           return L.words.map((w, i) => [i, w.n.w, B.ROLE[w.n.role].name]); }""")
        for i, w, role in checks:
            await page.click(f'.sheet[data-sent="mia"] .part.w[data-i="{i}"]'); await page.wait_for_timeout(60)
            t = await page.text_content("#dlg-title"); wd = await page.text_content("#dlg-word")
            if t != role or wd != w: fail(f"{tag}: explainer for '{w}' shows '{wd}/{t}', expected '{role}'")
            await page.keyboard.press("Escape")
        for div, nm in [("SV", "Subject–verb line"), ("DOL", "Direct object line")]:
            await page.click(f'.sheet[data-sent="mia"] .part.dv[data-div="{div}"]'); await page.wait_for_timeout(60)
            if await page.text_content("#dlg-title") != nm: fail(f"{tag}: line explainer {div}")
            await page.keyboard.press("Escape")
        # explainers for the new jobs: helping verb, adverb on a hook, clause conjunction, branch object
        for key, word, title, extra in [("babysleep", "was", "Helping verb", "“was” helps the main verb “sleeping.”"),
                                        ("verybird", "very", "Adverb", "“very” modifies “small.”"),
                                        ("sunstars", "and", "Conjunction", "joins the clause “The sun set” to the clause “the stars appeared.”"),
                                        ("dishes", "cups", "Direct object", "after “Sam dried.”")]:
            Lk = await page.evaluate(f"window.BASELINE.LESSONS.findIndex(l => l.body.some(b => b.ex === '{key}')) + 1")
            await goto(page, f"#/lesson/{Lk}")
            i = await page.evaluate(f"window.BASELINE.getLayout('{key}', 'natural').words.findIndex(w => w.n.w === '{word}')")
            await page.click(f'.sheet[data-sent="{key}"] .part.w[data-i="{i}"]'); await page.wait_for_timeout(60)
            t = await page.text_content("#dlg-title"); body = await page.text_content("#dlg-text")
            if t != title or extra not in body: fail(f"{tag}: explainer {key}/{word}: '{t}' / '{body}'")
            await page.keyboard.press("Escape")
        await goto(page, f"#/lesson/{Lmia}")
        # keyboard on a diagram word
        await page.focus('.sheet[data-sent="mia"] .part.w[data-i="0"]')
        await page.keyboard.press("Enter"); await page.wait_for_timeout(60)
        if not await page.evaluate("document.getElementById('dlg').open"): fail(f"{tag}: Enter on a diagram word did not open the popup")
        await page.keyboard.press("Escape")
        # practice flows
        await goto(page, "#/practice/2/1")
        await page.click('[data-act="check"]')
        if "empty" not in (await page.text_content("#pz-fb")): fail(f"{tag}: empty check message")
        await page.click('#pz-sheet [data-s="0"]')
        if "first" not in (await page.text_content("#pz-fb")): fail(f"{tag}: slot without selection message")
        # wrong answer: put words in reverse order
        n = await page.evaluate("window.BASELINE.state().slots.length")
        chips = await page.evaluate("window.BASELINE.state().chips.map(c => c.id)")
        for k, c in enumerate(reversed(chips[:n])):
            await page.click(f'[data-chip="{c}"]'); await page.click(f'#pz-sheet [data-s="{k}"]')
        await page.click('[data-act="check"]')
        fb = await page.text_content("#pz-fb")
        red = await page.locator("#pz-sheet .slot.wrong").count()
        m = re.match(r"(\d+) word", fb)
        if not m or int(m.group(1)) != red or "Tip:" not in fb: fail(f"{tag}: wrong-answer feedback '{fb}' with {red} red boxes")
        # pick a word back up from a box
        await page.click('#pz-sheet [data-s="0"]')
        st = await page.evaluate("(() => { const P = window.BASELINE.state(); return [P.place[0], P.sel]; })()")
        if st[0] is not None or st[1] is None: fail(f"{tag}: picking a word from a box failed {st}")
        await page.click('[data-act="clear"]')
        if await page.locator("#pz-bank .chip.used").count(): fail(f"{tag}: clear did not empty the boxes")
        # keyboard placement
        await page.focus('[data-chip="0"]'); await page.keyboard.press("Enter")
        if await page.get_attribute('[data-chip="0"]', "aria-pressed") != "true": fail(f"{tag}: Enter did not select a chip")
        await page.focus('#pz-sheet [data-s="1"]'); await page.keyboard.press("Space")
        if await page.evaluate("window.BASELINE.state().place[1]") != 0: fail(f"{tag}: Space did not place the chip")
        await page.click('[data-act="clear"]')
        # swapped modifiers of one word are accepted ("The small bird": small/The order)
        await goto(page, "#/practice/2/1")  # The old dog slept.
        plan = await page.evaluate("""() => { const P = window.BASELINE.state(); const used = new Set();
           const idx = P.slots.map((s, k) => k); const mods = idx.filter(k => P.slots[k].n.kind === 'mod');
           const target = P.slots.map(s => s.n.w); if (mods.length > 1) { const t = target[mods[0]]; target[mods[0]] = target[mods[1]]; target[mods[1]] = t; }
           return target.map((w, k) => { const c = P.chips.find(c => !used.has(c.id) && c.t === w); used.add(c.id); return [c.id, k]; }); }""")
        for c, k in plan:
            await page.click(f'[data-chip="{c}"]'); await page.click(f'#pz-sheet [data-s="{k}"]')
        await page.click('[data-act="check"]')
        if "Correct" not in (await page.text_content("#pz-fb")): fail(f"{tag}: swapped sibling modifiers were not accepted")
        # every practice sentence can be solved; progress is saved
        counts = await page.evaluate("window.BASELINE.LESSONS.map(l => l.practice.length)")
        n_comma = 0
        for L, n_i in enumerate(counts, 1):
            for i in range(1, n_i + 1):
                await goto(page, f"#/practice/{L}/{i}")
                ci = await page.evaluate(CI_JS)
                if ci["has"] and "," in (await page.text_content("#pz-sent")): fail(f"{tag}: {L}.{i} shows commas before the comma step")
                await solve(page)
                fb = await page.text_content("#pz-fb")
                if not fb.startswith("Correct"): fail(f"{tag}: practice {L}.{i} not solved: {fb}")
                if not await page.locator("#pz-next").count(): fail(f"{tag}: no next button after {L}.{i}")
                if not ci["has"]:
                    if await page.locator("#pz-commas:not([hidden])").count(): fail(f"{tag}: {L}.{i} shows a comma step without commas")
                    continue
                n_comma += 1
                # every required comma, plus one trap comma when there is a trap: exactly one change needed
                for k, mk in ci["req"]:
                    await put_mark(page, k, mk)
                for k in ci["trap"][:1]:
                    await page.click(f'[data-cw="{k}"]')
                await page.click('[data-act="ccheck"]')
                cfb = await page.text_content("#cm-fb")
                if ci["trap"]:
                    if not re.match(r"1 (comma|mark) needs a change", cfb) or "Remove the comma" not in cfb: fail(f"{tag}: {L}.{i} trap comma feedback: {cfb}")
                    for _ in range(2 if ci["semi"] else 1):   # remove the mark: "," -> ";" -> none when semicolons are on
                        await page.click(f'[data-cw="{ci["trap"][0]}"]')
                    await page.click('[data-act="ccheck"]')
                    cfb = await page.text_content("#cm-fb")
                if not re.match(r"All (commas|marks) are correct", cfb): fail(f"{tag}: {L}.{i} correct commas not accepted: {cfb}")
                if ci["opt"]:                    # optional commas are accepted too
                    for k, mk in ci["opt"]: await put_mark(page, k, mk)
                    await page.click('[data-act="ccheck"]')
                    if not re.match(r"All (commas|marks) are correct", await page.text_content("#cm-fb")): fail(f"{tag}: {L}.{i} optional commas not accepted")
                if not (await page.text_content("#pz-sent")).strip().endswith(ci["s"]): fail(f"{tag}: {L}.{i} sentence not restored after the comma check")
        # a missing comma is reported with its rule
        await goto(page, "#/practice/9/3")
        await solve(page)
        await page.click('[data-act="ccheck"]')
        cfb = await page.text_content("#cm-fb")
        if "Add a comma after “loud.”" not in cfb or "joins two clauses" not in cfb: fail(f"{tag}: missing-comma feedback: {cfb}")
        INFO.append(f"{tag}: comma steps checked: {n_comma}")
        await page.reload(); await page.wait_for_timeout(300)
        await goto(page, "#/")
        prs = await page.locator(".lessons .pr").all_text_contents()
        if [p.split(" ")[0] for p in prs] != [str(c) for c in counts] or not all(re.match(r"(\d+) of \1", p) for p in prs): fail(f"{tag}: progress after reload {prs}")
        if "Continue" not in (await page.text_content(".hero .btn.primary")): fail(f"{tag}: start button did not change to Continue")
        # show answer path and next link
        nl = len(counts)
        await goto(page, f"#/practice/{nl}/1")
        await page.click('[data-act="show"]')
        if not await page.locator("#pz-sheet .part.w").count(): fail(f"{tag}: show answer did not render the diagram")
        href = await page.get_attribute("#pz-next", "href")
        if href != f"#/practice/{nl}/2": fail(f"{tag}: next link after {nl}.1 is {href}")
        await goto(page, f"#/practice/{nl}/{counts[-1]}"); await page.click('[data-act="show"]')
        if await page.get_attribute("#pz-next", "href") != "#/challenges": fail(f"{tag}: last sentence should link to the challenges")
        await goto(page, f"#/practice/3/{counts[2]}"); await page.click('[data-act="show"]')
        if await page.get_attribute("#pz-next", "href") != "#/lesson/4": fail(f"{tag}: end of lesson 3 should link to lesson 4")
        # lesson select
        await goto(page, "#/practice/1/1")
        await page.select_option("#pz-lesson", "6"); await page.wait_for_timeout(150)
        if not page.url.endswith("#/practice/6/1"): fail(f"{tag}: lesson select went to {page.url}")
        # reset progress (two steps)
        await goto(page, "#/guide")
        await page.click("[data-reset]")
        if await page.text_content("[data-reset]") != "Select again to reset": fail(f"{tag}: reset first step")
        await page.click("[data-reset]")
        if await page.evaluate("localStorage.getItem('baseline-progress-v2')") != "[]": fail(f"{tag}: reset did not clear progress")
        await goto(page, "#/")
        if not all(p.startswith("0 of ") for p in await page.locator(".lessons .pr").all_text_contents()): fail(f"{tag}: progress not reset on home")
        for e in page.errors: fail(f"{tag}: {e}")
        await ctx.close()
    # progress from version 1 (lesson-position keys) moves to version 2 (sentence ids)
    ctx = await browser.new_context(viewport={"width": 390, "height": 844})
    await ctx.add_init_script("""if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
        localStorage.setItem('baseline-progress-v1', JSON.stringify(['1-1', '1-2', '2-3', '6-3', '7-2'])); }""")
    page = await ctx.new_page(); await page.goto(BASE); await page.wait_for_timeout(300)
    v2 = await page.evaluate("JSON.parse(localStorage.getItem('baseline-progress-v2') || 'null')")
    prs = await page.locator(".lessons .pr").all_text_contents()
    # 2-3 (car) and 6-3 (catdog) are no longer practice sentences, so they do not move
    if sorted(v2 or []) != ["dogs", "letter", "maria"]: fail(f"migration: v2 is {v2}")
    if not (prs[0].startswith("2 of ") and prs[1].startswith("0 of ") and prs[7].startswith("1 of ")): fail(f"migration: home shows {prs}")
    await ctx.close()
    # reduced motion: no animation on the solved diagram
    ctx, page = await new_page(browser, (390, 844), motion="reduce")
    await page.goto(BASE + "#/practice/1/1"); await page.wait_for_timeout(300)
    await solve(page)
    an = await page.evaluate("getComputedStyle(document.querySelector('#pz-sheet .ln')).animationName")
    op = await page.evaluate("getComputedStyle(document.querySelector('#pz-sheet .w text')).opacity")
    if an != "none" or op != "1": fail(f"reduced motion: animation {an}, text opacity {op}")
    await ctx.close()
    # storage blocked: app still works
    ctx = await browser.new_context(viewport={"width": 390, "height": 844})
    await ctx.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });")
    page = await ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    await page.goto(BASE + "#/practice/1/1"); await page.wait_for_timeout(300)
    await solve(page)
    if not (await page.text_content("#pz-fb")).startswith("Correct") or errs: fail(f"blocked storage: {errs}")
    await ctx.close()

# ---------------------------------------------------------------- challenges
CH_PLACE_JS = """() => { const P = window.BASELINE.state(); if (P.sel == null) return -1;
  const w = P.chips.find(c => c.id === P.sel).t.toLowerCase();
  return P.slots.findIndex((s, k) => P.place[k] == null && s.n.w.toLowerCase() === w); }"""
CH_WRONG_JS = """() => { const P = window.BASELINE.state(); const w = P.chips.find(c => c.id === P.sel).t.toLowerCase();
  return P.slots.findIndex((s, k) => P.place[k] == null && s.n.w.toLowerCase() !== w); }"""
CH_STATE_JS = """() => { const P = window.BASELINE.state(); return { sel: P.sel, placed: P.place.filter(v => v != null).length, n: P.place.length,
  checks: P.checks, hints: P.hints, status: P.status, hint: P.hint, wrong: [...P.wrong] }; }"""

async def ch_ready(page, n):
    """Wait until challenge n shows its diagram (a long diagram can come a moment after the page)."""
    await page.wait_for_function(f"(() => {{ const P = window.BASELINE.state(); return !!P && P.kind === 'ch' && P.n === {n} && !!document.querySelector('#pz-sheet svg'); }})()")
    await page.wait_for_timeout(60)

async def ch_goto(page, n):
    await page.evaluate(f"location.hash = '#/challenge/{n}'")
    await ch_ready(page, n)

async def ch_fill(page, limit=100000):
    """Place the ready word in a right box, again and again (box taps only)."""
    n = 0
    while n < limit:
        k = await page.evaluate(CH_PLACE_JS)
        if k < 0: break
        await page.click(f'#pz-sheet [data-s="{k}"]'); n += 1
    return n

async def challenge_suite(browser):
    for vp in [(360, 740), (1280, 800)]:
        tag = f"ch {vp[0]}"
        ctx, page = await new_page(browser, vp)
        await page.goto(BASE + "#/challenges"); await page.wait_for_timeout(300)
        n_ch = await page.evaluate("window.BASELINE.CHALLENGES.length")
        if await page.locator(".ladder li").count() != n_ch: fail(f"{tag}: list shows {await page.locator('.ladder li').count()} of {n_ch} challenges")
        if await page.locator(".ladder").count() != 4: fail(f"{tag}: list does not show 4 levels")
        if (await page.text_content(".stars-total")).strip() != f"Your stars: 0 of {3 * n_ch}": fail(f"{tag}: star total at start")
        words = [int(t.split()[0]) for t in await page.locator(".ladder .bl").all_text_contents()]
        if words != sorted(words) or words[0] < 30: fail(f"{tag}: word counts do not rise: {words}")
        # partial check, hint, saved attempt, stars (challenge 2)
        await ch_goto(page, 2)
        st = await page.evaluate(CH_STATE_JS)
        if st["sel"] != 0 or st["placed"] or st["status"] != "open": fail(f"{tag}: challenge start state {st}")
        if (await page.text_content("#pz-nextw mark")).strip() != "There": fail(f"{tag}: the first word is not ready")
        await page.click('[data-act="check"]')
        if "Put some words in boxes first." not in await page.text_content("#pz-fb"): fail(f"{tag}: check with no words")
        if await ch_fill(page, 3) != 3: fail(f"{tag}: could not place 3 words")
        k = await page.evaluate(CH_WRONG_JS)
        await page.click(f'#pz-sheet [data-s="{k}"]')
        await page.click('[data-act="check"]')
        fb = await page.text_content("#pz-fb"); st = await page.evaluate(CH_STATE_JS)
        if "1 word is in the wrong place" not in fb or f"{st['n'] - 4} boxes are empty" not in fb: fail(f"{tag}: partial check feedback: {fb}")
        if await page.locator("#pz-sheet .slot.wrong").count() != 1 or st["checks"] != 1: fail(f"{tag}: partial check marks {st}")
        ready = await page.evaluate("(() => { const P = window.BASELINE.state(); return P.chips.find(c => c.id === P.sel).t; })()")
        await page.click('[data-act="hint"]')
        st = await page.evaluate(CH_STATE_JS)
        hw = await page.evaluate("(() => { const P = window.BASELINE.state(); return P.hint == null ? null : P.slots[P.hint].n.w; })()")
        if await page.locator("#pz-sheet .slot.hint").count() != 1 or (hw or "").lower() != ready.lower() or st["hints"] != 1: fail(f"{tag}: hint {st} {hw} {ready}")
        if f"place for “{ready}.”" not in await page.text_content("#pz-fb"): fail(f"{tag}: hint feedback")
        await page.reload(); await ch_ready(page, 2)
        st2 = await page.evaluate(CH_STATE_JS)
        if (st2["placed"], st2["checks"], st2["hints"]) != (4, 1, 1): fail(f"{tag}: attempt not kept after reload {st2}")
        wrong = await page.evaluate("""(() => { const P = window.BASELINE.state(); return P.place.findIndex((c, k) => c != null && P.chips[c].t.toLowerCase() !== P.slots[k].n.w.toLowerCase()); })()""")
        await page.click(f'#pz-sheet [data-s="{wrong}"]')
        st = await page.evaluate(CH_STATE_JS)
        if st["placed"] != 3: fail(f"{tag}: a filled box did not give its word back {st}")
        await ch_fill(page)
        if "All the words are in boxes" not in await page.text_content("#pz-nextw"): fail(f"{tag}: no message when all words are in boxes")
        await page.click('[data-act="check"]')
        fb = await page.text_content("#pz-fb")
        if not fb.startswith("Correct") or "You get 2 stars." not in fb: fail(f"{tag}: 2 checks and 1 hint: {fb}")
        if await page.evaluate("window.BASELINE.chStore().v02.best") != 2: fail(f"{tag}: best stars not saved")
        # try again, then show the answer: no stars, the best stays
        await page.click('[data-act="retry"]')
        st = await page.evaluate(CH_STATE_JS)
        if (st["placed"], st["checks"], st["hints"], st["status"]) != (0, 0, 0, "open"): fail(f"{tag}: try again state {st}")
        await page.click('[data-act="show"]')
        fb = await page.text_content("#pz-fb")
        if "no stars" not in fb or await page.evaluate("window.BASELINE.chStore().v02.best") != 2: fail(f"{tag}: show answer: {fb}")
        if not await page.locator("#pz-sheet .part.w").count(): fail(f"{tag}: show answer did not draw the diagram")
        # skip, and a box with no word ready
        await ch_goto(page, 3)
        await page.click('[data-act="skip"]')
        if (await page.evaluate(CH_STATE_JS))["sel"] != 1: fail(f"{tag}: skip did not make the second word ready")
        await page.click('#pz-bank [data-chip="1"]')          # deselect
        await page.click('#pz-sheet [data-s="0"]')
        if "Select a word in the word list first." not in await page.text_content("#pz-fb"): fail(f"{tag}: box with no word ready")
        # zoom
        await ch_goto(page, 16)
        w0 = await page.evaluate("document.querySelector('#pz-sheet svg').getBoundingClientRect().width")
        await page.click('[data-zoom="in"]')
        w1 = await page.evaluate("document.querySelector('#pz-sheet svg').getBoundingClientRect().width")
        if not w1 > w0 * 1.2: fail(f"{tag}: zoom in {w0} -> {w1}")
        await page.click('[data-zoom="fit"]')
        fitg = await page.evaluate("""(() => { const sh = document.querySelector('#pz-sheet'), r = sh.querySelector('svg').getBoundingClientRect();
          return [r.width, r.height, sh.clientWidth, sh.clientHeight, sh.scrollWidth, sh.scrollHeight]; })()""")
        if fitg[4] > fitg[2] + 1 or fitg[5] > fitg[3] + 1: fail(f"{tag}: fit leaves the diagram larger than its box {fitg}")
        await page.click('[data-zoom="out"]')
        w3 = await page.evaluate("document.querySelector('#pz-sheet svg').getBoundingClientRect().width")
        if w3 > fitg[0] + 0.5: fail(f"{tag}: zoom out grew the diagram")
        # solve with box taps only and one check: 3 stars; then the marks
        todo = range(1, n_ch + 1) if vp[0] >= 1000 else [1, n_ch]
        for n in todo:
            await ch_goto(page, n)
            if await page.locator('[data-act="retry"]').count(): await page.click('[data-act="retry"]')   # opened as done before
            ci = await page.evaluate(CI_JS)
            sent = await page.text_content("#pz-sent")
            if "," in sent or ";" in sent: fail(f"{tag}: challenge {n} shows marks before the marks step")
            await ch_fill(page)
            await page.click('[data-act="check"]')
            fb = await page.text_content("#pz-fb")
            if not fb.startswith("Correct") or "You get 3 stars." not in fb: fail(f"{tag}: challenge {n} not solved with 3 stars: {fb}")
            for k, mk in ci["req"]: await put_mark(page, k, mk)
            await page.click('[data-act="ccheck"]')
            cfb = await page.text_content("#cm-fb")
            if not cfb.startswith("All marks are correct"): fail(f"{tag}: challenge {n} marks not accepted: {cfb[:200]}")
            if not (await page.text_content("#pz-sent")).strip().endswith(ci["s"]): fail(f"{tag}: challenge {n} sentence not restored")
            href = await page.get_attribute("#pz-next", "href")
            if href != (f"#/challenge/{n + 1}" if n < n_ch else "#/challenges"): fail(f"{tag}: challenge {n} next link {href}")
        # the list shows the stars; a solved challenge opens solved
        await goto(page, "#/challenges")
        best = await page.evaluate("Object.values(window.BASELINE.chStore()).reduce((a, r) => a + (r.best || 0), 0)")
        if (await page.text_content(".stars-total")).strip() != f"Your stars: {best} of {3 * n_ch}": fail(f"{tag}: star total {best}")
        lab = await page.get_attribute(".ladder li >> nth=0 >> .stars", "aria-label")
        if lab != "3 of 3 stars": fail(f"{tag}: first challenge shows {lab}")
        await ch_goto(page, 1)
        if (await page.evaluate(CH_STATE_JS))["status"] != "solved" or "best result" not in await page.text_content("#pz-fb"): fail(f"{tag}: solved challenge does not open solved")
        # reset clears the stars
        await goto(page, "#/guide"); await page.click("[data-reset]"); await page.click("[data-reset]")
        await goto(page, "#/challenges")
        if (await page.text_content(".stars-total")).strip() != f"Your stars: 0 of {3 * n_ch}": fail(f"{tag}: reset did not clear the stars")
        for e in page.errors: fail(f"{tag}: {e}")
        await ctx.close()

# ---------------------------------------------------------------- builder (step 3)
BUILD_RT_JS = r"""() => {
  const B = window.BASELINE, out = { n: 0, fail: [] };
  for (const [k, sp] of Object.entries(B.SENT)) {
    out.n++;
    const r = B.jobsFromSpec(sp);
    if (!r) { out.fail.push(`${k}: no jobs from the spec`); continue; }
    const built = B.specFromJobs(r.toks, r.jobs, r.end);
    const unused = r.toks.map((t, i) => i).filter(i => !built.used.has(i));
    if (!built.spec || B.canonSpec(sp) !== B.canonSpec(built.spec) || built.probs.length || unused.length) { out.fail.push(`${k}: the jobs do not give the same diagram`); continue; }
    const c = B.checkBuild(sp.s, r.jobs);
    if (c.probs.length) out.fail.push(`${k}: check finds ${c.probs.map(p => p.code).join(', ')}`);
    if (!c.grade || !c.grade.ok) out.fail.push(`${k}: the correct marks do not pass`);
    // the rule of each mark is the rule that the lesson gives
    const idx = key => { const m = key.match(/^(.*?)(?:#(\d+))?$/), nth = +(m[2] || 1); let n = 0;
      for (let i = 0; i < r.toks.length; i++) if (r.toks[i].w === m[1] && ++n === nth) return i; return -1; };
    Object.entries(sp.cm || {}).forEach(([w, rule]) => {
      const i = idx(w), item = c.grade && c.grade.items.find(x => x.i === i), want = rule.replace('?', '');
      if (!item || item.rule !== want || (rule.endsWith('?') !== (item.k === 'opt'))) out.fail.push(`${k}: mark after "${w}" has rule ${item ? item.rule + (item.k === 'opt' ? '?' : '') : 'none'}, lesson ${rule}`);
    });
    Object.entries(sp.trap || {}).forEach(([w, rule]) => {
      const i = idx(w), item = c.grade && c.grade.items.find(x => x.i === i);
      if (!item || item.k !== 'no' || item.rule !== rule) out.fail.push(`${k}: no-comma place after "${w}" has ${item ? item.k + ' ' + item.rule : 'none'}, lesson ${rule}`);
    });
  }
  return out;
}"""
BUILD_MUT_JS = r"""() => {
  const B = window.BASELINE, bad = [], n = { missing: 0, extra: 0, splice: 0, noJob: 0, link: 0, pron: 0, restr: 0 };
  const OBJ = { I: 'me', he: 'him', she: 'her', we: 'us', they: 'them', He: 'Him', She: 'Her', We: 'Us', They: 'Them' };
  for (const [k, sp] of Object.entries(B.SENT)) {
    const r = B.jobsFromSpec(sp); if (!r) continue;
    const rules = B.commaRules(r.toks, r.jobs, r.end);
    const text = toks => toks.map(t => t.w + t.mark).join(' ') + r.end;
    const withMark = (g, m) => text(r.toks.map((t, i) => (i === g ? Object.assign({}, t, { mark: m }) : t)));
    const req = [...rules.gaps.entries()].find(([g, x]) => !x.opt && r.toks[g].mark);
    if (req) { const c = B.checkBuild(withMark(req[0], ''), r.jobs);
      if (c.grade && c.grade.bad.some(x => x.k === 'missing' && x.i === req[0])) n.missing++; else bad.push(`${k}: a missing mark after "${r.toks[req[0]].w}" is not found`); }
    const tr = [...rules.traps.keys()].find(g => !rules.gaps.has(g));
    if (tr != null) { const c = B.checkBuild(withMark(tr, ','), r.jobs);
      if (c.grade && c.grade.bad.some(x => x.k === 'extra' && x.i === tr)) n.extra++; else bad.push(`${k}: an extra comma after "${r.toks[tr].w}" is not found`); }
    const semi = [...rules.gaps.entries()].find(([g, x]) => x.need === ';' && !x.alt.includes(',') && r.toks[g].mark === ';');
    if (semi) { const c = B.checkBuild(withMark(semi[0], ','), r.jobs);
      if (c.grade && c.grade.bad.some(x => x.k === 'wrong' && x.i === semi[0])) n.splice++; else bad.push(`${k}: a comma splice after "${r.toks[semi[0]].w}" is not found`); }
    const c1 = B.checkBuild(sp.s, r.jobs.map((J, i) => (i === 0 ? null : J)));
    if (c1.probs.some(p => p.code === 'noJob' && p.i === 0)) n.noJob++; else bad.push(`${k}: a word with no job is not found`);
    const ai = r.jobs.findIndex(J => J.j === 'ADJ'), vi = r.jobs.findIndex(J => J.j === 'V');
    if (ai >= 0 && vi >= 0) { const c = B.checkBuild(sp.s, r.jobs.map((J, i) => (i === ai ? Object.assign({}, J, { to: vi }) : J)));
      if (c.probs.some(p => p.code === 'linkBad' && p.i === ai)) n.link++; else bad.push(`${k}: an adjective on a verb is not found`); }
    const si = r.jobs.findIndex((J, i) => J.j === 'S' && OBJ[r.toks[i].w]);
    if (si >= 0) { const c = B.checkBuild(text(r.toks.map((t, i) => (i === si ? Object.assign({}, t, { w: OBJ[t.w] }) : t))), r.jobs);
      if (c.probs.some(p => p.code === 'caseS' && p.i === si)) n.pron++; else bad.push(`${k}: an object pronoun as subject is not found`); }
    const ei = r.jobs.findIndex(J => (J.j === 'AP' || (J.j === 'V' && J.cl === 'adj')) && J.extra);
    if (ei >= 0) { const c = B.checkBuild(sp.s, r.jobs.map((J, i) => (i === ei ? Object.assign({}, J, { extra: false }) : J)));
      if (c.grade && c.grade.bad.some(x => x.k === 'extra')) n.restr++; else bad.push(`${k}: commas around a "which one" part are not found`); }
  }
  return { bad, n };
}"""

async def builder_suite(browser):
    ctx, page = await new_page(browser, (390, 844))
    await page.goto(BASE); await page.wait_for_timeout(300)
    rt = await page.evaluate(BUILD_RT_JS)
    for f in rt["fail"]: fail(f"builder: {f}")
    INFO.append(f"builder round trip: {rt['n']} sentences")
    mut = await page.evaluate(BUILD_MUT_JS)
    for f in mut["bad"]: fail(f"builder mistake test: {f}")
    INFO.append(f"builder mistakes found: {json.dumps(mut['n'])}")
    for e in page.errors: fail(f"builder page: {e}")
    await ctx.close()
    sent = "The old dog slept on the porch, and the cat watched the birds."
    plan = [(2, 'S', None), (3, 'V', None), (0, 'ADJ', None), (1, 'ADJ', 2), (4, 'PREP', 3), (6, 'OP', None), (5, 'ADJ', None),
            (7, 'CONJ', None), (9, 'S', None), (10, 'V', None), (8, 'ADJ', None), (12, 'DO', None), (11, 'ADJ', None)]
    for vp in [(360, 740), (1280, 800)]:
        tag = f"build {vp[0]}"
        ctx, page = await new_page(browser, vp)
        await page.goto(BASE + "#/build"); await page.wait_for_timeout(300)
        await page.click('[data-bact="start"]')
        if "Type a sentence." not in await page.text_content("#b-fb"): fail(f"{tag}: empty sentence not refused")
        await page.fill("#b-text", "We don't know."); await page.click('[data-bact="start"]')
        if "two words" not in await page.text_content("#b-fb"): fail(f"{tag}: contraction not refused")
        await page.fill("#b-text", sent); await page.click('[data-bact="start"]'); await page.wait_for_timeout(100)
        if await page.locator("#b-words .bw").count() != 13: fail(f"{tag}: word buttons")
        if "has the job" not in await page.text_content("#pz-sheet"): fail(f"{tag}: no note before the first verb")
        for i, job, link in plan:
            await page.click(f'#b-words [data-bw="{i}"]')
            await page.click(f'#bd-in [data-bj="{job}"]')
            if link is not None: await page.click(f'#bd-in [data-bl="{link}"]')
            await page.click('#bd-in [data-bd="done"]')
        if await page.evaluate("document.getElementById('bdlg').open"): fail(f"{tag}: dialog still open")
        await page.wait_for_timeout(100)
        if await page.locator("#pz-sheet .part.w").count() != 13: fail(f"{tag}: diagram does not show all words")
        await page.click('[data-bact="check"]'); await page.wait_for_timeout(100)
        fb = await page.text_content("#b-fb")
        if "No problems found" not in fb: fail(f"{tag}: correct jobs not accepted: {fb[:200]}")
        # a mark error after a change of the sentence keeps the jobs
        await page.click('[data-bact="edit"]')
        await page.fill("#b-text", sent.replace("porch,", "porch")); await page.click('[data-bact="start"]')
        if await page.locator("#b-words .bw.set").count() != 13: fail(f"{tag}: a change of a mark did not keep the jobs")
        await page.click('[data-bact="check"]')
        fb = await page.text_content("#b-fb")
        if "Add a comma after “porch.”" not in fb or "joins two clauses" not in fb: fail(f"{tag}: missing comma not reported: {fb[:200]}")
        # a word in the diagram opens its job; a wrong link is reported
        await page.click('#pz-sheet .part.w >> nth=0')
        if not await page.evaluate("document.getElementById('bdlg').open"): fail(f"{tag}: diagram word did not open its job")
        await page.keyboard.press("Escape")
        await page.click('#b-words [data-bw="0"]'); await page.click('#bd-in [data-bd="change"]'); await page.click('#bd-in [data-bj="ADJ"]')
        await page.click('#bd-in [data-bl="3"]'); await page.click('#bd-in [data-bd="done"]')
        await page.click('[data-bact="check"]')
        fb = await page.text_content("#b-fb")
        if "“The” cannot go with “slept.”" not in fb: fail(f"{tag}: wrong link not reported: {fb[:200]}")
        # the sentence and its jobs stay after a reload
        await page.reload(); await page.wait_for_timeout(300)
        if await page.locator("#b-words .bw.set").count() != 13: fail(f"{tag}: jobs not kept after reload")
        # a lesson sentence and its answer
        await page.click('[data-bact="edit"]'); await page.click('[data-bact="example"]'); await page.wait_for_timeout(100)
        await page.click('[data-bact="answer"]'); await page.wait_for_timeout(200)
        fb = await page.text_content("#b-fb")
        if "No problems found" not in fb: fail(f"{tag}: lesson answer not accepted: {fb[:200]}")
        # a new sentence starts with no jobs; reset clears the builder
        await page.click('[data-bact="edit"]'); await page.fill("#b-text", "Birds sing."); await page.click('[data-bact="start"]')
        if await page.locator("#b-words .bw.set").count(): fail(f"{tag}: new words kept old jobs")
        await goto(page, "#/guide"); await page.click("[data-reset]"); await page.click("[data-reset]")
        await goto(page, "#/build")
        if await page.locator("#b-text").count() != 1 or await page.input_value("#b-text") != "": fail(f"{tag}: reset did not clear the builder")
        for e in page.errors: fail(f"{tag}: {e}")
        await ctx.close()

# ---------------------------------------------------------------- flash cards
async def cards_suite(browser):
    for vp in [(360, 740), (1280, 800)]:
        tag = f"cards {vp[0]}"
        ctx, page = await new_page(browser, vp)
        await page.goto(BASE + "#/cards"); await page.wait_for_timeout(300)
        counts = await page.evaluate("(() => { const by = {}; window.BASELINE.allCards().forEach(c => { by[c.deck] = (by[c.deck] || 0) + 1; }); return by; })()")
        total = sum(counts.values())
        terms = await page.evaluate("Object.keys(window.BASELINE.TERMS).length")
        if counts.get("terms") != terms or counts.get("lines") != 11 or counts.get("commas", 0) < 30: fail(f"{tag}: decks {counts}")
        noex = await page.evaluate("window.BASELINE.allCards().filter(c => c.deck === 'commas' && !c.ex).map(c => c.id)")
        if noex: fail(f"{tag}: comma cards without an example: {noex}")
        cnt = lambda: page.text_content(".fc-count")
        if f"You know 0 of {terms}." not in await cnt(): fail(f"{tag}: start count {await cnt()}")
        first = (await page.text_content("#fc-card .fc-front")).strip()
        await page.click("#fc-card"); await page.wait_for_timeout(500)
        if not await page.evaluate("document.getElementById('fc-card').classList.contains('flipped')"): fail(f"{tag}: card did not turn over")
        vis = await page.evaluate("[getComputedStyle(document.querySelector('.fc-front')).visibility, getComputedStyle(document.querySelector('.fc-back')).visibility]")
        if vis != ["hidden", "visible"]: fail(f"{tag}: faces after turn {vis}")
        await page.click('[data-fc="knew"]')
        if f"Card 1 of {terms - 1} to study. You know 1 of {terms}." not in await cnt(): fail(f"{tag}: count after knew {await cnt()}")
        second = (await page.text_content("#fc-card .fc-front")).strip()
        if second == first: fail(f"{tag}: the known card came back")
        await page.click('[data-fc="flip"]'); await page.click('[data-fc="again"]')
        if (await page.text_content("#fc-card .fc-front")).strip() == second: fail(f"{tag}: study again did not move the card to the end")
        for deck, n in [("lines", 11), ("commas", counts["commas"]), ("all", total)]:
            await page.click(f'[data-fcdeck="{deck}"]')
            if f"of {n}." not in await cnt(): fail(f"{tag}: deck {deck} count {await cnt()}")
        await page.click('[data-fcdeck="commas"]'); await page.click("#fc-card"); await page.wait_for_timeout(100)
        if not await page.locator("#fc-card .fc-back .fc-ex").count(): fail(f"{tag}: comma card has no example")
        await page.click('[data-fcdeck="terms"]')
        await page.select_option("#fc-upto", "1"); await page.wait_for_timeout(100)
        n1 = await page.evaluate("Object.keys(window.BASELINE.TERMS).length && window.BASELINE.allCards().filter(c => c.deck === 'terms' && c.lesson <= 1).length")
        if f"of {n1}." not in await cnt(): fail(f"{tag}: lesson filter count {await cnt()}")
        await page.click('[data-fcfirst="def"]')
        front = (await page.text_content("#fc-card .fc-front")).strip()
        defs = await page.evaluate("Object.values(window.BASELINE.TERMS).map(t => t[1])")
        if front not in defs: fail(f"{tag}: definition first shows {front[:60]}")
        await page.click('[data-fcfirst="term"]')
        for _ in range(n1):
            if not await page.locator("#fc-card").count(): break
            await page.click("#fc-card"); await page.click('[data-fc="knew"]')
        if "You know all" not in await page.text_content("#fc-main"): fail(f"{tag}: no message when all cards are known")
        await page.reload(); await page.wait_for_timeout(300)
        if "You know all" not in await page.text_content("#fc-main"): fail(f"{tag}: known cards not kept after reload")
        await page.click('[data-fc="restart"]')
        if f"You know 0 of {n1}." not in await cnt(): fail(f"{tag}: restart count {await cnt()}")
        await page.click(".fc-all summary")
        if await page.locator("#fc-list .fc-item").count() != n1: fail(f"{tag}: card list")
        await page.select_option("#fc-upto", "0"); await page.click("#fc-card"); await page.click('[data-fc="knew"]')
        await goto(page, "#/guide"); await page.click("[data-reset]"); await page.click("[data-reset]")
        if await page.evaluate("window.BASELINE.cardStore().known.length"): fail(f"{tag}: reset did not clear the cards")
        for e in page.errors: fail(f"{tag}: {e}")
        await ctx.close()

async def contrast_suite(browser):
    for scheme in ["light", "dark"]:
        ctx, page = await new_page(browser, (390, 844), scheme)
        await page.goto(BASE); await page.wait_for_timeout(200)
        for r in await page.evaluate(CONTRAST_JS):
            line = f"contrast {scheme}: {r['n']} = {r['ratio']} (min {r['min']})"
            (fail if r["ratio"] < r["min"] else INFO.append)(line)
        await ctx.close()

async def ste_suite(browser):
    ctx, page = await new_page(browser, (390, 844))
    await page.goto(BASE); await page.wait_for_timeout(200)
    items = await page.evaluate("window.BASELINE.steTexts()")
    issues = ste_lint(items)
    for i in issues: fail(f"STE: {i}")
    INFO.append(f"STE lint: {len(items)} text items checked")
    await ctx.close()

async def main():
    httpd = serve()
    only = set(sys.argv[1:])
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        suites = [("logic", logic_suite), ("ste", ste_suite), ("contrast", contrast_suite),
                  ("functional", functional_suite), ("challenges", challenge_suite), ("builder", builder_suite), ("cards", cards_suite), ("layout", layout_suite), ("shots", screenshots)]
        for name, fn in suites:
            if only and name not in only: continue
            n0 = len(FAILS)
            await fn(browser)
            print(f"[{name}] {'ok' if len(FAILS) == n0 else str(len(FAILS) - n0) + ' failures'}")
        await browser.close()
    httpd.shutdown()
    print("\nINFO:"); [print("  " + m) for m in INFO[:60]]
    if len(INFO) > 60: print(f"  ... {len(INFO) - 60} more")
    print(f"\nWARNINGS ({len(WARNS)}):"); [print("  " + m) for m in WARNS[:80]]
    print(f"\nFAILURES ({len(FAILS)}):"); [print("  " + m) for m in FAILS[:150]]
    if len(FAILS) > 150: print(f"  ... {len(FAILS) - 150} more")
    sys.exit(1 if FAILS else 0)

if __name__ == "__main__":
    asyncio.run(main())

