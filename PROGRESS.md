# Baseline build: progress log (resume from the first unchecked step)
(Reconstructed on 2026-10-12 after a container reset: the source was rebuilt byte-exact from the shipped
outputs/index.html, then the unshipped Step 2 work was replayed from the session transcript.)

Project: /home/claude/baseline  (src/ -> build.py -> dist/index.html; tests/run.py)
Final output: /mnt/user-data/outputs/index.html (sent with SendUserFile).

## Phases 1-3 (2026-10-03 .. 2026-10-11): shipped
- Phase 1: single-file app, 7 lessons, guide, popups, tap-to-place practice, Playwright suite, STE lint.
- Phase 2: practice ramp (starter -> builder -> challenge).
- Phase 3: 10 lessons (helping verbs, very-hook, compound predicate with objects, compound sentences, mixed review);
  R&K 1877 text at tests/reed-kellogg-1877.txt; progress v2 (sentence ids, v1 migration).

## Phase 4 (2026-10-11): user asked for (a) cumulative exercise series per lesson, (b) Victorian-length
## challenge/game section, (c) build-your-own diagram + checking. Goal: mastery incl. commas.
Plan: Step 1 = exercises + comma step (this session). Step 2 = advanced grammar lessons (clauses, verbals,
appositives, semicolons) + Challenges game (this session, after step 1 ships). Step 3 = builder + checking
(separate; ask user: Anthropic API key vs copy-to-Claude vs offline checks).
- [x] S1.1 Verified comma rules (Purdue OWL extended rules; CMOS faq0030 short intro phrase, faq0077 serial comma)
  + R&K 1877 Lesson 20 series convention (x = understood conjunction, "and" between last two).
- [x] S1.2 series authored: L1 5, L2 7, L3 7, L4 7, L5 7, L6 8, L7 8, L8 8, L9 8, L10 10 (74). cm/trap annotations.
- [x] S1.3 comma step (commaInfo in engine; hidden commas, tap-to-add, rule feedback, 'c:key' in done), comma notes L2/L4/L6/L7/L9, Guide comma rules, series x marks (t:'mark', LINES.UC).
- [x] S1.4 full suite 0 failures (457 s; 34 comma steps x 2 viewports); dots wrap fix; shipped step 1

## STEP 2 design (advanced grammar + Victorian challenges) — verified conventions (R&K 1877 = tests/reed-kellogg-1877.txt)
- OC (objective complement): modern (Moutoux basicdiagrams36-40 "newer method"; Grammar Revolution): AFTER the DO,
  preceded by a backslash leaning toward the DO (like CL). R&K L31 traditional: before the DO (note in About).
- Appositive: R&K L33 "favorite (Raleigh)" in parentheses after the noun, same line; GR: "in parentheses after the noun".
  Comma (R&K L34): set off when not restrictive.
- Independent (R&K L44; GR "float above the sentence on their own line"): direct address, interjection, expletive
  "there", absolute phrase (noun + participle), each on its own line above, unconnected. Comma L45: set off
  (except expletive "there", never set off).
- Participle (R&K L37): broken line under the noun: slanted part + horizontal part (draw rounded bend; word on the
  horizontal part); its DO after a DO line; mods below. Comma L39: set off unless restrictive; intro -> comma.
- Gerund (R&K L38): stepped line; as subject/DO on a pedestal "/ \" + stem above the slot; as OP directly at the prep
  slant end. Absolute phrase stands by itself (L38 ex 14).
- Infinitive (R&K L40-41): "to" on a slant + verb on horizontal (like prep phrase) as adj/adv modifier; as noun on
  a pedestal. Purdue: intro infinitive phrase -> comma.
- Adjective clause (R&K L59-60): own baseline below; relative pronoun in its own job; DOTTED SLANTED line joins it
  to the antecedent. Comma L61: set off when not restrictive ("that" clauses restrictive).
