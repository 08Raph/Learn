/* A small evaluator for Firebase Realtime Database security rules, used because the official Firebase
   Emulator Suite could not be installed in the build environment (no network access for packages).
   IT IS NOT THE FIREBASE RULES ENGINE. It implements the documented semantics that these rules rely on:
   cascading .read/.write, non-cascading .validate, $wildcards, auth, now, root/data/newData snapshots with
   val/exists/child/parent/hasChild/hasChildren/isString/isNumber/isBoolean, and String.matches/length.
   Before publishing, also run the rules in the real emulator or the console's Rules Playground
   (see docs/FIREBASE_SETUP.md). */
'use strict';
const get = (obj, parts) => { let v = obj; for (const p of parts) { if (v === null || typeof v !== 'object' || !(p in v)) return null; v = v[p]; } return v === undefined ? null : v; };
const clone = (v) => (v === null || v === undefined ? null : JSON.parse(JSON.stringify(v)));
function setAt(root, parts, value) {
  if (!parts.length) return clone(value);
  const r = root && typeof root === 'object' ? clone(root) : {}; let n = r;
  for (let i = 0; i < parts.length - 1; i++) { if (n[parts[i]] === null || typeof n[parts[i]] !== 'object') n[parts[i]] = {}; n = n[parts[i]]; }
  if (value === null || value === undefined) delete n[parts[parts.length - 1]]; else n[parts[parts.length - 1]] = clone(value);
  const prune = (o) => { if (o && typeof o === 'object') { Object.keys(o).forEach((k) => { o[k] = prune(o[k]); if (o[k] === null) delete o[k]; }); return Object.keys(o).length ? o : null; } return o === undefined ? null : o; };
  return prune(r) || {};
}
class Snap {
  constructor(root, parts) { this._r = root; this._p = parts; }
  val() { return clone(get(this._r, this._p)); }
  exists() { return get(this._r, this._p) !== null; }
  child(path) { if (typeof path !== 'string' || !path) throw new Error('child() needs a non-empty string'); return new Snap(this._r, this._p.concat(path.split('/').filter(Boolean))); }
  parent() { if (!this._p.length) throw new Error('no parent'); return new Snap(this._r, this._p.slice(0, -1)); }
  hasChild(p) { return this.child(p).exists(); }
  hasChildren(list) { const v = get(this._r, this._p); if (v === null || typeof v !== 'object') return false; return list ? list.every((k) => this.child(k).exists()) : Object.keys(v).length > 0; }
  isString() { return typeof get(this._r, this._p) === 'string'; }
  isNumber() { return typeof get(this._r, this._p) === 'number'; }
  isBoolean() { return typeof get(this._r, this._p) === 'boolean'; }
}
if (!String.prototype.matches) Object.defineProperty(String.prototype, 'matches', { value(re) { return re.test(this); } });
function evalRule(expr, ctx) {
  if (expr === true || expr === false) return expr;
  const names = Object.keys(ctx.vars);
  try { return new Function('auth', 'now', 'root', 'data', 'newData', ...names, '"use strict"; return (' + expr + ');')(ctx.auth, ctx.now, ctx.root, ctx.data, ctx.newData, ...names.map((n) => ctx.vars[n])) === true; }
  catch (e) { return false; } // an error in a rule denies, as in Firebase
}
// rule nodes along a path, with wildcard captures
function walk(rules, parts) {
  const out = [{ node: rules, depth: 0, vars: {} }]; let node = rules, vars = {};
  for (let i = 0; i < parts.length; i++) {
    if (!node || typeof node !== 'object') break;
    if (Object.prototype.hasOwnProperty.call(node, parts[i]) && parts[i][0] !== '.') node = node[parts[i]];
    else { const w = Object.keys(node).find((k) => k[0] === '$'); if (!w) { node = null; break; } vars = Object.assign({}, vars, { [w]: parts[i] }); node = node[w]; }
    out.push({ node, depth: i + 1, vars });
  }
  return out;
}
function canRead(rules, db, path, auth, now) {
  const parts = path.split('/').filter(Boolean);
  return walk(rules.rules, parts).some((s) => s.node && s.node['.read'] !== undefined && evalRule(s.node['.read'], { auth, now: now || Date.now(), root: new Snap(db, []), data: new Snap(db, parts.slice(0, s.depth)), newData: null, vars: s.vars }));
}
function canWrite(rules, db, path, value, auth, now) {
  const parts = path.split('/').filter(Boolean); const after = setAt(db, parts, value); now = now || Date.now();
  const ctxAt = (p, vars) => ({ auth, now, root: new Snap(db, []), data: new Snap(db, p), newData: new Snap(after, p), vars });
  const chain = walk(rules.rules, parts);
  const granted = chain.some((s) => s.node && s.node['.write'] !== undefined && evalRule(s.node['.write'], ctxAt(parts.slice(0, s.depth), s.vars)));
  if (!granted) return { ok: false, why: 'write denied' };
  // .validate: every rule node on the path and inside the written value whose new data exists
  const bad = [];
  const check = (node, p, vars) => { if (!node || typeof node !== 'object') return; const nd = get(after, p); if (nd === null) return;
    if (node['.validate'] !== undefined && !evalRule(node['.validate'], ctxAt(p, vars))) bad.push('/' + p.join('/'));
    if (typeof nd === 'object') Object.keys(nd).forEach((k) => { if (Object.prototype.hasOwnProperty.call(node, k) && k[0] !== '.') check(node[k], p.concat(k), vars); else { const w = Object.keys(node).find((x) => x[0] === '$'); if (w) check(node[w], p.concat(k), Object.assign({}, vars, { [w]: k })); } }); };
  chain.slice(0, -1).forEach((s) => { const nd = get(after, parts.slice(0, s.depth)); if (s.node && nd !== null && s.node['.validate'] !== undefined && !evalRule(s.node['.validate'], ctxAt(parts.slice(0, s.depth), s.vars))) bad.push('/' + parts.slice(0, s.depth).join('/')); });
  const last = chain[chain.length - 1]; if (last.depth === parts.length) check(last.node, parts, last.vars);
  return bad.length ? { ok: false, why: 'validation failed at ' + bad.join(', ') } : { ok: true, after };
}
module.exports = { canRead, canWrite, setAt, get };
