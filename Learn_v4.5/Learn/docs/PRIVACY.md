# Learn 4.2: what data the site handles, why, and how to remove it

Written for the site owner. Adapt it into a notice for your users.

## Stored only on the user's device (browser `localStorage`)
- Lesson progress, XP, shop items, avatar, settings.
- University record: lessons, assignment code, examination attempts and scores, project notes and links,
  bookmarks, weekly goal, weekly challenge results, interview practice results, practice-studio results and
  drafts, the review schedule of missed questions, Git simulator task results, mock-interview reports, and personal lesson notes (never sent anywhere, never shown
  in the portfolio).
- The name typed for the transcript and certificates.
- CV builder fields, including an email address if the user types one. It appears only in the file they
  export. It is never transmitted by the site.
- A GitHub token, only if the user sets up cloud sync.
- In secure mode: a Firebase sign-in token (`learn-fb-auth`), so the player stays signed in.
- The downloaded question bank (in the browser cache, for offline use). It contains no personal data.

Clearing the browser's site data deletes all of it. A backup file or backup code contains the same data
(except the online sign-in identity, which is left out); whoever holds a backup holds that data. Backup files
are saved wherever the user chooses and are never sent anywhere by the site.

## Sent to other services
| When | What is sent | To whom |
|---|---|---|
| Online play, friends, rooms, leaderboards, reward codes | Display name, avatar, scores, invitations and room messages, presence, which reward codes were redeemed | Your Firebase Realtime Database. **Legacy mode:** readable and writable by anyone. **Secure mode:** readable by signed-in players as the rules allow, writable only by the owner (see SECURITY.md). |
| Secure mode sign-in | A random account ID; sign-in times; **an email address and password only if the player chooses to add them** | Google Firebase Authentication. The password is stored by Google as a hash; the site never stores it. The email is used for sign-in only and is not shown to other players. |
| Administrator actions and code redemptions (secure mode) | Account ID, action, a short detail, time | `duel/audit` in your database, readable by administrators |
| Cloud sync, if the user sets it up | Their whole save, as a private Gist | GitHub, in the user's own account |
| Running Java, Go, Rust, PHP, Ruby, Swift, Kotlin or Bash | The code being run | Judge0 CE, Piston or Wandbox (public services) |
| Switching the Python lab to real Python | Requests for the Pyodide files (about 7 MB, once). No code or data of the student is sent: the program runs on the device | jsDelivr CDN |
| Pressing "Load video" | A request to the video host, which may set cookies | YouTube (privacy-enhanced embed domain) |
| Web fonts | A request for the font files | Google Fonts |
| AI Professor | **Nothing.** No AI service is connected. If you connect one, messages typed on that page go to your endpoint and on to the provider. | — |

The University's departments, career centre, CV builder, study tools and challenges send **nothing** anywhere.
There are no analytics, advertising or tracking scripts.

## Why each item is collected
- Names, scores and presence: so that players can find and play each other and see a leaderboard.
- Account ID and optional email: so that only the owner can change their own online data, and so that an
  identity can be kept across devices.
- Audit entries: so that misuse of reward codes can be investigated.
Nothing is collected for advertising or analytics, and nothing is sold or shared.

## How data is removed
| Data | How to remove it |
|---|---|
| Everything on the device | The user presses "Erase" in the backup section at the foot of the home page, or clears the site's data in their browser. |
| A player's online name, friends and scores | **The player:** Multiplayer → More → Delete my online data (since 4.1). It removes presence, leaderboard entries, name, friend code, both sides of every friendship, friend requests and invitations received, inbox and party, and in secure mode the ownership records and the sign-in account. Requests the player sent to others stay in those players' lists until they dismiss them. **The owner:** Firebase console → Realtime Database: delete the player's ID under `duel/names`, `duel/lb/*`, `duel/fl`, `duel/frq`, `duel/inv`, `duel/inbox`, `duel/presence`, and `duel/owners/<id>` with its `duel/uids/<uid>`. |
| A sign-in account and its email | Firebase console → Authentication → Users → delete the user. |
| A cloud-sync copy | The user deletes the Gist in their own GitHub account and revokes the token. |
| Audit entries | Firebase console → `duel/audit`. Decide how long you keep them; 90 days is a reasonable default. |

Since 4.1 players can delete their own online data (see above). The audit log keeps a `delete-account` entry
with the account and player IDs, so you can show a deletion happened; remove audit entries on your own schedule.
If you operate the site for the public, still say how to contact you, for players who cannot reach the button.

## Younger users
The site asks for no age, real name or contact details. If children use it: online play shares a display
name with other players, so advise them not to use a real name; and the career guide tells under-18s to
involve a parent, guardian or teacher.

## Your obligations
If you operate this for other people, you are responsible for the Firebase project. Depending on where you
and your users are, data-protection law may apply to the names and messages stored there. This is general
information, not legal advice.