- Adverb clause (R&K L64 "because ... stands on a line wholly dotted"; GR "diagonal dotted lines"): dotted slanted
  line from the modified verb to the clause verb, conjunction ON it. Comma L66 + Purdue: intro clause -> comma;
  trailing restrictive clause -> no comma. (R&K's 3-part lines for when/where/as simplified; note in About.)
- Noun clause (R&K L71): clause on a pedestal in the noun slot; "that" on a short line above, dotted line down to
  the clause verb. Comma L73 remark: no comma for subject/object clauses (modern).
- Compound-complex: N clauses, step connectors; "x" on a step = understood conjunction (R&K L78 diagram, line 6197).
  Semicolons: R&K L77; Purdue commas_vs_semicolons: semicolon joins independent clauses with no connecting word;
  before conjunctive adverb (however/therefore) with a comma after it.
Engine plan: node types {app}, {part}, {ger}, {inf}, {nc}, {ac}, {sc}; sentence-level ind:[ADDR/INTJ/EXPL/ABS];
  clause OC; clauses N with conj array ('x' = semicolon). Local layouts: OC, AP (parens marks), PART (bend path),
  INF modifier, pedestal blocks (GER/INF/NC in S/DO/PN/OP), independent elements on top. Global "hang" placement for
  AC/SC: items {t:'hang'} resolved after clause assembly by search over depth x angle (AC 40-75deg, SC 55-75deg),
  obstacles = existing item polygons; verb lines with SC get leftReserve 48 per SC; anchors left of first child.
Lessons 11-21: OC, Appositives, Independent words, Participles(+absolute), Gerunds, Infinitives, Adjective clauses,
  Adverb clauses, Noun clauses, Compound-complex+semicolons, Advanced review. Then Challenges (game: levels, stars,
  hints) with Victorian-length sentences. Comma step: tap cycles none -> , -> ; for lessons >= 20 and challenges;
  ctx note for restrictive vs nonrestrictive.
- [x] S2.A engine rewritten (src/engine.js ~700 lines): A_head/A_mod/A_verbal annotate; collect(); commaInfo with ',' and ';'
  (req/opt are Maps i->mark); L_h lanes (conn/arr/intro + hang lanes), apps (paren marks), L_part (curve), L_infmod,
  L_gerLine (step), L_ncBlock (intro + dashed), L_ped (pedestal, stemX nearest middle), L_slot, L_clause (OC/OCL),
  placeHang/resolveHangs (below everything; angles; ink collision), layout N clauses + x (UCS) + independent elements.
  24 samples x_* in SENT render correctly (visual check a1-a6). app.js comma step handles ';' (P.semi), sp.ctx note.
- [x] S2.B tests: tests/logic.js (LOGIC v3, loaded by run.py): per-clause SV (SV line tagged clause), complement/OCL counts incl.
  verbals, INFTO/PREP/IO/CONJ/N-clause joins (x = UCS mark), AP parens, IND above (items tagged ind), PART bend (node tags),
  GER step, pedestals (node/stem tags; stem not under a divider foot), NC intro dashed line, AC/SC hang lines, model-level
  tap-area overlap + line-vs-box. Engine fixes found by it: stemX avoids divider feet; AC ext line length per angle (clears clause).
  CI_JS returns entries; put_mark clicks twice for ';'. UI: cm*Semi strings ("marks"). STE: "subordinating conjunction" allowed name.
  Mutation check (scratchpad mutate2.py): 9/10 caught (AC lane 0 is benign).

## 2026-10-12 RESTORE (container reset wiped /home/claude/baseline; outputs/index.html = shipped Step 1 survived)
- Rebuilt src byte-exact from outputs/index.html (build output identical); build.py from transcript; tests/run.py
  from a recorded full read; R&K text re-downloaded.
- Replayed the recorded Step 2 tool calls 0435..0621 from the session jsonl
  (/root/.claude/projects/-home-claude/<session>.jsonl); every output matched the original except timings.
  Replay tools: scratchpad tx/ (extracted calls), replay.py. Helper scripts copied to tools/.
- Backup of the restored state: /home/claude/baseline-restored-0621
- State at restore: lessons 11-21 content in data.js (p11, p14, p17, p20); last open issue: rv5 "lines cross"
  (reserved strip debug). build.py takes an optional output path (stage builds); dist/index.html may be stale.
- User was told (2026-10-12): Step 1 is in their file; Step 2 work restored and continuing; builder = Step 3, ask
  about checking method then.
- [x] FIX rv5 (2026-10-12): resolveHangs returns clean/fallback; layout tries (1) default clause-line strip, (2) other
  start points on the verb line (vx1 from L_clause), (3) "high step": step just below the clause's own items, running right
  past the dependent clauses (me.stepY / me.stepTo); next clause below everything. Logic+STE: 0 errors (207 sentences).
- [ ] FULL SUITE on 21 lessons (tools/runfull.sh -> tools/out/t-full.txt), fix failures
- [ ] CHALLENGES (Step 2 part 2): design below

## 2026-10-12 CHALLENGES content (Step 2 part 2)
- [x] src/challenges.js: v01-v16 (34..108 words), CHALLENGES ladder (4 tiers), TIERS. In build.py after data.js.
- [x] Fixed parens; v16 appositive moved next to "house"; American spelling (traveler, traveled, quarreled, gray).
- [x] Engine: L_part / L_infmod / gerund-in-prep lengthen their slant for tall complements (compound objects).
- [x] Engine: resolveHangs tries leftmost-first order when rightmost-first fails (v05 puzzle).
- [x] Engine: stemX keeps 7px clear of line ends and 16px from divider feet (v14 stem looked joined to "darkness").
- [x] Logic rule 9 relaxed per R&K L76 ("merely for convenience"): join line starts on the verb part of the
      predicate (layout exports clauses[].vx1). Stage logic: 223 sentences, 0 errors.
- [ ] Challenges UI (nav tab, ladder, puzzle view with zoom, hints, stars, saved state, comma step)
- [ ] Tests for challenges; full suite; ship; ask Step 3 checking question

## 2026-10-12 CHALLENGES UI (Step 2 part 3)
- [x] Nav "Challenges" (fits 320px: 15px font below 23.5rem). Routes #/challenges (ladder, 4 tiers, stars) and
      #/challenge/N (puzzle). Home section + lesson 21 pager + last practice "next" go to challenges.
- [x] Puzzle: next word auto-ready (reading order) with context + Skip; filled box gives its word back;
      partial Check (wrong + empty counts); Hint = green box for the ready word (or marks a wrong box);
      stars 3 (<=1 check, 0 hints) / 2 (<=3 checks, <=1 hint) / 1; Show answer = no stars; Try again;
      attempt + best stars saved (localStorage 'baseline-challenges-v1'); reset clears it.
- [x] Big sheet: 2-way scroll (max 70vh), zoom - / Fit / + , mouse drag to move; wide on desktop (breakout).
- [x] Comma step with semicolons for all challenges.
- [x] Perf: findHang block test without shifting items (v12 585 -> ~300 ms); scan probes use one search
      order and budget 20; challenge layout deferred (placeholder) + idle precompute.
- [x] Draw-in animation capped at ~2.5 s (--step). [hidden] now really hides (.bank had display:flex).
- [x] dynLine PREP: a phrase that modifies a predicate adjective works as an adverb.
- [x] Tests: challenge_suite (ladder, partial check, hint, reload, stars, retry, show, skip, zoom, solve all 16
      with 3 stars + marks), layout suite covers ladder + each challenge (empty, shown), GEOM clip-aware in both
      directions; functional fixes (semicolon trap removal, last practice -> challenges, nav).
- [ ] Full suite run (functional, layout, shots) -> fix -> ship to outputs; ask Step 3 checking question.
- [x] FULL SUITE GREEN (exit 0, 1654 s): logic, ste, contrast, functional, challenges, layout (5 viewports), shots.
      Test fix: target spacing only counts neighbors in the same scroll box (clipped dividers sat under comma chips).
      Challenge list openings hide the marks. Shipped dist/index.html -> /mnt/user-data/outputs/index.html (272 KB).
- [ ] NEXT: Step 3 builder. Ask the user: checking by built-in rules / own API key / copy to Claude.

## 2026-10-12 STEP 3: BUILDER (user chose built-in rules only)
- [x] src/builder.js (between engine.js and app.js in build.py): parseSentence, bGraph, specFromJobs (jobs -> spec,
      draft "?" parts, conjunctions by position), jobsFromSpec + canonSpec (tests), commaRules + gradeMarks
      (marks from structure), checkBuild (jobs/links/word forms/pronoun case/linking verbs/engine limits, then marks).
- [x] Engine: derived nodes carry tok (prep, aux, conj, cconj, sub, nci, infto) for tapping the user's diagram.
- [x] Round trip: all 223 SENT specs -> jobs -> spec give the same canon; their marks pass; every hand-written cm/trap
      rule id matches the builder's rule (scratchpad rt.js / rt2.js). checkBuild: 0 errors, 0 warnings on all 223.
- [x] data.js: JOBS, JOB_GROUPS, JOB_ASK, CLAUSE_KINDS, SLOTS, INF_USES, JOB_NEED, B_MSG, UI.b* (in steTexts).
- [x] app.js: #/build view (sentence form, word chips with job tags, live zoomable diagram, Check, results with
      mark rules, Show the answer for lesson sentences), job dialog #bdlg (jobs, clause kind, slot, extra info,
      coord question, command, link picker with suggestions), saved in 'baseline-build-v1', reset clears it.
