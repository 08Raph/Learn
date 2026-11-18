# Learn 5.6: what data the site handles, why, and how to remove it

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
| Accounts (4.6), if the student creates one | Email and password (to Google Firebase Authentication, password stored as a hash). Their progress — the same data as a backup file — at `saves/<account id>` in your database | Readable and writable **only by that account**. Administrators cannot read it (the rules forbid it). |
| Ask AI in a lesson (5.0) | The lesson's title and task, the code in the editor, the last output, and the question typed | The site's AI Worker on Cloudflare (as for the AI Professor). Nothing is stored there. |
| Weekly leaderboard (5.0), only after pressing Join | Online name and this week's XP | `duel/wk/<week>/<player>`, readable by signed-in players. Leaving deletes it. |
| Certificate link (5.0), only when the student creates one | The name they type, the certificate title and detail, the date, and the account ID | `certs/<id>`, **readable by anyone who has the link**. Deletable by the owner (account deletion deletes them). |
| Classes (5.0), only after joining | The display name typed for the class, and counts: lessons, University lessons, XP, weekly XP, days studied, last active; since 5.7 also which of the class's homework items are finished (an item id and a time). Never email, code or answers | `classes/<code>/m/<account id>`, readable by the class's teacher only. Leaving or the teacher removing the student deletes it. |
| Daily reminder (5.0) | Nothing. A calendar file is created on the device | — |
| Administrator actions and code redemptions (secure mode) | Account ID, action, a short detail, time | `duel/audit` in your database, readable by administrators |
| Cloud sync, if the user sets it up | Their whole save, as a private Gist | GitHub, in the user's own account |
| Running Java, Go, Rust, PHP, Ruby, Swift, Kotlin or Bash | The code being run | Judge0 CE, Piston or Wandbox (public services) |
| Switching the Python lab to real Python | Requests for the Pyodide files (about 7 MB, once). No code or data of the student is sent: the program runs on the device | jsDelivr CDN |
| Pressing "Load video" | A request to the video host, which may set cookies | YouTube (privacy-enhanced embed domain) |
| Web fonts | A request for the font files | Google Fonts |
| AI Professor (4.7) | The messages typed on that page, the last 12 messages of that conversation, the teaching mode, and the course and lesson being studied. No name, email or account ID | The site's Worker `learn-ai-professor` on Cloudflare, which runs the model on Cloudflare Workers AI. The Worker's code stores nothing; Cloudflare's own processing is covered by Cloudflare's terms. **If the site owner has added backup services** and Workers AI is busy, the same text is sent to one of Groq, Cerebras, Google Gemini or OpenRouter instead, under that service's terms (Gemini's free tier may use prompts to improve Google's products). The same applies to Ask AI in lessons. |

The University's departments, career centre, CV builder, study tools and challenges send **nothing** anywhere.
**Visit counting:** the site loads **Cloudflare Web Analytics** (`static.cloudflareinsights.com`, token set in
`CF_TOKEN` in `app.js`). It counts page views, referring sites, countries and device types, sets **no cookies** and
does not see code, answers, names or emails. The privacy note on the home page says so. To switch it off, set
`CF_TOKEN = ''` in `app.js`. There is no advertising and no other tracking script.

| Homework (5.7), set by a teacher | The lesson or challenge chosen and a due date | `classes/<code>/hw`, readable by signed-in accounts that know the class code. No student data. |

**Interface language (5.7):** the chosen language is stored on the device (and in backups). Language files are
downloaded from this site only when a language other than English is chosen. When a language other than English is
in use, the AI tutor is told that language so it can answer in it; nothing else about the student is added.

**Automatic translation (5.8):** in a language other than English, page text that has no hand translation (lesson
explanations, course descriptions and similar site text) is sent to the site's own AI service (the Cloudflare Worker)
to be translated. Only the site's text is sent: code, editors, program output, the AI tutor conversation, names and
nothing typed by the student. The answers are kept on the device (Cache Storage) and on Cloudflare (by a hash of the
text, for 30 days) so the same text is not translated twice. The free AI services in the fallback chain receive that
text. **Show original** switches it off.

## Why each item is collected
- Names, scores and presence: so that players can find and play each other and see a leaderboard.
- Account ID and optional email: so that only the owner can change their own online data, and so that an
  identity can be kept across devices.
- Audit entries: so that misuse of reward codes can be investigated.
- Visit counts (Cloudflare Web Analytics): so the owner can see how many people use the site and where they come from.
Nothing is collected for advertising, and nothing is sold or shared.

## How data is removed
| Data | How to remove it |
|---|---|
| Everything on the device | The user presses "Erase" in the backup section at the foot of the home page, or clears the site's data in their browser. |
| A player's online name, friends and scores | **The player:** Multiplayer → More → Delete my online data (since 4.1). It removes presence, leaderboard entries, name, friend code, both sides of every friendship, friend requests and invitations received, inbox and party, and in secure mode the ownership records and the sign-in account. Requests the player sent to others stay in those players' lists until they dismiss them. **The owner:** Firebase console → Realtime Database: delete the player's ID under `duel/names`, `duel/lb/*`, `duel/fl`, `duel/frq`, `duel/inv`, `duel/inbox`, `duel/presence`, and `duel/owners/<id>` with its `duel/uids/<uid>`. |
| An account, its email and its saved progress | **The student:** 👤 Account → Delete my account (deletes `saves/<id>`, online data and the sign-in account). **The owner:** delete `saves/<uid>` in the database and the user under Authentication → Users. |
| A sign-in account and its email (older method) | Firebase console → Authentication → Users → delete the user. |
| A copy from the old GitHub Gist sync (removed in 5.6) | The user deletes the Gist in their own GitHub account and revokes the token. 5.6 deletes any saved token from the device. |
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
