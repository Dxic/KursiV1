/* ============================================================
   KURSI · UI kit: icons, toast, modal, badges, charts, QR
   ============================================================ */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtRp = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

  /* ---------- inline SVG icon set (lucide-style, stroke) ---------- */
  const P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/><path d="M3 3h2l2.6 12.4a1.5 1.5 0 0 0 1.5 1.1h7.9a1.5 1.5 0 0 0 1.5-1.2L20 7H6"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m4 12.5 5 5L20 6.5"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    chair: '<path d="M6 19v-7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7"/><path d="M6 19h12"/><path d="M9 10V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5"/>',
    coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v3M10 2v3M14 2v3"/>',
    receipt: '<path d="M4 3h16v18l-2.5-1.5L15 21l-2.5-1.5L10 21l-2.5-1.5L5 21l-1-.6z"/><path d="M8 8h8M8 12h8"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/>',
    wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M20 7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><circle cx="16.5" cy="14" r="1.2"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M20 20h1M17 20h.01"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.4a6.5 6.5 0 0 1 4 5.6"/>',
    box: '<path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3.3 8.3 8.7 5 8.7-5M12 13.3V22"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    wifi: '<path d="M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M2 8.5a15 15 0 0 1 20 0"/><circle cx="12" cy="19" r="1"/>',
    flame: '<path d="M12 22c4.4 0 7-2.8 7-6.5 0-3-1.8-4.9-3-6.5-.8 1.2-1.5 1.7-2 1.5.3-2.5-.8-5.5-4-8 .2 3-1 4.5-2.5 6.2C6 9.9 5 11.5 5 15.5 5 19.2 7.6 22 12 22z"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    chevR: '<path d="m9 6 6 6-6 6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8 10a16 16 0 0 0 6 6l1.4-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    store: '<path d="M3 9 5 3h14l2 6"/><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
    transfer: '<path d="m17 3 4 4-4 4"/><path d="M21 7H9M7 21l-4-4 4-4"/><path d="M3 17h12"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    slip: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    call: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'
  };
  function icon(name, size) {
    const d = P[name] || P.info;
    return '<svg class="ic" width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  /* ---------- toast ---------- */
  function toast(msg, type) {
    const root = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'ok');
    el.innerHTML = icon(type === 'err' ? 'alert' : 'check', 16) + '<span>' + esc(msg) + '</span>';
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2800);
  }

  /* ---------- modal ---------- */
  function modal(opts) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML =
      '<div class="modal-backdrop"></div>' +
      '<div class="modal ' + (opts.wide ? 'modal-wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || 'Dialog') + '">' +
      '<div class="modal-head"><h3>' + esc(opts.title || '') + '</h3>' + (opts.closable === false ? '' : '<button class="icon-btn" data-close aria-label="Close">' + icon('close', 18) + '</button>') + '</div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : '') +
      '</div>';
    root.appendChild(wrap);
    document.body.classList.add('modal-open');
    const close = () => { wrap.classList.add('closing'); document.body.classList.remove('modal-open'); setTimeout(() => wrap.remove(), 180); };
    wrap.querySelector('.modal-backdrop').addEventListener('click', () => { if (opts.closable !== false) close(); });
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    (opts.onMount || function () { })(wrap.querySelector('.modal'), close);
    return { el: wrap.querySelector('.modal'), close };
  }
  function confirmDlg(title, body, okLabel, danger) {
    return new Promise(resolve => {
      const m = modal({
        title, body: '<p class="muted">' + esc(body) + '</p>',
        footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(okLabel || 'Ya, Lanjut') + '</button>',
        onMount(el, close) {
          el.querySelector('[data-ok]').addEventListener('click', () => { close(); resolve(true); });
          el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) resolve(false); });
        }
      });
      m.el.closest('.modal-wrap').addEventListener('transitionend', () => { }, { once: true });
    });
  }

  /* ---------- badges & misc ---------- */
  const STATUS_META = {
    PENDING_PAYMENT: { label: 'Belum Bayar', cls: 'warn' },
    NEW: { label: 'Baru', cls: 'accent' },
    PREPARING: { label: 'Diproses', cls: 'busy' },
    READY: { label: 'Siap', cls: 'info' },
    SERVED: { label: 'Diantar', cls: 'ok' },
    COMPLETED: { label: 'Selesai', cls: 'ok' },
    CANCELLED: { label: 'Dibatalkan', cls: 'muted' },
    PAID: { label: 'Lunas', cls: 'ok' },
    PENDING: { label: 'Menunggu', cls: 'warn' },
    FAILED: { label: 'Gagal', cls: 'err' },
    REFUNDED: { label: 'Dikembalikan', cls: 'muted' }
  };
  function badge(status) {
    const m = STATUS_META[status] || { label: status, cls: 'muted' };
    return '<span class="badge badge-' + m.cls + '">' + esc(m.label) + '</span>';
  }
  function payBadge(method, status) {
    const mm = { QRIS: 'QRIS', EWALLET: 'E-Wallet', CARD: 'Kartu', CASH: 'Tunai' };
    return '<span class="pay-badge"><span class="dot"></span>' + esc(mm[method] || method) + (status === 'PENDING' ? ' · Menunggu' : status === 'PAID' ? ' · Lunas' : '') + '</span>';
  }
  function emptyState(icn, title, body, actionHtml) {
    return '<div class="empty-state">' + icon(icn, 34) + '<h4>' + esc(title) + '</h4><p class="muted">' + esc(body) + '</p>' + (actionHtml || '') + '</div>';
  }
  function avatar(name, sz) {
    const initials = String(name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return '<span class="avatar" style="width:' + (sz || 34) + 'px;height:' + (sz || 34) + 'px;font-size:' + Math.round((sz || 34) * 0.36) + 'px">' + esc(initials) + '</span>';
  }

  /* ---------- charts (hand-rolled SVG, no deps) ---------- */
  function lineChart(data, opts) {
    opts = opts || {};
    const w = opts.width || 640, h = opts.height || 220, pad = { l: 8, r: 8, t: 16, b: 26 };
    const max = Math.max(1, ...data.map(d => d.value));
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const px = i => pad.l + (data.length === 1 ? iw / 2 : i * iw / (data.length - 1));
    const py = v => pad.t + ih - (v / max) * ih;
    let path = '', area = '';
    data.forEach((d, i) => { const x = px(i), y = py(d.value); path += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); });
    area = path + ' L' + px(data.length - 1) + ' ' + (pad.t + ih) + ' L' + pad.l + ' ' + (pad.t + ih) + ' Z';
    const step = Math.max(1, Math.ceil(data.length / 7));
    let labels = '', dots = '';
    data.forEach((d, i) => {
      if (i % step === 0 || i === data.length - 1) labels += '<text x="' + px(i) + '" y="' + (h - 6) + '" class="chart-label" text-anchor="middle">' + esc(d.label) + '</text>';
      dots += '<circle cx="' + px(i) + '" cy="' + py(d.value) + '" r="3" class="chart-dot"><title>' + esc(d.label) + ': ' + esc(d.title || d.value) + '</title></circle>';
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="chart" preserveAspectRatio="xMidYMid meet">' +
      '<path d="' + area + '" class="chart-area"/>' +
      '<path d="' + path + '" class="chart-line"/>' + dots + labels + '</svg>';
  }
  function barRow(label, value, max, color) {
    const pct = max ? Math.max(2, Math.round(value / max * 100)) : 2;
    return '<div class="bar-row"><span class="bar-label">' + esc(label) + '</span><span class="bar-track"><span class="bar-fill" style="width:' + pct + '%;' + (color ? 'background:' + color : '') + '"></span></span><span class="bar-val">' + esc(fmtShort(value)) + '</span></div>';
  }
  function fmtShort(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return String(n);
  }

  /* ---------- QR (scannable via public API, offline fallback pattern) ---------- */
  function qrImg(data, size, alt) {
    const url = 'https://api.qrserver.com/v1/create-qr-code/?size=' + (size * 2) + 'x' + (size * 2) + '&margin=6&data=' + encodeURIComponent(data);
    return '<img class="qr-img" width="' + size + '" height="' + size + '" alt="' + esc(alt || 'QR code') + '" src="' + url + '" loading="lazy" onerror="this.outerHTML=KursiUI.qrFallback(' + JSON.stringify(data).replace(/"/g, '&quot;') + ',' + size + ')">';
  }
  function qrFallback(text, size) {
    // deterministic decorative QR-look grid (fallback only when offline)
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967295; };
    const n = 21, cell = Math.floor(size / n);
    let cells = '';
    const finder = (cx, cy) => { for (let y = 0; y < 7; y++)for (let x = 0; x < 7; x++) { const edge = x === 0 || y === 0 || x === 6 || y === 6, core = x >= 2 && x <= 4 && y >= 2 && y <= 4; if (edge || core) cells += '<rect x="' + (cx + x) * cell + '" y="' + (cy + y) * cell + '" width="' + cell + '" height="' + cell + '"/>'; } };
    for (let y = 0; y < n; y++)for (let x = 0; x < n; x++) { const inFinder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9); if (!inFinder && rand() > 0.52) cells += '<rect x="' + x * cell + '" y="' + y * cell + '" width="' + cell + '" height="' + cell + '"/>'; }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    return '<svg class="qr-img" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" fill="#2a1f14" role="img" aria-label="QR code pattern"><rect width="' + size + '" height="' + size + '" fill="#fffdf8"/>' + cells + '</svg>';
  }

  /* ---------- receipt printable ---------- */
  function printReceipt(order, settings) {
    const root = document.getElementById('print-root');
    const items = order.items.map(i =>
      '<tr><td>' + i.qty + 'x ' + esc(i.name) +
      (i.modifiers.length ? '<div class="r-mods">' + i.modifiers.map(m => esc(m.name) + (m.price ? ' (+' + fmtRp(m.price) + ')' : '')).join(' · ') + '</div>' : '') +
      (i.note ? '<div class="r-mods">Note: ' + esc(i.note) + '</div>' : '') +
      '</td><td class="r-amt">' + fmtRp(i.lineTotal) + '</td></tr>').join('');
    root.innerHTML =
      '<div class="receipt-paper">' +
      '<div class="r-brand">' + esc(settings.cafeName.toUpperCase()) + '</div>' +
      '<div class="r-sub">' + esc(settings.branch) + '</div>' +
      '<div class="r-sep"></div>' +
      '<div class="r-row"><span>Order</span><span>#' + order.number + '</span></div>' +
      '<div class="r-row"><span>Meja</span><span>' + esc(order.tableName) + ' · Dine-in</span></div>' +
      '<div class="r-row"><span>Tanggal</span><span>' + new Date(order.createdAt).toLocaleString('id-ID') + '</span></div>' +
      (order.guestName ? '<div class="r-row"><span>Guest</span><span>' + esc(order.guestName) + '</span></div>' : '') +
      '<div class="r-sep"></div><table class="r-table">' + items + '</table><div class="r-sep"></div>' +
      '<div class="r-row"><span>Subtotal</span><span>' + fmtRp(order.subtotal) + '</span></div>' +
      '<div class="r-row"><span>' + esc(settings.taxLabel) + '</span><span>' + fmtRp(order.tax) + '</span></div>' +
      '<div class="r-row"><span>' + esc(settings.serviceLabel) + '</span><span>' + fmtRp(order.service) + '</span></div>' +
      '<div class="r-row r-total"><span>TOTAL</span><span>' + fmtRp(order.total) + '</span></div>' +
      '<div class="r-row"><span>Pembayaran</span><span>' + esc(order.paymentMethod) + ' · ' + esc(order.paymentStatus) + '</span></div>' +
      (order.payments[0] && order.payments[0].ref ? '<div class="r-row"><span>Ref</span><span>' + esc(order.payments[0].ref) + '</span></div>' : '') +
      '<div class="r-sep"></div>' +
      '<div class="r-sub">' + esc(settings.tagline) + '</div>' +
      '<div class="r-sub">Thank you · see you again.</div>' +
      '</div>';
    window.print();
    setTimeout(() => { root.innerHTML = ''; }, 400);
  }

  /* base URL used inside table QR codes (override via Admin → Meja & QR) */
  function qrBase() { return localStorage.getItem('kursi_qr_base') || location.origin + location.pathname; }

  window.KursiUI = { icon, toast, modal, confirmDlg, badge, payBadge, emptyState, avatar, lineChart, barRow, qrImg, qrFallback, printReceipt, esc, fmtShort, qrBase };
})();
