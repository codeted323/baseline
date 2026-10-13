'use strict';
/* ===============================================================
   Reed–Kellogg layout engine
   Coordinates: SVG units, y grows down. Each line has its words
   above it. Slanted lines go down and to the right at ANG.
   Conventions follow Reed & Kellogg, Higher Lessons in English (1877),
   with the modern variants noted where they differ.
   =============================================================== */
const G = {
  FS: 18,                 // diagram font size (px)
  ANG: Math.PI / 3,       // slant angle (60 degrees below horizontal)
  TXT_Y: -7,              // text baseline, relative to its line
  BOX_T: -26, BOX_B: -3,  // slot box, relative to its line
  HIT_T: -31, HIT_B: 3,   // tap area, relative to its line
  HITPAD: 2,              // tap area extends past the box on each end
  BOXPAD: 7,              // space between text and box ends
  MINBOX: 32,             // minimum box width
  SPAD0: 26,              // slant length before the box
  SPAD1: 6,               // slant length after the box
  DMIN: 42,               // spacing of parallel slants (36 px apart)
  START: 14,              // first slant from the start of its line
  END: 14,                // space after the last child
  CGAP: 10,               // gap after a phrase with a horizontal line
  WPAD: 18,               // space from a word box to the line ends
  OBJ_OFF: 31,            // object box start, after a preposition slant
  IO_LEN: 40, IO_OFF: 14, // empty slant of an indirect object
  DIV_UP: 28, DIV_DN: 18, // divider lengths above / below the baseline
  LEAN: 14,               // top offset of the complement line
  DIV_HIT: 12,            // half width of a divider tap area
  STEM: 16, DJMIN: 28,    // compound fork: stem, min diagonal width
  CZPAD: 10,              // space around the conjunction box
  FORK_MIN: 56,           // min distance between parallel lines
  HOOK: 18,               // hook: short line for a modifier of a modifier
  MARKW: 32,              // box of an x (understood conjunction)
  VPAD: 3,                // text padding in the boxes of a verb phrase
  AUXGAP: 5,              // space between the boxes of a verb phrase
  CONN_X: 8, CONN_LANE: 20,   // clause line (compound sentence) on a verb line: x in its lane, lane width
  ARR_X: 24, ARR_LANE: 30,    // where a dotted line from a main clause meets an adverb clause verb line
  LANE0: 6,               // anchor of a dotted line in its lane
  LANE_SC: 50,            // lane for an adverb clause line (holds the conjunction)
  LANE_AC: 14,            // lane for an adjective clause line
  STEP_MIN: 64,           // min length of the step that holds a clause conjunction
  STEP_DN: 36,            // step distance below the lowest part of the clause above
  CL_GAP: 10,             // gap between a step and the next clause
  PED_H: 16, PED_W: 24, PED_GAP: 10,  // pedestal: stem foot height, foot width, gap below the raised block
  STEP_W: 14, STEP_H: 12, // gerund step
  PART_L: 48, BEND_R: 10, // participle: slant length, bend radius
  PAREN_W: 10, PAREN_PAD: 24, // appositive parentheses
  IND_GAP: 18, IND_SEP: 30,   // independent elements above the diagram
  MARGIN: 14,
  MIN_SCALE: 0.78,        // 18 px * 0.78 = 14 px minimum text size
  MAX_SCALE: 1.2,         // larger diagrams when there is room
};
const COS = Math.cos(G.ANG), SIN = Math.sin(G.ANG);
const FONT = '"AHN", "Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, sans-serif';
const ARTICLES = new Set(['a', 'an', 'the']);
const POSSESSIVES = new Set(['my', 'your', 'his', 'her', 'its', 'our', 'their']);

/* ---------- text measure ---------- */
const _ctx = document.createElement('canvas').getContext('2d');
const _wc = new Map();
function textW(s, size = G.FS) {
  const k = size + '|' + s;
  if (!_wc.has(k)) { _ctx.font = `500 ${size}px ${FONT}`; _wc.set(k, _ctx.measureText(s).width); }
  return _wc.get(k);
}

/* ---------- annotate: give each word its job (role) ---------- */
const compOf = o => o.DO ? 'DO' : o.PN ? 'PN' : o.PA ? 'PA' : null;
const isLink = comp => comp === 'PN' || comp === 'PA';
const VERBAL_ROLE = { part: 'PART', ger: 'GER', inf: 'INF' };
const ADV_PARENTS = new Set(['V', 'LV', 'PA', 'PART', 'GER', 'INF']);

/* Conjunctions between the clauses of a compound sentence; 'x' = none (a semicolon in the sentence). */
const joinsOf = sp => Array.isArray(sp.conj) ? sp.conj : Array.from({ length: sp.clauses.length - 1 }, () => sp.conj);

function annotate(sp) {
  if (sp._ann) return sp;
  if (sp.clauses) {
    sp.clauses.forEach(c => annotateClause(c, sp));
    sp.joinNodes = joinsOf(sp).map((j, i) => j === 'x' ? null
      : { w: j, tok: (sp.joinToks || [])[i], role: 'CCONJ', cat: 'C', kind: 'cconj', sentence: sp, clause: null, at: i, mods: [], aux: [] });
  } else annotateClause(sp, null);
  const ind = { kind: 'indclause', sentence: sp };   // independent words have no clause
  sp.indNodes = (sp.ind || []).map(e => { A_head(e.n, e.ind, null, null, ind); return e; });
  sp._ann = true;
  return sp;
}

function annotateClause(cl, outer) {
  cl.outer = outer; cl.comp = compOf(cl);
  A_head(cl.S, 'S', null, null, cl);
  A_head(cl.V, isLink(cl.comp) ? 'LV' : 'V', null, null, cl);
  if (cl.comp) A_head(cl[cl.comp], cl.comp, null, null, cl);
  if (cl.OC) A_head(cl.OC, 'OC', null, null, cl);
}

function A_head(n, role, parent, br, cl) {
  if (n.items) {
    n.kind = 'comp'; n.role = role; n.clause = cl; n.branch = br;
    n.conjNode = { w: n.conj, tok: n.conjTok, role: 'CONJ', clause: cl, comp: n, cat: 'C', kind: 'conj', mods: [], aux: [] };
    n.items.forEach(it => { it.compound = n; if (it.V) A_branch(it, n, cl); else A_head(it, role, parent, br, cl); });
    return n;
  }
  if (n.verbal) return A_verbal(n, role, parent, br, cl);
  if (n.nc) {                                // noun clause in a noun slot
    n.kind = 'nc'; n.role = role; n.parent = parent; n.clause = cl; n.branch = br;
    annotateClause(n.nc, n);
    if (n.intro) n.introNode = { w: n.intro, tok: n.introTok, role: 'NCI', kind: 'nci', cat: 'H', clause: n.nc, phrase: n, mods: [], aux: [] };
    return n;
  }
  n.kind = 'word'; n.role = n.understood ? 'SU' : role; n.clause = cl; n.parent = parent; n.branch = br; n.cat = 'H';
  n.aux = (n.aux || []).map((a, k) => typeof a === 'string'
    ? { w: a, tok: (n.auxTok || [])[k], role: 'AUX', kind: 'aux', cat: 'A', clause: cl, branch: br, main: n, parent: n, mods: [], aux: [] } : a);
  n.mods = (n.mods || []).map(m => A_mod(m, n, br, cl));
  return n;
}

function A_verbal(vp, role, parent, br, cl) {  // participle, gerund or infinitive phrase
  vp.kind = 'verbal'; vp.role = role; vp.parent = parent; vp.clause = cl; vp.branch = br; vp.comp = compOf(vp);
  A_head(vp.V, VERBAL_ROLE[vp.verbal], parent, vp, cl);
  vp.V.phrase = vp;
  if (vp.verbal === 'inf') vp.toNode = { w: vp.to || 'to', tok: vp.toTok, role: 'INFTO', kind: 'infto', cat: 'S', clause: cl, phrase: vp, parent: vp.V, mods: [], aux: [] };
  if (vp.comp) A_head(vp[vp.comp], vp.comp, null, vp, cl);
  return vp;
}

function A_branch(b, n, cl) {                // one line of a compound predicate: verb [+ complement]
  b.kind = 'branch'; b.comp = compOf(b);
  A_head(b.V, isLink(b.comp) ? 'LV' : 'V', null, b, cl);
  b.V.compound = n;
  if (b.comp) A_head(b[b.comp], b.comp, null, b, cl);
}

function A_mod(m, h, br, cl) {
  if (typeof m === 'string') m = { w: m };
  if (m.prep) {
    const pw = { w: m.prep, tok: m.prepTok, role: 'PREP', clause: cl, branch: br, parent: h, cat: 'S', kind: 'prepword', mods: [], aux: [] };
    const node = { kind: 'prep', prepNode: pw, obj: m.obj, parent: h };
    pw.phrase = node;
    A_head(m.obj, 'OP', pw, br, cl);
    return node;
  }
  if (m.io) { const node = { kind: 'io', obj: m.io, parent: h }; A_head(m.io, 'IO', h, br, cl); return node; }
  if (m.app) { const node = { kind: 'app', obj: m.app, parent: h }; A_head(m.app, 'AP', h, br, cl); return node; }
  if (m.verbal) { A_verbal(m, 'MOD', h, br, cl); return m; }
  if (m.ac) {                                // adjective clause: the relative pronoun links it to h
    m.kind = 'ac'; m.parent = h; m.clause = cl;
    annotateClause(m.ac, m);
    m.relNode = wordsOfClause(m.ac).find(w => w.rel) || null;
    if (m.relNode) m.relNode.antecedent = h;
    return m;
  }
  if (m.sc) {                                // adverb clause: the conjunction links it to h
    m.kind = 'sc'; m.parent = h; m.clause = cl;
    annotateClause(m.cl, m);
    m.subNode = { w: m.sc, tok: m.subTok, role: 'SUB', kind: 'sub', cat: 'S', clause: cl, parent: h, phrase: m, mods: [], aux: [] };
    return m;
  }
  const lw = m.w.toLowerCase();
  const adv = ADV_PARENTS.has(h.role) || h.kind === 'mod';   // a modifier of a verb or of a modifier is an adverb
  Object.assign(m, {
    kind: 'mod', parent: h, clause: cl, branch: br, cat: 'S',
    role: m.role || (ARTICLES.has(lw) ? 'ART' : POSSESSIVES.has(lw) ? 'POS' : adv ? 'ADV' : 'ADJ'),
  });
  m.aux = m.aux || [];
  m.mods = (m.mods || []).map(x => A_mod(x, m, br, cl));
  return m;
}

