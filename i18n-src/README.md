# Translations

`tests/i18n-keys.json` lists the English interface strings (numbers written as `{0}`, `{1}`…).
For each language, `<code>.txt` has one line per string: `number|translation`, and `<code>.json` has whole-sentence
HTML pieces (`html`), two notes, and the translated Python lessons (`lessons`).

After editing, run `node tests/build-i18n.js` from the site folder. It writes `i18n/<code>.js` and refuses to build if a
line is missing or a translation changes the numbers or the symbols in front of the text. Then run `node tests/e2e-i18n.js`.

Text without a hand translation is translated automatically on the device's first view (5.8; see CHANGELOG). A hand
translation always takes priority, so adding a line here replaces the automatic one.

To add a string: append it to `tests/i18n-keys.json` (exactly as it appears on screen, with numbers as `{0}`) and add a
line with the next number to every `<code>.txt`. To add a language: add it to `LANGS` in `tests/build-i18n.js` and to
`UI_LANGS` in `app.js`, then create its two files.
