() => {
  /* Diagram logic invariants (Reed & Kellogg 1877 rules), checked on the layout model of every
     sentence in both modes. Lesson numbers refer to Higher Lessons in English (1877). */
  const B = window.BASELINE, G = B.G, errs = [], widths = {};
  const stats = { sentences: 0, layouts: 0, clauses: { main: 0, ac: 0, sc: 0, nc: 0 }, verbals: 0, pedestals: 0 };
  const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;
  const segX = (p, q) => {               // segment intersection: params along p and q, or null
    const [x1, y1, x2, y2] = p, [x3, y3, x4, y4] = q;
    const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
    if (Math.abs(d) < 1e-9) return null;
    const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d, u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
    return t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 ? { t, u } : null;
  };
  const sat = (A, Q) => {                // convex polygons overlap (strict)
    for (const P of [A, Q]) for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length], nx = y2 - y1, ny = x1 - x2;
      const pa = A.map(([x, y]) => x * nx + y * ny), pb = Q.map(([x, y]) => x * nx + y * ny);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
    }
    return true;
  };
  const seg = l => [l.x1, l.y1, l.x2, l.y2], len = l => Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
  const isH = l => (l.k === 'h' || l.k === 'base') && near(l.y1, l.y2);
  const VERB = ['V', 'LV'], VERBAL = ['PART', 'GER', 'INF'], IND = ['ADDR', 'INTJ', 'EXPL', 'ABS'];
  const series = l => l.k === 'dash' && !l.conn && !l.hang && !l.nci;   // dashed line of a compound part

  for (const [key, sp] of Object.entries(B.SENT)) {
    stats.sentences++;
    B.validate(sp).forEach(e => errs.push(`${key}: ${e}`));
    const nodes = B.wordsOf(sp);
    const allC = [...new Set(nodes.map(n => n.clause).filter(c => c && c.kind !== 'indclause'))];
    const kindOf = c => !c.outer || c.outer === sp ? 'main' : c.outer.kind;
    allC.forEach(c => { stats.clauses[kindOf(c)]++; });
    const verbals = [...new Set(nodes.filter(n => n.phrase && n.phrase.kind === 'verbal' && n.phrase.V === n).map(n => n.phrase))];
    stats.verbals += verbals.length;
    const joins = sp.clauses ? (Array.isArray(sp.conj) ? sp.conj : sp.clauses.slice(1).map(() => sp.conj)) : [];

    for (const mode of ['natural', 'puzzle']) {
      stats.layouts++;
      const L = B.layout(sp, mode), tag = `${key}/${mode}`;
      widths[tag] = L.width;
      const lines = L.items.filter(i => i.t === 'line'), words = L.words;
      const curves = L.items.filter(i => i.t === 'curve'), marks = L.items.filter(i => i.t === 'mark');
      const hl = lines.filter(isH);
      const lineAt = (y, x0, x1) => hl.find(l => near(l.y1, y) && Math.min(l.x1, l.x2) <= x0 + 0.5 && Math.max(l.x1, l.x2) >= x1 - 0.5);
      const through = (y, x) => lineAt(y, x - 2, x) && lineAt(y, x, x + 2);   // a line continues on both sides of x
      const covered = (y, x0, x1) => {       // [x0, x1] at height y is covered by horizontal lines without a gap
        const segs = hl.filter(l => near(l.y1, y)).map(l => [Math.min(l.x1, l.x2), Math.max(l.x1, l.x2)]).sort((a, b) => a[0] - b[0]);
        let reach = x0;
        for (const [a, b] of segs) { if (a > reach + 0.5) break; reach = Math.max(reach, b); }
        return segs.some(([a]) => a <= x0 + 0.5) && reach >= x1 - 0.5;
      };
      const box = w => [w.ox + w.bx, w.ox + w.bx + w.bw];   // upright words only
      const hLineOf = w => lineAt(w.oy, ...box(w));
      const wordOf = n => words.find(w => w.n === n);
      const onLineOf = (x, y, w) => { const l = w && !w.ang && hLineOf(w);   // (x, y) is on the line under word w
        return !!l && near(y, l.y1) && x >= Math.min(l.x1, l.x2) - 0.5 && x <= Math.max(l.x1, l.x2) + 0.5; };
      const verbsOf = c => words.filter(w => w.n.clause === c && (VERB.includes(w.n.role) || (w.n.role === 'AUX' && VERB.includes(w.n.main.role))));

      // 1. every upright word sits on a horizontal line
      words.forEach(w => { if (!w.ang && !['conj', 'cconj'].includes(w.n.kind) && !hLineOf(w)) errs.push(`${tag}: "${w.n.w}" is not on a horizontal line`); });

      // 2. each clause (main or dependent): one subject-verb line crosses its baseline; subject left, verb right
      const sv = lines.filter(l => l.div === 'SV'), CL = new Map();
      if (sv.length !== allC.length) errs.push(`${tag}: ${sv.length} subject-verb lines for ${allC.length} clauses`);
      allC.forEach((c, ci) => {
        const ct = `${tag} clause ${ci + 1} (${kindOf(c)})`, d = sv.filter(l => l.clause === c);
        if (d.length !== 1) { errs.push(`${ct}: ${d.length} subject-verb lines`); return; }
        const l = d[0], by = Math.min(l.y1, l.y2) + G.DIV_UP, svx = l.x1;
        CL.set(c, { by, svx });
        if (!near(l.x1, l.x2) || !near(Math.max(l.y1, l.y2), by + G.DIV_DN)) errs.push(`${ct}: subject-verb line does not cross the baseline`);
        if (!through(by, svx)) errs.push(`${ct}: baseline broken at the subject-verb line`);
        const subj = words.filter(w => w.n.clause === c && ['S', 'SU'].includes(w.n.role)), verbs = verbsOf(c);
        if (!verbs.length) errs.push(`${ct}: no verb`);
        subj.forEach(w => { if (!(box(w)[1] < svx)) errs.push(`${ct}: subject "${w.n.w}" not left of the subject-verb line`); });
        verbs.forEach(w => { if (!(box(w)[0] > svx)) errs.push(`${ct}: verb "${w.n.w}" not right of the subject-verb line`); });
        if (c.S.kind === 'word') subj.forEach(w => { if (!near(w.oy, by)) errs.push(`${ct}: subject not on the baseline`); });
        if (!c.V.items) verbs.forEach(w => { if (!near(w.oy, by)) errs.push(`${ct}: verb not on the baseline`); });
        if (c.S.understood && !subj.some(w => w.n.role === 'SU' && w.n.w === '(you)' && near(w.oy, by))) errs.push(`${ct}: (you) not on the baseline`);
      });

      // 3. complement lines: one per complement (clauses, compound predicates, verbals). The direct object
      //    line stands on its line; the complement line and the objective complement line lean back.
      const expect = { DOL: 0, CL: 0, OCL: 0 };
      allC.forEach(c => {
        const preds = c.V.items && c.V.items.some(it => it.V) ? c.V.items.filter(it => it.V) : [c];
        preds.forEach(pr => { if (pr.comp) expect[pr.comp === 'DO' ? 'DOL' : 'CL']++; });
        if (c.OC) expect.OCL++;
      });
      verbals.forEach(vp => { if (vp.comp) expect[vp.comp === 'DO' ? 'DOL' : 'CL']++; });
      for (const k of ['DOL', 'CL', 'OCL']) { const n = lines.filter(l => l.div === k).length; if (n !== expect[k]) errs.push(`${tag}: ${n} ${k} lines, expected ${expect[k]}`); }
      const pedOn = (y, x0) => lines.some(l => l.k === 'ped' && !l.stem && near(Math.max(l.y1, l.y2), y) && Math.min(l.x1, l.x2) > x0);
      lines.filter(l => ['DOL', 'CL', 'OCL'].includes(l.div)).forEach(l => {
        const [bx, byy] = l.y1 > l.y2 ? [l.x1, l.y1] : [l.x2, l.y2], [tx, ty] = l.y1 > l.y2 ? [l.x2, l.y2] : [l.x1, l.y1];
        if (!through(byy, bx)) errs.push(`${tag}: ${l.div} line does not stop on a horizontal line`);
        if (!(ty < byy - 5)) errs.push(`${tag}: ${l.div} line is not above its line`);
        if (l.div === 'DOL' && !near(tx, bx)) errs.push(`${tag}: direct object line is not vertical`);
        if (l.div !== 'DOL' && !(tx < bx - 3)) errs.push(`${tag}: ${l.div} line does not lean toward the subject`);
        const before = l.div === 'OCL' ? ['DO'] : [...VERB, ...VERBAL], after = l.div === 'DOL' ? ['DO'] : l.div === 'CL' ? ['PN', 'PA'] : ['OC'];
        if (!words.some(w => before.includes(w.n.role) && !w.ang && box(w)[1] < bx && (near(w.oy, byy) || (w.n.compound && l.div === 'OCL'))))
          errs.push(`${tag}: no ${l.div === 'OCL' ? 'direct object' : 'verb'} before the ${l.div} line`);
        if (!words.some(w => after.includes(w.n.role) && !w.ang && box(w)[0] > bx && (near(w.oy, byy) || w.n.compound)) && !pedOn(byy, bx))
          errs.push(`${tag}: no complement after the ${l.div} line`);
      });

      // 4. every slant goes down to the right at 60 degrees
      lines.filter(l => l.k === 'mod').forEach(l => {
        const a = Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI;
        if (!near(a, 60, 0.5)) errs.push(`${tag}: slant at ${a.toFixed(1)} degrees`);
      });

      // 5. a slanted word hangs from the line of the word it modifies; a modifier of a modifier hangs from a hook
      words.filter(w => w.ang && w.n.role !== 'SUB').forEach(w => {
        const n = w.n, sl = lines.find(l => l.k === 'mod' && near(l.x1, w.ox) && near(l.y1, w.oy));
        if (!sl) { errs.push(`${tag}: "${n.w}" has no slanted line`); return; }
        if (!near(w.ang, G.ANG, 0.01)) errs.push(`${tag}: "${n.w}" is not on its slant`);
        if (n.role === 'INFTO') {            // lesson 40: "to" on the slant, the verb on the line at its end
          const vw = wordOf(n.phrase.V), vl = vw && hLineOf(vw);
          if (!vl || !near(Math.min(vl.x1, vl.x2), sl.x2) || !near(vl.y1, sl.y2)) errs.push(`${tag}: infinitive "${n.phrase.V.w}" is not on a line at the end of "${n.w}"`);
          if (n.phrase.role !== 'MOD') return;   // lesson 41: a noun infinitive stands on a pedestal; its slant starts free
        }
        const hostN = n.role === 'INFTO' ? n.phrase.parent : n.parent, host = wordOf(hostN);
        if (!host) { errs.push(`${tag}: no word for the parent of "${n.w}"`); return; }
        if (host.ang) {
          const ps = lines.find(l => l.k === 'mod' && near(l.x1, host.ox) && near(l.y1, host.oy));
          const hook = ps && lines.find(l => l.hook && near(l.x1, ps.x2) && near(l.y1, ps.y2) && near(l.y2, ps.y2));
          if (!hook) errs.push(`${tag}: no hook at the end of the line of "${host.n.w}"`);
          else if (!(near(w.oy, hook.y1) && w.ox >= hook.x1 + 5 && w.ox <= hook.x2 + 0.5)) errs.push(`${tag}: "${n.w}" does not hang from the hook of "${host.n.w}"`);
          if (n.role !== 'ADV') errs.push(`${tag}: "${n.w}" modifies a modifier, but its job is ${n.role}`);
        } else if (!onLineOf(w.ox, w.oy, host)) errs.push(`${tag}: "${n.w}" does not hang from the line of "${host.n.w}"`);
      });

      // 6. preposition: a line starts at the end of its slant and holds the object
      //    (lesson 38: a gerund object starts with its step; lesson 72: a noun clause object stands on a pedestal)
      words.filter(w => w.n.role === 'PREP').forEach(w => {
        const sl = lines.find(l => l.k === 'mod' && near(l.x1, w.ox) && near(l.y1, w.oy));
        if (!sl) return;
        const obj = w.n.phrase.obj, start = hl.find(l => near(l.y1, sl.y2) && near(Math.min(l.x1, l.x2), sl.x2));
        if (!start) { errs.push(`${tag}: no object line at the end of "${w.n.w}"`); return; }
        if (obj.kind === 'word') { const ow = wordOf(obj);
          if (!ow || !near(ow.oy, start.y1) || box(ow)[0] < sl.x2) errs.push(`${tag}: object "${obj.w}" is not on a line at the end of its preposition`); }
        else if (obj.kind === 'verbal' && obj.verbal === 'ger') { if (!start.step || start.node !== obj) errs.push(`${tag}: gerund object of "${w.n.w}" does not start with its step`); }
        else if (obj.items) { if (!obj.items.every(it => { const ow = wordOf(it); return ow && box(ow)[0] > sl.x2 + 10 && hLineOf(ow); })) errs.push(`${tag}: compound object of "${w.n.w}" is not on the lines after its slant`); }
        else if (obj.kind === 'nc') { if (!lines.some(l => l.k === 'ped' && l.node === obj && near(Math.max(l.y1, l.y2), start.y1))) errs.push(`${tag}: noun clause object of "${w.n.w}" is not on a pedestal on its line`); }
        else errs.push(`${tag}: object of "${w.n.w}" has an unknown form`);
      });

      // 7. indirect object: empty slant from the verb line, then a horizontal line
      words.filter(w => w.n.role === 'IO').forEach(w => {
        const hlw = hLineOf(w), vw = wordOf(w.n.parent);
        const sl = hlw && lines.find(l => l.k === 'mod' && l.empty && near(l.x2, Math.min(hlw.x1, hlw.x2)) && near(l.y2, hlw.y1));
        if (!sl) errs.push(`${tag}: indirect object "${w.n.w}" lacks an empty slant`);
        else if (words.some(o => o.ang && near(o.ox, sl.x1) && near(o.oy, sl.y1))) errs.push(`${tag}: the indirect object slant is not empty`);
        else if (!vw || !onLineOf(sl.x1, sl.y1, vw)) errs.push(`${tag}: the indirect object slant does not start on the verb line`);
      });

      // 8. compound part: a dashed line joins the parallel lines; the conjunction is on it (lesson 20: between
      //    the last two parts; an x marks each earlier gap)
      const dashes = lines.filter(series);
      words.filter(w => w.n.role === 'CONJ').forEach(w => {
        const cx = w.ox + w.bx + w.bw / 2;
        const d = [...dashes].sort((a, b) => Math.abs(a.x1 - cx) - Math.abs(b.x1 - cx))[0];
        if (!d || !near(d.x1, cx)) { errs.push(`${tag}: conjunction "${w.n.w}" not on the dashed line`); return; }
        const items = words.filter(o => o.n.compound === w.n.comp);
        items.forEach(o => { if (!(o.oy >= Math.min(d.y1, d.y2) - 0.6 && o.oy <= Math.max(d.y1, d.y2) + 0.6)) errs.push(`${tag}: compound item "${o.n.w}" not joined by the dashed line`); });
        if (new Set(items.map(o => Math.round(o.oy))).size !== items.length) errs.push(`${tag}: compound items must be on separate parallel lines`);
        const ys = items.map(o => o.oy).sort((a, b) => a - b), cyc = w.oy + (G.BOX_T + G.BOX_B) / 2;
        if (ys.length >= 2 && !near(cyc, (ys[ys.length - 2] + ys[ys.length - 1]) / 2, 1)) errs.push(`${tag}: conjunction "${w.n.w}" is not between the last two parts`);
        const xm = marks.filter(m => m.mk === 'UC' && near(m.ox + m.bw / 2, cx));
        if (xm.length !== Math.max(0, items.length - 2)) errs.push(`${tag}: ${xm.length} x marks for ${items.length} parts`);
        xm.forEach(m => { const my = m.oy + (G.BOX_T + G.BOX_B) / 2;
          if (!ys.slice(0, -2).some((y, k) => near(my, (y + ys[k + 1]) / 2, 1))) errs.push(`${tag}: an x mark is not between two parts`); });
      });

      // 9. compound sentence (lessons 76, 78): from each predicate a dotted line goes down, across on a step
      //    that holds the conjunction (or an x when there is none), and down to the next predicate
      if (sp.clauses) {
        const conn = lines.filter(l => l.conn), tops = L.clauses;
        if (tops.length !== sp.clauses.length) errs.push(`${tag}: ${tops.length} main clauses drawn for ${sp.clauses.length}`);
        if (conn.length !== 3 * (tops.length - 1) || conn.some(l => l.k !== 'dash')) errs.push(`${tag}: clause lines must be dotted: down, across, down (${conn.length} parts)`);
        for (let i = 0; i + 1 < tops.length; i++) {
          const c1 = tops[i], c2 = tops[i + 1], ct = `${tag} join ${i + 1}`;
          const down = conn.find(l => near(l.x1, l.x2) && near(Math.min(l.y1, l.y2), c1.baseY));
          const sy = down && Math.max(down.y1, down.y2);
          const step = down && conn.find(l => near(l.y1, l.y2) && near(l.y1, sy) && near(Math.min(l.x1, l.x2), down.x1));
          const down2 = step && conn.find(l => near(l.x1, l.x2) && near(l.x1, Math.max(step.x1, step.x2)) && near(Math.min(l.y1, l.y2), step.y1));
          if (!down || !step || !down2) { errs.push(`${ct}: clause line is not down, across, down`); continue; }
          if (!(c2.baseY > c1.baseY + 30)) errs.push(`${ct}: the next clause is not below`);
          if (!(down.x1 > c1.svx + 3) || !lineAt(c1.baseY, down.x1 - 1, down.x1 + 1)) errs.push(`${ct}: clause line does not start on the predicate`);
          if (!near(Math.max(down2.y1, down2.y2), c2.baseY) || !(down2.x1 > c2.svx + 3) || !lineAt(c2.baseY, down2.x1 - 1, down2.x1 + 1)) errs.push(`${ct}: clause line does not reach the next predicate`);
          // R&K: the line joins the predicates "merely for convenience": it starts on the verb part of the
          // predicate (before the verb when there is room, else further right where nothing hangs)
          if (!(down.x1 < c1.vx1 - 3)) errs.push(`${ct}: clause line does not start on the verb part of the predicate`);
          if (verbsOf(c2.c).some(w => box(w)[0] < down2.x1)) errs.push(`${ct}: clause line is not before the next verb`);
          const x0 = Math.min(step.x1, step.x2), x1 = Math.max(step.x1, step.x2);
          if (joins[i] === 'x') {
            const m = marks.find(m => m.mk === 'UCS' && near(m.oy, step.y1));
            if (!m || m.ox < x0 || m.ox + m.bw > x1) errs.push(`${ct}: no x on the step for the understood conjunction`);
          } else {
            const cw = words.find(w => w.n.kind === 'cconj' && w.n.at === i);
            if (!cw || cw.n.w !== joins[i] || !near(cw.oy, step.y1) || box(cw)[0] < x0 || box(cw)[1] > x1) errs.push(`${ct}: conjunction is not on the step`);
          }
        }
      } else if (lines.some(l => l.conn)) errs.push(`${tag}: clause lines in a sentence with one main clause`);

      // 10. helping verbs: on the line of the main verb, before it, in sentence order
      words.filter(w => w.n.kind === 'word' && w.n.aux.length).forEach(w => {
        const ax = w.n.aux.map(wordOf);
        if (ax.some(a => !a || !near(a.oy, w.oy))) { errs.push(`${tag}: helping verb not on the line of "${w.n.w}"`); return; }
        const xs = [...ax, w].map(a => box(a)[0]);
        if (xs.some((x, i) => i && !(x > xs[i - 1]))) errs.push(`${tag}: verb phrase of "${w.n.w}" is out of order`);
        if (!lineAt(w.oy, box(ax[0])[0], box(w)[1])) errs.push(`${tag}: verb phrase of "${w.n.w}" is not on one line`);
      });

      // 11. lines meet only at their ends; the subject-verb line is the one line that crosses its baseline
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
        const a = lines[i], b = lines[j], x = segX(seg(a), seg(b));
        if (!x) continue;
        const atEndA = Math.min(x.t, 1 - x.t) * len(a) < 0.75, atEndB = Math.min(x.u, 1 - x.u) * len(b) < 0.75;
        if (atEndA || atEndB) continue;
        const py = a.y1 + x.t * (a.y2 - a.y1);
        const svb = (s, o) => s.div === 'SV' && o.k === 'base' && near(py, Math.min(s.y1, s.y2) + G.DIV_UP, 1);
        if (svb(a, b) || svb(b, a)) continue;
        if ((series(a) && b.k === 'h') || (series(b) && a.k === 'h')) continue;   // dashed line of a series crosses the fork
        errs.push(`${tag}: lines cross: ${a.k}${a.div ? '/' + a.div : ''}${a.hang ? '/' + a.hang : ''} and ${b.k}${b.div ? '/' + b.div : ''}${b.hang ? '/' + b.hang : ''} near (${(a.x1 + x.t * (a.x2 - a.x1)).toFixed(0)}, ${py.toFixed(0)})`);
      }

      // 12. puzzle boxes of one line type have one width (no answer hints)
      if (mode === 'puzzle') ['H', 'S', 'A', 'C'].forEach(c => { const ws = new Set(words.filter(w => w.n.cat === c).map(w => w.bw.toFixed(2))); if (ws.size > 1) errs.push(`${tag}: ${c} boxes differ in width`); });

      // 13. appositive (lesson 33): on the line of its noun, after it, in parentheses
      words.filter(w => w.n.role === 'AP').forEach(w => {
        const hw = wordOf(w.n.parent);
        if (!hw || hw.ang || !near(hw.oy, w.oy) || !(box(w)[0] > box(hw)[1]) || !covered(w.oy, box(hw)[0], box(w)[1])) { errs.push(`${tag}: appositive "${w.n.w}" is not after "${w.n.parent.w}" on its line`); return; }
        const lp = marks.find(m => m.text === '(' && near(m.oy, w.oy) && m.ox + m.bw / 2 < box(w)[0] + G.BOXPAD && m.ox > box(hw)[1]);
        const rp = marks.find(m => m.text === ')' && near(m.oy, w.oy) && m.ox + m.bw / 2 > box(w)[1] - G.BOXPAD && m.ox < box(w)[1] + G.PAREN_W + 4);
        if (!lp || !rp) errs.push(`${tag}: appositive "${w.n.w}" is not in parentheses`);
      });
      if (marks.filter(m => m.text === '(').length !== words.filter(w => w.n.role === 'AP').length) errs.push(`${tag}: parentheses without an appositive`);

      // 14. independent elements (lesson 44): each on its own line above the diagram, with no link to it
      const indWords = words.filter(w => IND.includes(w.n.role));
      if (indWords.length !== (sp.ind || []).length) errs.push(`${tag}: ${indWords.length} independent words for ${(sp.ind || []).length} elements`);
      if (indWords.length) {
        const yOf = it => it.t === 'line' ? [it.y1, it.y2] : it.t === 'curve' ? [it.y1, it.cy, it.y2] : it.t === 'word' ? B.boxPoly(it).map(p => p[1]) : it.t === 'mark' ? [it.oy + G.BOX_T, it.oy] : [];
        const indIt = L.items.filter(it => it.ind && it.t !== 'mask'), mainIt = L.items.filter(it => !it.ind && it.t !== 'mask');
        indWords.forEach(w => { if (!w.ind) errs.push(`${tag}: "${w.n.w}" is not drawn as an independent element`); });
        if (!(Math.max(...indIt.flatMap(yOf)) < Math.min(...mainIt.flatMap(yOf)) - 6)) errs.push(`${tag}: independent elements are not above the diagram`);
        const ks = [...new Set(indIt.map(it => it.ind))];
        const ext = k => { const xs = indIt.filter(it => it.ind === k && it.t === 'line').flatMap(l => [l.x1, l.x2]); return [Math.min(...xs), Math.max(...xs)]; };
        ks.forEach((a, i) => ks.slice(i + 1).forEach(b => { const [a0, a1] = ext(a), [b0, b1] = ext(b); if (a0 < b1 + 6 && b0 < a1 + 6) errs.push(`${tag}: independent elements touch`); }));
      }

      // 15. participle (lesson 37): a bent line from the line of its noun: slant, bend, then its own line
      words.filter(w => w.n.role === 'PART').forEach(w => {
        const vp = w.n.phrase, pl = hLineOf(w);
        const sl = lines.find(l => l.part && l.node === vp), cv = curves.find(c => c.node === vp);
        if (!sl || !cv || !pl) { errs.push(`${tag}: participle "${w.n.w}" has no bent line`); return; }
        if (!onLineOf(sl.x1, sl.y1, wordOf(vp.parent))) errs.push(`${tag}: participle "${w.n.w}" does not hang from the line of "${vp.parent.w}"`);
        if (!near(cv.x1, sl.x2) || !near(cv.y1, sl.y2)) errs.push(`${tag}: the bend of "${w.n.w}" does not continue its slant`);
        if (!near(cv.cy, pl.y1) || !near(cv.y2, pl.y1) || !near(cv.x2, Math.min(pl.x1, pl.x2))) errs.push(`${tag}: the line of "${w.n.w}" does not start at its bend`);
        if (vp.role !== 'MOD') errs.push(`${tag}: participle "${w.n.w}" is not a modifier`);
      });

      // 16. gerund (lesson 38): a stepped line; as a noun it stands on a pedestal, as an object of a
      //     preposition it starts at the end of the slant (rule 6)
      words.filter(w => w.n.role === 'GER').forEach(w => {
        const vp = w.n.phrase, pl = hLineOf(w);
        const top = lines.find(l => l.step && l.k === 'h' && l.node === vp), riser = lines.find(l => l.k === 'step' && l.node === vp);
        if (!top || !riser || !pl) { errs.push(`${tag}: gerund "${w.n.w}" has no stepped line`); return; }
        const rx = riser.x1, rTop = Math.min(riser.y1, riser.y2), rBot = Math.max(riser.y1, riser.y2);
        if (!near(riser.x1, riser.x2) || !(rBot - rTop > 6) || !near(rBot, pl.y1) || !near(Math.min(pl.x1, pl.x2), rx)) errs.push(`${tag}: the step of "${w.n.w}" does not go down to its line`);
        if (!near(top.y1, rTop) || !near(Math.max(top.x1, top.x2), rx) || !(Math.min(top.x1, top.x2) < rx - 5)) errs.push(`${tag}: the step of "${w.n.w}" has no top`);
      });

      // 17. pedestal (lessons 38, 41, 71): a gerund, infinitive or noun clause in a noun slot stands on a
      //     stem with two feet on the slot line
      const peds = lines.filter(l => l.k === 'ped');
      const pedNodes = new Set(peds.map(l => l.node));
      const expectPed = [...verbals.filter(vp => vp.role !== 'MOD' && !(vp.verbal === 'ger' && vp.role === 'OP')),
        ...allC.filter(c => kindOf(c) === 'nc').map(c => c.outer)];
      stats.pedestals += mode === 'natural' ? expectPed.length : 0;
      if (pedNodes.size !== expectPed.length || expectPed.some(nd => !pedNodes.has(nd))) errs.push(`${tag}: ${pedNodes.size} pedestals, expected ${expectPed.length}`);
      pedNodes.forEach(nd => {
        const ls = peds.filter(l => l.node === nd), stem = ls.find(l => l.stem), legs = ls.filter(l => !l.stem);
        if (!stem || legs.length !== 2) { errs.push(`${tag}: pedestal has ${ls.length} parts`); return; }
        const sx = stem.x1, sTop = Math.min(stem.y1, stem.y2), sBot = Math.max(stem.y1, stem.y2);
        if (!near(stem.x1, stem.x2) || !through(sTop, sx)) errs.push(`${tag}: the pedestal stem does not hold up a line`);
        if (lines.some(l => l !== stem && !l.conn && [[l.x1, l.y1], [l.x2, l.y2]].some(([x, y]) => near(y, sTop) && Math.abs(x - sx) < 8) && Math.min(l.y1, l.y2) < sTop - 1))
          errs.push(`${tag}: a line meets the pedestal line where the stem meets it`);
        const f = legs.map(l => l.y1 < l.y2 ? [l.x1, l.y1, l.x2, l.y2] : [l.x2, l.y2, l.x1, l.y1]);
        if (!f.every(([x, y]) => near(x, sx) && near(y, sBot))) errs.push(`${tag}: pedestal feet do not start at the stem`);
        const fy = f[0][3], fx0 = Math.min(f[0][2], f[1][2]), fx1 = Math.max(f[0][2], f[1][2]);
        if (!near(f[1][3], fy) || !(fx0 < sx && fx1 > sx) || !covered(fy, fx0, fx1)) errs.push(`${tag}: the pedestal does not stand on a line`);
        const oc = CL.get(nd.clause);
        if (oc && near(fy, oc.by) && nd.role === 'S' && !(fx1 < oc.svx)) errs.push(`${tag}: subject pedestal is not left of the subject-verb line`);
        if (oc && near(fy, oc.by) && nd.role !== 'S' && !(fx0 > oc.svx)) errs.push(`${tag}: pedestal is not right of the subject-verb line`);
      });

      // 18. noun clause (lesson 71): "that" on a line above the clause, a dotted line down to its verb line
      allC.filter(c => kindOf(c) === 'nc' && c.outer.introNode).forEach(c => {
        const nd = c.outer, iw = wordOf(nd.introNode), dl = lines.find(l => l.nci && l.node === nd), k = CL.get(c);
        if (!iw || !dl || !k) { errs.push(`${tag}: noun clause "${nd.introNode.w}" has no dotted line`); return; }
        const top = Math.min(dl.y1, dl.y2), bot = Math.max(dl.y1, dl.y2);
        if (!near(dl.x1, dl.x2) || !onLineOf(dl.x1, top, iw)) errs.push(`${tag}: the dotted line does not start on the line of "${iw.n.w}"`);
        if (!near(bot, k.by) || !(dl.x1 > k.svx + 3) || verbsOf(c).some(w => box(w)[0] < dl.x1)) errs.push(`${tag}: the dotted line of "${iw.n.w}" does not reach the verb line before the verb`);
        const others = words.filter(w => w.n.clause === c && w !== iw);
        if (!(iw.oy < Math.min(...others.map(w => Math.min(...B.boxPoly(w).map(p => p[1])))))) errs.push(`${tag}: "${iw.n.w}" is not above its clause`);
      });

      // 19. adjective clause (lessons 59-60): its own baseline below; a dotted slanted line from the line of
      //     the noun it modifies to the line of the relative pronoun
      allC.filter(c => kindOf(c) === 'ac').forEach(c => {
        const m = c.outer, k = CL.get(c), dl = lines.find(l => l.hang === 'ac' && l.node === m);
        if (!dl || !k) { errs.push(`${tag}: adjective clause has no dotted line`); return; }
        const [sx, sy, ex, ey] = dl.y1 < dl.y2 ? [dl.x1, dl.y1, dl.x2, dl.y2] : [dl.x2, dl.y2, dl.x1, dl.y1];
        if (!onLineOf(sx, sy, wordOf(m.parent))) errs.push(`${tag}: the dotted line does not start on the line of "${m.parent.w}"`);
        const rw = wordOf(m.relNode);
        if (!rw || rw.ang) { errs.push(`${tag}: no relative pronoun on a line`); return; }
        if (!near(ey, rw.oy) || !covered(rw.oy, Math.min(ex, box(rw)[0]), Math.max(ex, box(rw)[1]))) errs.push(`${tag}: the dotted line does not end on the line of "${m.relNode.w}"`);
        const a = Math.atan2(ey - sy, ex - sx) * 180 / Math.PI;
        if (!(ey > sy + 10) || !(a >= 35 && a <= 80)) errs.push(`${tag}: the dotted line of "${m.relNode.w}" does not slant down (${a.toFixed(0)} degrees)`);
      });

      // 20. adverb clause (lesson 64): a dotted slanted line from the word it modifies to the clause verb line;
      //     the conjunction is on the dotted line
      allC.filter(c => kindOf(c) === 'sc').forEach(c => {
        const m = c.outer, k = CL.get(c), dl = lines.find(l => l.hang === 'sc' && l.node === m);
        if (!dl || !k) { errs.push(`${tag}: adverb clause has no dotted line`); return; }
        const [sx, sy, ex, ey] = dl.y1 < dl.y2 ? [dl.x1, dl.y1, dl.x2, dl.y2] : [dl.x2, dl.y2, dl.x1, dl.y1];
        if (!onLineOf(sx, sy, wordOf(m.parent))) errs.push(`${tag}: the dotted line does not start on the line of "${m.parent.w}"`);
        if (!near(ey, k.by) || !(ex > k.svx + 3) || !lineAt(ey, ex - 1, ex + 1) || verbsOf(c).some(w => box(w)[0] < ex)) errs.push(`${tag}: the dotted line of "${m.sc}" does not reach the clause verb line before the verb`);
        const a = Math.atan2(ey - sy, ex - sx);
        if (!(a * 180 / Math.PI >= 40 && a * 180 / Math.PI <= 80)) errs.push(`${tag}: the dotted line of "${m.sc}" is at ${(a * 180 / Math.PI).toFixed(0)} degrees`);
        const sw = wordOf(m.subNode);
        if (!sw || !near(sw.ox, sx) || !near(sw.oy, sy) || !near(sw.ang, a, 0.01)) errs.push(`${tag}: "${m.sc}" is not on its dotted line`);
      });

      // 21. nothing overlaps: tap areas of words and marks; lines do not touch word boxes
      //     (the dashed line of a compound goes behind its conjunction and x marks, on a mask)
      const shapes = [...words.map(w => ({ name: w.n.w, P: B.hitPoly(w), w })),
        ...marks.filter(m => m.mk).map(m => ({ name: m.text, P: [[m.ox - 2, m.oy + G.HIT_T], [m.ox + m.bw + 2, m.oy + G.HIT_T], [m.ox + m.bw + 2, m.oy + G.HIT_B], [m.ox - 2, m.oy + G.HIT_B]], m }))];
      for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++)
        if (sat(shapes[i].P, shapes[j].P)) errs.push(`${tag}: tap areas of "${shapes[i].name}" and "${shapes[j].name}" overlap`);
      const inks = [...words.map(w => ({ name: w.n.w, P: B.boxPoly(w), w })), ...marks.map(m => ({ name: m.text,
        P: [[m.ox, m.oy + G.BOX_T], [m.ox + m.bw, m.oy + G.BOX_T], [m.ox + m.bw, m.oy + G.BOX_B], [m.ox, m.oy + G.BOX_B]], m }))];
      lines.forEach(l => {
        const P = B.segPoly(l.x1, l.y1, l.x2, l.y2, 1.2);
        inks.forEach(s => {
          if (series(l) && ((s.w && s.w.n.kind === 'conj') || (s.m && s.m.mk === 'UC'))) return;
          if (sat(P, s.P)) errs.push(`${tag}: line ${l.k}${l.div ? '/' + l.div : ''}${l.hang ? '/' + l.hang : ''} touches "${s.name}"`);
        });
      });
    }
  }
  return { errs, widths, stats };
}