/* All word nodes, in reading order of the diagram. */
function collect(out) {
  const head = n => {
    if (n.items) { n.items.forEach(it => it.V ? branch(it) : head(it)); out.push(n.conjNode); return; }
    if (n.kind === 'verbal') { verbal(n); return; }
    if (n.kind === 'nc') { if (n.introNode) out.push(n.introNode); clause(n.nc); return; }
    out.push(...n.aux, n);
    n.mods.forEach(modOut);
  };
  const verbal = v => { if (v.toNode) out.push(v.toNode); head(v.V); if (v.comp) head(v[v.comp]); };
  const modOut = m => {
    if (m.kind === 'mod') { out.push(m); m.mods.forEach(modOut); }
    else if (m.kind === 'prep') { out.push(m.prepNode); head(m.obj); }
    else if (m.kind === 'io' || m.kind === 'app') head(m.obj);
    else if (m.kind === 'verbal') verbal(m);
    else if (m.kind === 'ac') clause(m.ac);
    else if (m.kind === 'sc') { out.push(m.subNode); clause(m.cl); }
  };
  const branch = b => { head(b.V); if (b.comp) head(b[b.comp]); };
  const clause = c => { head(c.S); head(c.V); if (c.comp) head(c[c.comp]); if (c.OC) head(c.OC); };
  return { head, clause };
}
function wordsOfClause(c) { const out = []; collect(out).clause(c); return out; }
function wordsOf(sp) {
  annotate(sp);
  const out = [], w = collect(out);
  sp.indNodes.forEach(e => w.head(e.n));
  if (sp.clauses) sp.clauses.forEach((c, i) => { if (i && sp.joinNodes[i - 1]) out.push(sp.joinNodes[i - 1]); w.clause(c); });
  else w.clause(sp);
  return out;
}

/* Sentence words without punctuation. */
function tokens(s) {
  return s.split(/\s+/).map(t => t.replace(/^[^A-Za-z0-9(]+|[^A-Za-z0-9)]+$/g, '')).filter(Boolean);
}

/* Commas and semicolons of a sentence. cm: { word: rule } for each mark ("rule?" = optional),
   trap: { word: rule } for a place where a comma is a common mistake. "word#2" = second "word". */
function commaInfo(sp) {
  if (sp._ci) return sp._ci;
  const raw = sp.s.split(/\s+/).filter(Boolean);
  const toks = raw.map(r => {
    const m = r.match(/[,;]$/);
    return { w: r.replace(/^[^A-Za-z0-9(]+|[^A-Za-z0-9)]+$/g, ''), mark: m ? m[0] : '' };
  });
  const end = (raw[raw.length - 1].match(/[.?!]+$/) || [''])[0];
  const idx = key => {
    const m = key.match(/^(.*?)(?:#(\d+))?$/), nth = +(m[2] || 1);
    let c = 0;
    for (let i = 0; i < toks.length; i++) if (toks[i].w === m[1] && ++c === nth) return i;
    return -1;
  };
  const req = new Map(), opt = new Map(), rule = new Map(), trap = new Map(), bad = [];
  Object.entries(sp.cm || {}).forEach(([k, r]) => {
    const i = idx(k), o = r.endsWith('?'), id = o ? r.slice(0, -1) : r;
    if (i < 0) { bad.push(`comma key "${k}" is not a word of the sentence`); return; }
    if (!o && !toks[i].mark) bad.push(`required mark after "${k}" is missing in the sentence`);
    rule.set(i, id); (o ? opt : req).set(i, toks[i].mark || ',');
  });
  Object.entries(sp.trap || {}).forEach(([k, r]) => {
    const i = idx(k);
    if (i < 0) bad.push(`trap key "${k}" is not a word of the sentence`);
    else if (toks[i].mark) bad.push(`trap after "${k}" has a mark in the sentence`);
    else trap.set(i, r);
  });
  toks.forEach((t, i) => { if (t.mark && !rule.has(i)) bad.push(`mark after "${t.w}" has no rule`); });
  const semi = toks.some(t => t.mark === ';');
  sp._ci = { toks, end, req, opt, rule, trap, bad, semi, has: req.size + opt.size + trap.size > 0,
    plain: raw.map(r => r.replace(/[,;]$/, '')).join(' ') };
  return sp._ci;
}

/* Check that a spec is a valid diagram of its sentence. */
function validate(sp) {
  const errs = [];
  annotate(sp);
  const dw = wordsOf(sp).filter(n => !n.understood).map(n => n.w).sort();
  const tw = tokens(sp.s).sort();
  if (dw.join(' ') !== tw.join(' ')) errs.push(`word mismatch: diagram [${dw}] vs sentence [${tw}]`);
  if (sp.clauses && (sp.clauses.length < 2 || joinsOf(sp).length !== sp.clauses.length - 1)) errs.push('a compound sentence needs two or more clauses and a join between each pair');
  commaInfo(sp).bad.forEach(e => errs.push(e));
  const clauses = [];
  const plain = n => (n.mods || []).forEach(m => {   // a slanted word can only have adverbs below it
    if (m.kind !== 'mod') errs.push(`only an adverb can modify the slanted word "${n.w}"`); else plain(m); });
  const isWord = n => n && n.kind === 'word';
  const visit = (c, inRaised) => {           // walk every clause; r = inside a raised phrase or noun clause
    clauses.push(c);
    const walkHead = (n, r) => {
      if (!n) return;
      if (n.items) { n.items.forEach(it => it.V ? (walkHead(it.V, r), walkHead(it[it.comp], r)) : walkHead(it, r)); return; }
      if (n.kind === 'verbal') {
        if (!isWord(n.V)) errs.push('the verb of a participle, gerund or infinitive must be one word with its helping verbs');
        if (n.verbal === 'part' && n.role !== 'MOD') errs.push(`a participle cannot be ${n.role}`);
        if (n.verbal === 'ger' && n.role === 'MOD') errs.push('a gerund cannot be a modifier');
        walkHead(n.V, r || n.role !== 'MOD'); if (n.comp) walkHead(n[n.comp], r || n.role !== 'MOD'); return;
      }
      if (n.kind === 'nc') { visit(n.nc, true); return; }
      (n.mods || []).forEach(m => {
        if (m.kind === 'mod') { plain(m); return; }
        if ((m.kind === 'io' || m.kind === 'app') && !isWord(m.obj)) errs.push(`${m.kind === 'io' ? 'an indirect object' : 'an appositive'} must be a word`);
        if (m.kind === 'prep' && !(isWord(m.obj) || (m.obj.kind === 'verbal' && m.obj.verbal === 'ger') || m.obj.kind === 'nc'
          || (m.obj.items && m.obj.items.every(isWord)))) errs.push(`the object of "${m.prepNode.w}" has a form that is not supported`);
        if (m.kind === 'prep' || m.kind === 'io' || m.kind === 'app') walkHead(m.obj, r);
        else if (m.kind === 'verbal') walkHead(m, r);
        else if (m.kind === 'ac' || m.kind === 'sc') {
          if (r) errs.push('a dependent clause inside a raised phrase or noun clause is not supported');
          visit(m.kind === 'ac' ? m.ac : m.cl, false);
          if (m.kind === 'ac') {
            const rels = wordsOfClause(m.ac).filter(w => w.rel);
            if (rels.length !== 1) errs.push('an adjective clause needs exactly one relative pronoun');
            else if (!['S', 'DO', 'OP', 'PN'].includes(rels[0].role)) errs.push(`relative pronoun as ${rels[0].role} is not supported`);
          }
        }
      });
    };
    ['S', 'V', 'DO', 'PN', 'PA', 'OC'].forEach(k => walkHead(c[k], inRaised));
  };
  (sp.clauses || [sp]).forEach(c => visit(c, false));
  clauses.forEach(c => {
    if (c.V.items && c.comp) errs.push('a compound verb with a shared complement is not supported');
    if (c.OC && c.comp !== 'DO') errs.push('an objective complement needs a direct object');
    if (c.OC && !isWord(c.OC)) errs.push('an objective complement must be a word');
    ['S', 'DO', 'PN', 'PA'].forEach(k => { const n = c[k];
      if (n && n.kind === 'verbal' && n.verbal === 'part') errs.push(`a participle cannot be ${k}`); });
  });
  return errs;
}

/* ---------- geometry helpers ---------- */
const line = (x1, y1, x2, y2, k, extra) => Object.assign({ t: 'line', x1, y1, x2, y2, k }, extra || {});
const wordItem = (n, ox, oy, ang, bx, bw) => ({ t: 'word', n, ox, oy, ang, bx, bw });
const maskItem = (x, y, w, h) => ({ t: 'mask', x, y, w, h });
const markItem = (text, ox, oy, bw, mk) => ({ t: 'mark', text, ox, oy, bw, mk: mk || null });
const curveItem = (x1, y1, cx, cy, x2, y2, k) => ({ t: 'curve', x1, y1, cx, cy, x2, y2, k });

function shift(items, dx, dy) {
  return items.map(it => {
    if (it.t === 'line') return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy };
    if (it.t === 'curve') return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, cx: it.cx + dx, cy: it.cy + dy, x2: it.x2 + dx, y2: it.y2 + dy };
    if (it.t === 'word' || it.t === 'mark') return { ...it, ox: it.ox + dx, oy: it.oy + dy };
    if (it.t === 'mask') return { ...it, x: it.x + dx, y: it.y + dy };
    if (it.t === 'hang') return { ...it, ax: it.ax + dx, ay: it.ay + dy, lx0: it.lx0 + dx, lx1: it.lx1 + dx };
    return it;
  });
}
function rectPoly(it, x0, y0, x1, y1) {
  const c = Math.cos(it.ang), s = Math.sin(it.ang);
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [it.ox + x * c - y * s, it.oy + x * s + y * c]);
}
const hitPoly = it => rectPoly(it, it.bx - G.HITPAD, G.HIT_T, it.bx + it.bw + G.HITPAD, G.HIT_B);
const boxPoly = it => rectPoly(it, it.bx, G.BOX_T, it.bx + it.bw, G.BOX_B);
function segPoly(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L * r, ny = dx / L * r, ex = dx / L * 2, ey = dy / L * 2;
  return [[x1 + nx - ex, y1 + ny - ey], [x2 + nx + ex, y2 + ny + ey], [x2 - nx + ex, y2 - ny + ey], [x1 - nx - ex, y1 - ny - ey]];
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/* Polygons that an item occupies: tap areas (for bounding boxes and tap-area tests), or only the ink
   (ink = true: the drawn line, the word box) for tests of a line against the diagram. */
function polysOf(it, pad = 0, ink = false) {
  if (it.t === 'line') return [segPoly(it.x1, it.y1, it.x2, it.y2, (it.k === 'div' && !ink ? G.DIV_HIT : 1.5) + pad)];
  if (it.t === 'curve') return [segPoly(it.x1, it.y1, it.cx, it.cy, 1.5 + pad), segPoly(it.cx, it.cy, it.x2, it.y2, 1.5 + pad)];
  if (it.t === 'word') return ink ? [rectPoly(it, it.bx - pad, G.BOX_T - pad, it.bx + it.bw + pad, G.BOX_B + pad)]
    : [rectPoly(it, it.bx - G.HITPAD - pad, G.HIT_T - pad, it.bx + it.bw + G.HITPAD + pad, G.HIT_B + pad)];
  if (it.t === 'mark') return [rect(it.ox - G.HITPAD - pad, it.oy + G.HIT_T - pad, it.ox + it.bw + G.HITPAD + pad, it.oy + G.HIT_B + pad)];
  if (it.t === 'mask') return [rect(it.x - pad, it.y - pad, it.x + it.w + pad, it.y + it.h + pad)];
  return [];
}
function bboxOf(items) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of items) for (const P of polysOf(it)) for (const [x, y] of P) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}
const fin = b => (b.bbox = bboxOf(b.items), b);
function polyBox(P) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of P) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}
function satHit(A, B) {                      // convex polygons overlap (separating axis test)
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length], nx = y2 - y1, ny = x1 - x2;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of A) { const v = x * nx + y * ny; if (v < a0) a0 = v; if (v > a1) a1 = v; }
    for (const [x, y] of B) { const v = x * nx + y * ny; if (v < b0) b0 = v; if (v > b1) b1 = v; }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}

