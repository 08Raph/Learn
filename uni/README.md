# 🎓 Software Engineering University: maintainer's guide

The University is an extra section of Learn. It is plain HTML, CSS and JavaScript, with no framework and no
build step. It is loaded only when someone opens `#/uni`, so the rest of the site is not slowed down.

> The University is **not an accredited institution** and does not award degrees. It offers a structured
> learning pathway and its own completion certificates, and every page says so.

## What is in the folder

| File | What it does |
|---|---|
| `university.js` | Core: state, routing, the content parser, home, dashboard, catalogue, course and lesson pages, video centre |
| `uni-assess.js` | Loaded on demand: labs and the grader, examinations, stage finals, projects, portfolio, transcript, certificates |
| `uni-professor.js` | Loaded on demand: the AI Professor (built-in tutor, plus the optional server endpoint) |
| `university.css` | All University styles. Uses the site's existing colour variables, so every theme works |
| `config.js` | The only settings file. Holds the optional AI endpoint URL. **Never put a key here** |
| `data/catalog.js` | The 6 stages and 52 courses: titles, objectives, prerequisites, references |
| `data/stage1a.txt` … `stage6b.txt` | The course content: lessons, knowledge checks, labs, exams, projects |
| `data/videos.js` | The video library |
| `data/tutor-kb.js` | Glossary, error explanations and practice material for the built-in tutor |
| `uni-campus.js` | Loaded on demand: departments, career centre (skill gaps, CV builder, interview practice), My study (goal, bookmarks, history, achievements, weekly challenge) |
| `data/departments.js` | The 8 departments, the elective courses, career roles and interview exercises |
| `uni-studio.js` | Loaded on demand: algorithm visualiser, practice studio, language environment check |
| `data/electives.txt`, `electives2.txt`, `electives3.txt`, `electives4.txt` | Content of the 13 elective courses (same format as the stage files) |
| `ai-endpoint-example/` | Server-side examples for connecting a real AI model |

`index.html` contains only small hooks: the `#/uni` route, the home-page button and banner, and a loader.

## Routes (all under the existing hash router)

`#/uni` home · `#/uni/dashboard` · `#/uni/courses` · `#/uni/stage/3` · `#/uni/course/c301` ·
`#/uni/course/c301/lesson/0` · `…/lab` · `…/exam` · `…/project` · `#/uni/final/3` · `#/uni/labs` ·
`#/uni/exams` · `#/uni/projects` · `#/uni/videos` · `#/uni/transcript` · `#/uni/professor` · `#/uni/departments[/game]` · `#/uni/career[/role/backend|cv|interview|present|guide]` · `#/uni/study[/challenge]`

All file paths are relative, so the site works at `/Learn/` on GitHub Pages and at the root on Netlify.

## Departments and electives

A department is a recommended pathway through existing courses for one discipline. Departments never change
the six stages. **Elective courses** (`UNI_CATALOG.electives`) are real courses with lessons, a tested
assignment, an examination and a project, but they do not count toward stage completion, graduation, or the
"52 courses / 255 lessons" totals. To add one: add an `El(...)` entry in `data/departments.js`, a `#COURSE`
block in one of the `data/electives*.txt` files (set `file:` on the catalogue entry), and run
`tests/validate-content.js`. Practice-studio exercises live in the data section of `uni-studio.js` and are
checked by `tests/e2e-studio.js`.

Game Development, Computer Engineering and Mobile Development each have one dedicated course so far. Their
department pages say what is not covered. Do not add a department page without real course content behind it.

There are no shared leaderboards, teams or tournaments in the University. Those need a server that verifies
results; University progress lives on the student's device. The weekly challenge is a personal record.

Other documents: `docs/SECURITY.md`, `docs/PRIVACY.md`, `docs/DEPLOYMENT.md`, `docs/TESTING.md`,
`docs/ACADEMIC_AUDIT.md`.

## How progress works

- A lesson is complete when every knowledge check is answered correctly (and its exercise passes, where the
  language runs in the browser).
- A course is complete when all lessons are done, the programming assignment passes its tests, the examination
  is passed at **70%**, and the project is submitted.
- A stage unlocks when the previous stage's **final examination** is passed at **75%**.
- Retakes are unlimited and every attempt is recorded.
- Written answers and projects are **self-assessed against a published rubric**. This is stated to the
  student. It is not equivalent to marking by a human examiner.
- Progress is stored in the browser (`localStorage`, inside the existing save data) and is included in the
  backup code. Because it is stored on the student's device, it can be edited by the student. **Do not treat
  these grades or certificates as proof for any official purpose.** That would need a server.

## Adding or editing course content

Content lives in the `.txt` files so that it can be edited without touching code.

