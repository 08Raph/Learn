/* ============================================================
   Technology University: simulators module (loaded on demand, 5.9)
     circuit   logic circuit simulator with graded tasks (gates, adders, decoders, flip-flops, counters)
     range     ethical hacking range: capture-the-flag challenges against FAKE targets that exist only in this page
   Nothing here sends anything over the network. The hacking range never contacts a real computer: every
   "server" is a JavaScript function below, and the guestbook runs in a sandboxed frame with no access to Learn.
   Progress is stored in the Learn save (uni.circ and uni.range).
   ============================================================ */
(window.LEARN_MOD_BUILD = window.LEARN_MOD_BUILD || {})['uni-sims'] = '2.0.3'; // must equal BUILD in university.js
(function () {
  'use strict';
  const U = window.LearnUniversity, A = U.api;
  const { $, $$, E, inline, st, save, shell, link } = U;
  const today = () => A.dayStr(new Date());
  const S = {};

  /* ================= 1. Circuit simulator ================= */
  const GATES = { AND: [2, (a, b) => a & b], OR: [2, (a, b) => a | b], NOT: [1, (a) => 1 - a], NAND: [2, (a, b) => 1 - (a & b)], NOR: [2, (a, b) => 1 - (a | b)], XOR: [2, (a, b) => a ^ b], XNOR: [2, (a, b) => 1 - (a ^ b)] };
  const ALLG = Object.keys(GATES);
  const seqOf = (s) => s.split('').map(Number);
  const CT = [
    { id: 'not', lvl: 'Gates', title: 'NOT from NAND', ins: ['A'], outs: ['Y'], only: ['NAND'], max: 1, goal: 'Build a NOT gate using only NAND gates: the output Y must always be the opposite of the input A.', fn: (v) => ({ Y: 1 - v.A }),
      hints: ['A NAND gate gives 0 only when both of its inputs are 1.', 'Connect both inputs of one NAND gate to A.'], sol: { g: [['NAND', 'A', 'A']], o: { Y: 'G1' } } },
    { id: 'and', lvl: 'Gates', title: 'AND from NAND', ins: ['A', 'B'], outs: ['Y'], only: ['NAND'], max: 2, goal: 'Build an AND gate using only NAND gates (at most two).', fn: (v) => ({ Y: v.A & v.B }),
      hints: ['NAND is "not AND". What happens if you invert its output?', 'You built a NOT from one NAND in the previous task.'], sol: { g: [['NAND', 'A', 'B'], ['NAND', 'G1', 'G1']], o: { Y: 'G2' } } },
    { id: 'or', lvl: 'Gates', title: 'OR from NAND', ins: ['A', 'B'], outs: ['Y'], only: ['NAND'], max: 3, goal: 'Build an OR gate using only NAND gates (at most three).', fn: (v) => ({ Y: v.A | v.B }),
      hints: ['De Morgan\'s law: A or B = not( (not A) and (not B) ).', 'Invert A and B with one NAND each, then NAND the two results.'], sol: { g: [['NAND', 'A', 'A'], ['NAND', 'B', 'B'], ['NAND', 'G1', 'G2']], o: { Y: 'G3' } } },
    { id: 'xor', lvl: 'Gates', title: 'XOR from four NANDs', ins: ['A', 'B'], outs: ['Y'], only: ['NAND'], max: 4, goal: 'Build an XOR gate (output 1 when the inputs differ) using at most four NAND gates. This is a classic puzzle.', fn: (v) => ({ Y: v.A ^ v.B }),
      hints: ['Start with N = NAND(A, B).', 'Then NAND(A, N) and NAND(B, N).', 'Finally NAND those two results together.'], sol: { g: [['NAND', 'A', 'B'], ['NAND', 'A', 'G1'], ['NAND', 'B', 'G1'], ['NAND', 'G2', 'G3']], o: { Y: 'G4' } } },
    { id: 'half', lvl: 'Arithmetic', title: 'Half adder', ins: ['A', 'B'], outs: ['S', 'C'], max: 2, goal: 'Add two bits. S is the sum bit and C is the carry: 1 + 1 = 10 in binary, so S = 0 and C = 1. Use at most two gates.', fn: (v) => ({ S: v.A ^ v.B, C: v.A & v.B }),
      hints: ['Write out the four rows of the truth table for S and for C.', 'S is 1 when the inputs differ; C is 1 only when both are 1.'], sol: { g: [['XOR', 'A', 'B'], ['AND', 'A', 'B']], o: { S: 'G1', C: 'G2' } } },
    { id: 'full', lvl: 'Arithmetic', title: 'Full adder', ins: ['A', 'B', 'Cin'], outs: ['S', 'Cout'], max: 5, goal: 'Add three bits: A, B and the carry coming in from the column to the right (Cin). S is the sum bit and Cout the carry out. Use at most five gates.', fn: (v) => { const t = v.A + v.B + v.Cin; return { S: t & 1, Cout: t >> 1 }; },
      hints: ['A full adder is two half adders and an OR gate.', 'First add A and B, then add Cin to that sum.', 'Cout is 1 if either half adder produced a carry.'], sol: { g: [['XOR', 'A', 'B'], ['AND', 'A', 'B'], ['XOR', 'G1', 'Cin'], ['AND', 'G1', 'Cin'], ['OR', 'G2', 'G4']], o: { S: 'G3', Cout: 'G5' } } },
    { id: 'mux', lvl: 'Building blocks', title: '2-to-1 multiplexer', ins: ['A', 'B', 'Sel'], outs: ['Y'], max: 4, goal: 'A multiplexer chooses between inputs. When Sel is 0, Y must equal A. When Sel is 1, Y must equal B. Use at most four gates.', fn: (v) => ({ Y: v.Sel ? v.B : v.A }),
      hints: ['Y = (A and not Sel) or (B and Sel).', 'You need one NOT, two AND and one OR.'], sol: { g: [['NOT', 'Sel'], ['AND', 'A', 'G1'], ['AND', 'B', 'Sel'], ['OR', 'G2', 'G3']], o: { Y: 'G4' } } },
    { id: 'dec', lvl: 'Building blocks', title: '2-to-4 decoder', ins: ['A1', 'A0'], outs: ['Y0', 'Y1', 'Y2', 'Y3'], max: 6, goal: 'The two inputs form a binary number from 0 to 3 (A1 is the high bit). Exactly one output must be 1: the one with that number. So A1 = 1, A0 = 0 (two) lights Y2 only. Use at most six gates.', fn: (v) => { const n = v.A1 * 2 + v.A0; return { Y0: +(n === 0), Y1: +(n === 1), Y2: +(n === 2), Y3: +(n === 3) }; },
      hints: ['Make NOT A1 and NOT A0 first.', 'Each output is one AND of two signals: Y0 = (not A1) and (not A0).'], sol: { g: [['NOT', 'A1'], ['NOT', 'A0'], ['AND', 'G1', 'G2'], ['AND', 'G1', 'A0'], ['AND', 'A1', 'G2'], ['AND', 'A1', 'A0']], o: { Y0: 'G3', Y1: 'G4', Y2: 'G5', Y3: 'G6' } } },
    { id: 'maj', lvl: 'Building blocks', title: 'Majority vote', ins: ['A', 'B', 'C'], outs: ['Y'], max: 5, goal: 'Three sensors vote. Y must be 1 when at least two of A, B and C are 1. (Spacecraft use circuits like this so that one faulty sensor cannot decide alone.) Use at most five gates.', fn: (v) => ({ Y: +(v.A + v.B + v.C >= 2) }),
      hints: ['Y is 1 if A and B are both 1, or A and C, or B and C.', 'Three AND gates and two OR gates.'], sol: { g: [['AND', 'A', 'B'], ['AND', 'A', 'C'], ['AND', 'B', 'C'], ['OR', 'G1', 'G2'], ['OR', 'G4', 'G3']], o: { Y: 'G5' } } },
    { id: 'eq', lvl: 'Building blocks', title: '2-bit equality comparator', ins: ['A1', 'A0', 'B1', 'B0'], outs: ['EQ'], max: 3, goal: 'A1 A0 and B1 B0 are two 2-bit numbers. EQ must be 1 exactly when the numbers are equal. Use at most three gates.', fn: (v) => ({ EQ: +(v.A1 === v.B1 && v.A0 === v.B0) }),
      hints: ['Two numbers are equal when every pair of bits is equal.', 'XOR tells you when two bits differ. NOR of the two XORs is 1 only when neither pair differs.'], sol: { g: [['XOR', 'A1', 'B1'], ['XOR', 'A0', 'B0'], ['NOR', 'G1', 'G2']], o: { EQ: 'G3' } } },
    { id: 'toggle', lvl: 'Sequential', title: 'Toggle flip-flop', ins: ['T'], outs: ['Q'], ffs: 1, max: 2, seq: seqOf('101101001110'), goal: 'Memory. Q starts at 0. On every clock tick, Q must flip (0 to 1, or 1 to 0) if T is 1, and stay the same if T is 0. Use one D flip-flop: on each tick it stores whatever is on its D input.', ref: (seq) => { let q = 0; return seq.map((t) => { const o = { Q: q }; q ^= t; return o; }); },
      hints: ['The flip-flop output FF1 is the current Q. Connect output Q to FF1.', 'The next value of Q is Q XOR T. Feed that into D.'], sol: { g: [['XOR', 'FF1', 'T']], f: ['G1'], o: { Q: 'FF1' } } },
    { id: 'count', lvl: 'Sequential', title: '2-bit counter', ins: ['EN'], outs: ['Q1', 'Q0'], ffs: 2, max: 4, seq: seqOf('1111011101101111'), goal: 'Count 0, 1, 2, 3, 0, 1, … in binary on Q1 Q0 (Q1 is the high bit), going up by one on each clock tick while EN is 1 and holding still while EN is 0. Both flip-flops start at 0.', ref: (seq) => { let s = 0; return seq.map((e) => { const o = { Q1: (s >> 1) & 1, Q0: s & 1 }; if (e) s = (s + 1) & 3; return o; }); },
      hints: ['FF1 holds Q0 and FF2 holds Q1 (or the other way round, as long as you connect the outputs to match).', 'The low bit toggles when EN is 1: next Q0 = Q0 XOR EN.', 'The high bit toggles when EN is 1 and Q0 is 1: next Q1 = Q1 XOR (Q0 AND EN).'], sol: { g: [['XOR', 'FF1', 'EN'], ['AND', 'FF1', 'EN'], ['XOR', 'FF2', 'G2']], f: ['G1', 'G3'], o: { Q1: 'FF2', Q0: 'FF1' } } },
    { id: 'detect', lvl: 'Sequential', title: 'Two-in-a-row detector', ins: ['X'], outs: ['Y'], ffs: 2, max: 2, seq: seqOf('0110111001011100'), goal: 'Y must be 1 on a tick exactly when the input X was 1 on each of the two previous ticks. Before anything has happened, treat the earlier inputs as 0. This is a tiny pattern-recognising state machine.', ref: (seq) => { let p1 = 0, p2 = 0; return seq.map((x) => { const o = { Y: p1 & p2 }; p2 = p1; p1 = x; return o; }); },
      hints: ['Use the flip-flops as a two-step memory: FF1 remembers the last X, FF2 the one before.', 'D of FF1 is X; D of FF2 is FF1. Then Y = FF1 AND FF2.'], sol: { g: [['AND', 'FF1', 'FF2']], f: ['X', 'FF1'], o: { Y: 'G1' } } },
  ];
  S.CT = CT;
  const SANDBOX = { id: 'sandbox', lvl: 'Free practice', title: 'Sandbox', ins: ['A', 'B', 'C'], outs: ['X', 'Y'], ffs: 2, max: 30, goal: 'Build anything. Nothing is checked or graded here.', free: true, hints: [] };
  const taskById = (id) => (id === 'sandbox' ? SANDBOX : CT.find((t) => t.id === id));
  const blank = (t) => ({ g: [], f: [], o: Object.fromEntries(t.outs.map((o) => [o, ''])), n: 1 });
  const fromSol = (t) => { const c = blank(t); t.sol.g.forEach((x) => { c.g.push({ id: 'G' + c.n++, t: x[0], i: x.slice(1) }); }); (t.sol.f || []).forEach((d, i) => c.f.push({ id: 'FF' + (i + 1), d })); Object.assign(c.o, t.sol.o); return c; };
  S.fromSol = fromSol;
  function cleanC(t, c) { // saved drafts and restored backups are untrusted input
    const out = blank(t); if (!c || typeof c !== 'object') return out;
    const ref = (x) => (typeof x === 'string' && /^[A-Za-z][A-Za-z0-9]{0,5}$/.test(x) ? x : '');
    (Array.isArray(c.g) ? c.g : []).slice(0, 40).forEach((g) => { if (g && GATES[g.t] && /^G\d{1,3}$/.test(g.id) && !out.g.some((x) => x.id === g.id)) out.g.push({ id: g.id, t: g.t, i: [ref((g.i || [])[0]), ref((g.i || [])[1])] }); });
    (Array.isArray(c.f) ? c.f : []).slice(0, t.ffs || 0).forEach((f, i) => out.f.push({ id: 'FF' + (i + 1), d: ref(f && f.d) }));
    t.outs.forEach((o) => { out.o[o] = ref(c.o && c.o[o]); });
    out.n = Math.max(1, ...out.g.map((g) => +g.id.slice(1) + 1)); return out;
  }
  const srcsFor = (t, c, idx) => t.ins.concat(c.f.map((f) => f.id), c.g.slice(0, idx < 0 ? c.g.length : idx).map((g) => g.id)); // a gate may only use parts above it, so there are no loops
  function evalC(c, ins, ff) {
    const v = Object.assign({}, ins); c.f.forEach((f, i) => { v[f.id] = ff[i] || 0; });
    for (const g of c.g) { const G = GATES[g.t]; const a = v[g.i[0]], b = G[0] === 2 ? v[g.i[1]] : 0; v[g.id] = (a === 0 || a === 1) && (b === 0 || b === 1) ? G[1](a, b) : undefined; }
    return v;
  }
  function problems(t, c) {
    const P = []; c.g.forEach((g, k) => { const ok = srcsFor(t, c, k); if (!ok.includes(g.i[0]) || (GATES[g.t][0] === 2 && !ok.includes(g.i[1]))) P.push(g.id + ' has an input that is not connected'); });
    c.f.forEach((f) => { if (!srcsFor(t, c, -1).includes(f.d)) P.push(f.id + ' has nothing connected to D'); });
    t.outs.forEach((o) => { if (!srcsFor(t, c, -1).includes(c.o[o])) P.push('Output ' + o + ' is not connected'); });
    return P;
  }
  function grade(t, c) { // returns { pass, checks: [[label, ok]], rows: [{ ins, exp, got, ok }] }
    const P = problems(t, c); const checks = [['Every gate, flip-flop and output is connected', !P.length]];
    if (t.only) checks.push(['Only ' + t.only.join(' and ') + ' gates are used', c.g.every((g) => t.only.includes(g.t))]);
    if (t.max && !t.free) checks.push(['At most ' + t.max + ' gate' + (t.max === 1 ? '' : 's') + ' (you have ' + c.g.length + ')', c.g.length <= t.max]);
    const rows = [];
    if (t.seq) { let ff = c.f.map(() => 0); const exp = t.ref(t.seq); t.seq.forEach((x, k) => { const ins = { [t.ins[0]]: x }; const v = evalC(c, ins, ff); const got = {}; t.outs.forEach((o) => { got[o] = v[c.o[o]]; }); rows.push({ ins, exp: exp[k], got, ok: t.outs.every((o) => got[o] === exp[k][o]) }); ff = c.f.map((f) => (v[f.d] === 1 ? 1 : 0)); });
      if (!t.free) checks.push(['Correct on all ' + t.seq.length + ' clock ticks of the test sequence', rows.every((r) => r.ok)]); }
    else { const n = t.ins.length; for (let k = 0; k < 1 << n; k++) { const ins = {}; t.ins.forEach((nm, j) => { ins[nm] = (k >> (n - 1 - j)) & 1; }); const v = evalC(c, ins, []); const got = {}; t.outs.forEach((o) => { got[o] = v[c.o[o]]; }); const exp = t.fn ? t.fn(ins) : null; rows.push({ ins, exp, got, ok: !exp || t.outs.every((o) => got[o] === exp[o]) }); }
      if (!t.free) checks.push(['Correct for all ' + rows.length + ' input combinations', rows.every((r) => r.ok)]); }
    return { pass: !t.free && checks.every((x) => x[1]), checks, rows };
  }
  S.grade = (id, c) => { const t = taskById(id); return grade(t, cleanC(t, c)); };
  const circRec = (id) => st().circ[id] || {};
  function diagram(t, c, live, ffv) {
    const v = evalC(c, live, ffv); const depth = {}; t.ins.forEach((x) => { depth[x] = 0; }); c.f.forEach((f) => { depth[f.id] = 0; });
    c.g.forEach((g) => { depth[g.id] = 1 + Math.max(0, ...g.i.slice(0, GATES[g.t][0]).map((x) => depth[x] || 0)); });
    const maxD = Math.max(0, ...c.g.map((g) => depth[g.id])); const cols = {}; const pos = {}; const CW = 112, RH = 52, W = 66, H = 34;
    const place = (id, d) => { cols[d] = (cols[d] || 0) + 1; pos[id] = { x: 12 + d * CW, y: 14 + (cols[d] - 1) * RH }; };
    t.ins.forEach((x) => place(x, 0)); c.f.forEach((f) => place(f.id, 0)); c.g.forEach((g) => place(g.id, depth[g.id])); t.outs.forEach((o) => place('out:' + o, maxD + 1));
    const rowsN = Math.max(...Object.values(cols)); const w = 12 + (maxD + 2) * CW, h = 14 + rowsN * RH + 30;
    const cls = (x) => (x === 1 ? 'on' : x === 0 ? 'off' : 'na');
    let wires = '', nodes = '';
    const wire = (from, to, slot, back) => { const a = pos[from], b = pos[to]; if (!a || !b) return; const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + slot; const d = back ? 'M' + x1 + ' ' + y1 + ' C' + (x1 + 40) + ' ' + (h - 8) + ',' + (x2 - 40) + ' ' + (h - 8) + ',' + x2 + ' ' + y2 : 'M' + x1 + ' ' + y1 + ' C' + (x1 + 30) + ' ' + y1 + ',' + (x2 - 30) + ' ' + y2 + ',' + x2 + ' ' + y2; wires += '<path class="czw ' + cls(v[from]) + (back ? ' back' : '') + '" d="' + d + '"/>'; };
    c.g.forEach((g) => { const two = GATES[g.t][0] === 2; wire(g.i[0], g.id, two ? 10 : H / 2); if (two) wire(g.i[1], g.id, H - 10); });
    c.f.forEach((f) => wire(f.d, f.id, H / 2, true)); t.outs.forEach((o) => wire(c.o[o], 'out:' + o, H / 2));
    const box = (id, label, sub, val, extra) => { const p = pos[id]; nodes += '<g class="czn ' + cls(val) + '" transform="translate(' + p.x + ' ' + p.y + ')"' + (extra || '') + '><rect width="' + W + '" height="' + H + '" rx="8"/><text x="' + W / 2 + '" y="15" text-anchor="middle">' + E(label) + '</text><text class="czv" x="' + W / 2 + '" y="28" text-anchor="middle">' + E(sub) + '</text></g>'; };
    t.ins.forEach((x) => box(x, x, String(live[x]), live[x], ' role="button" tabindex="0" data-in="' + E(x) + '" aria-label="Input ' + E(x) + ' is ' + live[x] + '. Activate to switch it."'));
    c.f.forEach((f, i) => box(f.id, f.id, 'stores ' + ffv[i], ffv[i]));
    c.g.forEach((g) => box(g.id, g.id + ' ' + g.t, v[g.id] === undefined ? '?' : String(v[g.id]), v[g.id]));
    t.outs.forEach((o) => box('out:' + o, o, v[c.o[o]] === undefined ? '?' : String(v[c.o[o]]), v[c.o[o]]));
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + Math.round(w * 1.4) + '" height="' + Math.round(h * 1.4) + '" role="img" aria-label="Circuit diagram with live values">' + wires + nodes + '</svg>';
  }
  S.circuit = function (path) {
    const crumbs = [['University', []], ['Laboratories', ['labs']], ['Circuit simulator', ['circuit']]];
    const t = taskById(path[1]);
    if (!t) {
      const n = CT.filter((x) => circRec(x.id).pass).length;
      let h = '<section class="u-stagehero"><p class="u-eyebrow">Laboratory</p><h1>Circuit simulator</h1><p>Build digital circuits from logic gates and flip-flops, flip the inputs to watch signals move, and have every task checked against its full truth table or a timed test sequence. It runs on this device and works offline.</p><div class="uc-meta"><span>' + n + ' of ' + CT.length + ' tasks passed</span></div></section>';
      ['Gates', 'Arithmetic', 'Building blocks', 'Sequential'].forEach((lv) => { h += '<h2 class="u-h2">' + E(lv) + '</h2><ul class="u-list">' + CT.filter((x) => x.lvl === lv).map((x) => { const r = circRec(x.id); return '<li>' + link(['circuit', x.id], '<b>' + E(x.title) + '</b><small>' + (r.pass ? 'Passed ✓ on ' + E(r.at) : r.tries ? 'Started' : 'Not started') + '</small>') + '</li>'; }).join('') + '</ul>'; });
      h += '<h2 class="u-h2">Free practice</h2><ul class="u-list"><li>' + link(['circuit', 'sandbox'], '<b>Sandbox</b><small>Three inputs, two outputs, every gate and two flip-flops. Nothing is checked.</small>') + '</li></ul>';
      h += '<div class="card"><h2>What the simulator does and does not do</h2><p>It models ideal logic: every gate answers instantly and every flip-flop stores its D input exactly on the clock tick. Real circuits have propagation delay, setup and hold times and noise, which are covered in the lessons of CEN 104. Gates have at most two inputs, and a gate can only use parts listed above it, so loops can only pass through a flip-flop, the way real synchronous circuits work.</p><p>' + link(['course', 'ce104'], 'Course: CEN 104 Digital Logic Design →', 'btn small') + '</p></div>';
      shell('labs', h, crumbs); return;
    }
    const rec0 = circRec(t.id); let c = cleanC(t, rec0.c); const live = Object.fromEntries(t.ins.map((x) => [x, 0])); let ffv = c.f.map(() => 0); let usedSol = false;
    const allowed = t.only || ALLG;
    let h = '<article class="u-lab cz"><header><p class="u-eyebrow">' + (t.free ? 'Circuit simulator' : 'Circuit task · ' + E(t.lvl)) + '</p><h1>' + E(t.title) + '</h1><p class="pill" id="czState">' + (t.free ? 'Free practice. Saved on this device, never graded.' : rec0.pass ? 'Passed ✓ on ' + E(rec0.at) + '. You can rebuild it.' : 'Checked automatically after every change.') + '</p></header>' +
      '<div class="u-prose"><p>' + inline(t.goal) + '</p><p class="u-fine">Inputs: <b>' + t.ins.map(E).join(', ') + '</b> · outputs: <b>' + t.outs.map(E).join(', ') + '</b>' + (t.only ? ' · only ' + t.only.join(', ') + ' gates' : '') + (t.max && !t.free ? ' · at most ' + t.max + ' gate' + (t.max === 1 ? '' : 's') : '') + (t.ffs ? ' · up to ' + t.ffs + ' D flip-flop' + (t.ffs === 1 ? '' : 's') : '') + '</p></div>' +
      (t.free ? '' : '<div class="card ts-checks"><h2>Checklist</h2><ul id="czChecks" aria-live="polite"></ul></div>') +
      '<div class="cz-tools" role="group" aria-label="Add a part">' + allowed.map((g) => '<button type="button" class="btn small" data-add="' + g + '">+ ' + g + '</button>').join('') + (t.ffs ? '<button type="button" class="btn small" data-add="FF">+ D flip-flop</button>' : '') + '</div>' +
      '<div class="cz-board" id="czBoard"></div><p class="u-fine">Tap an input box to switch it between 0 and 1. Green wires carry 1.' + (t.ffs ? ' Dashed wires go into a flip-flop and take effect on the next tick.' : '') + '</p>' +
      (t.ffs ? '<p class="row" style="gap:8px"><button type="button" class="btn small primary" id="czTick">⏱ Clock tick</button><button type="button" class="btn small" id="czRst">Reset flip-flops to 0</button></p>' : '') +
      '<div class="u-cols"><section><h2 class="u-h2">Parts</h2><ol class="cz-parts" id="czParts"></ol></section><section><h2 class="u-h2">Outputs</h2><div class="cz-parts" id="czOuts"></div></section></div>' +
      '<h2 class="u-h2">' + (t.seq ? 'Test sequence (one row per clock tick)' : 'Truth table') + '</h2><div class="cz-table" id="czTable"></div>' +
      (t.free ? '' : '<details class="card"><summary>Hints</summary><ul>' + t.hints.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ul></details><details class="card"><summary>One possible solution (try first)</summary><p>' + E(t.sol.g.map((x, i) => 'G' + (i + 1) + ' = ' + x[0] + '(' + x.slice(1).join(', ') + ')').concat((t.sol.f || []).map((d, i) => 'FF' + (i + 1) + '.D = ' + d), Object.keys(t.sol.o).map((o) => o + ' = ' + t.sol.o[o])).join(' · ')) + '</p><button type="button" class="btn small" id="czLoad">Load this solution</button></details>') +
      '<p><button type="button" class="btn small" id="czClear">Clear the board</button> ' + link(['circuit'], '← All circuit tasks', 'btn small') + '</p></article>';
    shell('labs', h, crumbs.concat([[t.title]]));
    let saveT = 0; const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { const u = st(); const r = u.circ[t.id] = u.circ[t.id] || {}; r.c = c; r.tries = Math.min(99999, (r.tries || 0) + 1); save(); }, 400); };
    const optList = (list, cur) => '<option value="">(not connected)</option>' + list.map((x) => '<option value="' + E(x) + '"' + (x === cur ? ' selected' : '') + '>' + E(x) + '</option>').join('');
    const drawParts = () => {
      $('#czParts').innerHTML = c.g.map((g, k) => { const src = srcsFor(t, c, k); return '<li><b>' + g.id + '</b> <label class="sr-only" for="czT' + k + '">Gate type</label><select id="czT' + k + '" data-g="' + k + '" data-k="t">' + allowed.map((x) => '<option' + (x === g.t ? ' selected' : '') + '>' + x + '</option>').join('') + '</select> <label class="sr-only" for="czA' + k + '">First input of ' + g.id + '</label><select id="czA' + k + '" data-g="' + k + '" data-k="0">' + optList(src, g.i[0]) + '</select>' + (GATES[g.t][0] === 2 ? ' <label class="sr-only" for="czB' + k + '">Second input of ' + g.id + '</label><select id="czB' + k + '" data-g="' + k + '" data-k="1">' + optList(src, g.i[1]) + '</select>' : '') + ' <button type="button" class="btn small" data-del="' + k + '" aria-label="Remove ' + g.id + '">✕</button></li>'; }).join('') +
        c.f.map((f, k) => '<li><b>' + f.id + '</b> D flip-flop · D = <label class="sr-only" for="czF' + k + '">D input of ' + f.id + '</label><select id="czF' + k + '" data-f="' + k + '">' + optList(srcsFor(t, c, -1), f.d) + '</select>' + (k === c.f.length - 1 ? ' <button type="button" class="btn small" data-delf="' + k + '" aria-label="Remove ' + f.id + '">✕</button>' : '') + '</li>').join('') || '<li class="u-fine">No parts yet. Add a gate with the buttons above.</li>';
      $('#czOuts').innerHTML = t.outs.map((o) => '<p><label for="czO' + E(o) + '"><b>' + E(o) + '</b> = </label><select id="czO' + E(o) + '" data-o="' + E(o) + '">' + optList(srcsFor(t, c, -1), c.o[o]) + '</select></p>').join('');
    };
    const drawLive = () => { $('#czBoard').innerHTML = diagram(t, c, live, ffv); };
    const drawCheck = () => {
      const g = grade(t, c);
      if (!t.free) $('#czChecks').innerHTML = g.checks.map((x) => '<li class="' + (x[1] ? 'ok' : '') + '"><span aria-hidden="true">' + (x[1] ? '✓' : '○') + '</span> ' + E(x[0]) + '</li>').join('');
      const cell = (x) => (x === undefined ? '?' : x);
      $('#czTable').innerHTML = '<table class="u-table"><thead><tr>' + (t.seq ? '<th scope="col">Tick</th>' : '') + t.ins.map((x) => '<th scope="col">' + E(x) + '</th>').join('') + t.outs.map((o) => '<th scope="col">' + E(o) + (t.free ? '' : ' (yours / needed)') + '</th>').join('') + '</tr></thead><tbody>' +
        g.rows.map((r, k) => '<tr class="' + (r.ok ? '' : 'bad') + '">' + (t.seq ? '<td>' + (k + 1) + '</td>' : '') + t.ins.map((x) => '<td>' + r.ins[x] + '</td>').join('') + t.outs.map((o) => '<td>' + cell(r.got[o]) + (r.exp ? ' / ' + r.exp[o] : '') + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      if (g.pass && usedSol && !(circRec(t.id).pass)) { $('#czState').textContent = 'The loaded solution works. It does not count: clear the board and build it yourself to pass.'; return; }
      if (g.pass) { const u = st(); const r = u.circ[t.id] = u.circ[t.id] || {}; r.c = c; if (!r.pass) { r.pass = true; r.at = today(); U.markStudy(); A.addXp(10); save(); A.toast('✅ Circuit works: ' + t.title); } $('#czState').textContent = 'Passed ✓ on ' + r.at + '.'; }
    };
    const all = () => { drawParts(); drawLive(); drawCheck(); };
    const changed = () => { ffv = c.f.map((_, i) => ffv[i] || 0); all(); persist(); };
    $$('[data-add]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.add === 'FF') { if (c.f.length >= t.ffs) return A.toast('This task allows ' + t.ffs + ' flip-flop' + (t.ffs === 1 ? '' : 's') + '.'); c.f.push({ id: 'FF' + (c.f.length + 1), d: '' }); }
      else { if (c.g.length >= 40) return A.toast('That is the limit of 40 gates.'); c.g.push({ id: 'G' + c.n++, t: b.dataset.add, i: ['', ''] }); }
      changed(); }));
    $('#czParts').addEventListener('change', (e) => { const s = e.target; if (s.dataset.f !== undefined) c.f[+s.dataset.f].d = s.value; else if (s.dataset.g !== undefined) { const g = c.g[+s.dataset.g]; if (s.dataset.k === 't') { g.t = s.value; if (GATES[g.t][0] === 1) g.i[1] = ''; } else g.i[+s.dataset.k] = s.value; } changed(); });
    $('#czParts').addEventListener('click', (e) => { const d = e.target.closest('[data-del],[data-delf]'); if (!d) return; if (d.dataset.del !== undefined) c.g.splice(+d.dataset.del, 1); else c.f.pop(); changed(); });
    $('#czOuts').addEventListener('change', (e) => { c.o[e.target.dataset.o] = e.target.value; changed(); });
    const flip = (el) => { const k = el.dataset.in; live[k] = 1 - live[k]; drawLive(); const n = $('#czBoard [data-in="' + k + '"]'); if (n) n.focus(); };
    $('#czBoard').addEventListener('click', (e) => { const n = e.target.closest('[data-in]'); if (n) flip(n); });
    $('#czBoard').addEventListener('keydown', (e) => { const n = e.target.closest('[data-in]'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); flip(n); } });
    if (t.ffs) { $('#czTick').addEventListener('click', () => { const v = evalC(c, live, ffv); ffv = c.f.map((f) => (v[f.d] === 1 ? 1 : 0)); drawLive(); }); $('#czRst').addEventListener('click', () => { ffv = c.f.map(() => 0); drawLive(); }); }
    const ld = $('#czLoad'); if (ld) ld.addEventListener('click', () => { c = fromSol(t); usedSol = true; changed(); A.toast('Solution loaded. Read it, then try to rebuild it yourself.'); });
    $('#czClear').addEventListener('click', () => { c = blank(t); ffv = []; usedSol = false; changed(); });
    all();
  };

  /* ================= 2. Ethical hacking range ================= */
  /* ---------- a tiny SQL engine for the injection targets (SELECT … FROM … WHERE … UNION SELECT …) ---------- */
  const SQL = (function () {
    const KW = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'UNION', 'ALL', 'LIKE', 'NULL', 'LIMIT'];
    function lex(q) {
      const T = []; let i = 0;
      while (i < q.length) {
        const ch = q[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === '-' && q[i + 1] === '-') { while (i < q.length && q[i] !== '\n') i++; continue; }
        if (ch === '/' && q[i + 1] === '*') { const e = q.indexOf('*/', i + 2); i = e < 0 ? q.length : e + 2; continue; }
        if (ch === "'") { let s = '', j = i + 1; for (;;) { if (j >= q.length) throw new Error('unrecognized token: "' + q.slice(i, i + 30) + '"'); if (q[j] === "'") { if (q[j + 1] === "'") { s += "'"; j += 2; continue; } break; } s += q[j++]; } T.push({ k: 'str', v: s }); i = j + 1; continue; }
        if (/[0-9]/.test(ch)) { let j = i; while (j < q.length && /[0-9.]/.test(q[j])) j++; T.push({ k: 'num', v: +q.slice(i, j) }); i = j; continue; }
        if (/[A-Za-z_]/.test(ch)) { let j = i; while (j < q.length && /[A-Za-z0-9_]/.test(q[j])) j++; const w = q.slice(i, j); T.push(KW.includes(w.toUpperCase()) ? { k: 'kw', v: w.toUpperCase() } : { k: 'id', v: w.toLowerCase() }); i = j; continue; }
        const two = q.slice(i, i + 2); if (['<>', '!=', '<=', '>=', '||'].includes(two)) { T.push({ k: 'op', v: two }); i += 2; continue; }
        if ('=<>(),*;%'.includes(ch)) { T.push({ k: 'op', v: ch }); i++; continue; }
        throw new Error('unrecognized token: "' + ch + '"');
      }
      return T;
    }
    function run(q, db) {
      const T = lex(q); let p = 0;
      const peek = () => T[p], next = () => T[p++];
      const near = () => { const t = T[p]; return new Error(t ? 'near "' + (t.k === 'str' ? "'" + t.v + "'" : t.v) + '": syntax error' : 'incomplete input'); };
      const isKw = (w) => T[p] && T[p].k === 'kw' && T[p].v === w, isOp = (o) => T[p] && T[p].k === 'op' && T[p].v === o;
      const expect = (w) => { if (isKw(w) || isOp(w)) return next(); throw near(); };
      function primary() {
        const t = next(); if (!t) throw new Error('incomplete input');
        if (t.k === 'num' || t.k === 'str') return { lit: t.v };
        if (t.k === 'kw' && t.v === 'NULL') return { lit: null };
        if (t.k === 'id') return { col: t.v };
        if (t.k === 'op' && t.v === '(') { const e = orE(); expect(')'); return e; }
        p--; throw near();
      }
      function concat() { let a = primary(); while (isOp('||')) { next(); a = { op: '||', a, b: primary() }; } return a; }
      function cmp() { const a = concat(); if (T[p] && T[p].k === 'op' && ['=', '<>', '!=', '<', '>', '<=', '>='].includes(T[p].v)) { const op = next().v; return { op, a, b: concat() }; } if (isKw('LIKE')) { next(); return { op: 'LIKE', a, b: concat() }; } if (isKw('NOT') && T[p + 1] && T[p + 1].v === 'LIKE') { p += 2; return { op: 'NOT', a: { op: 'LIKE', a, b: concat() } }; } return a; }
      function notE() { if (isKw('NOT')) { next(); return { op: 'NOT', a: notE() }; } return cmp(); }
      function andE() { let a = notE(); while (isKw('AND')) { next(); a = { op: 'AND', a, b: notE() }; } return a; }
      function orE() { let a = andE(); while (isKw('OR')) { next(); a = { op: 'OR', a, b: andE() }; } return a; }
      function select() {
        expect('SELECT'); const cols = []; if (isOp('*')) { next(); cols.push('*'); } else { cols.push(orE()); while (isOp(',')) { next(); cols.push(orE()); } }
        let table = null, where = null, limit = null; if (isKw('FROM')) { next(); const t = next(); if (!t || t.k !== 'id') { p--; throw near(); } table = t.v; if (!db[table]) throw new Error('no such table: ' + table); }
        if (isKw('WHERE')) { next(); where = orE(); }
        if (isKw('LIMIT')) { next(); const t = next(); if (!t || t.k !== 'num') { p--; throw near(); } limit = t.v; }
        return { cols, table, where, limit };
      }
      const parts = [select()]; while (isKw('UNION')) { next(); if (isKw('ALL')) next(); parts.push(select()); }
      if (isOp(';')) next(); if (p < T.length) throw near();
      const num = (x) => (typeof x === 'number' ? x : x === null ? null : /^\s*-?\d+(\.\d+)?/.test(String(x)) ? parseFloat(x) : 0);
      const truthy = (x) => x !== null && num(x) !== 0;
      function ev(e, row, table) {
        if ('lit' in e) return e.lit;
        if (e.col) { if (!table || !db[table].cols.includes(e.col)) throw new Error('no such column: ' + e.col); return row[e.col]; }
        if (e.op === 'NOT') { const v = ev(e.a, row, table); return v === null ? null : truthy(v) ? 0 : 1; }
        if (e.op === 'AND') return truthy(ev(e.a, row, table)) && truthy(ev(e.b, row, table)) ? 1 : 0;
        if (e.op === 'OR') return truthy(ev(e.a, row, table)) || truthy(ev(e.b, row, table)) ? 1 : 0;
        const a = ev(e.a, row, table), b = ev(e.b, row, table);
        if (e.op === '||') return a === null || b === null ? null : String(a) + String(b);
        if (a === null || b === null) return null;
        if (e.op === 'LIKE') { const re = new RegExp('^' + String(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'is'); return re.test(String(a)) ? 1 : 0; }
        const both = typeof a === 'number' || typeof b === 'number'; const x = both ? num(a) : String(a), y = both ? num(b) : String(b);
        return ({ '=': x === y, '<>': x !== y, '!=': x !== y, '<': x < y, '>': x > y, '<=': x <= y, '>=': x >= y })[e.op] ? 1 : 0;
      }
      let width = null, out = [];
      for (const s of parts) {
        const tb = s.table ? db[s.table] : null; const src = tb ? tb.rows : [{}];
        const cols = s.cols[0] === '*' ? (tb ? tb.cols.map((c) => ({ col: c })) : (() => { throw new Error('no tables specified'); })()) : s.cols;
        if (width !== null && cols.length !== width) throw new Error('SELECTs to the left and right of UNION do not have the same number of result columns');
        width = cols.length; let rows = src.filter((r) => !s.where || truthy(ev(s.where, r, s.table))).map((r) => cols.map((c) => ev(c, r, s.table)));
        if (s.limit !== null) rows = rows.slice(0, s.limit); out = out.concat(rows);
      }
      return out;
    }
    return { run, lex };
  })();
  S.SQL = SQL;
  /* ---------- shared pieces: a fake browser, a fake terminal, a flag box ---------- */
  const STATUS = { 200: 'OK', 301: 'Moved Permanently', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' };
  const normPath = (p) => { p = String(p || '/').trim(); p = p.replace(/^https?:\/\/[^/]*/i, ''); p = p.split(/[?#]/)[0]; if (!p.startsWith('/')) p = '/' + p; try { p = decodeURIComponent(p); } catch (e) {} return p.replace(/\/{2,}/g, '/'); };
  function browser(host, hostname, route) {
    host.innerHTML = '<div class="hr-browser"><form class="hr-url"><span class="hr-proto">http://' + E(hostname) + '</span><label class="sr-only" for="hrUrl">Path</label><input id="hrUrl" value="/" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" enterkeyhint="go"><button type="submit" class="btn small primary">Go</button></form><p class="hr-status" id="hrSt" aria-live="polite"></p><div class="hr-page" id="hrPage"></div></div>';
    const go = (p) => { p = normPath(p); $('#hrUrl').value = p; let r = route(p); if (!r) r = { status: 404, html: '<h1>404 Not Found</h1><p>There is no page at <code>' + E(p) + '</code>.</p>' }; if (r.redirect) return go(r.redirect); $('#hrSt').textContent = 'HTTP ' + r.status + ' ' + (STATUS[r.status] || ''); $('#hrPage').innerHTML = r.text !== undefined ? '<pre>' + E(r.text) + '</pre>' : r.html; };
    host.querySelector('.hr-url').addEventListener('submit', (e) => { e.preventDefault(); go($('#hrUrl').value); });
    host.addEventListener('click', (e) => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(a.dataset.go); } });
    go('/'); return { go };
  }
  const GL = (p, t) => '<a href="#" data-go="' + E(p) + '">' + E(t || p) + '</a>';
  function konsole(host, intro, exec, prompt) {
    host.innerHTML = '<div class="tsim"><div class="tsim-out" id="hrOut" role="log" aria-label="Terminal output" tabindex="0"></div><form id="hrForm" class="tsim-in" autocomplete="off"><label for="hrIn" class="tsim-prompt" id="hrPr"></label><input id="hrIn" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Command"><button type="submit" class="btn small primary">Run</button></form></div>';
    const out = $('#hrOut'); const print = (lines, cls) => { lines.forEach((l) => { const d = document.createElement('div'); d.className = cls || ''; d.textContent = l === '' ? ' ' : l; out.appendChild(d); }); while (out.childNodes.length > 600) out.removeChild(out.firstChild); out.scrollTop = out.scrollHeight; };
    const pr = () => { $('#hrPr').textContent = prompt(); };
    print(intro); pr();
    $('#hrForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#hrIn').value; $('#hrIn').value = ''; print([prompt() + ' ' + v], 'cmd'); const r = exec(v.trim()); if (r === 'clear') out.innerHTML = ''; else print(r.out || r, r.err ? 'err' : ''); pr(); $('#hrIn').focus(); });
  }
  const b64e = (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch (e) { return ''; } };
  const b64d = (s) => { try { return decodeURIComponent(escape(atob(String(s).trim()))); } catch (e) { return null; } };
  async function sha256(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); }

  /* ---------- the challenges (every target below is fictional and exists only in this file) ---------- */
  const SCOPE_DOC = '**Client:** Northwind Bakery (a fictional company). **Written authorisation:** signed by the owner, valid this week.\n\n- **In scope:** the network `10.10.0.0/24` and the websites `shop.northwind.test` and `portal.northwind.test`.\n- **Out of scope:** `10.10.0.1` (the internet router, owned by their internet provider) and `pay.northwind.test` (run by a separate payment company).\n- **Not allowed at all:** denial of service (overloading systems), social engineering of staff, and copying customer data.\n- **Testing window:** Monday to Friday, 09:00 to 17:00.';
  const SCOPE_Q = [
    ['Scanning 10.10.0.20 for open ports on Tuesday at 10:00', 1, 'It is inside 10.10.0.0/24 and inside the testing window.'],
    ['Scanning 10.10.0.1, the router, because it might be the weakest point', 0, 'It is explicitly out of scope: it belongs to the internet provider, who has not given permission.'],
    ['Trying SQL injection on pay.northwind.test, since customers pay there', 0, 'Only the company that runs a system can authorise testing it. The bakery cannot give permission for someone else\'s service.'],
    ['Testing the login page of shop.northwind.test on Wednesday at 14:00', 1, 'In scope and inside the window.'],
    ['Scanning 10.10.0.30 on Saturday morning, when the network is quiet', 0, 'Outside the agreed testing window. Times are part of the permission.'],
    ['Phoning a member of staff and pretending to be IT support to get a password', 0, 'Social engineering is not allowed in this engagement.'],
    ['Sending thousands of requests a second to see whether the shop crashes', 0, 'That is a denial-of-service test, which is forbidden here and can cause real damage.'],
    ['Testing northwind-bakery.example, a site that looks similar, in case it is theirs', 0, 'It is not listed. If you think it belongs to the client, ask them first and get it added in writing.'],
    ['You find a file of customer orders: downloading all of it to prove the impact', 0, 'Stop at the minimum: note that it is exposed and how you reached it, do not copy the data, and tell the client straight away.'],
    ['Practising on a virtual machine you installed on your own laptop, at any time', 1, 'You own it, so you can authorise yourself. This is how most people practise.'],
  ];
  const DB_LOGIN = { users: { cols: ['id', 'name', 'pass', 'role'], rows: [{ id: 1, name: 'admin', pass: 'Qv8!rT2#mZx9pL', role: 'admin' }, { id: 2, name: 'sam', pass: 'S4mBakes!2026', role: 'staff' }, { id: 3, name: 'priya', pass: 'Cr0issant&Co', role: 'staff' }] } };
  const DB_SHOP = {
    products: { cols: ['name', 'price', 'stock'], rows: [['Sourdough loaf', 4.5, 12], ['Croissant', 2.2, 40], ['Rye bread', 3.9, 8], ['Cinnamon bun', 2.8, 25], ['Baguette', 2.5, 30], ['Birthday cake', 24, 2]].map((r) => ({ name: r[0], price: r[1], stock: r[2] })) },
    users: { cols: ['id', 'name', 'role', 'api_key'], rows: [{ id: 1, name: 'admin', role: 'admin', api_key: 'FLAG{union-select-leaks-data}' }, { id: 2, name: 'sam', role: 'staff', api_key: 'sk_test_51sam' }] },
    sqlite_master: { cols: ['type', 'name', 'sql'], rows: [{ type: 'table', name: 'products', sql: 'CREATE TABLE products (name TEXT, price REAL, stock INTEGER)' }, { type: 'table', name: 'users', sql: 'CREATE TABLE users (id INTEGER, name TEXT, role TEXT, api_key TEXT)' }] },
  };
  const NET = { '10.10.0.5': [[22, 'ssh', 'OpenSSH 9.6'], [80, 'http', 'nginx 1.24 (Northwind shop)'], [443, 'https', 'nginx 1.24']], '10.10.0.7': [[21, 'ftp', 'vsftpd 2.3 (anonymous login allowed)'], [22, 'ssh', 'OpenSSH 7.4']], '10.10.0.9': [[80, 'http', 'printer web panel'], [9100, 'jetdirect', 'raw printing']], '10.10.0.12': [[5432, 'postgresql', 'PostgreSQL 16 (password required)']] };
  const INV_NAMES = ['Ada Brooks', 'Leo Martin', 'Mia Chen', 'Omar Haddad', 'Zoe Patel', 'Noah Kim', 'Ella Novak', 'Ravi Shah'];
  const invoice = (id) => { if (id === 5001) return { id, customer: 'Northwind head office', total: 0, items: ['Internal test invoice'], note: 'FLAG{check-the-owner-on-the-server}' }; if (id < 5001 || id > 5040) return null; if (id === 5031 || id === 5034) return { id, customer: 'Sam Lee', customer_id: 1042, total: id === 5031 ? 18.4 : 7.5, items: id === 5031 ? ['2 × Sourdough loaf', '4 × Croissant'] : ['3 × Baguette'] }; return { id, customer: INV_NAMES[id % 8], customer_id: 1000 + (id % 37), total: +(((id * 37) % 600) / 10 + 3).toFixed(2), items: [(1 + id % 4) + ' × ' + DB_SHOP.products.rows[id % 6].name] }; };
  const FS_ROUTER = { '/var/www/html/index.php': '<?php include "ping.php"; ?>\n', '/var/www/html/ping.php': '<?php\n$host = $_POST["host"];\necho shell_exec("ping -c 1 " . $host);\n?>\n', '/var/www/flag.txt': 'FLAG{never-pass-input-to-a-shell}\n', '/etc/hostname': 'router-lab\n', '/etc/passwd': 'root:x:0:0:root:/root:/bin/sh\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nadmin:x:1000:1000:Router admin:/home/admin:/bin/sh\n' };

  const RC = [
    { id: 'scope', lvl: 'Start here', title: 'Rules of engagement', sum: 'Decide what you are and are not allowed to do',
      brief: 'Before any test, a professional gets **written permission** that says exactly what may be tested, how and when. Testing anything outside it is not "ethical hacking": in Canada, the United States, the United Kingdom and most other countries it is a crime, even if you mean well. Read the scope below, then decide for each action whether it is allowed. Every other challenge unlocks when you get them all right.',
      hints: ['Check three things every time: is the target listed, is the method allowed, is it inside the time window?', 'If something is not written down, the answer is "not allowed" until the client adds it in writing.'], walk: [], fix: '' },
    { id: 'recon', lvl: 'Reconnaissance', title: 'What robots.txt gives away', sum: 'Find a page the owners hoped nobody would see', flag: 'FLAG{robots-txt-is-public}',
      brief: 'Your target is the bakery\'s shop website. Websites often publish a file called `robots.txt` telling search engines which pages not to list. It is a request to well-behaved robots, not a lock, and anyone can read it. Explore the site with the address bar and find the flag.',
      hints: ['Type `/robots.txt` into the address bar.', 'Visit the folder it asks search engines to stay away from.', 'Open the files listed in that folder.'], walk: ['Go to /robots.txt.', 'It disallows /staff-notes/. Go there: the server shows a directory listing.', 'Open /staff-notes/todo.txt. The flag is at the bottom.'],
      fix: 'Never rely on `robots.txt` or an unlinked URL to hide anything: it is public, and listing a folder there points attackers straight to it. Private files should not be on the public web server at all, or should require a login. Turn off **directory listings** so that a folder address does not show its contents.' },
    { id: 'scan', lvl: 'Reconnaissance', title: 'Scan the network', sum: 'Find an open service and what it leaks', flag: 'FLAG{anonymous-ftp-left-open}',
      brief: 'You are connected to the bakery\'s office network. Use the `scan` tool to discover which computers are switched on and which **services** (programs listening on network ports) they run. The tool refuses anything outside your scope, just as you must. One service is set up badly. Find it, connect to it and read the flag.',
      hints: ['Start with `scope`, then `scan 10.10.0.0/24` to sweep the whole range.', 'Scan a single address, such as `scan 10.10.0.7`, to see the service versions.', 'FTP servers sometimes allow anyone to log in with the user name `anonymous`. Try `ftp 10.10.0.7`.'], walk: ['scan 10.10.0.0/24 lists four live hosts and skips the router.', 'scan 10.10.0.7 shows FTP with anonymous login allowed.', 'ftp 10.10.0.7, then the name anonymous, then ls and get backup-notes.txt.'],
      fix: 'Every open service is a door. Turn off what is not needed, keep software up to date (this FTP server is a version from 2011), and never allow **anonymous login** on a server that holds anything private. Prefer encrypted protocols such as SFTP to plain FTP, which sends passwords unencrypted. Defenders run the same scans on their own networks to find these doors first.' },
    { id: 'hash', lvl: 'Passwords', title: 'Crack a leaked password table', sum: 'See why unsalted, fast hashes fail', flag: 'bakery2024', label: 'The admin account\'s password',
      brief: 'An old backup of the shop\'s user table was left public. The passwords are not stored directly: each one was put through **SHA-256**, a hash function, which cannot be reversed. But you can hash guesses and compare. That is a **dictionary attack**. Use the tools to recover the admin account\'s password and enter it below. (Notice anything about sam and alex?)',
      hints: ['Hash a guess to see what its SHA-256 looks like. Compare it with the table.', 'Run the whole wordlist: it hashes every word and compares each result with every account.'], walk: ['Press "Run the wordlist".', 'Three accounts match words in the list; sam and alex have the same hash, so they have the same password.', 'The admin\'s password is bakery2024.'],
      fix: 'Store passwords with a slow, **salted** password-hashing function made for the job: **Argon2id**, **scrypt** or **bcrypt**. A salt is a random value stored next to each hash, so equal passwords get different hashes and precomputed tables are useless. "Slow" means each guess costs milliseconds instead of nanoseconds, so a wordlist of billions takes years instead of minutes. On the user side, long unique passphrases and a password manager defeat dictionaries, and multi-factor authentication helps even when a password leaks.' },
    { id: 'sqli', lvl: 'Web', title: 'SQL injection: log in without a password', sum: 'Make the login query say something it should not', flag: 'FLAG{or-1-equals-1}',
      brief: 'The staff portal builds its database query by pasting what you type straight into SQL. For teaching, the page shows you the query the server builds (in a real test you would not see it). Sign in as **admin** without knowing the password.',
      hints: ['Type a single quote `\'` as the user name and look at the error: your input broke the query.', 'In SQL, `--` starts a comment, and the rest of the line is ignored.', 'A user name of `admin\' --` closes the string and comments out the password check.'], walk: ['User name: admin\' --   Password: anything.', 'The query becomes … WHERE name = \'admin\' --\' AND pass = …, so the password check is a comment.', 'Another classic: \' OR 1=1 -- , which matches every row, and the first row is admin.'],
      fix: 'Never build SQL by pasting text together. Use **parameterised queries** (prepared statements), where the query and the data travel separately and the database never treats data as code:\n\n```js\n// vulnerable\ndb.query("SELECT * FROM users WHERE name = \'" + name + "\' AND pass = \'" + pass + "\'");\n// safe: placeholders\ndb.query("SELECT * FROM users WHERE name = ? AND pass_hash = ?", [name, hash]);\n```\n\nAlso: store password hashes, not passwords; give the web application a database account with only the rights it needs; and do not show raw database errors to visitors.' },
    { id: 'union', lvl: 'Web', title: 'SQL injection: read another table', sum: 'Use UNION SELECT to pull out secret data', flag: 'FLAG{union-select-leaks-data}',
      brief: 'The shop\'s product search is also injectable, and it shows its results on the page. `UNION SELECT` joins the results of a second query onto the first, so you can make the page display data from any table. Find the admin\'s API key in the `users` table. The two queries must return the same number of columns.',
      hints: ['Search for `\'` to confirm the injection. Then try `\' UNION SELECT 1, 2 --`: two columns works, one or three does not.', 'SQLite lists its tables in `sqlite_master`. Try `\' UNION SELECT name, sql FROM sqlite_master --`.', 'Now you know the columns of `users`. Select two of them.'], walk: ['\' UNION SELECT 1, 2 -- shows a row 1 | 2 under the products, so the query has two columns.', '\' UNION SELECT name, sql FROM sqlite_master -- shows the users table has id, name, role and api_key.', '\' UNION SELECT name, api_key FROM users -- shows the admin\'s key, which is the flag.'],
      fix: 'The fix is the same as for the login: **parameterised queries**, which make injection impossible however the query is used. Defence in depth helps when a mistake slips through: the database account behind a public search page should only be able to read the products table, and secrets such as API keys should be stored hashed or encrypted, or kept out of the application database.' },
    { id: 'xss', lvl: 'Web', title: 'Cross-site scripting in a guestbook', sum: 'Make the page run your JavaScript', flag: 'FLAG{escape-output-every-time}', auto: true,
      brief: 'The bakery\'s guestbook shows every message exactly as it was typed, HTML and all. If a message can contain HTML, it can contain JavaScript, which would then run in every visitor\'s browser. Testers prove this with a harmless function call. The guestbook page has a function called `proof()`: post a message that makes the page run it. The guestbook runs in a sealed-off frame, so your code cannot affect Learn or anything else.',
      hints: ['Try a message with `<b>bold</b>` in it. Does it show the tags, or bold text?', '`<script>proof()</script>` is the obvious attempt.', 'Another common payload: an image that fails to load, with an error handler: `<img src=x onerror="proof()">`.'], walk: ['Post the message <script>proof()</script> or <img src=x onerror="proof()">.', 'The page puts it into the HTML unchanged, so the browser runs it.', 'The flag appears, and you can switch the guestbook to the fixed version to see the same message shown safely as text.'],
      fix: 'Treat everything a user sends as text, not HTML. **Escape output** for the place it goes: in HTML, `<` becomes `&lt;` and so on. Templating systems (React, Vue, Django, Jinja) escape by default; the danger is in the escape hatches, such as `innerHTML` or `dangerouslySetInnerHTML`. In JavaScript, use `textContent` instead of `innerHTML`. Add a **Content-Security-Policy** header that blocks inline scripts, and mark session cookies **HttpOnly** so that scripts cannot read them even if XSS gets through.' },
    { id: 'idor', lvl: 'Web', title: 'Broken access control', sum: 'Read someone else\'s invoice through the API', flag: 'FLAG{check-the-owner-on-the-server}',
      brief: 'You are signed in to the shop as the customer **Sam Lee**. The app gets your invoices from an API: `/api/invoices/5031` is one of yours. The question every tester asks: does the server check that the invoice belongs to the person asking, or does it trust the number? (This bug is called an **IDOR**, an insecure direct object reference.) Find the head office\'s invoice.',
      hints: ['Send `/api/me` and `/api/invoices` to see what the API tells you about yourself.', 'Change the number in `/api/invoices/5031`. Do you get an error, or another customer\'s invoice?', 'Invoice numbers count up. Where would the first one of the year be?'], walk: ['GET /api/invoices/5030 returns another customer\'s invoice: the server does not check ownership.', 'GET /api/invoices/5001, the first invoice, belongs to the head office and contains the flag.'],
      fix: 'Check permission **on the server, for every request**: "is the signed-in user allowed to see this invoice?" The browser and the URL are under the user\'s control, so hiding a button or using hard-to-guess numbers is not access control (random IDs help, but they are not a substitute for the check). Deny by default, put the check in one shared place rather than in every handler, and write tests that sign in as user A and try to read user B\'s data.' },
    { id: 'cookie', lvl: 'Web', title: 'Tamper with a session cookie', sum: 'Promote yourself to admin', flag: 'FLAG{sign-your-session-cookies}',
      brief: 'The staff portal remembers who you are with a cookie. You are signed in as **sam**, a student intern. The `/admin` page is for admins only. Look at the cookie: it is not encrypted or signed, only encoded. Decode it, change it and see whether the server notices.',
      hints: ['Copy the cookie value into the Base64 tool and decode it.', 'It is JSON. Change the role, encode it again and save the new cookie.', 'Then visit `/admin`.'], walk: ['The cookie decodes to {"user":"sam","role":"student"}.', 'Encode {"user":"sam","role":"admin"} and save it as the cookie.', 'Go to /admin: the server trusts the cookie and shows the flag.'],
      fix: 'Never trust data the browser can edit. Either keep the session on the server and give the browser only a long random **session ID**, or **sign** the cookie with a secret key (an HMAC) so that any change is detected; JSON Web Tokens do this, but only if the server checks the signature and rejects the `none` algorithm. Decide roles on the server from your own records, never from what the client sends. Mark session cookies `HttpOnly`, `Secure` and `SameSite`.' },
    { id: 'cmdi', lvl: 'Web', title: 'Command injection on a router', sum: 'Turn a ping tool into a remote shell', flag: 'FLAG{never-pass-input-to-a-shell}',
      brief: 'The office router has a web page that pings a host for you, to test the connection. Behind the scenes it runs the shell command `ping -c 1 <your input>`. In a shell, characters such as `;`, `&&` and `|` start another command. Use that to read the file `/var/www/flag.txt` on the router.',
      hints: ['Ping `10.10.0.5` first to see normal output.', 'Try `10.10.0.5; whoami`: if a user name appears, the input reaches a shell.', 'Then `10.10.0.5; ls /var/www` and `10.10.0.5; cat /var/www/flag.txt`.'], walk: ['10.10.0.5; whoami prints www-data, so commands run on the router.', '10.10.0.5; cat /var/www/flag.txt prints the flag.', 'cat /var/www/html/ping.php shows the bug: the input is glued onto a shell command.'],
      fix: 'Do not pass user input to a shell. Call the program directly with an argument list, so that no shell ever interprets `;` or `|` (for example `execFile("ping", ["-c", "1", host])` in Node or `subprocess.run(["ping", "-c", "1", host])` in Python, without `shell=True`). **Validate** the input against what it should be, here a hostname or IP address, and reject everything else. Run the web service as a user with as few rights as possible, so a mistake exposes less.' },
  ];
  S.RC = RC;
  /* ---------- the fake targets ---------- */
  const SHOP_PAGES = {
    '/': '<h1>🥐 Northwind Bakery</h1><p>Fresh bread every morning since 1998.</p><ul><li>' + GL('/menu', 'Menu') + '</li><li>' + GL('/contact', 'Contact') + '</li><li>' + GL('/cart/', 'Your cart') + '</li></ul>',
    '/menu': '<h1>Menu</h1><ul>' + DB_SHOP.products.rows.map((p) => '<li>' + E(p.name) + ' · $' + p.price.toFixed(2) + '</li>').join('') + '</ul><p>' + GL('/', '← Home') + '</p>',
    '/contact': '<h1>Contact</h1><p>12 Harbour Street. Open 7:00 to 18:00.</p><p>' + GL('/', '← Home') + '</p>',
    '/cart/': '<h1>Your cart</h1><p>Your cart is empty.</p>',
    '/staff-notes/': '<h1>Index of /staff-notes/</h1><pre>' + GL('/staff-notes/rota.txt', 'rota.txt') + '        2 KB\n' + GL('/staff-notes/todo.txt', 'todo.txt') + '        1 KB</pre>',
  };
  const SHOP_TEXT = { '/robots.txt': 'User-agent: *\nDisallow: /cart/\nDisallow: /staff-notes/\n\nSitemap: http://shop.northwind.test/sitemap.xml\n', '/sitemap.xml': '<?xml version="1.0"?>\n<urlset>\n  <url><loc>http://shop.northwind.test/</loc></url>\n  <url><loc>http://shop.northwind.test/menu</loc></url>\n  <url><loc>http://shop.northwind.test/contact</loc></url>\n</urlset>\n', '/staff-notes/rota.txt': 'Mon  Ana, Ben\nTue  Ben, Chloe\nWed  Ana, Dev\n', '/staff-notes/todo.txt': '- fix oven 3\n- order more flour\n- MOVE THESE NOTES OFF THE WEB SERVER before the audit!\n\nFLAG{robots-txt-is-public}\n' };
  const MOUNT = {};
  MOUNT.recon = (h) => browser(h, 'shop.northwind.test', (p) => { if (p === '/staff-notes' || p === '/cart') return { redirect: p + '/' }; if (SHOP_TEXT[p] !== undefined) return { status: 200, text: SHOP_TEXT[p] }; if (SHOP_PAGES[p]) return { status: 200, html: SHOP_PAGES[p] }; return null; });
  const ipOk = (s) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s) && s.split('.').every((x) => +x <= 255);
  const REFUSE = (t) => ({ out: ['Refused: ' + t + ' is not in your scope (10.10.0.0/24, except 10.10.0.1).', 'Scanning computers without the owner\'s permission is illegal in many countries.'], err: true });
  MOUNT.scan = (h) => {
    let mode = 'sh';
    konsole(h, ['Lab network terminal. You are 10.10.0.50. Type help for the commands.', ''], (line) => {
      if (mode === 'name') { if (/^(anonymous|ftp)$/i.test(line)) { mode = 'ftp'; return ['331 Please specify the password.', '230 Login successful. (No password was needed.)', 'Commands here: ls, get <file>, bye']; } mode = 'sh'; return { out: ['530 Login incorrect.'], err: true }; }
      const a = line.split(/\s+/).filter(Boolean); const c = (a[0] || '').toLowerCase();
      if (mode === 'ftp') {
        if (c === 'ls' || c === 'dir') return a[1] === 'pub' ? ['menu-2026.pdf'] : ['drwxr-xr-x  pub', '-rw-r--r--  backup-notes.txt'];
        if (c === 'get' || c === 'cat' || c === 'more') { const f = (a[1] || '').replace(/^\.\//, ''); if (f === 'backup-notes.txt') return ['226 Transfer complete. Contents:', 'Nightly backups of the shop are copied here.', 'TODO: switch off anonymous access before the audit!', 'FLAG{anonymous-ftp-left-open}']; if (/menu-2026\.pdf$/.test(f)) return ['226 Transfer complete (a PDF of the menu, not shown).']; return { out: ['550 Failed to open file.'], err: true }; }
        if (['bye', 'quit', 'exit'].includes(c)) { mode = 'sh'; return ['221 Goodbye.']; }
        if (!c) return []; return { out: ['500 Unknown command. Try ls, get <file> or bye.'], err: true };
      }
      if (!c) return [];
      if (c === 'help') return ['scope              show what you are allowed to test', 'scan <ip>          list the open ports and services on one computer', 'scan 10.10.0.0/24  find which computers in the range are switched on', 'ftp <ip>           connect to an FTP file server', 'clear              clear the screen'];
      if (c === 'clear') return 'clear';
      if (c === 'scope') return ['In scope: 10.10.0.0/24. Out of scope: 10.10.0.1 (the internet provider\'s router).', 'Window: Monday to Friday, 09:00 to 17:00. No denial of service.'];
      if (c === 'nmap' || c === 'ping') return ['This range uses its own simplified tool: type scan. Real tools such as nmap work in a similar way.', 'Only ever use them on networks you are allowed to test.'];
      if (c === 'scan') {
        const t = a[1] || ''; if (!t) return { out: ['Usage: scan <ip> or scan 10.10.0.0/24'], err: true };
        if (t === '10.10.0.0/24') return ['Scanning 254 addresses in 10.10.0.0/24 …', 'skipped 10.10.0.1 (out of scope)'].concat(Object.keys(NET).map((ip) => ip.padEnd(13) + 'up    open ports: ' + NET[ip].map((x) => x[0]).join(', ')), ['10.10.0.50   up    (this is you)', 'Done: 5 hosts up.']);
        if (/\//.test(t)) return REFUSE(t);
        if (!ipOk(t)) return { out: ['scan: "' + t + '" is not an IP address.'], err: true };
        if (!t.startsWith('10.10.0.') || t === '10.10.0.1' || t === '10.10.0.0' || t === '10.10.0.255') return REFUSE(t);
        if (t === '10.10.0.50') return ['That is your own machine.'];
        if (!NET[t]) return [t + ': no response (the computer is off, or a firewall drops the probes).'];
        return ['Ports on ' + t + ':', 'PORT   STATE  SERVICE     VERSION'].concat(NET[t].map((x) => String(x[0]).padEnd(7) + 'open   ' + x[1].padEnd(12) + x[2]));
      }
      if (c === 'ftp') { const t = a[1] || ''; if (!ipOk(t)) return { out: ['Usage: ftp <ip>'], err: true }; if (!t.startsWith('10.10.0.') || t === '10.10.0.1') return REFUSE(t); if (t !== '10.10.0.7') return { out: ['ftp: connect to ' + t + ' port 21: Connection refused'], err: true }; mode = 'name'; return ['Connected to 10.10.0.7.', '220 (vsFTPd 2.3)', 'Name:']; }
      return { out: [c + ': command not found. Type help.'], err: true };
    }, () => (mode === 'sh' ? 'tester@lab:~$' : mode === 'name' ? 'Name:' : 'ftp>'));
  };
  const LEAK = [['admin', 'bakery2024'], ['sam', 'sunshine'], ['priya', 'T7#qv!2mLp9z-oven'], ['alex', 'sunshine'], ['jordan', 'letmein']];
  const WORDS = ['123456', 'password', '12345678', 'qwerty', '111111', 'iloveyou', 'abc123', 'letmein', 'monkey', 'dragon', 'football', 'baseball', 'welcome', 'sunshine', 'princess', 'master', 'shadow', 'admin', 'login', 'passw0rd', 'trustno1', 'superman', 'hello123', 'freedom', 'whatever', 'bread', 'northwind', 'bakery', 'bakery2024', 'croissant'];
  MOUNT.hash = async (h) => {
    if (!(window.crypto && crypto.subtle)) { h.innerHTML = '<p>This browser cannot compute SHA-256 here (it needs a secure https page). Open Learn from its https address to try this challenge.</p>'; return; }
    h.innerHTML = '<p>Computing the table…</p>'; const rows = await Promise.all(LEAK.map(async (x) => [x[0], await sha256(x[1])]));
    const short = (x) => '<code title="' + x + '">' + x.slice(0, 20) + '…</code>';
    h.innerHTML = '<h3>users_backup.csv (leaked)</h3><table class="u-table"><thead><tr><th scope="col">user</th><th scope="col">sha256(password)</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + E(r[0]) + '</td><td>' + short(r[1]) + '</td></tr>').join('') + '</tbody></table>' +
      '<h3>Tool 1: hash a guess</h3><form id="hrHashF" class="row" style="gap:8px;flex-wrap:wrap"><label class="sr-only" for="hrGuess">Guess</label><input id="hrGuess" placeholder="a password to try" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="btn small" type="submit">Hash it</button></form><p id="hrHashOut" aria-live="polite"></p>' +
      '<h3>Tool 2: dictionary attack</h3><p class="u-fine">The ' + WORDS.length + ' most common passwords (real wordlists have billions): ' + WORDS.map((w) => '<code>' + E(w) + '</code>').join(' ') + '</p><button type="button" class="btn small primary" id="hrRun">Run the wordlist</button><div id="hrRunOut" aria-live="polite"></div>';
    $('#hrHashF').addEventListener('submit', async (e) => { e.preventDefault(); const g = $('#hrGuess').value; const x = await sha256(g); const who = rows.filter((r) => r[1] === x).map((r) => r[0]); $('#hrHashOut').innerHTML = 'SHA-256 of <code>' + E(g) + '</code> is <code class="hr-hex">' + x + '</code>. ' + (who.length ? '<b class="good">Match: ' + E(who.join(', ')) + '</b>' : 'No account has this hash.'); });
    $('#hrRun').addEventListener('click', async () => { const t0 = performance.now(); const found = []; for (const w of WORDS) { const x = await sha256(w); rows.forEach((r) => { if (r[1] === x) found.push([r[0], w]); }); } const ms = Math.max(1, Math.round(performance.now() - t0)); $('#hrRunOut').innerHTML = '<p>Tried ' + WORDS.length + ' words against ' + rows.length + ' accounts in about ' + ms + ' ms. Found ' + found.length + ':</p><ul>' + found.map((f) => '<li><b>' + E(f[0]) + '</b>: <code>' + E(f[1]) + '</code></li>').join('') + '</ul><p class="u-fine">One account did not fall: a long, unusual password is not in any wordlist.</p>'; });
  };
  MOUNT.sqli = (h) => {
    h.innerHTML = '<div class="hr-page"><h3>🔐 Northwind staff portal</h3><form id="hrLogin" class="hr-form"><label>User name <input id="hrU" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off"></label><label>Password <input id="hrP" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off"></label><button class="btn small primary" type="submit">Sign in</button></form><div id="hrRes" aria-live="polite"></div></div><p class="u-fine">The query the server built (shown for teaching; in a real test you would not see it):</p><pre id="hrQ" class="hr-q"></pre>';
    $('#hrLogin').addEventListener('submit', (e) => { e.preventDefault(); const q = "SELECT id, name, role FROM users WHERE name = '" + $('#hrU').value + "' AND pass = '" + $('#hrP').value + "'"; $('#hrQ').textContent = q; let rows; try { rows = SQL.run(q, DB_LOGIN); } catch (er) { $('#hrRes').innerHTML = '<p class="bad">Database error: ' + E(er.message) + '</p>'; return; }
      if (!rows.length) { $('#hrRes').innerHTML = '<p>Wrong user name or password.</p>'; return; } const r = rows[0];
      $('#hrRes').innerHTML = r[2] === 'admin' ? '<p class="good">Welcome, <b>' + E(String(r[1])) + '</b> (administrator).</p><p>Admin panel: <code>FLAG{or-1-equals-1}</code></p>' : '<p>Signed in as <b>' + E(String(r[1])) + '</b> (' + E(String(r[2])) + '). Only the admin account sees the admin panel.</p>'; });
  };
  MOUNT.union = (h) => {
    h.innerHTML = '<div class="hr-page"><h3>🥖 Search the menu</h3><form id="hrS" class="row" style="gap:8px;flex-wrap:wrap"><label class="sr-only" for="hrSq">Search</label><input id="hrSq" placeholder="e.g. bread" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off"><button class="btn small primary" type="submit">Search</button></form><div id="hrRes" aria-live="polite"></div></div><p class="u-fine">The query the server built (shown for teaching):</p><pre id="hrQ" class="hr-q"></pre>';
    const go = () => { const q = "SELECT name, price FROM products WHERE name LIKE '%" + $('#hrSq').value + "%'"; $('#hrQ').textContent = q; let rows; try { rows = SQL.run(q, DB_SHOP); } catch (er) { $('#hrRes').innerHTML = '<p class="bad">Database error: ' + E(er.message) + '</p>'; return; }
      $('#hrRes').innerHTML = rows.length ? '<table class="u-table"><thead><tr><th scope="col">Product</th><th scope="col">Price</th></tr></thead><tbody>' + rows.slice(0, 50).map((r) => '<tr><td>' + E(String(r[0])) + '</td><td>' + E(String(r[1])) + '</td></tr>').join('') + '</tbody></table>' : '<p>No products found.</p>'; };
    $('#hrS').addEventListener('submit', (e) => { e.preventDefault(); go(); });
  };
  MOUNT.xss = (h, ctx) => {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36); let fixed = false;
    const posts = [['Ana', 'Best croissants in town!'], ['Ben', 'The <b>sourdough</b> is amazing, and I typed &lt;b&gt; to make it bold.']];
    h.innerHTML = '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><span class="pill" id="hrVer">Server version: vulnerable</span><button type="button" class="btn small" id="hrFix" hidden>Switch to the fixed version</button></div><iframe id="hrFrame" class="hr-frame" title="Guestbook (sandboxed)" sandbox="allow-scripts"></iframe><form id="hrPost" class="hr-form"><label>Name <input id="hrN" maxlength="40" value="Tester" autocomplete="off"></label><label>Message <textarea id="hrM" rows="3" maxlength="500" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea></label><button class="btn small primary" type="submit">Post message</button></form>';
    const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
    const draw = () => { $('#hrFrame').srcdoc = '<!doctype html><meta charset="utf-8"><style>body{font:15px system-ui,sans-serif;margin:12px;color:#222;background:#fffdf8}.m{border-bottom:1px solid #ddd;padding:6px 0}b.n{color:#8a4b08}</style><script>function proof(){parent.postMessage({hr:"xss",t:"' + token + '"},"*");}<\/script><h2>📖 Northwind guestbook</h2>' + posts.map((p) => '<div class="m"><b class="n">' + esc(p[0]) + '</b><div>' + (fixed ? esc(p[1]) : p[1]) + '</div></div>').join(''); };
    const onMsg = (e) => { const f = $('#hrFrame'); if (!f || e.source !== f.contentWindow || !e.data || e.data.hr !== 'xss' || e.data.t !== token) return; if (!fixed) ctx.win('FLAG{escape-output-every-time}'); };
    window.addEventListener('message', onMsg); ctx.cleanup(() => window.removeEventListener('message', onMsg));
    $('#hrPost').addEventListener('submit', (e) => { e.preventDefault(); const m = $('#hrM').value; if (!m.trim()) return; posts.push([$('#hrN').value || 'Anonymous', m]); if (posts.length > 20) posts.splice(2, 1); $('#hrM').value = ''; draw(); });
    $('#hrFix').addEventListener('click', () => { fixed = !fixed; $('#hrVer').textContent = 'Server version: ' + (fixed ? 'fixed (output escaped)' : 'vulnerable'); $('#hrFix').textContent = fixed ? 'Switch back to the vulnerable version' : 'Switch to the fixed version'; draw(); });
    ctx.onWin(() => { $('#hrFix').hidden = false; }); draw();
  };
  MOUNT.idor = (h) => {
    h.innerHTML = '<div class="hr-page"><h3>🧾 Shop API explorer</h3><form id="hrApi" class="row" style="gap:8px;flex-wrap:wrap"><span class="pill">GET</span><label class="sr-only" for="hrPath">Path</label><input id="hrPath" value="/api/invoices/5031" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" style="flex:1;min-width:12em"><button class="btn small primary" type="submit">Send</button></form><p class="u-fine"><label><input type="checkbox" id="hrTok" checked> Send my session: <code>Authorization: Bearer sam-1042-9f3a</code></label></p><p class="hr-status" id="hrSt" aria-live="polite"></p><pre id="hrBody" class="hr-q"></pre></div>';
    const send = () => { const p = normPath($('#hrPath').value); let st = 200, body;
      if (!$('#hrTok').checked) { st = 401; body = { error: 'sign in required' }; }
      else if (p === '/api/me') body = { id: 1042, name: 'Sam Lee', role: 'customer' };
      else if (p === '/api/invoices') body = { invoices: [5031, 5034] };
      else if (/^\/api\/invoices\/\d+$/.test(p)) { const inv = invoice(+p.split('/').pop()); if (inv) body = inv; else { st = 404; body = { error: 'invoice not found' }; } }
      else if (/^\/api\/admin/.test(p)) { st = 403; body = { error: 'admins only' }; }
      else { st = 404; body = { error: 'no such endpoint' }; }
      $('#hrSt').textContent = 'HTTP ' + st + ' ' + STATUS[st]; $('#hrBody').textContent = JSON.stringify(body, null, 2); };
    $('#hrApi').addEventListener('submit', (e) => { e.preventDefault(); send(); }); send();
  };
  MOUNT.cookie = (h) => {
    let cookie = b64e(JSON.stringify({ user: 'sam', role: 'student' }));
    h.innerHTML = '<div id="hrB"></div><div class="card hr-tools"><h3>🍪 Cookies for portal.northwind.test</h3><form id="hrCk" class="row" style="gap:8px;flex-wrap:wrap"><label for="hrCv"><code>session</code> =</label><input id="hrCv" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" style="flex:1;min-width:14em"><button class="btn small" type="submit">Save cookie</button></form><h3>Base64 tool</h3><label class="sr-only" for="hrB64">Text</label><textarea id="hrB64" rows="2" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea><p class="row" style="gap:8px"><button type="button" class="btn small" id="hrDec">Decode</button><button type="button" class="btn small" id="hrEnc">Encode</button></p></div>';
    $('#hrCv').value = cookie;
    const b = browser($('#hrB'), 'portal.northwind.test', (p) => { const s = (() => { try { return JSON.parse(b64d(cookie) || 'x'); } catch (e) { return null; } })();
      if (!s || typeof s !== 'object' || typeof s.user !== 'string') return { status: 401, html: '<h1>Session invalid</h1><p>Your cookie could not be read. Put the original value back to sign in again.</p>' };
      const who = E(s.user) + ' (role: ' + E(String(s.role)) + ')';
      if (p === '/') return { status: 200, html: '<h1>Staff portal</h1><p>Hello, ' + who + '.</p><ul><li>' + GL('/rota', 'Shift rota') + '</li><li>' + GL('/admin', 'Admin area') + '</li></ul>' };
      if (p === '/rota') return { status: 200, html: '<h1>Shift rota</h1><p>Mon: Ana, Ben · Tue: Ben, Chloe · Wed: Ana, Dev</p><p>' + GL('/', '← Home') + '</p>' };
      if (p === '/admin') return s.role === 'admin' ? { status: 200, html: '<h1>Admin area</h1><p>Welcome, ' + who + '.</p><p><code>FLAG{sign-your-session-cookies}</code></p>' } : { status: 403, html: '<h1>403 Forbidden</h1><p>Admins only. You are ' + who + '.</p><p>' + GL('/', '← Home') + '</p>' };
      return null; });
    $('#hrCk').addEventListener('submit', (e) => { e.preventDefault(); cookie = $('#hrCv').value.trim(); A.toast('Cookie saved. Reload a page to send it.'); b.go($('#hrUrl').value); });
    $('#hrDec').addEventListener('click', () => { const r = b64d($('#hrB64').value); $('#hrB64').value = r === null ? '(not valid Base64)' : r; });
    $('#hrEnc').addEventListener('click', () => { $('#hrB64').value = b64e($('#hrB64').value); });
  };
  function shellSim(input) { // what /bin/sh would do with: ping -c 1 <input>
    const parts = []; let cur = '', i = 0; const s = 'ping -c 1 ' + input;
    while (i < s.length) { const two = s.slice(i, i + 2); if (two === '&&' || two === '||') { parts.push(cur, two); cur = ''; i += 2; continue; } if (s[i] === ';' || s[i] === '|' || s[i] === '\n') { parts.push(cur, s[i] === '\n' ? ';' : s[i]); cur = ''; i++; continue; } cur += s[i++]; }
    parts.push(cur); const out = []; let ok = true, pipeOut = null;
    const one = (cmd) => { const a = cmd.trim().split(/\s+/).filter(Boolean).map((x) => x.replace(/^["']|["']$/g, '')); const c = a[0]; const lines = [];
      if (!c) return { ok: true, lines };
      if (c === 'ping') { const host = a[a.length - 1]; if (a.length < 4 || host === '1') return { ok: false, lines: ['ping: usage error: Destination address required'] }; if (!/^[A-Za-z0-9.-]+$/.test(host)) return { ok: false, lines: ['ping: ' + host + ': Name or service not known'] }; const up = Object.keys(NET).includes(host) || host === 'localhost' || host === '127.0.0.1'; return up ? { ok: true, lines: ['PING ' + host + ' 56(84) bytes of data.', '64 bytes from ' + host + ': icmp_seq=1 ttl=64 time=0.42 ms', '', '--- ' + host + ' ping statistics ---', '1 packets transmitted, 1 received, 0% packet loss'] } : { ok: false, lines: ['PING ' + host + ' 56(84) bytes of data.', '', '--- ' + host + ' ping statistics ---', '1 packets transmitted, 0 received, 100% packet loss'] }; }
      if (c === 'whoami') return { ok: true, lines: ['www-data'] };
      if (c === 'id') return { ok: true, lines: ['uid=33(www-data) gid=33(www-data) groups=33(www-data)'] };
      if (c === 'pwd') return { ok: true, lines: ['/var/www/html'] };
      if (c === 'hostname') return { ok: true, lines: ['router-lab'] };
      if (c === 'uname') return { ok: true, lines: [a[1] === '-a' ? 'Linux router-lab 5.10.0 armv7l GNU/Linux' : 'Linux'] };
      if (c === 'echo') return { ok: true, lines: [a.slice(1).join(' ')] };
      if (c === 'ls') { let d = (a.filter((x) => !x.startsWith('-'))[1] || '/var/www/html').replace(/\/$/, '') || '/'; if (!d.startsWith('/')) d = '/var/www/html/' + d; const names = new Set(); Object.keys(FS_ROUTER).forEach((f) => { if (f.startsWith(d + '/')) names.add(f.slice(d.length + 1).split('/')[0]); }); if (d === '/home/admin' || d === '/root') return { ok: false, lines: ['ls: cannot open directory \'' + d + '\': Permission denied'] }; return names.size ? { ok: true, lines: [Array.from(names).sort().join('  ')] } : { ok: false, lines: ['ls: cannot access \'' + d + '\': No such file or directory'] }; }
      if (c === 'cat') { if (!a[1]) return { ok: true, lines: pipeOut || [] }; let f = a[1]; if (!f.startsWith('/')) f = '/var/www/html/' + f; if (/^\/(root|home\/admin)/.test(f)) return { ok: false, lines: ['cat: ' + a[1] + ': Permission denied'] }; return FS_ROUTER[f] !== undefined ? { ok: true, lines: FS_ROUTER[f].replace(/\n$/, '').split('\n') } : { ok: false, lines: ['cat: ' + a[1] + ': No such file or directory'] }; }
      return { ok: false, lines: ['sh: 1: ' + c + ': not found'] }; };
    for (let k = 0; k < parts.length; k += 2) { const op = k ? parts[k - 1] : ';'; if (op === '&&' && !ok) continue; if (op === '||' && ok) continue; const r = one(parts[k]); ok = r.ok; if (parts[k + 1] === '|') { pipeOut = r.lines; continue; } out.push(...r.lines); pipeOut = null; }
    return out;
  }
  S.shellSim = shellSim;
  MOUNT.cmdi = (h) => {
    h.innerHTML = '<div class="hr-page"><h3>📶 Router admin · Network diagnostics</h3><form id="hrPing" class="row" style="gap:8px;flex-wrap:wrap"><label for="hrPingHost">Host to ping</label><input id="hrPingHost" value="10.10.0.5" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" style="flex:1;min-width:12em"><button class="btn small primary" type="submit">Ping</button></form><pre id="hrOut2" class="hr-q" aria-live="polite"></pre></div>';
    $('#hrPing').addEventListener('submit', (e) => { e.preventDefault(); $('#hrOut2').textContent = shellSim($('#hrPingHost').value).join('\n') || '(no output)'; });
  };

  /* ---------- range pages ---------- */
  const rangeRec = (id) => st().range[id] || {};
  const passRange = (c) => { const u = st(); const r = u.range[c.id] = u.range[c.id] || {}; if (!r.pass) { r.pass = true; r.at = today(); U.markStudy(); A.addXp(15); save(); A.toast('🏁 Challenge complete: ' + c.title); return true; } return false; };
  let cleanups = [];
  S.range = function (path) {
    cleanups.forEach((f) => { try { f(); } catch (e) {} }); cleanups = [];
    const crumbs = [['University', []], ['Laboratories', ['labs']], ['Ethical hacking range', ['range']]];
    const c = RC.find((x) => x.id === path[1]); const scoped = rangeRec('scope').pass;
    if (!c) {
      const n = RC.filter((x) => rangeRec(x.id).pass).length;
      let h = '<section class="u-stagehero"><p class="u-eyebrow">Laboratory</p><h1>Ethical hacking range</h1><p>Capture-the-flag challenges against a fictional bakery\'s systems. Every website, server and database here is fake: it is a small program inside this page, so nothing is sent anywhere and you cannot harm anyone. Each challenge ends with how to fix the weakness, which is the point of the exercise.</p><div class="uc-meta"><span>' + n + ' of ' + RC.length + ' challenges complete</span></div></section>';
      h += '<div class="card hr-warn"><p><b>Only test what you own or have written permission to test.</b> Using these techniques on a real website, network or device without permission is a crime in Canada, the United States, the United Kingdom and most other countries, whatever your reason. To practise further, use your own machines or sites built for it (listed in SEC 101).</p></div>';
      ['Start here', 'Reconnaissance', 'Passwords', 'Web'].forEach((lv) => { h += '<h2 class="u-h2">' + E(lv) + '</h2><ul class="u-list">' + RC.filter((x) => x.lvl === lv).map((x) => { const r = rangeRec(x.id); const locked = x.id !== 'scope' && !scoped; return '<li>' + link(['range', x.id], '<b>' + (locked ? '🔒 ' : '') + E(x.title) + '</b><small>' + E(x.sum) + ' · ' + (r.pass ? 'Complete ✓ ' + E(r.at) : locked ? 'Unlocks after Rules of engagement' : r.tries ? 'Started' : 'Not started') + '</small>') + '</li>'; }).join('') + '</ul>'; });
      h += '<p>' + link(['course', 'sec101'], 'Course: SEC 101 Ethical Hacking Foundations →', 'btn small') + ' ' + link(['course', 'sec102'], 'Course: SEC 102 Web Application Security Testing →', 'btn small') + '</p>';
      shell('labs', h, crumbs); return;
    }
    if (c.id !== 'scope' && !scoped) { shell('labs', '<div class="u-lockmsg">🔒 Complete <b>Rules of engagement</b> first: every real engagement starts with knowing what you are allowed to do.</div><p>' + link(['range', 'scope'], 'Start: Rules of engagement →', 'btn primary') + '</p>', crumbs.concat([[c.title]])); return; }
    const r0 = rangeRec(c.id); const md = U.md;
    let h = '<article class="u-lab hr"><header><p class="u-eyebrow">Hacking range · ' + E(c.lvl) + '</p><h1>' + E(c.title) + '</h1><p class="pill" id="hrState">' + (r0.pass ? 'Complete ✓ on ' + E(r0.at) + '. You can do it again.' : c.id === 'scope' ? 'Answer every item correctly to continue.' : c.auto ? 'Completes automatically when your code runs.' : 'Submit the flag when you find it.') + '</p></header><div class="u-prose">' + md(c.brief) + '</div>';
    if (c.id === 'scope') {
      h += '<div class="card"><h2>The scope document</h2><div class="u-prose">' + md(SCOPE_DOC) + '</div></div><ol class="hr-scope" id="hrScope">' + SCOPE_Q.map((q, i) => '<li data-i="' + i + '"><p>' + E(q[0]) + '</p><div class="row" style="gap:8px"><button type="button" class="btn small" data-a="1">Allowed</button><button type="button" class="btn small" data-a="0">Not allowed</button></div><p class="u-why" aria-live="polite"></p></li>').join('') + '</ol>' +
        '<div class="card"><label><input type="checkbox" id="hrPromise"> I will only test systems that I own or that I have written permission to test.</label></div><p id="hrScopeRes" aria-live="polite"></p>';
    } else {
      h += '<section class="card hr-target" data-noi18n><h2>🎯 Target (simulated)</h2><div id="hrHost"></div></section>';
      if (!c.auto) h += '<form class="card hr-flag" id="hrFlag"><label for="hrFlagIn"><b>' + E(c.label || 'Flag') + '</b></label><div class="row" style="gap:8px;flex-wrap:wrap"><input id="hrFlagIn" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="' + (c.label ? '' : 'FLAG{…}') + '" style="flex:1;min-width:12em"><button class="btn small primary" type="submit">Submit</button></div><p id="hrFlagRes" aria-live="polite"></p></form>';
      else h += '<p id="hrFlagRes" class="card" aria-live="polite">Waiting for <code>proof()</code> to run…</p>';
      h += '<details class="card"><summary>Hints</summary><ul>' + c.hints.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ul></details><details class="card"><summary>Walkthrough (try first)</summary><ol>' + c.walk.map((x) => '<li>' + E(x) + '</li>').join('') + '</ol></details><details class="card" id="hrFixBox"' + (r0.pass ? ' open' : '') + '><summary>🛠 How to fix it</summary><div class="u-prose">' + md(c.fix) + '</div></details>';
    }
    h += '<p>' + link(['range'], '← All challenges', 'btn small') + '</p></article>';
    shell('labs', h, crumbs.concat([[c.title]]));
    const bump = () => { const u = st(); const r = u.range[c.id] = u.range[c.id] || {}; r.tries = Math.min(99999, (r.tries || 0) + 1); if (r.tries % 5 === 1) save(); };
    const won = (msg) => { passRange(c); $('#hrState').textContent = 'Complete ✓ on ' + rangeRec(c.id).at + '.'; $('#hrFlagRes').innerHTML = '<b class="good">🏁 ' + E(msg) + '</b> Now read how to fix it below.'; const fb = $('#hrFixBox'); if (fb) fb.open = true; };
    if (c.id === 'scope') {
      const got = {}; const check = () => { const all = SCOPE_Q.every((q, i) => got[i] === q[1]); if (all && $('#hrPromise').checked) { const first = passRange(c); $('#hrState').textContent = 'Complete ✓. The other challenges are unlocked.'; $('#hrScopeRes').innerHTML = '<b class="good">All correct.</b> ' + link(['range'], 'Go to the challenges →', 'btn primary'); } else if (all) $('#hrScopeRes').textContent = 'All correct. Tick the promise to finish.'; };
      $$('#hrScope li').forEach((li) => li.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; const i = +li.dataset.i, q = SCOPE_Q[i]; const ok = +b.dataset.a === q[1]; got[i] = +b.dataset.a; li.querySelectorAll('[data-a]').forEach((x) => x.classList.toggle('sel', x === b)); li.className = ok ? 'ok' : 'no'; li.querySelector('.u-why').innerHTML = (ok ? '<b class="good">Right.</b> ' : '<b class="bad">Not quite.</b> ') + E(q[2]); bump(); check(); }));
      $('#hrPromise').addEventListener('change', check); return;
    }
    const winFns = []; const ctx = { win: (f) => { won('You captured the flag: ' + f); winFns.forEach((fn) => fn()); }, onWin: (fn) => { winFns.push(fn); if (r0.pass) fn(); }, cleanup: (fn) => cleanups.push(fn) };
    Promise.resolve(MOUNT[c.id]($('#hrHost'), ctx)).catch((e) => { $('#hrHost').textContent = 'This target could not start: ' + e.message; });
    if (!c.auto) $('#hrFlag').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#hrFlagIn').value.trim(); bump(); if (v === c.flag) won(c.label ? 'Correct: that is the password.' : 'Correct flag.'); else $('#hrFlagRes').innerHTML = '<span class="bad">That is not it.</span> ' + (c.label ? 'Check the exact spelling.' : 'Flags look like FLAG{…}, copied exactly.'); });
  };
  U.sims = S;
})();