/* Box width for a word. Puzzle mode uses one width per line type,
   so the boxes do not show the length of the answer. */
function makeX(sp, mode) {
  const vp = n => n.kind === 'aux' || (n.aux && n.aux.length > 0);   // words of a verb phrase sit close together
  if (mode !== 'puzzle') return { puzzle: false, box: n => Math.max(G.MINBOX, textW(n.w) + 2 * (vp(n) ? G.VPAD : G.BOXPAD)) };
  const cat = { H: 0, S: 0, C: 0, A: 0 };
  wordsOf(sp).forEach(n => { cat[n.cat] = Math.max(cat[n.cat], textW(n.w)); });
  return { puzzle: true, box: n => Math.max(G.MINBOX, cat[n.cat] + 2 * G.BOXPAD) };
}

/* ---------- layout pieces ---------- */
function L_mod(n, X) {                       // modifier on a slant; its own modifiers hang from a hook
  const bw = X.box(n), L = G.SPAD0 + bw + G.SPAD1, hx = L * COS, hy = L * SIN;
  const items = [line(0, 0, hx, hy, 'mod'), wordItem(n, 0, 0, G.ANG, G.SPAD0, bw)];
  const kids = (n.mods || []).map(m => L_mod(m, X));
  if (kids.length) {
    const pos = [];
    kids.forEach((k, i) => pos.push(i === 0 ? G.HOOK
      : Math.max(pos[i - 1] + G.DMIN, pos[i - 1] + kids[i - 1].bbox.x1 + G.CGAP - k.bbox.x0)));
    items.push(line(hx, hy, hx + pos[pos.length - 1], hy, 'h', { hook: true }));
    kids.forEach((k, i) => items.push(...shift(k.items, hx + pos[i], hy)));
  }
  return fin({ simple: !kids.length, items });
}
function L_prep(m, X) {                      // preposition slant + object line
  const bw = X.box(m.prepNode), obj = m.obj;
  let L = G.SPAD0 + bw + G.SPAD1, ob, dy = 0;
  if (obj.kind === 'verbal' && obj.verbal === 'ger') { ob = L_gerLine(obj, X); dy = G.STEP_H; L = Math.max(L, (-(ob.bbox.y0 + dy) + 10) / SIN); }   // R&K lesson 38
  else if (obj.kind === 'nc') { ob = L_ped(obj, X, { minLeft: G.OBJ_OFF }); L = Math.max(L, (-ob.bbox.y0 + 10) / SIN); }   // R&K lesson 72
  else if (obj.items) { ob = L_fork(obj, X, 'right', { lineKind: 'h' }); L = Math.max(L, (-ob.bbox.y0 + 10) / SIN); }
  else ob = L_h(obj, X, { minLeft: G.OBJ_OFF });
  const hx = L * COS, hy = L * SIN;
  return fin({ simple: false, items: [line(0, 0, hx, hy, 'mod'), wordItem(m.prepNode, 0, 0, G.ANG, G.SPAD0, bw), ...shift(ob.items, hx, hy + dy)] });
}
function L_io(m, X) {                        // empty slant + indirect object line
  const hx = G.IO_LEN * COS, hy = G.IO_LEN * SIN;
  const ob = L_h(m.obj, X, { minLeft: G.IO_OFF });
  return fin({ simple: false, items: [line(0, 0, hx, hy, 'mod', { empty: true }), ...shift(ob.items, hx, hy)] });
}
function L_kid(m, X) {
  if (m.kind === 'mod') return L_mod(m, X);
  if (m.kind === 'prep') return L_prep(m, X);
  if (m.kind === 'io') return L_io(m, X);
  if (m.kind === 'verbal') return m.verbal === 'part' ? L_part(m, X) : L_infmod(m, X);
  throw new Error('unknown modifier ' + m.kind);
}
/* Word (or verb phrase) on a horizontal line, children below.
   Lanes at the start of the line hold the start points of dotted lines. */
function L_h(n, X, o = {}) {
  const mods = n.mods || [];
  const hangs = mods.filter(m => m.kind === 'ac' || m.kind === 'sc');
  const apps = mods.filter(m => m.kind === 'app');
  const local = mods.filter(m => !['ac', 'sc', 'app'].includes(m.kind));
  const lanes = [...(o.lanes || []).map(l => ({ ...l })),
    ...hangs.map(m => ({ kind: m.kind, w: m.kind === 'sc' ? G.LANE_SC : G.LANE_AC, at: G.LANE0, node: m }))];
  let lr = 0;
  lanes.forEach(l => { l.x = lr + l.at; lr += l.w; });
  const minLeft = (o.minLeft != null ? o.minLeft : G.WPAD) + lr;
  const rr = o.rightReserve || 0;
  const parts = [...(n.aux || []), n];       // helping verbs first, then the main word
  const pws = parts.map(p => X.box(p));
  const bw = pws.reduce((a, b) => a + b, 0) + G.AUXGAP * (parts.length - 1);
  const ordered = [...local.filter(m => m.kind === 'mod'), ...local.filter(m => m.kind !== 'mod')];
  const kids = ordered.map(m => L_kid(m, X));
  const ax = [];
  kids.forEach((k, i) => {
    if (i === 0) { ax.push(G.START + lr); return; }
    const p = kids[i - 1], a = ax[i - 1];
    ax.push(p.simple ? a + G.DMIN : Math.max(a + G.DMIN, a + p.bbox.x1 + G.CGAP - k.bbox.x0));
  });
  const kidsRight = kids.reduce((mx, k, i) => Math.max(mx, ax[i] + k.bbox.x1), 0);
  let W = Math.max(o.minW || 0, lr + bw + 2 * G.WPAD + rr, minLeft + bw + G.WPAD + rr, kidsRight + G.END);
  const bx = Math.max(minLeft, (W - rr - bw) / 2);
  W = Math.max(W, bx + bw + G.WPAD + rr);
  const items = [line(0, 0, W, 0, o.lineKind || 'h')];
  let x = bx;
  parts.forEach((p, i) => { items.push(wordItem(p, 0, 0, 0, x, pws[i])); x += pws[i] + G.AUXGAP; });
  kids.forEach((k, i) => items.push(...shift(k.items, ax[i], 0)));
  lanes.forEach(l => { if (l.node) items.push({ t: 'hang', ax: l.x, ay: 0, node: l.node, lx0: 0, lx1: W }); });   // lx: the line, for other anchors
  apps.forEach(a => {                        // appositive: same line, in parentheses (R&K lesson 33)
    const ab = L_h(a.obj, X, { lineKind: o.lineKind, minLeft: G.PAREN_PAD });
    const aw = ab.items.find(t => t.t === 'word' && t.n === a.obj);
    const pin = X.puzzle ? -2 : G.BOXPAD - 1;  // natural view: next to the text; puzzle: outside the box
    items.push(...shift(ab.items, W, 0),
      markItem('(', W + aw.bx + pin - G.PAREN_W, 0, G.PAREN_W), markItem(')', W + aw.bx + aw.bw - pin, 0, G.PAREN_W));
    W += ab.W;
  });
  const laneX = {};
  lanes.forEach(l => { if (!l.node) laneX[l.kind] = l.x; });
  return fin({ W, items, laneX });
}
const divLine = (comp, x, y) => comp === 'DO'
  ? line(x, y - G.DIV_UP, x, y, 'div', { div: 'DOL' })          // stands on its line
  : line(x, y, x - G.LEAN, y - G.DIV_UP, 'div', { div: 'CL' });  // leans back toward the subject
