# Firebase: securing online play (Learn 4.0)

**Status of your live project: unchanged.** This release did not read, write, or reconfigure your live
Firebase project `learn-a72fb`, its rules, its Authentication settings or any user record. Everything
below is prepared for you to apply when you choose. Until you do, the site runs in **legacy mode**: it
behaves exactly as version 3.1 did, and the Multiplayer page says plainly that online data is unprotected.

> **Upgrading from 4.0 with secure mode already on?** 4.1 changes one thing in `firebase/database.rules.json`:
> an account may delete its own `owners/<pid>` and `uids/<uid>` records, so players can delete their own data.
> Re-run the rules test (section 4) and publish the new rules file, or the "Delete my online data" button
> will remove everything except those two records.

## 1. What the problem is

In legacy mode the website talks to the Realtime Database with no sign-in. For that to work, the database
rules must allow anyone on the internet to read and write `/duel`. Anyone can therefore, without using the
website at all: overwrite any player's leaderboard entry, impersonate any player, read or delete reward
codes, create reward codes, delete every match, or wipe `/duel`. The old administrator passphrase was
checked in the browser, so it protected nothing: the database never saw it.

## 2. What secure mode does

When `FB_API_KEY` is set in `index.html`, the app:

1. Signs every visitor in to **Firebase Authentication** (anonymously by default; a player may add an
   email and password to keep their identity across devices). It uses the public REST API; no SDK is loaded.
2. Sends the player's ID token with every database request (`?auth=<token>`).
3. Claims ownership of the player ID once: `duel/owners/<playerId> = <authUid>` and
   `duel/uids/<authUid> = <playerId>`. The rules then let only that account write that player's data.
4. Shows the administrator tools only to accounts listed under `duel/admins/<authUid>`, a node that **only
   the Firebase console can write**. There is no administrator password in the page any more.
5. Appends administrator actions and reward-code redemptions to `duel/audit` (append-only; readable by
   administrators only).

### What the rules enforce (`firebase/database.rules.json`)

| Data | Who can read | Who can write |
|---|---|---|
| Everything not listed | nobody | nobody |
| `duel/ping` | anyone | nobody |
| `duel/admins/<uid>` | that user (their own flag) | **console only** |
| `duel/owners/<pid>`, `duel/uids/<uid>` | signed-in users | once, by the claiming account; never changed; may be deleted only by that same account (self-service deletion, 4.1) |
| `duel/names`, `presence`, `lb/<mode>/<pid>` | signed-in users | only the owner of `<pid>`; values validated (name ≤ 24 characters, rating 0 to 10,000, numbers only) |
| `duel/fl`, `frq`, `inv`, `inbox` | the owner (requests: also the sender) | the owner, or a signed-in sender for requests addressed to that player |
| `duel/codes` (list) | administrators | – |
| `duel/codes/<code>` | signed-in users (single code, by exact name) | administrators; players may create or delete only their **own friend code** |
| `duel/codes/<code>/u/<pid>` | – | the owner of `<pid>`, **once**, only on an unexpired reward code; cannot be deleted or repeated |
| `duel/queue`, `party`, `rooms`, `matches`, `shopPick` | signed-in users | participants only, each to their own slot |
| `duel/audit` | administrators | signed-in users, append-only, stamped with their own uid |

### What the rules cannot do (be clear about this)

Rules decide **who** may write **where** and in what shape. They cannot check that a value is *true*.

- A player can still write an inflated rating to **their own** leaderboard entry (capped at 10,000). They
  can no longer touch anyone else's.
- A reward code's "maximum number of redemptions" is not enforced by rules. Each account can redeem a code
  once; the total is not capped.
- Rewards are applied to the player's save in their own browser, which they control.
- A person can create many anonymous accounts.

Closing these needs **trusted server-side code** that computes results itself, for example Cloud Functions
or a Cloudflare Worker that validates a finished match and writes the rating, with the rules changed so that
clients cannot write `lb` at all. That is real backend work, Cloud Functions needs Firebase's paid (Blaze)
plan, and none of it is included or switched on in this release. `docs/COMMUNITY.md` gives the design.
Until then, treat the leaderboards as **for fun, not proof**.

## 3. How this was tested, and what that proves

| Test | What ran | Result |
|---|---|---|
| `tests/firebase-rules.test.js` | 77 allow/deny scenarios against the rules file, using **a simulator written for this project** (`tests/rules-sim.js`) | 77 passed |
| `tests/e2e-secure-mode.js` | The real app in a browser with a key set, against a **mocked** Firebase Auth and database that enforces the rules file | 21 passed |

Covered: unauthenticated access, access to own data, access to other players' data, administrator-only
data, leaderboard manipulation, reward-code abuse (creating, listing, repeating, deleting redemptions),
unauthorised deletion including wiping `/duel`, self-promotion to administrator, and administrator rights.

**Not done:** the rules have not been run in the official Firebase Emulator Suite or against any real
Firebase project, because the build environment could not install the Firebase tools or reach Google. The
simulator implements the documented rule semantics but is not Google's engine. Matchmaking, rooms, parties,
friends and live matches in secure mode were not exercised end to end. **Do step 4 before going live.**

## 4. Verify the rules yourself before publishing (required)

Use a **separate test project**, not `learn-a72fb`.

1. In the Firebase console create a new project, for example `learn-test`. Add a Realtime Database and a
   Web app. The free Spark plan is enough.
