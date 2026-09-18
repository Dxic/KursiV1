/* KURSI · router & boot */
(function () {
  'use strict';
  const V = window.Views = window.Views || {};
  const app = () => document.getElementById('app');
  let liveTimer = null;

  /* landing page */
  V.landing = function () {
    const s = window.KursiDB.settings();
    const UI = window.KursiUI;
    return {
      html:
        '<div class="cust-wrap" style="max-width:560px">' +
        '<div class="welcome-hero" style="background-image:url(assets/avocado-toast.png)"><div class="welcome-overlay">' +
        '<div class="brand-lockup"><span class="brand-mark lg">K</span><h1>KURSI</h1></div>' +
        '<p class="tagline">' + UI.esc(s.tagline) + '</p></div></div>' +
        '<div class="welcome-body">' +
        '<h2 class="welcome-title">Pemesanan Meja &amp; Operasional Kafe</h2>' +
        '<p class="muted">Satu platform: pelanggan pesan lewat QR di meja, dapur menerima tiket secara langsung, kasir mengelola pembayaran, dan pemilik memantau seluruh bisnis.</p>' +
        '<div style="display:flex;flex-direction:column;gap:10px;margin:22px 0">' +
        '<a class="btn btn-primary btn-lg btn-block" href="#/t/A7K29">' + UI.icon('qr', 18) + ' Demo pelanggan · Table 07 (QR scan)</a>' +
        '<a class="btn btn-dark btn-lg btn-block" href="#/login">' + UI.icon('users', 18) + ' Masuk staf (Kasir · Dapur · Admin)</a>' +
        '</div>' +
        '<p class="welcome-foot">' + UI.esc(s.branch) + '</p>' +
        '<div class="landing-reset"><button class="btn-mini ghost" id="reset-demo">' + UI.icon('rotate', 13) + ' Reset demo data</button></div>' +
        '</div></div>',
      mount(el) {
        const b = el.querySelector('#reset-demo');
        if (b) b.addEventListener('click', async () => {
          if (await UI.confirmDlg('Reset Demo Data?', 'All orders, payments and edits will be discarded and the original seed dataset restored.', 'Reset Data', true)) {
            window.KursiDB.reset();
            UI.toast('Demo data restored');
            render();
          }
        });
      }
    };
  };

  const routes = [
    [/^#?\/?$/, () => V.landing],
    [/^#\/login$/, () => V.login],
    [/^#\/t\/([A-Za-z0-9]+)$/, (m) => () => V.welcome(m[1])],
    [/^#\/t\/([A-Za-z0-9]+)\/menu(?:\?(.*))?$/, (m) => () => V.menu(m[1], m[2] || '')],
    [/^#\/t\/([A-Za-z0-9]+)\/p\/([\w-]+)$/, (m) => () => V.product(m[1], m[2])],
    [/^#\/t\/([A-Za-z0-9]+)\/cart$/, (m) => () => V.cart(m[1])],
    [/^#\/t\/([A-Za-z0-9]+)\/pay\/([\w-]+)$/, (m) => () => V.pay(m[1], m[2])],
    [/^#\/t\/([A-Za-z0-9]+)\/cashier\/([\w-]+)$/, (m) => () => V.cashierPay(m[1], m[2])],
    [/^#\/t\/([A-Za-z0-9]+)\/track(?:\/([\w-]+))?$/, (m) => () => V.track(m[1], m[2])],
    [/^#\/pos$/, () => V.posOverview],
    [/^#\/pos\/orders(?:\?(.*))?$/, (m) => () => V.posOrders(m[1] || '')],
    [/^#\/pos\/tables(?:\?(.*))?$/, (m) => () => V.posTables(m[1] || '')],
    [/^#\/pos\/payments$/, () => V.posPayments],
    [/^#\/pos\/receipts$/, () => V.posReceipts],
    [/^#\/kitchen$/, () => V.kitchen],
    [/^#\/admin$/, () => V.adminOverview],
    [/^#\/admin\/orders(?:\?(.*))?$/, (m) => () => V.adminOrders(m[1] || '')],
    [/^#\/admin\/products(?:\?(.*))?$/, (m) => () => V.adminProducts(m[1] || '')],
    [/^#\/admin\/categories$/, () => V.adminCategories],
    [/^#\/admin\/modifiers$/, () => V.adminModifiers],
    [/^#\/admin\/inventory$/, () => V.adminInventory],
    [/^#\/admin\/tables$/, () => V.adminTables],
    [/^#\/admin\/staff$/, () => V.adminStaff],
    [/^#\/admin\/customers$/, () => V.adminCustomers],
    [/^#\/admin\/payments$/, () => V.adminPayments],
    [/^#\/admin\/expenses$/, () => V.adminExpenses],
    [/^#\/admin\/reports$/, () => V.adminReports],
    [/^#\/admin\/audit$/, () => V.adminAudit],
    [/^#\/admin\/settings$/, () => V.adminSettings]
  ];

  function render() {
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
    const hash = location.hash || '#/';
    let view = null;
    for (const r of routes) {
      const m = hash.match(r[0]);
      if (m) { view = r[1](m); break; }
    }
    if (!view) view = V.landing;
    let v;
    try { v = view(); } catch (e) { console.error(e); v = { html: '<div class="cust-wrap"><div class="empty-state" style="margin-top:20vh"><h4>Something went wrong</h4><p class="muted">' + window.KursiUI.esc(e.message) + '</p></div></div>' }; }
    const root = app();
    root.innerHTML = v.html || '';
    window.scrollTo(0, 0);
    if (v.mount && v.html) { try { v.mount(root); } catch (e) { console.error(e); } }
    if (v.live && v.html) {
      liveTimer = setInterval(() => {
        if (document.hidden) return;
        if (document.body.classList.contains('modal-open')) return; // jangan ganggu modal
        let fresh;
        try { fresh = view(); } catch (e) { return; }
        if (!fresh.html || fresh.html === root.innerHTML) return; // tidak ada perubahan
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return; // user sedang mengetik
        const y = window.scrollY; // jaga posisi scroll
        root.innerHTML = fresh.html;
        if (fresh.mount) { try { fresh.mount(root); } catch (e) { console.error(e); } }
        window.scrollTo(0, y);
      }, 5000);
    }
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('kursi:rerender', render);
  window.addEventListener('kursi:external', render); // realtime across tabs
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  // PWA: register service worker (installable + offline shell)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
    });
  }

  // Supabase backend: adopt newer remote state whenever the poller sees one
  if (window.KursiBackend && window.KursiBackend.configured()) {
    window.KursiBackend.subscribe(function (remote) {
      const local = window.KursiDB.db;
      const lt = local && local.meta ? new Date(local.meta.updatedAt).getTime() : 0;
      const rt = remote && remote.meta ? new Date(remote.meta.updatedAt).getTime() : 0;
      if (rt > lt) window.KursiDB.adopt(remote);
    });
  }
  render();
})();
