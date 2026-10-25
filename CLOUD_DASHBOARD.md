# Deploying to the Cloud: how the capstone is built

The app is plain JavaScript (no React/Vue build step), so the dashboard is a framework-free component.
Everything lives in `index.html` under `Capstone: Deploying to the Cloud`. The pieces are separate on purpose, so any of them can be lifted into React or Vue.

## 1. State machine (`Cloud.createMachine`)
Pure object, no DOM. Illegal events are ignored, so the UI can never reach an impossible state.

```
idle      --DEPLOY-->      linting
linting   --LINT_PASS-->   building      --LINT_FAIL--> failed
building  --BUILD_PASS-->  uploading     --BUILD_FAIL-> failed
uploading --UPLOAD_PASS--> live          --UPLOAD_FAIL> failed
live | failed --DEPLOY--> linting        --RESET--> idle
any running stage --CANCEL--> idle       (user leaves the page / edits during a run)
```
`machine.ctx` holds the stage statuses (pending, running, success, failed, skipped), timings, progress 0..1, logs, lint report, build result and URL.
In React this is a `useReducer` whose reducer is the `TRANSITIONS` table; in Vue it is a `reactive()` object with `send()`.

## 2. Pipeline driver (`start()` inside `Cloud.mount`)
An async function that walks the stages, writes log lines, and sends the events above. A run id is checked after every `await`, so editing, resetting or navigating away aborts it cleanly.

## 3. Linter and bundler (`Cloud.lint`, `Cloud.build`)
Real checks, no network: tag stack for HTML, bracket/string/comment scanner for JS and CSS, `new Function` for syntax errors the scanner cannot see, a secret scanner, and a missing-file check for `<link>` and `<script>`. The bundler minifies, inlines and content-hashes assets.

## 4. Styling guidelines (cinematic dark dashboard)
- Always dark, even in light theme: background `#060a14`, panels `#0d1424`, hairlines `#1e2a44`.
- One accent family for activity (`#6aa8ff` to `#8f6bff`), green `#3ddc97` for success, red `#ff5d6c` for failure, amber `#ffc857` for warnings. State is shown by color and icon and text, never color alone.
- Depth: radial glows in the corners, a faint 28px grid masked to fade out, 1px inner highlight on the card.
- Motion with meaning: spinner on the running stage, shimmer on its bar, pulsing status dot, dashed flow along active network links, shake on failure, pop on success. All of it turns off under `prefers-reduced-motion`.
- Terminal uses the app mono font, 12.5px, timestamps in a dim column, one color per log level.
- Layout uses `auto-fit` grids, so it works in a half-width card or full width on a phone. Buttons are at least 38px tall for touch.
- The preview modal is a sandboxed iframe (`allow-scripts allow-forms`, no same-origin), closes with Esc, and reports runtime errors in its footer.
