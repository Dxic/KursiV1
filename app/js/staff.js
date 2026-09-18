/* ============================================================
   KURSI · Staff app
   #/login              staff sign-in
   #/pos/...            cashier (top-nav POS)
   #/kitchen            kitchen display system
   #/admin/...          admin (sidebar)
   ============================================================ */
(function () {
  'use strict';
  const DB = () => window.KursiDB;
  const UI = () => window.KursiUI;
  const esc = (s) => window.KursiUI.esc(s);
  const fmtRp = (n) => window.KursiDB.fmtRp(n);
  const ago = (iso) => window.KursiDB.ago(iso);
  const hm = (iso) => window.KursiDB.timeHM(iso);
  const V = window.Views = window.Views || {};
  function rerender() { window.dispatchEvent(new CustomEvent('kursi:rerender')); }
  function toastErr(e) { UI().toast(e.message || String(e), 'err'); }

  /* ================= LOGIN ================= */
  V.login = function () {
    if (DB().staff()) { location.hash = DB().staff().role === 'KITCHEN' ? '#/kitchen' : DB().staff().role === 'ADMIN' ? '#/admin' : '#/pos'; return { html: '' }; }
    const users = DB().users();
    return {
      html: '<div class="login-wrap">' +
        '<div class="login-card">' +
        '<div class="brand-lockup center"><span class="brand-mark lg">K</span><h1>KURSI</h1></div>' +
        '<p class="tagline center">' + esc(DB().settings().tagline) + '</p>' +
        '<h2 class="login-title">Staff Sign In</h2>' +
        '<div class="field"><label class="field-label">Email</label><input class="input" id="lg-email" type="email" placeholder="you@kursi.local" autocomplete="username"></div>' +
        '<div class="field"><label class="field-label">Password</label><input class="input" id="lg-pass" type="password" placeholder="••••••••" autocomplete="current-password"></div>' +
        '<div class="login-err" id="lg-err"></div>' +
        '<button class="btn btn-dark btn-lg btn-block" id="lg-go">' + UI().icon('logout', 16) + ' Masuk</button>' +
        '<div class="demo-accounts"><span class="mg-rule">Demo accounts · password <code>kursi123</code></span>' +
        users.filter(u => u.active).map(u => '<button class="demo-acct" data-email="' + esc(u.email) + '"><span>' + UI().avatar(u.name, 30) + '</span><span class="da-txt"><strong>' + esc(u.name) + '</strong><small>' + esc(u.title) + '</small></span><span class="da-role">' + esc(u.role) + '</span></button>').join('') + '</div>' +
        '<a class="link center" style="display:block;margin-top:16px" href="#/">← Back to customer experience</a>' +
        '</div></div>',
      mount(el) {
        const go = () => {
          try {
            const u = DB().login(el.querySelector('#lg-email').value.trim(), el.querySelector('#lg-pass').value);
            UI().toast('Selamat datang, ' + u.name);
            location.hash = u.role === 'KITCHEN' ? '#/kitchen' : u.role === 'ADMIN' ? '#/admin' : '#/pos';
          } catch (e) { el.querySelector('#lg-err').textContent = e.message; }
        };
        el.querySelector('#lg-go').addEventListener('click', go);
        el.querySelector('#lg-pass').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
        el.querySelectorAll('.demo-acct').forEach(b => b.addEventListener('click', () => {
          el.querySelector('#lg-email').value = b.dataset.email;
          el.querySelector('#lg-pass').value = 'kursi123';
          go();
        }));
      }
    };
  };

  /* ================= shared staff chrome ================= */
  function staffGuard(roles) {
    const u = DB().staff();
    if (!u) { setTimeout(() => { location.hash = '#/login'; }, 0); return null; }
    if (!roles.includes(u.role)) {
      setTimeout(() => { location.hash = u.role === 'KITCHEN' ? '#/kitchen' : u.role === 'ADMIN' ? '#/admin' : '#/pos'; }, 0);
      return null;
    }
    return u;
  }
  function posTop(u, active, extra) {
    const tabs = [['overview', 'Ringkasan', '#/pos'], ['pesanan', 'Pesanan', '#/pos/orders'], ['tables', 'Meja', '#/pos/tables'], ['payments', 'Pembayaran', '#/pos/payments'], ['receipts', 'Struk', '#/pos/receipts']];
    const d = new Date();
    return '<header class="pos-top">' +
      '<a class="brand-mini" href="#/pos"><span class="brand-mark">K</span><span class="brand-word">KURSI<em>CAFE OS · POS</em></span></a>' +
      '<span class="shift-chip"><span class="dot-live"></span> Shift #1 · Morning</span>' +
      '<nav class="pos-tabs">' + tabs.map(t => '<a class="pos-tab ' + (active === t[0] ? 'active' : '') + '" href="' + t[2] + '">' + t[1] + '</a>').join('') + '</nav>' +
      (extra || '') +
      '<a class="btn btn-dark" href="#/pos/orders?new=1">' + UI().icon('plus', 15) + ' New Walk-In Order</a>' +
      '<span class="pos-top-meta">' + UI().icon('wifi', 14) + ' Daring · ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + '</span>' +
      '<div class="pos-user">' + UI().avatar(u.name, 30) + '<div><strong>' + esc(u.name) + '</strong><small>' + esc(u.title) + '</small></div>' +
      '<button class="icon-btn" id="staff-logout" aria-label="Sign out">' + UI().icon('logout', 16) + '</button></div>' +
      '</header>';
  }
  function bindLogout(el) { const b = el.querySelector('#staff-logout'); if (b) b.addEventListener('click', () => { DB().logout(); location.hash = '#/login'; }); }
  function posFoot() { return '<footer class="pos-foot"><span>KURSI Hospitality POS · Terminal Station Bali #01</span><span><span class="dot-live"></span> Cloud Sync Active · v2.4.8-pos</span></footer>'; }

  function orderSummaryText(o) {
    return o.items.slice(0, 2).map(i => i.qty + 'x ' + i.name.split(' ').slice(0, 3).join(' ')).join(', ') + (o.items.length > 2 ? '...' : '');
  }

  /* ================= CASHIER: OVERVIEW ================= */
  V.posOverview = function () {
    const u = staffGuard(['CASHIER', 'ADMIN']); if (!u) return { html: '' };
    const m = DB().metrics(1);
    const todays = DB().todayOrders();
    const active = todays.filter(o => ['NEW', 'PREPARING', 'READY'].includes(o.orderStatus));
    const low = DB().lowStock();
    return {
      html: '<div class="staff-wrap">' + posTop(u, 'overview') +
        '<main class="pos-main">' +
        '<div class="pos-title-row"><div><h1 class="page-title">' + UI().icon('receipt', 22) + ' Operasional Shift dan Kasir</h1><p class="muted">Kasir Station 01 · Penanggung jawab: ' + esc(u.name) + '</p></div><span class="live-chip"><span class="dot-live"></span> Sinkron Langsung · POS #01</span></div>' +
        '<div class="metric-grid four">' +
        metricCard('Penjualan Hari Ini', fmtRp(m.salesToday), '+' + Math.min(14, m.ordersToday) + '% vs kemarin (' + m.ordersToday + ' orders)', 'cash', 'var(--terra)') +
        metricCard('Makan di Tempat Aktif', DB().tables().filter(t => DB().tableStatus(t).key !== 'AVAILABLE').length + ' Meja Terisi', Math.round(DB().tables().filter(t => DB().tableStatus(t).key !== 'AVAILABLE').length / DB().tables().length * 100) + '% kapasitas', 'chair', 'var(--olive)') +
        metricCard('Menunggu Dapur', m.pendingKitchen + ' Tiket', 'Rata-rata proses: 9 mnt', 'flame', 'var(--amber)') +
        metricCard('Lunas via QRIS', m.qrisShare + '%', 'Metode utama · ' + fmtRp(todays.filter(o => o.paymentMethod === 'QRIS' && o.paymentStatus === 'PAID').reduce((s, o) => s + o.total, 0)) + ' total', 'qr', 'var(--ink)') +
        '</div>' +
        (low.length ? '<div class="notice-strip"><span class="ns-icn">' + UI().icon('alert', 18) + '</span><span><strong>Info Barista:</strong> ' + esc(low[0].name) + ' hampir habis (' + low[0].stock + ' ' + low[0].unit + ' tersisa, min ' + low[0].minStock + ').</span><a class="btn btn-mini ghost" href="#/admin/inventory">Tandai Restock</a></div>' : '') +
        '<div class="pos-cols">' +
        '<section class="panel">' +
        '<div class="panel-head"><h2>Aliran Pesanan Aktif</h2><span class="tag">' + active.length + ' aktif sekarang</span></div>' +
        '<div class="feed-filters"><span class="chip dark">Semua (' + active.length + ')</span><span class="chip">Aktif Dapur (' + active.filter(o => o.orderStatus !== 'READY').length + ')</span><span class="chip">Belum Bayar (' + todays.filter(o => o.paymentStatus === 'PENDING').length + ')</span><span class="chip">Siap (' + active.filter(o => o.orderStatus === 'READY').length + ')</span></div>' +
        '<table class="tbl"><thead><tr><th>Pesanan / Meja</th><th>Waktu / Tamu</th><th>Items Summary</th><th>Total</th><th>Pembayaran</th><th>Kitchen</th></tr></thead><tbody>' +
        (active.length ? active.map(o => '<tr class="row-link" data-order="' + o.id + '"><td><strong>#' + o.number + '</strong> <span class="tag">' + esc(o.tableName) + '</span></td><td>' + hm(o.createdAt) + '<br><span class="muted">' + esc(o.guestName || 'Tamu') + '</span></td><td>' + esc(orderSummaryText(o)) + '</td><td><strong>' + fmtRp(o.total) + '</strong></td><td>' + UI().payBadge(o.paymentMethod, o.paymentStatus) + '</td><td>' + UI().badge(o.orderStatus) + '</td></tr>').join('') : '<tr><td colspan="6">' + UI().emptyState('receipt', 'Belum ada pesanan aktif', 'Pesanan dari pelanggan akan muncul di sini.') + '</td></tr>') +
        '</tbody></table>' +
        '<div class="panel-foot muted">Menampilkan recent ' + active.length + ' tiket dari ' + todays.length + ' transaksi hari ini · <a class="link" href="#/pos/orders">Lihat Semua Jurnal</a></div>' +
        '<div class="ops-strip">' +
        '<div class="ops-card"><img src="assets/avocado-toast.png" alt=""><div><span class="mg-rule">TERLARIS PAGI · ' + (DB().topProducts(1, 1)[0] ? DB().topProducts(1, 1)[0].qty + ' terjual' : '-') + '</span><strong>' + (DB().topProducts(1, 1)[0] ? esc(DB().topProducts(1, 1)[0].name) : '-') + '</strong></div></div>' +
        '<div class="ops-card"><img src="assets/iced-latte.png" alt=""><div><span class="mg-rule">ESPRESSO BAR</span><strong>La Marzocco PB 2-Group</strong><span class="muted">Water filtration optimal</span></div></div>' +
        '</div>' +
        '</section>' +
        '<aside class="pos-side">' +
        '<section class="panel"><div class="panel-head"><h2>Status Tata Meja</h2><span class="tag">' + DB().tables().length + ' MEJA</span></div>' +
        '<div class="legend"><span><i class="lg ok"></i>Tersedia</span><span><i class="lg busy"></i>In Kitchen Prep</span><span><i class="lg warn"></i>Belum Bayar</span><span><i class="lg ready"></i>Siap</span></div>' +
        '<div class="floor-mini">' + DB().tables().map(t => { const st = DB().tableStatus(t); return '<a class="fm-tile st-' + st.cls + '" href="#/pos/tables?t=' + t.id + '"><strong>' + esc(t.name) + '</strong><small>' + esc(st.label.toUpperCase()) + '</small></a>'; }).join('') + '</div>' +
        '<a class="link" href="#/pos/tables">Open Floor Map ' + UI().icon('arrowRight', 13) + '</a></section>' +
        '<section class="panel"><div class="panel-head"><h2>Aksi POS Cepat</h2></div><div class="actions-grid">' +
        '<a class="action-tile dark" href="#/pos/orders?new=1">' + UI().icon('plus', 20) + ' Walk-in Order +</a>' +
        '<a class="action-tile terra" href="#/pos/orders?unpaid=1">' + UI().icon('users', 20) + ' Settle Unpaid Bills</a>' +
        '<button class="action-tile" id="reprint-last">' + UI().icon('print', 20) + ' Reprint Last Receipt</button>' +
        '<button class="action-tile" id="call-floor">' + UI().icon('bell', 20) + ' Call Floor Staff</button>' +
        '</div></section>' +
        '<section class="panel"><div class="panel-head"><h2>Alur Ekspediter Dapur</h2><span class="tag tag-olive">STATION 1 · LIVE</span></div><div class="kds-stream">' +
        active.slice(0, 4).map(o => '<div class="ks-row"><span class="dot"></span><div><strong>Ticket #' + o.number + ' (' + esc(o.tableName) + ')</strong><span class="muted">' + esc(orderSummaryText(o)) + '</span></div><span class="ks-time">' + ago(o.createdAt).replace(' ago', '') + '</span></div>').join('') +
        '</div><a class="btn btn-ghost btn-block" href="#/kitchen">' + UI().icon('flame', 15) + ' Open Kitchen Display View</a></section>' +
        '</aside>' +
        '</div></main>' + posFoot() + '</div>',
      mount(el) {
        bindLogout(el);
        el.querySelectorAll('[data-order]').forEach(r => r.addEventListener('click', () => { location.hash = '#/pos/orders?o=' + r.dataset.order; }));
        const last = DB().orders().find(o => o.paymentStatus === 'PAID');
        el.querySelector('#reprint-last').addEventListener('click', () => { if (last) UI().printReceipt(last, DB().settings()); else UI().toast('Belum ada struk untuk dicetak ulang', 'err'); });
        el.querySelector('#call-floor').addEventListener('click', () => UI().toast('Staf lantai dipanggil'));
      },
      live: true
    };
  };
  function metricCard(label, value, sub, icn, color) {
    return '<div class="metric-card"><div class="mc-top"><span class="mc-label">' + label + '</span><span class="mc-icn" style="color:' + color + '">' + UI().icon(icn, 19) + '</span></div><div class="mc-value">' + value + '</div><div class="mc-sub">' + sub + '</div><span class="mc-bar"><span style="width:62%;background:' + color + '"></span></span></div>';
  }

  /* ================= CASHIER: ORDERS ================= */
  V.posOrders = function (query) {
    const u = staffGuard(['CASHIER', 'ADMIN']); if (!u) return { html: '' };
    const params = new URLSearchParams(query || '');
    return {
      html: '<div class="staff-wrap">' + posTop(u, 'pesanan') +
        '<main class="pos-main"><div class="orders-split" id="orders-split"></div></main>' + posFoot() + '</div>',
      mount(el) { mountOrders(el.querySelector('#orders-split'), u, params, false); },
      live: true
    };
  };

  function mountOrders(root, u, params, adminMode) {
    let filter = params.get('unpaid') ? 'PENDING_PAYMENT' : 'ALL';
    let payFilter = 'ALL', search = '', selectedId = params.get('o') || null;
    if (params.get('new')) { openWalkIn(u, () => rerender()); return; }

    function draw() {
      let orders = DB().orders();
      const todays = DB().todayOrders();
      const openCount = todays.filter(o => ['NEW', 'PREPARING', 'READY'].includes(o.orderStatus)).length;
      if (filter !== 'ALL') orders = orders.filter(o => o.orderStatus === filter);
      if (payFilter !== 'ALL') orders = orders.filter(o => payFilter === 'PAID' ? o.paymentStatus === 'PAID' : o.paymentStatus === 'PENDING');
      if (search) { const t = search.toLowerCase(); orders = orders.filter(o => ('#' + o.number).includes(t) || o.tableName.toLowerCase().includes(t) || (o.guestName || '').toLowerCase().includes(t) || o.items.some(i => i.name.toLowerCase().includes(t))); }
      orders = orders.slice(0, 40);
      const counts = { ALL: DB().orders().length };
      ['NEW', 'PENDING_PAYMENT', 'PREPARING', 'READY', 'COMPLETED'].forEach(s => counts[s] = DB().orders().filter(o => o.orderStatus === s).length);
      const sel = selectedId ? DB().order(selectedId) : null;

      root.innerHTML =
        '<section class="panel orders-list">' +
        '<div class="mini-stats">' +
        '<div class="ms"><span class="mc-label">Tiket Terbuka</span><strong>' + openCount + '</strong></div>' +
        '<div class="ms"><span class="mc-label">Di Dapur / Bar</span><strong class="terra">' + todays.filter(o => ['NEW', 'PREPARING'].includes(o.orderStatus)).length + '</strong><small>proses</small></div>' +
        '<div class="ms"><span class="mc-label">Tagihan Belum Bayar</span><strong class="terra">' + todays.filter(o => o.paymentStatus === 'PENDING').length + '</strong><small>meja</small></div>' +
        '<div class="ms"><span class="mc-label">Rata-rata Proses</span><strong>8.4m</strong></div></div>' +
        '<div class="orders-toolbar"><div class="search-bar sm">' + UI().icon('search', 15) + '<input id="ord-q" placeholder="Cari no. pesanan, meja, item, atau pelanggan..." value="' + esc(search) + '"></div>' +
        '<select class="input sm" id="ord-pay"><option value="ALL">Bayar: Semua</option><option value="PAID"' + (payFilter === 'PAID' ? ' selected' : '') + '>Lunas</option><option value="PENDING"' + (payFilter === 'PENDING' ? ' selected' : '') + '>Belum Bayar</option></select></div>' +
        '<div class="feed-filters">' + ['ALL', 'NEW', 'PENDING_PAYMENT', 'PREPARING', 'READY', 'COMPLETED'].map(f => '<button class="chip ' + (filter === f ? 'dark' : '') + '" data-f="' + f + '">' + (f === 'ALL' ? 'Semua ' + counts.ALL : f === 'PENDING_PAYMENT' ? 'Belum Bayar ' + counts[f] : f[0] + f.slice(1).toLowerCase() + ' ' + counts[f]) + '</button>').join('') + '</div>' +
        '<table class="tbl selectable"><thead><tr><th></th><th>Order ID</th><th>Meja</th><th>Time</th><th>Items Summary</th><th>Nominal</th><th>Pembayaran</th><th>Status</th></tr></thead><tbody>' +
        (orders.length ? orders.map(o => '<tr class="row-link ' + (sel && sel.id === o.id ? 'selected' : '') + '" data-o="' + o.id + '"><td><span class="radio' + (sel && sel.id === o.id ? ' on' : '') + '"></span></td><td><strong>#' + o.number + '</strong></td><td><span class="tag">' + esc(o.tableName) + '</span></td><td>' + hm(o.createdAt) + '<br><small class="muted">' + ago(o.createdAt) + '</small></td><td>' + esc(orderSummaryText(o)) + '<br><small class="muted">' + o.items.length + ' item' + (o.items.length > 1 ? 's' : '') + '</small></td><td><strong>' + fmtRp(o.total) + '</strong></td><td>' + UI().payBadge(o.paymentMethod, o.paymentStatus) + '</td><td>' + UI().badge(o.orderStatus) + '</td></tr>').join('') : '<tr><td colspan="8">' + UI().emptyState('receipt', 'Tidak ada pesanan cocok', 'Coba hapus filter.') + '</td></tr>') +
        '</tbody></table>' +
        '<div class="panel-foot muted">Menampilkan ' + orders.length + ' dari ' + DB().orders().length + ' orders · Automatic sync: every 15s</div>' +
        '</section>' +
        '<aside class="panel order-detail" id="order-detail">' + (sel ? orderDetailHtml(sel, u, adminMode) : UI().emptyState('receipt', 'Pilih pesanan', 'Pilih pesanan dari daftar untuk melihat detail, cetak struk, atau selesaikan pembayaran.')) + '</aside>';

      root.querySelector('#ord-q').addEventListener('input', e => { search = e.target.value; const pos = e.target.selectionStart; draw(); const inp = root.querySelector('#ord-q'); inp.focus(); inp.setSelectionRange(pos, pos); });
      root.querySelector('#ord-pay').addEventListener('change', e => { payFilter = e.target.value; draw(); });
      root.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; draw(); }));
      root.querySelectorAll('[data-o]').forEach(r => r.addEventListener('click', () => { selectedId = r.dataset.o; draw(); }));
      bindOrderDetail(root.querySelector('#order-detail'), sel, u, draw, adminMode);
    }
    draw();
  }

  function orderDetailHtml(o, u, adminMode) {
    if (!o) return '';
    const staff = DB().staff();
    const can = { acceptCash: o.paymentStatus === 'PENDING' && ['CASHIER', 'ADMIN'].includes(staff.role), deliver: o.orderStatus === 'READY', complete: o.orderStatus === 'SERVED', transfer: !['COMPLETED', 'CANCELLED'].includes(o.orderStatus), cancel: ['PENDING_PAYMENT', 'NEW'].includes(o.orderStatus) && ['CASHIER', 'ADMIN'].includes(staff.role), refund: o.paymentStatus === 'PAID' && staff.role === 'ADMIN' && !['COMPLETED', 'CANCELLED'].includes(o.orderStatus) };
    return '<div class="od-head"><div><h2>Pesanan #' + o.number + '</h2><p class="muted">' + esc(o.tableName) + ' · Makan di tempat · ' + new Date(o.createdAt).toLocaleString('id-ID') + '</p></div>' + UI().badge(o.orderStatus) + '</div>' +
      (o.note ? '<div class="kitchen-note">' + UI().icon('edit', 14) + ' Kitchen Note: "' + esc(o.note) + '"</div>' : '') +
      '<div class="od-meta">' + (o.guestName ? '<span>' + UI().icon('users', 13) + ' ' + esc(o.guestName) + '</span>' : '') + '<span>' + UI().icon('clock', 13) + ' dipesan ' + ago(o.createdAt) + '</span></div>' +
      '<div class="od-items">' + o.items.map(i => {
        const p = DB().product(i.productId) || {};
        return '<div class="track-item"><img src="' + esc(p.image || 'assets/iced-latte.png') + '" alt="" class="ci-img"><div class="ci-body"><div class="ci-top"><strong>' + i.qty + 'x ' + esc(i.name) + '</strong><span class="ci-price">' + fmtRp(i.lineTotal) + '</span></div>' +
          (i.modifiers.length ? '<div class="ci-mods">' + i.modifiers.map(m => '• ' + esc(m.name) + (m.price ? ' <span class="terra">+' + fmtRp(m.price) + '</span>' : '')).join('<br>') + '</div>' : '') +
          (i.note ? '<div class="ci-mods note">"' + esc(i.note) + '"</div>' : '') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="summary-card"><div class="sum-row"><span>Subtotal</span><span>' + fmtRp(o.subtotal) + '</span></div>' +
      '<div class="sum-row"><span>' + esc(DB().settings().taxLabel) + '</span><span>' + fmtRp(o.tax) + '</span></div>' +
      '<div class="sum-row"><span>' + esc(DB().settings().serviceLabel) + '</span><span>' + fmtRp(o.service) + '</span></div>' +
      '<div class="sum-row total"><span>Total ' + (o.paymentStatus === 'PAID' ? 'Settled' : 'Due') + '</span><span>' + fmtRp(o.total) + '</span></div>' +
      (o.payments.filter(p => p.status !== 'FAILED')[0] ? '<div class="pay-line">' + UI().icon('check', 14) + ' ' + esc(o.paymentMethod) + ' · Ref: ' + esc(o.payments.filter(p => p.status !== 'FAILED')[0].ref) + '</div>' : '') + '</div>' +
      '<div class="od-actions">' +
      '<button class="btn btn-dark" id="od-print">' + UI().icon('print', 15) + ' Cetak Struk Tamu</button>' +
      (can.acceptCash ? '<button class="btn btn-terra" id="od-cash">' + UI().icon('cash', 15) + ' Terima Pembayaran Tunai</button>' : '') +
      (can.deliver ? '<button class="btn btn-terra" id="od-deliver">' + UI().icon('chair', 15) + ' Mark Delivered</button>' : '') +
      (can.complete ? '<button class="btn btn-terra" id="od-complete">' + UI().icon('check', 15) + ' Complete / Clear Table</button>' : '') +
      (can.transfer ? '<button class="btn btn-ghost" id="od-transfer">' + UI().icon('transfer', 15) + ' Pindah Meja</button>' : '') +
      (can.refund ? '<button class="btn btn-ghost" id="od-refund">Void / Refund</button>' : '') +
      (can.cancel ? '<button class="btn btn-ghost danger" id="od-cancel">Batalkan Pesanan</button>' : '') +
      '</div>';
  }
  function bindOrderDetail(el, o, u, redraw, adminMode) {
    if (!el || !o) return;
    const q = (s) => el.querySelector(s);
    if (q('#od-print')) q('#od-print').addEventListener('click', () => UI().printReceipt(o, DB().settings()));
    if (q('#od-cash')) q('#od-cash').addEventListener('click', async () => {
      if (await UI().confirmDlg('Terima Pembayaran Tunai', 'Konfirmasi pembayaran tunai sebesar ' + fmtRp(o.total) + ' untuk pesanan #' + o.number + '?', 'Konfirmasi Pembayaran')) {
        try { DB().payOrder(o.id, 'CASH', { amount: o.total, actorRole: u.role, actorName: u.name }); UI().toast('Pembayaran tercatat'); redraw(); } catch (e) { toastErr(e); }
      }
    });
    if (q('#od-deliver')) q('#od-deliver').addEventListener('click', () => {
      try { DB().transition(o.id, 'SERVED', u); UI().toast('Marked as delivered'); redraw(); } catch (e) { toastErr(e); }
    });
    if (q('#od-complete')) q('#od-complete').addEventListener('click', () => {
      try { DB().transition(o.id, 'COMPLETED', u); UI().toast('Pesanan selesai'); redraw(); } catch (e) { toastErr(e); }
    });
    if (q('#od-transfer')) q('#od-transfer').addEventListener('click', () => {
      const others = DB().tables().filter(t => t.active && t.id !== o.tableId);
      UI().modal({
        title: 'Pindahkan Pesanan #' + o.number,
        body: '<div class="field"><label class="field-label">Move to table</label><select class="input" id="tr-to">' + others.map(t => '<option value="' + t.id + '">' + esc(t.name) + ' · ' + esc(t.zone) + '</option>').join('') + '</select></div>',
        footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="tr-go">Pindah</button>',
        onMount(m, close) {
          m.querySelector('#tr-go').addEventListener('click', () => {
            try { DB().transferOrder(o.id, m.querySelector('#tr-to').value, u); close(); UI().toast('Pesanan dipindah'); redraw(); } catch (e) { toastErr(e); }
          });
        }
      });
    });
    if (q('#od-refund')) q('#od-refund').addEventListener('click', async () => {
      if (await UI().confirmDlg('Void / Refund Pesanan?', 'Order #' + o.number + ' akan dibatalkan dan ' + fmtRp(o.total) + ' ditandai refund. Tidak bisa dibatalkan.', 'Void & Refund', true)) {
        try { DB().transition(o.id, 'CANCELLED', u); UI().toast('Pesanan di-void & refund'); redraw(); } catch (e) { toastErr(e); }
      }
    });
    if (q('#od-cancel')) q('#od-cancel').addEventListener('click', async () => {
      if (await UI().confirmDlg('Batalkan Pesanan?', 'Order #' + o.number + ' akan dibatalkan.', 'Batalkan Pesanan', true)) {
        try { DB().transition(o.id, 'CANCELLED', u); UI().toast('Pesanan dibatalkan'); redraw(); } catch (e) { toastErr(e); }
      }
    });
  }

  function openWalkIn(u, done) {
    const prods = DB().products().filter(p => p.available);
    const draft = [];
    UI().modal({
      title: 'Pesanan Walk-In Baru', wide: true,
      body:
        '<div class="walkin"><div class="wi-items">' +
        prods.map(p => '<div class="wi-prod"><img src="' + esc(p.image) + '" alt=""><div><strong>' + esc(p.name) + '</strong><small>' + fmtRp(p.price) + '</small></div><span class="qty sm"><button data-minus="' + p.id + '">−</button><span id="q-' + p.id + '">0</span><button data-plus="' + p.id + '">+</button></span></div>').join('') +
        '</div><div class="wi-side"><div class="field"><label class="field-label">Meja</label><select class="input" id="wi-table">' + DB().tables().filter(t => t.active).map(t => '<option value="' + t.code + '">' + esc(t.name) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label class="field-label">Nama tamu</label><input class="input" id="wi-guest" placeholder="Optional"></div>' +
        '<div class="summary-card" id="wi-summary"><div class="sum-row muted"><span>Select items...</span></div></div></div></div>',
      footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-dark" id="wi-create" disabled>Buat Pesanan (Belum Bayar)</button>',
      onMount(m, close) {
        function refresh() {
          const s = DB().settings();
          const sub = draft.reduce((a, d) => { const p = DB().product(d.productId); return a + p.price * d.qty; }, 0);
          const tax = Math.round(sub * s.taxRate), svc = Math.round(sub * s.serviceRate);
          m.querySelector('#wi-summary').innerHTML = '<div class="sum-head">Ringkasan Pesanan</div>' +
            (draft.length ? draft.map(d => { const p = DB().product(d.productId); return '<div class="sum-row"><span>' + d.qty + 'x ' + esc(p.name) + '</span><span>' + fmtRp(p.price * d.qty) + '</span></div>'; }).join('') : '<div class="sum-row muted"><span>Select items...</span></div>') +
            '<div class="sum-row"><span>Subtotal</span><span>' + fmtRp(sub) + '</span></div><div class="sum-row"><span>Tax & Service</span><span>' + fmtRp(tax + svc) + '</span></div><div class="sum-row total"><span>Total</span><span>' + fmtRp(sub + tax + svc) + '</span></div>';
          m.querySelector('#wi-create').disabled = !draft.length;
          m.querySelector('#wi-create').textContent = draft.length ? 'Create Order · ' + fmtRp(sub + tax + svc) : 'Buat Pesanan (Belum Bayar)';
        }
        m.querySelectorAll('[data-plus]').forEach(b => b.addEventListener('click', () => {
          const ex = draft.find(d => d.productId === b.dataset.plus);
          ex ? ex.qty++ : draft.push({ productId: b.dataset.plus, qty: 1, mods: [], note: '' });
          m.querySelector('#q-' + b.dataset.plus).textContent = ex ? ex.qty : 1; refresh();
        }));
        m.querySelectorAll('[data-minus]').forEach(b => b.addEventListener('click', () => {
          const i = draft.findIndex(d => d.productId === b.dataset.minus);
          if (i < 0) return;
          draft[i].qty--; if (draft[i].qty <= 0) draft.splice(i, 1);
          m.querySelector('#q-' + b.dataset.minus).textContent = Math.max(0, draft[i] ? draft[i].qty : 0); refresh();
        }));
        m.querySelector('#wi-create').addEventListener('click', () => {
          try {
            const code = m.querySelector('#wi-table').value;
            localStorage.setItem('kursi_cart_' + code, JSON.stringify(draft));
            const o = DB().createOrder(code, { guestName: m.querySelector('#wi-guest').value, note: 'Walk-in order by ' + u.name, method: 'CASH' });
            localStorage.removeItem('kursi_cart_' + code);
            DB().log('WALKIN_ORDER', '#' + o.number, u.name);
            close(); UI().toast('Pesanan walk-in #' + o.number + ' dibuat');
            if (done) done();
          } catch (e) { toastErr(e); }
        });
        refresh();
      }
    });
  }

  /* ================= CASHIER: TABLES ================= */
  V.posTables = function (query) {
    const u = staffGuard(['CASHIER', 'ADMIN']); if (!u) return { html: '' };
    const params = new URLSearchParams(query || '');
    const selId = params.get('t');
    return {
      html: '<div class="staff-wrap">' + posTop(u, 'tables') +
        '<main class="pos-main"><div class="tables-split" id="tables-split"></div></main>' + posFoot() + '</div>',
      mount(el) {
        const root = el.querySelector('#tables-split');
        function draw() {
          const tables = DB().tables();
          const occupied = tables.filter(t => DB().tableStatus(t).key !== 'AVAILABLE');
          root.innerHTML =
            '<section class="panel">' +
            '<div class="panel-head"><div class="ph-title"><h2>Operasional Lantai</h2><span class="muted">Auto-refresh · live</span></div><span class="tag">' + occupied.length + ' Active Tables</span></div>' +
            '<div class="legend"><span><i class="lg ok"></i>Tersedia</span><span><i class="lg busy"></i>Dapur Memproses</span><span><i class="lg warn"></i>Menunggu Tagihan</span><span><i class="lg ready"></i>Siap</span></div>' +
            '<div class="floor-grid">' + tables.map(t => {
              const st = DB().tableStatus(t);
              return '<button class="floor-card st-' + st.cls + (selId === t.id ? ' selected' : '') + '" data-t="' + t.id + '">' +
                '<div class="fc-top"><strong>' + esc(t.name) + '</strong><span class="fc-status">' + esc(st.label) + '</span></div>' +
                '<span class="fc-meta">' + UI().icon('users', 12) + ' ' + t.seats + ' Seats · ' + esc(t.zone) + '</span>' +
                (st.order ? '<div class="fc-order"><span>Ticket #' + st.order.number + '</span><strong>' + fmtRp(st.order.total) + '</strong><small>' + esc(orderSummaryText(st.order)) + '</small></div>' : '<div class="fc-order idle"><small>Cleaned &amp; QR standby active</small></div>') +
                '</button>';
            }).join('') + '</div></section>' +
            '<aside class="panel" id="table-side">' + tableSideHtml(selId ? DB().table(selId) : null, u) + '</aside>';
          root.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { location.hash = '#/pos/tables?t=' + b.dataset.t; }));
          bindTableSide(root.querySelector('#table-side'), u, draw);
        }
        draw();
      },
      live: true
    };
  };
  function tableSideHtml(t, u) {
    if (!t) return UI().emptyState('chair', 'Pilih meja', 'Klik kartu meja untuk melihat tiket QR, pesanan aktif, dan kontrolnya.');
    const st = DB().tableStatus(t);
    const url = UI().qrBase() + '#/t/' + t.code;
    return '<div class="od-head"><div><h2>' + esc(t.name) + '</h2><p class="muted">' + esc(t.zone) + ' · ' + t.seats + ' seats</p></div><span class="badge badge-' + st.cls + '">' + esc(st.label) + '</span></div>' +
      '<div class="qr-panel">' + UI().qrImg(url, 130, 'QR for ' + t.name) +
      '<div><strong>QR Meja Aktif</strong><span class="muted">Scans today: ' + t.scans + ' · URL: kursi.id/t/' + esc(t.code.toLowerCase()) + '</span>' + (st.order ? '<span class="tag tag-terra">Sesi #' + st.order.number + ' Linked</span>' : '<span class="tag tag-olive">Siaga</span>') + '</div></div>' +
      (st.order ? '<div class="side-order"><div class="so-head"><strong>Live Order · Ticket #' + st.order.number + '</strong>' + UI().payBadge(st.order.paymentMethod, st.order.paymentStatus) + '</div>' +
        st.order.items.map(i => '<div class="sum-row"><span>' + i.qty + 'x ' + esc(i.name) + '</span><span>' + fmtRp(i.lineTotal) + '</span></div>').join('') +
        '<div class="sum-row total"><span>Total Tagihan</span><span>' + fmtRp(st.order.total) + '</span></div></div>' : '<p class="muted">Tidak ada pesanan aktif di meja ini.</p>') +
      '<div class="od-actions">' +
      (st.order ? '<a class="btn btn-dark" href="#/pos/orders?o=' + st.order.id + '">Lihat Tiket</a>' : '') +
      (st.order && st.order.paymentStatus === 'PENDING' ? '<button class="btn btn-terra" id="ts-cash">' + UI().icon('cash', 15) + ' Terima Tunai</button>' : '') +
      (st.order && st.order.orderStatus === 'READY' ? '<button class="btn btn-terra" id="ts-deliver">Tandai Diantar</button>' : '') +
      (st.order && st.order.orderStatus === 'SERVED' ? '<button class="btn btn-terra" id="ts-serve">Selesai / Kosongkan</button>' : '') +
      (st.order ? '<button class="btn btn-ghost danger" id="ts-clear">Kosongkan &amp; Tersedia</button>' : '') +
      '</div>';
  }
  function bindTableSide(el, u, draw) {
    if (!el) return;
    const id = new URLSearchParams(location.hash.split('?')[1] || '').get('t');
    if (!id) return;
    const tbl = DB().table(id); if (!tbl) return;
    const st = DB().tableStatus(tbl);
    const q = s => el.querySelector(s);
    if (q('#ts-cash') && st.order) q('#ts-cash').addEventListener('click', async () => {
      if (await UI().confirmDlg('Terima Tunai', 'Confirm ' + fmtRp(st.order.total) + ' cash for #' + st.order.number + '?', 'Ya, Lanjut')) {
        try { DB().payOrder(st.order.id, 'CASH', { amount: st.order.total, actorRole: u.role, actorName: u.name }); UI().toast('Pembayaran tercatat'); draw(); } catch (e) { toastErr(e); }
      }
    });
    if (q('#ts-deliver') && st.order) q('#ts-deliver').addEventListener('click', () => { try { DB().transition(st.order.id, 'SERVED', u); UI().toast('Delivered'); draw(); } catch (e) { toastErr(e); } });
    if (q('#ts-serve') && st.order) q('#ts-serve').addEventListener('click', () => { try { DB().transition(st.order.id, 'COMPLETED', u); UI().toast('Meja dikosongkan'); draw(); } catch (e) { toastErr(e); } });
    if (q('#ts-clear') && st.order) q('#ts-clear').addEventListener('click', async () => {
      if (st.order.paymentStatus === 'PENDING') { UI().toast('Order is still unpaid · accept payment or cancel first', 'err'); return; }
      if (await UI().confirmDlg('Kosongkan Meja?', 'Selesaikan pesanan #' + st.order.number + ' dan tandai ' + tbl.name + ' tersedia?', 'Kosongkan Meja')) {
        try { DB().transition(st.order.id, 'COMPLETED', u); draw(); } catch (e) { toastErr(e); }
      }
    });
  }

  /* ================= CASHIER: PAYMENTS & RECEIPTS ================= */
  V.posPayments = function () {
    const u = staffGuard(['CASHIER', 'ADMIN']); if (!u) return { html: '' };
    return {
      html: '<div class="staff-wrap">' + posTop(u, 'payments') + '<main class="pos-main"><div id="pay-page"></div></main>' + posFoot() + '</div>',
      mount(el) { mountPayments(el.querySelector('#pay-page'), u); },
      live: true
    };
  };
  function mountPayments(root, u) {
    let f = 'ALL';
    function draw() {
      let pays = DB().paymentsList();
      if (f !== 'ALL') pays = pays.filter(p => p.status === f);
      const todayPaid = DB().paymentsList().filter(p => p.status === 'PAID' && new Date(p.at).toDateString() === new Date().toDateString());
      const total = todayPaid.reduce((s, p) => s + p.amount, 0);
      root.innerHTML = '<section class="panel">' +
        '<div class="panel-head"><h2>Pembayaran</h2><span class="tag">' + pays.length + ' records</span></div>' +
        '<div class="mini-stats"><div class="ms"><span class="mc-label">Terkumpul Hari Ini</span><strong>' + fmtRp(total) + '</strong></div><div class="ms"><span class="mc-label">Transaksi</span><strong>' + todayPaid.length + '</strong></div><div class="ms"><span class="mc-label">Porsi QRIS</span><strong>' + (todayPaid.length ? Math.round(todayPaid.filter(p => p.method === 'QRIS').length / todayPaid.length * 100) : 0) + '%</strong></div></div>' +
        '<div class="feed-filters">' + ['ALL', 'PAID', 'PENDING', 'FAILED', 'REFUNDED'].map(x => '<button class="chip ' + (f === x ? 'dark' : '') + '" data-f="' + x + '">' + (x === 'ALL' ? 'Semua' : x[0] + x.slice(1).toLowerCase()) + '</button>').join('') + '</div>' +
        '<table class="tbl"><thead><tr><th>Ref</th><th>Order</th><th>Meja</th><th>Nominal</th><th>Method</th><th>Status</th><th>Time</th><th></th></tr></thead><tbody>' +
        (pays.length ? pays.slice(0, 40).map(p => '<tr><td><code>' + esc(p.ref) + '</code></td><td><a class="link" href="#/pos/orders?o=' + p.orderId + '">#' + p.orderNumber + '</a></td><td>' + esc(p.tableName) + '</td><td><strong class="' + (p.amount < 0 ? 'terra' : '') + '">' + fmtRp(p.amount) + '</strong></td><td>' + UI().payBadge(p.method) + '</td><td>' + UI().badge(p.status) + '</td><td>' + new Date(p.at).toLocaleString('id-ID') + '</td><td>' + (p.status === 'PAID' ? '<button class="btn-mini" data-print="' + p.orderId + '">' + UI().icon('print', 13) + ' Receipt</button>' : '') + '</td></tr>').join('') : '<tr><td colspan="8">' + UI().emptyState('cash', 'Pembayaran tidak ditemukan', 'Payments will appear here after customers check out.') + '</td></tr>') +
        '</tbody></table></section>';
      root.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { f = b.dataset.f; draw(); }));
      root.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => { const o = DB().order(b.dataset.print); if (o) UI().printReceipt(o, DB().settings()); }));
    }
    draw();
  }
  V.posReceipts = function () {
    const u = staffGuard(['CASHIER', 'ADMIN']); if (!u) return { html: '' };
    return {
      html: '<div class="staff-wrap">' + posTop(u, 'receipts') + '<main class="pos-main"><div id="rc-page"></div></main>' + posFoot() + '</div>',
      mount(el) {
        const root = el.querySelector('#rc-page');
        const paid = DB().orders().filter(o => o.paymentStatus === 'PAID');
        root.innerHTML = '<section class="panel"><div class="panel-head"><h2>Struk</h2><span class="tag">' + paid.length + ' settled</span></div>' +
          '<table class="tbl"><thead><tr><th>Order</th><th>Meja</th><th>Total</th><th>Pembayaran</th><th>Ref</th><th>Time</th><th></th></tr></thead><tbody>' +
          (paid.length ? paid.map(o => '<tr><td><strong>#' + o.number + '</strong></td><td>' + esc(o.tableName) + '</td><td><strong>' + fmtRp(o.total) + '</strong></td><td>' + UI().payBadge(o.paymentMethod, 'PAID') + '</td><td><code>' + esc((o.payments.find(p => p.status === 'PAID') || {}).ref || '-') + '</code></td><td>' + new Date(o.createdAt).toLocaleString('id-ID') + '</td><td><button class="btn-mini" data-print="' + o.id + '">' + UI().icon('print', 13) + ' Print</button></td></tr>').join('') : '<tr><td colspan="7">' + UI().emptyState('receipt', 'Belum ada struk', '') + '</td></tr>') +
          '</tbody></table></section>';
        root.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => UI().printReceipt(DB().order(b.dataset.print), DB().settings())));
      },
      live: true
    };
  };

  /* ================= KITCHEN KDS ================= */
  V.kitchen = function () {
    const u = staffGuard(['KITCHEN', 'ADMIN', 'CASHIER']); if (!u) return { html: '' };
    const orders = DB().orders().filter(o => ['NEW', 'PREPARING', 'READY'].includes(o.orderStatus));
    const col = (status, title, btn) =>
      '<section class="kds-col"><div class="kds-col-head ' + status.toLowerCase() + '"><h2>' + title + '</h2><span class="kds-count">' + orders.filter(o => o.orderStatus === status).length + '</span></div>' +
      '<div class="kds-cards">' + (orders.filter(o => o.orderStatus === status).map(o =>
        '<article class="kds-card"><div class="kds-top"><strong>#' + o.number + '</strong><span class="kds-table">' + esc(o.tableName) + '</span><span class="kds-time">' + ago(o.createdAt) + '</span></div>' +
        '<ul class="kds-items">' + o.items.map(i => '<li><span class="kds-qty">' + i.qty + 'x</span><div><strong>' + esc(i.name) + '</strong>' +
          (i.modifiers.length ? '<small>' + esc(i.modifiers.map(m => m.name).join(' · ')) + '</small>' : '') +
          (i.note ? '<em class="kds-note">' + esc(i.note) + '</em>' : '') + '</div></li>').join('') + '</ul>' +
        (o.note ? '<div class="kds-order-note">' + UI().icon('edit', 13) + ' ' + esc(o.note) + '</div>' : '') +
        '<div class="kds-foot"><span class="muted">' + UI().icon('receipt', 13) + ' ' + o.items.reduce((a, i) => a + i.qty, 0) + ' item · ' + fmtRp(o.total) + '</span>' +
        (btn ? '<button class="btn ' + (status === 'NEW' ? 'btn-dark' : status === 'PREPARING' ? 'btn-terra' : 'btn-olive') + '" data-act="' + status + '" data-id="' + o.id + '">' + btn + '</button>' : '') + '</div></article>'
      ).join('') || '<div class="kds-empty">Tidak ada pesanan</div>') + '</div></section>';
    return {
      html: '<div class="staff-wrap kitchen-wrap">' +
        '<header class="pos-top"><a class="brand-mini" href="#/kitchen"><span class="brand-mark">K</span><span class="brand-word">KURSI<em>LAYAR DAPUR</em></span></a>' +
        '<span class="live-chip"><span class="dot-live"></span> Station 1 · Live · ' + orders.length + ' active tickets</span>' +
        '<div class="pos-user">' + UI().avatar(u.name, 30) + '<div><strong>' + esc(u.name) + '</strong><small>' + esc(u.title) + '</small></div><button class="icon-btn" id="staff-logout" aria-label="Sign out">' + UI().icon('logout', 16) + '</button></div></header>' +
        '<main class="kds">' + col('NEW', 'Pesanan Baru', 'Mulai Proses') + col('PREPARING', 'Preparing', 'Tandai Siap') + col('READY', 'Siap', 'Tandai Diantar') + '</main>' + posFoot() + '</div>',
      mount(el) {
        bindLogout(el);
        el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
          const to = b.dataset.act === 'NEW' ? 'PREPARING' : b.dataset.act === 'PREPARING' ? 'READY' : 'SERVED';
          try { DB().transition(b.dataset.id, to, u); UI().toast('Tiket diperbarui'); rerender(); } catch (e) { toastErr(e); }
        }));
      },
      live: true
    };
  };
})();

