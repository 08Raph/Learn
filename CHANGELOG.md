# Changelog

## 4.4 — 13 November 2026
### Added
- 608 new quiz/multiplayer questions for Java, Go, Rust, PHP, Ruby, Swift, Kotlin and Bash. Those languages now
  have 109–126 distinct questions each (java 126, go 116, rust 114, php 111, ruby 116, swift 109, kotlin 125,
  bash 113). Bank total 5,671 distinct questions; `ranked_extra.json` 1.6 MB (139 KB gzip).
- A worked example in each of the 65 University lessons that had none (Stages 1–6 and the GDV 103, CEN 102,
  CEN 103, MOB 102, MOB 103 and HCI 101 electives). All 327 lessons now contain at least one.
- `tests/check-bank-native.py`: runs bank questions through real compilers and interpreters (python3, node,
  bash, ruby, php, go, rustc, javac). 970 questions checked, 0 mismatches. Not part of `run-all.sh`, because
  it needs those tools installed. Swift and Kotlin are not covered (no compiler was available).
### Changed
- `validate-content.js` now reports any lesson without a worked example or code block.
- `e2e-app.js` 40 → 41 checks: bank of at least 5,600 questions, and at least 100 for each of the eight languages.
- `UNI_VER` 1.6.0; service worker cache `learn-v4.4`.

## 4.3 — 13 November 2026
### Corrected
- The ranked/quiz bank was described as 37,500 questions. It held about 2,869 distinct questions, repeated
  (15 each for Java, Go, Rust, PHP, Ruby, Swift, Kotlin, Bash). Rebuilt `ranked_extra.json`: 5,063 distinct
  questions, no duplicates as shown to players, 200 new hand-written questions for those eight languages,
  unrelated filler code removed, 300 C/C++ items rewritten in valid C/C++, C comparisons answered 0/1.
  Size 8.5 MB → 1.2 MB (94 KB gzip). Every runnable question was executed and checked (`tests/check-bank.js`).
### Fixed
- Quiz and match headings show the real question; non-C languages are no longer wrapped in a C `main()`.
- University Knowledge check layout (a later `.u-check` rule had turned every check section into a row since 3.1).
- Contrast: language badges choose dark or white lettering; SQL and PHP badge colours, difficulty colours,
  Beginner tier, terminal hints and the neon text style adjusted. Audit: 0 contrast failures on 236 page views.
- Tap targets: breadcrumbs, disclosure toggles, workspace icons and file-row buttons, terminal inputs.
- Service worker re-downloads the question bank with `cache: 'reload'` when the cache version changes.
### Added
- Real Python engine switch in the main Playground.
- "Common mistakes" sections and an extra knowledge check in 18 beginner lessons.
- `tests/audit-screens.js`, `tests/check-bank.js`. `e2e-app.js` 31 → 40 checks, `e2e-realpy.js` 17 → 20.

## 4.2 — 13 November 2026
### Added
- Real Python (Pyodide 0.26.4 from jsDelivr) in the University's open Python lab, behind an Engine switch.
  `uni/realpy.js` and `uni/realpy-worker.js`: runs in a Web Worker, 10-second stop with automatic restart,
  `input()` from an input box, tidied tracebacks, falls back to the teaching engine if the CDN is unreachable.
  The service worker keeps Pyodide in its own cache (`learn-pyodide-0.26.4`) that survives app updates.
  Never used for grading.
- Lesson notes: `S.uni.notes`, a box on every lesson, a searchable My notes page with text download; merged
  in backups and cloud sync (newer edit wins); not shown in the portfolio.
- GDV 102, GDV 103, CEN 102, CEN 103, MOB 102, MOB 103: two new lessons and two exam questions each.
### Tests
- New `tests/e2e-realpy.js` (17 checks: MOCKED Pyodide plus a real blocked-CDN test). `e2e-tools.js` 78 → 90.
- **Not tested:** real Pyodide. It could not be downloaded in the build environment.

