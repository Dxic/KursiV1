# KURSI — Scan. Order. Enjoy.

Platform self-ordering dine-in & operasional cafe. Customer scan QR di meja, pesan dan bayar dari HP; kitchen menerima ticket live; cashier mengelola register; owner melihat seluruh bisnis dari dashboard admin.

MVP/portfolio project — vanilla JS (no build step), PWA-ready, mobile-first.

## Menjalankan

Tidak butuh instalasi dependencies. Serve folder ini secara static:

```bash
# Python
python -m http.server 8080

# atau Node
npx serve .
```

Buka `http://localhost:8080`. Bisa juga di-deploy langsung ke Netlify / Vercel / GitHub Pages (static).

## Akun demo

| Peran | Email | Password |
|---|---|---|
| Admin / Owner | `admin@kursi.local` | `kursi123` |
| Cashier | `cashier@kursi.local` | `kursi123` |
| Kitchen | `kitchen@kursi.local` | `kursi123` |

Tombol **Reset demo data** di landing page mengembalikan seluruh data ke seed awal.

## Alur demo (3 tab sekaligus untuk realtime)

1. **Customer** — `/#/t/A7K29` : menu → product detail + modifier (ukuran wajib, milk, sugar, ice) → cart → metode bayar (QRIS / E-Wallet / Card / Cash) → *Simulate Payment* → tracking live.
2. **Kitchen** — `/#/login` sebagai kitchen → KDS: *Start Preparing* → *Mark Ready* → *Complete*. Tab customer ter-update otomatis.
3. **Cashier / Admin** — `/#/login` : overview shift, orders (accept cash, transfer table, void/refund, print receipt), floor map, payments, receipts; admin tambah: products, categories, modifiers, inventory, tables & QR, staff, customers, expenses, reports, audit, settings.

## Yang ditegakkan (business rules)

- **State machine order**: `PENDING_PAYMENT → (PAID) → NEW → PREPARING → READY → COMPLETED`, dengan `CANCELLED`. Transisi ilegal ditolak server-side.
- **Anti double-payment**: order berbayar tidak bisa dibayar ulang; nominal wajib sama dengan total.
- **Snapshot harga**: nama & harga produk/modifier disalin ke order — edit harga tidak mengubah histori.
- **Validasi server-side**: ketersediaan produk, aturan modifier (required/max), harga, dan meja divalidasi ulang saat checkout.
- **Isolasi meja**: sesi QR per meja; tracking hanya untuk order sesi sendiri; cash hanya dikonfirmasi kasir/admin; RBAC di setiap aksi.
- **Dashboard dari data nyata**: semua metrik dihitung dari record (tidak ada angka hardcode).

## Struktur

```
app/
├── index.html            shell + manifest PWA
├── manifest.webmanifest  installable PWA config
├── sw.js                 service worker (offline app shell)
├── css/styles.css        design system (warm cafe, liquid glass accents)
├── js/
│   ├── data.js           seed + store + business logic ("server")
│   ├── ui.js             icons, toast, modal, badges, SVG charts, QR, receipt
│   ├── customer.js       customer app (mobile-first)
│   ├── staff.js          login, cashier POS, kitchen KDS, admin modules
│   └── app.js            hash router + realtime sync
└── assets/               product photography + PWA icons
```

## Catatan arsitektur

- Single-writer data layer: semua mutasi lewat `KursiDB` (validasi → mutate → persist ke `localStorage`), meniru validasi server.
- Realtime antar-tab via `storage` events + polling 5 detik untuk view operasional.
- Pembayaran & QRIS bersifat simulasi sesuai MVP (PRD §11, §48).
- Roadmap V2: backend multi-device, QRIS nyata, printer thermal, customer accounts & loyalty.
