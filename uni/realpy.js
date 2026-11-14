/* Learn: real Python (Pyodide) for the open Python lab. Optional and never used for grading.
   window.LearnRealPython = { state, load(onStatus), run(code, stdin, timeoutMs) }   state: 'idle' | 'loading' | 'ready' | 'failed' */
(function () {
  'use strict';
  const R = { state: 'idle', version: '', error: '' };
  let w = null, ready = null, seq = 0; const pending = {};
  function start() {
    w = new Worker('uni/realpy-worker.js?v=' + (window.LEARN_UNI_VER || '1'));
    w.onmessage = (e) => { const m = e.data || {}; if (m.type === 'done' && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } };
    ready = new Promise((ok, no) => {
      const t = setTimeout(() => no(new Error('Downloading Python took more than 3 minutes.')), 180000);
      const h = (e) => { const m = e.data || {}; if (m.type === 'ready') { clearTimeout(t); w.removeEventListener('message', h); R.version = m.version; ok(); } else if (m.type === 'fail') { clearTimeout(t); w.removeEventListener('message', h); no(new Error(m.error)); } };
      w.addEventListener('message', h); w.onerror = (e) => { clearTimeout(t); no(new Error(e.message || 'The Python worker could not start.')); };
      w.postMessage({ type: 'init' });
    });
    return ready;
  }
  function stop() { if (w) { w.terminate(); w = null; ready = null; } Object.keys(pending).forEach((k) => { pending[k]({ out: '', error: 'stopped' }); delete pending[k]; }); }
  R.load = async function (onStatus) {
    if (R.state === 'ready' && ready) return;
    R.state = 'loading'; if (onStatus) onStatus('loading');
    try { await (ready || start()); R.state = 'ready'; R.error = ''; if (onStatus) onStatus('ready'); }
    catch (e) { stop(); R.state = 'failed'; R.error = String(e && e.message || e); if (onStatus) onStatus('failed'); throw e; }
  };
  R.run = async function (code, stdin, timeoutMs) {
    await R.load(); const id = ++seq; const t0 = performance.now(); const limit = timeoutMs || 10000;
    return new Promise((ok) => {
      const timer = setTimeout(() => { delete pending[id]; stop(); R.state = 'idle'; ok({ out: '', error: 'Stopped after ' + Math.round(limit / 1000) + ' seconds: the program did not finish (an endless loop?). Python restarts on the next run, which takes a few seconds.', ms: performance.now() - t0, timeout: true }); }, limit);
      pending[id] = (m) => { clearTimeout(timer); ok({ out: m.out || '', error: m.error || null, ms: performance.now() - t0 }); };
      w.postMessage({ type: 'run', id, code: String(code), stdin: String(stdin || '') });
    });
  };
  window.LearnRealPython = R;
})();