/* The line of a participle, gerund or infinitive: the verbal, then its complement. */
function L_verbalLine(vp, X, o = {}) {
  const vb = L_h(vp.V, X, { minLeft: o.minLeft, rightReserve: isLink(vp.comp) ? G.LEAN : 0 });
  const items = [...vb.items];
  let W = vb.W;
  if (vp.comp) { const cb = L_slot(vp[vp.comp], X); items.push(divLine(vp.comp, W, 0), ...shift(cb.items, W, 0)); W += cb.W; }
  return fin({ W, items });
}
function L_part(vp, X) {                     // participle: bent line under its noun (R&K lesson 37)
  const R = G.BEND_R, vl = L_verbalLine(vp, X, { minLeft: R + G.WPAD });
  const L = Math.max(G.PART_L, (-vl.bbox.y0 + 10) / SIN), hx = L * COS, hy = L * SIN;   // a tall complement stays below the noun line
  const sh = shift(vl.items, hx, hy);
  sh[0] = { ...sh[0], x1: hx + R };          // the horizontal part starts after the bend
  const p1x = hx - R * COS, p1y = hy - R * SIN;
  return fin({ simple: false, items: [line(0, 0, p1x, p1y, 'mod', { part: true, node: vp }), { ...curveItem(p1x, p1y, hx, hy, hx + R, hy, 'mod'), node: vp }, ...sh] });
}
function L_infmod(vp, X) {                   // infinitive as a modifier: "to" on a slant (R&K lesson 40)
  const bw = X.box(vp.toNode), vl = L_verbalLine(vp, X, { minLeft: G.OBJ_OFF });
  const L = Math.max(G.SPAD0 + bw + G.SPAD1, (-vl.bbox.y0 + 10) / SIN), hx = L * COS, hy = L * SIN;
  return fin({ simple: false, mainY: hy, items: [line(0, 0, hx, hy, 'mod'), wordItem(vp.toNode, 0, 0, G.ANG, G.SPAD0, bw), ...shift(vl.items, hx, hy)] });
}
function L_gerLine(vp, X) {                  // gerund: stepped line (R&K lesson 38)
  const vl = L_verbalLine(vp, X, { minLeft: G.STEP_W + G.WPAD });
  const items = vl.items.map((it, i) => i === 0 ? { ...it, x1: G.STEP_W } : it);
  items.unshift(line(0, -G.STEP_H, G.STEP_W, -G.STEP_H, 'h', { step: true, node: vp }), line(G.STEP_W, -G.STEP_H, G.STEP_W, 0, 'step', { node: vp }));
  return fin({ items, mainY: 0 });
}
function L_ncBlock(nd, X) {                  // noun clause; "that" floats above it (R&K lesson 71)
  const cb = L_clause(nd.nc, X, { intro: !!nd.introNode });
  const items = [...cb.items];
  if (nd.introNode) {
    const cx = cb.laneX.intro, ib = L_h(nd.introNode, X);
    const iy = cb.bbox.y0 - 12;
    items.push(...shift(ib.items, cx - ib.W / 2, iy), line(cx, iy, cx, 0, 'dash', { nci: true, node: nd }));
  }
  return fin({ items, mainY: 0 });
}
function stemX(blk) {                        // point of the main line, nearest its middle, with nothing below it
  const main = blk.items.filter(t => t.t === 'line' && !t.step && Math.abs(t.y1 - blk.mainY) < 0.5 && Math.abs(t.y2 - blk.mainY) < 0.5);
  const x0 = Math.min(...main.map(l => Math.min(l.x1, l.x2))) + 6, x1 = Math.max(...main.map(l => Math.max(l.x1, l.x2))) - 6;
  const grow = t => { if (t.t !== 'line') return polysOf(t, 7, true);   // a clear gap on all sides: the stem must not seem to touch a line
    const L = Math.hypot(t.x2 - t.x1, t.y2 - t.y1) || 1, ux = (t.x2 - t.x1) / L * 7, uy = (t.y2 - t.y1) / L * 7;
    return [segPoly(t.x1 - ux, t.y1 - uy, t.x2 + ux, t.y2 + uy, 8.5)]; };
  const others = blk.items.filter(t => !main.includes(t)).flatMap(grow);
  const feet = blk.items.filter(t => t.t === 'line' && !main.includes(t)).flatMap(t => [[t.x1, t.y1, t.y2], [t.x2, t.y2, t.y1]])
    .filter(([, y, yo]) => Math.abs(y - blk.mainY) < 0.5 && yo < blk.mainY - 1).map(([x]) => x);
  const mid = (x0 + x1) / 2, xs = [];
  for (let k = 0; k <= (x1 - x0) / 4; k++) { xs.push(mid + k * 4, mid - k * 4); }
  for (const x of xs) {
    if (x < x0 || x > x1 || feet.some(f => Math.abs(f - x) < 16)) continue;
    const seg = segPoly(x, blk.mainY + 3, x, blk.bbox.y1 + 6, 1.5);
    if (!others.some(P => satHit(seg, P))) return x;
  }
  return x1;
}
/* A phrase or clause in a noun slot stands on a pedestal above the slot line (R&K lessons 38, 40, 71). */
function L_ped(nd, X, o = {}) {
  const blk = nd.kind === 'nc' ? L_ncBlock(nd, X) : nd.verbal === 'ger' ? L_gerLine(nd, X) : L_infmod(nd, X);
  const sx = stemX(blk);
  const lift = -(G.PED_H + G.PED_GAP) - blk.bbox.y1;
  const left = Math.max(o.minLeft != null ? o.minLeft : G.WPAD, G.WPAD);
  const dx = left - blk.bbox.x0;
  const W = Math.max(o.minW || 0, dx + blk.bbox.x1 + G.WPAD + (o.rightReserve || 0));
  const px = sx + dx;
  const items = [line(0, 0, W, 0, o.lineKind || 'h'), ...shift(blk.items, dx, lift),
    line(px, blk.mainY + lift, px, -G.PED_H, 'ped', { node: nd, stem: true }), line(px, -G.PED_H, px - G.PED_W / 2, 0, 'ped', { node: nd }),
    line(px, -G.PED_H, px + G.PED_W / 2, 0, 'ped', { node: nd })];
  return fin({ W, items, laneX: {} });
}
function L_slot(n, X, o = {}) {
  if (n.items) return L_fork(n, X, o.side || 'right', o);
  if (n.kind === 'nc' || n.kind === 'verbal') return L_ped(n, X, o);
  return L_h(n, X, o);
}
function L_branch(b, X, o) {                 // one line of a compound predicate: verb [| complement]
  const node = b.V || b, comp = b.V ? b.comp : null;
  const vb = L_h(node, X, { minW: o.Wv || 0, rightReserve: isLink(comp) ? G.LEAN : 0 });
  const items = [...vb.items];
  let W = vb.W, Wc = 0;
  if (comp) {
    const cb = L_slot(b[comp], X, { minW: o.Wc || 0 });
    items.push(divLine(comp, W, 0), ...shift(cb.items, W, 0));
    Wc = cb.W; W += cb.W;
  } else if (o.Wc) {                         // no complement: the line continues to the common end
    items.push(line(W, 0, W + o.Wc, 0, 'h'));
    W += o.Wc;
  }
  return fin({ W, Wv: vb.W, Wc, items });
}
function L_fork(n, X, side, o = {}) {        // compound part on parallel lines
  const lanes = (o.lanes || []).map(l => ({ ...l }));
  let lr = 0;
  lanes.forEach(l => { l.x = lr + l.at; lr += l.w; });
  const ST = G.STEM + lr;
  let br;
  if (n.items.some(it => it.V)) {            // compound predicate: each verb can have a complement
    const pre = n.items.map(it => L_branch(it, X, {}));
    const Wv = Math.max(...pre.map(b => b.Wv)), Wc = Math.max(...pre.map(b => b.Wc));
    br = n.items.map(it => L_branch(it, X, { Wv, Wc }));
  } else {
    const pre = n.items.map(it => L_h(it, X));
    const Wm = Math.max(...pre.map(b => b.W));
    br = n.items.map(it => L_h(it, X, { minW: Wm }));
  }
  const Wc = Math.max(...br.map(b => b.W));
  const cbw = X.box(n.conjNode), CZ = cbw + 2 * G.CZPAD + 2 * G.HITPAD;
  let ys = [0];
  for (let i = 0; i < br.length - 1; i++) ys.push(ys[i] + Math.max(br[i].bbox.y1 - br[i + 1].bbox.y0 + 6, G.FORK_MIN));
  const mid = (ys[0] + ys[ys.length - 1]) / 2;
  ys = ys.map(y => y - mid);
  const DJ = Math.max(G.DJMIN, 0.6 * Math.max(...ys.map(Math.abs)));
  const items = [];
  let W, cx;
  if (side === 'left') {                     // subject: lines join the baseline on the right
    const bEnd = Wc + CZ, Jx = bEnd + DJ;
    W = Jx + G.STEM; cx = Wc + CZ / 2;
    br.forEach((b, i) => {
      items.push(...shift(b.items, 0, ys[i]));
      items.push(line(Wc, ys[i], bEnd, ys[i], 'h'), line(bEnd, ys[i], Jx, 0, 'h'));
    });
    items.push(line(Jx, 0, W, 0, o.lineKind || 'base'));
  } else {                                   // verb or object: lines split on the left
    const x0 = ST + DJ + CZ;
    W = x0 + Wc; cx = ST + DJ + CZ / 2;
    items.push(line(0, 0, ST, 0, o.lineKind || 'base'));
    br.forEach((b, i) => {
      items.push(line(ST, 0, ST + DJ, ys[i], 'h'), line(ST + DJ, ys[i], x0, ys[i], 'h'));
      items.push(...shift(b.items, x0, ys[i]));
    });
  }
  items.push(line(cx, ys[0], cx, ys[ys.length - 1], 'dash'));
  // Reed & Kellogg (1877), lesson 20: in a series the conjunction goes between the last two parts,
  // and an x marks each place where a conjunction is understood (a comma in the sentence).
  for (let i = 0; i < ys.length - 1; i++) {
    const oy = (ys[i] + ys[i + 1]) / 2 - (G.BOX_T + G.BOX_B) / 2;
    if (i === ys.length - 2) {
      items.push(maskItem(cx - cbw / 2, oy + G.BOX_T, cbw, G.BOX_B - G.BOX_T));
      items.push(wordItem(n.conjNode, cx - cbw / 2, oy, 0, 0, cbw));
    } else {
      items.push(maskItem(cx - G.MARKW / 2, oy + G.BOX_T, G.MARKW, G.BOX_B - G.BOX_T));
      items.push(markItem('x', cx - G.MARKW / 2, oy, G.MARKW, 'UC'));
    }
  }
  const laneX = {};
  lanes.forEach(l => { laneX[l.kind] = l.x; });
  return fin({ W, items, laneX });
}
function L_clause(c, X, o = {}) {            // subject | predicate on one baseline at y = 0
  const lanes = [];
  if (o.conn) lanes.push({ kind: 'conn', w: G.CONN_LANE, at: G.CONN_X });
  if (o.arr) lanes.push({ kind: 'arr', w: G.ARR_LANE, at: G.ARR_X });
  if (o.intro) lanes.push({ kind: 'intro', w: G.CONN_LANE, at: G.CONN_X });
  const Sb = L_slot(c.S, X, { side: 'left', lineKind: 'base' });
  const Vb = c.V.items ? L_fork(c.V, X, 'right', { lanes })
    : L_h(c.V, X, { lineKind: 'base', rightReserve: isLink(c.comp) ? G.LEAN : 0, lanes });
  const Cb = c.comp ? L_slot(c[c.comp], X, { lineKind: 'base', rightReserve: c.OC ? G.LEAN : 0 }) : null;
  const Ob = c.OC ? L_h(c.OC, X, { lineKind: 'base' }) : null;
  const items = [...Sb.items];
  const svx = Sb.W;
  let x = svx;
  items.push(line(x, -G.DIV_UP, x, G.DIV_DN, 'div', { div: 'SV', clause: c }));
  items.push(...shift(Vb.items, x, 0));
  x += Vb.W;
  if (Cb) { items.push(divLine(c.comp, x, 0), ...shift(Cb.items, x, 0)); x += Cb.W; }
  if (Ob) { items.push(line(x, 0, x - G.LEAN, -G.DIV_UP, 'div', { div: 'OCL' }), ...shift(Ob.items, x, 0)); x += Ob.W; }   // modern: after the object
  const laneX = {};
  Object.entries(Vb.laneX || {}).forEach(([k, v]) => { laneX[k] = svx + v; });
  return fin({ items, svx, W: x, laneX, vx1: svx + Vb.W, vfork: !!c.V.items });
}

