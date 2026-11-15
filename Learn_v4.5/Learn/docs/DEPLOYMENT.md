# Deploying Learn 4.5

The site is static files. There is no build step and nothing to install.

## Upload
Upload **everything in this folder**, keeping the folder structure: `index.html`, `sw.js`, `manifest.json`,
the icons, `ranked_extra.json` (required: the quiz and multiplayer question bank), `workspace.js`,
`.nojekyll`, and the folders `uni/`, `firebase/`, `docs/` and `tests/` (the last three are optional on the
live site; they contain no secrets). The old `ranked_questions.json` is no longer used and can be deleted
from your repository.

- **GitHub Pages (project site, served under `/Learn/`):** Add file > Upload files, drag everything in,
  commit to `main`. Settings > Pages > Deploy from a branch > `main` / root. All paths are relative.
- **Netlify:** drag the folder onto the Netlify dashboard, or connect the repository with no build command
  and the publish directory set to the repository root.
- **Any other static host, at the site root or in a sub-folder:** works unchanged, because every path is
  relative and routing uses the `#` part of the address, so deep links need no server rewrite rules.
- **Local:** `python3 -m http.server 8000` in this folder, then open `http://localhost:8000/`.

## After uploading
1. Open the site and reload once. The service worker (`learn-v4.5`) replaces the old cache; returning
   visitors get the new version on their second visit.
2. Open the patch notes from the home page and confirm version 4.5.
   Upload every file in one go (one commit). Since 4.5 the University checks that its files match; if a page says
   "Learn needs to finish updating" and names a file, that file on the website is still old: upload it again.
   4.4 replaces `ranked_extra.json` again (1.6 MB) and the course files in `uni/data/`: upload both.
   4.3 replaces `ranked_extra.json` (now 1.2 MB): upload it, or quizzes keep the old repeated questions.
   New in 4.2: upload `uni/realpy.js` and `uni/realpy-worker.js`. Then do the real-Python check in `docs/TESTING.md`.
   New in 4.1: upload `uni/uni-tools.js` and `uni/gitsim.js` with the rest of the `uni` folder.
3. Open Quiz once: the question bank downloads (about 140 KB compressed) and is kept for offline use.
4. Open 🎓 University > Labs > Practice studio > Language environment check and run it.

Existing users keep their progress. The save format only gained optional fields.

## When you change content later
- Change University content or code: bump `UNI_VER` in `index.html` **and** the cache name `VER` in `sw.js`.
- Change the main app: bump `APP_VERSION`, add a `PATCH_NOTES` entry at the top, bump `VER` in `sw.js`.
- Run the tests (see `docs/TESTING.md`).

## What was and was not tested about deployment
Tested locally in a real browser: serving from a `/Learn/` sub-folder, deep links, the service worker's
cache replacement, offline use of cached pages, and loading the question bank on demand.
**Not tested:** your live GitHub Pages site, Netlify, or any real hosting. Nothing was published.

## Manual actions this release asks of you
| Action | Why | Where |
|---|---|---|
| **Switch on secure mode for Firebase** | Until you do, the multiplayer database is world-readable and world-writable | `docs/FIREBASE_SETUP.md` (verify in a test project first) |
| Decide how players can ask for their online data to be deleted | There is no self-service deletion | `docs/PRIVACY.md` |
| Delete `ranked_questions.json` from your repository | No longer used (10 MB) | – |
| (Optional) connect an AI model | Needs your own server endpoint and key | `uni/ai-endpoint-example/README.md` |
| (Optional) server-side validation of scores and rewards | Needed before leaderboards can be trusted | `docs/COMMUNITY.md` |

Nothing in this release requires a paid service.
