# Learn 5.3: test programme and results

Run everything: `sh tests/run-all.sh` from the site folder (needs Node.js with Playwright and Chromium,
and Python 3 for a local web server). Nothing in the tests touches a real Firebase project or any live site.

## Results of the final run (17 November 2026, version 5.3, headless Chromium, local server)

| # | Suite | What it does | Kind | Passed | Failed |
|---|---|---|---|---|---|
| 1 | `validate-content.js` | Loads all 16 content files (65 courses: the 52 core courses and 13 electives, 327 lessons). Checks structure, 1,155 questions, 559 examination items, and runs **every reference solution and every starter** of 90 graded tasks and 12 interview exercises through the real grader: solutions must pass, starters must fail. | Real engines | 0 problems | 0 |
| 2 | `e2e-studio.js` | Practice studio, visualiser, in-browser language environment check. | Real browser | 117 | 0 |
| 3 | `e2e-core.js` | University core: navigation, lessons, quizzes, labs, examinations, grading, locking, transcript, videos, professor, four screen widths. | Real browser | 61 | 0 |
| 4 | `e2e-campus.js` | Six stage finals, certificates, electives, departments, career centre, CV, study tools, cloud-sync merge, hostile input, service worker. | Real browser | 78 | 0 |
| 5 | `firebase-rules.test.js` | 85 allow/deny scenarios against `firebase/database.rules.json`, including 8 for self-service deletion. | **Simulator** | 135 | 0 |
| 6 | `e2e-secure-mode.js` | The real app with a key set: sign-in, identity claim, leaderboard, administrator codes, redemption, attacks, account upgrade, second device, **delete my online data** (every deletion allowed by the rules, nothing reconnects afterwards), legacy mode. | **Mocked backend** | 27 | 0 |
| 7 | `e2e-app.js` | App shell under `/Learn/`: size, on-demand bank, offline retry, no secrets, skip link, focus, names and labels, deep links, version; **question bank**: count, no duplicates as shown, 4 distinct options and an explanation each, no invalid C/C++ syntax, comparison answers correct, no leftover filler; quiz headings are real questions and capitalised; badge contrast; theme icon; knowledge-check layout. | Real browser | 48 | 0 |
| 8 | `e2e-tools.js` | University search (4.5): finds the right lesson first, highlights words, keeps the query in the address, indexes all 327 lessons, ignores unsafe text. 17 Git-simulator unit checks in Node; all 10 simulator tasks unsolved at start and solved by their sample solutions; a wrong approach failing; the terminal UI (errors, Tab, history, editor, extra keys); spaced review intervals 1/3/7/mastered and clean-up; mock interview (timer, coding marked by tests, time-out, report, history); portfolio (escaping, unsafe links dropped, section toggles, download); backup file and code (download, damaged and foreign files rejected, prototype keys ignored, preview, merge, replace with a second press, round trip); all ten six-lesson electives; lesson notes (autosave, reopen, course order, escaping, search with highlight, markup in searches, download, deletion, kept out of the portfolio, malformed notes dropped); video check wording; contrast of 24 theme colour pairs in both themes and all 21 accent colours. | Real browser + Node | 98 | 0 |
| 9 | `e2e-realpy.js` | Real Python integration. **Part A uses a MOCKED Pyodide** served in place of the CDN file: engine switch, no download until chosen, pinned CDN path, output, `input()`, EOF, tidied tracebacks, endless loop stopped after 10 s with the page responsive, automatic restart, remembered choice, graded exercises never offered it; the main Playground switch (4.3). **Part B blocks the CDN for real**: clear message, switch returns to the teaching engine, code still runs. | **Mocked** (A) / real browser (B) | 20 | 0 |
| 10 | `e2e-mixed.js` | (4.5) Old and new University files mixed: the 4.0 `university.js` with current files (the exact error reported on 13 November 2026), and a current `university.js` with the 4.3 `uni-campus.js`. Checks one automatic repair, no reload loop, the old file named on screen, recovery with Update now; version stamps on every lazily loaded module; the service worker never serving an old saved copy for a newer version (this check **fails with the 4.4 service worker** and passes with 4.5); offline start; the "new version is ready" bar with no forced reload. | Real browser and real service worker, local server | 30 | 0 |
| 11 | `e2e-account.js` | (4.6) Accounts: page with accounts switched off; create account (validation, show password, existing email); progress on the device goes into the account; sign in on a second device combines both devices' progress without lowering XP; Save now; pick-up at start-up; automatic save within 15 s; another account cannot read or overwrite (401); offline message; forgot password (does not reveal whether an account exists); sign out; sign out and clear (two presses, account copy kept, everything back after signing in again); delete account. | **Mocked** Firebase backend enforcing `database.rules.json` with the simulator | 37 | 0 |
| 12 | `e2e-community.js` | (5.0) Ask AI in a lesson (request contents, formatting, HTML not run, busy and offline messages); weekly goal and weekly XP; opt-in weekly leaderboard (only name and XP posted, leave deletes); calendar reminder file; certificate links (only earned courses, name required, record stored, signed-out check page, not alterable even by the owner, unknown and malformed links); classes (create, consent text, wrong code, join stores only name and numbers, teacher view and update, students cannot read the class, leave, remove, delete); account deletion removes classes. | **Mocked** Firebase backend enforcing the rules with the simulator, and a **mocked** AI service | 62 | 0 |

