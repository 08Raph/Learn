#!/bin/sh
# Runs the whole test programme against this folder. Needs: node + playwright (chromium), python3.
# Usage: sh tests/run-all.sh        (from the site folder)
# Nothing here touches a real Firebase project: the rules tests use a local simulator (tests/rules-sim.js)
# and the secure-mode test uses a mocked backend. See docs/TESTING.md for what that does and does not prove.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
TMP="$(mktemp -d)"; ln -s "$ROOT" "$TMP/Learn"
python3 -m http.server 8765 --directory "$ROOT" >/dev/null 2>&1 & SRV=$!
sleep 1
echo "== 1. content validator (every solution and starter through the real grader)"; node tests/validate-content.js | tail -4
echo "== 2. studio: visualiser, practice exercises, language environment check"; node tests/e2e-studio.js | tail -3
kill $SRV 2>/dev/null
echo "== 3. end-to-end: core University"; SRV_DIR="$TMP" APP_DIR="$ROOT" node tests/e2e-core.js | tail -3
echo "== 4. end-to-end: departments, career, study, finals, certificates, service worker"; SRV_DIR="$TMP" APP_DIR="$ROOT" node tests/e2e-campus.js | tail -3
echo "== 5. Firebase rules (SIMULATOR, not the Firebase emulator)"; node tests/firebase-rules.test.js | tail -2
echo "== 6. secure mode end to end (MOCKED Firebase backend enforcing firebase/database.rules.json)"; APP_DIR="$ROOT" node tests/e2e-secure-mode.js | tail -2
echo "== 7. app shell: ranked bank on demand, quiz, multiplayer page, version"; APP_DIR="$ROOT" node tests/e2e-app.js | tail -2
echo "== 8. 4.1/4.2 features: backup, review, Git simulator, mock interview, portfolio, notes, electives, contrast"; APP_DIR="$ROOT" node tests/e2e-tools.js | tail -2
echo "== 9. real Python (Pyodide): MOCKED Pyodide plus a blocked-CDN test; real Pyodide is NOT tested here"; APP_DIR="$ROOT" node tests/e2e-realpy.js | tail -2
echo "== 10. mixed old and new files: automatic repair, clear message, version-exact offline cache"; APP_DIR="$ROOT" node tests/e2e-mixed.js | tail -2
echo "== 11. accounts: create, sign in, progress saved in the account (MOCKED Firebase backend enforcing the real rules file)"; APP_DIR="$ROOT" node tests/e2e-account.js | tail -2
echo "== 12. 5.0 community: AI in lessons, weekly goal and leaderboard, reminder, certificate links, classes (MOCKED backend and AI)"; APP_DIR="$ROOT" node tests/e2e-community.js | tail -2
rm -rf "$TMP"
echo "Done. Each suite prints '0 problems' or '0 failed of N' when everything in it passed."