- [x] Nav "Build" (5 links; compact 15px nav up to 30rem; no overflow 320-1024).
- [x] Screenshot review; fixes: directional link suggestions + autoFill when a target appears; diagram redraw on dialog close;
      tags show clause kind / verbal use; home links to the builder; marks still checked with word-form errors.
- [x] Tests: builder suite (round trip 223, rule ids, mistakes caught: missing/extra/splice/noJob/link/pronoun/restrictive,
      UI flow at 360 and 1280), layout audit of #/build states + dialog (0 warnings); GEOM: .bw chips check each line.
- [x] Full suite green (exit 0, 1653 s): logic, ste (3387 texts), contrast, functional, challenges, builder, layout, shots.
- [x] Shipped dist/index.html -> /mnt/user-data/outputs/index.html (347 KB). All three steps done.

## 2026-10-13 FLASH CARDS
- [x] #/cards (nav "Cards"; nav is a 3x2 grid up to 40rem): decks Grammar terms (TERMS, 46), Diagram lines (KEY with
      ICON pictures, 11), Comma rules (COMMA_NAMES fronts + COMMA text + shortest SENT example with the mark, 32), All.
      Lesson filter (first lesson that teaches each card, computed), Term/Definition first, flip (3D, visibility at mid
      turn, reduced motion), I knew it / Study again, Shuffle, done + restart, list of all cards; known set saved
      ('baseline-cards-v1'); reset clears it; home links to it.
