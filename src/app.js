'use strict';
/* ===============================================================
   App: views, router, practice puzzle, explainer popup.
   =============================================================== */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
const rich = s => esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
  (_, shown, term) => `<button type="button" class="term" data-term="${term || shown}">${shown}</button>`);
const plain = s => s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '$1');

const app = $('#app');

/* ---------- progress ---------- */
/* Version 2 keeps sentence ids, so a change in the lesson order keeps the progress.
   Version 1 kept "lesson-sentence" positions of the first seven lessons. */
const STORE = 'baseline-progress-v2';
const STORE_V1 = 'baseline-progress-v1';
const V1_ORDER = [['dogs', 'maria', 'stop'], ['olddog', 'frog', 'car'], ['boy', 'team', 'door'], ['soup', 'brother', 'leaves'],
  ['swam', 'girl', 'kids'], ['momdad', 'apples', 'catdog'], ['lunch', 'letter', 'teacher']];
let done = new Set();
function saveDone() { try { localStorage.setItem(STORE, JSON.stringify([...done])); } catch (e) { /* storage blocked */ } }
try {
  const v2 = localStorage.getItem(STORE);
  if (v2) done = new Set(JSON.parse(v2));
  else {
    JSON.parse(localStorage.getItem(STORE_V1) || '[]').forEach(k => {
      const [L, i] = String(k).split('-').map(Number), key = (V1_ORDER[L - 1] || [])[i - 1];
      if (key && SENT[key]) done.add(key);
    });
    if (done.size) saveDone();
  }
} catch (e) { done = new Set(); }
const exKey = (L, i) => LESSONS[L - 1].practice[i - 1];
const doneIn = L => LESSONS[L - 1].practice.filter((_, j) => done.has(exKey(L, j + 1))).length;
function firstOpenLesson() {
  for (let L = 1; L <= LESSONS.length; L++) if (doneIn(L) < LESSONS[L - 1].practice.length) return L;
  return 1;
}
function firstOpenIndex(L) {
  const n = LESSONS[L - 1].practice.length;
  for (let i = 1; i <= n; i++) if (!done.has(exKey(L, i))) return i;
  return 1;
}

/* ---------- diagrams ---------- */
const DG = new Map();
let dgSeq = 0;
const layCache = new Map();
function getLayout(key, mode) {
  const k = key + '|' + mode;
  if (!layCache.has(k)) layCache.set(k, layout(SENT[key], mode));
  return layCache.get(k);
}
function regDiagram(lay) { const id = 'd' + (++dgSeq); DG.set(id, lay); return id; }

const ro = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => {
  if (e.target.isConnected) fit(e.target); else ro.unobserve(e.target);
})) : null;
function fit(sheet) {
  const svg = sheet.querySelector('svg.dg');
  if (!svg || !sheet.isConnected) return;
  const W = +svg.dataset.w, H = +svg.dataset.h;
  const cs = getComputedStyle(sheet);
  const avail = sheet.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  if (!(avail > 0) || !(W > 0)) return;
  const z = parseFloat(sheet.dataset.z);       // a zoom that the user set (challenges)
  const s = z > 0 ? z : Math.max(G.MIN_SCALE, Math.min(G.MAX_SCALE, avail / W));
  const w = (W * s).toFixed(1), h = (H * s).toFixed(1);
  if (svg.getAttribute('width') !== w) svg.setAttribute('width', w);
  if (svg.getAttribute('height') !== h) svg.setAttribute('height', h);
  sheet.classList.toggle('scrolls', W * s > avail + 0.5);
  sheet.classList.toggle('pans', sheet.scrollWidth > sheet.clientWidth + 1 || sheet.scrollHeight > sheet.clientHeight + 1);
}
/* Zoom a large diagram: 'in', 'out', or 'fit' (all of it in view). The middle of the view stays in place. */
function zoomSheet(sheet, how) {
  const svg = sheet.querySelector('svg.dg');
  if (!svg) return;
  const W = +svg.dataset.w, H = +svg.dataset.h, cs = getComputedStyle(sheet);
  const pw = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0), ph = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const aw = sheet.clientWidth - pw, ah = (parseFloat(cs.maxHeight) || sheet.clientHeight) - ph - 2;
  const cur = svg.getBoundingClientRect().width / W || 1;
  const all = Math.min(1, aw / W, ah / H), lo = Math.min(all, G.MIN_SCALE), hi = 1.6;
  const s = Math.max(lo, Math.min(hi, how === 'fit' ? all : how === 'in' ? cur * 1.25 : cur / 1.25));
  const cx = (sheet.scrollLeft + sheet.clientWidth / 2) / cur, cy = (sheet.scrollTop + sheet.clientHeight / 2) / cur;
  sheet.dataset.z = s.toFixed(3);
  fit(sheet);
  sheet.scrollLeft = cx * s - sheet.clientWidth / 2;
  sheet.scrollTop = cy * s - sheet.clientHeight / 2;
}
function mountSheet(sheet, html) {
  sheet.innerHTML = html;
  fit(sheet);
  if (ro && !sheet._ro) { ro.observe(sheet); sheet._ro = true; }
}
function mountDiagrams(root) {
  root.querySelectorAll('.sheet[data-sent]').forEach(sheet => {
    const lay = getLayout(sheet.dataset.sent, 'natural');
    mountSheet(sheet, svgFor(lay, { mode: 'explore', id: regDiagram(lay) }));
  });
}

/* ---------- explainer popup ---------- */
const dlg = $('#dlg');
let opener = null;
function openDlg(c, from) {
  $('#dlg-word').textContent = c.word || '';
  $('#dlg-title').textContent = c.title;
  $('#dlg-text').innerHTML = c.paras.map(p => `<p>${esc(p)}</p>`).join('') +
    (c.extra ? `<p class="dlg-extra"><strong>${UI.inSentence}:</strong> ${esc(c.extra)}</p>` : '');
  opener = from || null;
  if (dlg.open) dlg.close();
  dlg.showModal();
  $('#dlg-close').focus();
}
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', () => { if (opener && opener.isConnected) opener.focus({ preventScroll: true }); opener = null; });
$('#dlg-close').addEventListener('click', () => dlg.close());

function onPart(el) {
  const svg = el.closest('svg');
  const lay = DG.get(svg.dataset.dg);
  if (!lay) return;
  if (el.dataset.div) { const L = LINES[el.dataset.div]; openDlg({ title: L.name, paras: L.text }, el); return; }
  openDlg(explainWord(lay.words[+el.dataset.i].n), el);
}
function onTerm(el) {
  const t = TERMS[el.dataset.term];
  if (t) openDlg({ title: t[0], paras: [t[1]] }, el);
}

