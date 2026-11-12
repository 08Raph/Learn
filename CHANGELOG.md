# Changelog

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