/* ---------- dependent clauses hang below the word they modify ---------- */
/* Each clause is placed where neither it nor its dotted line touches anything already drawn. */
/* Angle preferences of a dotted line (degrees): 0 = default, 1 = gentle first, 2 = steep first. */
const HANG_ANGLES = { sc: [[60, 65, 55, 70, 75], [50, 45, 55, 60], [75, 70, 65]], ac: [[60, 50, 70, 45, 75, 40], [45, 40, 50, 60], [75, 70, 65, 60]] };
/* The variants of a dependent clause block, one for each angle of its dotted line.
   (tx, ty) = where the dotted line ends on the clause. */
function hangVariants(m, X, angles) {
  const sc = m.kind === 'sc';
  const blk = L_clause(sc ? m.cl : m.ac, X, { arr: sc });
  if (sc) return angles.map(a => ({ a, bitems: blk.items, tx: blk.laneX.arr, ty: 0 }));   // the verb line of the adverb clause
  const rw = blk.items.find(t => t.t === 'word' && t.n === m.relNode);
  const under = blk.items.find(t => t.t === 'line' && (t.k === 'h' || t.k === 'base') && Math.abs(t.y1 - rw.oy) < 0.5 && Math.abs(t.y2 - rw.oy) < 0.5
    && Math.min(t.x1, t.x2) <= rw.ox + rw.bx + 0.5 && Math.max(t.x1, t.x2) >= rw.ox + rw.bx + rw.bw - 0.5);
  if (m.relNode.role === 'S' && !m.relNode.compound) return angles.map(a => ({ a, bitems: blk.items, tx: rw.ox + rw.bx - 6, ty: rw.oy }));   // left of the subject
  // R&K lesson 59: the line of the relative word extends; the dotted line meets its end, past every
  // part of the clause above that line
  const xs = Math.max(under.x1, under.x2);
  const above = blk.items.filter(t => t !== under).flatMap(t => polysOf(t, 4, true)).flat().filter(([, y]) => y < rw.oy - 0.5);
  const out = [];
  angles.forEach(a => {
    const k = 1 / Math.tan(a * Math.PI / 180);
    const xe = Math.max(xs + 16, ...above.map(([x, y]) => x + (rw.oy - y) * k));
    const extP = segPoly(xs + 2, rw.oy, xe, rw.oy, 1.5);
    if (blk.items.some(t => t !== under && polysOf(t, 1, true).some(P => satHit(extP, P)))) return;   // the extension must not touch the clause
    out.push({ a, bitems: [...blk.items, line(xs, rw.oy, xe, rw.oy, 'h', { ext: true })], tx: xe, ty: rw.oy });
  });
  if (!out.length) { const xe = blk.bbox.x1 + 12; out.push({ a: 60, bitems: [...blk.items, line(xs, rw.oy, xe, rw.oy, 'h', { ext: true })], tx: xe, ty: rw.oy }); }
  return out;
}
/* Find the highest free place for a dependent clause: its block and its dotted line touch nothing already
   drawn. o.pref: angle preference; o.ax: a different start point on the same line. Returns null or
   { d, L, d0, push } (d = depth below the start point, push = the items to add). */