/* ---------- views ---------- */
function setNav(view) {
  document.querySelectorAll('.nav a').forEach(a => {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function viewHome() {
  const next = firstOpenLesson();
  document.title = 'Baseline: learn to diagram sentences';
  app.innerHTML = `
    <section class="hero">
      <h1 tabindex="-1">${esc(UI.homeTitle)}</h1>
      <p class="lede">${esc(UI.homeIntro)}</p>
      <div class="sheet" data-sent="smallbird"></div>
      <p class="hint">${esc(UI.exampleHint)}</p>
      <div class="row"><a class="btn primary" href="#/lesson/${next}">${esc(done.size ? fmt(UI.cont, { n: next }) : UI.start)}</a></div>
    </section>
    <section>
      <h2>${esc(UI.lessonsTitle)}</h2>
      <ol class="lessons">
        ${LESSONS.map((l, i) => {
          const n = i + 1, c = doneIn(n), all = l.practice.length;
          return `<li class="${c === all ? 'done-n' : ''}"><a href="#/lesson/${n}">
            <span class="num" aria-hidden="true">${n}</span>
            <span class="lt"><span class="ttl"><span class="sr">Lesson ${n}: </span>${esc(l.title)}</span><span class="bl">${esc(l.blurb)}</span></span>
            <span class="pr">${c} of ${all}<span class="sr"> practice sentences done</span></span>
          </a></li>`;
        }).join('')}
      </ol>
    </section>
    <section>
      <h2>${esc(UI.chTitle)}</h2>
      <p>${esc(UI.chHomeText)}</p>
      <div class="row"><a class="btn" href="#/challenges">${esc(UI.chGo)}</a><span class="muted">${esc(fmt(UI.chTotal, { n: starsTotal(), m: 3 * CHALLENGES.length }))}</span></div>
    </section>
    <section>
      <h2>${esc(UI.bHomeTitle)}</h2>
      <p>${esc(UI.bHomeText)}</p>
      <div class="row"><a class="btn" href="#/build">${esc(UI.bGo)}</a></div>
    </section>
    <section>
      <h2>${esc(UI.fcTitle)}</h2>
      <p>${esc(UI.fcHomeText)}</p>
      <div class="row"><a class="btn" href="#/cards">${esc(UI.fcTitle)}</a></div>
    </section>`;
  mountDiagrams(app);
}

function block(b, first) {
  if (b.p) return `<p>${rich(b.p)}</p>`;
  if (b.h) return `<h2>${esc(b.h)}</h2>`;
  if (b.ol) return `<ol class="steps">${b.ol.map(s => `<li>${rich(s)}</li>`).join('')}</ol>`;
  if (b.ul) return `<ul class="rules">${b.ul.map(s => `<li>${rich(s)}</li>`).join('')}</ul>`;
  if (b.ex) return `<figure class="ex"><figcaption class="ex-s">${esc(SENT[b.ex].s)}</figcaption>
      <div class="sheet" data-sent="${b.ex}"></div>${first ? `<p class="hint">${esc(UI.exampleHint)}</p>` : ''}</figure>`;
  return '';
}

function viewLesson(n) {
  const l = LESSONS[n - 1];
  document.title = `${l.title} – Baseline`;
  let firstEx = true;
  app.innerHTML = `
    <article class="lesson">
      <p class="kicker">Lesson ${n} of ${LESSONS.length}</p>
      <h1 tabindex="-1">${esc(l.title)}</h1>
      ${l.body.map(b => { const h = block(b, b.ex && firstEx); if (b.ex) firstEx = false; return h; }).join('')}
      <div class="row"><a class="btn primary" href="#/practice/${n}/1">${esc(UI.practiceThis)}</a></div>
      <nav class="pager" aria-label="Lessons">
        ${n > 1 ? `<a class="btn" href="#/lesson/${n - 1}">${esc(UI.prevLesson)}</a>` : ''}
        ${n < LESSONS.length ? `<a class="btn" href="#/lesson/${n + 1}">${esc(UI.nextLesson)}</a>` : `<a class="btn" href="#/challenges">${esc(UI.chGo)}</a>`}
      </nav>
    </article>`;
  mountDiagrams(app);
}

const ICON = (() => {
  const s = inner => `<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">${inner}</svg>`;
  const ph = (x, y, w, rot) => `<rect class="ph" x="${x}" y="${y}" width="${w}" height="5" rx="2.5" stroke="none"${rot ? ` transform="rotate(60 ${x} ${y})"` : ''}/>`;
  return {
    base: s(`${ph(12, 24, 18)}${ph(42, 24, 18)}<line x1="6" y1="33" x2="66" y2="33"/>`),
    sv: s(`${ph(10, 24, 18)}${ph(44, 24, 18)}<line x1="6" y1="33" x2="66" y2="33"/><line x1="36" y1="15" x2="36" y2="44"/>`),
    do: s(`${ph(10, 24, 18)}${ph(44, 24, 18)}<line x1="6" y1="33" x2="66" y2="33"/><line x1="36" y1="15" x2="36" y2="33"/>`),
    cl: s(`${ph(10, 24, 16)}${ph(46, 24, 16)}<line x1="6" y1="33" x2="66" y2="33"/><line x1="40" y1="33" x2="30" y2="15"/>`),
    mod: s(`${ph(22, 5, 20)}<line x1="6" y1="14" x2="66" y2="14"/><line x1="20" y1="14" x2="36" y2="42"/>${ph(28, 15, 14, 1)}`),
    prep: s(`<line x1="6" y1="10" x2="66" y2="10"/><line x1="12" y1="10" x2="25" y2="33"/>${ph(19, 12, 10, 1)}<line x1="25" y1="33" x2="66" y2="33"/>${ph(36, 24, 20)}`),
    hook: s(`<line x1="6" y1="8" x2="66" y2="8"/><line x1="12" y1="8" x2="24" y2="29"/>${ph(18, 10, 9, 1)}<line x1="24" y1="29" x2="40" y2="29"/><line x1="40" y1="29" x2="48" y2="43"/>${ph(45, 31, 7, 1)}`),
    clause: s(`${ph(7, 4, 9)}${ph(26, 4, 11)}<line x1="4" y1="12" x2="42" y2="12"/><line x1="20" y1="4" x2="20" y2="19"/>${ph(36, 33, 8)}${ph(58, 33, 9)}<line x1="32" y1="41" x2="70" y2="41"/><line x1="49" y1="33" x2="49" y2="47"/><g stroke-dasharray="3 3" stroke-linecap="butt"><line x1="25" y1="12" x2="25" y2="27"/><line x1="25" y1="27" x2="54" y2="27"/><line x1="54" y1="27" x2="54" y2="41"/></g>${ph(32, 19, 14)}`),
    io: s(`<line x1="6" y1="10" x2="66" y2="10"/><line x1="12" y1="10" x2="25" y2="33"/><line x1="25" y1="33" x2="66" y2="33"/>${ph(36, 24, 20)}`),
    conj: s(`${ph(10, 4, 16)}${ph(10, 28, 16)}<line x1="6" y1="12" x2="44" y2="12"/><line x1="6" y1="36" x2="44" y2="36"/><line x1="44" y1="12" x2="56" y2="24"/><line x1="44" y1="36" x2="56" y2="24"/><line x1="56" y1="24" x2="68" y2="24"/><line x1="36" y1="12" x2="36" y2="36" stroke-dasharray="3 3" stroke-linecap="butt"/>`),
    you: s(`<text x="9" y="28" font-size="14" font-family="AHN, sans-serif" font-weight="600" fill="currentColor" stroke="none">(you)</text>${ph(52, 24, 12)}<line x1="6" y1="33" x2="66" y2="33"/><line x1="48" y1="15" x2="48" y2="44"/>`),
  };
})();

function viewGuide() {
  document.title = 'Guide – Baseline';
  app.innerHTML = `
    <article class="guide">
      <h1 tabindex="-1">${esc(UI.guideTitle)}</h1>
      <h2>${esc(UI.stepsTitle)}</h2>
      <ol class="steps">${GUIDE_STEPS.map(s => `<li>${rich(s)}</li>`).join('')}</ol>
      <h2>${esc(UI.keyTitle)}</h2>
      <ul class="key">${KEY.map(k => `<li><span class="ico" aria-hidden="true">${ICON[k.icon]}</span><span><strong>${esc(k.name)}</strong>${esc(k.text)}</span></li>`).join('')}</ul>
      <h2>${esc(UI.commasTitle)}</h2>
      <p>${esc(UI.commasIntro)}</p>
      <ul class="rules">${GUIDE_COMMAS.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      <h2>${esc(UI.aboutTitle)}</h2>
      ${ABOUT.map(p => `<p>${esc(p)}</p>`).join('')}
      <p class="muted">${esc(UI.progressNote)}</p>
      <button type="button" class="btn" data-reset>${esc(UI.reset)}</button>
      <p class="fb" id="reset-fb" role="status" aria-live="polite"></p>
      <p class="muted version">${esc(fmt(UI.version, { v: APP_VERSION }))}</p>
    </article>`;
}

/* ---------- practice ---------- */
let PZ = null;
function puzzleGroups(slots) {
  const byParent = new Map(), byComp = new Map();
  slots.forEach((s, k) => {
    const n = s.n;
    // sibling modifiers of one word can change places; a modifier with its own modifiers cannot
    if (n.kind === 'mod' && !n.mods.length) byParent.set(n.parent, [...(byParent.get(n.parent) || []), k]);
    // parts of a compound can change places when no part has modifiers, helping verbs or a complement
    if (n.kind === 'word' && n.compound && n.compound.items.every(it => !it.V && !it.mods.length && !it.aux.length))
      byComp.set(n.compound, [...(byComp.get(n.compound) || []), k]);
  });
  return [...byParent.values(), ...byComp.values()].filter(g => g.length > 1);
}
function grade(P) {                          // the boxes with a wrong word (an empty box is not wrong)
  const norm = s => s.toLowerCase();
  const placed = P.place.map(c => c == null ? null : norm(P.chips[c].t));
  const expect = P.slots.map(s => norm(s.n.w));
  const wrong = new Set();
  const grouped = new Set(P.groups.flat());
  P.slots.forEach((_, k) => { if (!grouped.has(k) && placed[k] != null && placed[k] !== expect[k]) wrong.add(k); });
  P.groups.forEach(g => {
    const pool = g.map(k => expect[k]);
    g.forEach(k => { if (placed[k] == null) return; const j = pool.indexOf(placed[k]); if (j >= 0) pool.splice(j, 1); else wrong.add(k); });
  });
  return [...wrong].sort((a, b) => a - b);
}

function viewPractice(L, i) {
  if (!LESSONS[L - 1]) L = firstOpenLesson();
  const lesson = LESSONS[L - 1];
  if (!(i >= 1 && i <= lesson.practice.length)) i = firstOpenIndex(L);
  const key = lesson.practice[i - 1];
  const sp = SENT[key];
  const lay = getLayout(key, 'puzzle');
  const chips = tokens(sp.s).map((t, k) => ({ id: k, t }));
  (sp.clauses || [sp]).forEach(c => { if (c.S.understood) chips.push({ id: chips.length, t: '(you)' }); });
  const ci = commaInfo(sp);
  PZ = { L, i, key, sp, lay, chips, slots: lay.words, groups: puzzleGroups(lay.words),
    place: lay.words.map(() => null), sel: null, status: 'open', wrong: new Set(), draw: false,
    ci, cm: new Map(), cmRes: null, semi: !!(lesson.semi || ci.semi) };
  document.title = `Practice ${L}.${i} – Baseline`;
  app.innerHTML = `
    <section class="practice">
      <h1 tabindex="-1">${esc(UI.practiceTitle)}</h1>
      <div class="pz-top">
        <label class="field"><span>Lesson</span>
          <select id="pz-lesson">${LESSONS.map((l, k) => `<option value="${k + 1}"${k + 1 === L ? ' selected' : ''}>${k + 1}. ${esc(l.title)}</option>`).join('')}</select>
        </label>
        <nav class="dots" aria-label="Sentences in this lesson" id="pz-dots"></nav>
      </div>
      <p class="pz-sent" id="pz-sent"><span class="sr">Sentence ${i} of ${lesson.practice.length}: </span>${esc(ci.has ? ci.plain : sp.s)}</p>
      ${ci.has ? `<p class="hint" id="pz-cnote">${esc(lesson.semi || ci.semi ? UI.cmHiddenSemi : UI.cmHidden)}</p>` : ''}
      <p class="howto">${UI.howTo.map(esc).join(' ')}</p>
      <div class="sheet pz" id="pz-sheet"></div>
      <p class="hint scroll-hint">${esc(UI.scrollHint)}</p>
      <div class="bank" id="pz-bank" role="group" aria-label="Words to place"></div>
      <div class="actions" id="pz-actions"></div>
      <p class="fb" id="pz-fb" role="status" aria-live="polite"></p>
      <section class="commas" id="pz-commas" aria-labelledby="cm-h" hidden></section>
    </section>`;
  renderDots();
  renderPuzzle();
}
function renderDots() {
  const P = PZ, n = LESSONS[P.L - 1].practice.length;
  $('#pz-dots').innerHTML = Array.from({ length: n }, (_, k) => {
    const d = done.has(exKey(P.L, k + 1));
    return `<a class="dot${d ? ' done' : ''}" href="#/practice/${P.L}/${k + 1}"${k + 1 === P.i ? ' aria-current="step"' : ''} aria-label="Sentence ${k + 1}${d ? ', done' : ''}">${k + 1}</a>`;
  }).join('');
}
function nextTarget(P) {
  if (P.kind === 'ch') return P.n < CHALLENGES.length ? { href: `#/challenge/${P.n + 1}`, label: UI.chNext } : { href: '#/challenges', label: UI.chToList };
  const n = LESSONS[P.L - 1].practice.length;
  if (P.i < n) return { href: `#/practice/${P.L}/${P.i + 1}`, label: UI.next };
  if (P.L < LESSONS.length) return { href: `#/lesson/${P.L + 1}`, label: fmt(UI.toLesson, { n: P.L + 1 }) };
  return { href: '#/challenges', label: UI.chGo };
}
function renderPuzzle(focus) {
  const P = PZ, ch = P.kind === 'ch';
  const locked = P.status !== 'open';
  const sheet = $('#pz-sheet'), sl = sheet.scrollLeft, st = sheet.scrollTop;
  if (locked) {
    mountSheet(sheet, svgFor(P.lay, { mode: 'explore', id: regDiagram(P.lay), draw: P.draw }));
    P.draw = false;
  } else {
    mountSheet(sheet, svgFor(P.lay, { mode: 'puzzle', place: P.place.map(c => c == null ? null : P.chips[c].t), wrong: P.wrong, armed: P.sel != null, hint: P.hint }));
  }
  if (ch) { sheet.scrollLeft = sl; sheet.scrollTop = st; }   // a large diagram keeps its place
  $('#pz-bank').innerHTML = locked ? '' : P.chips.map(c => {
    const used = P.place.includes(c.id);
    return `<button type="button" class="chip${used ? ' used' : ''}" data-chip="${c.id}"${used ? ' disabled aria-hidden="true" tabindex="-1"' : ` aria-pressed="${P.sel === c.id}"`}>${esc(c.t)}</button>`;
  }).join('');
  $('#pz-bank').hidden = locked;
  if (ch) { $('#pz-bank-h').hidden = locked; renderNextWord(); }
  const nt = nextTarget(P);
  const commaStep = locked && P.ci.has;
  $('#pz-commas').hidden = !commaStep;
  if (commaStep) renderCommas();
  $('#pz-actions').innerHTML = ch && locked ? `<button type="button" class="btn" data-act="retry">${esc(UI.chRetry)}</button>${commaStep ? '' : `<a class="btn primary" href="${nt.href}" id="pz-next">${esc(nt.label)}</a>`}`
    : commaStep ? ''
    : locked ? `<a class="btn primary" href="${nt.href}" id="pz-next">${esc(nt.label)}</a>`
    : `<button type="button" class="btn primary" data-act="check">${esc(UI.check)}</button>
       ${ch ? `<button type="button" class="btn" data-act="hint">${esc(UI.chHint)}</button>` : ''}
       <button type="button" class="btn" data-act="clear">${esc(UI.clear)}</button>
       <button type="button" class="btn quiet" data-act="show">${esc(UI.show)}</button>
       ${ch ? `<span class="count">${esc(fmt(UI.chCount, { c: P.checks, h: P.hints }))}</span>` : ''}`;
  if (focus) {
    const el = focus.chip != null ? $(`[data-chip="${focus.chip}"]:not([disabled])`) || $('#pz-bank .chip:not([disabled])')
      : focus.slot != null ? $(`#pz-sheet [data-s="${focus.slot}"]`) : focus.sel ? $(focus.sel) : null;
    if (el) el.focus({ preventScroll: true });
    if (el && focus.reveal) el.scrollIntoView({ block: 'center', inline: 'center' });
  }
}
/* ---------- comma step: the user puts the commas (and semicolons) back in ---------- */
const MARK_NAME = { ',': 'comma', ';': 'semicolon' };
function gradeCommas(ci, user) {
  const missing = new Set(), wrongMark = new Set(), extra = new Set();
  ci.req.forEach((mk, i) => { if (!user.has(i)) missing.add(i); else if (user.get(i) !== mk) wrongMark.add(i); });
  user.forEach((mk, i) => {
    if (ci.req.has(i)) return;
    if (ci.opt.has(i)) { if (mk !== ci.opt.get(i)) wrongMark.add(i); return; }
    extra.add(i);
  });
  return { missing, wrongMark, extra, ok: !missing.size && !wrongMark.size && !extra.size };
}
/* A rule for an extra mark that the sentence data does not name: the builder finds it from the jobs of the
   sentence (for example "no comma after the" or "no comma between the last adjective and the noun"). */
function autoWhy(sp) {
  if (!sp._why) {
    sp._why = new Map();
    try {
      const r = jobsFromSpec(sp), rules = r && commaRules(r.toks, r.jobs, r.end);
      if (rules) { rules.why.forEach((v, k) => sp._why.set(k, v)); rules.traps.forEach((v, k) => sp._why.set(k, v)); }
    } catch (e) { /* no rule: the general text */ }
  }
  return sp._why;
}
function renderCommas(focus) {
  const P = PZ, ci = P.ci, res = P.cmRes, last = ci.toks.length - 1, nt = nextTarget(P);
  const words = ci.toks.map((t, i) => {
    if (i === last) return `<span class="cw-end">${esc(t.w + ci.end)}</span>`;
    const mk = P.cm.get(i) || '';
    let cls = 'chip cw';
    if (res) cls += res.missing.has(i) ? ' miss' : (res.extra.has(i) || res.wrongMark.has(i)) ? ' extra' : mk ? ' good' : '';
    const label = mk ? `${t.w}, ${MARK_NAME[mk]} after it` : t.w;
    return `<button type="button" class="${cls}" data-cw="${i}" aria-pressed="${!!mk}" aria-label="${esc(label)}">${esc(t.w)}<span class="cmk" aria-hidden="true">${mk}</span></button>`;
  }).join('');
  let fb = '';
  if (res) {
    const w = (i, end = '') => q(ci.toks[i].w + end);   // American style: the period goes inside the quotes
    const name = i => MARK_NAME[ci.req.get(i) || ci.opt.get(i) || ','];
    const order = [...new Set([...ci.req.keys(), ...ci.opt.keys(), ...ci.trap.keys(), ...res.extra])].sort((a, b) => a - b);
    const items = order.map(i => {
      const rule = COMMA[ci.rule.get(i)];
      if (res.missing.has(i)) return ['err', fmt(UI.cmAdd, { m: name(i), w: w(i, '.') }), rule];
      if (res.wrongMark.has(i)) return ['err', fmt(UI.cmSwap, { m: name(i), w: w(i), x: MARK_NAME[P.cm.get(i)] }), rule];
      if (res.extra.has(i)) return ['err', fmt(UI.cmRemove, { m: MARK_NAME[P.cm.get(i)], w: w(i, '.') }), COMMA[ci.trap.get(i) || autoWhy(P.sp).get(i) || 'none']];
      if (ci.opt.has(i)) return ['opt', fmt(UI.cmOpt, { m: name(i), w: w(i) }), rule];
      if (ci.req.has(i)) return ['ok', fmt(UI.cmGood, { m: name(i), M: name(i)[0].toUpperCase() + name(i).slice(1), w: w(i) }), rule];
      return ['ok', fmt(UI.cmNo, { w: w(i) }), COMMA[ci.trap.get(i)]];
    });
    const n = res.missing.size + res.extra.size + res.wrongMark.size;
    const sx = P.semi ? 'Semi' : '';
    const head = res.ok ? UI['cmAllOk' + sx] + (ci.req.size + ci.opt.size ? '' : ' ' + UI['cmNoneNeeded' + sx]) : n === 1 ? UI['cmFix1' + sx] : fmt(UI['cmFixN' + sx], { n });
    fb = `<p class="cm-head">${esc(head)}</p><ul class="cm-list">${items.map(([k, a, b]) => `<li class="${k}"><strong>${esc(a)}</strong> ${esc(b)}</li>`).join('')}</ul>`;
  }
  $('#pz-commas').innerHTML = `
    <h2 id="cm-h" tabindex="-1">${esc(P.semi ? UI.cmTitleSemi : UI.cmTitle)}</h2>
    ${P.sp.ctx ? `<p class="cm-ctx"><strong>${esc(UI.cmCtx)}</strong> ${esc(P.sp.ctx)}</p>` : ''}
    <p class="howto">${(P.semi ? UI.cmHowSemi : UI.cmHow).map(esc).join(' ')}</p>
    <div class="cwords" role="group" aria-label="${esc(UI.cmWords)}">${words}</div>
    <div class="actions">
      <button type="button" class="btn${res ? '' : ' primary'}" data-act="ccheck">${esc(P.semi ? UI.cmCheckSemi : UI.cmCheck)}</button>
      <a class="btn${res ? ' primary' : ''}" href="${nt.href}" id="pz-next">${esc(nt.label)}</a>
    </div>
    <div class="fb${res ? (res.ok ? ' ok' : ' err') : ''}" id="cm-fb" role="status" aria-live="polite">${fb}</div>`;
  if (focus) { const el = $(focus); if (el) el.focus({ preventScroll: true }); }
}
function onCommaWord(i) {
  const P = PZ, cur = P.cm.get(i) || '';
  const next = cur === '' ? ',' : cur === ',' && P.semi ? ';' : '';
  if (next) P.cm.set(i, next); else P.cm.delete(i);
  P.cmRes = null;
  renderCommas(`[data-cw="${i}"]`);
}
function onCommaCheck() {
  const P = PZ;
  P.cmRes = gradeCommas(P.ci, P.cm);
  if (P.cmRes.ok) { if (P.kind === 'ch') { chRec(P.key).marks = true; saveCh(); } else { done.add('c:' + P.key); saveDone(); } }
  $('#pz-sent').innerHTML = `<span class="sr">${esc(P.semi ? UI.cmFullSemi : UI.cmFull)} </span>${esc(P.sp.s)}`;
  const note = $('#pz-cnote'); if (note) note.remove();
  renderCommas('#cm-fb');
}

function setFb(msg, kind, tip) {
  const el = $('#pz-fb');
  if (!el) return;
  el.className = 'fb' + (kind ? ' ' + kind : '');
  el.innerHTML = msg ? esc(msg) + (tip ? `<span class="tip">${esc(tip)}</span>` : '') : '';
}
function onChip(id) {
  const P = PZ;
  if (P.status !== 'open') return;
  P.sel = P.sel === id ? null : id;
  setFb('');
  renderPuzzle({ chip: id });
}
function onSlot(k) {
  const P = PZ;
  if (P.status !== 'open') return;
  const cur = P.place[k];
  if (P.kind === 'ch') {
    if (cur != null) { P.place[k] = null; P.sel = cur; }
    else if (P.sel != null) { P.place[k] = P.sel; P.sel = nextChip(P, P.sel); }
    else { setFb(UI.chFbNoSel, 'warn'); return; }
    P.hint = null;
    saveAttempt(P);
  } else if (P.sel != null) { P.place[k] = P.sel; P.sel = null; }
  else if (cur != null) { P.place[k] = null; P.sel = cur; }
  else { setFb(UI.fbNoSel, 'warn'); return; }
  P.wrong = new Set();
  setFb('');
  renderPuzzle({ slot: k });
}
function onAct(act) {
  const P = PZ;
  if (P.kind === 'ch' && chAct(act)) return;
  if (act === 'clear') {
    P.place = P.place.map(() => null); P.sel = null; P.wrong = new Set(); setFb('');
    renderPuzzle({ sel: '#pz-bank .chip' });
  } else if (act === 'check') {
    if (P.place.some(c => c == null)) { setFb(UI.fbEmpty, 'warn'); return; }
    const wrong = grade(P);
    if (wrong.length) {
      P.wrong = new Set(wrong);
      setFb(wrong.length === 1 ? UI.fbWrong1 : fmt(UI.fbWrongN, { n: wrong.length }), 'err', TIPS[P.slots[wrong[0]].n.role]);
      renderPuzzle({ sel: '#pz-actions [data-act="check"]' });
      return;
    }
    P.status = 'solved'; P.draw = true;
    done.add(exKey(P.L, P.i)); saveDone();
    const lessonDone = doneIn(P.L) === LESSONS[P.L - 1].practice.length;
    const allDone = LESSONS.every((_, k) => doneIn(k + 1) === LESSONS[k].practice.length);
    setFb(UI.fbOk, 'ok', allDone ? UI.fbAllDone + ' ' + UI.fbExplore : lessonDone ? UI.fbLessonDone + ' ' + UI.fbExplore : UI.fbExplore);
    renderDots();
    renderPuzzle({ sel: P.ci.has ? '#cm-h' : '#pz-next' });
  } else if (act === 'show') {
    P.status = 'shown'; P.draw = true; P.sel = null; P.wrong = new Set();
    setFb(UI.fbShown, 'warn', UI.fbExplore);
    renderPuzzle({ sel: P.ci.has ? '#cm-h' : '#pz-next' });
  } else if (act === 'ccheck') onCommaCheck();
}


/* ---------- challenges ---------- */
/* Saved per challenge: best stars, and the open attempt (boxes, checks, hints). */
const CH_STORE = 'baseline-challenges-v1';
let chState = {};
try { chState = JSON.parse(localStorage.getItem(CH_STORE) || '{}') || {}; } catch (e) { chState = {}; }
function saveCh() { try { localStorage.setItem(CH_STORE, JSON.stringify(chState)); } catch (e) { /* storage blocked */ } }
const chRec = key => chState[key] || (chState[key] = { best: 0 });
const starsTotal = () => CHALLENGES.reduce((a, c) => a + ((chState[c.key] || {}).best || 0), 0);
const starsFor = (checks, hints) => checks <= 1 && !hints ? 3 : checks <= 3 && hints <= 1 ? 2 : 1;
const STAR = on => `<svg class="star${on ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>`;
const starRow = n => `<span class="stars" role="img" aria-label="${esc(fmt(UI.chStarsLabel, { n }))}">${[1, 2, 3].map(k => STAR(k <= n)).join('')}</span>`;
const opening = s => s.split(/\s+/).slice(0, 6).join(' ') + '…';   // the first words, without the marks (the marks are part of the task)

function viewChallenges() {
  document.title = 'Challenges – Baseline';
  app.innerHTML = `
    <section class="ladder-v">
      <h1 tabindex="-1">${esc(UI.chTitle)}</h1>
      ${UI.chIntro.map(t => `<p class="lede">${esc(t)}</p>`).join('')}
      <h2>${esc(UI.chRulesTitle)}</h2>
      <ul class="rules">${UI.chRules.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <p class="stars-total">${esc(fmt(UI.chTotal, { n: starsTotal(), m: 3 * CHALLENGES.length }))}</p>
      ${TIERS.map((t, ti) => `<h2>${esc(t)}</h2>
        <ol class="lessons ladder">${CHALLENGES.map((c, k) => ({ c, n: k + 1 })).filter(o => o.c.tier === ti).map(({ c, n }) => {
          const sp = SENT[c.key], rec = chState[c.key] || {};
          const note = fmt(UI.chWords, { n: tokens(sp.s).length }) + (rec.place && !rec.end && rec.place.some(v => v != null) ? ' · ' + UI.chStarted : '');
          return `<li class="${rec.best ? 'done-n' : ''}"><a href="#/challenge/${n}">
            <span class="num" aria-hidden="true">${n}</span>
            <span class="lt"><span class="ttl"><span class="sr">Challenge ${n}: </span>${esc(opening(commaInfo(sp).plain))}</span><span class="bl">${esc(note)}</span></span>
            ${starRow(rec.best || 0)}
          </a></li>`;
        }).join('')}</ol>`).join('')}
    </section>`;
  warmChallenges(CHALLENGES.map((_, k) => k + 1));
}

const ZOOM_ICON = {
  out: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12"/></svg>',
  in: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M10 4v12"/></svg>',
};
/* A long diagram can take a moment to lay out: the page shows first, then the diagram. */
const idle = window.requestIdleCallback ? f => window.requestIdleCallback(f, { timeout: 2000 }) : f => setTimeout(f, 200);
function warmChallenges(ns) {               // lay out challenge diagrams while the user reads
  const todo = ns.filter(n => CHALLENGES[n - 1] && !layCache.has(CHALLENGES[n - 1].key + '|puzzle'));
  const step = () => { const n = todo.shift(); if (n == null) return; getLayout(CHALLENGES[n - 1].key, 'puzzle'); if (todo.length) idle(step); };
  if (todo.length) idle(step);
}
function viewChallenge(n) {
  if (!(n >= 1 && n <= CHALLENGES.length)) n = 1;
  const c = CHALLENGES[n - 1], key = c.key, sp = SENT[key];
  if (!layCache.has(key + '|puzzle')) {
    PZ = null;
    app.innerHTML = `<section class="practice challenge"><p class="kicker">${esc(fmt(UI.chKicker, { n, m: CHALLENGES.length }))}</p>
      <h1 tabindex="-1">${esc(fmt(UI.chHeading, { n }))}</h1><p class="hint" role="status">${esc(UI.chWait)}</p></section>`;
    const want = location.hash;
    requestAnimationFrame(() => setTimeout(() => {
      getLayout(key, 'puzzle');
      if (location.hash !== want) return;
      const f = document.activeElement && document.activeElement.matches('h1');
      viewChallenge(n);
      if (f) $('h1', app).focus({ preventScroll: true });
    }, 0));
    return;
  }
  const lay = getLayout(key, 'puzzle');
  const chips = tokens(sp.s).map((t, k) => ({ id: k, t }));
  (sp.clauses || [sp]).forEach(cl => { if (cl.S.understood) chips.push({ id: chips.length, t: '(you)' }); });
  const ci = commaInfo(sp), rec = chRec(key);
  let place = lay.words.map(() => null);
  if (Array.isArray(rec.place) && rec.place.length === place.length) {   // the saved attempt; each word in one box only
    const seen = new Set();
    place = rec.place.map(v => (Number.isInteger(v) && chips[v] && !seen.has(v) ? (seen.add(v), v) : null));
  }
  PZ = { kind: 'ch', n, key, sp, lay, chips, slots: lay.words, groups: puzzleGroups(lay.words), place, sel: null,
    status: rec.end === 'shown' ? 'shown' : rec.end === 'solved' ? 'solved' : 'open', wrong: new Set(), hint: null, draw: false,
    checks: rec.checks || 0, hints: rec.hints || 0, ci, cm: new Map(), cmRes: null, semi: true };
  if (PZ.status === 'open') PZ.sel = nextChip(PZ, -1);
  document.title = `Challenge ${n} – Baseline`;
  app.innerHTML = `
    <section class="practice challenge">
      <p class="kicker">${esc(fmt(UI.chKicker, { n, m: CHALLENGES.length }))} · ${esc(TIERS[c.tier])} · ${esc(fmt(UI.chWords, { n: tokens(sp.s).length }))}</p>
      <h1 tabindex="-1">${esc(fmt(UI.chHeading, { n }))}</h1>
      <p class="pz-sent" id="pz-sent"><span class="sr">${esc(UI.chSentence)} </span>${esc(ci.plain)}</p>
      ${PZ.status === 'open' ? `<p class="hint" id="pz-cnote">${esc(UI.cmHiddenSemi)}</p>
      <p class="howto">${UI.chHowTo.map(esc).join(' ')}</p>` : ''}
      <div class="pz-bar">
        <p class="nextw" id="pz-nextw" aria-live="polite"></p>
        <div class="zoom" role="group" aria-label="${esc(UI.chZoom)}">
          <button type="button" class="btn zb" data-zoom="out" aria-label="${esc(UI.chZoomOut)}">${ZOOM_ICON.out}</button>
          <button type="button" class="btn zb" data-zoom="fit" aria-label="${esc(UI.chFitLabel)}">${esc(UI.chFit)}</button>
          <button type="button" class="btn zb" data-zoom="in" aria-label="${esc(UI.chZoomIn)}">${ZOOM_ICON.in}</button>
        </div>
      </div>
      <div class="sheet pz big" id="pz-sheet"></div>
      <p class="hint scroll-hint">${esc(UI.chScrollHint)}</p>
      <div class="actions" id="pz-actions"></div>
      <p class="fb" id="pz-fb" role="status" aria-live="polite"></p>
      <h2 class="bank-h" id="pz-bank-h">${esc(UI.chBankTitle)}</h2>
      <div class="bank big" id="pz-bank" role="group" aria-labelledby="pz-bank-h"></div>
      <section class="commas" id="pz-commas" aria-labelledby="cm-h" hidden></section>
    </section>`;
  renderPuzzle();
  if (rec.end === 'solved') setFb(fmt(UI.chBest, { n: rec.best || 0 }), 'ok', UI.fbExplore);
  else if (rec.end === 'shown') setFb(UI.fbShown, 'warn', UI.fbExplore);
  warmChallenges([n + 1]);
}
/* The first word after chip "after" (in sentence order) that is not in a box. */
function nextChip(P, after) {
  const free = P.chips.filter(c => !P.place.includes(c.id));
  return (free.find(c => c.id > after) || free[0] || { id: null }).id;
}
function renderNextWord() {
  const P = PZ, el = $('#pz-nextw');
  if (P.status !== 'open') { el.innerHTML = ''; return; }
  if (P.sel == null) { el.textContent = UI.chAllPlaced; return; }
  const i = P.chips.findIndex(c => c.id === P.sel), a = Math.max(0, i - 3), b = Math.min(P.chips.length, i + 4);
  const ctx = P.chips.slice(a, b).map(c => c.id === P.sel ? `<mark>${esc(c.t)}</mark>` : esc(c.t)).join(' ');
  el.innerHTML = `<span class="nw-l">${esc(UI.chNextWord)}</span> <span class="nw-c">${a > 0 ? '… ' : ''}${ctx}${b < P.chips.length ? ' …' : ''}</span>
    <button type="button" class="btn quiet nw-skip" data-act="skip">${esc(UI.chSkip)}</button>`;
}
function saveAttempt(P) {
  const rec = chRec(P.key);
  rec.place = P.place.slice(); rec.checks = P.checks; rec.hints = P.hints;
  saveCh();
}
/* Actions of a challenge. Returns false for the actions that work as in practice. */
function chAct(act) {
  const P = PZ;
  if (act === 'check') {
    const filled = P.place.filter(c => c != null).length, empty = P.place.length - filled;
    if (!filled) { setFb(UI.chFbNone, 'warn'); return true; }
    P.checks++; P.hint = null;
    const wrong = grade(P);
    if (!wrong.length && !empty) {
      const rec = chRec(P.key), got = starsFor(P.checks, P.hints);
      rec.best = Math.max(rec.best || 0, got); rec.end = 'solved';
      P.status = 'solved'; P.draw = true; P.sel = null; P.wrong = new Set();
      saveAttempt(P);
      setFb(UI.fbOk, 'ok', (got === 1 ? UI.chGot1 : fmt(UI.chGotN, { n: got })) + ' ' + UI.fbExplore);
      showFullSentence(P);
      renderPuzzle({ sel: '#cm-h' });
      return true;
    }
    P.wrong = new Set(wrong);
    const msg = [wrong.length ? (wrong.length === 1 ? UI.fbWrong1 : fmt(UI.fbWrongN, { n: wrong.length }))
      : (filled === 1 ? UI.chFbGood1 : fmt(UI.chFbGoodN, { n: filled }))];
    if (empty) msg.push(empty === 1 ? UI.chFbEmpty1 : fmt(UI.chFbEmptyN, { n: empty }));
    setFb(msg.join(' '), wrong.length ? 'err' : 'warn', wrong.length ? TIPS[P.slots[wrong[0]].n.role] : '');
    saveAttempt(P);
    renderPuzzle({ sel: '#pz-actions [data-act="check"]' });
    return true;
  }
  if (act === 'hint') {
    const norm = s => s.toLowerCase();
    if (P.sel != null) {                       // the box for the next word
      const w = norm(P.chips.find(c => c.id === P.sel).t);
      const cand = P.slots.map((_, k) => k).filter(k => norm(P.slots[k].n.w) === w);
      const k = cand.find(k => P.place[k] == null) ?? cand.find(k => norm(P.chips[P.place[k]].t) !== w);
      if (k != null) {
        P.hints++; P.hint = k; P.wrong = new Set();
        saveAttempt(P);
        setFb(fmt(UI.chFbHint, { w: P.chips.find(c => c.id === P.sel).t }), 'warn');
        renderPuzzle({ slot: k, reveal: true });
        return true;
      }
    }
    const wrong = grade(P);                    // else a box with a wrong word
    if (wrong.length) {
      P.hints++; P.hint = null; P.wrong = new Set([wrong[0]]);
      saveAttempt(P);
      setFb(UI.chFbHintWrong, 'warn');
      renderPuzzle({ slot: wrong[0], reveal: true });
      return true;
    }
    setFb(UI.chFbHintNone, 'warn');
    return true;
  }
  if (act === 'skip') {
    if (P.sel != null) P.sel = nextChip(P, P.sel);
    renderPuzzle({ sel: '#pz-nextw .nw-skip' });
    return true;
  }
  if (act === 'clear') {
    P.place = P.place.map(() => null); P.wrong = new Set(); P.hint = null; P.sel = nextChip(P, -1);
    saveAttempt(P); setFb('');
    renderPuzzle({ sel: '#pz-actions [data-act="check"]' });
    return true;
  }
  if (act === 'show') {
    const rec = chRec(P.key);
    rec.end = 'shown'; saveCh();
    P.status = 'shown'; P.draw = true; P.sel = null; P.wrong = new Set(); P.hint = null;
    setFb(UI.fbShown, 'warn', UI.chNoStars + ' ' + UI.fbExplore);
    showFullSentence(P);
    renderPuzzle({ sel: '#cm-h' });
    return true;
  }
  if (act === 'retry') {
    const rec = chRec(P.key);
    delete rec.place; delete rec.end; rec.checks = 0; rec.hints = 0; saveCh();
    viewChallenge(P.n);
    const h = $('h1', app); if (h) h.focus({ preventScroll: true });
    return true;
  }
  return false;
}
function showFullSentence(P) {
  const el = $('#pz-sent');
  if (el) el.innerHTML = `<span class="sr">${esc(UI.chSentence)} </span>${esc(P.ci.plain)}`;
  ['#pz-cnote', '.challenge .howto'].forEach(q => { const e = $(q); if (e) e.remove(); });
}


/* ---------- builder: the user's own sentence ---------- */
const B_STORE = 'baseline-build-v1';
let BLD = { text: '', jobs: [], started: false, key: null };
try {
  const v = JSON.parse(localStorage.getItem(B_STORE) || 'null');
  if (v && typeof v.text === 'string') BLD = { text: v.text, jobs: Array.isArray(v.jobs) ? v.jobs : [], started: !!v.started, key: v.key || null };
} catch (e) { /* storage blocked */ }
function saveBld() { try { localStorage.setItem(B_STORE, JSON.stringify(BLD)); } catch (e) { /* storage blocked */ } }
let BS = { res: null, cur: null, showJobs: false };
const jobName = j => (JOBS[j] || [j])[0];
function jobTag(J) {                         // "Verb of an adverb clause", "Gerund as subject"
  if (J.j === 'V' && J.cl && J.cl !== 'main') return JOB_TAG[J.cl];
  if ((J.j === 'GER' || J.j === 'INF') && J.as) return jobName(J.j) + ' ' + (JOB_TAG[J.as] || JOB_TAG['inf' + J.as] || '');
  return jobName(J.j);
}
const bParse = () => parseSentence(BLD.text);
const bJobs = n => Array.from({ length: n }, (_, i) => (BLD.jobs[i] && JOBS[BLD.jobs[i].j] ? BLD.jobs[i] : null));
const BLOCKING = ['empty', 'short', 'long', 'marks', 'one', 'chars', 'contraction', 'end'];

function viewBuild() {
  document.title = 'Build a diagram – Baseline';
  app.innerHTML = `
    <section class="build">
      <h1 tabindex="-1">${esc(UI.bTitle)}</h1>
      ${UI.bIntro.map(t => `<p class="lede">${esc(t)}</p>`).join('')}
      <div id="b-main"></div>
    </section>`;
  BS = { res: null, cur: null, showJobs: false };
  renderBuild();
}
function renderBuild() {
  const box = $('#b-main');
  if (!BLD.started) {
    box.innerHTML = `
      <label class="b-label" for="b-text">${esc(UI.bLabel)}</label>
      <textarea id="b-text" rows="4" maxlength="1500" spellcheck="true">${esc(BLD.text)}</textarea>
      <p class="hint">${esc(UI.bEditNote)}</p>
      <div class="actions"><button type="button" class="btn primary" data-bact="start">${esc(UI.bStart)}</button>
        <button type="button" class="btn" data-bact="example">${esc(UI.bExample)}</button></div>
      <div class="fb" id="b-fb" role="status" aria-live="polite"></div>`;
    return;
  }
  const ps = bParse(), sp = BLD.key && SENT[BLD.key];
  const answer = sp && tokens(sp.s).join(' ') === ps.toks.map(t => t.w).join(' ');
  box.innerHTML = `
    <div class="b-head"><p class="b-sent" id="b-sent">${esc(BLD.text)}</p>
      <button type="button" class="btn quiet" data-bact="edit">${esc(UI.bEdit)}</button></div>
    <h2>${esc(UI.bWordsTitle)}</h2>
    <p class="hint">${esc(UI.bWordsHint)}</p>
    <div class="bwords" id="b-words" role="group" aria-label="${esc(UI.bWordsTitle)}"></div>
    <h2>${esc(UI.bDiagramTitle)}</h2>
    <div class="pz-bar"><p class="nextw"></p>
      <div class="zoom" role="group" aria-label="${esc(UI.chZoom)}">
        <button type="button" class="btn zb" data-zoom="out" aria-label="${esc(UI.chZoomOut)}">${ZOOM_ICON.out}</button>
        <button type="button" class="btn zb" data-zoom="fit" aria-label="${esc(UI.chFitLabel)}">${esc(UI.chFit)}</button>
        <button type="button" class="btn zb" data-zoom="in" aria-label="${esc(UI.chZoomIn)}">${ZOOM_ICON.in}</button>
      </div></div>
    <div class="sheet big" id="pz-sheet"></div>
    <p class="hint scroll-hint">${esc(UI.chScrollHint)}</p>
    <div class="actions"><button type="button" class="btn primary" data-bact="check">${esc(UI.bCheck)}</button>
      <button type="button" class="btn" data-bact="clear">${esc(UI.bClearAll)}</button>
      ${answer ? `<button type="button" class="btn quiet" data-bact="answer">${esc(UI.bAnswer)}</button>` : ''}</div>
    <div class="b-res" id="b-fb" role="status" aria-live="polite"></div>
    <p class="muted">${esc(UI.bSaved)}</p>`;
  renderWords(); renderBDiagram(); renderBResult();
}
function renderWords() {
  const ps = bParse(), toks = ps.toks, jobs = bJobs(toks.length), probs = BS.res ? BS.res.probs : [];
  $('#b-words').innerHTML = toks.map((t, i) => {
    const J = jobs[i], p = probs.filter(x => x.i === i);
    const sev = p.some(x => x.sev === 'err') ? ' err' : p.length ? ' warn' : '';
    const tag = J ? jobTag(J) + (J.to != null && toks[J.to] && linkKind(J) ? ' → ' + toks[J.to].w : '') : UI.bNoJob;
    return `<button type="button" class="chip bw${J ? ' set' : ''}${sev}" data-bw="${i}" aria-haspopup="dialog">`
      + `<span class="bw-w">${esc(t.w)}${t.mark ? `<span class="bw-m">${t.mark}</span>` : ''}</span><span class="bw-j">${esc(tag)}</span></button>`;
  }).join('') + `<span class="cw-end">${esc(ps.end)}</span>`;
}
function renderBDiagram() {
  const ps = bParse(), toks = ps.toks, jobs = bJobs(toks.length), sheet = $('#pz-sheet');
  let built = null, lay = null;
  try { built = specFromJobs(toks, jobs, ps.end); if (built.spec) lay = layout(built.spec, 'natural'); } catch (e) { lay = null; }
  if (!lay) {
    sheet.innerHTML = `<p class="hint b-empty">${esc(built && built.spec ? B_MSG.engine : UI.bNoDiagram)}</p>`;
    sheet.classList.remove('scrolls', 'pans');
    return;
  }
  const sl = sheet.scrollLeft, st = sheet.scrollTop;
  mountSheet(sheet, svgFor(lay, { mode: 'explore', id: regDiagram(lay) }));
  sheet.scrollLeft = sl; sheet.scrollTop = st;
}
const ENGINE_MSG = [[/must be a word/, 'engWord'], [/raised phrase or noun clause/, 'engNested'], [/relative pronoun/, 'engRel'],
  [/shared complement/, 'engShared'], [/has a form that is not supported/, 'engOP']];
function bMsg(p, toks, jobs) {
  let code = p.code;
  if (code === 'engine') { const m = ENGINE_MSG.find(([re]) => re.test(p.x || '')); code = m ? m[1] : 'engine'; }
  const J = p.i != null ? jobs[p.i] : null;
  return fmt(B_MSG[code] || B_MSG.engine, { w: p.i != null ? toks[p.i].w : '', h: p.h != null && toks[p.h] ? toks[p.h].w : '',
    x: p.x || '', need: J ? (JOB_NEED[J.j] || '') : '' });
}
function renderBResult() {
  const box = $('#b-fb'), r = BS.res;
  if (!r) { box.innerHTML = ''; box.className = 'b-res'; return; }
  const toks = r.toks, jobs = bJobs(toks.length);
  const errs = r.probs.filter(p => p.sev === 'err'), warns = r.probs.filter(p => p.sev === 'warn');
  const asks = r.rules ? r.rules.asks : [];
  const item = (p, k) => `<li class="${k}">${p.i != null ? `<button type="button" class="linkish" data-bw="${p.i}">${esc(toks[p.i].w)}</button> ` : ''}${esc(bMsg(p, toks, jobs))}</li>`;
  let html = '';
  const good = !errs.length && !warns.length && r.grade && r.grade.ok && !asks.length;
  if (good) html += `<p class="cm-head">${esc(UI.bOk)}</p>`;
  else {
    const heads = [];
    if (errs.length) heads.push(errs.length === 1 ? UI.bErr1 : fmt(UI.bErrN, { n: errs.length }));
    if (warns.length) heads.push(warns.length === 1 ? UI.bWarn1 : fmt(UI.bWarnN, { n: warns.length }));
    if (heads.length) html += `<p class="cm-head">${esc(heads.join(' '))}</p>`;
    html += `<ul class="cm-list">${errs.map(p => item(p, 'err')).join('')}${warns.map(p => item(p, 'opt')).join('')}</ul>`;
  }
  html += `<h3 class="b-sub">${esc(UI.bMarksTitle)}</h3>`;
  if (!r.grade) html += `<p class="muted">${esc(UI.bMarksLater)}</p>`;
  else {
    const g = r.grade, q2 = (i, endq = '') => q(toks[i].w + endq);
    const nm = mk => MARK_NAME[mk] || 'comma';
    const lines = g.items.map(x => {
      const rule = COMMA[x.rule] || COMMA.none;
      if (x.k === 'missing') return ['err', fmt(UI.cmAdd, { m: nm(x.need), w: q2(x.i, '.') }), rule];
      if (x.k === 'wrong') return ['err', fmt(UI.cmSwap, { m: nm(x.need), w: q2(x.i), x: nm(x.got) }), rule];
      if (x.k === 'extra') return ['err', fmt(UI.cmRemove, { m: nm(x.got), w: q2(x.i, '.') }), rule];
      if (x.k === 'opt') return ['opt', fmt(UI.cmOpt, { m: nm(x.need), w: q2(x.i) }), rule];
      if (x.k === 'good') return ['ok', fmt(UI.cmGood, { m: nm(x.need), M: nm(x.need)[0].toUpperCase() + nm(x.need).slice(1), w: q2(x.i) }), rule];
      return ['ok', fmt(UI.cmNo, { w: q2(x.i) }), rule];
    });
    asks.forEach(y => lines.push(['opt', fmt(UI.bAsk, { a: toks[y - 1].w, b: toks[y].w }), COMMA.coord]));
    const n = g.bad.length;
    html += `<p class="cm-head">${esc(g.ok ? UI.cmAllOkSemi : n === 1 ? UI.cmFix1Semi : fmt(UI.cmFixNSemi, { n }))}</p>`;
    html += `<ul class="cm-list">${lines.map(([k, a, b]) => `<li class="${k}"><strong>${esc(a)}</strong> ${esc(b)}</li>`).join('')}</ul>`;
  }
  html += `<p class="hint">${esc(BS.answer ? UI.bAnswerNote : UI.bLimit)}</p>`;
  box.innerHTML = html;
  box.className = 'b-res fb ' + (good ? 'ok' : errs.length || (r.grade && !r.grade.ok) ? 'err' : 'warn');
}
/* The most likely word for a link, so that one tap is often enough. A word usually stands on one side
   of the word that it goes with; when no word fits on that side, there is no suggestion. */
function suggestLink(i, J, jobs) {
  const k = linkKind(J);
  if (!k) return null;
  const fits = jobs.map((T, x) => (x !== i && linkFits(k, T) ? x : -1)).filter(x => x >= 0);
  const after = fits.filter(x => x > i), before = fits.filter(x => x < i).reverse();
  const first = a => (a.length ? a[0] : null);
  const main = x => jobs[x] && (NOUNISH.has(jobs[x].j) || VERBISH.has(jobs[x].j));
  if (['ADJ', 'AUX', 'TO', 'SUB', 'NCI'].includes(J.j)) return first(after);
  if (['OP', 'AP', 'DO', 'IO', 'PN', 'PA', 'OC'].includes(J.j)) return first(before);
  if (J.j === 'S') return first(after) != null ? first(after) : first(before.filter(v => !jobs.some(T => T && T.j === 'S' && T.to === v)));
  if (J.j === 'PREP') return first(before.filter(main)) != null ? first(before.filter(main)) : first(after.filter(x => jobs[x].j === 'V'));
  if (J.j === 'V' && (J.cl === 'and' || J.cl === 'adj')) return first(before);
  if ((J.j === 'GER' || J.j === 'INF' || J.j === 'V') && (J.as === 'S')) return first(after);
  if (k === 'prep' || ((J.j === 'GER' || J.j === 'INF' || J.j === 'V') && ['DO', 'PN', 'OP'].includes(J.as))) return first(before);
  return [...fits].sort((a, b) => Math.abs(a - i) - Math.abs(b - i))[0] ?? null;
}
/* Words that had no word to go with get one when it appears (for example, "the" before its noun has a job). */
function autoFill(jobs, except) {
  return jobs.map((J, k) => {
    if (!J || k === except || J.to != null || !linkKind(J) || !['ADJ', 'AUX', 'TO', 'OP', 'S', 'DO', 'PN', 'PA'].includes(J.j)) return J;
    const to = suggestLink(k, J, jobs);
    return to == null ? J : Object.assign({}, J, { to });
  });
}
function defaultsFor(j, i, jobs, toks) {
  const J = { j, to: null };
  if (j === 'V') J.cl = 'main';
  if (j === 'GER') J.as = i > 0 && jobs[i - 1] && jobs[i - 1].j === 'PREP' ? 'OP' : jobs.slice(0, i).some(T => T && T.j === 'V') ? 'DO' : 'S';
  if (j === 'INF') J.as = 'DO';
  J.to = suggestLink(i, J, jobs);
  return J;
}
const bdlg = $('#bdlg');
let bdFrom = null;
function openJob(i, from) {
  BS.cur = i; BS.showJobs = !bJobs(bParse().toks.length)[i]; bdFrom = from || null;
  renderJobDlg();
  if (!bdlg.open) bdlg.showModal();
  const f = $('#bd-in [data-bj][aria-pressed="true"]') || $('#bd-in [data-bd="change"]') || $('#bd-in [data-bj]');
  if (f) f.focus();
}
function renderJobDlg(focusSel) {
  const i = BS.cur, ps = bParse(), toks = ps.toks, jobs = bJobs(toks.length), J = jobs[i];
  const a = Math.max(0, i - 3), b = Math.min(toks.length, i + 4);
  const ctx = toks.slice(a, b).map((t, k) => (a + k === i ? `<mark>${esc(t.w)}</mark>` : esc(t.w)) + esc(t.mark)).join(' ');
  const pick = (attr, val, label, on) => `<button type="button" class="chip bd-opt" data-bo="${attr}:${val}" aria-pressed="${!!on}">${esc(label)}</button>`;
  let body = '';
  if (J && !BS.showJobs) body += `<div class="bd-cur"><p><strong>${esc(jobName(J.j))}.</strong> ${esc(JOBS[J.j][1])}</p>
      <button type="button" class="btn quiet" data-bd="change">${esc(UI.bChangeJob)}</button></div>`;
  else body += JOB_GROUPS.map(([title, js]) => `<h3 class="bd-h3">${esc(title)}</h3><div class="bd-jobs">${js.map(j =>
      `<button type="button" class="chip bd-job" data-bj="${j}" aria-pressed="${!!(J && J.j === j)}">${esc(JOBS[j][0])}</button>`).join('')}</div>`).join('');
  if (J) {
    if (J.j === 'V') {
      body += `<h3 class="bd-h3">${esc(UI.bClauseQ)}</h3><div class="bd-jobs">${CLAUSE_KINDS.map(([v, l]) => pick('cl', v, l, (J.cl || 'main') === v)).join('')}</div>`;
      if (J.cl === 'noun') body += `<h3 class="bd-h3">${esc(UI.bSlotQ)}</h3><div class="bd-jobs">${SLOTS.map(([v, l]) => pick('as', v, l, J.as === v)).join('')}</div>`;
      if ((J.cl || 'main') === 'main') body += `<div class="bd-jobs">${pick('you', J.you ? 0 : 1, UI.bYou, J.you)}</div>`;
    }
    if (J.j === 'GER') body += `<h3 class="bd-h3">${esc(UI.bSlotQ)}</h3><div class="bd-jobs">${SLOTS.map(([v, l]) => pick('as', v, l, J.as === v)).join('')}</div>`;
    if (J.j === 'INF') body += `<h3 class="bd-h3">${esc(UI.bSlotQ)}</h3><div class="bd-jobs">${INF_USES.map(([v, l]) => pick('as', v, l, J.as === v)).join('')}</div>`;
    if (J.j === 'AP' || J.j === 'PART' || (J.j === 'V' && J.cl === 'adj')) {
      const ex = J.extra != null ? J.extra : defaultExtra(toks, jobs, i);
      body += `<h3 class="bd-h3">${esc(UI.bExtraQ)}</h3><div class="bd-jobs">${pick('extra', 1, UI.bExtraYes, ex)}${pick('extra', 0, UI.bExtraNo, !ex)}</div>`;
    }
    const prev = jobs[i - 1];
    if (J.j === 'ADJ' && prev && prev.j === 'ADJ' && prev.to === J.to && J.to != null && J.to > i
      && !B_DET.has(toks[i].w.toLowerCase()) && !B_DET.has(toks[i - 1].w.toLowerCase())) {
      const wd = k => (k === 0 ? toks[k].w.toLowerCase() : toks[k].w), ab = { a: wd(i - 1), b: wd(i), n: toks[J.to].w };   // the rule and the two tests with the words of the sentence
      const c = coordOf(toks, jobs, i);
      body += `<h3 class="bd-h3" id="bd-coord">${esc(fmt(UI.bCoordQ, ab))}</h3>
        <ul class="bd-tests">${['bCoordT1', 'bCoordT2', 'bCoordT4', 'bCoordT3'].map(k => `<li>${esc(fmt(UI[k], ab))}</li>`).join('')}</ul>
        <div class="bd-jobs" role="group" aria-labelledby="bd-coord">${pick('coord', 1, UI.bCoordYes, c === true)}${pick('coord', 0, UI.bCoordNo, c === false)}</div>`;
    }
    const k = linkKind(J);
    if (k) {
      const ask = J.j === 'V' ? (J.cl === 'noun' ? JOB_ASK['slot' + (J.as || 'DO')] : JOB_ASK[J.cl]) : J.j === 'GER' ? JOB_ASK['slot' + J.as]
        : J.j === 'INF' ? (J.as === 'adj' || J.as === 'adv' ? JOB_ASK['inf' + J.as] : JOB_ASK['slot' + J.as]) : JOB_ASK[J.j];
      body += `<h3 class="bd-h3" id="bd-ask">${esc(ask || UI.bSelectWord)}</h3><div class="bd-words" role="group" aria-labelledby="bd-ask">${toks.map((t, x) => x === i ? ''
        : `<button type="button" class="chip bd-w${linkFits(k, jobs[x]) ? ' fit' : ''}" data-bl="${x}" aria-pressed="${J.to === x}">${esc(t.w)}</button>`).join('')}</div>`;
    }
  }
  $('#bd-in').innerHTML = `<p class="dlg-word" id="bd-word">${esc(toks[i].w)}</p><p class="bd-ctx">${ctx}</p>${body}
    <div class="row bd-act"><button type="button" class="btn primary" data-bd="done">${esc(UI.bDone)}</button>
    ${J ? `<button type="button" class="btn" data-bd="remove">${esc(UI.bRemove)}</button>` : ''}</div>`;
  if (focusSel) { const el = $(focusSel, $('#bd-in')); if (el) el.focus(); }
}
function bChanged() {                        // after a change: save, redraw, and clear an old check
  BS.res = null; BS.answer = false; saveBld();
  renderWords(); renderBResult();
  if (bdlg.open) BS.dirty = true; else renderBDiagram();   // a long diagram takes time: draw it when the dialog closes
}
bdlg.addEventListener('click', e => {
  if (e.target === bdlg) { bdlg.close(); return; }
  const t = e.target.closest('[data-bj],[data-bl],[data-bo],[data-bd]');
  if (!t) return;
  const i = BS.cur, ps = bParse(), toks = ps.toks, jobs = bJobs(toks.length);
  let J = jobs[i] ? Object.assign({}, jobs[i]) : null, focus = null;
  if (t.dataset.bj) {
    if (!J || J.j !== t.dataset.bj) J = defaultsFor(t.dataset.bj, i, jobs, toks);
    BS.showJobs = false; focus = '[data-bl][aria-pressed="true"]';
  } else if (t.dataset.bl != null) { J.to = +t.dataset.bl; focus = `[data-bl="${t.dataset.bl}"]`; }
  else if (t.dataset.bo) {
    const [k, v] = t.dataset.bo.split(':');
    if (k === 'cl') { J.cl = v; if (v === 'noun' && !J.as) J.as = 'DO'; J.to = suggestLink(i, J, jobs); }
    else if (k === 'as') { J.as = v; J.to = suggestLink(i, J, jobs); }
    else if (k === 'extra') J.extra = v === '1';
    else if (k === 'you') J.you = v === '1';
    else if (k === 'coord') J.coord = v === '1';
    focus = `[data-bo="${t.dataset.bo}"]`;
  } else if (t.dataset.bd === 'done') { if (BS.dirty) { BS.dirty = false; renderBDiagram(); } bdlg.close(); return; }   // draw now, not after the close event
  else if (t.dataset.bd === 'change') { BS.showJobs = true; renderJobDlg('[data-bj][aria-pressed="true"]'); return; }
  else if (t.dataset.bd === 'remove') { J = null; BS.showJobs = true; focus = '[data-bj]'; }
  BLD.jobs = autoFill(toks.map((_, k) => (k === i ? J : jobs[k])), i);
  bChanged();
  renderJobDlg(focus);
});
bdlg.addEventListener('close', () => {
  if (BS.dirty && $('.build #pz-sheet')) renderBDiagram();
  BS.dirty = false;
  if (bdFrom && bdFrom.isConnected) bdFrom.focus({ preventScroll: true });
  bdFrom = null;
});
function onBuildAct(act) {
  if (act === 'start') {
    const text = $('#b-text').value, ps = parseSentence(text);
    const block = ps.probs.filter(p => BLOCKING.includes(p.code));
    if (block.length) {
      const fb = $('#b-fb');
      fb.className = 'fb err';
      fb.innerHTML = `<ul class="cm-list">${block.map(p => `<li class="err">${esc(bMsg(p, ps.toks, []))}</li>`).join('')}</ul>`;
      return;
    }
    const old = parseSentence(BLD.text).toks.map(t => t.w).join(' ');
    if (old !== ps.toks.map(t => t.w).join(' ')) BLD.jobs = [];
    if (BLD.key && SENT[BLD.key] && tokens(SENT[BLD.key].s).join(' ') !== ps.toks.map(t => t.w).join(' ')) BLD.key = null;
    BLD.text = text.replace(/\s+/g, ' ').trim(); BLD.started = true; BS.res = null; saveBld();
    renderBuild();
    const w = $('#b-words .bw'); if (w) w.focus();
  } else if (act === 'example') {
    const keys = LESSONS.flatMap(l => l.practice).filter(k => k !== BLD.key);
    const key = keys[Math.floor(Math.random() * keys.length)];
    BLD = { text: SENT[key].s, jobs: [], started: true, key }; BS.res = null; saveBld();
    renderBuild();
    const w = $('#b-words .bw'); if (w) w.focus();
  } else if (act === 'edit') { BLD.started = false; saveBld(); renderBuild(); const ta = $('#b-text'); if (ta) ta.focus(); }
  else if (act === 'clear') { BLD.jobs = []; bChanged(); }
  else if (act === 'check') {
    BS.res = checkBuild(BLD.text, bJobs(bParse().toks.length)); BS.answer = false;
    renderWords(); renderBResult();
    $('#b-fb').focus && $('#b-fb').scrollIntoView({ block: 'nearest' });
  } else if (act === 'answer') {
    const r = jobsFromSpec(SENT[BLD.key]);
    if (!r) return;
    BLD.jobs = r.jobs; saveBld();
    BS.res = checkBuild(BLD.text, bJobs(bParse().toks.length)); BS.answer = true;
    renderWords(); renderBDiagram(); renderBResult();
  }
}


/* ---------- flash cards ---------- */
const FC_STORE = 'baseline-cards-v1';
let FCS = { known: [], deck: 'terms', upTo: 0, first: 'term' };
try {
  const v = JSON.parse(localStorage.getItem(FC_STORE) || 'null');
  if (v && typeof v === 'object') FCS = { known: Array.isArray(v.known) ? v.known : [], deck: CARD_DECKS.some(([k]) => k === v.deck) ? v.deck : 'terms',
    upTo: Number.isInteger(v.upTo) ? v.upTo : 0, first: v.first === 'def' ? 'def' : 'term' };
} catch (e) { /* storage blocked */ }
function saveFc() { try { localStorage.setItem(FC_STORE, JSON.stringify(FCS)); } catch (e) { /* storage blocked */ } }
let FC = null, ALL_CARDS = null;
/* All cards, each with the first lesson that teaches it. */
function allCards() {
  if (ALL_CARDS) return ALL_CARDS;
  const termLesson = {};
  LESSONS.forEach((l, i) => l.body.forEach(b => [b.p, ...(b.ol || []), ...(b.ul || [])].filter(Boolean).forEach(t =>
    (t.match(/\[\[[^\]]+\]\]/g) || []).forEach(m => {
      const k = m.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/, (_, a, b2) => b2 || a);
      if (!(k in termLesson)) termLesson[k] = i + 1;
    }))));
  const lessonOf = new Map();                // sentence -> the first lesson that shows it
  LESSONS.forEach((l, i) => { l.body.forEach(b => { if (b.ex && !lessonOf.has(b.ex)) lessonOf.set(b.ex, i + 1); });
    l.practice.forEach(k => { if (!lessonOf.has(k)) lessonOf.set(k, i + 1); }); });
  const firstLesson = pred => { let best = 99; lessonOf.forEach((L, k) => { if (L < best && pred(SENT[k])) best = L; }); return best; };
  const roles = sp => new Set(wordsOf(sp).map(n => n.role));
  const LINE_TEST = { base: () => true, sv: () => true, you: sp => roles(sp).has('SU'),
    mod: sp => ['ADJ', 'ADV', 'ART', 'POS'].some(r => roles(sp).has(r)), hook: sp => wordsOf(sp).some(n => n.kind === 'mod' && n.parent && n.parent.kind === 'mod'),
    do: sp => roles(sp).has('DO'), cl: sp => roles(sp).has('PN') || roles(sp).has('PA'), prep: sp => roles(sp).has('PREP'),
    io: sp => roles(sp).has('IO'), conj: sp => roles(sp).has('CONJ'), clause: sp => !!sp.clauses };
  const cards = [];
  Object.entries(TERMS).forEach(([k, [term, def]]) => cards.push({ id: 't:' + k, deck: 'terms', lesson: termLesson[k] || 99, term, def }));
  KEY.forEach(k => cards.push({ id: 'l:' + k.icon, deck: 'lines', lesson: LINE_TEST[k.icon] ? firstLesson(LINE_TEST[k.icon]) : 1, term: k.name, def: k.text, pic: ICON[k.icon] }));
  Object.entries(COMMA_NAMES).forEach(([rule, name]) => {   // the example is the shortest sentence of the app with the rule
    let ex = null;
    Object.entries(SENT).forEach(([key, sp]) => {
      const cm = Object.entries(sp.cm || {}).find(([, r]) => r.replace('?', '') === rule);
      const tr = !cm && Object.entries(sp.trap || {}).find(([, r]) => r === rule);
      const hit = cm || tr;
      if (hit && (!ex || sp.s.length < ex.s.length)) ex = { s: sp.s, w: hit[0], trap: !cm };
    });
    const lesson = firstLesson(sp => Object.values(sp.cm || {}).some(r => r.replace('?', '') === rule) || Object.values(sp.trap || {}).includes(rule));
    cards.push({ id: 'c:' + rule, deck: 'commas', lesson, term: name, def: COMMA[rule], ex });
  });
  return (ALL_CARDS = cards);
}
function exampleHtml(ex) {                   // the word before the place in bold, the mark highlighted
  const m = ex.w.match(/^(.*?)(?:#(\d+))?$/), nth = +(m[2] || 1);
  let c = 0;
  return ex.s.split(/\s+/).map(raw => {
    const w = tokens(raw)[0];
    if (w !== m[1] || ++c !== nth) return esc(raw);
    const mm = raw.match(/^(.*?)([,;]?)([.?!]*)$/);
    return ex.trap ? `<strong>${esc(mm[1])}</strong>${esc(mm[2] + mm[3])}` : `<strong>${esc(mm[1])}<mark>${esc(mm[2])}</mark></strong>${esc(mm[3])}`;
  }).join(' ');
}
const fcCards = () => allCards().filter(c => (FCS.deck === 'all' || c.deck === FCS.deck) && (!FCS.upTo || c.lesson <= FCS.upTo));

function viewCards() {
  document.title = 'Flash cards – Baseline';
  app.innerHTML = `
    <section class="cards">
      <h1 tabindex="-1">${esc(UI.fcTitle)}</h1>
      <p class="lede">${esc(UI.fcIntro)}</p>
      <div class="fc-opts">
        <div class="bd-jobs" role="group" aria-label="${esc(UI.fcDeck)}">${CARD_DECKS.map(([k, l]) =>
          `<button type="button" class="chip" data-fcdeck="${k}" aria-pressed="${FCS.deck === k}">${esc(l)}</button>`).join('')}</div>
        <div class="fc-row">
          <label class="field fc-field"><span>${esc(UI.fcLessons)}</span><select id="fc-upto">${[0, ...LESSONS.map((_, i) => i + 1)].map(n =>
            `<option value="${n}"${FCS.upTo === n ? ' selected' : ''}>${esc(n ? fmt(UI.fcUpTo, { n }) : UI.fcAllLessons)}</option>`).join('')}</select></label>
          <div class="field fc-field"><span id="fc-first-l">${esc(UI.fcFirst)}</span><div class="bd-jobs" role="group" aria-labelledby="fc-first-l">${[['term', UI.fcFirstTerm], ['def', UI.fcFirstDef]].map(([v, l]) =>
            `<button type="button" class="chip" data-fcfirst="${v}" aria-pressed="${FCS.first === v}">${esc(l)}</button>`).join('')}</div></div>
        </div>
      </div>
      <div id="fc-main"></div>
      <details class="fc-all"><summary>${esc(UI.fcList)}</summary><dl id="fc-list"></dl></details>
      <p class="muted">${esc(UI.fcSaved)}</p>
    </section>`;
  fcStart(false);
}
function fcStart(shuffle) {
  const cards = fcCards(), known = new Set(FCS.known), round = cards.filter(c => !known.has(c.id)).map(c => c.id);
  if (shuffle) for (let i = round.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [round[i], round[j]] = [round[j], round[i]]; }
  FC = { cards, round, flipped: false };
  renderFc(); renderFcList();
}
function fcFace(c, side, front) {           // side: 'term' or 'def'; front: this side shows first
  if (side === 'term') {
    if (c.deck === 'lines') return `<span class="fc-pic" aria-hidden="true">${c.pic}</span>${front ? `<span class="fc-q">${esc(UI.fcLineQ)}</span>` : `<span class="fc-term">${esc(c.term)}</span>`}`;
    return `<span class="fc-term">${esc(c.term)}</span>${c.deck === 'commas' && front ? `<span class="fc-q">${esc(UI.fcCommaQ)}</span>` : ''}`;
  }
  let h = '';
  if (c.deck === 'lines' && !front) h += `<span class="fc-pic fc-pic-m" aria-hidden="true">${c.pic}</span><span class="fc-term fc-small">${esc(c.term)}</span>`;
  h += `<span class="fc-def">${esc(c.def)}</span>`;
  if (c.ex && !front) h += `<span class="fc-ex"><span class="fc-exl">${esc(UI.fcExample)}</span> ${exampleHtml(c.ex)}</span>`
    + (c.ex.trap ? `<span class="fc-ex">${esc(fmt(UI.fcNoAfter, { w: c.ex.w.replace(/#\d+$/, '') }))}</span>` : '');
  return h;
}
function renderFc(focus) {
  const box = $('#fc-main'), known = new Set(FCS.known), t = FC.cards.length, k = FC.cards.filter(c => known.has(c.id)).length;
  if (!t) { box.innerHTML = `<p class="hint">${esc(UI.fcEmpty)}</p>`; return; }
  if (!FC.round.length) {
    box.innerHTML = `<p class="fb ok" role="status">${esc(fmt(UI.fcDone, { n: t }))}</p>
      <div class="actions"><button type="button" class="btn primary" data-fc="restart">${esc(UI.fcRestart)}</button></div>`;
    if (focus) $('[data-fc="restart"]').focus();
    return;
  }
  const c = FC.cards.find(x => x.id === FC.round[0]), first = FCS.first, second = first === 'term' ? 'def' : 'term';
  box.innerHTML = `
    <div class="fc-wrap"><button type="button" class="fc" id="fc-card" data-fc="flip" aria-describedby="fc-hint">
      <span class="fc-face fc-front">${fcFace(c, first, true)}</span>
      <span class="fc-face fc-back">${fcFace(c, second, false)}</span>
    </button></div>
    <p class="fc-count">${esc(fmt(UI.fcCount, { i: 1, n: FC.round.length, k, t }))}</p>
    <div class="actions" id="fc-acts"></div>
    <p class="hint" id="fc-hint">${esc(UI.fcHint)}</p>
    <p class="sr" id="fc-live" aria-live="polite"></p>`;
  renderFcActs();
  if (focus) $('#fc-card').focus({ preventScroll: true });
}
function renderFcActs() {
  $('#fc-acts').innerHTML = FC.flipped
    ? `<button type="button" class="btn primary" data-fc="knew">${esc(UI.fcKnew)}</button><button type="button" class="btn" data-fc="again">${esc(UI.fcAgain)}</button>`
    : `<button type="button" class="btn primary" data-fc="flip">${esc(UI.fcTurn)}</button><button type="button" class="btn" data-fc="shuffle">${esc(UI.fcShuffle)}</button>`;
}
function renderFcList() {
  const known = new Set(FCS.known);
  $('#fc-list').innerHTML = FC.cards.map(c => `<div class="fc-item"><dt>${c.pic ? `<span class="fc-pic fc-pic-s" aria-hidden="true">${c.pic}</span>` : ''}${esc(c.term)}${known.has(c.id) ? ` <span class="fc-known">${esc(UI.fcKnown)}</span>` : ''}</dt>
    <dd>${esc(c.def)}${c.ex ? `<br><span class="fc-exl">${esc(UI.fcExample)}</span> ${exampleHtml(c.ex)}` : ''}</dd></div>`).join('');
}
function onFc(act) {
  const id = FC.round[0];
  if (act === 'flip') {
    FC.flipped = !FC.flipped;
    $('#fc-card').classList.toggle('flipped', FC.flipped);
    const face = $(FC.flipped ? '#fc-card .fc-back' : '#fc-card .fc-front');
    $('#fc-live').textContent = face ? face.textContent : '';
    renderFcActs();
    if (document.activeElement && document.activeElement.closest('#fc-acts')) $('#fc-acts .btn').focus();
  } else if (act === 'knew') {
    if (!FCS.known.includes(id)) FCS.known.push(id);
    saveFc(); FC.round.shift(); FC.flipped = false; renderFc(true); renderFcList();
  } else if (act === 'again') { FC.round.push(FC.round.shift()); FC.flipped = false; renderFc(true); }
  else if (act === 'shuffle') { fcStart(true); $('#fc-card') && $('#fc-card').focus({ preventScroll: true }); }
  else if (act === 'restart') {
    const ids = new Set(FC.cards.map(c => c.id));
    FCS.known = FCS.known.filter(x => !ids.has(x)); saveFc(); fcStart(false);
    if ($('#fc-card')) $('#fc-card').focus({ preventScroll: true });
  }
}

/* ---------- reset progress (two-step button) ---------- */
let resetArmed = 0;
function onReset(btn) {
  const fb = $('#reset-fb');
  if (Date.now() - resetArmed > 4000) {
    resetArmed = Date.now();
    btn.textContent = UI.resetConfirm;
    setTimeout(() => { if (btn.isConnected && Date.now() - resetArmed >= 4000) btn.textContent = UI.reset; }, 4100);
    return;
  }
  resetArmed = 0;
  done = new Set(); saveDone();
  chState = {}; saveCh();
  BLD = { text: '', jobs: [], started: false, key: null }; saveBld();
  FCS.known = []; saveFc();
  btn.textContent = UI.reset;
  fb.className = 'fb ok';
  fb.textContent = UI.resetDone;
}

/* ---------- events ---------- */
let pan = null, panned = false;            // a mouse can drag a large diagram (touch scrolls it anyway)
app.addEventListener('pointerdown', e => {
  const sheet = e.target.closest && e.target.closest('.sheet.big');
  if (sheet && e.pointerType === 'mouse' && e.button === 0) pan = { sheet, x: e.clientX, y: e.clientY, sl: sheet.scrollLeft, st: sheet.scrollTop, moved: false };
});
window.addEventListener('pointermove', e => {
  if (!pan) return;
  const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
  if (!pan.moved && Math.hypot(dx, dy) < 6) return;
  pan.moved = true; pan.sheet.classList.add('panning');
  pan.sheet.scrollLeft = pan.sl - dx; pan.sheet.scrollTop = pan.st - dy;
});
window.addEventListener('pointerup', () => {
  if (pan && pan.moved) { pan.sheet.classList.remove('panning'); panned = true; setTimeout(() => { panned = false; }, 0); }
  pan = null;
});
app.addEventListener('click', e => {
  if (panned) { e.preventDefault(); return; }
  const z = e.target.closest('[data-zoom]');
  if (z) { zoomSheet($('#pz-sheet'), z.dataset.zoom); return; }
  const fc = e.target.closest('[data-fc],[data-fcdeck],[data-fcfirst]');
  if (fc && app.contains(fc)) {
    if (fc.dataset.fc) onFc(fc.dataset.fc);
    else {
      if (fc.dataset.fcdeck) FCS.deck = fc.dataset.fcdeck; else FCS.first = fc.dataset.fcfirst;
      saveFc();
      document.querySelectorAll('[data-fcdeck]').forEach(b => b.setAttribute('aria-pressed', b.dataset.fcdeck === FCS.deck));
      document.querySelectorAll('[data-fcfirst]').forEach(b => b.setAttribute('aria-pressed', b.dataset.fcfirst === FCS.first));
      fcStart(false);
    }
    return;
  }
  const bt = e.target.closest('[data-bact],[data-bw]');
  if (bt && app.contains(bt)) { if (bt.dataset.bact) onBuildAct(bt.dataset.bact); else openJob(+bt.dataset.bw, bt); return; }
  const bp = e.target.closest('.build .part.w');
  if (bp) { const lay = DG.get(bp.closest('svg').dataset.dg), nd = lay && lay.words[+bp.dataset.i].n; if (nd && nd.tok != null) openJob(nd.tok, bp); return; }
  const t = e.target.closest('[data-term],[data-chip],[data-cw],[data-act],[data-reset],.part');
  if (!t || !app.contains(t)) return;
  if (t.dataset.term) onTerm(t);
  else if (t.dataset.chip != null) onChip(+t.dataset.chip);
  else if (t.dataset.cw != null) onCommaWord(+t.dataset.cw);
  else if (t.dataset.act) onAct(t.dataset.act);
  else if (t.hasAttribute('data-reset')) onReset(t);
  else if (t.classList.contains('slot')) onSlot(+t.dataset.s);
  else onPart(t);
});
app.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.part')) {
    e.preventDefault();
    if (e.target.classList.contains('slot')) onSlot(+e.target.dataset.s);
    else if (e.target.closest('.build') && e.target.classList.contains('w')) e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    else onPart(e.target);
  }
});
app.addEventListener('change', e => {
  if (e.target.id === 'fc-upto') { FCS.upTo = +e.target.value; saveFc(); fcStart(false); return; }
  if (e.target.id === 'pz-lesson') location.hash = `#/practice/${e.target.value}/1`;
});

