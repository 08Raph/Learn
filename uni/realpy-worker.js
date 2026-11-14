/* Learn: real Python (Pyodide) in a background worker.
   Runs in a dedicated worker so that an endless loop can be stopped by terminating the worker, without
   freezing the page. Pyodide is downloaded from the jsDelivr CDN the first time; the service worker keeps a
   copy for offline use. Messages:  {type:'init'} -> {type:'ready', version} | {type:'fail', error}
                                    {type:'run', id, code, stdin} -> {type:'done', id, out, error} */
const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
let py = null, loading = null;
async function init() {
  importScripts(PYODIDE_BASE + 'pyodide.js');
  py = await self.loadPyodide({ indexURL: PYODIDE_BASE });
  return py;
}
function tidyError(e) { // keep the useful end of a Python traceback, without Pyodide's internal frames
  const t = String((e && e.message) || e || 'Error'); const lines = t.split('\n').filter((l) => !/\/lib\/python3\.\d+\/site-packages\/_pyodide|_pyodide\/_base\.py/.test(l));
  const i = lines.findIndex((l) => /File "<exec>"/.test(l)); const keep = i >= 0 ? ['Traceback (most recent call last):'].concat(lines.slice(i)) : lines;
  return keep.join('\n').trim().slice(-2000);
}
self.onmessage = async (ev) => {
  const m = ev.data || {};
  if (m.type === 'init') {
    try { if (!loading) loading = init(); await loading; self.postMessage({ type: 'ready', version: py.version || '' }); }
    catch (e) { loading = null; self.postMessage({ type: 'fail', error: String((e && e.message) || e) }); }
    return;
  }
  if (m.type === 'run') {
    if (!py) { self.postMessage({ type: 'done', id: m.id, out: '', error: 'Python is not loaded.' }); return; }
    const out = []; const input = String(m.stdin || '').split('\n'); let k = 0;
    py.setStdout({ batched: (s) => out.push(s) }); py.setStderr({ batched: (s) => out.push(s) });
    py.setStdin({ stdin: () => (k < input.length && !(k === input.length - 1 && input[k] === '') ? input[k++] : undefined) });
    let ns = null;
    try { ns = py.globals.get('dict')(); await py.runPythonAsync(String(m.code || ''), { globals: ns, filename: '<exec>' }); self.postMessage({ type: 'done', id: m.id, out: out.join('\n'), error: null }); }
    catch (e) { self.postMessage({ type: 'done', id: m.id, out: out.join('\n'), error: tidyError(e) }); }
    finally { try { if (ns && ns.destroy) ns.destroy(); } catch (e) { /* ignore */ } }
  }
};