function findHang(h, items, X, reserved, o = {}) {
  const m = h.node, sc = m.kind === 'sc';
  const HX = o.ax != null ? o.ax : h.ax, HY = h.ay;
  const variants = hangVariants(m, X, HANG_ANGLES[m.kind][o.pref || 0]);
  const obst = [...items.flatMap(it => polysOf(it, 3)), ...reserved].map(P => ({ P, b: polyBox(P) }));
  const startLine = it => it.t === 'line' && Math.abs(it.y1 - HY) < 0.5 && Math.abs(it.y2 - HY) < 0.5
    && Math.min(it.x1, it.x2) <= HX + 0.5 && Math.max(it.x1, it.x2) >= HX - 0.5;
  const obstConn = items.filter(it => !startLine(it)).flatMap(it => polysOf(it, 2, true)).concat(reserved).map(P => ({ P, b: polyBox(P) }));
  const hit = (P, list) => { const b = polyBox(P); return list.some(q => b.x0 < q.b.x1 && b.x1 > q.b.x0 && b.y0 < q.b.y1 && b.y1 > q.b.y0 && satHit(P, q.P)); };
  const subW = sc ? X.box(m.subNode) : 0;
  const below = bboxOf(items).y1 + 16;       // the clause goes below everything already drawn
  variants.forEach(v => { v.bb = bboxOf(v.bitems); v.dTop = Math.max(v.ty - v.bb.y0 + 10, below - HY - v.bb.y0 + v.ty);
    v.polys = v.bitems.flatMap(it => polysOf(it)).map(P => ({ P, b: polyBox(P) })); });   // the parts of the block, before the shift
  const blockHit = (v, ox, oy) => v.polys.some(({ P, b }) => obst.some(q => b.x0 + ox < q.b.x1 && b.x1 + ox > q.b.x0 && b.y0 + oy < q.b.y1 && b.y1 + oy > q.b.y0
    && satHit(P.map(([x, y]) => [x + ox, y + oy]), q.P)));
  const d0 = Math.max(30, Math.min(...variants.map(v => v.dTop)));
  for (let d = d0; d < d0 + 900; d += 6) {
    for (const v of variants) {
      if (d < v.dTop) continue;
      const { bitems, bb, tx, ty } = v, t = v.a * Math.PI / 180, L = d / Math.sin(t);
      if (sc && L < G.SPAD0 + subW + G.SPAD1 + 4) continue;
      const ex = HX + d / Math.tan(t), ey = HY + d, ox = ex - tx, oy = ey - ty;
      const conn = segPoly(HX, HY, ex, ey, 1.5);
      if (hit(conn, obstConn)) continue;
      const sw = sc ? wordItem(m.subNode, HX, HY, t, G.SPAD0, subW) : null;
      if (sw && hit(hitPoly(sw), obstConn)) continue;
      // fast reject with the whole clause box, then test each part
      const B = rect(bb.x0 + ox, bb.y0 + oy, bb.x1 + ox, bb.y1 + oy);
      if (hit(B, obst) && blockHit(v, ox, oy)) continue;
      const placed = shift(bitems, ox, oy);
      // the dotted line must not cross the clause itself, except where it ends
      const own = placed.filter(it => !(it.t === 'line' && Math.hypot(it.x2 - ex, it.y2 - ey) < 1 || it.t === 'line' && Math.abs(it.y1 - ey) < 0.5 && Math.abs(it.y2 - ey) < 0.5 && Math.min(it.x1, it.x2) <= ex + 0.5 && Math.max(it.x1, it.x2) >= ex - 0.5));
      const shortConn = segPoly(HX, HY, ex - (ex - HX) * 4 / L, ey - (ey - HY) * 4 / L, 1.5);
      if (own.some(it => polysOf(it, 1, true).some(P => satHit(shortConn, P)))) continue;
      if (sw) {                              // the conjunction on the dotted line touches nothing of its clause
        const sp = hitPoly(sw), sb = boxPoly(sw);
        if (placed.some(it => it.t === 'word' ? satHit(sp, polysOf(it)[0]) : it.t === 'line' && polysOf(it, 1, true).some(P => satHit(sb, P)))) continue;
      }
      return { d, L, d0, push: [line(HX, HY, ex, ey, 'dash', { hang: m.kind, node: m }), ...(sw ? [sw] : []), ...placed] };
    }
  }
  return null;
}
/* No free place: the clause goes below everything, on a 60-degree dotted line. */
function fallbackHang(h, items, X) {
  const m = h.node, sc = m.kind === 'sc';
  const v = hangVariants(m, X, [60])[0], bb = bboxOf(v.bitems), all = bboxOf(items);
  const ey = all.y1 + 40 + (v.ty - bb.y0), ex = h.ax + (ey - h.ay) / Math.tan(G.ANG);
  items.push(line(h.ax, h.ay, ex, ey, 'dash', { hang: m.kind, node: m }));
  if (sc) items.push(wordItem(m.subNode, h.ax, h.ay, G.ANG, G.SPAD0, X.box(m.subNode)));
  items.push(...shift(v.bitems, ex - v.tx, ey - v.ty));
}
/* Other start points for a dotted line: the lane at the start of the line first, then points along the line
   where no other line meets it. */
function hangOptions(h, items) {
  const opts = [0, 1, 2].map(pref => ({ pref }));
  const touch = items.filter(t => t.t === 'line' && !(Math.abs(t.y1 - h.ay) < 0.5 && Math.abs(t.y2 - h.ay) < 0.5))
    .flatMap(t => [[t.x1, t.y1], [t.x2, t.y2]]).filter(([x, y]) => Math.abs(y - h.ay) < 0.5 && x >= h.lx0 - 1 && x <= h.lx1 + 1).map(([x]) => x)
    .concat(items.filter(t => t.t === 'hang' && t !== h && Math.abs(t.ay - h.ay) < 0.5).map(t => t.ax));
  for (let x = h.lx1 - 10; x >= h.lx0 + 10; x -= 16) {
    if (Math.abs(x - h.ax) < 20 || touch.some(t => Math.abs(t - x) < 14)) continue;
    opts.push({ pref: 0, ax: x });
  }
  return opts;
}
/* Place every dependent clause, from the rightmost start point. Each clause takes its highest free place
   (the lane at the start of its line when that place is as high as possible). When a later clause has no
   place, the earlier clauses try their other places (a small search with a budget). If the search
   fails, a clause with no place goes below everything. */
function resolveHangs(items, X, reserved, again = true, budget0 = 60) {
  let budget = budget0, dir = 1;                  // dir 1: from the rightmost start point; -1: from the leftmost (again = true)
  const first = its => { let k = -1;
    its.forEach((t, i) => { if (t.t === 'hang' && (k < 0 || dir * (t.ax - its[k].ax) > 0.5 || (Math.abs(t.ax - its[k].ax) <= 0.5 && t.ay < its[k].ay))) k = i; });
    return k; };
  function* candidates(h, its) {
    const opts = hangOptions(h, its), lane = budget-- > 0 ? findHang(h, its, X, reserved, opts[0]) : null;
    if (lane && lane.d <= lane.d0 + 12) yield lane;          // as high as possible: no better place exists
    const found = lane && !(lane.d <= lane.d0 + 12) ? [lane] : [];
    for (const o of opts.slice(1)) { if (budget-- <= 0) break; const c = findHang(h, its, X, reserved, o); if (c) found.push(c); }
    found.sort((a, b) => a.d - b.d || a.L - b.L);
    yield* found;
  }
  const solve = its => {
    const i = first(its);
    if (i < 0) return its;
    const rest = its.slice(), [h] = rest.splice(i, 1);
    for (const c of candidates(h, rest)) {
      const done = solve([...rest, ...c.push]);
      if (done) return done;
      if (budget <= 0) return null;
    }
    return null;
  };
  let done = solve(items);
  if (!done && again && items.filter(t => t.t === 'hang').length > 1) { budget = 60; dir = -1; done = solve(items); dir = 1; }
  if (done) { items.splice(0, items.length, ...done); return true; }
  let clean = true;
  for (let guard = 0; guard < 60; guard++) {   // greedy: the lane place, or below everything
    const i = first(items);
    if (i < 0) return clean;
    const [h] = items.splice(i, 1);
    const c = findHang(h, items, X, reserved);
    if (c) items.push(...c.push); else { fallbackHang(h, items, X); clean = false; }
  }
  return clean;
}

