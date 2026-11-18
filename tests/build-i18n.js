/* Builds i18n/<code>.js from tests/i18n-keys.json (the English interface strings) and i18n-src/<code>.txt
   (one "number|translation" line per string) plus i18n-src/<code>.json (whole-sentence HTML pieces, notes and lesson
   translations). Refuses to build if a line is missing or a translation changes the numbers ({0}, {1}...) or the
   symbols in front of the text.  Run from the app folder:  node tests/build-i18n.js */
const fs = require('fs'), path = require('path'); const ROOT = process.env.APP_DIR || path.join(__dirname, '..');
const keys = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'i18n-keys.json'), 'utf8'));
const LANGS = { es: ['Español', 'ltr'], fr: ['Français', 'ltr'], zh: ['中文', 'ltr'], hi: ['हिन्दी', 'ltr'], ar: ['العربية', 'rtl'] };
const ph = (s) => (s.match(/\{\d+\}/g) || []).sort().join(',');
const lead = (s) => { const m = /^[^\p{L}\p{N}{(（]*/u.exec(s); return m[0].replace(/[←→]/g, '↔').replace(/[\s¿¡«»"'“”„]/g, ''); };
let bad = 0;
for (const [code, [name, dir]] of Object.entries(LANGS)) {
  const txt = path.join(ROOT, 'i18n-src', code + '.txt'); if (!fs.existsSync(txt)) { console.log(code + ': no source yet'); continue; }
  const tr = {}; fs.readFileSync(txt, 'utf8').split('\n').forEach((l) => { const m = /^(\d+)\|(.*)$/.exec(l); if (m) tr[+m[1]] = m[2].trim(); });
  const ui = {}; const probs = [];
  keys.forEach((k, i) => { const t = tr[i]; if (!t) { probs.push('missing ' + i + ' ' + k); return; } if (ph(t) !== ph(k)) probs.push('numbers differ ' + i + ': ' + k + ' => ' + t); if (lead(t) !== lead(k)) probs.push('symbols differ ' + i + ': ' + k + ' => ' + t); ui[k] = t; });
  Object.keys(tr).forEach((i) => { if (+i >= keys.length) probs.push('extra line ' + i); });
  const extra = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n-src', code + '.json'), 'utf8'));
  ['html', 'lessons'].forEach((f) => { if (!extra[f]) probs.push('no ' + f); });
  for (const [id, L] of Object.entries(extra.lessons || {})) for (const f of ['title', 'body', 'task', 'hint', 'why']) if (!L[f]) probs.push('lesson ' + id + ' has no ' + f);
  if (probs.length) { bad += probs.length; console.log(code + ': ' + probs.length + ' problems'); probs.slice(0, 15).forEach((p) => console.log('   ' + p)); continue; }
  const out = { code, name, dir, lessonNote: extra.lessonNote, uniNote: extra.uniNote, html: extra.html, ui, lessons: extra.lessons };
  fs.writeFileSync(path.join(ROOT, 'i18n', code + '.js'), '/* Learn interface: ' + name + '. Built by tests/build-i18n.js from i18n-src/' + code + '.txt and .json; edit those, not this file. */\nwindow.LEARN_I18N = ' + JSON.stringify(out) + ';\n');
  console.log(code + ': ' + Object.keys(ui).length + ' strings, ' + Object.keys(extra.lessons).length + ' lessons');
}
process.exit(bad ? 1 : 0);
