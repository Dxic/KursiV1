/* ============================================================
   KURSI · Data Layer
   seed + persistent store + server-side style business rules
   (single-writer "backend" inside the browser; every mutation
   goes through validate -> mutate -> persist)
   ============================================================ */
(function () {
  'use strict';
  const DB_KEY = 'kursi_db_v1';

  /* ---------- utils ---------- */
  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9);
  const nowISO = () => new Date().toISOString();
  const fmtRp = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
  const dayKey = (d) => { d = new Date(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const todayKey = () => dayKey(new Date());
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const timeHM = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateShort = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const ago = (iso) => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  };

  /* ---------- order state machine ---------- */
  const FLOW = ['PENDING_PAYMENT', 'NEW', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'];
  const TRANSITIONS = {
    NEW: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY'],
    READY: ['SERVED'],
    SERVED: ['COMPLETED'],
    PENDING_PAYMENT: ['CANCELLED'],
    PAID: [],
    COMPLETED: [],
    CANCELLED: []
  };
  const PAY_METHODS = { QRIS: 'QRIS', EWALLET: 'E-Wallet', CARD: 'Kartu', CASH: 'Tunai' };

  /* ---------- seed ---------- */
  function seed() {
    const A = 'assets/';
    const cats = [
      { id: 'c_coffee', name: 'Coffee', sort: 1, active: true },
      { id: 'c_noncoffee', name: 'Non-Coffee', sort: 2, active: true },
      { id: 'c_food', name: 'Food', sort: 3, active: true },
      { id: 'c_snack', name: 'Snack', sort: 4, active: true },
      { id: 'c_dessert', name: 'Dessert', sort: 5, active: true }
    ];
    const mg = (id, name, required, minSel, maxSel, options) => ({ id, name, required, minSel, maxSel, options });
    const opt = (id, name, price) => ({ id, name, price });
    const modGroups = [
      mg('m_size', 'Cup Size', true, 1, 1, [opt('m_size_reg', 'Regular 8oz', 0), opt('m_size_lg', 'Large 12oz', 5000)]),
      mg('m_milk', 'Milk', true, 1, 1, [opt('m_milk_whole', 'Fresh Whole Milk', 0), opt('m_milk_oat', 'Oat Milk', 6000), opt('m_milk_soy', 'Soy Milk', 4000), opt('m_milk_almond', 'Roasted Almond Milk', 8000)]),
      mg('m_sugar', 'Organic Arenga Sugar', false, 0, 1, [opt('m_sugar_norm', 'Normal (100%)', 0), opt('m_sugar_less', 'Less Sugar (50%)', 0), opt('m_sugar_zero', 'Zero (0%)', 0)]),
      mg('m_ice', 'Ice Level', false, 0, 1, [opt('m_ice_norm', 'Normal Ice', 0), opt('m_ice_less', 'Less Ice', 0), opt('m_ice_no', 'No Ice', 0)]),
      mg('m_extra', 'Extras', false, 0, 3, [opt('m_extra_shot', 'Extra Espresso Shot', 8000), opt('m_extra_butter', 'Extra Salted Butter Slab', 5000), opt('m_extra_sc', 'Whipped Cream', 5000)])
    ];
    const P = (id, sku, name, slug, desc, price, cat, img, mods, extra) => Object.assign({
      id, sku, name, slug, desc, price, categoryId: cat, image: img, available: true, featured: false, modifierGroupIds: mods
    }, extra || {});
    const products = [
      P('p_latte', 'KRC-C-001', 'KURSI Signature Iced Latte', 'kursi-iced-latte', 'Double shot Kintamani espresso, fresh oat milk, hint of Madagascar vanilla bean.', 38000, 'c_coffee', A + 'iced-latte.png', ['m_size', 'm_milk', 'm_sugar', 'm_ice'], { featured: true }),
      P('p_americano', 'KRC-C-002', 'Iced Americano', 'iced-americano', 'Clean, bright long black over hand-carved ice. Sumatra Kerinci beans.', 28000, 'c_coffee', A + 'americano.png', ['m_size', 'm_sugar', 'm_ice']),
      P('p_cappuccino', 'KRC-C-003', 'Cappuccino', 'cappuccino', 'Classic 1:1:1 ratio with velvet micro-foam and cocoa dust.', 32000, 'c_coffee', A + 'americano.png', ['m_milk', 'm_sugar']),
      P('p_coldbrew', 'KRC-C-004', 'Gula Aren Cold Brew', 'gula-aren-cold-brew', '18-hour slow drip Aceh Gayo Arabica, natural arenga nectar.', 36000, 'c_coffee', A + 'coldbrew.png', ['m_size', 'm_milk', 'm_ice']),
      P('p_pourover', 'KRC-C-005', 'Flores Bajawa Pour Over', 'flores-bajawa-pour-over', 'Light floral jasmine notes, washed process, single lot. Batch No. 04.', 34000, 'c_coffee', A + 'bottle.png', ['m_sugar']),
      P('p_matcha', 'KRC-N-001', 'Matcha Latte', 'matcha-latte', 'Ceremonial grade Uji matcha whisked with your choice of milk.', 34000, 'c_noncoffee', A + 'matcha.png', ['m_size', 'm_milk', 'm_sugar', 'm_ice']),
      P('p_chocolate', 'KRC-N-002', 'Dark Chocolate', 'dark-chocolate', '70% single-origin Java cocoa, barely sweet, served warm or iced.', 30000, 'c_noncoffee', A + 'chocolate.png', ['m_size', 'm_ice']),
      P('p_lemontea', 'KRC-N-003', 'Yuzu Lemon Tea', 'yuzu-lemon-tea', 'Cold-brewed black tea, yuzu, lemongrass. Extremely refreshing.', 24000, 'c_noncoffee', A + 'coldbrew.png', ['m_sugar', 'm_ice']),
      P('p_avotoast', 'KRC-F-001', 'Sourdough Poached Avocado', 'sourdough-poached-avocado', 'Artisan sourdough, smashed avocado, organic poached eggs, dukkah spices.', 58000, 'c_food', A + 'avocado-toast.png', ['m_extra'], { featured: true }),
      P('p_sandwich', 'KRC-F-002', 'Chicken Sando', 'chicken-sando', 'Buttermilk fried chicken, house pickles, chipotle aioli on milk bun.', 45000, 'c_food', A + 'avocado-toast.png', ['m_extra']),
      P('p_kayatoast', 'KRC-F-003', 'Truffle Kaya Toast Brioche', 'truffle-kaya-toast', 'House-made pandan kaya, French cultured butter, flaky sea salt on brioche.', 42000, 'c_snack', A + 'avocado-toast.png', ['m_extra'], { featured: true }),
      P('p_fries', 'KRC-S-001', 'Twice-Cooked Fries', 'twice-cooked-fries', 'Crisp on the outside, fluffy inside. Smoked paprika salt.', 24000, 'c_snack', A + 'fries.png', ['m_extra']),
      P('p_croissant', 'KRC-S-002', 'Butter Croissant', 'butter-croissant', 'Laminated over three days with cultured French butter.', 22000, 'c_snack', A + 'pandan-cake.png', []),
      P('p_pandan', 'KRC-D-001', 'Pandan Chiffon Cake', 'pandan-chiffon-cake', 'Traditional pandan sponge, coconut cream drizzle, toasted coconut.', 34000, 'c_dessert', A + 'pandan-cake.png', [], { featured: true }),
      P('p_cheesecake', 'KRC-D-002', 'Basque Cheesecake', 'basque-cheesecake', 'Burnt top, molten center. Baked daily in small batches.', 36000, 'c_dessert', A + 'cheesecake.png', []),
      P('p_tiramisu', 'KRC-D-003', 'Espresso Tiramisu', 'espresso-tiramisu', 'Espresso-soaked savoiardi, mascarpone cloud, cacao.', 38000, 'c_dessert', A + 'cheesecake.png', [])
    ];
    const zones = ['Main Dining Hall', 'Garden Patio'];
    const codes = ['M2X41', 'T8Q77', 'P5B12', 'K9R63', 'D4W28', 'A7K29', 'H3N55', 'S6T91', 'F2L47', 'G8V34', 'B5C69', 'E1M83'];
    const tables = Array.from({ length: 12 }, (_, i) => ({
      id: 't' + (i + 1), code: codes[i], name: 'T-' + String(i + 1).padStart(2, '0'),
      zone: i < 10 ? zones[0] : zones[1], seats: i === 5 ? 6 : (i % 3 === 1 ? 4 : 2),
      status: 'AVAILABLE', active: true, scans: 10 + ((i * 7) % 30)
    }));
    const users = [
      { id: 'u_admin', name: 'Raka Danu', email: 'admin@kursi.local', password: 'kursi123', role: 'ADMIN', active: true, title: 'Owner / GM' },
      { id: 'u_cashier', name: 'Aulia Rahma', email: 'cashier@kursi.local', password: 'kursi123', role: 'CASHIER', active: true, title: 'Cashier POS 01' },
      { id: 'u_kitchen', name: 'Bayu Kurnia', email: 'kitchen@kursi.local', password: 'kursi123', role: 'KITCHEN', active: true, title: 'Barista Station #1' },
      { id: 'u_kitchen2', name: 'Sari Wulandari', email: 'sari@kursi.local', password: 'kursi123', role: 'KITCHEN', active: true, title: 'Kitchen Prep' }
    ];
    const inventory = [
      { id: 'i1', name: 'Aceh Gayo Single Origin', category: 'Roasted Beans', stock: 2.4, unit: 'kg', minStock: 5 },
      { id: 'i2', name: 'Outside Barista Blend', category: 'Dairy & Plant', stock: 14, unit: 'L', minStock: 20 },
      { id: 'i3', name: 'Flores Bajawa Washed', category: 'Roasted Beans', stock: 8.5, unit: 'kg', minStock: 4 },
      { id: 'i4', name: 'Sumatra Kerinci Natural', category: 'Roasted Beans', stock: 6, unit: 'kg', minStock: 3 },
      { id: 'i5', name: 'Greenfields Fresh Whole Milk', category: 'Dairy & Plant', stock: 32, unit: 'L', minStock: 16 },
      { id: 'i6', name: 'Organic Arenga Palm Nectar', category: 'Syrups', stock: 12, unit: 'L', minStock: 5 },
      { id: 'i7', name: 'Artisanal Sourdough Batard', category: 'Bakery Prep', stock: 6, unit: 'loaves', minStock: 3 },
      { id: 'i8', name: 'Truffle Butter Compound', category: 'Bakery Prep', stock: 1.8, unit: 'kg', minStock: 1 },
      { id: 'i9', name: 'Biodegradable Takeaway Cups', category: 'Packaging', stock: 450, unit: 'pcs', minStock: 200 },
      { id: 'i10', name: 'Uji Ceremonial Matcha', category: 'Dry Goods', stock: 0.9, unit: 'kg', minStock: 1 }
    ];
    const expenses = [
      { id: 'x1', desc: 'Electricity bill', category: 'Operational', amount: 1850000, date: dayKey(Date.now() - 86400000 * 2), note: 'PLN September' },
      { id: 'x2', desc: 'Greenfields milk supplier', category: 'Ingredient Purchase', amount: 2400000, date: dayKey(Date.now() - 86400000 * 4), note: 'Weekly bulk PO' },
      { id: 'x3', desc: 'La Marzocco gasket service', category: 'Equipment', amount: 750000, date: dayKey(Date.now() - 86400000 * 6), note: 'Group 2 descale' },
      { id: 'x4', desc: 'Biodegradable cups restock', category: 'Ingredient Purchase', amount: 980000, date: todayKey(), note: '450 pcs 8/12oz' },
      { id: 'x5', desc: 'Staff shift meal budget', category: 'Operational', amount: 350000, date: todayKey(), note: '' }
    ];

    /* --- generated historical orders (real records, snapshots) --- */
    let seq = 1042;
    const orders = [];
    const guests = ['Arya W.', 'Dina S.', 'Bambang', 'Rian & Team', 'Marissa K.', 'Kenzo', 'Putri A.', 'Dimas', 'Sinta', 'Galih', 'Laras', 'Fajar'];
    const mkItem = (pid, qty, modOpts, note) => {
      const p = products.find(x => x.id === pid);
      const mods = (modOpts || []).map(([gid, oid]) => {
        const g = modGroups.find(m => m.id === gid); const o = g.options.find(x => x.id === oid);
        return { groupId: g.id, groupName: g.name, optionId: o.id, name: o.name, price: o.price };
      });
      const unit = p.price + mods.reduce((s, m) => s + m.price, 0);
      return { productId: p.id, name: p.name, price: p.price, qty, modifiers: mods, note: note || '', unitPrice: unit, lineTotal: unit * qty };
    };
    const mkOrder = (tableIdx, items, status, minsAgo, guest, method) => {
      const t = tables[tableIdx];
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const tax = Math.round(subtotal * 0.10), service = Math.round(subtotal * 0.05);
      const total = subtotal + tax + service;
      const at = new Date(Date.now() - minsAgo * 60000).toISOString();
      const paid = status !== 'PENDING_PAYMENT' && status !== 'CANCELLED';
      const o = {
        id: uid('o'), number: seq++, tableId: t.id, tableCode: t.code, tableName: t.name,
        guestName: guest || '', note: '', items, subtotal, tax, service, total,
        orderStatus: paid ? status : 'PENDING_PAYMENT', paymentStatus: paid ? 'PAID' : 'PENDING',
        paymentMethod: paid ? method : (method || 'CASH'), sessionId: 'seed', source: 'QR',
        createdAt: at, updatedAt: at,
        timeline: [{ status: 'PENDING_PAYMENT', at }],
        payments: []
      };
      if (paid) {
        o.timeline.push({ status: 'PAID', at: new Date(new Date(at).getTime() + 60000).toISOString() });
        o.payments.push({ id: uid('pay'), method, amount: total, status: 'PAID', ref: (method === 'QRIS' ? 'QR-' : 'TRX-') + Math.floor(10000 + Math.random() * 89999), at: o.timeline[1].at });
        if (status !== 'PAID') o.timeline.push({ status: status, at: new Date(new Date(at).getTime() + 120000).toISOString() });
      }
      return o;
    };
    const s = mkOrder;
    orders.push(
      s(6, [mkItem('p_latte', 1, [['m_size', 'm_size_lg'], ['m_milk', 'm_milk_oat'], ['m_sugar', 'm_sugar_less'], ['m_ice', 'm_ice_norm']], 'Less ice please'), mkItem('p_kayatoast', 1, [['m_extra', 'm_extra_butter']])], 'PREPARING', 12, 'Arya W.', 'QRIS'),
      s(7, [mkItem('p_avotoast', 1, [['m_extra', 'm_extra_sc']], 'Extra chili flakes on the side'), mkItem('p_matcha', 1, [['m_milk', 'm_milk_oat'], ['m_sugar', 'm_sugar_less']])], 'PENDING_PAYMENT', 8, 'Dina S.', 'CASH'),
      s(2, [mkItem('p_pourover', 2, [['m_sugar', 'm_sugar_norm']], 'V60 single origin · warm slice'), mkItem('p_pandan', 1, [])], 'READY', 21, 'Bambang', 'QRIS'),
      s(10, [mkItem('p_coldbrew', 1, [['m_milk', 'm_milk_whole']]), mkItem('p_fries', 1, [])], 'PREPARING', 24, 'Rian & Team', 'CASH'),
      s(1, [mkItem('p_cappuccino', 4, [['m_milk', 'm_milk_whole']]), mkItem('p_croissant', 2, [])], 'COMPLETED', 41, 'Marissa K.', 'QRIS'),
      s(9, [mkItem('p_americano', 2, [['m_size', 'm_size_lg']], 'Paper bag · 0% sugar'), mkItem('p_cheesecake', 1, [])], 'COMPLETED', 62, 'Kenzo', 'CARD'),
      s(3, [mkItem('p_latte', 1, [['m_milk', 'm_milk_soy']]), mkItem('p_sandwich', 1, [])], 'COMPLETED', 95, 'Putri A.', 'EWALLET'),
      s(4, [mkItem('p_matcha', 2, [['m_size', 'm_size_lg'], ['m_milk', 'm_milk_oat']])], 'COMPLETED', 130, 'Dimas', 'QRIS'),
      s(5, [mkItem('p_chocolate', 1, [['m_ice', 'm_ice_norm']]), mkItem('p_tiramisu', 1, [])], 'COMPLETED', 170, 'Sinta', 'CASH'),
      s(0, [mkItem('p_pourover', 1, []), mkItem('p_avotoast', 1, [])], 'COMPLETED', 210, 'Galih', 'QRIS'),
      s(8, [mkItem('p_latte', 3, [['m_milk', 'm_milk_oat']])], 'COMPLETED', 260, 'Laras', 'EWALLET'),
      s(11, [mkItem('p_lemontea', 2, [['m_sugar', 'm_sugar_less']]), mkItem('p_fries', 1, [])], 'COMPLETED', 320, 'Fajar', 'QRIS'),
      s(6, [mkItem('p_cappuccino', 2, []), mkItem('p_kayatoast', 1, [])], 'COMPLETED', 420, 'Arya W.', 'QRIS'),
      s(2, [mkItem('p_americano', 1, []), mkItem('p_cheesecake', 1, [])], 'COMPLETED', 540, 'Bambang', 'CARD'),
      s(5, [mkItem('p_coldbrew', 2, []), mkItem('p_croissant', 2, [])], 'COMPLETED', 1560, 'Sinta', 'QRIS'),
      s(1, [mkItem('p_latte', 2, [['m_milk', 'm_milk_oat']]), mkItem('p_sandwich', 1, [])], 'COMPLETED', 2880, 'Dina S.', 'QRIS'),
      s(7, [mkItem('p_matcha', 1, []), mkItem('p_pandan', 2, [])], 'COMPLETED', 4400, 'Rian & Team', 'EWALLET')
    );

    const audit = [
      { at: nowISO(), actor: 'system', action: 'SEED', detail: 'Demo dataset initialized' }
    ];
    return {
      v: 1, seq,
      settings: { cafeName: 'KURSI Coffee', branch: 'Seminyak Flagship · Bali #01', tagline: 'Scan. Order. Enjoy.', taxRate: 0.10, serviceRate: 0.05, taxLabel: 'Pajak Restoran (PB1 10%)', serviceLabel: 'Biaya Layanan (5%)', wifi: 'KURSI-GUEST', lowStockNotified: false },
      categories: cats, modifierGroups: modGroups, products, tables, users, inventory, expenses, orders, audit
    };
  }

  /* ---------- store ---------- */
  let DB = null;
  function load() {
    try { DB = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { DB = null; }
    if (!DB || DB.v !== 1) { DB = seed(); persist(); }
    // migrate English tax/service labels from older demo data
    if (DB.settings && DB.settings.taxLabel === 'Restaurant Tax (PB1 10%)') {
      DB.settings.taxLabel = 'Pajak Restoran (PB1 10%)';
      DB.settings.serviceLabel = 'Biaya Layanan (5%)';
      localStorage.setItem(DB_KEY, JSON.stringify(DB));
    }
  }
  function persist() {
    DB.meta = DB.meta || {};
    DB.meta.updatedAt = nowISO();
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    window.dispatchEvent(new CustomEvent('kursi:save'));
    if (window.KursiBackend && window.KursiBackend.configured()) window.KursiBackend.push(DB);
  }
  // if a Supabase backend is configured, adopt newer remote state on boot
  setTimeout(function () {
    if (window.KursiBackend && window.KursiBackend.configured()) {
      window.KursiBackend.pull().then(function (remote) {
        if (!remote) return;
        const localTs = DB && DB.meta ? new Date(DB.meta.updatedAt).getTime() : 0;
        const remoteTs = remote.meta ? new Date(remote.meta.updatedAt).getTime() : 0;
        if (remoteTs > localTs) {
          DB = remote;
          localStorage.setItem(DB_KEY, JSON.stringify(DB));
          window.dispatchEvent(new CustomEvent('kursi:external'));
        }
      }).catch(function () { });
    }
  }, 400);
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY) { try { DB = JSON.parse(e.newValue); } catch (err) { } window.dispatchEvent(new CustomEvent('kursi:external')); }
  });

  const api = {
    get db() { return DB; },
    reload: load,
    adopt(remote) {
      if (!remote || remote.v !== 1) return;
      DB = remote;
      localStorage.setItem(DB_KEY, JSON.stringify(DB));
      window.dispatchEvent(new CustomEvent('kursi:external'));
    },
    fmtRp, ago, timeHM, dateShort, dayKey, todayKey,
    reset() {
      localStorage.removeItem(DB_KEY);
      Object.keys(localStorage).filter(k => k.indexOf('kursi_cart_') === 0).forEach(k => localStorage.removeItem(k));
      Object.keys(sessionStorage).filter(k => k.indexOf('kursi_sess_') === 0 || k === 'kursi_staff').forEach(k => sessionStorage.removeItem(k));
      DB = seed(); persist();
      return DB;
    },
    resetEmpty() {
      // seed penuh lalu dikosongkan: produk/meja/staf tetap, pesanan & pembayaran 0
      localStorage.removeItem(DB_KEY);
      Object.keys(localStorage).filter(k => k.indexOf('kursi_cart_') === 0).forEach(k => localStorage.removeItem(k));
      DB = seed();
      DB.orders = [];
      DB.expenses = [];
      DB.seq = 1042;
      DB.audit = [{ at: nowISO(), actor: 'system', action: 'RESET_EMPTY', detail: 'Demo data cleared to zero orders' }];
      persist();
      return DB;
    },

    /* ----- reads ----- */
    settings: () => DB.settings,
    categories: () => DB.categories.slice().sort((a, b) => a.sort - b.sort),
    products: () => DB.products.slice(),
    product: (id) => DB.products.find(p => p.id === id),
    modGroups: () => DB.modifierGroups.slice(),
    tables: () => DB.tables.slice(),
    tableByCode: (code) => DB.tables.find(t => t.code === code && t.active),
    table: (id) => DB.tables.find(t => t.id === id),
    users: () => DB.users.slice(),
    orders: () => DB.orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    order: (id) => DB.orders.find(o => o.id === id),
    orderByNumber: (n) => DB.orders.find(o => o.number === n),
    inventory: () => DB.inventory.slice(),
    expenses: () => DB.expenses.slice(),
    audit: () => DB.audit.slice().reverse(),

    /* ----- auth ----- */
    login(email, password) {
      const u = DB.users.find(x => x.email.toLowerCase() === String(email).toLowerCase() && x.password === password);
      if (!u) throw new Error('Email atau password salah.');
      if (!u.active) throw new Error('Akun ini sudah dinonaktifkan.');
      sessionStorage.setItem('kursi_staff', JSON.stringify({ id: u.id, role: u.role, name: u.name }));
      return u;
    },
    logout() { sessionStorage.removeItem('kursi_staff'); },
    staff() {
      try { const s = JSON.parse(sessionStorage.getItem('kursi_staff')); if (!s) return null; const u = DB.users.find(x => x.id === s.id); return (u && u.active) ? u : null; } catch (e) { return null; }
    },
    requireRole(roles) {
      const u = api.staff();
      if (!u) throw new Error('Silakan masuk untuk melanjutkan.');
      if (!roles.includes(u.role)) throw new Error('Anda tidak punya izin untuk aksi ini.');
      return u;
    },

    /* ----- customer session & cart ----- */
    session(code) {
      const key = 'kursi_sess_' + code;
      let s = sessionStorage.getItem(key);
      if (!s) { s = uid('sess'); sessionStorage.setItem(key, s); }
      return s;
    },
    cart(code) {
      const key = 'kursi_cart_' + code;
      try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
    },
    saveCart(code, items) {
      const key = 'kursi_cart_' + code;
      if (!items || !items.length) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('kursi:save'));
    },

    /* ----- audit ----- */
    log(action, detail, actor) {
      DB.audit.push({ at: nowISO(), actor: actor || (api.staff() ? api.staff().name : 'tamu'), action, detail });
      if (DB.audit.length > 400) DB.audit = DB.audit.slice(-400);
    },

    /* ----- business: orders ----- */
    computeCart(code) {
      const items = api.cart(code);
      const s = DB.settings;
      const lines = items.map(ci => {
        const p = DB.products.find(x => x.id === ci.productId);
        if (!p) throw new Error('Sebuah produk di keranjang sudah tidak tersedia.');
        if (!p.available) throw new Error('"' + p.name + '" is currently unavailable.');
        const mods = (ci.mods || []).map(m => {
          const g = DB.modifierGroups.find(x => x.id === m.groupId);
          const o = g && g.options.find(x => x.id === m.optionId);
          if (!o) throw new Error('An option for "' + p.name + '" is no longer available.');
          return { groupId: g.id, groupName: g.name, optionId: o.id, name: o.name, price: o.price };
        });
        const unit = p.price + mods.reduce((a, m) => a + m.price, 0);
        return { productId: p.id, name: p.name, price: p.price, qty: ci.qty, modifiers: mods, note: ci.note || '', unitPrice: unit, lineTotal: unit * ci.qty };
      });
      const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
      const tax = Math.round(subtotal * s.taxRate);
      const service = Math.round(subtotal * s.serviceRate);
      return { lines, subtotal, tax, service, total: subtotal + tax + service };
    },

    createOrder(code, payload) {
      const t = api.tableByCode(code);
      if (!t) throw new Error('Meja tidak valid atau nonaktif. Silakan scan ulang QR code.');
      if (!api.cart(code).length) throw new Error('Keranjang Anda kosong.');
      const calc = api.computeCart(code); // server-side re-validation: availability + pricing
      const at = nowISO();
      const o = {
        id: uid('o'), number: DB.seq++, tableId: t.id, tableCode: t.code, tableName: t.name,
        guestName: (payload.guestName || '').slice(0, 60), note: (payload.note || '').slice(0, 300),
        items: calc.lines, subtotal: calc.subtotal, tax: calc.tax, service: calc.service, total: calc.total,
        orderStatus: 'PENDING_PAYMENT', paymentStatus: 'PENDING', paymentMethod: payload.method || 'CASH',
        sessionId: api.session(code), source: 'QR', createdAt: at, updatedAt: at,
        timeline: [{ status: 'PENDING_PAYMENT', at }], payments: []
      };
      DB.orders.push(o);
      t.status = 'OCCUPIED'; t.scans += 0;
      api.log('ORDER_CREATED', '#' + o.number + ' · ' + t.name + ' · ' + fmtRp(o.total));
      persist();
      return o;
    },

    payOrder(orderId, method, opts) {
      opts = opts || {};
      const o = api.order(orderId);
      if (!o) throw new Error('Order not found.');
      if (o.paymentStatus !== 'PENDING') throw new Error('This order has already been paid.');
      if (opts.amount != null && Math.round(opts.amount) !== Math.round(o.total)) throw new Error('Nominal pembayaran tidak sesuai total pesanan.');
      if (!PAY_METHODS[method]) throw new Error('Metode pembayaran tidak didukung.');
      if (method === 'CASH' && opts.actorRole !== 'CASHIER' && opts.actorRole !== 'ADMIN') throw new Error('Pembayaran tunai harus dikonfirmasi kasir.');
      const at = nowISO();
      o.payments.push({
        id: uid('pay'), method, amount: o.total, status: 'PAID',
        ref: (method === 'QRIS' ? 'QR-' : method === 'CASH' ? 'CSH-' : 'TRX-') + Math.floor(10000 + Math.random() * 89999),
        at
      });
      o.paymentStatus = 'PAID';
      o.paymentMethod = method;
      o.orderStatus = 'NEW';
      o.timeline.push({ status: 'PAID', at }, { status: 'NEW', at });
      o.updatedAt = at;
      api.log('PAYMENT_PAID', '#' + o.number + ' · ' + method + ' · ' + fmtRp(o.total), opts.actorName);
      persist();
      return o;
    },

    failPayment(orderId, reason) {
      const o = api.order(orderId);
      if (!o) return;
      o.payments.push({ id: uid('pay'), method: o.paymentMethod, amount: o.total, status: 'FAILED', ref: 'FAIL-' + Math.floor(10000 + Math.random() * 89999), at: nowISO(), note: reason || 'Simulated decline' });
      api.log('PAYMENT_FAILED', '#' + o.number + ' · ' + (reason || 'declined'));
      persist();
    },

    transition(orderId, to, actor) {
      const o = api.order(orderId);
      if (!o) throw new Error('Order not found.');
      const allowed = TRANSITIONS[o.orderStatus] || [];
      if (!allowed.includes(to)) throw new Error('Tidak bisa ubah pesanan #' + o.number + ' dari ' + o.orderStatus.replace(/_/g, ' ') + ' ke ' + to.replace(/_/g, ' ') + '.');
      const at = nowISO();
      o.orderStatus = to;
      o.timeline.push({ status: to, at });
      o.updatedAt = at;
      if (to === 'CANCELLED' && o.paymentStatus === 'PAID') {
        o.paymentStatus = 'REFUNDED';
        o.payments.push({ id: uid('pay'), method: o.paymentMethod, amount: -o.total, status: 'REFUNDED', ref: 'RFD-' + Math.floor(10000 + Math.random() * 89999), at });
      }
      if (to === 'COMPLETED' || to === 'CANCELLED') {
        const t = api.table(o.tableId);
        if (t && !DB.orders.some(x => x.tableId === t.id && x.id !== o.id && ['NEW', 'PREPARING', 'READY', 'SERVED'].includes(x.orderStatus))) t.status = 'AVAILABLE';
      }
      api.log('ORDER_' + to, '#' + o.number + ' · ' + o.tableName, actor ? actor.name : undefined);
      persist();
      return o;
    },

    transferOrder(orderId, tableId, actor) {
      const o = api.order(orderId); const t = api.table(tableId);
      if (!o || !t || !t.active) throw new Error('Invalid table.');
      if (['COMPLETED', 'CANCELLED'].includes(o.orderStatus)) throw new Error('This order is already closed.');
      const from = api.table(o.tableId);
      o.tableId = t.id; o.tableCode = t.code; o.tableName = t.name; o.updatedAt = nowISO();
      if (from && !DB.orders.some(x => x.tableId === from.id && x.id !== o.id && ['NEW', 'PREPARING', 'READY', 'PENDING_PAYMENT'].includes(x.orderStatus))) from.status = 'AVAILABLE';
      t.status = 'OCCUPIED';
      api.log('ORDER_TRANSFER', '#' + o.number + ' → ' + t.name, actor ? actor.name : undefined);
      persist();
      return o;
    },

    /* ----- admin: catalog ----- */
    saveProduct(data, actor) {
      api.requireRole(['ADMIN']);
      const name = (data.name || '').trim();
      if (!name) throw new Error('Nama produk wajib diisi.');
      const price = Math.round(Number(data.price));
      if (!isFinite(price) || price < 0) throw new Error('Harga harus angka valid non-negatif.');
      if (!DB.categories.some(c => c.id === data.categoryId && c.active)) throw new Error('Silakan pilih kategori aktif.');
      let p = data.id ? DB.products.find(x => x.id === data.id) : null;
      if (p) {
        Object.assign(p, { name, slug: data.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), desc: data.desc || '', price, categoryId: data.categoryId, image: data.image || p.image, available: !!data.available, featured: !!data.featured, modifierGroupIds: data.modifierGroupIds || [] });
      } else {
        p = { id: uid('p'), sku: data.sku || ('KRC-' + String(DB.products.length + 1).padStart(3, '0')), name, slug: data.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), desc: data.desc || '', price, categoryId: data.categoryId, image: data.image || 'assets/iced-latte.png', available: data.available !== false, featured: !!data.featured, modifierGroupIds: data.modifierGroupIds || [] };
        DB.products.push(p);
      }
      api.log('PRODUCT_SAVE', p.sku + ' · ' + p.name + ' · ' + fmtRp(p.price), actor.name);
      persist();
      return p;
    },
    toggleProduct(id, actor) {
      api.requireRole(['ADMIN']);
      const p = api.product(id); if (!p) throw new Error('Product not found.');
      p.available = !p.available;
      api.log(p.available ? 'PRODUCT_ACTIVATE' : 'PRODUCT_DEACTIVATE', p.name, actor.name);
      persist(); return p;
    },
    saveCategory(data, actor) {
      api.requireRole(['ADMIN']);
      const name = (data.name || '').trim(); if (!name) throw new Error('Nama kategori wajib diisi.');
      let c = data.id ? DB.categories.find(x => x.id === data.id) : null;
      if (c) { c.name = name; c.active = !!data.active; }
      else { c = { id: uid('c'), name, sort: DB.categories.length + 1, active: data.active !== false }; DB.categories.push(c); }
      api.log('CATEGORY_SAVE', name, actor.name); persist(); return c;
    },
    moveCategory(id, dir, actor) {
      api.requireRole(['ADMIN']);
      const sorted = DB.categories.slice().sort((a, b) => a.sort - b.sort);
      const i = sorted.findIndex(c => c.id === id); const j = i + dir;
      if (i < 0 || j < 0 || j >= sorted.length) return;
      const tmp = sorted[i].sort; sorted[i].sort = sorted[j].sort; sorted[j].sort = tmp;
      api.log('CATEGORY_REORDER', sorted[j].name, actor.name); persist();
    },
    saveModGroup(data, actor) {
      api.requireRole(['ADMIN']);
      const name = (data.name || '').trim(); if (!name) throw new Error('Nama grup modifikasi wajib diisi.');
      const options = (data.options || []).map(o => ({ id: o.id || uid('mo'), name: (o.name || '').trim(), price: Math.max(0, Math.round(Number(o.price) || 0)) })).filter(o => o.name);
      if (!options.length) throw new Error('Tambahkan minimal satu opsi.');
      let g = data.id ? DB.modifierGroups.find(x => x.id === data.id) : null;
      if (g) Object.assign(g, { name, required: !!data.required, minSel: Math.max(0, data.minSel | 0), maxSel: Math.max(1, data.maxSel | 0 || 1), options });
      else { g = { id: uid('mg'), name, required: !!data.required, minSel: Math.max(0, data.minSel | 0), maxSel: Math.max(1, data.maxSel | 0 || 1), options }; DB.modifierGroups.push(g); }
      api.log('MODIFIER_SAVE', name, actor.name); persist(); return g;
    },

    /* ----- admin: tables / staff / inventory / expenses / settings ----- */
    saveTable(data, actor) {
      api.requireRole(['ADMIN']);
      const name = (data.name || '').trim(); if (!name) throw new Error('Nama meja wajib diisi.');
      let t = data.id ? api.table(data.id) : null;
      if (t) Object.assign(t, { name, zone: data.zone || t.zone, seats: Math.max(1, data.seats | 0 || 2), active: !!data.active });
      else { t = { id: uid('t'), code: Math.random().toString(36).slice(2, 7).toUpperCase(), name, zone: data.zone || 'Main Dining Hall', seats: Math.max(1, data.seats | 0 || 2), status: 'AVAILABLE', active: true, scans: 0 }; DB.tables.push(t); }
      api.log('TABLE_SAVE', name, actor.name); persist(); return t;
    },
    regenerateTableCode(id, actor) {
      api.requireRole(['ADMIN']);
      const t = api.table(id); if (!t) throw new Error('Table not found.');
      t.code = Math.random().toString(36).slice(2, 7).toUpperCase();
      api.log('TABLE_QR_ROTATE', t.name, actor.name); persist(); return t;
    },
    saveUser(data, actor) {
      api.requireRole(['ADMIN']);
      const name = (data.name || '').trim(); const email = (data.email || '').trim();
      if (!name || !email) throw new Error('Nama dan email wajib diisi.');
      if (!['ADMIN', 'CASHIER', 'KITCHEN'].includes(data.role)) throw new Error('Peran tidak valid.');
      let u = data.id ? DB.users.find(x => x.id === data.id) : null;
      if (u) {
        if (u.id === actor.id && (!data.active || data.role !== 'ADMIN')) throw new Error('Anda tidak bisa menurunkan peran atau menonaktifkan akun sendiri.');
        Object.assign(u, { name, email, role: data.role, active: !!data.active, title: data.title || u.title });
        if (data.password) u.password = data.password;
      } else {
        if (DB.users.some(x => x.email.toLowerCase() === email.toLowerCase())) throw new Error('Email sudah terdaftar.');
        if (!data.password || data.password.length < 6) throw new Error('Password minimal 6 karakter.');
        u = { id: uid('u'), name, email, password: data.password, role: data.role, active: data.active !== false, title: data.title || data.role };
        DB.users.push(u);
      }
      api.log('STAFF_SAVE', name + ' · ' + data.role, actor.name); persist(); return u;
    },
    saveInventory(data, actor) {
      api.requireRole(['ADMIN']);
      const name = (data.name || '').trim(); if (!name) throw new Error('Nama bahan wajib diisi.');
      const stock = Number(data.stock); if (!isFinite(stock) || stock < 0) throw new Error('Stok harus angka valid.');
      let it = data.id ? DB.inventory.find(x => x.id === data.id) : null;
      if (it) Object.assign(it, { name, category: data.category || 'Other', stock, unit: data.unit || 'pcs', minStock: Math.max(0, Number(data.minStock) || 0) });
      else { it = { id: uid('i'), name, category: data.category || 'Other', stock, unit: data.unit || 'pcs', minStock: Math.max(0, Number(data.minStock) || 0) }; DB.inventory.push(it); }
      api.log('INVENTORY_SAVE', name + ' · ' + stock + ' ' + it.unit, actor.name); persist(); return it;
    },
    restock(id, qty, actor) {
      api.requireRole(['ADMIN']);
      const it = DB.inventory.find(x => x.id === id); if (!it) throw new Error('Item not found.');
      it.stock = +(it.stock + qty).toFixed(2);
      api.log('INVENTORY_RESTOCK', it.name + ' · +' + qty + ' ' + it.unit, actor.name); persist(); return it;
    },
    saveExpense(data, actor) {
      api.requireRole(['ADMIN']);
      const desc = (data.desc || '').trim(); const amount = Math.round(Number(data.amount));
      if (!desc) throw new Error('Deskripsi wajib diisi.');
      if (!isFinite(amount) || amount <= 0) throw new Error('Nominal harus angka positif.');
      const e = { id: uid('x'), desc, category: data.category || 'Other', amount, date: data.date || todayKey(), note: data.note || '' };
      DB.expenses.push(e);
      api.log('EXPENSE_ADD', desc + ' · ' + fmtRp(amount), actor.name); persist(); return e;
    },
    removeExpense(id, actor) {
      api.requireRole(['ADMIN']);
      const i = DB.expenses.findIndex(x => x.id === id); if (i < 0) throw new Error('Expense not found.');
      const [e] = DB.expenses.splice(i, 1);
      api.log('EXPENSE_DELETE', e.desc + ' · ' + fmtRp(e.amount), actor.name); persist();
    },
    saveSettings(data, actor) {
      api.requireRole(['ADMIN']);
      const s = DB.settings;
      const taxRate = Number(data.taxRate); const serviceRate = Number(data.serviceRate);
      if (!isFinite(taxRate) || taxRate < 0 || taxRate > 0.5) throw new Error('Tarif pajak harus 0 sampai 50%.');
      if (!isFinite(serviceRate) || serviceRate < 0 || serviceRate > 0.5) throw new Error('Tarif layanan harus 0 sampai 50%.');
      Object.assign(s, { cafeName: (data.cafeName || s.cafeName).trim(), branch: data.branch || s.branch, taxRate, serviceRate, taxLabel: data.taxLabel || s.taxLabel, serviceLabel: data.serviceLabel || s.serviceLabel, wifi: data.wifi || s.wifi });
      api.log('SETTINGS_SAVE', 'Cafe settings updated', actor.name); persist(); return s;
    },

    /* ----- derived metrics (always from real records) ----- */
    paymentsList() {
      const out = [];
      DB.orders.forEach(o => o.payments.forEach(p => out.push(Object.assign({ orderNumber: o.number, orderId: o.id, tableName: o.tableName }, p))));
      return out.sort((a, b) => new Date(b.at) - new Date(a.at));
    },
    todayOrders() { const t = todayKey(); return DB.orders.filter(o => dayKey(o.createdAt) === t); },
    metrics(rangeDays) {
      const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (rangeDays - 1));
      const os = DB.orders.filter(o => new Date(o.createdAt) >= from && o.paymentStatus === 'PAID');
      const revenue = os.reduce((s, o) => s + o.total, 0);
      const todays = api.todayOrders();
      const paidToday = todays.filter(o => o.paymentStatus === 'PAID');
      const salesToday = paidToday.reduce((s, o) => s + o.total, 0);
      const activeTables = DB.tables.filter(t => ['OCCUPIED', 'ORDERING', 'WAITING'].includes(t.status)).length;
      const activeOrders = todays.filter(o => ['NEW', 'PREPARING', 'READY'].includes(o.orderStatus));
      const qrisShare = paidToday.length ? Math.round(paidToday.filter(o => o.paymentMethod === 'QRIS').length / paidToday.length * 100) : 0;
      const exp = DB.expenses.filter(e => new Date(e.date) >= from).reduce((s, e) => s + e.amount, 0);
      return {
        revenue, orders: os.length, aov: os.length ? Math.round(revenue / os.length) : 0,
        salesToday, ordersToday: todays.length, activeTables, activeOrders: activeOrders.length,
        pendingKitchen: todays.filter(o => ['NEW', 'PREPARING'].includes(o.orderStatus)).length,
        qrisShare, expense: exp
      };
    },
    topProducts(rangeDays, limit) {
      const from = new Date(); from.setDate(from.getDate() - (rangeDays - 1));
      const map = {};
      DB.orders.filter(o => new Date(o.createdAt) >= from && o.paymentStatus === 'PAID').forEach(o => o.items.forEach(i => {
        map[i.name] = map[i.name] || { name: i.name, qty: 0, revenue: 0 };
        map[i.name].qty += i.qty; map[i.name].revenue += i.lineTotal;
      }));
      return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, limit || 5);
    },
    revenueByDay(rangeDays) {
      const out = [];
      for (let d = rangeDays - 1; d >= 0; d--) {
        const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - d);
        const k = dayKey(day);
        const os = DB.orders.filter(o => dayKey(o.createdAt) === k && o.paymentStatus === 'PAID');
        out.push({ key: k, label: day.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), revenue: os.reduce((s, o) => s + o.total, 0), orders: os.length });
      }
      return out;
    },
    revenueByCategory(rangeDays) {
      const from = new Date(); from.setDate(from.getDate() - (rangeDays - 1));
      const map = {};
      DB.orders.filter(o => new Date(o.createdAt) >= from && o.paymentStatus === 'PAID').forEach(o => o.items.forEach(i => {
        const p = DB.products.find(x => x.id === i.productId);
        const cname = p ? (DB.categories.find(c => c.id === p.categoryId) || {}).name || 'Other' : 'Other';
        map[cname] = (map[cname] || 0) + i.lineTotal;
      }));
      return Object.entries(map).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
    },
    paymentsByMethod(rangeDays) {
      const from = new Date(); from.setDate(from.getDate() - (rangeDays - 1));
      const map = { QRIS: 0, EWALLET: 0, CARD: 0, CASH: 0 };
      DB.orders.filter(o => new Date(o.createdAt) >= from && o.paymentStatus === 'PAID').forEach(o => { map[o.paymentMethod] = (map[o.paymentMethod] || 0) + o.total; });
      return Object.entries(map).map(([method, amount]) => ({ method, amount })).filter(x => x.amount > 0);
    },
    customers() {
      const map = {};
      DB.orders.filter(o => o.paymentStatus === 'PAID').forEach(o => {
        const key = o.guestName || 'Tamu Walk-in';
        map[key] = map[key] || { name: key, orders: 0, spend: 0, last: o.createdAt };
        map[key].orders++; map[key].spend += o.total;
        if (new Date(o.createdAt) > new Date(map[key].last)) map[key].last = o.createdAt;
      });
      return Object.values(map).sort((a, b) => b.spend - a.spend);
    },
    lowStock() { return DB.inventory.filter(i => i.stock <= i.minStock); },
    tableStatus(t) {
      const open = DB.orders.find(o => o.tableId === t.id && ['PENDING_PAYMENT', 'NEW', 'PREPARING', 'READY', 'SERVED'].includes(o.orderStatus));
      if (!open) return { key: 'AVAILABLE', label: 'Siap', cls: 'ok' };
      if (open.orderStatus === 'PENDING_PAYMENT') return { key: 'PENDING_PAYMENT', label: 'Bayar Tunai', cls: 'warn', order: open };
      if (open.orderStatus === 'READY') return { key: 'READY', label: 'Makanan Siap', cls: 'info', order: open };
      if (open.orderStatus === 'SERVED') return { key: 'SERVED', label: 'Diantar', cls: 'ok', order: open };
      return { key: open.orderStatus, label: open.orderStatus === 'NEW' ? 'Pesanan Baru' : 'Sedang Diproses Dapur', cls: 'busy', order: open };
    }
  };

  load();
  window.KursiDB = api;
})();
