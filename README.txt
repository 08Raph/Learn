08Raph Learn 5.7: six interface languages, a start guide, homework for classes, shareable progress pictures

08Raph Learn 5.2: 24 coding challenges, activity heatmap, save everything for offline
- NEW FILE challenges.js. Upload it together with index.html and app.js.

08Raph Learn 5.1: faster start, practice drills, AI everywhere, tidier home page
- NEW FILE app.js (the app code). Upload it together with index.html.

08Raph Learn 5.0: AI in lessons, weekly goals and leaderboard, reminders, certificate links, classes

- REQUIRED: publish the new firebase/database.rules.json again (Realtime Database -> Rules -> paste -> Publish).
- 4.9 fixed Create account on Firebase projects with email enumeration protection.

08Raph Learn 4.8: sign up and sign in are on

- FB_API_KEY is set, so accounts (Sign in / Create account) and secure online play are on.
- REQUIRED: publish firebase/database.rules.json in the Firebase console (Realtime Database -> Rules
  -> paste -> Publish). Without it, saved progress is not protected.

08Raph Learn 4.7: the AI Professor is a real AI

NEW IN 4.7
- AI Professor answers with GLM-4.7 Flash on Cloudflare Workers AI, through the Worker
  learn-ai-professor on your Cloudflare account (uni/ai-worker/README.md). Free up to 10,000 Neurons a day.
- Falls back to the built-in tutor when the AI is busy or unreachable.

08Raph Learn 4.6: accounts (sign up, sign in, progress on every device)

NEW IN 4.6
- 👤 Sign in button: create an account or sign in; progress is saved to the account and combined
  across devices. Forgot password, sign out (and clear device), delete account.
- To switch it on (website owner): see docs/FIREBASE_SETUP.md section 4b and 5. In short: enable
  Email/Password and Anonymous sign-in, publish firebase/database.rules.json, set FB_API_KEY in index.html.
  Until then the Sign in page explains that accounts are not switched on.

08Raph Learn 4.5: University search, and no more broken pages after an update

NEW IN 4.5
- Fixes "U.srsCounts is not a function": an old saved copy of one University file was used with new
  copies of the others. Learn now detects this, repairs itself once, and otherwise names the old file.
- New Search tab in the University. A "new version is ready" bar instead of mixed versions.
- Upload EVERYTHING in the ZIP, including the whole uni folder and sw.js. If a University page says
  "Learn needs to finish updating" and names a file, that file on GitHub is still the old one.

08Raph Learn 4.4: more questions for eight languages, a worked example in every lesson

NEW IN 4.4
- 608 new questions for Java, Go, Rust, PHP, Ruby, Swift, Kotlin and Bash (109-126 each now). Bank: 5,671
  distinct questions. Upload the new ranked_extra.json (1.6 MB).
- Every University lesson now has a worked example (65 lessons gained one).
- New tool tests/check-bank-native.py checks answers with real compilers (970 checked, 0 wrong).
- sw.js cache is now learn-v4.4.

08Raph Learn 4.3: honest question bank, fixes and polish

NEW IN 4.3
- CORRECTION: the quiz/multiplayer bank was advertised as 37,500 questions; it really held about 2,900 distinct
  ones. It now has 5,063 distinct questions, every runnable one checked by running it. Upload the new
  ranked_extra.json (1.2 MB instead of 8.5 MB).
- Quiz headings show the real question. University knowledge-check layout fixed. Contrast and tap-target fixes
  found by a full screen audit. Real Python switch in the Playground. Common-mistakes sections in 18 lessons.
- sw.js cache is now learn-v4.3. New: tests/audit-screens.js, tests/check-bank.js.

08Raph Learn 4.2: real Python, longer electives, lesson notes

NEW IN 4.2
- Labs > Python: Engine switch for real Python (Pyodide, downloaded from jsDelivr on first use, then offline).
  NOT TESTED against the real Pyodide here (the CDN was blocked): check it on the live site, see docs/TESTING.md.
- All ten department electives now have six lessons. Lesson notes with a searchable My notes page.
- New files: uni/realpy.js, uni/realpy-worker.js, tests/e2e-realpy.js. sw.js cache is now learn-v4.2.

08Raph Learn 4.1: backups, spaced review, Git simulator, mock interviews, portfolio