**Totals:** 713 assertions passed and 0 failed across suites 2 to 12, plus the content validator with 0
problems. Of the 713, **281 ran against a simulator or a mock** (suites 5, 6, 9, 11 and 12) and must not be
read as tests of Google's servers. No test was skipped or removed to make a suite pass. In 4.6 the secure-mode mock (suite 6) was
corrected to send the token claims Firebase sends (`auth.token.email` for email accounts); before that, its
account-deletion check failed because the new `saves` rule needs that claim. The check itself was not changed.

## Additional checks run for 5.2
- Challenge reference solutions: run with real CPython 3.13 and Node 22 (all expected values match), and in the app's
  own engines through the challenge page (48 of 48 pass).
- Screen audit: 280 page views (now including Challenges and Stats), 0 problems.

## Additional checks run for 5.1
- Screen audit: 268 page views (now including Practice), 0 problems of any kind.
- Load timing in Chromium with the CPU slowed 4× (local server): first paint about 0.1 s (was about 0.8 s).
  **Not measured on a real iPad or over GitHub Pages.**

## Additional checks run for 5.0
- `audit-screens.js` now also opens This week, Classes, Certificates and a certificate check: 264 page views, 0 script
  errors, 0 overflow, 0 small tap targets, 0 unnamed controls, 0 low-contrast text.
- During this release a "1 FAILED" line was missed once by a lower-case-only filter on the `run-all.sh` output (the
  account suite; the bug it found is fixed, see CHANGELOG). The output is now read case-insensitively.
- **Not tested here:** the new database rules on Google's servers (publish them, then try a weekly leaderboard, a
  certificate link and a class on the live site), and the AI Worker answering lesson questions from the live site.

## Changes to the tests in 4.8
`FB_API_KEY` is now set in `index.html`. The parts that check legacy mode (`e2e-secure-mode.js` last check,
`e2e-account.js` part 0) blank the key in the page they load; the secure-mode parts replace it with a test key
as before. `e2e-app.js` now checks that the key is a public web key (`AIza…`) and that no private or
service-account key ships, and its secret scan allows only that one line. **Sign-in has not been tried against
Google's servers from here** (this workspace cannot reach them): create a test account on the live site once.

## Additional checks run for 4.7

| Check | Result |
|---|---|
| AI Worker logic, in Node with a fake model | Allowed origin 204/200, other origin 403, empty question 400, body over 90 kB 413, 9th request in a minute 429, reply format `{ reply }`. |
| Real model through the Cloudflare API, same settings as the Worker | Answered (about 1.5 Neurons for a two-sentence answer). With the model's thinking left on, it used the whole answer budget on thinking and returned no text, which is why the Worker switches thinking off. |
| Deployed Worker, from a browser on the live site | **Not tested here** (this workspace cannot reach workers.dev). |
| Checks changed because the professor is now connected | `e2e-campus.js` "professor still states no AI model is connected" became "states which AI model is connected"; `e2e-app.js` now expects the built-in tutor's fallback note (external hosts are blocked in that suite). Both describe the new intended behaviour. |

