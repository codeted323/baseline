'use strict';
/* ===============================================================
   Builder (step 3): the user types a sentence and gives each word a job
   and a link ("goes with"). This file turns the jobs into a diagram spec,
   finds the comma rules from that structure, and checks the work with
   built-in rules. It cannot know the meaning that the user intends.

   A job: { j, to, cl, as, extra, you, coord }
     j      job code (see JOBS in data.js)
     to     index of the word it goes with (null when the job has no link)
     cl     verb only: 'main' | 'and' (same subject) | 'adj' | 'adv' | 'noun' clause
     as     slot of a noun clause, gerund or infinitive: 'S' 'DO' 'PN' 'OP' 'AP'; infinitive also 'adj' 'adv'
     extra  appositive, participle, adjective clause: true = extra information (commas)
     you    verb only: a command with the understood subject (you)
     coord  adjective only: a comma between it and the adjective before it (true) or not (false). The
            user's answer; without one, coordOf() decides for known shape, age, color, origin, material,
            and type words, and asks about the others
   =============================================================== */

const B_WL = s => new Set(s.split(' '));
const B_ART = B_WL('a an the');
/* Words that come first before a noun and never take a comma after them ("little" is not here: in
   "the little red car" it is an adjective of size). */
const B_DET =B_WL('a an the this that these those my your his her its our their whose all any both each either every few many more most much neither no other several some such another enough less one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred thousand first second third last next');
/* Adjectives that tell shape, age, color, material, or type join with the words after them into one unit
   ("red car"), so no comma goes before them after a different adjective ("the little red car"). A capital
   letter inside the sentence marks an origin word ("an expensive Italian car"). Most type words are nouns, an
   open group: the builder asks about the ones that are not here. Two words of one group ("red, white") can
   take a comma. Sources: Quirk et al. 1985 (premodifier zones), Feist 2011, lesson 2. */
const B_FACT = {
  shape: B_WL('round square flat oval circular triangular rectangular straight curved'),
  age: B_WL('old new young ancient modern antique elderly teenage'),
  color: B_WL('red orange yellow green blue purple pink brown black white gray grey golden silver maroon scarlet crimson violet'),
  material: B_WL('wooden wood stone brick brass iron steel gold silk cotton wool woolen leather plastic glass paper metal copper marble'),
  type: B_WL('summer winter spring autumn morning evening night kitchen school front back garden'),
};
function bFactGroup(toks, i) {
  const w = toks[i].w, lw = w.toLowerCase();
  for (const [g, set] of Object.entries(B_FACT)) if (set.has(lw)) return g;
  return i > 0 && /^[A-Z][a-z]/.test(w) ? 'origin' : null;
}
/* Comma between adjective y and the adjective before it: the user's answer, else none before a shape, age,
   color, origin, material, or type word (a comma between two words of one group); null = ask the user. */
function coordOf(toks, jobs, y) {
  if (jobs[y].coord != null) return jobs[y].coord;
  const g = bFactGroup(toks, y);
  if (!g) return null;
  return g === bFactGroup(toks, y - 1);
}
const B_SUBJ_PRON = B_WL('i he she we they who whoever');
const B_OBJ_PRON = B_WL('me him us them whom whomever');
const B_PRON_PAIR = { i: 'me', he: 'him', she: 'her', we: 'us', they: 'them', who: 'whom', whoever: 'whomever',
  me: 'I', him: 'he', us: 'we', them: 'they', whom: 'who', whomever: 'whoever' };
const B_HELP = B_WL('am is are was were be been being have has had having do does did will would shall should may might must can could');
const B_BE = B_WL('am is are was were be been being');
const B_LINKV = B_WL('seem seems seemed become becomes became appear appears appeared feel feels felt look looks looked sound sounds sounded taste tastes tasted smell smells smelled grow grows grew grown remain remains remained stay stays stayed turn turns turned get gets got prove proves proved keep keeps kept fall falls fell fallen go goes went come comes came');
const B_PREP = B_WL('aboard about above across after against along amid among around as at before behind below beneath beside besides between beyond but by concerning despite down during except for from in inside into like near of off on onto opposite out outside over past per regarding round since than through throughout till to toward towards under underneath unlike until unto up upon via with within without');
const B_CONJ = B_WL('and but or nor for so yet');
const B_SUB = B_WL('after although as because before if lest once since so than though till unless until when whenever where whereas wherever whether while');
const B_REL = B_WL('who whom which that');
const B_CADV = B_WL('however therefore moreover nevertheless nonetheless consequently furthermore thus hence instead otherwise meanwhile accordingly indeed');
const B_FOCUS = B_WL('only even just also almost nearly especially mainly mostly merely simply too');
const B_CONTRA = /n't$|'(m|re|ve|ll|d)$/i;
const B_CONTRA_S = B_WL("it's he's she's that's there's here's what's who's where's let's how's when's why's");

/* Jobs: which word a job goes with. */
const NOUNISH = new Set(['S', 'DO', 'IO', 'PN', 'OP', 'AP', 'OC', 'ADDR', 'ABS']);
const VERBISH = new Set(['V', 'PART', 'GER', 'INF']);
const J_LINK = {
  S: 'verb', AUX: 'verbal', DO: 'verbal', IO: 'verbal', PN: 'verbal', PA: 'verbal', OC: 'verbal',
  ADJ: 'noun', ADV: 'mod', PREP: 'any', OP: 'prep', AP: 'noun', PART: 'noun', TO: 'inf', SUB: 'advcl', NCI: 'nouncl',
};
function linkKind(J) {                       // what a job goes with, or null when it has no link
  if (!J) return null;
  if (J.j === 'V') return { main: null, and: 'verb', adj: 'noun', adv: 'mod', noun: J.as === 'OP' ? 'prep' : J.as === 'AP' ? 'noun' : 'verbal' }[J.cl || 'main'];
  if (J.j === 'GER') return J.as === 'OP' ? 'prep' : J.as === 'AP' ? 'noun' : 'verbal';
  if (J.j === 'INF') return J.as === 'adj' ? 'noun' : J.as === 'adv' ? 'mod' : J.as === 'OP' ? 'prep' : 'verbal';
  return J_LINK[J.j] || null;
}
/* Does word t (with job T) fit as the target of a link of kind k? */
function linkFits(k, T) {
  if (!T) return false;
  const nounish = NOUNISH.has(T.j) || (T.j === 'GER');
  switch (k) {
    case 'verb': return T.j === 'V';
    case 'verbal': return VERBISH.has(T.j);
    case 'noun': return nounish;
    case 'mod': return VERBISH.has(T.j) || ['ADJ', 'ADV', 'PA', 'OC'].includes(T.j);
    case 'any': return nounish || VERBISH.has(T.j) || ['ADJ', 'ADV', 'PA', 'OC'].includes(T.j);
    case 'prep': return T.j === 'PREP';
    case 'inf': return T.j === 'INF';
    case 'advcl': return T.j === 'V' && T.cl === 'adv';
    case 'nouncl': return T.j === 'V' && T.cl === 'noun';
    default: return false;
  }
}

