/* ============================================================
   KURSI Backend — Supabase sync adapter (pre-configured)
   ============================================================ */
(function () {
  'use strict';
  const CFG_KEY = 'kursi_backend_cfg';
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(CFG_KEY)); } catch (e) { cfg = null; }
  if (!cfg) cfg = {
    url: 'https://ngazttpahttzabxghjdq.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nYXp0dHBhaHR0emFieGdoamRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzUyNDYsImV4cCI6MjEwNTIxMTI0Nn0.d8uByGJ7aw_PYpno47R2gkim1shicTbKBDuaGjIaDLU',
    enabled: true
  };

  function configured() { return !!(cfg && cfg.url && cfg.key && cfg.enabled); }
  function headers() {
    return { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' };
  }
  function endpoint() { return cfg.url.replace(/\/+$/, '') + '/rest/v1/kursi_state'; }

  let pushTimer = null, pollTimer = null, onRemote = null;

  async function test() {
    if (!cfg || !cfg.url || !cfg.key) throw new Error('Isi URL dan anon key Supabase dulu.');
    const r = await fetch(cfg.url.replace(/\/+$/, '') + '/rest/v1/kursi_state?select=id', { headers: headers() });
    if (!r.ok) throw new Error('Koneksi gagal (' + r.status + '). Cek URL, key, dan tabel kursi_state.');
    return true;
  }

  async function pull() {
    if (!configured()) return null;
    const r = await fetch(endpoint() + '?id=eq.1&select=state', { headers: headers() });
    if (!r.ok) throw new Error('Pull failed: ' + r.status);
    const rows = await r.json();
    if (rows && rows[0] && rows[0].state && rows[0].state.v === 1) return rows[0].state;
    return null;
  }

  function push(state) {
    if (!configured()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try {
        await fetch(endpoint() + '?id=eq.1', {
          method: 'PATCH', headers: headers(),
          body: JSON.stringify({ state: state, updated_at: new Date().toISOString() })
        });
      } catch (e) { /* offline — retry next mutation */ }
    }, 350);
  }

  function subscribe(cb, intervalMs) {
    onRemote = cb;
    if (pollTimer) clearInterval(pollTimer);
    if (!configured()) return;
    pollTimer = setInterval(async () => {
      try {
        const remote = await pull();
        if (remote && onRemote) onRemote(remote);
      } catch (e) { /* keep polling */ }
    }, intervalMs || 4000);
  }

  function saveConfig(next) {
    cfg = next;
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (configured()) subscribe(onRemote);
  }

  window.KursiBackend = {
    get config() { return cfg; },
    configured, test, pull, push, subscribe, saveConfig
  };
})();
