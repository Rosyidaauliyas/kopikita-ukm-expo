# KopiKita (Fullstack)
Website kedai KopiKita, UKM Kependudukan UNESA – UKM Expo 25–28 Agustus 2025.

**Stack:** HTML/CSS/JavaScript (frontend) · Node.js `http` (backend REST API, tanpa dependency) · SQLite via `node:sqlite` (database).

## Menjalankan
```bash
# butuh Node.js >= 22.13
ADMIN_TOKEN=ganti-token-rahasia npm start
# buka http://localhost:3000  |  admin: http://localhost:3000/admin.html
```
Env: `PORT`, `ADMIN_TOKEN` (wajib diganti), `DB_PATH` (lokasi file database).

## API
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/menu` | Daftar menu tersedia (dari database) |
| POST | `/api/orders` | Buat pesanan `{buyer, items:[{id,size,qty}]}`; harga dihitung ulang di server |
| GET | `/api/admin/orders`, `/stats`, `/menu` | Data admin (Bearer token) |
| PATCH | `/api/admin/orders/:id` | Ubah status: baru/diproses/selesai/batal |
| PATCH | `/api/admin/menu/:id` | Ubah ketersediaan menu |

Tabel: `menu`, `orders`, `order_items`. Alur: pelanggan pesan → tersimpan di database (kode `KK-XXXXXX`) → pesan WhatsApp terisi otomatis → admin kelola status di `/admin.html`.

## Pengujian otomatis
```bash
npm test
```
9 tes (Node `node:test`, tanpa library tambahan) menjalankan server dengan database sementara, lalu menguji: menu dari database, pembuatan pesanan, harga dihitung server (harga kiriman klien diabaikan), validasi input (qty, ukuran, keranjang kosong), token admin, ubah status, menu dimatikan tidak bisa dipesan, proteksi path traversal, dan rate limiting.

## Deploy (Railway)
Deploy repo ini, set `ADMIN_TOKEN`, lalu pasang Volume dan set `DB_PATH=/data/kopikita.db` agar data tidak hilang saat redeploy. Netlify hanya cocok untuk versi statis karena tidak menjalankan server Node. Demo online di Netlify = versi statis (tanpa backend); backend dan dashboard admin dijalankan lokal atau di hosting yang mendukung Node.
