/* Security-rule tests for firebase/database.rules.json, run with tests/rules-sim.js (a simulator, not the
   official emulator; see the note at the top of that file).   node tests/firebase-rules.test.js */
const fs = require('fs'), path = require('path'); const { canRead, canWrite } = require('./rules-sim.js');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase', 'database.rules.json'), 'utf8'));
const NOW = 1800000000000; const A = (uid) => ({ uid }); const alice = A('authAlice'), bob = A('authBob'), admin = A('authAdmin'), nobody = null, stranger = A('authStranger');
let db = { duel: {
  ping: 1, admins: { authAdmin: true },
  owners: { ualice0001: 'authAlice', ubob000001: 'authBob', uadmin0001: 'authAdmin' }, uids: { authAlice: 'ualice0001', authBob: 'ubob000001', authAdmin: 'uadmin0001' },
  names: { alice: 'ualice0001' }, presence: { ualice0001: { n: 'Alice', h: 1 } },
  lb: { 1: { ualice0001: { n: 'Alice', r: 1200, w: 3, l: 1, d: 0, b: 1200, at: 1 }, ubob000001: { n: 'Bob', r: 1000, w: 0, l: 0, d: 0, b: 1000, at: 1 } } },
  fl: { ualice0001: { ubob000001: { n: 'Bob' } }, ubob000001: { ualice0001: { n: 'Alice' } } }, frq: { ualice0001: {} }, inbox: { ualice0001: { mid: 'm1', at: 1 } },
  codes: { GIFT100: { r: { xp: 100 }, exp: 0, max: 2, src: 'admin', t: 1, u: { ubob000001: 1 } }, OLD: { r: { xp: 5 }, exp: NOW - 1000, max: 0, t: 1 }, FRIENDA1: 'ualice0001' },
  rooms: { ROOM1: { h: 'ualice0001', n: 'Alice', nn: 2, b: 1, g: { ubob000001: { n: 'Bob', b: 0 } } } },
  matches: { m1: { pl: { ualice0001: { n: 'Alice' }, ubob000001: { n: 'Bob' } }, a: {} } },
  party: { ualice0001: { h: 'ualice0001', st: 'lobby', m: { ualice0001: { n: 'Alice' } } } }, queue: { k1: { ualice0001: { b: 1 } } },
  audit: { x1: { by: 'authAlice', a: 'sign-in', t: 1 } }, shopPick: { d1: ['a', 'b'] },
} };
const R = []; let pass = 0, fail = 0;
const t = (name, got, want) => { const ok = got === want; ok ? pass++ : fail++; R.push((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  [expected ' + want + ', got ' + got + ']')); };
const rd = (p, a) => canRead(rules, db, 'duel/' + p, a, NOW); const wr = (p, v, a) => canWrite(rules, db, 'duel/' + p, v, a, NOW).ok;

// --- unauthenticated access ---
t('unauthenticated: cannot read the whole database', canRead(rules, db, '', nobody, NOW), false);
t('unauthenticated: cannot read /duel', rd('', nobody), false);
t('unauthenticated: cannot read leaderboard', rd('lb/1', nobody), false);
t('unauthenticated: cannot read a friend list', rd('fl/ualice0001', nobody), false);
t('unauthenticated: cannot write a leaderboard entry', wr('lb/1/ualice0001', { n: 'X', r: 9999, w: 0, l: 0, d: 0 }, nobody), false);
t('unauthenticated: cannot create a reward code', wr('codes/FREE', { r: { xp: 99999 }, exp: 0, max: 0 }, nobody), false);
t('unauthenticated: cannot delete all data', canWrite(rules, db, 'duel', null, nobody, NOW).ok, false);
t('unauthenticated: ping is readable (connection test only)', rd('ping', nobody), true);
// --- identity binding ---
t('a new account can claim an unused player ID', wr('owners/unew000001', 'authStranger', stranger), true);
t('cannot claim a player ID for someone else', wr('owners/unew000002', 'authAlice', stranger), false);
t('cannot take over a player ID that is already claimed', wr('owners/ualice0001', 'authStranger', stranger), false);
t('the owner cannot be changed, even by the owner', wr('owners/ualice0001', 'authBob', alice), false);
t('another account cannot remove an owner record', wr('owners/ualice0001', null, bob), false);
t('delete my data: a player can remove their own owner record', wr('owners/ualice0001', null, alice), true);
t('delete my data: an account can remove its own player mapping', wr('uids/authAlice', null, alice), true);
t('delete my data: an account cannot remove another account\'s mapping', wr('uids/authAlice', null, bob), false);
t('delete my data: a player can remove their presence, leaderboard entry and name', wr('presence/ualice0001', null, alice) && wr('lb/1/ualice0001', null, alice) && wr('names/alice', null, alice), true);
t('delete my data: a player can remove each friend entry on both sides', wr('fl/ualice0001/ubob000001', null, alice) && wr('fl/ubob000001/ualice0001', null, alice), true);
t('delete my data: a player can remove their own friend code', wr('codes/FRIENDA1', null, alice), true);
t('delete my data: a player cannot remove someone else\'s friend code', wr('codes/FRIENDA1', null, bob), false);
t('malformed player IDs are rejected', wr('owners/../hack', 'authStranger', stranger) || wr('owners/BAD ID', 'authStranger', stranger), false);
t('an account cannot map itself to a player ID it does not own', wr('uids/authStranger', 'ualice0001', stranger), false);
t('an account cannot change its player ID once set', wr('uids/authAlice', 'ubob000001', alice), false);
t('an account cannot read another account\'s mapping', rd('uids/authAlice', bob), false);
// --- own data ---
t('a player can update their own presence', wr('presence/ualice0001', { n: 'Alice', h: 2 }, alice), true);
t('a player can write their own leaderboard entry', wr('lb/1/ualice0001', { n: 'Alice', r: 1210, w: 4, l: 1, d: 0, b: 1210, at: 2 }, alice), true);
t('a player can read their own friend list and inbox', rd('fl/ualice0001', alice) && rd('inbox/ualice0001', alice), true);
t('a player can clear their own inbox', wr('inbox/ualice0001', null, alice), true);
// --- other users' data ---
t('cannot read another player\'s friend list', rd('fl/ualice0001', bob), false);
t('cannot read another player\'s inbox', rd('inbox/ualice0001', bob), false);
t('cannot read another player\'s friend requests or invitations', rd('frq/ualice0001', bob) || rd('inv/ualice0001', bob), false);
t('cannot write another player\'s presence (impersonation)', wr('presence/ualice0001', { n: 'Fake', h: 3 }, bob), false);
t('cannot delete another player\'s presence', wr('presence/ualice0001', null, bob), false);
t('cannot take a name that is in use', wr('names/alice', 'ubob000001', bob), false);
t('cannot register a name for another player', wr('names/zed', 'ualice0001', bob), false);
t('cannot release another player\'s name', wr('names/alice', null, bob), false);
t('can send a friend request as yourself', wr('frq/ualice0001/ubob000001', { n: 'Bob', t: 1 }, bob), true);
t('cannot send a friend request pretending to be someone else', wr('frq/ualice0001/uadmin0001', { n: 'Admin', t: 1 }, bob), false);
t('cannot add yourself to a stranger\'s friend list as a third party', wr('fl/ualice0001/uadmin0001', { n: 'x' }, bob), false);
t('a signed-in player with no claimed ID cannot post to an inbox', wr('inbox/ualice0001', { mid: 'x', at: 1 }, stranger), false);
// --- leaderboard manipulation ---
t('cannot overwrite another player\'s leaderboard entry', wr('lb/1/ualice0001', { n: 'Alice', r: 0, w: 0, l: 99, d: 0 }, bob), false);
t('cannot delete another player\'s leaderboard entry', wr('lb/1/ualice0001', null, bob), false);
t('cannot replace a whole leaderboard', wr('lb/1', { ubob000001: { n: 'Bob', r: 9999, w: 0, l: 0, d: 0 } }, bob), false);
t('own entry: absurd rating rejected by validation', wr('lb/1/ubob000001', { n: 'Bob', r: 999999, w: 0, l: 0, d: 0 }, bob), false);
t('own entry: negative or non-numeric values rejected', wr('lb/1/ubob000001', { n: 'Bob', r: 1000, w: -5, l: 0, d: 0 }, bob) || wr('lb/1/ubob000001', { n: 'Bob', r: '1000', w: 0, l: 0, d: 0 }, bob), false);
t('own entry: over-long name rejected', wr('lb/1/ubob000001', { n: 'B'.repeat(60), r: 1000, w: 0, l: 0, d: 0 }, bob), false);
// --- reward codes ---
t('a player cannot create a reward code', wr('codes/MINE', { r: { xp: 100000 }, exp: 0, max: 0 }, bob), false);
t('a player cannot edit a reward code\'s reward', wr('codes/GIFT100/r', { xp: 100000 }, bob), false);
t('a player cannot delete a reward code', wr('codes/GIFT100', null, bob), false);
t('a player cannot list all codes', rd('codes', bob), false);
t('a player can look up a single code they know', rd('codes/GIFT100', bob), true);
t('a player can redeem a valid code once', wr('codes/GIFT100/u/ualice0001', 1, alice), true);
t('duplicate redemption is refused', wr('codes/GIFT100/u/ubob000001', 1, bob), false);
t('a player cannot erase their redemption to redeem again', wr('codes/GIFT100/u/ubob000001', null, bob), false);
t('cannot redeem on behalf of another player', wr('codes/GIFT100/u/ualice0001', 1, bob), false);
t('an expired code cannot be redeemed', wr('codes/OLD/u/ualice0001', 1, alice), false);
t('cannot record a redemption on a friend code', wr('codes/FRIENDA1/u/ubob000001', 1, bob), false);
t('a player can create their own friend code', wr('codes/FRIENDB1', 'ubob000001', bob), true);
t('cannot create a friend code pointing at someone else', wr('codes/FRIENDX', 'ualice0001', bob), false);
t('cannot overwrite an existing friend code', wr('codes/FRIENDA1', 'ubob000001', bob), false);
// --- unauthorised deletion / shared data ---
t('cannot delete someone else\'s room', wr('rooms/ROOM1', null, bob), false);
t('cannot take over someone else\'s room', wr('rooms/ROOM1/h', 'ubob000001', bob), false);
t('a guest can join a room as themselves', wr('rooms/ROOM1/g/ubob000001', { n: 'Bob', b: 1 }, bob), true);
t('cannot join a room as someone else', wr('rooms/ROOM1/g/uadmin0001', { n: 'Admin' }, bob), false);
t('the host can update and close their room', wr('rooms/ROOM1/b', 2, alice) && wr('rooms/ROOM1', null, alice), true);
t('a non-participant cannot read-modify a match', wr('matches/m1/a/ualice0001/q0', { c: 1, t: 10 }, admin), false);
t('a participant can submit their own answer', wr('matches/m1/a/ubob000001/q0', { c: 1, t: 900 }, bob), true);
t('a participant cannot submit an answer for the opponent', wr('matches/m1/a/ualice0001/q0', { c: 0, t: 1 }, bob), false);
t('a non-participant cannot delete a match', wr('matches/m1', null, admin), false);
t('cannot create a match you are not in', wr('matches/m9', { pl: { ualice0001: { n: 'Alice' } } }, bob), false);
t('cannot rewrite an existing match wholesale', wr('matches/m1', { pl: { ubob000001: { n: 'Bob' } }, a: { ubob000001: { q0: { c: 1, t: 1 } } } }, bob), false);
t('cannot disband someone else\'s party', wr('party/ualice0001', null, bob), false);
t('can join a party as yourself only', wr('party/ualice0001/m/ubob000001', { n: 'Bob' }, bob) && !wr('party/ualice0001/m/uadmin0001', { n: 'A' }, bob), true);
t('unknown top-level paths are closed', wr('anything', { x: 1 }, alice) || rd('anything', alice), false);
t('the audit log cannot be read by players', rd('audit', alice), false);
t('audit entries cannot be altered or deleted', wr('audit/x1', null, alice) || wr('audit/x1/a', 'changed', alice), false);
t('audit entries cannot be forged for another account', wr('audit/x2', { by: 'authAlice', a: 'sign-in' }, bob), false);
// --- administrator ---
t('nobody can make themselves an administrator', wr('admins/authBob', true, bob), false);
t('an administrator cannot add administrators from the app either', wr('admins/authBob', true, admin), false);
t('an account can check only its own admin flag', rd('admins/authAdmin', admin) && !rd('admins/authAdmin', bob), true);
t('an administrator can create a reward code', wr('codes/NEWCODE', { r: { xp: 50 }, exp: 0, max: 10, src: 'admin', t: 1 }, admin), true);
t('an administrator can delete a reward code', wr('codes/GIFT100', null, admin), true);
t('an administrator can list codes and read the audit log', rd('codes', admin) && rd('audit', admin), true);
t('an administrator still cannot read players\' private friend lists or inboxes', rd('fl/ualice0001', admin) || rd('inbox/ualice0001', admin), false);
t('an administrator cannot edit another player\'s leaderboard entry', wr('lb/1/ualice0001', { n: 'Alice', r: 1, w: 0, l: 0, d: 0 }, admin), false);
console.log(R.join('\n')); console.log(fail + ' failed of ' + (pass + fail) + '  (rules simulator, not the Firebase emulator)'); process.exit(fail ? 1 : 0);
