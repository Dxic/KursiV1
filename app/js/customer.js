/* ============================================================
   KURSI · Customer app (mobile-first)
   #/t/:code            welcome
   #/t/:code/menu       menu
   #/t/:code/p/:id      product detail + modifiers
   #/t/:code/cart       cart + checkout + payment method
   #/t/:code/pay/:id    simulated payment
   #/t/:code/track/:id  order tracking (live)
   #/t/:code/cashier/:id  pay-at-cashier pending screen
   ============================================================ */
(function () {
  'use strict';
  const DB = () => window.KursiDB;
  const UI = () => window.KursiUI;
  const esc = (s) => window.KursiUI.esc(s);
  const fmtRp = (n) => window.KursiDB ? window.KursiDB.fmtRp(n) : 'Rp ' + n;
  window.Views = window.Views || {};

  function ctx(code) {
    const table = DB().tableByCode(code);
    return { code, table, settings: DB().settings() };
  }
  function guard(c) {
    if (!c.table) {
      return '<div class="cust-wrap"><div class="empty-state" style="margin-top:20vh">' + UI().icon('alert', 34) + '<h4>Meja tidak valid</h4><p class="muted">QR code ini tidak cocok dengan meja aktif.<br>Silakan scan ulang kode di meja Anda.</p></div></div>';
    }
    return null;
  }
  function custHeader(c, title, opts) {
    opts = opts || {};
    const count = DB().cart(c.code).reduce((s, i) => s + i.qty, 0);
    return '<header class="cust-top glass">' +
      '<a class="brand-mini" href="#/t/' + c.code + '/menu"><span class="brand-mark">K</span><span class="brand-word">KURSI<em>' + (title ? ' · ' + esc(title) : '') + '</em></span></a>' +
      '<div class="cust-top-right">' +
      '<span class="table-chip">' + UI().icon('chair', 13) + ' ' + esc(c.table.name) + '</span>' +
      '<a class="icon-btn" href="#/t/' + c.code + '/menu?focus=1" aria-label="Search">' + UI().icon('search', 17) + '</a>' +
      '<a class="icon-btn dark" href="#/t/' + c.code + '/cart" aria-label="Cart">' + UI().icon('cart', 17) + (count ? '<span class="bubble">' + count + '</span>' : '') + '</a>' +
      '</div></header>';
  }
  function bottomNav(c, active) {
    const item = (key, icn, label, href) =>
      '<a class="bn-item ' + (active === key ? 'active' : '') + '" href="' + href + '">' + UI().icon(icn, 20) + '<span>' + label + '</span></a>';
    return '<nav class="bottom-nav glass">' +
      item('menu', 'home', 'Menu', '#/t/' + c.code + '/menu') +
      item('cart', 'cart', 'Pesanan Saya', '#/t/' + c.code + '/cart') +
      item('track', 'timer', 'Lacak', '#/t/' + c.code + '/track') +
      '</nav>';
  }
  function cartBar(c) {
    const items = DB().cart(c.code);
    if (!items.length) return '';
    let total = 0;
    try { total = DB().computeCart(c.code).total; } catch (e) { total = 0; }
    const count = items.reduce((s, i) => s + i.qty, 0);
    return '<a class="cart-bar" href="#/t/' + c.code + '/cart"><span class="cb-left">' + UI().icon('cart', 18) + '<b>' + count + '</b> item di pesanan <span class="cb-total">' + fmtRp(total) + '</span></span><span class="cb-cta">Lihat Pesanan ' + UI().icon('arrowRight', 16) + '</span></a>';
  }

  /* ================= WELCOME ================= */
  window.Views.welcome = function (code) {
    const c = ctx(code);
    const g = guard(c); if (g) return { html: g };
    const s = c.settings;
    return {
      html: '<div class="cust-wrap welcome">' +
        '<div class="welcome-hero" style="background-image:url(assets/avocado-toast.png)">' +
        '<div class="welcome-overlay">' +
        '<div class="brand-lockup"><span class="brand-mark lg">K</span><h1>KURSI</h1></div>' +
        '<p class="tagline">' + esc(s.tagline) + '</p>' +
        '</div></div>' +
        '<div class="welcome-body">' +
        '<div class="table-hero glass"><span class="th-label">Anda duduk di</span><span class="th-name">' + esc(c.table.name) + '</span><span class="th-zone">' + esc(c.table.zone) + ' · ' + c.table.seats + ' kursi</span></div>' +
        '<h2 class="welcome-title">Selamat datang di ' + esc(s.cafeName) + '</h2>' +
        '<p class="muted">Telusuri menu dan pesan langsung dari meja Anda. Makanan dan minuman disiapkan segar dan diantar ke sini · tanpa perlu pelayan.</p>' +
        '<ul class="welcome-points">' +
        '<li>' + UI().icon('qr', 16) + ' Cukup scan sekali · meja Anda otomatis terhubung</li>' +
        '<li>' + UI().icon('flame', 16) + ' Atur minuman sesuai selera Anda</li>' +
        '<li>' + UI().icon('timer', 16) + ' Pantau pesanan Anda secara langsung dari dapur</li>' +
        '</ul>' +
        '<a class="btn btn-primary btn-lg btn-block" href="#/t/' + c.code + '/menu">Lihat Menu ' + UI().icon('arrowRight', 18) + '</a>' +
        '<p class="welcome-foot">' + esc(s.branch) + '</p>' +
        '</div></div>'
    };
  };

  /* ================= MENU ================= */
  window.Views.menu = function (code, query) {
    const c = ctx(code);
    const g = guard(c); if (g) return { html: g };
    const params = new URLSearchParams(query || '');
    const s = c.settings;
    const cats = DB().categories().filter(x => x.active);
    const products = DB().products().filter(p => p.available !== false || true);
    const featured = products.filter(p => p.featured && p.available);
    const seasonal = products.find(p => p.id === 'p_pourover') || featured[0];

    return {
      html: '<div class="cust-wrap has-bn">' +
        custHeader(c, 'Menu') +
        '<div class="menu-subhead"><span class="dot-live"></span><div><strong>Makan di Tempat · ' + esc(c.table.name) + '</strong><span class="muted">Pesan langsung · Diantar ke kursi Anda</span></div><span class="wifi-chip">' + UI().icon('wifi', 13) + ' ' + esc(s.wifi) + '</span></div>' +
        '<div class="search-bar" id="menu-search">' + UI().icon('search', 17) + '<input id="menu-q" type="search" placeholder="Cari kopi, brunch, dessert..." autocomplete="off"></div>' +
        '<div class="cat-scroll" id="cat-scroll">' +
        '<button class="cat-chip active" data-cat="all">Semua Item</button>' +
        cats.map(cat => '<button class="cat-chip" data-cat="' + cat.id + '">' + esc(cat.name) + '</button>').join('') +
        '</div>' +
        (seasonal ? '<a class="seasonal-card" href="#/t/' + c.code + '/p/' + seasonal.id + '">' +
          '<span class="sc-flag">' + UI().icon('star', 12) + ' SANGAI MUSIMAN</span>' +
          '<h3>Flores Bajawa Pour Over &amp; Gula Aren Latte</h3>' +
          '<p>Light floral jasmine notes paired with smoky palm nectar, sourced from local smallholders in East Nusa Tenggara.</p>' +
          '<span class="sc-cta">Mulai dari ' + fmtRp(seasonal.price) + ' · Lihat Detail ' + UI().icon('arrowRight', 14) + '</span></a>' : '') +
        '<div class="menu-list" id="menu-list"></div>' +
        cartBar(c) +
        bottomNav(c, 'menu') +
        '</div>',
      mount(el) {
        const list = el.querySelector('#menu-list');
        const q = el.querySelector('#menu-q');
        let activeCat = 'all';
        function renderList() {
          const term = (q.value || '').toLowerCase().trim();
          let items = DB().products();
          if (activeCat !== 'all') items = items.filter(p => p.categoryId === activeCat);
          if (term) items = items.filter(p => (p.name + ' ' + p.desc).toLowerCase().includes(term));
          if (!items.length) { list.innerHTML = UI().emptyState('search', 'Tidak ada item ditemukan', 'Coba kata kunci atau kategori lain.'); return; }
          list.innerHTML = items.map(p => {
            const tags = [p.featured ? '<span class="tag tag-olive">Favorit</span>' : '', !p.available ? '<span class="tag tag-red">Habis</span>' : ''].join('');
            return '<article class="prod-card ' + (!p.available ? 'soldout' : '') + '">' +
              '<a class="pc-img" href="#/t/' + c.code + '/p/' + p.id + '"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy"></a>' +
              '<div class="pc-body"><div class="pc-top"><a class="pc-name" href="#/t/' + c.code + '/p/' + p.id + '">' + esc(p.name) + '</a>' + tags + '</div>' +
              '<p class="pc-desc">' + esc(p.desc) + '</p>' +
              '<div class="pc-foot"><span class="pc-price">' + fmtRp(p.price) + '</span>' +
              (p.available ? '<button class="add-btn" data-add="' + p.id + '" aria-label="Tambah ' + esc(p.name) + '">' + UI().icon('plus', 18) + '</button>' : '<span class="pc-na">Tidak Tersedia</span>') +
              '</div></div></article>';
          }).join('');
          list.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
            const p = DB().product(b.dataset.add);
            if (!p.available) { UI().toast('Item ini sedang tidak tersedia', 'err'); return; }
            addToCart(c.code, p.id);
          }));
        }
        el.querySelectorAll('.cat-chip').forEach(ch => ch.addEventListener('click', () => {
          el.querySelectorAll('.cat-chip').forEach(x => x.classList.remove('active'));
          ch.classList.add('active'); activeCat = ch.dataset.cat; renderList();
        }));
        q.addEventListener('input', renderList);
        if (params.get('focus')) setTimeout(() => q.focus(), 100);
        renderList();
      }
    };
  };

  function addToCart(code, productId, fullItem) {
    const cart = DB().cart(code);
    if (fullItem) {
      cart.push(fullItem);
    } else {
      const p = DB().product(productId);
      const simple = !(p.modifierGroupIds || []).length;
      if (!simple) { location.hash = '#/t/' + code + '/p/' + productId; return; }
      const ex = cart.find(i => i.productId === productId && !i.mods.length && !i.note);
      if (ex) ex.qty++; else cart.push({ productId, qty: 1, mods: [], note: '' });
    }
    DB().saveCart(code, cart);
    UI().toast('Ditambahkan ke pesanan');
    rerender();
  }

  /* ================= PRODUCT DETAIL ================= */
  window.Views.product = function (code, id) {
    const c = ctx(code);
    const g = guard(c); if (g) return { html: g };
    const p = DB().product(id);
    if (!p) return { html: '<div class="cust-wrap">' + custHeader(c, 'Item') + UI().emptyState('alert', 'Item tidak ditemukan', 'Item ini mungkin sudah dihapus.') + '</div>' };
    const groups = (p.modifierGroupIds || []).map(gid => DB().modGroups().find(m => m.id === gid)).filter(Boolean);
    return {
      html: '<div class="cust-wrap has-cta">' +
        '<header class="cust-top glass"><a class="icon-btn" href="#/t/' + c.code + '/menu" aria-label="Back">' + UI().icon('back', 18) + '</a><span class="top-title">Detail Item</span><span class="table-chip">' + UI().icon('chair', 13) + ' ' + esc(c.table.name) + '</span></header>' +
        '<div class="pd-img"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' + (p.featured ? '<span class="pd-flag">' + UI().icon('star', 11) + ' Andalan Kami</span>' : '') + '</div>' +
        '<div class="pd-body">' +
        '<div class="pd-head"><h1>' + esc(p.name) + '</h1><span class="pd-price">' + fmtRp(p.price) + '</span></div>' +
        '<p class="muted">' + esc(p.desc) + '</p>' +
        '<div class="pd-chips"><span>' + UI().icon('coffee', 13) + ' Disiapkan segar</span><span>' + UI().icon('check', 13) + ' Cek kualitas</span><span>' + UI().icon('clock', 13) + ' 5–12 menit</span></div>' +
        groups.map(gr =>
          '<section class="mod-group" data-group="' + gr.id + '" data-required="' + (gr.required ? 1 : 0) + '" data-max="' + gr.maxSel + '">' +
          '<div class="mg-head"><h3>' + esc(gr.name) + '</h3><span class="mg-rule">' + (gr.required ? 'Wajib · ' : '') + (gr.maxSel > 1 ? 'Pilih maks. ' + gr.maxSel : 'Pilih 1') + '</span></div>' +
          '<div class="mg-opts">' + gr.options.map((o, idx) => {
            const pre = gr.required && idx === 0 && gr.maxSel === 1;
            return '<button class="mg-opt' + (pre ? ' selected' : '') + '" data-opt="' + o.id + '"><span class="mg-name">' + esc(o.name) + '</span><span class="mg-price">' + (o.price ? '+' + fmtRp(o.price) : 'Termasuk') + '</span><span class="mg-radio"></span></button>';
          }).join('') + '</div></section>'
        ).join('') +
        '<section class="mod-group"><div class="mg-head"><h3>Instruksi Khusus</h3><span class="mg-rule">Opsional</span></div>' +
        '<textarea id="pd-note" class="input" rows="2" placeholder="mis. napkin tambahan, gelas terpisah, sensitif panas..."></textarea></section>' +
        '</div>' +
        '<div class="pd-cta glass">' +
        '<div class="qty"><button id="q-minus" aria-label="Kurangi">' + UI().icon('minus', 16) + '</button><span id="q-val">1</span><button id="q-plus" aria-label="Tambah">' + UI().icon('plus', 16) + '</button></div>' +
        '<button class="btn btn-dark btn-lg" id="pd-add" ' + (!p.available ? 'disabled' : '') + '>' + (p.available ? 'Tambah ke Pesanan <span id="pd-total">' + fmtRp(p.price) + '</span>' : 'Tidak Tersedia') + '</button>' +
        '</div></div>',
      mount(el) {
        let qty = 1;
        const qv = el.querySelector('#q-val');
        function currentUnit() {
          let unit = p.price;
          el.querySelectorAll('.mod-group').forEach(grEl => {
            grEl.querySelectorAll('.mg-opt.selected').forEach(oEl => {
              const gid = grEl.dataset.group;
              const g = groups.find(x => x.id === gid);
              const o = g.options.find(x => x.id === oEl.dataset.opt);
              unit += o.price;
            });
          });
          return unit;
        }
        function refresh() {
          qv.textContent = qty;
          const t = el.querySelector('#pd-total'); if (t) t.textContent = fmtRp(currentUnit() * qty);
        }
        el.querySelector('#q-minus').addEventListener('click', () => { if (qty > 1) { qty--; refresh(); } });
        el.querySelector('#q-plus').addEventListener('click', () => { if (qty < 20) { qty++; refresh(); } });
        el.querySelectorAll('.mod-group[data-group]').forEach(grEl => {
          const max = +grEl.dataset.max || 1;
          grEl.querySelectorAll('.mg-opt').forEach(oEl => oEl.addEventListener('click', () => {
            if (max === 1) grEl.querySelectorAll('.mg-opt').forEach(x => x.classList.remove('selected'));
            const sel = grEl.querySelectorAll('.mg-opt.selected').length;
            if (!oEl.classList.contains('selected') && sel >= max) { UI().toast('Maksimal pilih ' + max + ' untuk ini', 'err'); return; }
            oEl.classList.toggle('selected');
            refresh();
          }));
        });
        refresh();
        el.querySelector('#pd-add').addEventListener('click', () => {
          for (const grEl of el.querySelectorAll('.mod-group[data-required="1"]')) {
            if (!grEl.querySelector('.mg-opt.selected')) { UI().toast('Silakan pilih ' + grEl.querySelector('h3').textContent + ' dulu', 'err'); grEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
          }
          const mods = [];
          el.querySelectorAll('.mod-group[data-group]').forEach(grEl => {
            grEl.querySelectorAll('.mg-opt.selected').forEach(oEl => mods.push({ groupId: grEl.dataset.group, optionId: oEl.dataset.opt }));
          });
          addToCart(c.code, null, { productId: p.id, qty, mods, note: el.querySelector('#pd-note').value.trim() });
          location.hash = '#/t/' + c.code + '/menu';
        });
      }
    };
  };

  /* ================= CART / CHECKOUT ================= */
  window.Views.cart = function (code) {
    const c = ctx(code);
    const g = guard(c); if (g) return { html: g };
    const s = c.settings;
    return {
      html: '<div class="cust-wrap has-bn">' +
        custHeader(c, 'Pesanan Saya') +
        '<div class="cart-body" id="cart-body"></div>' +
        bottomNav(c, 'cart') +
        '</div>',
      mount(el) { renderCartBody(c, s, el.querySelector('#cart-body')); }
    };
  };

  function renderCartBody(c, s, body) {
    let calc;
    try { calc = DB().computeCart(c.code); } catch (e) {
      body.innerHTML = UI().emptyState('cart', 'Keranjang tidak tersedia', e.message, '<a class="btn btn-ghost" href="#/t/' + c.code + '/menu">Kembali ke menu</a>');
      return;
    }
    if (!calc.lines.length) {
      body.innerHTML = UI().emptyState('cart', 'Pesanan Anda masih kosong', 'Telusuri menu dan tambahkan sesuatu yang lezat.', '<a class="btn btn-primary" href="#/t/' + c.code + '/menu">Lihat Menu</a>');
      return;
    }
    const methods = [
      { id: 'QRIS', icn: 'qr', name: 'QRIS', tag: 'Tercepat', sub: 'QR instan via BCA, Mandiri, GoPay, DANA' },
      { id: 'XENDIT', icn: 'qr', name: 'QRIS Live (Sandbox)', tag: 'Gateway', sub: 'QRIS asli via Xendit - mode uji, uang tidak sungguhan' },
      { id: 'EWALLET', icn: 'wallet', name: 'E-Wallet', sub: 'GoPay, OVO, ShopeePay direct deep-link' },
      { id: 'CARD', icn: 'card', name: 'Kartu Debit / Kredit', sub: 'Visa, Mastercard, JCB, American Express' },
      { id: 'CASH', icn: 'cash', name: 'Bayar di Kasir', sub: 'Bayar tunai atau EDC di kasir' }
    ];
    body.innerHTML =
      '<div class="dinein-note"><span>' + UI().icon('store', 16) + '</span><div><strong>' + esc(c.table.name) + ' · Makan di Tempat</strong><span>Disiapkan segar saat dipesan. Diantar langsung ke meja Anda.</span></div></div>' +
      '<div class="cart-head"><h2>Item Dipilih (' + calc.lines.reduce((a, l) => a + l.qty, 0) + ')</h2><a class="link" href="#/t/' + c.code + '/menu">+ Tambah item</a></div>' +
      calc.lines.map((l, i) => {
        const mods = l.modifiers.map(m => m.name + (m.price ? ' (+' + fmtRp(m.price) + ')' : '')).join(', ');
        return '<div class="cart-item">' +
          '<img src="' + esc((DB().product(l.productId) || {}).image || 'assets/iced-latte.png') + '" alt="" class="ci-img">' +
          '<div class="ci-body"><div class="ci-top"><span class="ci-name">' + esc(l.name) + '</span><span class="ci-price">' + fmtRp(l.lineTotal) + '</span></div>' +
          (mods ? '<div class="ci-mods">' + esc(mods) + '</div>' : '') +
          (l.note ? '<div class="ci-mods note">"' + esc(l.note) + '"</div>' : '') +
          '<div class="ci-foot"><button class="btn-mini" data-edit="' + i + '">' + UI().icon('edit', 13) + ' Ubah opsi</button>' +
          '<span class="qty sm"><button data-dec="' + i + '" aria-label="Kurangi">' + UI().icon('minus', 14) + '</button><span>' + l.qty + '</span><button data-inc="' + i + '" aria-label="Tambah">' + UI().icon('plus', 14) + '</button></span>' +
          '<button class="icon-btn sm" data-del="' + i + '" aria-label="Hapus">' + UI().icon('trash', 15) + '</button></div></div></div>';
      }).join('') +
      '<div class="summary-card glass"><div class="sum-head">' + UI().icon('slip', 16) + ' Ringkasan Pembayaran <span class="muted">· ' + esc(c.table.name) + '</span></div>' +
      '<div class="sum-row"><span>Subtotal</span><span>' + fmtRp(calc.subtotal) + '</span></div>' +
      '<div class="sum-row"><span>' + esc(s.taxLabel) + '</span><span>' + fmtRp(calc.tax) + '</span></div>' +
      '<div class="sum-row"><span>' + esc(s.serviceLabel) + '</span><span>' + fmtRp(calc.service) + '</span></div>' +
      '<div class="sum-row total"><span>Total Tagihan</span><span>' + fmtRp(calc.total) + '</span></div>' +
      '<div class="sum-note">Termasuk semua pajak &amp; layanan</div></div>' +
      '<h3 class="sec-title">Pilih Metode Pembayaran <span class="mg-rule">' + UI().icon('flame', 12) + ' Konfirmasi Instan</span></h3>' +
      '<div class="pay-methods">' + methods.map((m, i) =>
        '<button class="pay-method' + (i === 0 ? ' selected' : '') + '" data-method="' + m.id + '"><span class="pm-icn">' + UI().icon(m.icn, 20) + '</span><span class="pm-txt"><strong>' + m.name + (m.tag ? ' <span class="tag tag-terra">' + m.tag + '</span>' : '') + '</strong><small>' + m.sub + '</small></span><span class="pm-check">' + UI().icon('check', 15) + '</span></button>'
      ).join('') + '</div>' +
      '<div class="field"><label class="field-label">Nama Anda <span class="muted">(opsional)</span></label><input class="input" id="co-name" placeholder="Biar barista bisa menyapa Anda" maxlength="60"></div>' +
      '<div class="field"><label class="field-label">Catatan dapur <span class="muted">(opsional)</span></label><textarea class="input" id="co-note" rows="2" placeholder="mis. tolong kopi dulu, info alergi..." maxlength="300"></textarea></div>' +
      '<p class="eco-line">' + UI().icon('check', 14) + ' Kemasan ramah lingkungan &amp; biji kopi etis</p>' +
      '<div class="conn-line"><span><span class="dot-live"></span> ' + esc(c.table.name) + ' Terhubung</span><span>Otomatis terkirim ke Barista</span></div>' +
      '<div class="sticky-cta">' +
      '<button class="btn btn-dark btn-lg btn-block" id="place-order">' + UI().icon('lock', 16) + ' Pesan &amp; Bayar <b>' + fmtRp(calc.total) + '</b></button>' +
      '</div>';

    const cart = DB().cart(c.code);
    body.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => { cart[+b.dataset.inc].qty = Math.min(20, cart[+b.dataset.inc].qty + 1); DB().saveCart(c.code, cart); renderCartBody(c, s, body); }));
    body.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => {
      const it = cart[+b.dataset.dec];
      it.qty > 1 ? it.qty-- : cart.splice(+b.dataset.dec, 1);
      DB().saveCart(c.code, cart); renderCartBody(c, s, body);
    }));
    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { cart.splice(+b.dataset.del, 1); DB().saveCart(c.code, cart); renderCartBody(c, s, body); UI().toast('Item dihapus'); }));
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
      const idx = +b.dataset.edit;
      const it = cart[idx];
      const p = DB().product(it.productId);
      UI().modal({
        title: 'Edit · ' + p.name,
        body: '<p class="muted" style="margin-top:0">Untuk mengubah opsi, hapus item ini lalu tambahkan ulang dari menu.</p>',
        footer: '<button class="btn btn-ghost" data-close>Biarkan</button><button class="btn btn-danger" id="edit-rm">Hapus item</button>',
        onMount(elm, close) {
          elm.querySelector('#edit-rm').addEventListener('click', () => { cart.splice(idx, 1); DB().saveCart(c.code, cart); close(); renderCartBody(c, s, body); UI().toast('Item dihapus'); });
        }
      });
    }));
    let method = 'QRIS';
    body.querySelectorAll('.pay-method').forEach(b => b.addEventListener('click', () => {
      body.querySelectorAll('.pay-method').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected'); method = b.dataset.method;
    }));
    body.querySelector('#place-order').addEventListener('click', () => {
      const btn = body.querySelector('#place-order');
      btn.disabled = true; btn.innerHTML = UI().icon('clock', 16) + ' Mengirim ke dapur...';
      try {
        const gateway = method === 'XENDIT';
        const o = DB().createOrder(c.code, { guestName: body.querySelector('#co-name').value, note: body.querySelector('#co-note').value, method: gateway ? 'QRIS' : method });
        DB().saveCart(c.code, []);
        if (gateway) sessionStorage.setItem('kursi_xendit_' + o.id, '1');
        if (method === 'CASH') location.hash = '#/t/' + c.code + '/cashier/' + o.id;
        else location.hash = '#/t/' + c.code + '/pay/' + o.id;
      } catch (e) {
        UI().toast(e.message, 'err'); btn.disabled = false;
        btn.innerHTML = UI().icon('lock', 16) + ' Pesan &amp; Bayar <b>' + fmtRp(calc.total) + '</b>';
      }
    });
  }

  /* ================= SIMULATED PAYMENT ================= */
  window.Views.pay = function (code, id) {
    const c = ctx(code);
    const g = guard(c); if (g) return { html: g };
    const o = DB().order(id);
    if (!o || o.sessionId !== DB().session(code)) return { html: '<div class="cust-wrap">' + custHeader(c, 'Pembayaran') + UI().emptyState('alert', 'Pesanan tidak ditemukan', 'Pesanan ini bukan milik sesi meja Anda.') + '</div>' };
    if (o.paymentStatus === 'PAID') { sessionStorage.removeItem('kursi_xendit_' + o.id); return { html: '<div class="cust-wrap">' + custHeader(c, 'Pembayaran') + '<div class="pay-success"><span class="ps-icn">' + UI().icon('check', 30) + '</span><h2>Pembayaran Berhasil</h2><p class="muted">Pesanan #' + o.number + ' terkonfirmasi dan sudah dikirim ke dapur.</p><a class="btn btn-primary btn-lg btn-block" href="#/t/' + c.code + '/track/' + o.id + '">Lacak Pesanan ' + UI().icon('arrowRight', 16) + '</a></div></div>' }; }
    const useGateway = sessionStorage.getItem('kursi_xendit_' + o.id) === '1';
    if (useGateway) return {
      html: '<div class="cust-wrap">' + custHeader(c, 'Pembayaran') +
        '<div class="pay-page">' +
        '<div class="pay-card-top"><span class="tag tag-terra">QRIS LIVE · XENDIT SANDBOX</span><h2>Pesanan #' + o.number + '</h2><p class="muted">' + esc(c.table.name) + ' · Makan di tempat · ' + o.items.reduce((a, i) => a + i.qty, 0) + ' item</p></div>' +
        '<div class="pay-amount"><span>Total bayar</span><strong>' + fmtRp(o.total) + '</strong><span class="muted">Standar QR Nasional · QRIS</span></div>' +
        '<div class="qris-box" id="gw-box"><p>Menghubungi gateway Xendit…</p></div>' +
        '<div class="pay-actions"><button class="btn btn-ghost btn-block" id="gw-simulate" disabled>' + UI().icon('wallet', 16) + ' Bayar (Simulasi Sandbox)</button>' +
        '<a class="btn btn-ghost btn-block" href="#/t/' + c.code + '/pay/' + o.id + '" id="gw-cancel">Batal - kembali ke simulasi lokal</a></div>' +
        '</div></div>',
      mount(el) {
        const box = el.querySelector('#gw-box'), sim = el.querySelector('#gw-simulate');
        const beCfg = window.KursiBackend && window.KursiBackend.config ? window.KursiBackend.config : {};
        const fnUrl = (beCfg.url ? beCfg.url.replace(/\/+$/, '') : location.origin) + '/functions/v1/xendit';
        const fnHdrs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (beCfg.key || ''), 'apikey': beCfg.key || '' };
        let polling = null;
        async function refresh() {
          const fresh = DB().order(o.id);
          if (fresh && fresh.paymentStatus === 'PAID') { if (polling) { clearInterval(polling); polling = null; } sessionStorage.removeItem('kursi_xendit_' + o.id); rerender(); return true; }
          return false;
        }
        (async () => {
          try {
            const r = await fetch(fnUrl, { method: 'POST', headers: fnHdrs, body: JSON.stringify({ action: 'create', external_id: o.id, amount: o.total }) });
            const data = await r.json();
            if (!data.ok) { box.innerHTML = '<p class="terra">Gateway belum siap.<br><span class="muted small">Deploy edge function xendit &amp; pasang secret XENDIT_SECRET (lihat DEPLOY-XENDIT.md).</span></p>'; return; }
            box.innerHTML = UI().qrImg(data.qr_string || ('KURSI|' + o.number + '|' + o.total), 190, 'QRIS Xendit') +
              '<p>Scan dengan aplikasi bank / e-wallet<br><span class="muted">Sandbox: tekan tombol di bawah untuk simulasi bayar</span></p>';
            sim.disabled = false;
          } catch (e) { box.innerHTML = '<p class="terra">Tidak bisa menghubungi gateway.<br><span class="muted small">' + esc(e.message) + '</span></p>'; }
        })();
        sim.addEventListener('click', async () => {
          sim.disabled = true;
          try {
            await fetch(fnUrl, { method: 'POST', headers: fnHdrs, body: JSON.stringify({ action: 'complete', external_id: o.id }) });
            const p = box.querySelector('p:last-of-type'); if (p) p.innerHTML = '<span class="dot-live"></span> Menyelesaikan pembayaran…';
          } catch (e) { UI().toast('Simulasi gagal', 'err'); sim.disabled = false; }
        });
        polling = setInterval(refresh, 3000);
      }
    };
    return {
      html: '<div class="cust-wrap">' +
        custHeader(c, 'Pembayaran') +
        '<div class="pay-page">' +
        '<div class="pay-card-top"><span class="tag tag-terra">CHECKOUT AMAN · SIMULASI</span><h2>Pesanan #' + o.number + '</h2><p class="muted">' + esc(c.table.name) + ' · Makan di tempat · ' + o.items.reduce((a, i) => a + i.qty, 0) + ' item</p></div>' +
        '<div class="pay-amount"><span>Total bayar</span><strong>' + fmtRp(o.total) + '</strong><span class="muted">' + esc(o.paymentMethod === 'QRIS' ? 'Standar QR Nasional · QRIS' : o.paymentMethod === 'CARD' ? 'Pembayaran kartu' : 'Pembayaran e-wallet') + '</span></div>' +
        (o.paymentMethod === 'QRIS' ?
          '<div class="qris-box">' + UI().qrImg('KURSI|' + o.number + '|' + o.total + '|' + o.id, 190, 'QRIS payment code') + '<p>Scan dengan aplikasi bank / e-wallet apa pun<br><span class="muted">QR demo · uang tidak benar-benar berpindah</span></p></div>' :
          o.paymentMethod === 'CARD' ?
            '<div class="card-form"><div class="field"><label class="field-label">Nomor kartu</label><input class="input" value="4242 4242 4242 4242" readonly></div><div class="grid-2"><div class="field"><label class="field-label">Kedaluwarsa</label><input class="input" value="12/28" readonly></div><div class="field"><label class="field-label">CVC</label><input class="input" value="123" readonly></div></div><p class="muted small">Kartu simulasi · detail sudah terisi untuk demo.</p></div>' :
            '<div class="qris-box"><span class="wallet-icn">' + UI().icon('wallet', 40) + '</span><p>Deep-link ke <strong>GoPay / OVO / ShopeePay</strong><br><span class="muted">Otorisasi e-wallet simulasi</span></p></div>') +
        '<div class="pay-actions"><button class="btn btn-dark btn-lg btn-block" id="sim-pay">' + UI().icon('lock', 16) + ' Simulasi Pembayaran · ' + fmtRp(o.total) + '</button>' +
        '<button class="btn btn-ghost btn-block" id="sim-fail">Simulasi Gagal</button></div>' +
        '<p class="conn-line" style="margin-top:14px"><span><span class="dot-live"></span> Pembayaran terverifikasi instan</span><span>Ref dibuat otomatis</span></p>' +
        '</div></div>',
      mount(el) {
        el.querySelector('#sim-pay').addEventListener('click', () => {
          const btn = el.querySelector('#sim-pay');
          btn.disabled = true; btn.innerHTML = UI().icon('clock', 16) + ' Memproses...';
          setTimeout(() => {
            try { DB().payOrder(o.id, o.paymentMethod, { amount: o.total, actorName: o.guestName || 'Tamu' }); rerender(); }
            catch (e) { UI().toast(e.message, 'err'); btn.disabled = false; }
          }, 1200);
        });
        el.querySelector('#sim-fail').addEventListener('click', () => {
          DB().failPayment(o.id, 'Penolakan simulasi oleh issuer');
          UI().toast('Pembayaran ditolak (simulasi). Pesanan Anda tersimpan · coba lagi.', 'err');
        });
      }
    };
  };

  /* ================= PAY AT CASHIER ================= */
  window.Views.cashierPay = function (code, id) {
    const c = ctx(code);
    const g = guard(c); if (g) return { html: g };
    const o = DB().order(id);
    if (!o || o.sessionId !== DB().session(code)) return { html: '<div class="cust-wrap">' + custHeader(c, 'Pesanan') + UI().emptyState('alert', 'Pesanan tidak ditemukan', '') + '</div>' };
    if (o.paymentStatus === 'PAID') return { html: '<div class="cust-wrap">' + custHeader(c, 'Pesanan') + '<div class="pay-success"><span class="ps-icn">' + UI().icon('check', 30) + '</span><h2>Pembayaran Tunai Terkonfirmasi</h2><p class="muted">Kasir sudah mengonfirmasi pembayaran Anda. Dapur sedang memproses.</p><a class="btn btn-primary btn-lg btn-block" href="#/t/' + c.code + '/track/' + o.id + '">Lacak Pesanan</a></div></div>' };
    return {
      html: '<div class="cust-wrap">' + custHeader(c, 'Bayar di Kasir') +
        '<div class="pay-page"><div class="pay-success pending"><span class="ps-icn warn">' + UI().icon('clock', 30) + '</span><h2>Pesanan #' + o.number + ' Dikirim ke Dapur</h2><p class="muted">Silakan bayar <strong>' + fmtRp(o.total) + '</strong> di kasir · sebutkan meja Anda (' + esc(c.table.name) + '). Halaman ini otomatis terbarui setelah kasir mengonfirmasi.</p>' +
        '<div class="sum-row total" style="margin:18px 0"><span>Tagihan</span><span>' + fmtRp(o.total) + '</span></div>' +
        '<button class="btn btn-ghost btn-block" id="refresh-pay">Cek Status Pembayaran</button>' +
        '<a class="btn btn-primary btn-block" style="margin-top:10px" href="#/t/' + c.code + '/track/' + o.id + '">Lacak Status Pesanan</a></div></div></div>',
      mount(el) { el.querySelector('#refresh-pay').addEventListener('click', rerender); },
      live: true
    };
  };

  /* ================= ORDER TRACKING ================= */
  const TRACK_STEPS = [
    { key: 'NEW', title: 'Pesanan Diterima', desc: 'Langsung terkirim ke bar espresso & dapur KURSI.', icn: 'receipt' },
    { key: 'PAID', title: 'Pembayaran Terkonfirmasi', desc: 'Lunas · Struk otomatis tercatat.', icn: 'check' },
    { key: 'PREPARING', title: 'Barista & Dapur Memproses', desc: 'Dibuat segar dengan biji kopi sangrai saat ini.', icn: 'flame' },
    { key: 'READY', title: 'Cek Kualitas Lulus', desc: 'Pesanan Anda sudah siap dan menunggu di pass.', icn: 'star' },
    { key: 'SERVED', title: 'Diantar ke Meja Anda', desc: 'Pesanan hangat diantar langsung ke meja Anda.', icn: 'chair' },
    { key: 'COMPLETED', title: 'Selamat Menikmati', desc: 'Pesanan selesai · terima kasih sudah bersantap bersama kami.', icn: 'check' }
  ];
  window.Views.track = function (code, id) {
    const c = ctx(code);
    const g = guard(c); if (g) return { html: g };
    const sess = DB().session(code);
    const mine = DB().orders().filter(o => o.sessionId === sess);
    const o = id ? DB().order(id) : mine[0];
    if (!o || o.sessionId !== sess) {
      return {
        html: '<div class="cust-wrap has-bn">' + custHeader(c, 'Lacak') +
          (mine.length ? '<div class="track-list-head"><h2>Pesanan Anda</h2></div>' +
            mine.map(x => '<a class="track-row" href="#/t/' + c.code + '/track/' + x.id + '"><span class="tr-num">#' + x.number + '</span><span class="tr-meta">' + esc(x.tableName) + ' · ' + new Date(x.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + '</span>' + UI().badge(x.orderStatus) + '</a>').join('') :
            UI().emptyState('timer', 'Belum ada pesanan aktif', 'Status pesanan Anda akan muncul di sini secara langsung setelah checkout.', '<a class="btn btn-primary" href="#/t/' + c.code + '/menu">Lihat Menu</a>')) +
          bottomNav(c, 'track') + '</div>'
      };
    }
    const idxOf = { PENDING_PAYMENT: -1, NEW: 0, PREPARING: 1, READY: 2, SERVED: 3, COMPLETED: 4, CANCELLED: -9, PAID: 0 };
    let idx = idxOf[o.orderStatus] != null ? idxOf[o.orderStatus] : 0;
    if (o.paymentStatus === 'PENDING' && o.orderStatus === 'NEW') idx = -1;
    const cancelled = o.orderStatus === 'CANCELLED';
    const paid = o.paymentStatus === 'PAID';
    return {
      html: '<div class="cust-wrap has-bn">' +
        custHeader(c, 'Lacak Pesanan') +
        '<div class="track-page">' +
        (paid && o.payments[0] ?
          '<div class="track-pay glass"><span class="tag tag-olive">✓ Terverifikasi · ' + esc(o.paymentMethod === 'QRIS' ? 'Standar QR Nasional' : o.paymentMethod) + '</span>' +
          '<div class="tp-row"><span class="tp-qr">' + UI().icon('qr', 34) + '</span><div><span class="muted">Total Terbayar' + (o.paymentMethod === 'QRIS' ? ' via GoPay' : '') + '</span><strong>' + fmtRp(o.total) + '</strong></div><div class="tp-ref"><span>Ref: ' + esc(o.payments[o.payments.length - 1].ref) + '</span><span>' + new Date(o.payments[o.payments.length - 1].at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + '</span></div></div></div>' :
          '<div class="track-pay glass warn"><span class="tag tag-warn">Menunggu Pembayaran</span><div class="tp-row"><div><strong>' + fmtRp(o.total) + '</strong><span class="muted">' + (o.paymentMethod === 'CASH' ? 'Bayar di kasir' : 'Selesaikan pembayaran untuk dikirim ke dapur') + '</span></div>' +
          (o.paymentMethod === 'CASH' ? '<a class="btn btn-primary sm" href="#/t/' + c.code + '/cashier/' + o.id + '">Status</a>' : '<a class="btn btn-primary sm" href="#/t/' + c.code + '/pay/' + o.id + '">Bayar Sekarang</a>') + '</div></div>') +
        '<div class="track-head"><span class="tag">MAKAN DI TEMPAT · ' + esc(o.tableName) + '</span><h2>Pesanan #' + o.number + '</h2><span class="est">' + UI().icon('clock', 13) + ' ESTIMASI <b>8–12 menit</b></span></div>' +
        (cancelled ? '<div class="empty-state" style="padding:28px">' + UI().icon('alert', 30) + '<h4>Pesanan Dibatalkan</h4><p class="muted">Pesanan ini dibatalkan. Silakan pesan ulang jika perlu.</p></div>' :
          '<div class="timeline">' + TRACK_STEPS.map((st, i) => {
            const done = i < idx, cur = i === idx && idx >= 0;
            const time = st.key === 'PAID' ? (o.payments[0] ? new Date(o.payments[0].at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '') :
              o.timeline.find(t => t.status === st.key) ? new Date(o.timeline.find(t => t.status === st.key).at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
            return '<div class="tl-step ' + (done ? 'done' : cur ? 'current' : 'todo') + '">' +
              '<span class="tl-icn">' + (done || cur ? UI().icon(cur ? st.icn : 'check', cur ? 17 : 15) : UI().icon(st.icn, 15)) + '</span>' +
              '<div class="tl-body"><div class="tl-top"><strong>' + st.title + '</strong>' + (cur ? '<span class="tag tag-terra">SEKARANG</span>' : '') + '<time>' + (done || cur ? time : '~' + (11 + i * 4) + ':' + String(24 + i * 6).padStart(2, '0')) + '</time></div>' +
              '<p>' + st.desc + '</p></div></div>';
          }).join('') + '</div>') +
        '<div class="summary-card"><div class="sum-head">' + o.items.reduce((a, i) => a + i.qty, 0) + ' Item di Pesanan Ini <a class="link" href="#/t/' + c.code + '/track/' + o.id + '">Detail ' + UI().icon('chevD', 13) + '</a></div>' +
        o.items.map(i => {
          const p = DB().product(i.productId) || {};
          return '<div class="track-item"><img src="' + esc(p.image || 'assets/iced-latte.png') + '" alt="" class="ci-img"><div class="ci-body"><div class="ci-top"><span class="ci-name">' + i.qty + 'x ' + esc(i.name) + '</span><span class="ci-price">' + fmtRp(i.lineTotal) + '</span></div>' +
            (i.modifiers.length ? '<div class="ci-mods">' + esc(i.modifiers.map(m => m.name).join(', ')) + '</div>' : '') + '</div></div>';
        }).join('') +
        '<div class="sum-row"><span>Subtotal</span><span>' + fmtRp(o.subtotal) + '</span></div>' +
        '<div class="sum-row"><span>Pajak &amp; Layanan (15%)</span><span>' + fmtRp(o.tax + o.service) + '</span></div>' +
        '<div class="sum-row total"><span>Total Dibayar</span><span>' + fmtRp(o.total) + '</span></div></div>' +
        '<button class="btn btn-ghost btn-block" id="call-staff">' + UI().icon('bell', 16) + ' Butuh bantuan? Panggil staf ke ' + esc(o.tableName) + '</button>' +
        (['COMPLETED', 'CANCELLED'].includes(o.orderStatus) ? '<a class="btn btn-dark btn-block" href="#/t/' + c.code + '/menu">Tambah item untuk meja ini ' + UI().icon('plus', 15) + '</a>' : '') +
        '</div>' +
        bottomNav(c, 'track') + '</div>',
      mount(el) {
        const b = el.querySelector('#call-staff');
        if (b) b.addEventListener('click', () => UI().toast('Staf sudah diberi tahu untuk ' + o.tableName));
      },
      live: true
    };
  };

  function rerender() { window.dispatchEvent(new CustomEvent('kursi:rerender')); }
})();