```
#COURSE c101
#LESSON Title of the lesson | 12            (12 = minutes)
Markdown text: ### headings, lists, tables, **bold**, `code`, fenced code blocks,
```diagram blocks for ASCII diagrams, and callouts starting "> Key idea:", "> In industry:", "> Warning:".
#Q A knowledge-check question?
- a wrong option
* the right option            (exactly one line starts with *)
! Why it is right.
#TRY py | Prompt for an in-lesson exercise   (then @starter, @solution and @tests or @out)
#LAB js | Title of the programming assignment
Brief in markdown.
@starter
…code…
@solution
…code…
@tests
add(2, 3) => 5
inv.count("pen") => 5 ;; inv = Inventory()\ninv.add("pen", 5)      (optional setup after ;;)
@hints
One hint per line, shown one at a time.
#EXAM 20                                     (minutes)
#Q …                                         (multiple choice, 1 mark)
#C js | A coding question                    (3 marks; needs @starter, @solution, @tests)
#W A written question                        (2 marks, self-assessed)
+ A rubric line
#PROJECT Title
Brief.
@requirements / @deliverables               (one per line)
@rubric
Criterion | 25
```

SQL tasks use `@setup` and `@rows`; HTML tasks use `@checks`; C, TypeScript and the online-only languages use
`@out` (expected output). To add a course: add a `C(...)` entry in `data/catalog.js` and a `#COURSE` block in
a stage file. Then bump `UNI_VER` in `index.html` and the cache name in `sw.js`.

**Version stamps (since 4.5).** When `UNI_VER` changes, change three things together, or the University will
refuse to load the mismatched file: `UNI_VER` in `index.html`, `const BUILD` in `uni/university.js`, and the
`window.LEARN_MOD_BUILD[...]` line at the top of every file loaded with `loadMod()` (`uni-assess`, `uni-campus`,
`uni-professor`, `uni-studio`, `uni-tools`, `realpy`). `tests/e2e-mixed.js` checks that they agree.

**Rules that keep it honest:** every lab must have a `@solution` that passes its own tests and a `@starter`
that does not. Do not add empty courses or placeholder lessons.

## Adding a video

Edit `data/videos.js`; the rules are at the top of that file. Only add videos you have opened yourself that
are published by their rights holder. Never download or re-host a video, and never guess an ID.

## The AI Professor

No AI model is connected. The professor is a built-in tutor made of rules and the course text; the page says
this clearly. To connect a real model later, read `ai-endpoint-example/README.md`. The key must stay on a
server you control.

## Known limits

- **Code that runs in the browser:** Python, JavaScript, TypeScript, C, C++, C# and SQL (plus HTML/CSS checks).
  These work offline and are graded by real tests.
- **Java, Go, Rust, PHP, Ruby, Swift, Kotlin and Bash** need the site's free online code runner and an
  internet connection. If the service is down, the lab says so and is not marked. For that reason the Rust
  assignment is optional and never blocks progress.
- The Python engine is a teaching interpreter, not full CPython: no third-party packages, and whole numbers
  lose precision above about 9 quadrillion.
- **Videos** need the internet and can be withdrawn by their publishers. Each video page links to the
  written lesson that covers the same material.
- **Offline:** the University's core files are cached with the app. Each course file is cached the first
  time it is opened, so courses you have visited work offline afterwards.
- Certificates are images generated in the browser. They are a personal record, not a qualification.

## 4.2 modules
- `realpy.js` + `realpy-worker.js` (lazy): real Python via Pyodide in a Web Worker, used only by the open Python
  lab when `S.uni.pyEngine === 'real'`. Pinned to `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/`; to upgrade,
  change it in `realpy-worker.js` and `sw.js` together.
- Lesson notes: `S.uni.notes['<course>:<lesson>'] = { t, at }`; page `#/uni/notes` (in `uni-campus.js`).

## 4.1 modules
- `uni-tools.js` (lazy): Review (`#/uni/review`), Git and terminal simulator (`#/uni/terminal`, tasks in `TASKS`),
  mock interview (`#/uni/career/mock`), portfolio (`#/uni/portfolio`). State: `S.uni.srs`, `S.uni.git`, `S.uni.mock`.
- `gitsim.js`: the simulator itself, usable in the browser (`window.GitSim`) and in Node (`require`). To add a task,
  add an entry to `TASKS` with `setup(sim)`, `goal`, `hints`, `sol` and `checks(sim)` returning `[label, boolean]`
  pairs, then run `node tests/e2e-tools.js`: every task must fail before any command and pass with its `sol`.
- Review keys are the same as `S.uni.missed`: `course:x<item>` for exam questions, `course:<lesson>:<check>` for lessons.