/* ---------- full diagram ---------- */
function layout(sp, mode = 'natural') {
  annotate(sp);
  const X = makeX(sp, mode);
  const cl = sp.clauses || [sp], many = cl.length > 1, joins = many ? joinsOf(sp) : [];
  const items = [], cls = [];
  cl.forEach((c, i) => {
    const b = L_clause(c, X, { conn: many });
    if (i === 0) {
      items.push(...b.items);
      cls.push({ c, y: 0, svx: b.svx, vx1: b.vx1, cx: b.laneX.conn });
    } else {
      // Reed & Kellogg (1877), lesson 76: each clause on its own baseline, lower; a dotted line joins the
      // predicates, and the conjunction is on its horizontal step. An x marks a join without a conjunction.
      const prev = cls[i - 1], all = bboxOf(items);
      const jn = sp.joinNodes[i - 1], jw = jn ? X.box(jn) : G.MARKW;
      const stepW = Math.max(G.STEP_MIN, jw + 2 * G.CZPAD + 2 * G.HITPAD);
      const xa = prev.cx, sy = prev.stepY != null ? prev.stepY : all.y1 + G.STEP_DN;
      const xb = Math.max(xa + stepW, prev.stepTo != null ? prev.stepTo : -Infinity);
      const ny = Math.max(sy + G.HIT_B + G.CL_GAP, all.y1 + G.STEP_DN) - b.bbox.y0, nx = xb - b.laneX.conn;
      items.push(line(xa, prev.y, xa, sy, 'dash', { conn: true }), line(xa, sy, xb, sy, 'dash', { conn: true, step: true }),
        line(xb, sy, xb, ny, 'dash', { conn: true }));
      if (jn) items.push(wordItem(jn, xa + (stepW - jw) / 2, sy, 0, 0, jw));
      else items.push(markItem('x', xa + (stepW - jw) / 2, sy, jw, 'UCS'));
      items.push(...shift(b.items, nx, ny));
      cls.push({ c, y: ny, svx: b.svx + nx, vx1: b.vx1 + nx, cx: xb });
    }
    // the dotted line to the next clause goes straight down from this verb line: keep that path free
    const me = cls[i], last = i === cl.length - 1;
    const strip = x => last ? [] : [segPoly(x, me.y + 1, x, me.y + 100000, 6)];
    const before = items.slice();
    if (resolveHangs(items, X, strip(me.cx)) || last) return;
    // Reed & Kellogg (1877), lesson 76: the line joins the predicates "merely for convenience". When a
    // dependent clause blocks its path, (1) the line starts further right on the verb line, where nothing
    // hangs, or (2) its step goes just below this clause and runs to the right of the dependent clauses.
    const offx = i ? me.svx - b.svx : 0, mine = shift(b.items, offx, me.y);
    if (!b.vfork) {
      const own = mine.filter(t => !(t.t === 'line' && Math.abs(t.y1 - me.y) < 0.5 && Math.abs(t.y2 - me.y) < 0.5)).flatMap(t => polysOf(t, 2, true));
      for (let x = offx + b.vx1 - 8; x > me.cx + 12; x -= 12) {
        const path = segPoly(x, me.y + 1, x, me.y + 100000, 1.5);
        if (own.some(P => satHit(path, P))) continue;
        const trial = before.slice();
        if (!resolveHangs(trial, X, strip(x), false, 20)) continue;   // a short search: there are many places to try
        items.splice(0, items.length, ...trial); me.cx = x; return;
      }
    }
    const syH = bboxOf(mine).y1 + G.STEP_DN;
    const trial = before.slice();
    if (resolveHangs(trial, X, [segPoly(me.cx, me.y + 1, me.cx, syH + 6, 6), segPoly(me.cx - 6, syH, me.cx + 100000, syH, 6)])) {
      let right = -Infinity;                  // the right edge of everything below the step
      trial.forEach(t => polysOf(t).forEach(P => { const q = polyBox(P); if (q.y0 > syH) right = Math.max(right, q.x1); }));
      items.splice(0, items.length, ...trial); me.stepY = syH; me.stepTo = right + 20; return;
    }
    items.splice(0, items.length, ...before); resolveHangs(items, X, strip(me.cx));
  });
  if (sp.indNodes.length) {                  // independent words float above the diagram (R&K lesson 44)
    const all = bboxOf(items);
    const blocks = sp.indNodes.map(e => L_h(e.n, X));
    const low = Math.max(...blocks.map(b => b.bbox.y1));
    const y = all.y0 - G.IND_GAP - low;
    let x = all.x0;
    blocks.forEach((b, k) => { items.push(...shift(b.items, x - b.bbox.x0, y).map(it => ({ ...it, ind: k + 1 }))); x += b.bbox.x1 - b.bbox.x0 + G.IND_SEP; });
  }
  const bb = bboxOf(items);
  const dx = G.MARGIN - bb.x0, dy = G.MARGIN - bb.y0;
  const placed = shift(items, dx, dy);
  const words = placed.filter(t => t.t === 'word');
  words.forEach((w, i) => { w.i = i; });
  const clauses = cls.map(k => ({ c: k.c, baseY: k.y + dy, svx: k.svx + dx, vx1: k.vx1 + dx }));
  return {
    sp, mode, items: placed, words, clauses, baseY: clauses[0].baseY, baseYs: clauses.map(k => k.baseY),
    width: Math.ceil(bb.x1 - bb.x0 + 2 * G.MARGIN),
    height: Math.ceil(bb.y1 - bb.y0 + 2 * G.MARGIN),
  };
}

/* ---------- SVG output ---------- */
const r1 = v => Math.round(v * 10) / 10;
const escX = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function slotWhere(lay, it) {
  if (it.n.kind === 'sub') return 'on a dotted slanted line between clauses';
  if (it.ang) return 'on a slanted line';
  if (it.n.kind === 'cconj') return 'on the dotted line between the clauses';
  if (it.n.cat === 'C') return 'on the dashed line';
  if (lay.baseYs.some(y => Math.abs(it.oy - y) < 0.5)) return 'on a baseline';
  if (it.n.role === 'PART') return 'on a bent line';
  if (it.n.role === 'GER') return 'on a stepped line';
  if (it.n.kind === 'nci') return 'on a short line above a clause';
  if (['ADDR', 'INTJ', 'EXPL'].includes(it.n.role)) return 'on a line above the diagram';
  if (it.n.role === 'OP' || it.n.role === 'IO' || it.n.role === 'INF') return 'on a horizontal line below a slanted line';
  return 'on a parallel line';
}

/* o.mode: 'explore' (tap words for help), 'puzzle' (boxes), 'static' */
function svgFor(lay, o = {}) {
  const mode = o.mode || 'explore';
  const out = [];
  const lines = lay.items.filter(t => t.t === 'line' || t.t === 'curve');
  const step = Math.min(45, Math.round(2400 / Math.max(1, lines.length + lay.words.length)));   // a long diagram draws in at most about 2.5 s
  out.push(`<svg class="dg${o.armed ? ' armed' : ''}${o.draw ? ' draw' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lay.width} ${lay.height}" width="${lay.width}" height="${lay.height}" data-w="${lay.width}" data-h="${lay.height}"${o.id ? ` data-dg="${o.id}"` : ''}${o.draw ? ` style="--step:${step}ms"` : ''} role="group" aria-label="${escX(o.label || 'Diagram of the sentence: ' + lay.sp.s)}">`);
  out.push('<g class="lns">');
  lines.forEach((l, i) => {
    if (l.t === 'curve') {
      const len = Math.hypot(l.cx - l.x1, l.cy - l.y1) + Math.hypot(l.x2 - l.cx, l.y2 - l.cy);
      out.push(`<path class="ln k-${l.k}" d="M${r1(l.x1)} ${r1(l.y1)}Q${r1(l.cx)} ${r1(l.cy)} ${r1(l.x2)} ${r1(l.y2)}" style="--i:${i};--len:${r1(len)}"/>`);
      return;
    }
    const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    out.push(`<line class="ln k-${l.k}" x1="${r1(l.x1)}" y1="${r1(l.y1)}" x2="${r1(l.x2)}" y2="${r1(l.y2)}" style="--i:${i};--len:${r1(len)}"${l.div ? ` data-line="${l.div}"` : ''}/>`);
  });
  out.push('</g>');
  if (mode === 'explore') {
    out.push('<g class="dvs">');
    lines.filter(l => l.div).forEach(l => {
      const pts = segPoly(l.x1, l.y1, l.x2, l.y2, G.DIV_HIT).map(p => p.map(r1).join(',')).join(' ');
      out.push(`<g class="part dv" data-div="${l.div}" tabindex="0" role="button" aria-label="${escX(LINES[l.div].name)}"><polygon class="hit" points="${pts}"/></g>`);
    });
    out.push('</g>');
  }
  out.push('<g class="msk">');
  lay.items.filter(t => t.t === 'mask').forEach(m => out.push(`<rect class="mask" x="${r1(m.x)}" y="${r1(m.y)}" width="${r1(m.w)}" height="${r1(m.h)}"/>`));
  out.push('</g><g class="wds">');
  const nWords = lay.words.length;
  lay.words.forEach((it, k) => {
    const deg = r1(it.ang * 180 / Math.PI);
    const tf = `translate(${r1(it.ox)} ${r1(it.oy)})${deg ? ` rotate(${deg})` : ''}`;
    const hit = `<rect class="hit" x="${r1(it.bx - G.HITPAD)}" y="${G.HIT_T}" width="${r1(it.bw + 2 * G.HITPAD)}" height="${G.HIT_B - G.HIT_T}" rx="5"/>`;
    const tx = r1(it.bx + it.bw / 2);
    if (mode === 'puzzle') {
      const word = o.place ? o.place[k] : null;
      const cls = ['part', 'slot', word != null ? 'filled' : '', o.wrong && o.wrong.has(k) ? 'wrong' : '', o.hint === k ? 'hint' : ''].filter(Boolean).join(' ');
      let txt = '';
      if (word != null) {
        const inner = it.bw - 2 * 3;
        const tw = textW(word);
        const fs = tw > inner ? Math.max(10, Math.floor(G.FS * inner / tw * 10) / 10) : G.FS;
        txt = `<text x="${tx}" y="${G.TXT_Y}" text-anchor="middle"${fs !== G.FS ? ` style="font-size:${fs}px"` : ''}>${escX(word)}</text>`;
      }
      const state = word != null ? `contains ${word}` : 'empty';
      const wrong = (o.wrong && o.wrong.has(k) ? ', wrong place' : '') + (o.hint === k ? ', the place for the next word' : '');
      out.push(`<g class="${cls}" data-s="${k}" tabindex="0" role="button" aria-label="Box ${k + 1} of ${nWords}, ${slotWhere(lay, it)}, ${escX(state)}${wrong}" transform="${tf}">${hit}<rect class="box" x="${r1(it.bx)}" y="${G.BOX_T}" width="${r1(it.bw)}" height="${G.BOX_B - G.BOX_T}" rx="4"/>${txt}</g>`);
    } else {
      const label = `${it.n.w}, ${roleName(it.n)}`;
      const attrs = mode === 'explore' ? ` tabindex="0" role="button" aria-label="${escX(label)}"` : '';
      out.push(`<g class="part w r-${it.n.role}" data-i="${k}"${attrs} transform="${tf}" style="--i:${lines.length + k}">${mode === 'explore' ? hit : ''}<text x="${tx}" y="${G.TXT_Y}" text-anchor="middle">${escX(it.n.w)}</text></g>`);
    }
  });
  lay.items.filter(t => t.t === 'mark').forEach((m, k) => {
    const txt = `<text x="${r1(m.ox + m.bw / 2)}" y="${r1(m.oy + G.TXT_Y)}" text-anchor="middle">${escX(m.text)}</text>`;
    if (m.mk && mode === 'explore') out.push(`<g class="part mk" data-div="${m.mk}" tabindex="0" role="button" aria-label="${escX(LINES[m.mk].name)}" style="--i:${lines.length + nWords + k}"><rect class="hit" x="${r1(m.ox - G.HITPAD)}" y="${r1(m.oy + G.HIT_T)}" width="${r1(m.bw + 2 * G.HITPAD)}" height="${G.HIT_B - G.HIT_T}" rx="5"/>${txt}</g>`);
    else out.push(`<g class="${m.mk ? 'mk' : 'pm'}" style="--i:${lines.length + nWords + k}">${txt}</g>`);
  });
  out.push('</g></svg>');
  return out.join('');
}