## Additional checks run for 4.5

| Tool | Result |
|---|---|
| `audit-screens.js` (now also opens the Search pages, and no longer counts buttons inside closed panels as unnamed or off-screen file inputs as small) | 244 page views (iPad and phone, light and dark): 0 script errors, 0 overflow, 0 small tap targets, 0 unnamed controls, 0 low-contrast text, 0 images without alt text. |
| Load time | Home page with the CPU slowed 4×: about 0.9 s to DOMContentLoaded from a local server. Network time on GitHub Pages is not measured here. |

## Additional checks run for 4.4

| Tool | Result |
|---|---|
| `check-bank-native.py` (needs python3, node, bash, ruby, php, go, rustc and a JDK installed; not in `run-all.sh`) | 970 questions run with the real tools: 147 Bash/Ruby/PHP and 103 Go/Rust/Java "What does this print?" items, 10 "What happens here?" items that claim a compile error, panic or exception (each really failed), and 710 Python/JavaScript output items. **0 mismatches.** |
| Swift and Kotlin questions | **Not run.** No Swift or Kotlin compiler was available. These 234 questions were reviewed by hand only. |
| `validate-content.js` | Now also requires a worked example or code block in every lesson: 327 of 327 have one. |
| Worked examples on screen | Checked by screenshot at 390 px and 1024 px: no page overflow; on a phone, wide example blocks scroll sideways inside their box, like other code blocks. |

## Additional checks run for 4.3 (tools in `tests/`, need a local server on port 8765)