READ FIRST
- docs/FIREBASE_SETUP.md   how to lock down the multiplayer database (NOT live until you do it).
                           If secure mode is already on: re-publish the rules file, it changed in 4.1.
- docs/DEPLOYMENT.md       how to upload, and the manual actions this release asks of you
- docs/TESTING.md          what was tested, with counts, and what could not be tested
- docs/SECURITY.md  docs/PRIVACY.md  docs/COMMUNITY.md  docs/ACADEMIC_AUDIT.md  CHANGELOG.md

NEW IN 4.1
- Home page: download a backup file and restore it (preview, then merge or replace). Backup reminder.
- University: Review tab (missed questions return after 1, 3 and 7 days), Git and terminal simulator with
  10 graded tasks (Labs), timed mock interviews (Career centre), printable portfolio page (Projects).
- MAT 101, MAT 102, NUM 101, HCI 101 extended to six lessons each. 12 interview coding exercises.
- Multiplayer > More: Delete my online data.
- Contrast fixes (light-theme code comments; Gold, Mint, Amber, Lime accents). Video IDs re-checked.
- New files: uni/uni-tools.js, uni/gitsim.js, tests/e2e-tools.js. sw.js cache is now learn-v4.1.
- Run the tests: sh tests/run-all.sh

----------------------------------------------------------------------
EARLIER RELEASE NOTES
----------------------------------------------------------------------
08Raph Learn 4.0: security, ten new courses, visualiser and practice studio

NEW IN 4.0
- Firebase security: sign-in support, strict rules (firebase/database.rules.json), console-managed
  administrators, audit log. Opt-in: the live site and database are unchanged until you switch it on.
- index.html is 1.5 MB instead of 10 MB. The quiz and multiplayer question bank is now ranked_extra.json
  (upload it!) and loads on demand. ranked_questions.json is no longer used: delete it from your repository.
- University: 10 new electives (GDV 102/103, CEN 102/103, MOB 102/103, HCI 101, NUM 101, MAT 101/102).
- Labs: algorithm visualiser, practice studio (27 exercises), language environment check.
- Projects: objectives, milestones, submission guidance, completion criteria.
- sw.js cache is now learn-v4.0.
- Run the tests: sh tests/run-all.sh

----------------------------------------------------------------------
EARLIER RELEASE NOTES
----------------------------------------------------------------------
08Raph Learn 3.1: Technology University release

NEW IN 3.1
- University: 8 departments with learning pathways, 3 new elective courses (game programming, digital logic and CPUs,
  mobile foundations), a Career centre (skill gaps, CV builder, interview practice), a My study page (weekly goal,
  bookmarks, history, achievements, weekly challenge), a stronger built-in AI Professor, 22 video lectures.
- Security: the HTML escaper now escapes quote characters (fixes an attribute-injection flaw). University progress
  is now part of cloud sync.