/* ---------- explainer text for one word ---------- */
const q = s => `“${s}”`;
const vphrase = n => n.items ? n.items.map(it => vphrase(it.V || it)).join(` ${n.conj} `)
  : n.kind === 'verbal' ? vphrase(n.V)
  : [...(n.aux || []).map(a => a.w), n.w].join(' ');
function nounPhrase(n) {
  if (!n) return '';
  if (n.items) return n.items.map(nounPhrase).join(` ${n.conj} `);
  if (n.kind === 'verbal') return phraseText(n);
  if (n.kind === 'nc') return clauseText(n.nc, n.introNode);
  const pre = (n.mods || []).filter(m => m.kind === 'mod').map(m => [...(m.mods || []).map(x => x.w), m.w].join(' '));
  return [...pre, n.understood ? 'you' : n.w].join(' ');
}
const headWords = n => !n ? '' : n.items ? n.items.map(it => (it.V || it).w).join(` ${n.conj} `)
  : n.kind === 'verbal' ? phraseText(n) : n.kind === 'nc' ? clauseText(n.nc, n.introNode) : n.w;
const target = n => n.aux && n.aux.length ? vphrase(n) : n.w;   // a modifier of a verb modifies the whole verb phrase
function phraseText(vp) {                    // "to catch sunbeams", "hearing a step"
  const ws = [];
  if (vp.toNode) ws.push(vp.toNode.w);
  ws.push(vphrase(vp.V));
  if (vp.comp) ws.push(nounPhrase(vp[vp.comp]));
  return ws.join(' ');
}
function clauseText(c, intro) {              // a short reading of a clause: subject, verb, complement
  const ws = [];
  if (intro) ws.push(intro.w);
  ws.push(nounPhrase(c.S), vphrase(c.V));
  if (c.comp) ws.push(nounPhrase(c[c.comp]));
  return ws.filter(Boolean).join(' ');
}
const ROLE_AS = { S: 'the subject', DO: 'the direct object', PN: 'a predicate noun', OP: 'the object of the preposition', IO: 'the indirect object' };
function roleName(n) { return n.rel ? ROLE.REL.name : ROLE[n.role].name; }
function clauseSplit(sp) {                   // the text of each clause of a compound sentence
  const s = sp.s.replace(/[.!?]+$/, ''), parts = [];
  let rest = s;
  joinsOf(sp).forEach(j => {
    let k = j === 'x' ? rest.indexOf('; ') : rest.indexOf(`, ${j} `), skip;
    if (j === 'x') skip = 2; else skip = j.length + 3;
    if (k < 0 && j !== 'x') { k = rest.indexOf(` ${j} `); skip = j.length + 2; }
    if (k < 0) { parts.push(rest); rest = ''; return; }
    parts.push(rest.slice(0, k)); rest = rest.slice(k + skip);
  });
  parts.push(rest);
  return parts;
}
function dynLine(n) {
  if (n.role === 'CCONJ') {
    const parts = clauseSplit(n.sentence), a = parts[n.at] || '', b = parts[n.at + 1] || '';
    if ((a + ' ' + b).split(/\s+/).length <= 16) return `${q(n.w)} joins the clause ${q(a)} to the clause ${q(b + '.')}`;
    const last = a.split(/\s+/).pop(), first = b.split(/\s+/)[0];   // long clauses: name their edges only
    return `${q(n.w)} joins two clauses. The first clause ends with ${q(last + '.')} The second clause starts with ${q(first + '.')}`;
  }
  if (n.role === 'SUB') return `${q(n.w)} connects the clause ${q(clauseText(n.phrase.cl))} to ${q(target(n.parent) + '.')} The clause works as an adverb.`;
  if (n.role === 'NCI') return `${q(n.w)} starts the noun clause ${q(clauseText(n.phrase.nc) + '.')} It has no other job in the clause.`;
  if (n.role === 'INFTO') return `${q(n.w)} starts the infinitive ${q(phraseText(n.phrase) + '.')}`;
  if (['ADDR', 'INTJ', 'EXPL', 'ABS'].includes(n.role)) {
    if (n.role === 'ADDR') return `The sentence speaks to ${q(nounPhrase(n) + '.')} This word has no grammar link to the rest of the sentence.`;
    if (n.role === 'INTJ') return `${q(n.w)} shows an emotion. It has no grammar link to the rest of the sentence.`;
    if (n.role === 'EXPL') return `${q(n.w)} starts the sentence, but it is not the subject.`;
    return `${q(n.w)} and its participle make an absolute phrase. The phrase has no grammar link to the rest of the sentence.`;
  }
  const cl = n.clause, S = cl.S;
  const ctx = n.branch || cl, V = ctx.V, Cn = ctx.comp ? ctx[ctx.comp] : null;
  let rel = '';
  if (n.rel && n.antecedent) rel = ` It also connects the adjective clause to ${q(n.antecedent.w + '.')}`;
  switch (n.role) {
    case 'S': {
      const tail = isLink(cl.comp) ? ' ' + nounPhrase(cl[cl.comp]) : '';
      let s = `Ask ${q(`Who or what ${vphrase(cl.V)}${tail}?`)} The answer is ${q(headWords(S) + '.')}`;
      if (n.compound) s += ' Each part of the compound subject has its own line.';
      return s + rel;
    }
    case 'V': {
      const out = [];
      if (n.aux.length) out.push(`${q(n.w)} is the main verb in the verb phrase ${q(vphrase(n) + '.')}`);
      if (n.compound) out.push(`${q(n.w)} is one part of the compound verb ${q(vphrase(n.compound) + '.')}`);
      return out.join(' ');
    }
    case 'AUX': return `${q(n.w)} helps the main verb ${q(n.main.w + '.')} Together they make the verb phrase ${q(vphrase(n.main) + '.')}`;
    case 'LV': return `${q(vphrase(n))} links ${q(headWords(S))} to ${q(headWords(Cn) + '.')}`;
    case 'DO': {
      if (ctx.kind === 'verbal') return `${q(n.w)} is the direct object of the ${ROLE[VERBAL_ROLE[ctx.verbal]].name.toLowerCase()} ${q(vphrase(ctx.V) + '.')}${rel}`;
      const sv = (S.understood || S.kind !== 'word' ? '' : nounPhrase(S) + ' ') + vphrase(V);
      return `Ask ${q('what?')} or ${q('whom?')} after ${q(sv + '.')} The answer is ${q(headWords(Cn) + '.')}${rel}`;
    }
    case 'PN': case 'PA': {
      const who = ctx.kind === 'verbal' ? (ctx.verbal === 'part' ? headWords(ctx.parent) : phraseText(ctx)) : headWords(S);
      return `${q(n.w)} ${n.role === 'PN' ? 'renames' : 'describes'} ${q(who + '.')}${rel}`;
    }
    case 'OC': return `${q(n.w)} completes the verb ${q(vphrase(V))} and tells about the direct object ${q(headWords(cl.DO) + '.')}`;
    case 'AP': return `${q(n.w)} renames ${q(n.parent.w + '.')} It goes in parentheses after that word.`;
    case 'ART': case 'POS': case 'ADJ': case 'ADV':
      return `${q(n.w)} modifies ${q(target(n.parent) + '.')}`;
    case 'PREP': {
      const asWhat = ADV_PARENTS.has(n.parent.role) || n.parent.kind === 'mod' ? 'an adverb' : 'an adjective';   // it modifies a verb, an adjective or an adverb
      return `The phrase ${q(n.w + ' ' + nounPhrase(n.phrase.obj))} modifies ${q(target(n.parent) + ',')} so it works as ${asWhat}.`;
    }
    case 'OP': return `${q(n.w)} is the object of the preposition ${q(n.parent.w + '.')}${rel}`;
    case 'IO': return `Ask ${q('to whom?')} or ${q('for whom?')} after ${q(vphrase(V) + ' ' + nounPhrase(ctx.DO) + '.')} The answer is ${q(n.w + '.')}`;
    case 'CONJ': {
      const ws = n.comp.items.map(it => (it.V || it).w);
      const last = q(ws[ws.length - 1] + '.');
      const firsts = ws.slice(0, -1).map(w => q(w));
      return `${q(n.w)} joins ${ws.length > 2 ? firsts.join(', ') + ', and ' + last : firsts[0] + ' and ' + last}`;
    }
    case 'PART': return `${q(vphrase(n))} is a participle. Its phrase modifies ${q(n.phrase.parent.w)} like an adjective.`;
    case 'GER': return `${q(vphrase(n))} is a gerund. Its phrase works as ${ROLE_AS[n.phrase.role] || 'a noun'}.`;
    case 'INF': {
      const vp = n.phrase;
      if (vp.role === 'MOD') return `${q(phraseText(vp))} is an infinitive phrase. It modifies ${q(target(vp.parent) + '.')}`;
      return `${q(phraseText(vp))} is an infinitive phrase. It works as ${ROLE_AS[vp.role] || 'a noun'}.`;
    }
    default: return '';
  }
}
function explainWord(n) {
  const r = n.rel ? ROLE.REL : ROLE[n.role];
  return { word: n.w, title: r.name, paras: r.text, extra: dynLine(n) };
}