/* ---------- router ---------- */
let firstRoute = true;
function route() {
  const [v, a, b] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let nav = 'lessons';
  if (v === 'lesson' && LESSONS[+a - 1]) viewLesson(+a);
  else if (v === 'practice') { nav = 'practice'; viewPractice(+a || firstOpenLesson(), +b || 0); }
  else if (v === 'guide') { nav = 'guide'; viewGuide(); }
  else if (v === 'challenges') { nav = 'challenges'; viewChallenges(); }
  else if (v === 'challenge') { nav = 'challenges'; viewChallenge(+a || 1); }
  else if (v === 'build') { nav = 'build'; viewBuild(); }
  else if (v === 'cards') { nav = 'cards'; viewCards(); }
  else viewHome();
  setNav(nav);
  if (dlg.open) dlg.close();
  if (bdlg.open) bdlg.close();
  if (!firstRoute) { window.scrollTo(0, 0); const h = $('h1', app); if (h) h.focus({ preventScroll: true }); }
  firstRoute = false;
}
window.addEventListener('hashchange', route);

/* ---------- test hooks ---------- */
function steTexts() {
  const out = [];
  const add = (kind, text, src) => out.push({ kind, text: plain(text), src });
  LESSONS.forEach((l, i) => {
    add('label', l.title, `lesson ${i + 1} title`);
    add('descriptive', l.blurb, `lesson ${i + 1} blurb`);
    l.body.forEach(b => {
      if (b.p) add('descriptive', b.p, `lesson ${i + 1}`);
      if (b.ol) b.ol.forEach(s => add('procedure', s, `lesson ${i + 1} steps`));
      if (b.ul) b.ul.forEach(s => add('procedure', s, `lesson ${i + 1} rules`));
    });
  });
  Object.entries(ROLE).forEach(([k, r]) => r.text.forEach(t => add('descriptive', t, `role ${k}`)));
  Object.entries(LINES).forEach(([k, r]) => r.text.forEach(t => add('descriptive', t, `line ${k}`)));
  Object.entries(TERMS).forEach(([k, t]) => add('descriptive', t[1], `term ${k}`));
  GUIDE_STEPS.forEach(s => add('procedure', s, 'guide steps'));
  KEY.forEach(k => add('descriptive', k.text, `key ${k.name}`));
  ABOUT.forEach(s => add('descriptive', s, 'about'));
  Object.entries(TIPS).forEach(([k, s]) => add('procedure', s, `tip ${k}`));
  Object.entries(COMMA).forEach(([k, s]) => add('procedure', s, `comma ${k}`));
  GUIDE_COMMAS.forEach(s => add('procedure', s, 'guide commas'));
  Object.entries(UI).forEach(([k, s]) => [].concat(s).forEach(t => add(/^(fb|homeIntro|howTo|exampleHint|progressNote|resetDone|cm|commasIntro|ch(Fb|HowTo|Rules|Scroll|All|Home|Intro|NoStars)|b(Intro|Limit|EditNote|WordsHint|NoDiagram|Ok|MarksLater|Ask|Saved|AnswerNote|HomeText)|fc(Intro|Hint|Saved|Done|Empty|HomeText|NoAfter))/.test(k) ? 'procedure' : 'label', t, `ui ${k}`)));
  TIERS.forEach(t => add('label', t, 'tier'));
  Object.entries(JOBS).forEach(([k, [nm, d]]) => { add('label', nm, `job ${k}`); add('descriptive', d, `job ${k}`); });
  JOB_GROUPS.forEach(([t]) => add('label', t, 'job group'));
  Object.entries(JOB_ASK).forEach(([k, t]) => add('procedure', t, `ask ${k}`));
  [...CLAUSE_KINDS, ...SLOTS, ...INF_USES].forEach(([, t]) => add('label', t, 'option'));
  Object.values(JOB_TAG).forEach(t => add('label', t, 'job tag'));
  CARD_DECKS.forEach(([, t]) => add('label', t, 'deck'));
  Object.entries(COMMA_NAMES).forEach(([k, t]) => add('label', t, `comma name ${k}`));
  Object.entries(JOB_NEED).forEach(([k, t]) => add('descriptive', t, `need ${k}`));
  Object.entries(B_MSG).forEach(([k, t]) => add('procedure', t, `msg ${k}`));
  Object.entries(SENT).forEach(([k, sp]) => { if (sp.ctx) add('descriptive', sp.ctx, `ctx ${k}`); });
  Object.keys(SENT).forEach(key => wordsOf(SENT[key]).forEach(n => { const d = dynLine(n); if (d) add('descriptive', d, `dyn ${key}/${n.w}`); }));
  return out;
}
window.BASELINE = { G, SENT, LESSONS, ROLE, LINES, TERMS, UI, TIPS, COMMA, commaInfo, gradeCommas, layout, getLayout, svgFor, annotate, wordsOf, tokens, validate,
  textW, hitPoly, boxPoly, segPoly, explainWord, dynLine, steTexts, state: () => PZ, CHALLENGES, TIERS, chStore: () => chState,
  parseSentence, specFromJobs, jobsFromSpec, canonSpec, commaRules, gradeMarks, bGraph, checkBuild, allCards, cardStore: () => FCS,
  VERSION: APP_VERSION };

/* ---------- start ---------- */
(async function boot() {
  Object.entries(SENT).forEach(([k, sp]) => { const errs = validate(sp); if (errs.length) console.error(`Sentence "${k}":`, errs.join('; ')); });
  try { if (document.fonts) await Promise.race([document.fonts.load('500 18px AHN'), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* use fallback font */ }
  route();
  document.documentElement.classList.add('ready');
})();
