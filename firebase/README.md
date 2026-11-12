# firebase/

| File | Purpose |
|---|---|
| `database.rules.json` | The Realtime Database security rules for secure mode. **Not published anywhere by this release.** |
| `firebase.json` | Configuration for the Firebase CLI and Emulator Suite. Contains no secrets. |
| `.firebaserc.example` | Template for project aliases. Copy to `.firebaserc` and fill in your own project IDs. Contains no secrets. |

There are no credentials in this folder and none are needed in it. The only Firebase value the website
needs is the **Web API key**, which goes in `index.html` (`FB_API_KEY`). A Web API key identifies the
project; it is not a secret and is designed to be public. Never put a service-account JSON file, a private
key or a database secret in this repository.

Full instructions: `docs/FIREBASE_SETUP.md`.
