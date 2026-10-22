// KopiKita backend: Node.js (tanpa dependency) + SQLite bawaan Node 22
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "kopikita-admin"; // WAJIB diganti saat deploy
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, "kopikita.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS menu(id INTEGER PRIMARY KEY, category TEXT NOT NULL, name TEXT NOT NULL, price_m INTEGER NOT NULL, price_l INTEGER, available INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, buyer TEXT NOT NULL, total INTEGER NOT NULL, status TEXT DEFAULT 'baru', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), menu_id INTEGER, name TEXT, size TEXT, price INTEGER, qty INTEGER);`);

if (!db.prepare("SELECT COUNT(*) n FROM menu").get().n) {
  const SEED = [
    ["Ice Drink", [["Milo",10,12],["Taro",10,15],["Coklat",10,12],["Milk Oreo",10,15],["Brown Sugar",10,15]]],
    ["Choco Series", [["Choco (biskuit/caramel/hazelnut)",10,15],["Taro",10,15],["Nutella",15,18]]],
    ["Coffee Series", [["Moccachino",10,15],["Ice Kopi Susu",15,18],["Ice Kopi Gula Aren",15,18]]],
    ["Tea Series", [["Thai Tea",10,12],["Green Tea",10,12],["Lemon",10,12],["Cheese Tea",10,12]]],
    ["Hot Drink", [["Kopi Susu",10],["Kopi Hitam",10],["Coklat",10]]],
    ["Topping", [["Oreo",2],["Regal",2],["Boba",2],["Cincau",2],["Cheese Cream",2]]],
    ["Snacks", [["French Fries",15],["Croissant",15],["Sandwich",15],["Beef Toast",15]]],
  ];
  const ins = db.prepare("INSERT INTO menu(category,name,price_m,price_l) VALUES(?,?,?,?)");
  SEED.forEach(([c, items]) => items.forEach(([n, m, l]) => ins.run(c, n, m * 1000, l ? l * 1000 : null)));
}

const STATUS = ["baru", "diproses", "selesai", "batal"];
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
const hits = new Map(); // rate limit sederhana: 10 pesanan/menit/IP

const send = (res, code, data) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
const readBody = (req) => new Promise((ok, no) => {
  let b = ""; req.on("data", (c) => { b += c; if (b.length > 10000) { no(); req.destroy(); } });
  req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { no(); } });
});
const isAdmin = (req) => {
  const a = Buffer.from((req.headers.authorization || "").replace("Bearer ", "")), b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const orderWithItems = (o) => ({ ...o, items: db.prepare("SELECT name,size,price,qty FROM order_items WHERE order_id=?").all(o.id) });

async function api(req, res, url) {
  const m = req.method, p = url.pathname;

  if (m === "GET" && p === "/api/menu") { // format: [{c, i:[[nama, M(ribu), L(ribu)|null, id]]}]
    const out = new Map();
    db.prepare("SELECT * FROM menu WHERE available=1 ORDER BY id").all().forEach((r) => {
      if (!out.has(r.category)) out.set(r.category, []);
      out.get(r.category).push([r.name, r.price_m / 1000, r.price_l ? r.price_l / 1000 : null, r.id]);
    });
    return send(res, 200, [...out].map(([c, i]) => ({ c, i })));
  }

  if (m === "POST" && p === "/api/orders") {
    const ip = req.socket.remoteAddress, now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
    if (recent.length >= 10) return send(res, 429, { error: "Terlalu banyak pesanan, coba lagi sebentar." });
    hits.set(ip, [...recent, now]);

    const { buyer, items } = await readBody(req);
    if (typeof buyer !== "string" || !buyer.trim() || buyer.length > 60) return send(res, 400, { error: "Nama pemesan tidak valid." });
    if (!Array.isArray(items) || !items.length || items.length > 50) return send(res, 400, { error: "Pesanan kosong." });

    let total = 0; const rows = [];
    for (const it of items) { // harga SELALU dihitung ulang dari database, bukan dari klien
      const r = db.prepare("SELECT * FROM menu WHERE id=? AND available=1").get(Number(it.id));
      const qty = Number(it.qty), size = it.size === "L" ? "L" : it.size === "M" ? "M" : "";
      if (!r || !Number.isInteger(qty) || qty < 1 || qty > 50) return send(res, 400, { error: "Item pesanan tidak valid." });
      const price = size === "L" && r.price_l ? r.price_l : r.price_m;
      if (size === "L" && !r.price_l) return send(res, 400, { error: r.name + " tidak punya ukuran L." });
      total += price * qty; rows.push([r.id, r.name, r.price_l ? size || "M" : "", price, qty]);
    }
    const code = "KK-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    db.exec("BEGIN");
    try {
      const { lastInsertRowid: oid } = db.prepare("INSERT INTO orders(code,buyer,total) VALUES(?,?,?)").run(code, buyer.trim(), total);
      const ins = db.prepare("INSERT INTO order_items(order_id,menu_id,name,size,price,qty) VALUES(?,?,?,?,?,?)");
      rows.forEach((r) => ins.run(oid, ...r));
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
    return send(res, 201, { code, total });
  }

  if (p.startsWith("/api/admin/")) {
    if (!isAdmin(req)) return send(res, 401, { error: "Token admin salah." });
    if (m === "GET" && p === "/api/admin/orders") return send(res, 200, db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 200").all().map(orderWithItems));
    if (m === "GET" && p === "/api/admin/stats") return send(res, 200, {
      ...db.prepare("SELECT COUNT(*) orders, COALESCE(SUM(total),0) revenue FROM orders WHERE status!='batal'").get(),
      top: db.prepare("SELECT i.name, SUM(i.qty) qty FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status!='batal' GROUP BY i.name ORDER BY qty DESC LIMIT 5").all(),
    });
    if (m === "GET" && p === "/api/admin/menu") return send(res, 200, db.prepare("SELECT id,category,name,available FROM menu ORDER BY id").all());
    const o = p.match(/^\/api\/admin\/orders\/(\d+)$/), mi = p.match(/^\/api\/admin\/menu\/(\d+)$/);
    if (m === "PATCH" && o) {
      const { status } = await readBody(req);
      if (!STATUS.includes(status)) return send(res, 400, { error: "Status tidak valid." });
      db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, o[1]); return send(res, 200, { ok: true });
    }
    if (m === "PATCH" && mi) {
      const { available } = await readBody(req);
      db.prepare("UPDATE menu SET available=? WHERE id=?").run(available ? 1 : 0, mi[1]); return send(res, 200, { ok: true });
    }
  }
  send(res, 404, { error: "Endpoint tidak ditemukan." });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    let f = path.join(__dirname, "public", url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname));
    if (!f.startsWith(path.join(__dirname, "public")) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { error: "Terjadi kesalahan server." }); }
}).listen(PORT, () => console.log("KopiKita jalan di http://localhost:" + PORT));