- [x] Tests: cards_suite (360, 1280), nav test, layout audit of card states (0 warnings).
- [x] Full suite green (layout ok; builder timing fix: Done draws before close), shipped to outputs.

## 2026-10-13 SOURCE PACKAGE
- [x] README.md, OFL.txt (font license), .gitignore; tools use paths relative to the project; build.py writes
      dist/index.html (tests) and index.html (GitHub Pages). Obsolete one-off scripts (tools/patches, smoke, timing,
      mutate2) left out of the package.
- [x] outputs/baseline-source.zip (24 files): a fresh unzip rebuilds an index.html byte-identical to the shipped one,
      and logic, ste, and contrast pass from it.

## 2026-10-13 ADJECTIVE COMMAS (lesson 2)
- [x] User: the old text ("describe a noun equally", "must stay in their order") left too much unstated.
- [x] Sources checked: Reed & Kellogg 1877 (tests/reed-kellogg-1877.txt) Lesson 12 footnote ("That old wooden house":
      each adjective limits the noun as the words after it modify it), Lesson 13 ("A tall, straight, dignified
      person" vs "Two honest young men": "and may be supplied"), Lesson 21 comma rule ("The old oaken bucket": no
      comma, no conjunction omitted); Purdue OWL (both tests, never a comma between the final adjective and the noun);
      CMOS 6.36 via CMOS Shop Talk (the "and" test and the order test; a noun that forms a unit of meaning);
      Macmillan Writer's Help ("No comma between cumulative adjectives"); Cambridge adjective order.
- [x] Lesson 2: "Commas between adjectives" = 7 numbered steps (find the noun; never after a/an/the/my/this/two/some;
      never before the noun; the "and" test and the order test at each other place; both yes = comma), 3 worked
      examples (long cold winter, little red car, hot bright summer sun), why (coordinate vs cumulative, R&K "rank"),
      a shortcut (color, country, material, noun as adjective), the diagram note. "Yesterday," has its own heading.
- [x] TERMS: coordinate adjectives, cumulative adjectives (flash cards). COMMA: coord/cumul state both tests; new rules
      det and adjNoun (COMMA_NAMES, GUIDE_COMMAS). New lesson 2 sentences: boat, pines, sunhot; winter has det/adjNoun traps.