## 4.1 — 13 November 2026
### Added
- Backup files: download the whole save as `learn-backup-YYYY-MM-DD.json` and restore it with a preview and a
  choice of merge (default) or replace. Untrusted input is validated key by key; prototype keys are dropped.
  The online sign-in identity is not copied into backups. Reminder after 14 days without a backup.
- University → Review: spaced review of missed questions (1, 3 and 7 days, then mastered). Hooked into lesson
  checks, course examinations, stage finals and the weekly challenge; older missed answers are imported.
- Git and terminal simulator (`uni/gitsim.js`, `uni/uni-tools.js`): Unix-style shell with pipes, redirection
  and `&&`, an editor, and a teaching model of Git (status, add, commit, log, show, diff, branch, switch,
  checkout, merge with conflicts and `--abort`, restore, rm, `.gitignore`). Ten graded tasks and a sandbox.
- Career centre → Mock interview: timed 30/45-minute sessions, report, saved history. Six new interview
  coding exercises (12 total), all validated.
- Projects → Portfolio page: printable, section toggles, HTML download; user text escaped, only https links.
- MAT 101, MAT 102, NUM 101, HCI 101: two new lessons each (6 lessons), two new exam questions each.
- Multiplayer → More → Delete my online data (legacy and secure mode).
### Changed
- `firebase/database.rules.json`: an account may now delete its own `owners/<pid>` and `uids/<uid>` records
  (needed for self-service deletion). Nothing else in the rules changed. **Re-test and re-publish the rules
  file** if you have already switched on secure mode.
- Contrast: light-theme code comments `#7b839f` → `#5f6785`; accents Gold, Mint, Amber, Lime darkened.
- Each video records the date its ID and title were last matched against public listings.
### Tests
- New `tests/e2e-tools.js` (78 checks). Rules tests 77 → 85. Secure-mode tests 21 → 27.

## 4.0 — 12 November 2026
### Security
- Firebase Authentication support (anonymous, with optional email and password) through the public REST API.
- Strict Realtime Database rules in `firebase/database.rules.json`: default deny, per-player ownership,
  validated values, administrator-only reward codes, create-once redemptions, append-only audit log.
- Administrator access by a console-managed account list instead of a passphrase in the page (secure mode).
- "Online account" card; legacy mode is labelled as unprotected.
- Opt-in: nothing changes on the live site until the owner sets `FB_API_KEY` and publishes the rules.
- Skip link, wider focus styles, redemption rollback, open-rules setup text removed.
### University
- Ten new department electives (40 lessons, 10 tested assignments, 10 examinations, 10 projects):
  GDV 102, GDV 103, CEN 102, CEN 103, MOB 102, MOB 103, HCI 101, NUM 101, MAT 101, MAT 102.
- Algorithm visualiser: sorting (5), searching (2), stack, queue, binary search tree, recursion (3).
- Practice studio: 6 debugging, 4 code review, 6 SQL, 3 normalisation, 4 test-writing, 4 system-design exercises.
- Language environment check.
- Projects: objectives, five milestones, submission guidance, completion criteria.
- Stage pages and certificates explain testing out versus completing.
### Performance
- Ranked question bank moved out of `index.html` into `ranked_extra.json`, loaded on demand and cached offline.
### Removed
- `ranked_questions.json` (unused).
- `docs/firebase-rules.draft.json` (replaced by the tested rules).
### Tests
- New: `e2e-studio.js`, `e2e-app.js`, `firebase-rules.test.js`, `e2e-secure-mode.js`, `rules-sim.js`.

## 3.1 — 11 November 2026
Departments, career centre, study tools, three electives, attribute-escaping fix, University progress in cloud sync.

## 3.0 — November 2026
Software Engineering University: six stages, 52 courses, 255 lessons, labs, examinations, projects, certificates.
