// Tes otomatis API KopiKita. Jalankan: npm test  (Node >= 22.13, tanpa library tambahan)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const os = require("node:os"), path = require("node:path"), fs = require("node:fs");

const PORT = 3900 + Math.floor(Math.random() * 90), BASE = `http://localhost:${PORT}`;
const TOKEN = "token-tes", DB = path.join(os.tmpdir(), `kopikita-test-${process.pid}.db`);
const AUTH = { Authorization: "Bearer " + TOKEN };
let server, menu = [], orderId, orderCode;

const call = (p, opt = {}) => fetch(BASE + p, { ...opt, headers: { "Content-Type": "application/json", ...(opt.headers || {}) } });
const post = (items, buyer = "Tester") => call("/api/orders", { method: "POST", body: JSON.stringify({ buyer, items }) });

before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT, DB_PATH: DB, ADMIN_TOKEN: TOKEN }, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((ok, no) => { server.stdout.on("data", (d) => String(d).includes("jalan") && ok()); server.on("exit", no); });
  menu = (await (await call("/api/menu")).json()).flatMap((c) => c.i); // [nama, M, L, id]
});
after(() => { server.kill(); for (const s of ["", "-wal", "-shm"]) fs.rmSync(DB + s, { force: true }); });

test("GET /api/menu mengembalikan 27 item dari database", () => assert.equal(menu.length, 27));

test("pesanan valid tersimpan, total dihitung server", async () => {
  const sized = menu.find((m) => m[2]); // punya ukuran L
  const r = await post([{ id: sized[3], size: "L", qty: 2 }]);
  assert.equal(r.status, 201);
  const d = await r.json();
  assert.match(d.code, /^KK-[0-9A-F]{6}$/);
  assert.equal(d.total, sized[2] * 1000 * 2);
  orderCode = d.code;
});

test("harga kiriman klien diabaikan (anti manipulasi)", async () => {
  const m = menu[0];
  const d = await (await post([{ id: m[3], size: "M", qty: 1, price: 1 }])).json();
  assert.equal(d.total, m[1] * 1000);
});

test("input tidak valid ditolak dengan 400", async () => {
  const single = menu.find((m) => !m[2]);
  assert.equal((await post([{ id: menu[0][3], size: "M", qty: 0 }])).status, 400, "qty 0");
  assert.equal((await post([{ id: single[3], size: "L", qty: 1 }])).status, 400, "ukuran L tidak ada");
  assert.equal((await post([])).status, 400, "keranjang kosong");
});

test("endpoint admin butuh token", async () => {
  assert.equal((await call("/api/admin/orders")).status, 401);
  assert.equal((await call("/api/admin/orders", { headers: { Authorization: "Bearer salah" } })).status, 401);
  const list = await (await call("/api/admin/orders", { headers: AUTH })).json();
  const o = list.find((x) => x.code === orderCode);
  assert.ok(o); assert.equal(o.status, "baru"); orderId = o.id;
});

test("admin bisa ubah status; status asal ditolak", async () => {
  const ok = await call(`/api/admin/orders/${orderId}`, { method: "PATCH", headers: AUTH, body: JSON.stringify({ status: "selesai" }) });
  assert.equal(ok.status, 200);
  const bad = await call(`/api/admin/orders/${orderId}`, { method: "PATCH", headers: AUTH, body: JSON.stringify({ status: "ngawur" }) });
  assert.equal(bad.status, 400);
});

test("menu yang dimatikan hilang dari /api/menu dan tidak bisa dipesan", async () => {
  const id = menu[1][3];
  await call(`/api/admin/menu/${id}`, { method: "PATCH", headers: AUTH, body: JSON.stringify({ available: false }) });
  const now = (await (await call("/api/menu")).json()).flatMap((c) => c.i);
  assert.ok(!now.some((m) => m[3] === id));
  assert.equal((await post([{ id, size: "M", qty: 1 }])).status, 400);
});

test("file server tidak bisa diakses lewat web (path traversal)", async () => {
  assert.equal((await fetch(BASE + "/server.js")).status, 404);
  assert.equal((await fetch(BASE + "/%2e%2e/server.js")).status, 404);
});

test("rate limiting: pesanan beruntun ditolak 429", async () => {
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await post([{ id: menu[0][3], size: "M", qty: 1 }])).status);
  assert.ok(codes.includes(429), "harus ada respons 429, dapat: " + codes.join(","));
});
