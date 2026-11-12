# Learn 4.0: test programme and results

Run everything: `sh tests/run-all.sh` from the site folder (needs Node.js with Playwright and Chromium,
and Python 3 for a local web server). Nothing in the tests touches a real Firebase project or any live site.

## Results of the final run (12 November 2026, headless Chromium, local server)

| # | Suite | What it does | Kind | Passed | Failed |
|---|---|---|---|---|---|
| 1 | `validate-content.js` | Loads all 16 content files (65 courses: the 52 core courses and 13 electives, 307 lessons). Checks structure, 1,057 questions, 539 examination items, and runs **every reference solution and every starter** of 90 graded tasks and 6 interview exercises through the real grader: solutions must pass, starters must fail. | Real engines | 0 problems | 0 |
| 2 | `e2e-studio.js` | Practice studio: every debugging and SQL exercise through the real graders; mutation exercises; five sorting algorithms on 200 random arrays; searches; recursion; then the visualiser and studio UI in a browser; the in-browser language environment check; persistence; phone width. | Real browser | 117 | 0 |
| 3 | `e2e-core.js` | University core: navigation, lessons, quizzes, labs, examinations, grading, locking, transcript, videos list, professor, responsive layouts at four widths. | Real browser | 57 | 0 |
| 4 | `e2e-campus.js` | All six stage finals (fail, retake, pass, persistence), certificates, electives never counting toward stages, departments, career centre, CV builder, study tools, backup and cloud-sync merge, hostile input, service worker cache replacement and offline. | Real browser | 78 | 0 |
| 5 | `firebase-rules.test.js` | 77 allow/deny scenarios against `firebase/database.rules.json`. | **Simulator** | 77 | 0 |
| 6 | `e2e-secure-mode.js` | The real app with a key set: sign-in, identity claim, leaderboard, administrator code creation, redemption, attacks, account upgrade, second device, legacy mode. | **Mocked backend** | 21 | 0 |
| 7 | `e2e-app.js` | App shell under `/Learn/`: page size, no inlined bank, on-demand bank loading, offline failure and retry, no secrets in any shipped file, skip link, keyboard focus, names and labels on the home page, deep links, project milestones, test-out wording. | Real browser | 31 | 0 |

Also re-run from earlier releases, all passing: terminal lessons, extra lesson quizzes, the lesson-track
solution sweep for all in-browser languages, and the phone layout check.

**Totals:** 381 assertions passed and 0 failed across suites 2 to 7, plus the content validator with 0
problems. Of the 381, **98 ran against a simulator or a mocked backend** (suites 5 and 6) and must not be
read as tests of Google's servers. No test was skipped silently or removed to make a suite pass.

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
| Rules in the Firebase Emulator Suite or a real project | The Firebase tools could not be installed and Google is unreachable from the build environment | `docs/FIREBASE_SETUP.md` section 4, in a **test** project |
| Matchmaking, rooms, parties, friends and live matches in secure mode | Need two real signed-in browsers against real rules | Same |
| The eight online languages | Services unreachable | Run the environment check on the live site |
| Video playback (22 videos) | YouTube is unreachable. The first entry's ID (`kCc8FmEb1nY`, Karpathy, "Let's build GPT") was confirmed against public web listings; the other 21 IDs were not re-checked in this release | Open the Videos page and press Load on each |
| The live site (GitHub Pages, Netlify) | Nothing was published | Deploy, then follow `docs/DEPLOYMENT.md` "After uploading" |
| Screen readers (VoiceOver, TalkBack, NVDA) | None available | Manual test. **No screen-reader compliance is claimed** |
| A real iPad or phone | Only emulated screen sizes in desktop Chromium were used | Manual test |
| Safari and Firefox | Only Chromium was available | Manual test |
| Colour contrast across every theme | Not measured systematically | Manual check with a contrast tool |

## Accessibility: what was checked
Automatically: page language and title, a skip link, visible keyboard focus styles, accessible names on
buttons and links and labels on form fields (home page), live regions for results, text alternatives on
the visualiser, no horizontal scrolling at 360 to 1440 pixels, reduced-motion support in the style sheets.
Not checked: screen-reader output, full keyboard operation of every screen, contrast of every theme.

## Performance (measured)
| | 3.1 | 4.0 |
|---|---|---|
| `index.html` size | 10,044 KB | 1,512 KB |
| `index.html` compressed (gzip) | 715 KB | 402 KB |
| Question bank | inside the page | `ranked_extra.json`, 8,548 KB (315 KB gzip), loaded only for Quiz or Multiplayer, then cached |
| DOMContentLoaded, median of 7, CPU slowed 4× | 3,020 ms | 869 ms |
| JavaScript heap after load | 22 MB | 10 MB |

Measured in headless Chromium against a local server sending gzip. Real devices and networks will differ;
the ratio is the useful figure.
