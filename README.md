# Baseline

Learn to diagram English sentences with the Reed–Kellogg system: 21 short lessons with practice
sentences, a comma and semicolon step, 16 long "Victorian" challenge sentences, a builder that
checks diagrams of your own sentences, flash cards, and a guide.

The app is one self-contained file, `index.html`. GitHub Pages serves it from the top of this
repository. Nothing else is needed to run the site.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The built app (the website). |
| `src/data.js` | Lessons, practice sentences, word-job explanations, glossary terms, comma rules, and all interface text. |
| `src/challenges.js` | The 16 challenge sentences and their levels. |
| `src/engine.js` | The diagram engine: word jobs, layout, SVG drawing, and the sentence checks. |
| `src/builder.js` | The "Build" tab: word jobs to diagram, comma rules from the structure, and the built-in checks. |
| `src/app.js` | The pages, the puzzles, the flash cards, the router, and saved progress. |
| `src/styles.css` | Styles (light and dark). |
| `src/ahn-sub.woff2` | Font: a Basic Latin subset of Atkinson Hyperlegible Next (see `OFL.txt`). |
| `build.py` | Puts the files of `src/` together into `index.html`. |
| `tests/run.py` | The test suite (diagram logic, plain-English text rules, contrast, functions, layout at five screen sizes). |
| `tests/logic.js` | Diagram rules that every sentence must pass (lines do not cross, words do not touch, and so on). |
| `tests/reed-kellogg-1877.txt` | *Higher Lessons in English* (Reed and Kellogg, 1877), Project Gutenberg text. The source for the diagram rules. |
| `tools/` | Small helpers: render diagrams to PNG, a quick logic check, a mutation check, a background test run. |
| `PROGRESS.md` | The development log: what was built and checked, step by step. |

## Change the app

You need Python 3. Node.js is optional (the build uses it to check the JavaScript syntax).

1. Edit the files in `src/`.
2. Run `python3 build.py`. It writes `index.html` here and a copy in `dist/` for the tests.
3. Upload the new `index.html` (and the changed source files) to the repository.

## Run the tests

The tests use Playwright with Chromium:

```
pip install playwright
python3 -m playwright install chromium
python3 build.py
python3 tests/run.py                      # all suites (about 30 minutes)
python3 tests/run.py logic ste builder    # some suites only
```

Suites: `logic`, `ste`, `contrast`, `functional`, `challenges`, `builder`, `cards`, `layout`, `shots`.
Screenshots go to `tests/shots/`.

## Licenses

- The font file `src/ahn-sub.woff2` is under the SIL Open Font License 1.1. See `OFL.txt`.
- `tests/reed-kellogg-1877.txt` is a public-domain book from Project Gutenberg, with its own license header.
