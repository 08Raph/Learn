# Learn 4.2: security review

Reviewed: the whole client application (`index.html`, `sw.js`, `uni/`), its use of the Firebase Realtime
Database and Firebase Authentication, the GitHub cloud-sync feature, the online code runners and the
optional AI endpoint examples.

**Nothing in this release changed any live service.** No database rules were published, no Authentication
setting was changed, no data was read, written or deleted in your Firebase project, and no credentials were
created. Items marked MANUAL need you to act.

## Summary

| Area | State in 4.2 |
|---|---|
| Multiplayer database open to the world | **Fix built and tested locally; not live until you switch it on** (MANUAL, `docs/FIREBASE_SETUP.md`) |
| Administrator access | Client-side passphrase replaced by a Firebase account listed in a console-only node (secure mode) |
| Reward codes | Administrator-only creation, one redemption per account, audit log (secure mode). Total redemptions and reward amounts still not server-enforced |
| Leaderboards | Other players' entries protected (secure mode). A player's own score is still self-reported |
| HTML injection through attributes | Fixed in 3.1, re-tested in 4.0 |
| Secrets in the release | None. Scanned by `tests/e2e-app.js` |
| Restoring a backup file (4.1) | The file is untrusted input: only known keys with the right types are read, `__proto__`/`constructor`/`prototype` keys are dropped while parsing, dates are validated, a preview is shown before anything changes, and the sign-in identity is never written into backups. Tested in `tests/e2e-tools.js` |
| Self-service data deletion (4.1) | Rules allow an account to delete only its own `owners`/`uids` records; another account cannot. Background requests are paused during and after deletion so no new identity is created behind the player's back. Tested in suites 5 and 6 |
| Real Python (4.2) | Pyodide is loaded from a version-pinned jsDelivr URL into a dedicated Web Worker, with no access to the page, its storage or the save. Output is shown as text. A CDN compromise could change what the worker runs, but the worker cannot read Learn data; Subresource Integrity is not available for `importScripts`. Off by default; never used for grading |
| Git and terminal simulator (4.1) | Pure in-memory model: no `eval`, no real shell, no network, no access to the device's files. Output is inserted as text, never as HTML |

## Fixed or built in this release

| # | Finding | Severity | What was done |
|---|---|---|---|
| 1 | The Realtime Database had to be world-readable and world-writable because the app sent no credentials. | **Critical** | The app can now sign in with Firebase Authentication and send an ID token with every request. Strict rules are provided in `firebase/database.rules.json`: default deny, per-player ownership, validated values. Opt-in: active only when `FB_API_KEY` is set **and** you publish the rules. |
| 2 | Administrator mode relied on a passphrase hash checked in the browser. | **Critical** | In secure mode there is no passphrase. Administrator tools appear only for accounts under `duel/admins/<uid>`, which only the Firebase console can write, and the rules enforce the same on every administrator write. In legacy mode the old form remains, with a red warning that it protects nothing. |
| 3 | Anyone could create, list, edit or delete reward codes, and redeem one repeatedly. | High | Secure mode: administrators only may create, list or delete; a player may add a single create-once redemption marker for their own ID on an unexpired code. |
| 4 | Anyone could forge another player's name, presence, friends or leaderboard entry, or delete all data. | High | Secure mode: each path is writable only by the account that owns the player ID; everything unlisted is closed. |
| 5 | No record of administrator actions. | Medium | Append-only `duel/audit` log of code creation, deletion and redemption, readable by administrators. It records the account ID, the action and a short detail; no private messages. |
| 6 | A failed reward redemption could leave a marker without the reward. | Low | The marker is removed if applying the reward fails. |
| 7 | The setup text in the app told owners to publish fully open rules. | Medium | Removed. It now points to the rules file and the setup guide. |
| 8 | (3.1) `esc()` did not escape quotes: attribute injection in profile and CV fields. | High | Fixed in 3.1; regression-tested again. |

## Open findings

### A. Secure mode is not live — MANUAL (Critical until done)
Until you follow `docs/FIREBASE_SETUP.md`, the live database is exactly as exposed as before. This cannot
be done for you: it needs your Firebase console, and you asked that production not be changed without
your approval. The rules were tested with a local simulator and a mocked backend (98 checks), **not** with
the Firebase Emulator or a real project. Verify them in a test project first (section 4 of the guide).

### B. Scores and rewards are computed in the player's browser (High, by design of a static site)
Even in secure mode a player can report any rating up to the cap for themselves, grant themselves XP or
items locally, and redeem a code regardless of its intended total limit. Fixing this needs trusted
server-side code (`docs/COMMUNITY.md`). Treat leaderboards and rewards as entertainment.

### C. First-come ownership of existing player IDs at migration (Medium)
See "What happens to existing players" in the setup guide, including how to undo a wrong claim.

### D. Legacy-mode administrator hash still ships (Low once secure mode is on)
`ADMIN_HASH` remains so that legacy mode keeps working. After you switch to secure mode it is never used.
It can be guessed offline; do not reuse that passphrase anywhere.

### E. GitHub cloud sync keeps a personal access token in the browser (Medium)
The token the user pastes is kept in `localStorage`. Any script running on the page could read it. Advise
users to create a **fine-grained token limited to Gists** and to revoke it if a device is lost.

### F. Firebase ID and refresh tokens are kept in the browser (Low)
Secure mode stores the Firebase refresh token in `localStorage` (`learn-fb-auth`) so that the player stays
signed in. This is how Firebase's own SDK behaves. The token gives access only to that player's data.

### G. Progress, grades and certificates can be edited by the student (by design)
All academic progress is in the browser. The transcript and every certificate say so. **Do not use these
records for any official purpose.**

### H. Third-party code runners receive the student's code (Low)
Java, Go, Rust, PHP, Ruby, Swift, Kotlin and Bash are sent to public services (Judge0 CE, Piston, Wandbox).
The app says so. Nothing else is sent.

### I. No abuse controls beyond the rules (Medium)
There is no rate limiting, no App Check and no email verification. Anonymous accounts can be created
freely. Firebase App Check (free) would make scripted abuse harder and is a sensible next step once secure
mode is live.

## Administrators and privacy
Administrators can: create and delete reward codes, list codes, read the audit log, and, through the
Firebase console, see account IDs and any email a player chose to add. The rules give administrators **no**
read access to players' inboxes, friend lists or invitations, and the app has no screen for it. (The
project owner can always read the whole database in the Firebase console; that is inherent in owning it.)

## Reviewed and found acceptable

- **Code execution:** browser-run languages use interpreters written for this app; JavaScript runs through
  `new Function` in the page with a loop limit. A student can only attack their own session. HTML previews
  use a sandboxed iframe with no script permission.
- **University content:** course text is escaped before markdown is applied; links must be `https://`.
- **User input in the University:** names, CV fields, project notes and links are escaped on output; links
  are validated; the saved state is sanitised on load because a restored backup is untrusted input.
- **Service worker:** caches same-origin GET requests only; never caches database or API traffic.
- **AI Professor:** no key, no provider URL and no network call ship with the site. The endpoint examples
  keep the key in server environment variables, check the origin, cap sizes and rate-limit.
- **Practice studio (4.0):** students' test cases are parsed as JSON and never executed; exercises run through the same sandboxed engines as course work.
- **No secrets found** in the release: checked automatically for private keys, service-account files and API-key patterns.

## Not possible on static hosting

A Content-Security-Policy that forbids inline script and `eval` would be the strongest defence against
injection, but the app is one inline script and its JavaScript lessons need `eval`. Splitting the app into
files would allow a useful policy; that is a large refactor and was not done.