2. On a computer with Node.js: `npm install -g firebase-tools`, then `firebase login`.
3. In the `firebase/` folder copy `.firebaserc.example` to `.firebaserc` and put in your test project ID.
4. Emulator: `firebase emulators:start --only auth,database`. Open the Emulator UI and try reads and
   writes signed out and signed in. Or, in the console of the **test** project, paste the rules into
   Realtime Database → Rules and use the **Rules Playground** to simulate requests.
5. Check at least these, which must be **denied**: reading `/duel/lb/1` signed out; writing
   `/duel/lb/1/<someone else's id>` signed in; writing `/duel/admins/<your uid>`; deleting `/duel`;
   reading the whole of `/duel/codes` as a non-administrator.
6. Point a copy of the site at the test project (set `DUEL_DB` and `FB_API_KEY` to the test project's
   values in that copy only) and play: set a name, add a friend, create a room, play a match, redeem a code.
   If anything legitimate is refused, the browser console shows a `permission_denied` request: note the
   path and adjust the rules in the test project before going further.

## Status (15 November 2026, Learn 4.8)
`FB_API_KEY` is set in `index.html` for project `learn-a72fb`. The owner reported enabling the web app; Email/Password
and Anonymous sign-in must be enabled, and `firebase/database.rules.json` must be published (section 5, step 7).

## 4b. Accounts and saved progress (4.6)

The 👤 Sign in page (`#/account`) uses the same Firebase Authentication as online play. When a student creates
an account or signs in, their progress (the same data as a backup file: no GitHub token, no device player ID) is
stored at `saves/<account id>` as `{ d: text, at: server time, v: app version }`.

The rules (`saves` section of `firebase/database.rules.json`):
- only that account can read, write or delete it, and only if the account has an email (anonymous online-play
  accounts cannot store progress);
- administrators **cannot** read it; nobody can list `saves`;
- `d` must be text of at most 3,000,000 characters, `at` a time not in the future, no other fields.

Tested with the rules simulator (16 checks in `firebase-rules.test.js`) and end to end against a mocked backend
that enforces this rules file (`e2e-account.js`, 37 checks). **Not tested against Google's servers.** One detail
that only the real service can confirm: that the ID token of an account created by adding an email to an
anonymous account carries the `email` claim (Firebase documents that it does). Check it once after going live:
create an account on the site, then confirm `saves/<uid>` appears in the console.

If you do not set `FB_API_KEY`, the Sign in page says that accounts are not switched on and shows these steps;
no form is shown and nothing is sent anywhere.

## 5. Going live: exact production steps

Do these in order, at a quiet time. Steps 1 to 3 change nothing for players.

1. **Back up.** Console → Realtime Database → ⋮ → *Export JSON*. Keep the file.
2. **Enable sign-in.** Console → Authentication → Sign-in method: enable **Anonymous** and
   **Email/Password**. Under Settings → Authorized domains, make sure your site's domain is listed
   (for GitHub Pages, `<your-user>.github.io`).
3. **Restrict the Web API key** (recommended). Google Cloud console → APIs & Services → Credentials →
   the Browser key: set *Website restrictions* to your site's address, and *API restrictions* to
   Identity Toolkit API and Token Service API.
4. **Create your administrator account.** Console → Authentication → Users → *Add user*: your email and a
   long password. Copy that user's **User UID**.
5. **Grant it administrator rights.** Console → Realtime Database → Data: add `duel/admins/<that UID>`
   with the value `true`.
6. **Set the key in the site.** In `index.html` change `const FB_API_KEY = '';` to your Web API key
   (Console → Project settings → General → Web API key). Upload the site.
7. **Publish the rules.** Console → Realtime Database → Rules: replace the contents with
   `firebase/database.rules.json` and press Publish. (Or `firebase deploy --only database --project production`.)
8. **Check.** Open the site in a private window: 👤 Sign in → create a test account; the console should show
   `saves/<its UID>`. Then  Multiplayer → More should show "Online account". Set a
   name, open the leaderboard. Sign in with your administrator email there: the administrator tools appear.

Steps 6 and 7 belong together. If the rules are published before the new site is live, players on the old
page are refused until they reload; if the site is live before the rules, it works but is not yet protected.

### What happens to existing players and data

- No data is deleted or rewritten by the migration.
- Each existing player keeps their player ID, which is stored in their browser. The first time they open
  the new site their browser signs in anonymously and claims that ID. Their name, friends and rank continue.
- **Risk:** ownership is first-come. Player IDs are visible to other players, so before the legitimate owner
  returns, someone else could claim their ID. For a small community this is unlikely; if it matters, tell
  your players to open the site soon after the switch. You can undo a wrong claim in the console by deleting
  `duel/owners/<pid>` and the matching `duel/uids/<uid>`.
- A player who clears their browser loses an anonymous account, exactly as they lose their save today.
  Adding an email on the "Online account" card prevents that.
- The old administrator passphrase stops working. That is intended.

### Rolling back

1. Console → Realtime Database → Rules: restore the previous rules (the console keeps a history).
2. Set `FB_API_KEY` back to `''` and upload. The site is in legacy mode again.
3. If data was damaged, import the JSON backup from step 1.

## 6. Costs

Anonymous and email/password sign-in and the Realtime Database are within Firebase's free Spark plan at
this scale. Nothing in this release requires a paid plan. The optional server-side validation described in
`docs/COMMUNITY.md` would.

## 7. Data that secure mode adds

Firebase Authentication stores, for each account: a random user ID, creation and last sign-in times, and,
only if the player chooses to add one, an email address and a password hash. See `docs/PRIVACY.md`.