/* ---------- the user's sentence ---------- */
function parseSentence(text) {
  const res = { toks: [], end: '', probs: [] };
  const t = String(text || '').replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
  if (!t) { res.probs.push({ code: 'empty' }); return res; }
  if (/["“”:()[\]{}–—/&*]|--/.test(t)) res.probs.push({ code: 'chars' });
  const parts = t.split(' ');
  parts.forEach((r, i) => {
    const last = i === parts.length - 1;
    const m = r.match(/^(.*?)([,;.?!]*)$/), marks = m[2];
    const w = tokens(m[1])[0];
    if (!w) { res.probs.push({ code: 'marks', w: r }); return; }
    if (B_CONTRA.test(w) || B_CONTRA_S.has(w.toLowerCase())) res.probs.push({ code: 'contraction', w });
    let mark = '';
    if (last) {
      const e = marks.match(/[.?!]+$/);
      res.end = e ? e[0][0] : '';
      const before = e ? marks.slice(0, -e[0].length) : marks;
      if (before) res.probs.push({ code: 'marks', w: r });
    } else if (marks === ',' || marks === ';') mark = marks;
    else if (/[.?!]/.test(marks)) res.probs.push({ code: 'one', w: r });
    else if (marks) res.probs.push({ code: 'marks', w: r });
    res.toks.push({ w, mark });
  });
  if (!res.end && res.toks.length) res.probs.push({ code: 'end' });
  if (res.toks.length < 1) res.probs.push({ code: 'short' });
  if (res.toks.length > 120) res.probs.push({ code: 'long' });
  return res;
}
const sentenceOf = (toks, end) => toks.map(t => t.w).join(' ') + (end || '.');   // without commas: the builder checks them itself

/* ---------- links as a tree ---------- */
function bGraph(toks, jobs) {
  const n = toks.length, kids = Array.from({ length: n }, () => []);
  jobs.forEach((J, i) => { if (J && J.to != null && J.to >= 0 && J.to < n && J.to !== i && jobs[J.to] && linkKind(J)) kids[J.to].push(i); });
  kids.forEach(k => k.sort((a, b) => a - b));
  const memo = new Map();
  const subtree = i => {
    if (memo.has(i)) return memo.get(i);
    const seen = new Set([i]), st = [i];
    while (st.length) { const x = st.pop(); for (const k of kids[x]) if (!seen.has(k)) { seen.add(k); st.push(k); } }
    memo.set(i, seen);
    return seen;
  };
  const span = i => { let a = Infinity, b = -Infinity; subtree(i).forEach(x => { if (x < a) a = x; if (x > b) b = x; }); return [a, b]; };
  const cyc = new Set();                     // words whose links go in a circle
  jobs.forEach((J, i) => {
    const path = [];
    for (let x = i, guard = 0; x != null && guard <= n; guard++) {
      if (path.includes(x)) { if (x === i) cyc.add(i); break; }
      path.push(x);
      const Jx = jobs[x];
      x = Jx && linkKind(Jx) && Jx.to != null && jobs[Jx.to] ? Jx.to : null;
    }
  });
  return { n, kids, subtree, span, cyc };
}

const isClauseVerb = J => J && J.j === 'V' && (J.cl || 'main') !== 'and';
const isSlot = (J, slot) => J && (J.j === slot || ((J.j === 'GER' || J.j === 'INF' || (J.j === 'V' && J.cl === 'noun')) && J.as === slot));

/* ---------- jobs -> spec ---------- */
/* Returns { spec, used, probs, groups }. spec is null when there is no main verb. Words that have no
   place yet are left out; missing parts show as "?" (opt.draft) so that the diagram can grow. */
function specFromJobs(toks, jobs, end, opt = {}) {
  const g = bGraph(toks, jobs), { kids } = g, n = toks.length;
  const J = i => jobs[i];
  const W_ = i => toks[i].w;
  const used = new Set(), probs = [];
  const P = (code, i, x) => probs.push(Object.assign({ code, i }, x || {}));
  const kidsOf = (i, pred) => kids[i].filter(k => pred(J(k)));
  const ph = () => ({ w: '?', mods: [], understood: true, ph: true });   // a missing part (draft only)
  const andVerbs = v => { const out = []; const walk = x => kidsOf(x, K => K.j === 'V' && K.cl === 'and').forEach(k => { out.push(k); walk(k); }); walk(v); return out; };
  const clauseTokens = v => {               // the words of the clause of v, without the clauses inside it
    const seen = new Set([v]), st = [v];
    while (st.length) { const x = st.pop(); for (const k of kids[x]) if (!seen.has(k) && !isClauseVerb(J(k))) { seen.add(k); st.push(k); } }
    return seen;
  };
  // relative pronoun of each adjective clause: the first who, whom, which or that in a noun slot of its clause
  const rel = new Map();
  jobs.forEach((Jv, v) => {
    if (!(Jv && Jv.j === 'V' && Jv.cl === 'adj')) return;
    const c = [...clauseTokens(v)].sort((a, b) => a - b)
      .find(k => ['S', 'DO', 'OP', 'PN'].includes(J(k).j) && B_REL.has(W_(k).toLowerCase()));
    if (c != null) rel.set(c, v); else P('noRel', v);
  });

  // ---- groups of words that share a slot (compound parts), and the main clauses
  const groups = [];                         // { key, owner, items, conj, kind: 'comp' | 'join' }
  const slotKey = K => {
    if (!K) return null;
    if (K.j === 'V') return K.cl === 'and' ? 'VERB' : K.cl === 'noun' ? K.as : null;
    if (K.j === 'GER' || (K.j === 'INF' && !['adj', 'adv'].includes(K.as))) return K.as;
    if (['S', 'DO', 'IO', 'PN', 'PA', 'OC', 'OP', 'AP'].includes(K.j)) return K.j;
    return null;
  };
  for (let o = 0; o < n; o++) {
    const by = new Map();
    kids[o].forEach(k => { const key = slotKey(J(k)); if (key && key !== 'VERB') { if (!by.has(key)) by.set(key, []); by.get(key).push(k); } });
    if (J(o) && isClauseVerb(J(o))) { const vs = [o, ...andVerbs(o)].sort((a, b) => a - b); if (vs.length > 1) by.set('VERB', vs); }
    by.forEach((items, key) => { if (items.length > 1) groups.push({ key, owner: o, items: items.sort((a, b) => a - b), kind: 'comp' }); });
  }
  const mains = [];
  jobs.forEach((K, i) => { if (K && K.j === 'V' && (K.cl || 'main') === 'main') mains.push(i); });
  const vspan = v => { const vs = [v, ...andVerbs(v)]; let a = Infinity, b = -Infinity; vs.forEach(x => { const [p, q] = g.span(x); a = Math.min(a, p); b = Math.max(b, q); }); return [a, b]; };
  const spanOf = (gr, k) => gr.key === 'VERB' ? (k === gr.items[0] ? [k, k] : g.span(k)) : g.span(k);
  mains.sort((a, b) => vspan(a)[0] - vspan(b)[0]);
  if (mains.length > 1) groups.push({ key: 'JOIN', owner: null, items: mains, kind: 'join' });
  // each conjunction belongs to the smallest gap between two parts of a group
  const gaps = [];
  groups.forEach(gr => {
    gr.conj = gr.items.map(() => null);
    for (let k = 0; k + 1 < gr.items.length; k++) {
      const a = gr.kind === 'join' ? vspan(gr.items[k])[1] : spanOf(gr, gr.items[k])[1];
      const b = gr.kind === 'join' ? vspan(gr.items[k + 1])[0] : spanOf(gr, gr.items[k + 1])[0];
      gaps.push({ gr, k, a, b });
    }
  });
  const conjOf = new Map();                  // conjunction word -> its gap
  jobs.forEach((K, c) => {
    if (!(K && K.j === 'CONJ')) return;
    const fit = gaps.filter(x => x.a < c && c < x.b).sort((p, q) => (p.b - p.a) - (q.b - q.a))[0];
    if (!fit) { P('conjAlone', c); return; }
    if (fit.gr.conj[fit.k] != null) { P('conjTwo', c); return; }
    fit.gr.conj[fit.k] = c; conjOf.set(c, fit);
  });
  const groupFor = (key, items) => groups.find(gr => gr.key === key && gr.items.length === items.length && gr.items.every((x, i) => x === items[i]));
  const compConj = (gr) => {                 // one conjunction for a compound: in the gap before the last part
    const last = gr.conj[gr.items.length - 2];
    gr.conj.forEach((c, k) => { if (c != null && k !== gr.items.length - 2) P('conjPlace', c); });
    if (last == null) { P('noConj', gr.items[gr.items.length - 1]); return null; }
    used.add(last);
    return last;
  };

  // ---- nodes
  const mark = i => { used.add(i); return i; };
  const modWord = (k, head) => {             // a word on a slant; only adverbs can hang from it
    mark(k);
    const mods = [];
    kids[k].forEach(x => {
      if (J(x).j === 'ADV') mods.push(modWord(x, k));
      else if (J(x).j !== 'CONJ') P('slantMods', x, { head: k });
    });
    const node = { w: W_(k), mods, tok: k };
    if (J(k).j === 'ADV' && head != null && NOUNISH.has(J(head).j)) node.role = 'ADV';   // "only the clock"
    return node;
  };
  const modsOf = (h) => {
    const out = [];
    kids[h].forEach(k => {
      const K = J(k);
      if (K.j === 'ADJ' || K.j === 'ADV') out.push(modWord(k, h));
      else if (K.j === 'PREP') {
        mark(k);
        const objs = kidsOf(k, x => isSlot(x, 'OP'));
        kidsOf(k, x => !isSlot(x, 'OP')).forEach(x => P('prepMods', x, { head: k }));
        let obj;
        if (objs.length) obj = groupNode(objs, 'OP');
        else { P('noObj', k); obj = ph(); }
        out.push({ prep: W_(k), obj, prepTok: k });
      } else if (K.j === 'IO') out.push({ io: headNode(k) });
      else if (K.j === 'AP') out.push({ app: headNode(k) });
      else if (K.j === 'PART') out.push(verbalNode(k, 'part'));
      else if (K.j === 'INF' && (K.as === 'adj' || K.as === 'adv')) out.push(verbalNode(k, 'inf'));
      else if (K.j === 'V' && K.cl === 'adj') { mark(k); out.push({ ac: clauseOf(k) }); }
      else if (K.j === 'V' && K.cl === 'adv') {
        mark(k);
        const subs = kidsOf(k, x => x.j === 'SUB');
        let sc = '?';
        if (subs.length) { sc = W_(subs[0]); mark(subs[0]); subs.slice(1).forEach(x => P('subTwo', x)); } else P('noSub', k);
        out.push({ sc, cl: clauseOf(k), subTok: subs.length ? subs[0] : undefined });
      }
    });
    return out;
  };
  const complementOf = (v) => {              // { key, items } or null
    const by = {};
    kids[v].forEach(k => { const K = J(k); ['DO', 'PN', 'PA'].forEach(s => { if (isSlot(K, s)) (by[s] = by[s] || []).push(k); }); });
    const keys = Object.keys(by);
    if (keys.length > 1) keys.slice(1).forEach(s => by[s].forEach(k => P('twoComps', k, { head: v })));
    return keys.length ? { key: keys[0], items: by[keys[0]] } : null;
  };
  const verbalNode = (k, verbal) => {
    mark(k);
    const aux = kidsOf(k, x => x.j === 'AUX');
    aux.forEach(mark);
    const node = { verbal, V: { w: W_(k), aux: aux.map(W_), auxTok: aux, mods: [], tok: k } };
    node.V.mods = modsOf(k);
    const comp = complementOf(k);
    if (comp) node[comp.key] = groupNode(comp.items, comp.key);
    if (verbal === 'inf') {
      const to = kidsOf(k, x => x.j === 'TO');
      if (to.length) { mark(to[0]); node.toTok = to[0]; if (W_(to[0]) !== 'to') node.to = W_(to[0]); to.slice(1).forEach(x => P('toTwo', x)); }
      else P('noTo', k);
    }
    kidsOf(k, x => ['S', 'OC'].includes(x.j)).forEach(x => P('badLink', x, { head: k }));
    return node;
  };
  const headNode = (k) => {                  // a word (or phrase or clause) in a noun slot
    const K = J(k);
    if (K.j === 'GER') return verbalNode(k, 'ger');
    if (K.j === 'INF') return verbalNode(k, 'inf');
    if (K.j === 'V' && K.cl === 'noun') {
      mark(k);
      const intro = kidsOf(k, x => x.j === 'NCI');
      if (intro.length) { mark(intro[0]); intro.slice(1).forEach(x => P('nciTwo', x)); }
      return { nc: clauseOf(k), intro: intro.length ? W_(intro[0]) : null, introTok: intro.length ? intro[0] : undefined };
    }
    mark(k);
    const node = { w: W_(k), mods: modsOf(k), tok: k };
    if (rel.has(k)) node.rel = true;
    return node;
  };
  const groupNode = (items, key) => {
    if (items.length === 1) return headNode(items[0]);
    const gr = groupFor(key, items);
    const c = gr ? compConj(gr) : null;
    return { conj: c != null ? W_(c) : 'and', conjTok: c != null ? c : undefined, items: items.map(headNode) };
  };
  const verbNode = (v) => {
    mark(v);
    const aux = kidsOf(v, x => x.j === 'AUX');
    aux.forEach(mark);
    return { w: W_(v), aux: aux.map(W_), auxTok: aux, mods: modsOf(v), tok: v };
  };
  const clauseOf = (v) => {
    const vs = [v, ...andVerbs(v)].sort((a, b) => a - b);
    const subj = [];
    vs.forEach(x => kidsOf(x, K => isSlot(K, 'S')).forEach(k => subj.push(k)));
    subj.sort((a, b) => a - b);
    const c = {};
    if (subj.length) c.S = groupNode(subj, 'S');
    else if (J(v).you) c.S = YOU();
    else { P('noSubj', v); c.S = ph(); }
    vs.slice(1).forEach(x => kidsOf(x, K => isSlot(K, 'S')).length && P('andSubj', x));
    if (vs.length === 1) {
      c.V = verbNode(v);
      const comp = complementOf(v);
      if (comp) c[comp.key] = groupNode(comp.items, comp.key);
    } else {
      const gr = groupFor('VERB', vs), cj = gr ? compConj(gr) : null;
      c.V = { conj: cj != null ? W_(cj) : 'and', conjTok: cj != null ? cj : undefined, items: vs.map(x => {
        const vn = verbNode(x), comp = complementOf(x);
        return comp ? { V: vn, [comp.key]: groupNode(comp.items, comp.key) } : vn;
      }) };
    }
    const oc = kidsOf(v, K => K.j === 'OC');
    if (oc.length) c.OC = groupNode(oc, 'OC');
    vs.slice(1).forEach(x => kidsOf(x, K => K.j === 'OC').forEach(k => P('ocAnd', k)));
    return c;
  };

  // ---- the sentence
  const ind = [];
  jobs.forEach((K, i) => {
    if (!K) return;
    if (K.j === 'INTJ') { mark(i); ind.push({ ind: 'INTJ', n: { w: W_(i), mods: [], tok: i } }); }
    else if (K.j === 'EXPL') { mark(i); ind.push({ ind: 'EXPL', n: { w: W_(i), mods: [], tok: i } }); }
    else if (K.j === 'ADDR' || K.j === 'ABS') { mark(i); ind.push({ ind: K.j, n: { w: W_(i), mods: modsOf(i), tok: i } }); }
  });
  let spec = null;
  if (mains.length) {
    const s = sentenceOf(toks, end);
    if (mains.length === 1) spec = Object.assign({ s }, clauseOf(mains[0]));
    else {
      const join = groups.find(gr => gr.kind === 'join');
      const cs = mains.map(clauseOf);
      join.conj.slice(0, -1).forEach(c => { if (c != null) used.add(c); });
      spec = { s, clauses: cs, conj: join.conj.slice(0, -1).map(c => c == null ? 'x' : W_(c)), joinToks: join.conj.slice(0, -1).map(c => c == null ? undefined : c) };
    }
    if (ind.length) spec.ind = ind;
  } else P('noVerb', null);
  return { spec, used, probs, groups, g };
}

/* ---------- spec -> jobs (tests; a model answer for a lesson sentence) ---------- */
function jobsFromSpec(sp) {
  annotate(sp);
  const toks = parseSentence(sp.s).toks, nodes = wordsOf(sp).filter(nd => !nd.understood);
  if (nodes.length !== toks.length) return null;
  const clauseVerb = cl => cl.V.items ? (cl.V.items[0].V || cl.V.items[0]) : cl.V;
  const owner = h => {                       // the word that a noun-slot head goes with
    if (['OP', 'AP', 'IO'].includes(h.role)) return h.parent;
    if (h.branch && (h.branch.kind === 'verbal' || h.branch.kind === 'branch')) return h.branch.V;
    if (h.role === 'S') return clauseVerb(h.clause);
    return h.clause.V.items ? null : h.clause.V;
  };
  const nounish = x => x && (NOUNISH.has(x.role) || x.role === 'GER');
  const rec = new Map();
  nodes.forEach(nd => {
    let r = null;
    switch (nd.kind) {
      case 'aux': r = { j: 'AUX', to: nd.main }; break;
      case 'prepword': r = { j: 'PREP', to: nd.parent }; break;
      case 'conj': case 'cconj': r = { j: 'CONJ' }; break;
      case 'sub': r = { j: 'SUB', to: clauseVerb(nd.phrase.cl) }; break;
      case 'nci': r = { j: 'NCI', to: clauseVerb(nd.phrase.nc) }; break;
      case 'infto': r = { j: 'TO', to: nd.parent }; break;
      case 'mod': r = { j: nd.role === 'ADV' ? 'ADV' : 'ADJ', to: nd.parent }; break;
      default: {
        const vp = nd.phrase;
        if (nd.role === 'PART') r = { j: 'PART', to: vp.parent };
        else if (nd.role === 'GER') r = { j: 'GER', as: vp.role, to: owner(vp) };
        else if (nd.role === 'INF') r = vp.role === 'MOD' ? { j: 'INF', as: nounish(vp.parent) ? 'adj' : 'adv', to: vp.parent } : { j: 'INF', as: vp.role, to: owner(vp) };
        else if (nd.role === 'V' || nd.role === 'LV') {
          const cl = nd.clause, out = cl.outer;
          if (nd.compound && nd.compound.items[0] !== nd && nd.compound.items[0].V !== nd) r = { j: 'V', cl: 'and', to: clauseVerb(cl) };
          else if (!out || out.clauses) r = { j: 'V', cl: 'main' };
          else if (out.kind === 'ac') r = { j: 'V', cl: 'adj', to: out.parent };
          else if (out.kind === 'sc') r = { j: 'V', cl: 'adv', to: out.parent };
          else if (out.kind === 'nc') r = { j: 'V', cl: 'noun', as: out.role, to: owner(out) };
          if (r && r.cl !== 'and' && cl.S && cl.S.understood) r.you = true;
        } else if (['ADDR', 'INTJ', 'EXPL', 'ABS'].includes(nd.role)) r = { j: nd.role };
        else r = { j: nd.role, to: owner(nd) };
      }
    }
    rec.set(nd, r);
  });
  // words -> positions in the sentence: words that occur once first, then the word nearest to a placed neighbor
  const tokOf = new Map(), free = toks.map(() => true);
  const nbrs = new Map(nodes.map(nd => [nd, []]));
  nodes.forEach(nd => { const t = rec.get(nd).to; if (t && nbrs.has(t)) { nbrs.get(nd).push(t); nbrs.get(t).push(nd); } });
  const place = (nd, i) => { tokOf.set(nd, i); free[i] = false; };
  nodes.forEach(nd => {
    const ti = toks.map((t, i) => i).filter(i => toks[i].w === nd.w);
    if (ti.length === 1 && nodes.filter(x => x.w === nd.w).length === 1) place(nd, ti[0]);
  });
  const side = (j, i, p) =>                  // a word usually stands on one side of the word it goes with
    (['ADJ', 'AUX', 'TO', 'SUB', 'NCI'].includes(j) && i > p) || (j === 'OP' && i < p) ? 100
      : (j === 'S' && i > p) || (['DO', 'IO', 'PN', 'PA', 'OC'].includes(j) && i < p) ? 5 : 0;
  for (let guard = 0; guard < nodes.length * 2 && tokOf.size < nodes.length; guard++) {
    let best = null;
    nodes.forEach(nd => {
      if (tokOf.has(nd)) return;
      const h = rec.get(nd).to, hp = h && tokOf.has(h) ? tokOf.get(h) : null;
      const deps = nbrs.get(nd).filter(x => x !== h && tokOf.has(x)).map(x => tokOf.get(x));
      if (hp == null && !deps.length) return;
      toks.forEach((t, i) => {
        if (!free[i] || t.w !== nd.w) return;
        const d = Math.min(hp != null ? Math.abs(hp - i) + side(rec.get(nd).j, i, hp) : Infinity, ...deps.map(p => Math.abs(p - i)));
        if (!best || d < best.d) best = { nd, i, d };
      });
    });
    if (!best) { const nd = nodes.find(x => !tokOf.has(x)); const i = toks.findIndex((t, k) => free[k] && t.w === nd.w); if (i < 0) return null; place(nd, i); }
    else place(best.nd, best.i);
  }
  const jobs = toks.map(() => null);
  nodes.forEach(nd => {
    const r = rec.get(nd), i = tokOf.get(nd);
    const Jn = { j: r.j, to: r.to ? (tokOf.has(r.to) ? tokOf.get(r.to) : null) : null };
    if (r.cl) Jn.cl = r.cl;
    if (r.as) Jn.as = r.as;
    if (r.you) Jn.you = true;
    jobs[i] = Jn;
  });
  // extra information (commas) and coordinate adjectives, from the marks of the sentence
  const g = bGraph(toks, jobs);
  jobs.forEach((Jn, i) => {
    if (!(Jn.j === 'AP' || Jn.j === 'PART' || (Jn.j === 'V' && Jn.cl === 'adj'))) return;
    const [a, b] = g.span(i);
    Jn.extra = a > 0 ? toks[a - 1].mark !== '' : toks[b].mark !== '';
  });
  jobs.forEach((Jn, i) => {
    if (Jn.j !== 'ADJ' || i === 0 || B_DET.has(toks[i].w.toLowerCase())) return;
    const p = jobs[i - 1];
    if (p && p.j === 'ADJ' && p.to === Jn.to && !B_DET.has(toks[i - 1].w.toLowerCase())) Jn.coord = toks[i - 1].mark === ',';
  });
  return { toks, jobs, end: parseSentence(sp.s).end };
}

/* A text form of a diagram that does not depend on the order of the modifiers (tests). */
function canonSpec(sp) {
  annotate(sp);
  const sorted = a => a.map(mod).sort().join(',');
  const head = n => {
    if (!n) return '-';
    if (n.items) return `C(${n.conj}:${n.items.map(it => it.kind === 'branch' ? `B(${head(it.V)},${it.comp || ''}=${head(it[it.comp])})` : head(it)).join('|')})`;
    if (n.kind === 'verbal') return `${n.verbal}(${n.verbal === 'inf' ? (n.to || 'to') : ''},${head(n.V)},${n.comp || ''}=${head(n[n.comp])})`;
    if (n.kind === 'nc') return `NC(${n.intro || ''},${clause(n.nc)})`;
    const aux = (n.aux || []).map(a => a.w).join(' ');
    return `${n.rel ? 'R:' : ''}${n.role}:${aux ? aux + ' ' : ''}${n.w}[${sorted(n.mods || [])}]`;
  };
  const mod = m => {
    if (m.kind === 'mod') return `${m.role}:${m.w}[${sorted(m.mods)}]`;
    if (m.kind === 'prep') return `P(${m.prepNode.w},${head(m.obj)})`;
    if (m.kind === 'io') return `IO(${head(m.obj)})`;
    if (m.kind === 'app') return `AP(${head(m.obj)})`;
    if (m.kind === 'verbal') return head(m);
    if (m.kind === 'ac') return `AC(${clause(m.ac)})`;
    if (m.kind === 'sc') return `SC(${m.sc},${clause(m.cl)})`;
    return '?';
  };
  const clause = c => `S=${head(c.S)};V=${head(c.V)};${c.comp || ''}=${head(c[c.comp])};OC=${head(c.OC)}`;
  const ind = (sp.indNodes || []).map(e => `${e.ind}:${head(e.n)}`).join(',');
  return `ind=${ind};` + (sp.clauses ? sp.clauses.map(clause).join(` ${JSON.stringify(joinsOf(sp))} `) : clause(sp));
}

/* ---------- commas and semicolons from the structure ---------- */
/* Returns { gaps: Map(gap -> { need, alt, opt, rule }), traps: Map(gap -> rule), asks: [word], why: Map(gap -> rule) }.
   gap i = after word i. need = the mark that the rule asks for; alt = other marks that are also correct.
   traps: places with a note "no comma"; why: other places with a rule that explains an extra mark. */
function commaRules(toks, jobs, end) {
  const n = toks.length, built = specFromJobs(toks, jobs, end), { g, groups } = built, { kids } = g, J = i => jobs[i];
  const gaps = new Map(), traps = new Map(), asks = [], prio = new Map(), tprio = new Map();
  const put = (gap, need, rule, p, o = {}) => {   // o.alt: other correct marks, o.altRule: { mark: rule }
    if (gap < 0 || gap >= n - 1) return;
    if (prio.has(gap) && prio.get(gap) >= p) return;
    prio.set(gap, p); gaps.set(gap, { need, alt: o.alt || [], altRule: o.altRule || {}, opt: !!o.opt, rule });
  };
  const trap = (gap, rule, p = 1) => {         // the subject-verb rule explains a place best
    if (gap < 0 || gap >= n - 1 || (tprio.has(gap) && tprio.get(gap) >= p)) return;
    tprio.set(gap, p); traps.set(gap, rule);
  };
  const lw = i => toks[i].w.toLowerCase();
  const andVerbs = v => { const out = []; const walk = x => kids[x].filter(k => J(k).j === 'V' && J(k).cl === 'and').forEach(k => { out.push(k); walk(k); }); walk(v); return out; };
  const branchSpan = x => {                  // a verb with its own words (not the subject, not the next verbs)
    let a = x, b = x;
    kids[x].forEach(k => { if (isSlot(J(k), 'S') || (J(k).j === 'V' && J(k).cl === 'and')) return; const [p, q] = g.span(k); a = Math.min(a, p); b = Math.max(b, q); });
    return [a, b];
  };
  const itemSpan = (gr, k) => gr.key === 'VERB' ? branchSpan(k) : g.span(k);
  const verbStart = v => Math.min(v, ...kids[v].filter(k => J(k).j === 'AUX'));
  // 1. clauses of a compound sentence
  const join = groups.find(gr => gr.kind === 'join');
  const joinGaps = [];
  if (join) {
    const sp = join.items.map(v => g.span(v));
    for (let k = 0; k + 1 < join.items.length; k++) {
      const c = join.conj[k];
      if (c != null) { joinGaps.push({ gap: c - 1, A: sp[k], B: sp[k + 1] }); put(c - 1, ',', 'compound', 9); continue; }
      const runConj = join.conj.slice(k + 1, join.items.length - 1).find(x => x != null) != null;
      const first = sp[k + 1][0];
      if (J(first) && J(first).j === 'ADV' && B_CADV.has(lw(first))) { put(sp[k][1], ';', 'semiAdv', 9); put(first, ',', 'adv', 8); }
      else if (runConj) put(sp[k][1], ';', 'semi', 9, { alt: [','], altRule: { ',': 'series' } });   // "A, B, and C" is a series of clauses
      else put(sp[k][1], ';', 'semi', 9);
    }
  }
  // 2. words before the subject and the verb of each main clause
  const mains = join ? join.items : jobs.map((Jn, i) => (Jn && Jn.j === 'V' && (Jn.cl || 'main') === 'main' ? i : -1)).filter(i => i >= 0);
  mains.forEach((v, mi) => {
    const vs = [v, ...andVerbs(v)];
    const subj = vs.flatMap(x => kids[x].filter(k => isSlot(J(k), 'S')));
    const stop = Math.min(verbStart(v), ...subj.map(k => g.span(k)[0]));
    const start = join && mi > 0 && join.conj[mi - 1] != null ? join.conj[mi - 1] + 1 : g.span(v)[0];
    const elems = [];
    vs.forEach(x => kids[x].forEach(k => { const [a, b] = g.span(k); if (a >= start && b < stop && !isSlot(J(k), 'S') && J(k).j !== 'AUX') elems.push({ k, a, b }); }));
    subj.forEach(sj => kids[sj].forEach(k => {   // a participle phrase before the whole subject ("Smiling, the teacher")
      if (J(k).j !== 'PART') return;
      const [a, b] = g.span(k), rest = Math.min(sj, ...kids[sj].filter(x => x !== k).map(x => g.span(x)[0]));
      if (b < rest && a >= start) elems.push({ k, a, b });
    }));
    elems.sort((p, q) => p.a - q.a);
    for (let e = 0; e < elems.length; e++) {
      const { k, a } = elems[e]; let b = elems[e].b; const K = J(k);
      if (K.j === 'V' && K.cl === 'adv') put(b, ',', 'introClause', 7.6);
      else if (K.j === 'PART') put(b, ',', 'introPart', 7.6);
      else if (K.j === 'INF') put(b, ',', 'introInf', 7.6);
      else if (K.j === 'PREP') {                // a run of phrases counts as one
        while (e + 1 < elems.length && J(elems[e + 1].k).j === 'PREP' && elems[e + 1].a === b + 1) { e++; b = elems[e].b; }
        if (b - a + 1 >= 5) put(b, ',', 'intro', 7); else put(b, ',', 'introShort', 2, { opt: true });
      } else if (K.j === 'ADV' && a === b) {
        if (B_CADV.has(lw(k))) put(b, ',', 'adv', 7); else put(b, ',', 'introShort', 2, { opt: true });
      }
    }
  });
  // 3. words outside the clauses
  jobs.forEach((Jn, i) => {
    if (!Jn) return;
    const [a, b] = g.span(i);
    if (Jn.j === 'INTJ') put(i, ',', 'intj', 6);
    else if (Jn.j === 'ADDR') { put(a - 1, ',', 'addr', 6); put(b, ',', 'addr', 6); }
    else if (Jn.j === 'EXPL') trap(i, 'expl');
    else if (Jn.j === 'ABS') { put(a - 1, ',', 'abs', 6); put(b, ',', 'abs', 6); }
  });
  // 4. extra information or "which one": appositives, participle phrases, adjective clauses
  jobs.forEach((Jn, e) => {
    if (!Jn) return;
    const kind = Jn.j === 'AP' ? 'ap' : Jn.j === 'PART' ? 'part' : Jn.j === 'V' && Jn.cl === 'adj' ? 'ac' : null;
    if (!kind || Jn.to == null) return;
    const [a, b] = g.span(e);
    if (b < Jn.to) return;                   // a participle phrase before its noun: see 2
    const extra = Jn.extra != null ? Jn.extra : defaultExtra(toks, jobs, e);
    const rule = { ap: ['apNon', 'appRestr'], part: ['partNon', 'partRestr'], ac: ['acNon', 'acRestr'] }[kind];
    if (extra) { put(a - 1, ',', rule[0], 7.5); put(b, ',', rule[0], 7.5); }
    else { trap(a - 1, rule[1]); trap(b, rule[1]); }
  });
  // 5. compound parts and series
  const inner = (a, b) => [...gaps.entries()].some(([x, r]) => x >= a && x < b && !r.opt);
  groups.filter(gr => gr.kind === 'comp').forEach(gr => {
    const m = gr.items.length, sp = gr.items.map(k => itemSpan(gr, k)), c = gr.conj[m - 2];
    if (m === 2) { if (c != null) trap(c - 1, 'pair'); return; }
    // parts with their own commas: semicolons are clearer; the sentence keeps one style
    const semi = sp.some(([a, b]) => inner(a, b)) && sp.slice(0, -1).some(([, b]) => toks[b].mark === ';');
    for (let k = 0; k <= m - 2; k++) {
      if (semi) put(sp[k][1], ';', 'semiSeries', 8);
      else if (k < m - 2) put(sp[k][1], ',', 'series', 8);
      else put(sp[k][1], ',', 'serial', 3, { opt: true });
    }
  });
  // 6. two adjectives before a noun: a comma before an opinion, size, or quality word; none before a shape,
  //    age, color, origin, material, or type word (coordOf; the user answers when the builder cannot tell)
  jobs.forEach((Jn, y) => {
    if (!Jn || Jn.j !== 'ADJ' || y === 0 || B_DET.has(lw(y))) return;
    const x = y - 1, p = jobs[x];
    if (!(p && p.j === 'ADJ' && p.to === Jn.to && !B_DET.has(lw(x)) && Jn.to > y)) return;
    const c = coordOf(toks, jobs, y);
    if (c === true) put(x, ',', 'coord', 5);
    else if (c === false) trap(x, 'cumul');
    else asks.push(y);
  });
  // no comma after "the" or "my", and none before the noun: a note when the noun has two or more adjectives
  const why = adjWhy(toks, jobs), nAdj = new Map();
  jobs.forEach((Jn, i) => { if (Jn && Jn.j === 'ADJ' && Jn.to != null && Jn.to > i && !B_DET.has(lw(i))) nAdj.set(Jn.to, (nAdj.get(Jn.to) || 0) + 1); });
  why.forEach((rule, i) => { if ((nAdj.get(jobs[i].to) || 0) >= 2) trap(i, rule); });
  // 7. places where a comma is a common mistake
  jobs.forEach((Jn, v) => {
    if (!(Jn && Jn.j === 'V')) return;
    const vs0 = verbStart(v);
    const sEnd = Math.max(-1, ...kids[v].filter(k => isSlot(J(k), 'S')).map(k => g.span(k)[1]));   // the end of the whole subject
    if (sEnd >= 0 && sEnd < vs0) trap(sEnd, 'sv', 3);
    const startOf = pred => Math.min(Infinity, ...kids[v].filter(k => pred(J(k))).map(k => g.span(k)[0]));   // a compound: before its first part only
    const d = startOf(K => isSlot(K, 'DO')), nc = startOf(K => K.j === 'V' && K.cl === 'noun' && ['DO', 'PN'].includes(K.as)), oc = startOf(K => K.j === 'OC');
    if (nc < Infinity && nc > v) trap(nc - 1, 'ncNo');
    else if (d < Infinity && d > v) trap(d - 1, 'vo');
    if (oc < Infinity && oc > v) trap(oc - 1, 'ocNo');
  });
  jobs.forEach((Jn, k) => {                  // an adverb clause after the word it modifies
    if (!(Jn && Jn.j === 'V' && Jn.cl === 'adv') || Jn.to == null) return;
    const [a] = g.span(k);
    if (a <= Jn.to) return;
    const sub = kids[k].find(x => J(x).j === 'SUB');
    if (sub != null && /^(although|though|whereas)$/.test(lw(sub))) put(a - 1, ',', 'scContrast', 4);
    else trap(a - 1, 'scAfter');
  });
  jobs.forEach((Jn, i) => {                  // "however" inside a clause
    if (!(Jn && Jn.j === 'ADV' && B_CADV.has(lw(i))) || gaps.has(i)) return;
    if (i > 0 && !gaps.has(i - 1)) { put(i - 1, ',', 'advMid', 4); put(i, ',', 'advMid', 4); }
  });
  // a semicolon before the conjunction is also correct when the clauses have their own commas
  joinGaps.forEach(({ gap, A, B }) => { if (inner(A[0], A[1]) || inner(B[0], B[1])) Object.assign(gaps.get(gap), { alt: [';'], altRule: { ';': 'semiSeries' } }); });
  gaps.forEach((_, gap) => traps.delete(gap));   // a mark that a rule asks for is not a mistake
  return { gaps, traps, asks, why };
}
/* Places where a comma never goes before a noun: after a word like "the," "my," or "two" (det), and between
   the last adjective and the noun (adjNoun). Returns Map(gap -> rule). The comma steps use it to explain a mark. */
function adjWhy(toks, jobs) {
  const out = new Map();
  jobs.forEach((Jn, i) => {
    if (!Jn || Jn.j !== 'ADJ' || Jn.to == null || Jn.to <= i || i >= toks.length - 1) return;
    if (B_DET.has(toks[i].w.toLowerCase())) out.set(i, 'det');
    else if (Jn.to === i + 1) out.set(i, 'adjNoun');
  });
  return out;
}
/* Default for "extra information": an adjective clause with "that" tells which one; others add information. */
function defaultExtra(toks, jobs, e) {
  if (jobs[e].j !== 'V') return true;
  const g = bGraph(toks, jobs), first = g.span(e)[0];
  return toks[first].w.toLowerCase() !== 'that';
}
/* Compare the marks of the sentence with the rules. */
function gradeMarks(toks, rules) {
  const items = [];
  const n = toks.length;
  for (let i = 0; i < n - 1; i++) {
    const m = toks[i].mark, r = rules.gaps.get(i);
    if (r) {
      const okMarks = [r.need, ...r.alt];
      if (m === '' && !r.opt) items.push({ i, k: 'missing', need: r.need, rule: r.rule });
      else if (m === '' && r.opt) items.push({ i, k: 'opt', need: r.need, rule: r.rule });
      else if (!okMarks.includes(m)) items.push({ i, k: 'wrong', need: r.need, got: m, rule: r.rule });
      else items.push({ i, k: r.opt ? 'opt' : 'good', need: m, rule: m === r.need ? r.rule : (r.altRule[m] || r.rule) });
    } else if (m) items.push({ i, k: 'extra', got: m, rule: rules.traps.get(i) || (rules.why && rules.why.get(i)) || 'none' });
    else if (rules.traps.has(i)) items.push({ i, k: 'no', rule: rules.traps.get(i) });
  }
  const bad = items.filter(x => ['missing', 'wrong', 'extra'].includes(x.k));
  return { items, bad, ok: !bad.length };
}

/* ---------- built-in checks ---------- */
const B_FORM_CODES = new Set(['caseS', 'caseO', 'casePN', 'aan', 'artJob', 'auxWord', 'toWord', 'gerIng', 'conjWord', 'subWord', 'prepWord', 'nciWord', 'explWord', 'conjJob', 'notLinking', 'beDO']);
/* Returns { probs: [{ code, i, h, sev }], built, rules, grade }. sev: 'err' (must fix) or 'warn' (look again).
   The comma check runs only when the structure has no errors. */
function checkBuild(text, jobs) {
  const ps = parseSentence(text), toks = ps.toks, n = toks.length;
  const out = [];
  const add = (code, i, x) => out.push(Object.assign({ code, i: i == null ? null : i, sev: 'err' }, x || {}));
  const warn = (code, i, x) => add(code, i, Object.assign({ sev: 'warn' }, x || {}));
  ps.probs.forEach(p => add(p.code, null, { w: p.w }));
  if (!n || ps.probs.some(p => ['empty', 'short', 'long', 'marks', 'one', 'chars', 'contraction'].includes(p.code))) return { probs: out, toks };
  jobs = toks.map((t, i) => jobs[i] || null);
  const lw = i => toks[i].w.toLowerCase();
  const built = specFromJobs(toks, jobs, ps.end), g = built.g;
  // every word has a job and, where the job needs one, a fitting link
  toks.forEach((t, i) => {
    const Jn = jobs[i];
    if (!Jn) { add('noJob', i); return; }
    const k = linkKind(Jn);
    if (!k) return;
    if (Jn.to == null) add('noLink', i);
    else if (!jobs[Jn.to]) add('linkNoJob', i, { h: Jn.to });
    else if (g.cyc.has(i)) add('cycle', i, { h: Jn.to });
    else if (!linkFits(k, jobs[Jn.to]) && !(Jn.j === 'ADV' && B_FOCUS.has(lw(i)) && NOUNISH.has(jobs[Jn.to].j))) add('linkBad', i, { h: Jn.to, k });
  });
  const seen = new Set(out.map(p => p.i));
  built.probs.forEach(p => { if (!seen.has(p.i) || p.i == null) add(p.code, p.i, { h: p.head }); });
  // word forms
  jobs.forEach((Jn, i) => {
    if (!Jn) return;
    const w = lw(i), to = Jn.to, hj = to != null && jobs[to] ? jobs[to] : null;
    if (B_ART.has(w) && Jn.j !== 'ADJ') add('artJob', i);
    if (Jn.j === 'AUX' && !B_HELP.has(w)) add('auxWord', i);
    if (Jn.j === 'TO' && w !== 'to') add('toWord', i);
    if (Jn.j === 'GER' && !/ing$/.test(w)) add('gerIng', i);
    if (Jn.j === 'CONJ' && !B_CONJ.has(w)) warn('conjWord', i);
    if (Jn.j === 'SUB' && !B_SUB.has(w)) warn('subWord', i);
    if (Jn.j === 'PREP' && !B_PREP.has(w)) warn('prepWord', i);
    if (Jn.j === 'NCI' && !B_WL('that whether if').has(w)) warn('nciWord', i);
    if (Jn.j === 'EXPL' && w !== 'there' && w !== 'it') warn('explWord', i);
    if (/^(and|or|nor)$/.test(w) && Jn.j !== 'CONJ') warn('conjJob', i);
    // pronoun case: subject forms (I, he) as subjects; object forms (me, him) as objects
    const subjSlot = Jn.j === 'S' || (Jn.j === 'PN');
    const objSlot = ['DO', 'IO', 'OP'].includes(Jn.j);
    if (Jn.j === 'S' && (B_OBJ_PRON.has(w) || w === 'her')) add('caseS', i, { x: w === 'her' ? 'she' : B_PRON_PAIR[w] });
    if (Jn.j === 'PN' && B_OBJ_PRON.has(w)) warn('casePN', i, { x: B_PRON_PAIR[w] });
    if (objSlot && B_SUBJ_PRON.has(w)) (w === 'who' || w === 'whoever' ? warn : add)('caseO', i, { x: B_PRON_PAIR[w] });
    // verbs
    if ((Jn.j === 'PN' || Jn.j === 'PA') && hj && hj.j === 'V' && !B_BE.has(lw(to)) && !B_LINKV.has(lw(to))) warn('notLinking', i, { h: to });
    if (Jn.j === 'DO' && hj && hj.j === 'V' && B_BE.has(lw(to))) add('beDO', i, { h: to });
    if (Jn.j === 'IO' && to != null && !jobs.some((K, k) => K && isSlot(K, 'DO') && K.to === to)) add('ioNoDO', i, { h: to });
    if (Jn.j === 'OC' && to != null && !jobs.some((K, k) => K && isSlot(K, 'DO') && K.to === to)) add('ocNoDO', i, { h: to });
  });
  // "a" before a consonant sound, "an" before a vowel sound
  toks.forEach((t, i) => {
    const w = lw(i);
    if ((w !== 'a' && w !== 'an') || i + 1 >= n) return;
    const nx = lw(i + 1), vowel = /^(hour|honest|honor|heir)/.test(nx) || (/^[aeiou]/.test(nx) && !/^(uni|use|usu|uti|eu|one|once|ue)/.test(nx));
    if (w === 'a' && vowel) warn('aan', i, { x: 'an' });
    if (w === 'an' && !vowel) warn('aan', i, { x: 'a' });
  });
  // words that are not in the diagram for another reason
  const named = new Set(out.map(p => p.i));
  jobs.forEach((Jn, i) => { if (Jn && !built.used.has(i) && !named.has(i)) add('notDrawn', i); });
  const errs = out.filter(p => p.sev === 'err');
  let engine = [];
  if (!errs.length && built.spec) {
    try { engine = validate(built.spec); } catch (e) { engine = [String(e.message || e)]; }
    engine.forEach(m => add('engine', null, { x: m }));
  }
  const res = { probs: out, toks, end: ps.end, built };
  // the marks follow the structure: a wrong word form ("me" as a subject) does not stop the mark check
  if (!out.some(p => p.sev === 'err' && !B_FORM_CODES.has(p.code))) { res.rules = commaRules(toks, jobs, ps.end); res.grade = gradeMarks(toks, res.rules); }
  return res;
}