- READ docs/SECURITY.md: your Firebase database is open to anyone and needs a rules change that only you can make.
- Documents: docs/DEPLOYMENT.md (how to upload), docs/TESTING.md (what was tested and what was not),
  docs/SECURITY.md, docs/PRIVACY.md, docs/ACADEMIC_AUDIT.md, uni/README.md (maintainer's guide).
- Tests: sh tests/run-all.sh
- Upload EVERYTHING in this folder, including the uni, docs and tests folders and the hidden .nojekyll file.
- Still not an accredited university. No degrees. No AI service connected. No paid service required.

08Raph Learn 3.0: Software Engineering University

NEW IN 3.0
- 🎓 University: a new section at #/uni (button and banner on the home page). 6 stages, 52 courses, 255 lessons,
  programming assignments marked by tests, examinations, projects, labs for 16 languages, video centre,
  AI Professor (built-in tutor; no AI service connected), dashboard, transcript, portfolio and certificates.
- It is NOT an accredited university and awards no degrees. Every University page says so.
- Everything is in the new "uni" folder. Upload that folder together with index.html, sw.js and the other files.
- Maintainer's guide: uni/README.md. Connecting a real AI model (optional, needs your own server): uni/ai-endpoint-example/README.md.
- Nothing in the existing app was removed or redesigned.

08Raph Learn: fixed build

Upload ALL files in this folder to Netlify / GitHub Pages (index.html, sw.js, manifest.json, icon-192.png, icon-512.png).

What changed
- Startup crash fixed ("Spread syntax requires ...iterable not be null or undefined"): the 8 newer languages had no extra-lessons list.
- Lesson pages for Java/Go/Rust/PHP/Ruby/Swift/Kotlin/Bash no longer crash (missing quick-key bar, invalid "advanced" tier).
- Those 8 languages used to award XP for pressing Run on anything. They are now checked against the key parts of the solution.
- 46 broken lessons repaired in Python, JS, TS, C, C++, C#, SQL (snippets with no main(), starters that already passed, unsupported features, wrong expected data, one duplicate id).
- C lesson links (#/c/...) no longer collide with friend-challenge links.
- Added the missing icon-192.png / icon-512.png and manifest icons.
- New 3D avatar: custom real-time renderer (no libraries, no emojis). Drag to turn, tap to wave. Hair colours, new skin, shop thumbnails and friend portraits are generated by the same engine.

Icons and sharing image (your artwork)
- favicon.png, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, og-image.png are wired into index.html and manifest.json.

Upload to GitHub (Pages)
1. Unzip, then in your repo (e.g. 08Raph/Learn) use "Add file > Upload files" and drag in EVERYTHING inside the folder (including the hidden .nojekyll file).
2. Commit to main. Settings > Pages > Deploy from branch > main / (root).
3. Site: https://08raph.github.io/Learn/  (all paths are relative, so it also works on Netlify).

Update 2.1 notes
- All match types (ranked, unranked, rooms, practice) draw from the shared question bank (this note originally said 37,500 questions; corrected in 4.3: about 2,900 distinct; 5,063 since the 4.3 rebuild): each language equally likely, each question in a language equally likely.
- Patch notes pop up once per update for existing players; brand-new players never see them. Re-open any time from "What's new" at the bottom of the home page.
- To add notes for your next update, edit APP_VERSION and add an entry at the TOP of PATCH_NOTES in index.html (search for "PATCH_NOTES").
- Players on an older version can't be matched with players on 2.1 online (the question bank changed), so ask everyone to refresh.

Update: Locker, animated items, banners, party return
- 🎒 Locker (home, shop): everything you buy is stored there. Equip up to 8 emotes and 8 text-box lines (now 4, see below) for games (LOADOUT_MAX in index.html). Also holds banners, accents/titles and a link to avatar items.
- Shop: new Banners (4 static, 4 animated), Animated emojis (12) and Animated text (10). New purchases are auto-equipped if there is room.
- Quick chat now shows only your equipped emotes/text and sends the animation with the message.
- After a party match, the result screen has "Return to party": the leader recreates the party, members rejoin and wait for the leader.

Update: codes, free XP, popups
- Shop > "Codes & free XP": players enter a code. Open "Admin: create codes" and unlock with your admin passphrase to make codes: reward = XP or any item (emoji, animated emoji/text, banner, accent/title, avatar item), expiry in minutes/hours/days (0 = never), max uses (0 = unlimited). The panel can also list and delete codes.
- To change the admin passphrase: unlock the panel, type a new passphrase, press "Get hash", paste the hash into ADMIN_HASH in index.html.
- TikTok and YouTube give 25 XP each, once per player (honor system: follows can't be verified). Links are TIKTOK_URL and YOUTUBE_URL in index.html.
- Quick-chat emotes and text now also pop up in the top-right corner during games.
- Security note: the site talks to an open Firebase database, so anyone who reads the page source could write codes directly. Fine for a small community; for real protection use Firebase rules/auth or a small server.

Update: daily shop rotation
- The Shop now shows 6 banners, 6 emojis and 6 text-box lines. They change every day at 8 pm US Eastern (handles daylight saving). Everyone sees the same items, and nothing appears two days in a row. Items not in today's shop can't be bought (codes can still give any item).
- Owner picks: Shop > Codes & free XP > Admin > "Shop picks". Choose items for the NEXT shop (or the current one), up to 6 per section; the remaining slots stay random. Those items are also kept out of the random fill the following day.

Update: more items + Catalog
- Many more banners, emojis, animated emojis, text lines, accents and titles.
- 📖 Catalog (home, shop, locker): every item in the game, filter by type and Owned / Not owned. Unowned items say whether they are in today's shop, always in the shop, or will return in a later rotation.

Update: 4-slot loadouts and catalog shop picks
- LOADOUT_MAX is now 4: you can equip up to 4 emotes and 4 text-box lines in a game (players with more equipped keep their first 4).
- Admin > Shop picks > "Choose in catalog" opens the catalog in pick mode. Tap items to select up to 4 banners, 4 emojis and 4 text lines for the next (or current) shop, then Save picks. The rest of the shop stays random.

Update 2.2: avatar glow-up + offline
- Avatar renderer: higher-detail round shapes (TESS in Av3D), warm key + cool fill lighting, soft wrap shading, gloss/specular (gl on faces), blue rim light, glossy coloured-iris eyes, glowing stage with sparkles (stageBack).
- Offline: sw.js caches index.html, manifest and icons on first visit (and Google Fonts when seen). Opens cached copy instantly and refreshes it in the background, so new versions appear after a reload or two. Firebase/GitHub requests are never cached, so multiplayer, friends and codes need internet. An "Offline mode" badge shows when the connection drops.
- When you publish a new version, change VER in sw.js (e.g. learn-v2.3) so every device refreshes its cache.
- Patch notes entry 2.2 added (APP_VERSION = '2.2').

Update 2.3: Fortnite-style party lobby
- duelPartyView shows one slot per team size (2/3/4) with each member's 3D avatar (cached Av3D.snapshot images), name tag, gold platform for you, dashed "+" for open slots (tap = scroll to friend invites).
- Party members now carry their avatar (av) in party/<leader>/m/<uid>. Old clients show a default avatar.
- APP_VERSION = '2.3', patch notes entry added, sw.js VER = learn-v2.3.

Update 2.4: achievements, cosmetics, shop, language fixes
- Achievements: ~114, each gives XP by difficulty (Easy 10, Medium 25, Hard 50, Epic 100, Legendary 250). badgeXp() is added inside xp(). Counters live in S.cnt (runs, hints, speed, perfect, daily, theme, night/early/weekend flags).
- Avatar: new categories style, mouth, eyes, glasses, back, stage; ~140 new items; all defined in AVATAR_ITEMS + Av3D VALID/SHIRT_VARIANTS/PANTS_VARIANTS/STAGES. Thumbnails render lazily (fillThumbs).
- Shop: more emotes, animated emojis, animated text, banners, accents, titles, confetti.
- Java/Go/Rust/PHP/Ruby/Swift/Kotlin/Bash: rewritten lessons (12 each) + ordered-token answer check (staticCoverage uses LCS against the starter).
- Fixes: quiz options are now shuffled deterministically per lesson, wrong TS quiz answer, duplicate reward ids, "+3 XP" pill on repeat answers, cloud sync now includes avatar/avatarOwned/redeemed/cnt, speed-round heading.
- APP_VERSION = '2.4', sw.js VER = learn-v2.4.

Merge note (2.5): combined 08Raph_Learn_All_In_One (Terminal Basics track + Workspace/Package Explorer, sw VER 2.7) with the 2.4 achievements/cosmetics/shop/lesson work. Where both changed the same lines, the All_In_One version was kept and the achievements/shuffle/bump hooks were re-attached on top. Fixed: terminal step list called esc() outside its scope. APP_VERSION = '2.5', sw.js VER = learn-v2.8. workspace.js is the standalone copy of the Workspace code that is already inlined in index.html.

Update 2.6: online code runner + extra-question fix
- Java, Go, Rust, PHP, Ruby, Swift, Kotlin and Bash run through free public code-execution services (Judge0 CE, then Piston, then Wandbox). See RemoteRun in index.html. They need internet; offline, lessons are compared to the solution instead.
- Extra practice questions are clickable again (the lesson-check handler had been disabling them).
- Terminal Basics: example/solution start from a clean terminal.
- sw.js cache bumped to learn-v2.9: open the site twice (or hard refresh) to get the new version.

Update 2.7: capstone "Deploying to the Cloud"
- New track (home page > Capstone): 8 lessons, a 3-stage CI/CD dashboard (lint, build, edge upload), real HTML/CSS/JS linting, Build Failed report, unique live URL, browser preview window, deployment history with rollback.
- See CLOUD_DASHBOARD.md for the state machine and styling guidelines.
- sw.js cache is now learn-v3.0.

Update 2.8: Bug hunt + Projects tabs
- 40 new lessons (2 bug hunt + 2 projects) for Java, Go, Rust, PHP, Ruby, Swift, Kotlin, Bash, Terminal Basics and Deploying to the Cloud. See LESSONS_DEBUG_PROJECTS in index.html.
- sw.js cache is now learn-v3.1.