| Tool | What it found before the fixes | After |
|---|---|---|
| `audit-screens.js`: 59 routes × iPad and phone × light and dark = 236 page views | 0 script errors, 0 overflow; 44 low-contrast text findings (language badges, difficulty labels, Beginner tier, terminal hint, neon text style, workspace file icons); small tap targets on breadcrumbs, disclosure toggles, workspace buttons and terminal inputs | 0 contrast findings; the remaining small-target and "unnamed" findings are known false positives (a visually hidden file input; labelled buttons inside collapsed sections) |
| `check-bank.js`: runs all 2,515 runnable bank questions (Python, JavaScript, TypeScript, SQL, C, C++, C#) | 300 C/C++ questions used invalid syntax or wrong answers; question headings mismatched | All match their marked answers, except 100 C++ `bool` items where the teaching engine prints 1/0 instead of true/false (answers verified separately in suite 7) |
| Question bank audit | 37,500 items but only 2,869 distinct; 34,600 had the question hidden in a comment above unrelated code | 5,063 distinct questions. The 200 new questions for Java, Go, Rust, PHP, Ruby, Swift, Kotlin and Bash were written and reviewed by hand but **could not be run** (no engines for those languages here) |

## Language environments (measured, suite 2)

| Language | Where it runs | Correct program | Faulty program reported | Endless loop stopped |
|---|---|---|---|---|
| Python, JavaScript, TypeScript, C, C++, C# | In the browser (teaching engines) | Passed | Passed | Passed |
| SQL | In the browser | Passed | Passed | Not applicable |
| Java, Go, Rust, PHP, Ruby, Swift, Kotlin, Bash | Public online service | **Blocked: not tested** | **Blocked** | **Blocked** |
| HTML and CSS | Sandboxed preview | Structural checks only | – | – |

The eight online languages could not be tested because the build environment cannot reach the public
code-running services. Their behaviour when the service is unreachable **was** tested: the app reports that
nothing was graded and never marks the work correct. Use Labs → Practice studio → Language environment
check on the live site to test them for real.

The in-browser engines are teaching interpreters. They run the subset of each language that the lessons
use. "Compile failure" for C, C++ and C# means the interpreter rejected the program; no real compiler runs.
Invalid input, wrong answers, runtime errors and time limits are covered by the validator and suites 2 to 4.
Because student code runs in the student's own page, the security boundary is the browser tab: there is no
server to attack and no other user's data in reach.

## Blocked: could not be tested here

| Item | Why | What to do |
|---|---|---|
| **Real Python (Pyodide) itself** | The jsDelivr CDN, npm and PyPI are all blocked from the build environment, so the real Pyodide was never loaded. Learn's integration was tested against a mock (suite 9) | On the live site, with internet: University → Labs → Python → Engine: Real Python. Expect "Real Python 0.26.4 is ready" after the download. Then run `import sys; print(sys.version)`, a program using `input()` with text in the input box, `1/0` (expect a ZeroDivisionError traceback), and `while True: pass` (expect a stop after 10 seconds, then a normal run afterwards). Turn on airplane mode and reload: real Python should still load from the device |
| Rules in the Firebase Emulator Suite or a real project | The Firebase tools could not be installed and Google is unreachable from the build environment | `docs/FIREBASE_SETUP.md` section 4, in a **test** project |
| Matchmaking, rooms, parties, friends and live matches in secure mode | Need two real signed-in browsers against real rules | Same |
| The eight online languages | Services unreachable | Run the environment check on the live site |
| Video playback (22 videos) | YouTube is unreachable. On 13 November 2026 all 22 IDs were matched, together with their titles, against public listings found by web search (MIT OpenCourseWare pages and transcript files, Class Central, video index sites). That shows the IDs are real and point at the named lectures; it does **not** show the videos still play or are available in every region | Open the Videos page and press Load on each |
| The live site (GitHub Pages, Netlify) | Nothing was published | Deploy, then follow `docs/DEPLOYMENT.md` "After uploading" |
| Screen readers (VoiceOver, TalkBack, NVDA) | None available | Manual test. **No screen-reader compliance is claimed** |
| A real iPad or phone | Only emulated screen sizes in desktop Chromium were used | Manual test |
| Safari and Firefox | Only Chromium was available | Manual test |
| Contrast of individual components (focus rings, borders, images, hero gradients) | Suite 8 measures the 24 text colour tokens and 21 accents, not every element | Manual check with a contrast tool |
| Printing the portfolio to PDF on iPad | Printing cannot be automated here | Print it once from Safari |

## Accessibility: what was checked
Automatically: page language and title, a skip link, visible keyboard focus styles, accessible names on
buttons and links and labels on form fields (home page), live regions for results, text alternatives on
the visualiser, no horizontal scrolling at 360 to 1440 pixels, reduced-motion support in the style sheets.
Measured since 4.1: WCAG AA contrast (4.5:1) for all 24 text colour pairs in the light and dark themes and all
21 unlockable accent colours, as text and as button backgrounds. Five colours were darkened to pass.
Not checked: screen-reader output, full keyboard operation of every screen, contrast of every individual element.

## Performance (measured)
| | 3.1 | 4.0 | 4.1 |
|---|---|---|---|
| `index.html` size | 10,044 KB | 1,512 KB | 1,527 KB |
| `index.html` compressed (gzip) | 715 KB | 402 KB | 409 KB |
| Question bank | inside the page | `ranked_extra.json`, 8,548 KB (315 KB gzip), loaded only for Quiz or Multiplayer, then cached | unchanged in 4.1 and 4.2; **4.3: 1,229 KB (94 KB gzip)** after duplicates were removed |
| New University modules | | | `uni-tools.js` 48 KB (16 KB gzip) and `gitsim.js` 37 KB (11 KB gzip), loaded only when Review, the simulator, mock interviews or the portfolio are opened |
| DOMContentLoaded, median of 7, CPU slowed 4× | 3,020 ms | 869 ms (845 ms re-measured alongside 4.1) | 865 ms |
| JavaScript heap after load | 22 MB | 10 MB | 10 MB |

Measured in headless Chromium against a local server sending gzip. Real devices and networks will differ;
the ratio is the useful figure.