- [x] Builder: "little" is not a determiner any more; det/adjNoun notes when a noun has two or more adjectives; adjWhy()
      explains an extra mark after "the" or before the noun anywhere (rules.why); the job dialog shows the two tests with
      the words of the sentence ("long and cold winter" / "cold long winter"): Both sound correct (comma) / Not both.
- [x] Lesson and challenge comma steps: an extra mark that the data does not name gets the builder's rule (autoWhy).
- [x] Tests: builder suite (dialog tests, answers, comma after "The"), functional (extra commas in "chew" get cumul and
      det), layout audit of the winter dialog.

## 2026-10-13 ADJECTIVE COMMAS: THE DEFINITION (lesson 2, second pass)
- [x] User: the tests still feel like "feel"; is coordinate defined anywhere? Research:
      Quirk et al. 1985: 1340 (zones: precentral non-gradable, central gradable, postcentral colour and participles,
      prehead provenance/denominal/nouns; no coordination of premodifiers from different categories, via Pastor
      Gomez 2009); Feist 2011 (CUP): Reinforcer > Epithet > Descriptor > Classifier zones, "multiple premodifiers
      within one zone are co-ordinated", "earlier words modify all the later words as a group"; Sproat & Shih 1991
      (order restrictions only for hierarchical modifiers; comma intonation = parallel, free order); Matthews 2014
      (each dependent forms a binary constituent with what follows); Payne 2025 (CGEL-style labile order Evaluative >
      General Property > Age > Colour > Provenance > Manufacture > Type); Scontras et al. 2017 (less subjective
      adjectives nearer the noun); AP Stylebook ("equal in rank"; "integral element of a noun phrase").
- [x] Lesson 2 rule: look at the second adjective of each pair: shape, age, color, origin, material, or type = no
      comma; opinion, size, or quality = comma (plus no comma after a/the/my/two and none before the noun). Group
      list, examples, why (unit vs. each alone), the few exceptions (nice big, little girl, two colors), the tests
      as a check. All 18 adjective pairs of the app's sentences agree, after "hungry little puppy" -> "hungry brown
      puppy" (chew).
- [x] COMMA coord/cumul, COMMA_NAMES, GUIDE_COMMAS, TERMS use the groups. Builder: B_FACT groups + capital letter =
      origin; coordOf() gives "no comma" before known group words (a comma between two words of one group) and asks
      about the others; the dialog shows the rule and the two tests with the sentence's words.
- [x] Tests: builder suite checks the groups (little, red / Italian / red, white / cold asks).

## 2026-10-13 ADJECTIVE COMMAS: JUDGMENT WORDS AND FACT WORDS; ZIP UPLOAD WORKFLOW
- [x] Lesson 2 uses the plain terms from the explanation: judgment words (opinion, size, quality; two people can
      disagree) and fact words (shape, age, color, origin, material, type; they sort the thing into a kind); three
      zones ("the"/"my", judgment words, fact words nearest the noun); the "can two people disagree?" test; "dark"
      night vs. "dark" coat; age as a fact word; the and/order tests; a 7-adjective example. TERMS: judgment word,
      fact word (flash cards); COMMA coord/cumul, COMMA_NAMES, GUIDE_COMMAS, builder dialog use the terms.
- [x] New practice sentence sportscar: "A beautiful, expensive, fast new red Italian sports car stopped suddenly."
- [x] tools/zip-upload.yml: GitHub Actions workflow (checkout v7, upload-pages-artifact v5, deploy-pages v5; Node 24).
      On any push to main: unpack each uploaded zip over the repo (tar, never deletes, skips .git/.github, unwraps
      one wrapper folder like baseline-source/), remove the zip, python3 build.py, commit "new bulk zip upload
      updated codebase" (or "rebuild index.html from the source files"), deploy _site/index.html to Pages. Pages
      source must be "GitHub Actions": GITHUB_TOKEN pushes do not trigger branch Pages builds (GitHub docs).
      Simulated locally with a bare remote (scratchpad/wftest.sh): zip upload, no zip, a flat zip with one folder.
- [x] README: one-time setup and upload steps; .gitignore: _site/.