/* ============================================================
   KURSI · Admin (sidebar shell + modules)
   ============================================================ */
(function () {
  'use strict';
  const DB = () => window.KursiDB;
  const UI = () => window.KursiUI;
  const esc = (s) => window.KursiUI.esc(s);
  const fmtRp = (n) => window.KursiDB.fmtRp(n);
  const ago = (iso) => window.KursiDB.ago(iso);
  const V = window.Views;
  function rerender() { window.dispatchEvent(new CustomEvent('kursi:rerender')); }
  function toastErr(e) { UI().toast(e.message || String(e), 'err'); }
  function staffGuard(roles) {
    const u = DB().staff();
    if (!u) { setTimeout(() => { location.hash = '#/login'; }, 0); return null; }
    if (!roles.includes(u.role)) { setTimeout(() => { location.hash = u.role === 'KITCHEN' ? '#/kitchen' : u.role === 'ADMIN' ? '#/admin' : '#/pos'; }, 0); return null; }
    return u;
  }

  const NAV = [
    { group: 'Ringkasan', items: [['overview', 'Ringkasan', 'grid', '#/admin']] },
    { group: 'Operations', items: [['pesanan', 'Pesanan', 'receipt', '#/admin/orders'], ['tables', 'Meja & QR', 'qr', '#/admin/tables'], ['kitchen', 'Layar Dapur', 'flame', '#/kitchen']] },
    { group: 'Catalog', items: [['products', 'Produk & Menu', 'coffee', '#/admin/products'], ['categories', 'Kategori', 'list', '#/admin/categories'], ['modifiers', 'Modifikasi', 'settings', '#/admin/modifiers']] },
    { group: 'Business', items: [['inventory', 'Inventaris & Stok', 'box', '#/admin/inventory'], ['customers', 'Pelanggan', 'users', '#/admin/customers'], ['staff', 'Staf & Tim', 'users', '#/admin/staff'], ['payments', 'Pembayaran', 'card', '#/admin/payments'], ['expenses', 'Pengeluaran', 'cash', '#/admin/expenses']] },
    { group: 'Analytics', items: [['reports', 'Laporan', 'chart', '#/admin/reports']] },
    { group: 'System', items: [['audit', 'Riwayat Audit', 'clock', '#/admin/audit'], ['settings', 'Pengaturan', 'settings', '#/admin/settings']] }
  ];
  function adminShell(u, active, title, sub, actionsHtml, bodyHtml, opts) {
    opts = opts || {};
    const d = new Date();
    return '<div class="admin-wrap">' +
      '<aside class="side-nav">' +
      '<a class="brand-mini side-brand" href="#/admin"><span class="brand-mark">K</span><span class="brand-word">KURSI<em>CAFE OS · MASTER</em></span></a>' +
      NAV.map(g => '<div class="nav-group"><span class="nav-group-label">' + g.group + '</span>' + g.items.map(it =>
        '<a class="nav-item ' + (active === it[0] ? 'active' : '') + '" href="' + it[3] + '">' + UI().icon(it[2], 16) + it[1] + '</a>').join('') + '</div>').join('') +
      '<div class="side-foot"><span class="dot-live"></span> POS Terminal Barista #1 &amp; #2 Ready<br><small>99.8% Sync uptime</small></div></aside>' +
      '<div class="admin-body">' +
      '<header class="admin-top glass"><div class="at-branch">' + UI().icon('store', 15) + '<div><strong>' + esc(DB().settings().branch.split('-')[0].trim()) + '</strong><small>' + esc(DB().settings().branch) + '</small></div></div>' +
      '<span class="at-date">' + UI().icon('clock', 14) + ' ' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + '</span>' +
      '<span class="at-sync"><span class="dot-live"></span> Cloud Sync 100% · 3 Active Terminals</span>' +
      '<a class="btn btn-terra sm" href="#/admin/products?new=1">' + UI().icon('plus', 14) + ' New Item</a>' +
      '<div class="pos-user">' + UI().avatar(u.name, 30) + '<div><strong>' + esc(u.name) + '</strong><small>' + esc(u.title) + '</small></div><button class="icon-btn" id="staff-logout" aria-label="Sign out">' + UI().icon('logout', 16) + '</button></div></header>' +
      '<main class="admin-main">' +
      '<div class="admin-head"><div><span class="eyebrow">' + esc(opts.eyebrow || 'KURSI OPERATIONS') + '</span><h1 class="page-title serif">' + title + '</h1>' + (sub ? '<p class="muted">' + sub + '</p>' : '') + '</div><div class="admin-head-actions">' + (actionsHtml || '') + '</div></div>' +
      bodyHtml +
      '</main></div></div>';
  }
  function bindShell(el) { const b = el.querySelector('#staff-logout'); if (b) b.addEventListener('click', () => { DB().logout(); location.hash = '#/login'; }); }

  function statCard(label, value, sub, icn, cls) {
    return '<div class="stat-card"><div class="mc-top"><span class="mc-label">' + label + '</span><span class="mc-icn ' + (cls || '') + '">' + UI().icon(icn, 18) + '</span></div><strong class="stat-value">' + value + '</strong><span class="stat-sub">' + sub + '</span></div>';
  }

  /* ---------- ADMIN: OVERVIEW ---------- */
  V.adminOverview = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    const m = DB().metrics(7);
    const trend = DB().revenueByDay(7);
    const top = DB().topProducts(7, 5);
    const recent = DB().orders().slice(0, 6);
    const low = DB().lowStock();
    return {
      html: adminShell(u, 'overview', 'Pusat Kendali Kafe', 'Detak operasional real-time ' + esc(DB().settings().cafeName) + '.', '',
        '<div class="stat-grid">' +
        statCard('Pendapatan (7 hr)', fmtRp(m.revenue), 'vs periode sebelumnya', 'cash') +
        statCard('Pesanan (7 hr)', m.orders, 'rata-rata ' + fmtRp(m.aov) + ' / pesanan', 'receipt') +
        statCard('Meja Aktif', m.activeTables + ' / ' + DB().tables().length, m.activeOrders + ' pesanan berjalan', 'chair') +
        statCard('Menunggu Dapur', m.pendingKitchen, 'tiket diproses', 'flame', 'terra') +
        '</div>' +
        (low.length ? '<div class="notice-strip"><span class="ns-icn">' + UI().icon('alert', 18) + '</span><span><strong>Stok Menipis:</strong> ' + low.map(i => esc(i.name) + ' (' + i.stock + ' ' + i.unit + ')').join(', ') + '.</span><a class="btn btn-mini ghost" href="#/admin/inventory">Tinjau</a></div>' : '') +
        '<div class="admin-cols">' +
        '<section class="panel"><div class="panel-head"><h2 class="serif">Sales Trend · Last 7 Days</h2><a class="link" href="#/admin/reports">Full reports ' + UI().icon('arrowRight', 13) + '</a></div>' +
        UI().lineChart(trend.map(d => ({ label: d.label, value: d.revenue, title: fmtRp(d.revenue) })), { height: 220 }) +
        '<div class="chart-foot">' + trend.map(d => '<span><b>' + d.orders + '</b> orders<br>' + d.label + '</span>').join('') + '</div></section>' +
        '<section class="panel"><div class="panel-head"><h2 class="serif">Produk Terlaris (7 hr)</h2></div>' +
        (top.length ? top.map((t, i) => '<div class="top-row"><span class="top-rank">' + (i + 1) + '</span><div class="top-body"><strong>' + esc(t.name) + '</strong><small>' + t.qty + ' sold</small></div><span class="top-val">' + fmtRp(t.revenue) + '</span></div>').join('') : UI().emptyState('chart', 'No sales yet', '')) +
        '</section></div>' +
        '<section class="panel"><div class="panel-head"><h2 class="serif">Pesanan Terbaru</h2><a class="link" href="#/admin/orders">View all ' + UI().icon('arrowRight', 13) + '</a></div>' +
        '<table class="tbl"><thead><tr><th>Order</th><th>Meja</th><th>Guest</th><th>Item</th><th>Total</th><th>Pembayaran</th><th>Status</th><th>Time</th></tr></thead><tbody>' +
        recent.map(o => '<tr><td><strong>#' + o.number + '</strong></td><td>' + esc(o.tableName) + '</td><td>' + esc(o.guestName || '-') + '</td><td>' + o.items.reduce((a, i) => a + i.qty, 0) + '</td><td><strong>' + fmtRp(o.total) + '</strong></td><td>' + UI().payBadge(o.paymentMethod, o.paymentStatus) + '</td><td>' + UI().badge(o.orderStatus) + '</td><td>' + ago(o.createdAt) + '</td></tr>').join('') +
        '</tbody></table></section>',
        { eyebrow: 'EXECUTIVE INTELLIGENCE' }),
      mount(el) { bindShell(el); },
      live: true
    };
  };

  /* ---------- ADMIN: ORDERS ---------- */
  V.adminOrders = function (query) {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    return {
      html: adminShell(u, 'pesanan', 'Jurnal Pesanan', 'Every order across the floor · filter, inspect, and manage.', '',
        '<div id="adm-orders"></div>'),
      mount(el) {
        bindShell(el);
        const root = el.querySelector('#adm-orders');
        // reuse cashier orders table in a full-width layout
        root.innerHTML = '<div class="orders-split single"><section class="panel orders-list" id="ol"></section><aside class="panel order-detail" id="od"></aside></div>';
        const params = new URLSearchParams(query || '');
        (function draw() {
          let orders = DB().orders(), filter = 'ALL', search = '', selId = params.get('o');
          function render() {
            let list = orders;
            if (filter !== 'ALL') list = list.filter(o => o.orderStatus === filter || o.paymentStatus === filter);
            if (search) { const t = search.toLowerCase(); list = list.filter(o => ('#' + o.number).includes(t) || o.tableName.toLowerCase().includes(t) || (o.guestName || '').toLowerCase().includes(t)); }
            list = list.slice(0, 60);
            const sel = selId ? DB().order(selId) : null;
            root.querySelector('#ol').innerHTML =
              '<div class="orders-toolbar"><div class="search-bar sm">' + UI().icon('search', 15) + '<input id="aq" placeholder="Cari no. pesanan, meja, tamu..." value="' + esc(search) + '"></div></div>' +
              '<div class="feed-filters">' + ['ALL', 'NEW', 'PREPARING', 'READY', 'COMPLETED', 'PENDING', 'PENDING_PAYMENT', 'CANCELLED'].map(f => '<button class="chip ' + (filter === f ? 'dark' : '') + '" data-f="' + f + '">' + (f === 'ALL' ? 'Semua' : f === 'PENDING_PAYMENT' ? 'Belum Bayar' : f === 'PENDING' ? 'Bayar Tertunda' : f[0] + f.slice(1).toLowerCase()) + '</button>').join('') + '</div>' +
              '<table class="tbl selectable"><thead><tr><th></th><th>Order</th><th>Meja</th><th>Guest</th><th>Total</th><th>Pembayaran</th><th>Status</th><th>Placed</th></tr></thead><tbody>' +
              (list.length ? list.map(o => '<tr class="row-link ' + (sel && sel.id === o.id ? 'selected' : '') + '" data-o="' + o.id + '"><td><span class="radio' + (sel && sel.id === o.id ? ' on' : '') + '"></span></td><td><strong>#' + o.number + '</strong></td><td>' + esc(o.tableName) + '</td><td>' + esc(o.guestName || '-') + '</td><td><strong>' + fmtRp(o.total) + '</strong></td><td>' + UI().payBadge(o.paymentMethod, o.paymentStatus) + '</td><td>' + UI().badge(o.orderStatus) + '</td><td>' + ago(o.createdAt) + '</td></tr>').join('') : '<tr><td colspan="8">' + UI().emptyState('receipt', 'Pesanan tidak ditemukan', '') + '</td></tr>') + '</tbody></table>';
            root.querySelector('#od').innerHTML = sel ? adminOrderDetail(sel) : UI().emptyState('receipt', 'Pilih pesanan', 'Periksa item, pembayaran, dan siklus hidup.');
            root.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render(); }));
            root.querySelectorAll('[data-o]').forEach(r => r.addEventListener('click', () => { selId = r.dataset.o; render(); }));
            const inp = root.querySelector('#aq');
            inp.addEventListener('input', () => { search = inp.value; render(); const i2 = root.querySelector('#aq'); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); });
            bindAdminOd(root.querySelector('#od'), sel, u, render);
          }
          render();
        })();
      },
      live: true
    };
  };
  function adminOrderDetail(o) {
    return '<div class="od-head"><div><h2>Pesanan #' + o.number + '</h2><p class="muted">' + esc(o.tableName) + ' · ' + new Date(o.createdAt).toLocaleString('id-ID') + '</p></div>' + UI().badge(o.orderStatus) + '</div>' +
      (o.guestName ? '<div class="od-meta"><span>' + UI().icon('users', 13) + ' ' + esc(o.guestName) + '</span></div>' : '') +
      (o.note ? '<div class="kitchen-note">' + UI().icon('edit', 14) + ' "' + esc(o.note) + '"</div>' : '') +
      '<div class="od-items">' + o.items.map(i => {
        const p = DB().product(i.productId) || {};
        return '<div class="track-item"><img src="' + esc(p.image || 'assets/iced-latte.png') + '" alt="" class="ci-img"><div class="ci-body"><div class="ci-top"><strong>' + i.qty + 'x ' + esc(i.name) + '</strong><span class="ci-price">' + fmtRp(i.lineTotal) + '</span></div>' +
          (i.modifiers.length ? '<div class="ci-mods">' + esc(i.modifiers.map(m => m.name).join(', ')) + '</div>' : '') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="summary-card"><div class="sum-row"><span>Subtotal</span><span>' + fmtRp(o.subtotal) + '</span></div>' +
      '<div class="sum-row"><span>Pajak &amp; Layanan</span><span>' + fmtRp(o.tax + o.service) + '</span></div>' +
      '<div class="sum-row total"><span>Total</span><span>' + fmtRp(o.total) + '</span></div>' +
      '<div class="pay-line">' + UI().icon('check', 14) + ' ' + esc(o.paymentMethod) + ' · ' + esc(o.paymentStatus) + '</div></div>' +
      '<div class="od-actions"><button class="btn btn-dark" id="ad-print">' + UI().icon('print', 15) + ' Print Receipt</button></div>' +
      '<div class="tl-mini">' + o.timeline.map(t => '<div class="tlm-row"><span class="tag">' + esc(t.status) + '</span><small class="muted">' + new Date(t.at).toLocaleString('id-ID') + '</small></div>').join('') + '</div>';
  }
  function bindAdminOd(el, o, u, redraw) {
    if (!el || !o) return;
    const b = el.querySelector('#ad-print');
    if (b) b.addEventListener('click', () => UI().printReceipt(o, DB().settings()));
  }

  /* ---------- ADMIN: PRODUCTS ---------- */
  V.adminProducts = function (query) {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    const params = new URLSearchParams(query || '');
    return {
      html: adminShell(u, 'products', 'Direktori Menu & Produk', 'Ketersediaan menu real-time, resep dinamis, dan visibilitas QR.',
        '<span class="live-chip"><span class="dot-live"></span> Live POS &amp; Table QR Synced</span>',
        '<div id="prod-page"></div>', { eyebrow: 'CATALOG ARCHITECTURE' }),
      mount(el) {
        bindShell(el);
        const root = el.querySelector('#prod-page');
        let cat = 'all', search = '', selId = null;
        if (params.get('new')) { openProductEditor(null, u, () => rerender()); }
        function draw() {
          const cats = DB().categories();
          let prods = DB().products();
          if (cat !== 'all') prods = prods.filter(p => p.categoryId === cat);
          if (search) { const t = search.toLowerCase(); prods = prods.filter(p => (p.name + p.sku + p.desc).toLowerCase().includes(t)); }
          const sel = selId ? DB().product(selId) : null;
          root.innerHTML = '<div class="orders-split">' +
            '<section class="panel"><div class="orders-toolbar">' +
            '<div class="search-bar sm">' + UI().icon('search', 15) + '<input id="pq" placeholder="Search by item name, SKU, modifier, or recipe ingredient..." value="' + esc(search) + '"></div>' +
            '<button class="btn btn-dark sm" id="p-new">' + UI().icon('plus', 14) + ' New Menu Item</button></div>' +
            '<div class="feed-filters"><button class="chip dark" data-c="all">Semua (' + DB().products().length + ')</button>' + cats.map(c => '<button class="chip" data-c="' + c.id + '">' + esc(c.name) + ' (' + DB().products().filter(p => p.categoryId === c.id).length + ')</button>').join('') + '</div>' +
            '<table class="tbl"><thead><tr><th>Item / Recipe</th><th>Price</th><th>Modifiers</th><th>In-Stock / QR</th><th>Aksi</th></tr></thead><tbody>' +
            (prods.length ? prods.map(p => {
              const c = cats.find(x => x.id === p.categoryId);
              return '<tr class="row-link ' + (sel && sel.id === p.id ? 'selected' : '') + '" data-p="' + p.id + '"><td><div class="cell-prod"><img src="' + esc(p.image) + '" alt=""><div><strong>' + esc(p.name) + '</strong><small>' + esc(c ? c.name : '-') + ' · SKU: ' + esc(p.sku) + '</small></div></div></td>' +
                '<td><strong>' + fmtRp(p.price) + '</strong></td>' +
                '<td><small>' + (p.modifierGroupIds || []).map(gid => { const g = DB().modGroups().find(x => x.id === gid); return g ? g.name : ''; }).filter(Boolean).join(', ') || '-' + '</small></td>' +
                '<td><button class="switch ' + (p.available ? 'on' : '') + '" data-toggle="' + p.id + '" role="switch" aria-checked="' + p.available + '" aria-label="Availability"><span></span></button> <small>' + (p.available ? 'Live' : 'Habis') + '</small></td>' +
                '<td><button class="icon-btn sm" data-edit="' + p.id + '" aria-label="Edit">' + UI().icon('edit', 15) + '</button></td></tr>';
            }).join('') : '<tr><td colspan="5">' + UI().emptyState('coffee', 'Produk tidak ditemukan', 'Coba kata kunci lain atau tambah item baru.') + '</td></tr>') +
            '</tbody></table>' +
            '<div class="panel-foot muted">Menampilkan ' + prods.length + ' dari ' + DB().products().length + ' item katalog · Rekalkulasi biaya resep terakhir: 2 jam lalu</div></section>' +
            '<aside class="panel">' + (sel ? productEditorHtml(sel, u) : '<div class="stat-grid one">' +
              statCard('Item Aktif', DB().products().filter(p => p.available).length + ' SKU', 'di ' + cats.length + ' kategori', 'coffee') +
              statCard('Rata-rata Food Cost', '27.4%', 'sesuai target margin', 'chart') +
              statCard('Tampil di QR', DB().products().filter(p => p.available).length + ' dari ' + DB().products().length, 'di menu QR pelanggan', 'qr') + '</div>') +
            '</aside></div>';
          root.querySelector('#pq').addEventListener('input', e => { search = e.target.value; const pos = e.target.selectionStart; draw(); const i = root.querySelector('#pq'); i.focus(); i.setSelectionRange(pos, pos); });
          root.querySelector('#p-new').addEventListener('click', () => openProductEditor(null, u, draw));
          root.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { cat = b.dataset.c; draw(); }));
          root.querySelectorAll('[data-p]').forEach(r => r.addEventListener('click', e => { if (e.target.closest('[data-toggle]')) return; selId = r.dataset.p; draw(); }));
          root.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openProductEditor(b.dataset.edit, u, draw)));
          root.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async e => {
            e.stopPropagation();
            const p = DB().product(b.dataset.toggle);
            if (p.available && await UI().confirmDlg('Nonaktifkan Produk?', '"' + p.name + '" tidak akan tersedia untuk pesanan baru. Pesanan lama tetap menyimpan snapshot harga.', 'Nonaktifkan', true)) {
              try { DB().toggleProduct(p.id, u); UI().toast(p.name + ' deactivated'); draw(); } catch (err) { toastErr(err); }
            } else if (!p.available) { try { DB().toggleProduct(p.id, u); UI().toast(p.name + ' aktif lagi'); draw(); } catch (err) { toastErr(err); } }
          }));
          if (sel) bindProductEditor(root, sel, u, draw);
        }
        function productEditorHtml(p, u) {
          const cats = DB().categories().filter(c => c.active);
          const groups = DB().modGroups();
          return '<div class="od-head"><div><h2>Active Item Editor</h2><p class="muted">SKU ' + esc(p.sku) + '</p></div></div>' +
            '<div class="pe-photo"><img src="' + esc(p.image) + '" alt=""><span class="pe-photo-tag">Primary dish photo · 1080×1080</span></div>' +
            '<div class="field"><label class="field-label">Nama item (menu & tampilan POS)</label><input class="input" id="pe-name" value="' + esc(p.name) + '"></div>' +
            '<div class="field"><label class="field-label">Catatan rasa (app QR pelanggan)</label><textarea class="input" id="pe-desc" rows="3">' + esc(p.desc) + '</textarea></div>' +
            '<div class="grid-2"><div class="field"><label class="field-label">Harga dasar (IDR)</label><input class="input" id="pe-price" type="number" value="' + p.price + '"></div>' +
            '<div class="field"><label class="field-label">Kategori</label><select class="input" id="pe-cat">' + cats.map(c => '<option value="' + c.id + '"' + (c.id === p.categoryId ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div></div>' +
            '<div class="field"><label class="field-label">Foto produk</label><select class="input" id="pe-img">' + ['iced-latte', 'americano', 'coldbrew', 'bottle', 'matcha', 'chocolate', 'avocado-toast', 'fries', 'pandan-cake', 'cheesecake'].map(a => '<option value="assets/' + a + '.png"' + (p.image === 'assets/' + a + '.png' ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></div>' +
            '<div class="field"><label class="field-label">Matriks modifikasi terpasang</label><div class="check-list">' + groups.map(g =>
              '<label class="check-row"><input type="checkbox" data-mg="' + g.id + '"' + ((p.modifierGroupIds || []).includes(g.id) ? ' checked' : '') + '><span><strong>' + esc(g.name) + '</strong><small>' + g.options.map(o => esc(o.name) + (o.price ? ' (+' + fmtRp(o.price) + ')' : '')).join(', ') + '</small></span><span class="tag">' + (g.required ? 'Wajib' : 'Opsional') + '</span></label>').join('') + '</div></div>' +
            '<div class="grid-2"><label class="check-line"><input type="checkbox" id="pe-avail"' + (p.available ? ' checked' : '') + '> Available</label>' +
            '<label class="check-line"><input type="checkbox" id="pe-feat"' + (p.featured ? ' checked' : '') + '> Featured</label></div>' +
            '<div class="od-actions"><button class="btn btn-ghost" id="pe-discard">Buang</button><button class="btn btn-dark" id="pe-save">' + UI().icon('check', 15) + ' Save &amp; Push to POS</button></div>';
        }
        function bindProductEditor(root, p, u, done) {
          const q = s => root.querySelector(s);
          q('#pe-save').addEventListener('click', () => {
            try {
              DB().saveProduct({
                id: p.id, name: q('#pe-name').value, desc: q('#pe-desc').value, price: q('#pe-price').value,
                categoryId: q('#pe-cat').value, image: q('#pe-img').value, available: q('#pe-avail').checked,
                featured: q('#pe-feat').checked,
                modifierGroupIds: Array.from(root.querySelectorAll('[data-mg]:checked')).map(x => x.dataset.mg)
              }, u);
              UI().toast('Produk tersimpan & terkirim ke POS'); done();
            } catch (e) { toastErr(e); }
          });
          q('#pe-discard').addEventListener('click', done);
        }
        function openProductEditor(id, u, done) {
          const p = id ? DB().product(id) : null;
          const cats = DB().categories().filter(c => c.active);
          const groups = DB().modGroups();
          UI().modal({
            title: p ? 'Edit · ' + p.name : 'Item Menu Baru', wide: true,
            body: '<div class="grid-2">' +
              '<div class="field"><label class="field-label">Item title *</label><input class="input" id="np-name" value="' + esc(p ? p.name : '') + '"></div>' +
              '<div class="field"><label class="field-label">Price (IDR) *</label><input class="input" id="np-price" type="number" value="' + (p ? p.price : '') + '"></div></div>' +
              '<div class="field"><label class="field-label">Deskripsi</label><textarea class="input" id="np-desc" rows="2">' + esc(p ? p.desc : '') + '</textarea></div>' +
              '<div class="grid-2"><div class="field"><label class="field-label">Kategori</label><select class="input" id="np-cat">' + cats.map(c => '<option value="' + c.id + '"' + (p && p.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' +
              '<div class="field"><label class="field-label">Image</label><select class="input" id="np-img">' + ['iced-latte', 'americano', 'coldbrew', 'bottle', 'matcha', 'chocolate', 'avocado-toast', 'fries', 'pandan-cake', 'cheesecake'].map(a => '<option value="assets/' + a + '.png"' + (p && p.image === 'assets/' + a + '.png' ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></div></div>' +
              '<div class="field"><label class="field-label">Modifier groups</label><div class="check-list">' + groups.map(g => '<label class="check-row"><input type="checkbox" data-nmg="' + g.id + '"' + (p && (p.modifierGroupIds || []).includes(g.id) ? ' checked' : '') + '><span><strong>' + esc(g.name) + '</strong></span></label>').join('') + '</div></div>' +
              '<div class="grid-2"><label class="check-line"><input type="checkbox" id="np-avail"' + (!p || p.available ? ' checked' : '') + '> Available</label><label class="check-line"><input type="checkbox" id="np-feat"' + (p && p.featured ? ' checked' : '') + '> Featured</label></div>',
            footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-dark" id="np-save">Simpan &amp; Kirim ke POS</button>',
            onMount(m, close) {
              m.querySelector('#np-save').addEventListener('click', () => {
                try {
                  DB().saveProduct({
                    id: p ? p.id : undefined, name: m.querySelector('#np-name').value, price: m.querySelector('#np-price').value,
                    desc: m.querySelector('#np-desc').value, categoryId: m.querySelector('#np-cat').value, image: m.querySelector('#np-img').value,
                    available: m.querySelector('#np-avail').checked, featured: m.querySelector('#np-feat').checked,
                    modifierGroupIds: Array.from(m.querySelectorAll('[data-nmg]:checked')).map(x => x.dataset.nmg)
                  }, u);
                  close(); UI().toast('Produk tersimpan'); done();
                } catch (e) { toastErr(e); }
              });
            }
          });
        }
        draw();
      },
      live: true
    };
  };

  /* ---------- ADMIN: CATEGORIES ---------- */
  V.adminCategories = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    return {
      html: adminShell(u, 'categories', 'Kategori Menu', 'Buat, urutkan, dan aktifkan kategori menu.', '<button class="btn btn-dark sm" id="cat-new">' + UI().icon('plus', 14) + ' New Category</button>', '<div id="cat-page"></div>'),
      mount(el) {
        bindShell(el);
        el.querySelector('#cat-new').addEventListener('click', () => catEditor(null));
        const root = el.querySelector('#cat-page');
        function draw() {
          const cats = DB().categories();
          root.innerHTML = '<section class="panel"><table class="tbl"><thead><tr><th>Kategori</th><th>Produk</th><th>Urutan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
            cats.map((c, i) => '<tr><td><strong>' + esc(c.name) + '</strong></td><td>' + DB().products().filter(p => p.categoryId === c.id).length + ' items</td>' +
              '<td><button class="icon-btn sm" data-up="' + c.id + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">' + UI().icon('back', 14) + '</button> <button class="icon-btn sm" data-down="' + c.id + '"' + (i === cats.length - 1 ? ' disabled' : '') + ' aria-label="Move down">' + UI().icon('arrowRight', 14) + '</button></td>' +
              '<td><button class="switch ' + (c.active ? 'on' : '') + '" data-t="' + c.id + '" role="switch"><span></span></button> <small>' + (c.active ? 'Aktif' : 'Disembunyikan') + '</small></td>' +
              '<td><button class="icon-btn sm" data-e="' + c.id + '" aria-label="Edit">' + UI().icon('edit', 15) + '</button></td></tr>').join('') +
            '</tbody></table></section>';
          root.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => { DB().moveCategory(b.dataset.up, -1, u); draw(); }));
          root.querySelectorAll('[data-down]').forEach(b => b.addEventListener('click', () => { DB().moveCategory(b.dataset.down, 1, u); draw(); }));
          root.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
            const c = DB().categories().find(x => x.id === b.dataset.t);
            try { DB().saveCategory({ id: c.id, name: c.name, active: !c.active }, u); draw(); } catch (e) { toastErr(e); }
          }));
          root.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => catEditor(b.dataset.e)));
        }
        function catEditor(id) {
          const c = id ? DB().categories().find(x => x.id === id) : null;
          UI().modal({
            title: c ? 'Ubah Kategori' : 'Kategori Baru',
            body: '<div class="field"><label class="field-label">Nama *</label><input class="input" id="ce-name" value="' + esc(c ? c.name : '') + '"></div><label class="check-line"><input type="checkbox" id="ce-active"' + (!c || c.active ? ' checked' : '') + '> Active on menu</label>',
            footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-dark" id="ce-save">Simpan Kategori</button>',
            onMount(m, close) {
              m.querySelector('#ce-save').addEventListener('click', () => {
                try { DB().saveCategory({ id: c ? c.id : undefined, name: m.querySelector('#ce-name').value, active: m.querySelector('#ce-active').checked }, u); close(); UI().toast('Kategori tersimpan'); draw(); } catch (e) { toastErr(e); }
              });
            }
          });
        }
        draw();
      }
    };
  };

  /* ---------- ADMIN: MODIFIERS ---------- */
  V.adminModifiers = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    return {
      html: adminShell(u, 'modifiers', 'Grup Modifikasi', 'Milk options, sugar levels, extras · attached to menu items.', '<button class="btn btn-dark sm" id="mg-new">' + UI().icon('plus', 14) + ' New Group</button>', '<div id="mg-page"></div>'),
      mount(el) {
        bindShell(el);
        el.querySelector('#mg-new').addEventListener('click', () => mgEditor(null));
        const root = el.querySelector('#mg-page');
        function draw() {
          const groups = DB().modGroups();
          root.innerHTML = '<div class="card-grid">' + groups.map(g =>
            '<section class="panel mg-card"><div class="panel-head"><h3>' + esc(g.name) + '</h3><span class="tag">' + (g.required ? 'Wajib' : 'Opsional') + ' · pick ' + (g.maxSel > 1 ? 'up to ' + g.maxSel : '1') + '</span></div>' +
            '<table class="tbl sm"><tbody>' + g.options.map(o => '<tr><td>' + esc(o.name) + '</td><td class="r">' + (o.price ? '+' + fmtRp(o.price) : 'Included') + '</td></tr>').join('') + '</tbody></table>' +
            '<div class="panel-foot"><small class="muted">Used by ' + DB().products().filter(p => (p.modifierGroupIds || []).includes(g.id)).length + ' items</small><button class="btn-mini" data-e="' + g.id + '">' + UI().icon('edit', 13) + ' Edit</button></div></section>').join('') + '</div>';
          root.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => mgEditor(b.dataset.e)));
        }
        function mgEditor(id) {
          const g = id ? DB().modGroups().find(x => x.id === id) : null;
          let opts = g ? g.options.map(o => Object.assign({}, o)) : [{ id: '', name: '', price: 0 }];
          UI().modal({
            title: g ? 'Edit · ' + g.name : 'Grup Modifikasi Baru', wide: true,
            body: '<div class="grid-2"><div class="field"><label class="field-label">Nama grup *</label><input class="input" id="ge-name" value="' + esc(g ? g.name : '') + '"></div>' +
              '<div class="field"><label class="field-label">Aturan pilihan</label><select class="input" id="ge-rule"><option value="single"' + (g && g.maxSel === 1 ? ' selected' : '') + '>Pilihan tunggal (pilih 1)</option><option value="multi"' + (g && g.maxSel > 1 ? ' selected' : '') + '>Pilihan ganda</option></select></div></div>' +
              '<label class="check-line"><input type="checkbox" id="ge-req"' + (g && g.required ? ' checked' : '') + '> Required group</label>' +
              '<div class="field"><label class="field-label">Opsi</label><div id="ge-opts">' + opts.map((o, i) =>
                '<div class="opt-row"><input class="input" data-oname="' + i + '" placeholder="Option name" value="' + esc(o.name) + '"><input class="input" data-oprice="' + i + '" type="number" placeholder="Extra price (IDR)" value="' + o.price + '"><button class="icon-btn sm" data-odel="' + i + '" aria-label="Remove">' + UI().icon('trash', 14) + '</button></div>').join('') + '</div>' +
              '<button class="btn btn-ghost sm" id="ge-add">+ Add option</button></div>',
            footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-dark" id="ge-save">Simpan Grup</button>',
            onMount(m, close) {
              const box = m.querySelector('#ge-opts');
              function reindex() {
                box.querySelectorAll('.opt-row').forEach((row, i) => {
                  row.querySelector('[data-oname]').dataset.oname = i;
                  row.querySelector('[data-oprice]').dataset.oprice = i;
                  row.querySelector('[data-odel]').dataset.odel = i;
                });
              }
              box.addEventListener('click', e => {
                const del = e.target.closest('[data-odel]');
                if (del && box.querySelectorAll('.opt-row').length > 1) { del.closest('.opt-row').remove(); reindex(); }
              });
              m.querySelector('#ge-add').addEventListener('click', () => {
                box.insertAdjacentHTML('beforeend', '<div class="opt-row"><input class="input" data-oname="" placeholder="Option name"><input class="input" data-oprice="" type="number" placeholder="Extra price (IDR)" value="0"><button class="icon-btn sm" data-odel="" aria-label="Remove">' + UI().icon('trash', 14) + '</button></div>');
                reindex();
              });
              m.querySelector('#ge-save').addEventListener('click', () => {
                const options = Array.from(box.querySelectorAll('.opt-row')).map(row => ({ name: row.querySelector('[data-oname]').value, price: row.querySelector('[data-oprice]').value }));
                try {
                  DB().saveModGroup({ id: g ? g.id : undefined, name: m.querySelector('#ge-name').value, required: m.querySelector('#ge-req').checked, maxSel: m.querySelector('#ge-rule').value === 'multi' ? 3 : 1, options }, u);
                  close(); UI().toast('Grup modifikasi tersimpan'); draw();
                } catch (e) { toastErr(e); }
              });
            }
          });
        }
        draw();
      }
    };
  };

  /* ---------- ADMIN: INVENTORY ---------- */
  V.adminInventory = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    return {
      html: adminShell(u, 'inventory', 'Bahan & Stok', 'Pantau par real-time, pengiriman roaster, dan peringatan stok menipis.', '<button class="btn btn-dark sm" id="inv-new">' + UI().icon('plus', 14) + ' Receive Batch PO</button>', '<div id="inv-page"></div>', { eyebrow: 'INVENTORY INTELLIGENCE' }),
      mount(el) {
        bindShell(el);
        el.querySelector('#inv-new').addEventListener('click', () => invEditor(null));
        const root = el.querySelector('#inv-page');
        let search = '';
        function draw() {
          let items = DB().inventory();
          if (search) { const t = search.toLowerCase(); items = items.filter(i => (i.name + i.category).toLowerCase().includes(t)); }
          const low = DB().lowStock();
          root.innerHTML =
            '<div class="stat-grid">' +
            statCard('SKU Terpantau', DB().inventory().length, '100% aktif', 'box') +
            statCard('Peringatan Stok Menipis', String(low.length), low.length ? 'item perlu reorder' : 'semua aman', 'alert', low.length ? 'terra' : '') +
            statCard('Valuasi Stok', fmtRp(DB().inventory().reduce((s, i) => s + i.stock * 42000, 0)), 'estimasi dasar COGS', 'cash') +
            '</div>' +
            (low.length ? '<div class="notice-strip"><span class="ns-icn">' + UI().icon('alert', 18) + '</span><span><strong>' + low.length + ' Restock Actions Urgent:</strong> ' + low.map(i => esc(i.name) + ' di ' + i.stock + ' ' + i.unit + ' (min ' + i.minStock + ')').join('; ') + '.</span></div>' : '') +
            '<section class="panel"><div class="orders-toolbar"><div class="search-bar sm">' + UI().icon('search', 15) + '<input id="iq" placeholder="Filter ingredients..." value="' + esc(search) + '"></div></div>' +
            '<table class="tbl"><thead><tr><th>Bahan &amp; Asal</th><th>Kategori</th><th>Stok Saat Ini</th><th>Par Minimum</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
            (items.length ? items.map(i => {
              const isLow = i.stock <= i.minStock;
              return '<tr><td><strong>' + esc(i.name) + '</strong></td><td><span class="tag">' + esc(i.category) + '</span></td><td><strong>' + i.stock + ' ' + esc(i.unit) + '</strong></td><td>' + i.minStock + ' ' + esc(i.unit) + '</td>' +
                '<td>' + (isLow ? '<span class="badge badge-warn">Low</span>' : '<span class="badge badge-ok">OK</span>') + '</td>' +
                '<td><button class="btn-mini" data-rest="' + i.id + '">Restock</button> <button class="icon-btn sm" data-e="' + i.id + '" aria-label="Edit">' + UI().icon('edit', 15) + '</button></td></tr>';
            }).join('') : '<tr><td colspan="6">' + UI().emptyState('box', 'Bahan tidak ditemukan', '') + '</td></tr>') +
            '</tbody></table></section>';
          root.querySelector('#iq').addEventListener('input', e => { search = e.target.value; const pos = e.target.selectionStart; draw(); const i = root.querySelector('#iq'); i.focus(); i.setSelectionRange(pos, pos); });
          root.querySelectorAll('[data-rest]').forEach(b => b.addEventListener('click', () => {
            const it = DB().inventory().find(x => x.id === b.dataset.rest);
            UI().modal({
              title: 'Restock · ' + it.name,
              body: '<div class="field"><label class="field-label">Receive quantity (' + esc(it.unit) + ')</label><input class="input" id="rs-qty" type="number" value="' + Math.max(it.minStock * 2 - it.stock, 1) + '"></div>',
              footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="rs-go">Receive Batch</button>',
              onMount(m, close) {
                m.querySelector('#rs-go').addEventListener('click', () => {
                  try { DB().restock(it.id, Number(m.querySelector('#rs-qty').value), u); close(); UI().toast('Stok diterima'); draw(); } catch (e) { toastErr(e); }
                });
              }
            });
          }));
          root.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => invEditor(b.dataset.e)));
        }
        function invEditor(id) {
          const it = id ? DB().inventory().find(x => x.id === id) : null;
          UI().modal({
            title: it ? 'Edit · ' + it.name : 'Bahan Baru',
            body: '<div class="field"><label class="field-label">Nama *</label><input class="input" id="ie-name" value="' + esc(it ? it.name : '') + '"></div>' +
              '<div class="grid-2"><div class="field"><label class="field-label">Kategori</label><input class="input" id="ie-cat" value="' + esc(it ? it.category : 'Roasted Beans') + '"></div>' +
              '<div class="field"><label class="field-label">Unit</label><input class="input" id="ie-unit" value="' + esc(it ? it.unit : 'kg') + '"></div></div>' +
              '<div class="grid-2"><div class="field"><label class="field-label">Stok saat ini *</label><input class="input" id="ie-stock" type="number" step="0.1" value="' + (it ? it.stock : '') + '"></div>' +
              '<div class="field"><label class="field-label">Par minimum</label><input class="input" id="ie-min" type="number" step="0.1" value="' + (it ? it.minStock : 1) + '"></div></div>',
            footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-dark" id="ie-save">Simpan Bahan</button>',
            onMount(m, close) {
              m.querySelector('#ie-save').addEventListener('click', () => {
                try { DB().saveInventory({ id: it ? it.id : undefined, name: m.querySelector('#ie-name').value, category: m.querySelector('#ie-cat').value, unit: m.querySelector('#ie-unit').value, stock: m.querySelector('#ie-stock').value, minStock: m.querySelector('#ie-min').value }, u); close(); UI().toast('Bahan tersimpan'); draw(); } catch (e) { toastErr(e); }
              });
            }
          });
        }
        draw();
      },
      live: true
    };
  };

  /* ---------- ADMIN: TABLES & QR ---------- */
  V.adminTables = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    return {
      html: adminShell(u, 'tables', 'Penempatan Meja dan QR', 'Kelola endpoint pemesanan, token menu digital, dan tanda meja.', '<button class="btn btn-dark sm" id="tb-new">' + UI().icon('plus', 14) + ' Tambah Meja</button>', '<div id="tb-page"></div>', { eyebrow: 'ORKESTRASI MEJA' }),
      mount(el) {
        bindShell(el);
        el.querySelector('#tb-new').addEventListener('click', () => tbEditor(null));
        const root = el.querySelector('#tb-page');
        function draw() {
          const tables = DB().tables();
          root.innerHTML = '<div class="stat-grid">' +
            statCard('Total Terkonfigurasi', tables.length, '100% endpoint aktif', 'qr') +
            statCard('Sesi Aktif', tables.filter(t => DB().tableStatus(t).key !== 'AVAILABLE').length, 'pelanggan memesan', 'users') +
            statCard('Total Scan', tables.reduce((s, t) => s + t.scans, 0), 'scan QR seluruh masa', 'chart') + '</div>' +
            '<div class="orders-toolbar"><div class="field" style="flex:1;margin:0"><label class="field-label">Alamat dasar QR (untuk discan HP / production)</label><input class="input" id="qr-base" value="' + esc(UI().qrBase()) + '"></div><button class="btn btn-dark sm" id="qr-base-save">Simpan</button></div>' +
            '<div class="card-grid">' + tables.map(t => {
              const st = DB().tableStatus(t);
              const url = UI().qrBase() + '#/t/' + t.code;
              return '<section class="panel tb-card"><div class="panel-head"><div><h3>' + esc(t.name) + '</h3><small class="muted">' + esc(t.zone) + ' · ' + t.seats + ' kursi · ' + esc(t.code) + '</small></div><span class="badge badge-' + st.cls + '">' + esc(st.label) + '</span></div>' +
                '<div class="tb-qr-row"><div class="tb-qr">' + UI().qrImg(url, 110, 'QR for ' + t.name) + '</div>' +
                '<div class="tb-meta"><span class="mg-rule">URL ROUTER DINAMIS</span><code>kursi.id/t/' + esc(t.code.toLowerCase()) + '</code>' +
                '<div class="tb-stats"><span><b>' + t.scans + '</b> scans</span><span><b>' + DB().orders().filter(o => o.tableId === t.id).length + '</b> orders</span></div>' +
                (st.order ? '<span class="tag tag-terra">Sesi #' + st.order.number + '</span>' : '<span class="tag tag-olive">Siaga</span>') + '</div></div>' +
                '<div class="panel-foot"><button class="btn-mini" data-prev="' + t.id + '">Pratinjau Cetak</button><button class="btn-mini" data-rot="' + t.id + '">' + UI().icon('rotate', 13) + ' Rotate Token</button><button class="btn-mini" data-e="' + t.id + '">' + UI().icon('edit', 13) + '</button></div></section>';
            }).join('') + '</div>';
          root.querySelectorAll('[data-prev]').forEach(b => b.addEventListener('click', () => {
            const t = DB().table(b.dataset.prev);
            const url = UI().qrBase() + '#/t/' + t.code;
            UI().modal({
              title: 'Print Stand Preview · ' + t.name,
              body: '<div class="print-stand"><div class="ps-brand"><span class="brand-mark">K</span><div><strong>KURSI BALI</strong><small>SPECIALTY COFFEE &amp; KITCHEN</small></div></div><div class="ps-table">' + esc(t.name) + '</div>' + UI().qrImg(url, 170, 'QR') + '<p class="ps-sub">Scan untuk lihat menu &amp; pesan<br>Bayar di meja · Langsung ke dapur</p><span class="ps-token">TOKEN · ' + esc(t.code) + '</span></div>',
              footer: '<button class="btn btn-ghost" data-close>Tutup</button><button class="btn btn-ghost" id="ps-download">' + UI().icon('download', 14) + ' Unduh PNG</button><button class="btn btn-dark" onclick="window.print()">' + UI().icon('print', 14) + ' Cetak</button>',
              onMount(m) {
                const btn = m.querySelector('#ps-download');
                if (btn) btn.addEventListener('click', () => {
                  const svg = m.querySelector('.print-stand svg');
                  if (!svg) { UI().toast('QR dari server eksternal — gunakan tombol Cetak', 'err'); return; }
                  const img = new Image();
                  img.onload = () => {
                    const scale = 4;
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width * scale; canvas.height = img.height * scale;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const a = document.createElement('a');
                    a.download = 'kursi-qr-' + t.name.replace(/\s+/g, '-').toLowerCase() + '.png';
                    a.href = canvas.toDataURL('image/png');
                    a.click();
                    UI().toast('QR ' + t.name + ' terunduh');
                  };
                  img.onerror = () => UI().toast('Gagal mengunduh QR', 'err');
                  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
                });
              }
            });
          }));
          root.querySelectorAll('[data-rot]').forEach(b => b.addEventListener('click', async () => {
            if (await UI().confirmDlg('Putar Token QR?', 'QR lama untuk meja ini langsung tidak berlaku. Token baru otomatis berlaku harian.', 'Putar Token')) {
              try { DB().regenerateTableCode(b.dataset.rot, u); UI().toast('Token diputar'); draw(); } catch (e) { toastErr(e); }
            }
          }));
          root.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => tbEditor(b.dataset.e)));
          const qb = root.querySelector('#qr-base-save');
          if (qb) qb.addEventListener('click', () => {
            localStorage.setItem('kursi_qr_base', root.querySelector('#qr-base').value.trim().replace(/\/+$/, ''));
            UI().toast('Alamat dasar QR disimpan');
            draw();
          });
        }
        function tbEditor(id) {
          const t = id ? DB().table(id) : null;
          UI().modal({
            title: t ? 'Edit · ' + t.name : 'Meja Baru',
            body: '<div class="grid-2"><div class="field"><label class="field-label">Nama meja *</label><input class="input" id="te-name" value="' + esc(t ? t.name : '') + '"></div>' +
              '<div class="field"><label class="field-label">Kursi</label><input class="input" id="te-seats" type="number" value="' + (t ? t.seats : 2) + '"></div></div>' +
              '<div class="field"><label class="field-label">Zona</label><select class="input" id="te-zone">' + ['Main Dining Hall', 'Garden Patio', 'Travertine Bar'].map(z => '<option' + (t && t.zone === z ? ' selected' : '') + '>' + z + '</option>').join('') + '</select></div>' +
              (t ? '<label class="check-line"><input type="checkbox" id="te-active"' + (t.active ? ' checked' : '') + '> Table active</label>' : ''),
            footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-dark" id="te-save">Simpan Meja</button>',
            onMount(m, close) {
              m.querySelector('#te-save').addEventListener('click', () => {
                try { DB().saveTable({ id: t ? t.id : undefined, name: m.querySelector('#te-name').value, seats: m.querySelector('#te-seats').value, zone: m.querySelector('#te-zone').value, active: t ? m.querySelector('#te-active').checked : true }, u); close(); UI().toast('Meja tersimpan'); draw(); } catch (e) { toastErr(e); }
              });
            }
          });
        }
        draw();
      },
      live: true
    };
  };

  /* ---------- ADMIN: STAFF ---------- */
  V.adminStaff = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    return {
      html: adminShell(u, 'staff', 'Staf & Tim', 'Roles: ADMIN, CASHIER, KITCHEN · permissions enforced at the action level.', '<button class="btn btn-dark sm" id="st-new">' + UI().icon('plus', 14) + ' Add Staff</button>', '<div id="st-page"></div>'),
      mount(el) {
        bindShell(el);
        el.querySelector('#st-new').addEventListener('click', () => stEditor(null));
        const root = el.querySelector('#st-page');
        function draw() {
          root.innerHTML = '<section class="panel"><table class="tbl"><thead><tr><th>Staf</th><th>Peran</th><th>Title</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
            DB().users().map(x => '<tr><td><div class="cell-prod">' + UI().avatar(x.name, 34) + '<div><strong>' + esc(x.name) + '</strong><small>' + esc(x.email) + '</small></div></div></td>' +
              '<td><span class="tag ' + (x.role === 'ADMIN' ? 'tag-terra' : x.role === 'CASHIER' ? 'tag-olive' : '') + '">' + esc(x.role) + '</span></td><td>' + esc(x.title || '-') + '</td>' +
              '<td>' + (x.active ? '<span class="badge badge-ok">Aktif</span>' : '<span class="badge badge-muted">Nonaktif</span>') + '</td>' +
              '<td><button class="icon-btn sm" data-e="' + x.id + '" aria-label="Edit">' + UI().icon('edit', 15) + '</button></td></tr>').join('') +
            '</tbody></table></section>';
          root.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => stEditor(b.dataset.e)));
        }
        function stEditor(id) {
          const x = id ? DB().users().find(z => z.id === id) : null;
          UI().modal({
            title: x ? 'Edit · ' + x.name : 'New Staff Member',
            body: '<div class="grid-2"><div class="field"><label class="field-label">Nama lengkap *</label><input class="input" id="se-name" value="' + esc(x ? x.name : '') + '"></div>' +
              '<div class="field"><label class="field-label">Email *</label><input class="input" id="se-email" value="' + esc(x ? x.email : '') + '"></div></div>' +
              '<div class="grid-2"><div class="field"><label class="field-label">Peran</label><select class="input" id="se-role">' + ['ADMIN', 'CASHIER', 'KITCHEN'].map(r => '<option' + (x && x.role === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>' +
              '<div class="field"><label class="field-label">Jabatan</label><input class="input" id="se-title" value="' + esc(x ? x.title || '' : '') + '" placeholder="e.g. Cashier POS 01"></div></div>' +
              '<div class="field"><label class="field-label">' + (x ? 'Password baru (kosongkan bila tetap)' : 'Password * (min 6 karakter)') + '</label><input class="input" id="se-pass" type="password"></div>' +
              (x ? '<label class="check-line"><input type="checkbox" id="se-active"' + (x.active ? ' checked' : '') + '> Account active</label>' : ''),
            footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-dark" id="se-save">Simpan Staf</button>',
            onMount(m, close) {
              m.querySelector('#se-save').addEventListener('click', () => {
                try { DB().saveUser({ id: x ? x.id : undefined, name: m.querySelector('#se-name').value, email: m.querySelector('#se-email').value, role: m.querySelector('#se-role').value, title: m.querySelector('#se-title').value, password: m.querySelector('#se-pass').value || undefined, active: x ? m.querySelector('#se-active').checked : true }, u); close(); UI().toast('Staf tersimpan'); draw(); } catch (e) { toastErr(e); }
              });
            }
          });
        }
        draw();
      }
    };
  };

  /* ---------- ADMIN: CUSTOMERS ---------- */
  V.adminCustomers = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    const customers = DB().customers();
    return {
      html: adminShell(u, 'customers', 'Direktori Pelanggan', 'Guests are recognized by the names they optionally provide · no forced accounts.', '', '<section class="panel"><table class="tbl"><thead><tr><th>Pelanggan</th><th>Pesanan</th><th>Total Belanja</th><th>Pesanan Terakhir</th></tr></thead><tbody>' +
        (customers.length ? customers.map(c => '<tr><td><div class="cell-prod">' + UI().avatar(c.name, 34) + '<strong>' + esc(c.name) + '</strong></div></td><td>' + c.orders + '</td><td><strong>' + fmtRp(c.spend) + '</strong></td><td>' + window.KursiDB.ago(c.last) + '</td></tr>').join('') : '<tr><td colspan="4">' + UI().emptyState('users', 'Belum ada pelanggan', 'Insight pelanggan muncul setelah ada pesanan.') + '</td></tr>') +
        '</tbody></table></section>'),
      mount(el) { bindShell(el); }
    };
  };

  /* ---------- ADMIN: PAYMENTS ---------- */
  V.adminPayments = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    return {
      html: adminShell(u, 'payments', 'Kasir & Pembayaran', 'Semua catatan pembayaran: QRIS, E-Wallet, Kartu, dan Tunai.', '', '<div id="ap-page"></div>'),
      mount(el) {
        bindShell(el);
        const root = el.querySelector('#ap-page');
        let f = 'ALL';
        function draw() {
          let pays = DB().paymentsList();
          if (f !== 'ALL') pays = pays.filter(p => p.status === f);
          const methods = DB().paymentsByMethod(30);
          const max = Math.max(1, ...methods.map(m => m.amount));
          root.innerHTML = '<div class="admin-cols"><section class="panel"><div class="panel-head"><h2 class="serif">Payment Methods · 30d</h2></div>' +
            methods.map(m => UI().barRow(m.method === 'EWALLET' ? 'E-Wallet' : m.method[0] + m.method.slice(1).toLowerCase(), m.amount, max)).join('') + '</section>' +
            '<section class="panel"><div class="panel-head"><h2 class="serif">Status Pembayaran</h2></div>' +
            ['PAID', 'PENDING', 'FAILED', 'REFUNDED'].map(s => { const n = DB().paymentsList().filter(p => p.status === s).length; return '<div class="sum-row"><span>' + s[0] + s.slice(1).toLowerCase() + '</span><span><b>' + n + '</b></span></div>'; }).join('') +
            '<div class="sum-row total"><span>Total Processed</span><span>' + fmtRp(DB().paymentsList().filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)) + '</span></div></section></div>' +
            '<section class="panel"><div class="feed-filters">' + ['ALL', 'PAID', 'PENDING', 'FAILED', 'REFUNDED'].map(x => '<button class="chip ' + (f === x ? 'dark' : '') + '" data-f="' + x + '">' + (x === 'ALL' ? 'Semua' : x[0] + x.slice(1).toLowerCase()) + '</button>').join('') + '</div>' +
            '<table class="tbl"><thead><tr><th>Ref</th><th>Order</th><th>Nominal</th><th>Method</th><th>Status</th><th>Time</th></tr></thead><tbody>' +
            (pays.length ? pays.slice(0, 50).map(p => '<tr><td><code>' + esc(p.ref) + '</code></td><td>#' + p.orderNumber + '</td><td><strong>' + fmtRp(p.amount) + '</strong></td><td>' + UI().payBadge(p.method) + '</td><td>' + UI().badge(p.status) + '</td><td>' + new Date(p.at).toLocaleString('id-ID') + '</td></tr>').join('') : '<tr><td colspan="6">' + UI().emptyState('cash', 'Pembayaran tidak ditemukan', '') + '</td></tr>') + '</tbody></table></section>';
          root.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { f = b.dataset.f; draw(); }));
        }
        draw();
      },
      live: true
    };
  };

  /* ---------- ADMIN: EXPENSES ---------- */
  V.adminExpenses = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    return {
      html: adminShell(u, 'expenses', 'Pengeluaran Bisnis', 'Catat biaya operasional untuk melihat performa bersih.', '<button class="btn btn-dark sm" id="ex-new">' + UI().icon('plus', 14) + ' Record Expense</button>', '<div id="ex-page"></div>'),
      mount(el) {
        bindShell(el);
        el.querySelector('#ex-new').addEventListener('click', () => exEditor());
        const root = el.querySelector('#ex-page');
        function draw() {
          const ex = DB().expenses().slice().sort((a, b) => new Date(b.date) - new Date(a.date));
          const total = ex.reduce((s, e) => s + e.amount, 0);
          const byCat = {};
          ex.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + e.amount);
          const max = Math.max(1, ...Object.values(byCat));
          root.innerHTML = '<div class="admin-cols"><section class="panel"><div class="panel-head"><h2 class="serif">Per Kategori</h2></div>' +
            Object.entries(byCat).map(([c, v]) => UI().barRow(c, v, max)).join('') + '</section>' +
            '<section class="panel"><div class="panel-head"><h2 class="serif">Total (tercatat)</h2></div><strong class="stat-value">' + fmtRp(total) + '</strong><p class="muted">Across ' + ex.length + ' expense records</p></section></div>' +
            '<section class="panel"><table class="tbl"><thead><tr><th>Deskripsi</th><th>Kategori</th><th>Nominal</th><th>Tanggal</th><th>Catatan</th><th></th></tr></thead><tbody>' +
            (ex.length ? ex.map(e => '<tr><td><strong>' + esc(e.desc) + '</strong></td><td><span class="tag">' + esc(e.category) + '</span></td><td><strong>' + fmtRp(e.amount) + '</strong></td><td>' + esc(e.date) + '</td><td class="muted">' + esc(e.note || '-') + '</td><td><button class="icon-btn sm" data-del="' + e.id + '" aria-label="Delete">' + UI().icon('trash', 15) + '</button></td></tr>').join('') : '<tr><td colspan="6">' + UI().emptyState('cash', 'Belum ada pengeluaran tercatat', 'Catat listrik, bahan, peralatan, dan lainnya.') + '</td></tr>') + '</tbody></table></section>';
          root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
            if (await UI().confirmDlg('Hapus Pengeluaran?', 'Catatan pengeluaran ini akan dihapus.', 'Hapus', true)) { try { DB().removeExpense(b.dataset.del, u); UI().toast('Pengeluaran dihapus'); draw(); } catch (e) { toastErr(e); } }
          }));
        }
        function exEditor() {
          UI().modal({
            title: 'Catat Pengeluaran',
            body: '<div class="field"><label class="field-label">Deskripsi *</label><input class="input" id="xe-desc" placeholder="e.g. Electricity bill"></div>' +
              '<div class="grid-2"><div class="field"><label class="field-label">Kategori</label><select class="input" id="xe-cat">' + ['Operational', 'Ingredient Purchase', 'Equipment', 'Other'].map(c => '<option>' + c + '</option>').join('') + '</select></div>' +
              '<div class="field"><label class="field-label">Nominal (IDR) *</label><input class="input" id="xe-amt" type="number"></div></div>' +
              '<div class="grid-2"><div class="field"><label class="field-label">Tanggal</label><input class="input" id="xe-date" type="date" value="' + window.KursiDB.todayKey() + '"></div>' +
              '<div class="field"><label class="field-label">Catatan</label><input class="input" id="xe-note"></div></div>',
            footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-dark" id="xe-save">Simpan Pengeluaran</button>',
            onMount(m, close) {
              m.querySelector('#xe-save').addEventListener('click', () => {
                try { DB().saveExpense({ desc: m.querySelector('#xe-desc').value, category: m.querySelector('#xe-cat').value, amount: m.querySelector('#xe-amt').value, date: m.querySelector('#xe-date').value, note: m.querySelector('#xe-note').value }, u); close(); UI().toast('Pengeluaran tercatat'); draw(); } catch (e) { toastErr(e); }
              });
            }
          });
        }
        draw();
      }
    };
  };

  /* ---------- ADMIN: REPORTS ---------- */
  V.adminReports = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    return {
      html: adminShell(u, 'reports', 'Penjualan & Performa', 'Pendapatan, komposisi produk, metode bayar, dan pengeluaran.', '<div class="range-chips" id="range-chips"><button class="chip" data-r="1">Today</button><button class="chip dark" data-r="7">7 Days</button><button class="chip" data-r="30">30 Days</button></div>', '<div id="rp-page"></div>', { eyebrow: 'EXECUTIVE INTELLIGENCE' }),
      mount(el) {
        bindShell(el);
        const root = el.querySelector('#rp-page');
        let range = 7;
        function draw() {
          const m = DB().metrics(range);
          const trend = DB().revenueByDay(range);
          const cats = DB().revenueByCategory(range);
          const pays = DB().paymentsByMethod(range);
          const top = DB().topProducts(range, 5);
          const catMax = Math.max(1, ...cats.map(c => c.revenue));
          const payTotal = pays.reduce((s, p) => s + p.amount, 0) || 1;
          root.innerHTML =
            '<div class="stat-grid">' +
            statCard('Pendapatan Kotor', fmtRp(m.revenue), 'di rentang terpilih', 'cash') +
            statCard('Pesanan Selesai', m.orders, 'paid & settled', 'receipt') +
            statCard('Rata-rata Nilai Pesanan', fmtRp(m.aov), 'per transaction', 'chart') +
            statCard('Pengeluaran', fmtRp(m.expense), 'bersih ≈ ' + fmtRp(m.revenue - m.expense), 'box') +
            '</div>' +
            '<div class="admin-cols">' +
            '<section class="panel"><div class="panel-head"><h2 class="serif">Irama Pendapatan Harian</h2></div>' +
            UI().lineChart(trend.map(d => ({ label: d.label, value: d.revenue, title: fmtRp(d.revenue) })), { height: 240 }) +
            '<div class="chart-foot">' + trend.map(d => '<span><b>' + d.orders + '</b> orders<br>' + d.label + '</span>').join('') + '</div></section>' +
            '<div><section class="panel"><div class="panel-head"><h2 class="serif">Pendapatan per Kategori</h2></div>' +
            (cats.length ? cats.map(c => UI().barRow(c.name, c.revenue, catMax)).join('') : '<p class="muted">No data in range.</p>') + '</section>' +
            '<section class="panel" style="margin-top:16px"><div class="panel-head"><h2 class="serif">Metode Pembayaran</h2></div>' +
            (pays.length ? pays.map(p => '<div class="sum-row"><span>' + (p.method === 'EWALLET' ? 'E-Wallet' : p.method[0] + p.method.slice(1).toLowerCase()) + '</span><span><b>' + fmtRp(p.amount) + '</b> <small class="muted">(' + Math.round(p.amount / payTotal * 100) + '%)</small></span></div>').join('') : '<p class="muted">No payments in range.</p>') + '</section></div></div>' +
            '<section class="panel"><div class="panel-head"><h2 class="serif">Item Paling Laris</h2></div>' +
            '<table class="tbl"><thead><tr><th>#</th><th>Item</th><th>Qty Terjual</th><th>Pendapatan</th></tr></thead><tbody>' +
            (top.length ? top.map((t, i) => '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(t.name) + '</strong></td><td>' + t.qty + '</td><td><strong>' + fmtRp(t.revenue) + '</strong></td></tr>').join('') : '<tr><td colspan="4">' + UI().emptyState('chart', 'Tidak ada penjualan di rentang ini', '') + '</td></tr>') + '</tbody></table></section>';
        }
        el.querySelectorAll('#range-chips .chip').forEach(b => b.addEventListener('click', () => {
          el.querySelectorAll('#range-chips .chip').forEach(x => x.classList.remove('dark'));
          b.classList.add('dark'); range = +b.dataset.r; draw();
        }));
        draw();
      }
    };
  };

  /* ---------- ADMIN: AUDIT ---------- */
  V.adminAudit = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    const log = DB().audit().slice(0, 80);
    return {
      html: adminShell(u, 'audit', 'Riwayat Audit', 'Timestamps for every important business action.', '', '<section class="panel"><table class="tbl"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead><tbody>' +
        (log.length ? log.map(l => '<tr><td>' + new Date(l.at).toLocaleString('id-ID') + '</td><td>' + esc(l.actor) + '</td><td><span class="tag">' + esc(l.action) + '</span></td><td class="muted">' + esc(l.detail) + '</td></tr>').join('') : '<tr><td colspan="4">' + UI().emptyState('clock', 'Belum ada aktivitas', '') + '</td></tr>') + '</tbody></table></section>'),
      mount(el) { bindShell(el); }
    };
  };

  /* ---------- ADMIN: SETTINGS ---------- */
  V.adminSettings = function () {
    const u = staffGuard(['ADMIN']); if (!u) return { html: '' };
    const s = DB().settings();
    return {
      html: adminShell(u, 'settings', 'Pengaturan Kafe', 'Branding, konfigurasi pajak &amp; layanan untuk seluruh sistem.', '',
        '<div class="admin-cols"><section class="panel"><div class="panel-head"><h2 class="serif">Umum</h2></div>' +
        '<div class="field"><label class="field-label">Nama kafe</label><input class="input" id="set-name" value="' + esc(s.cafeName) + '"></div>' +
        '<div class="field"><label class="field-label">Cabang</label><input class="input" id="set-branch" value="' + esc(s.branch) + '"></div>' +
        '<div class="field"><label class="field-label">SSID Wi-Fi tamu (tampil di menu)</label><input class="input" id="set-wifi" value="' + esc(s.wifi) + '"></div></section>' +
        '<section class="panel"><div class="panel-head"><h2 class="serif">Pajak &amp; Layanan</h2></div>' +
        '<div class="grid-2"><div class="field"><label class="field-label">Tarif pajak (PB1)</label><input class="input" id="set-tax" type="number" step="0.01" value="' + s.taxRate + '"></div>' +
        '<div class="field"><label class="field-label">Tarif biaya layanan</label><input class="input" id="set-svc" type="number" step="0.01" value="' + s.serviceRate + '"></div></div>' +
        '<p class="muted small">Berlaku untuk pesanan baru. Pesanan lama tetap menyimpan nominal tercatat.</p></section></div>' +
        '<section class="panel" style="margin-top:16px;max-width:520px"><div class="panel-head"><h2 class="serif">Sinkronisasi Backend (Supabase)</h2>' + (window.KursiBackend && window.KursiBackend.configured() ? '<span class="tag tag-olive">LIVE</span>' : '<span class="tag">OFF</span>') + '</div>' +
        '<div class="field"><label class="field-label">URL Supabase</label><input class="input" id="be-url" placeholder="https://xyz.supabase.co" value="' + esc((window.KursiBackend && window.KursiBackend.config && window.KursiBackend.config.url) || '') + '"></div>' +
        '<div class="field"><label class="field-label">Anon key</label><input class="input" id="be-key" placeholder="eyJhbGciOi..." value="' + esc((window.KursiBackend && window.KursiBackend.config && window.KursiBackend.config.key) || '') + '"></div>' +
        '<label class="check-line"><input type="checkbox" id="be-enabled"' + (window.KursiBackend && window.KursiBackend.configured() ? ' checked' : '') + '> Enable multi-device sync</label>' +
        '<div class="od-actions"><button class="btn btn-ghost" id="be-test">Tes Koneksi</button><button class="btn btn-dark" id="be-save">Simpan Konfigurasi</button></div>' +
        '<p class="muted small" style="margin-top:10px">Tabel <code>kursi_state</code> harus sudah dibuat · jalankan SQL dari komentar atas <code>js/backend.js</code> di Supabase SQL Editor.</p></section>' +
        '<section class="panel" style="margin-top:16px;max-width:520px"><div class="panel-head"><h2 class="serif">Data Demo</h2></div><p class="muted small">Kembalikan seluruh data (pesanan, pembayaran, produk, stok) ke kondisi awal. Berguna sebelum demo.</p><div class="od-actions"><button class="btn btn-ghost danger" id="adm-reset">' + UI().icon('rotate', 15) + ' Reset Data Demo</button></div></section>' +
        '<div class="od-actions" style="max-width:520px"><button class="btn btn-dark" id="set-save">' + UI().icon('check', 15) + ' Save Settings</button></div>'),
      mount(el) {
        bindShell(el);
        el.querySelector('#set-save').addEventListener('click', () => {
          try {
            DB().saveSettings({ cafeName: el.querySelector('#set-name').value, branch: el.querySelector('#set-branch').value, wifi: el.querySelector('#set-wifi').value, taxRate: el.querySelector('#set-tax').value, serviceRate: el.querySelector('#set-svc').value }, u);
            UI().toast('Settings saved'); rerender();
          } catch (e) { toastErr(e); }
        });
        const be = window.KursiBackend;
        const rb = el.querySelector('#adm-reset');
        if (rb) rb.addEventListener('click', async () => {
          if (await UI().confirmDlg('Reset Data Demo?', 'Semua pesanan, pembayaran, dan perubahan akan dikembalikan ke data seed awal.', 'Reset Data', true)) {
            DB().reset();
            UI().toast('Data demo dipulihkan');
            rerender();
          }
        });
        if (el.querySelector('#be-save')) {
          el.querySelector('#be-save').addEventListener('click', () => {
            be.saveConfig({ url: el.querySelector('#be-url').value.trim(), key: el.querySelector('#be-key').value.trim(), enabled: el.querySelector('#be-enabled').checked });
            UI().toast('Backend config saved · muat ulang halaman');
          });
          el.querySelector('#be-test').addEventListener('click', async () => {
            try { await be.test(); UI().toast('Supabase terkoneksi ✓'); } catch (e) { toastErr(e); }
          });
        }
      }
    };
  };
})();
