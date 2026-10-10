// Kartu penanda AR (FR-15, PRD §13): gambar pola kontras kaya fitur per unit, dikompilasi menjadi
// target MindAR (.mind) di Chromium tanpa layar, lalu dicetak ke PDF A4 untuk halaman Panduan.
// `pnpm markers:build`. Hasil di-commit: public/markers/u<n>.png, u<n>.mind, kartu-penanda.pdf.
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const root = process.cwd();
const VENDOR = join(root, "public/vendor/mindar-1.2.5");
const OUT = join(root, "public/markers");
const msgs = JSON.parse(readFileSync(join(root, "messages/id.json"), "utf8"));
const UNITS = ["u1", "u2", "u3", "u4", "u5", "u6"];

// Halaman pembangkit: pola deterministik (benih per unit) + kompilasi MindAR.
const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import { Compiler } from "/vendor/mindar-image.prod.js";
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
window.draw = (n) => {
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d"), r = rng(20261008 + n * 7919);
  g.fillStyle = "#fff"; g.fillRect(0, 0, S, S);
  const ink = () => ["#111", "#111", "#333", "#777"][Math.floor(r() * 4)];
  for (let i = 0; i < 90; i++) {
    const x = r() * S, y = r() * S, s = 18 + r() ** 2 * 200, k = Math.floor(r() * 5);
    g.save(); g.translate(x, y); g.rotate(r() * Math.PI * 2); g.fillStyle = g.strokeStyle = ink(); g.lineWidth = 4 + r() * 10;
    g.beginPath();
    if (k === 0) { g.moveTo(0, -s); g.lineTo(s * 0.9, s * 0.7); g.lineTo(-s * 0.8, s * 0.5); g.closePath(); g.fill(); }
    else if (k === 1) { g.arc(0, 0, s / 2, 0, Math.PI * 2); r() < 0.5 ? g.fill() : g.stroke(); }
    else if (k === 2) { g.rect(-s / 2, -s / 4, s, s / 2); r() < 0.6 ? g.fill() : g.stroke(); }
    else if (k === 3) { for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2, b = a + Math.PI / 5; g.lineTo(Math.cos(a) * s / 2, Math.sin(a) * s / 2); g.lineTo(Math.cos(b) * s / 5, Math.sin(b) * s / 5); } g.closePath(); g.fill(); }
    else { g.moveTo(-s, 0); for (let j = 1; j < 6; j++) g.lineTo(-s + (j * 2 * s) / 5, (r() - 0.5) * s); g.stroke(); }
    g.restore();
  }
  // Angka unit besar di pojok: membantu orientasi dan menambah fitur unik.
  g.fillStyle = "#000"; g.font = "bold 300px sans-serif"; g.textBaseline = "top"; g.fillText(String(n), 40, 30);
  g.lineWidth = 28; g.strokeStyle = "#000"; g.strokeRect(14, 14, S - 28, S - 28);
  return c.toDataURL("image/png");
};
window.compile = async (dataUrl) => {
  const img = new Image(); img.src = dataUrl; await img.decode();
  const compiler = new Compiler();
  await compiler.compileImageTargets([img], () => {});
  const buf = await compiler.exportData();
  let s = ""; for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
};
window.ready = true;
</script>`;

const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") return res.writeHead(200, { "Content-Type": "text/html" }).end(PAGE);
  const file = normalize(join(VENDOR, (req.url ?? "").replace(/^\/vendor\//, "")));
  if (!file.startsWith(VENDOR)) return res.writeHead(403).end();
  let body;
  try {
    body = readFileSync(file);
  } catch {
    return res.writeHead(404).end();
  }
  res.writeHead(200, { "Content-Type": extname(file) === ".js" ? "text/javascript" : "application/octet-stream" }).end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.ready === true);

mkdirSync(OUT, { recursive: true });
const pdf = await PDFDocument.create();
pdf.setTitle("ARSSMED — Kartu penanda AR");
pdf.setCreator("scripts/build-markers.mjs");
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const font = await pdf.embedFont(StandardFonts.Helvetica);
const mm = (v) => (v * 72) / 25.4;

for (const [i, u] of UNITS.entries()) {
  const n = i + 1;
  const png = await page.evaluate((n) => window.draw(n), n);
  const pngBuf = Buffer.from(png.split(",")[1], "base64");
  writeFileSync(join(OUT, `${u}.png`), pngBuf);
  const t0 = Date.now();
  const mind = await page.evaluate((d) => window.compile(d), png);
  writeFileSync(join(OUT, `${u}.mind`), Buffer.from(mind, "base64"));
  console.log(`${u}: penanda dikompilasi (${Math.round(Buffer.from(mind, "base64").length / 1024)} KB, ${Date.now() - t0} ms)`);

  // A4 potret: kartu 160 mm di tengah, judul dan petunjuk di bawahnya (di luar area pelacakan).
  const p = pdf.addPage([mm(210), mm(297)]);
  const img = await pdf.embedPng(pngBuf);
  const size = mm(160);
  const x = (mm(210) - size) / 2;
  const y = mm(297) - mm(30) - size;
  p.drawImage(img, { x, y, width: size, height: size });
  const title = `Unit ${n} · ${msgs.units[u].title}`;
  p.drawText("ARSSMED · Kartu penanda AR", { x, y: y - mm(12), size: 11, font, color: rgb(0.27, 0.35, 0.43) });
  p.drawText(title, { x, y: y - mm(22), size: 20, font: bold, color: rgb(0.08, 0.16, 0.24) });
  const lines = [
    "Buka unit ini di ARSSMED, pilih \"AR dengan kartu\", lalu arahkan kamera ke gambar di atas.",
    "Cetak tanpa diperkecil (skala 100%). Letakkan di meja yang terang dan tidak mengilap.",
    "Kamera hanya dipakai di perangkat untuk mengenali kartu; tidak ada foto atau video yang disimpan.",
  ];
  lines.forEach((l, k) => p.drawText(l, { x, y: y - mm(34) - k * mm(6), size: 10, font, color: rgb(0.08, 0.16, 0.24) }));
}
writeFileSync(join(OUT, "kartu-penanda.pdf"), await pdf.save({ useObjectStreams: true }));
await browser.close();
server.close();

// Catat di manifest aset (karya sendiri).
const manifestPath = join(root, "assets/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const own = { license: "Karya sendiri — pola prosedural oleh scripts/build-markers.mjs", source_url: "https://github.com/zidanmuhabibb/arssmed-web", attribution: "Kartu penanda ARSSMED", review_status: "reviewed" };
const entries = [
  ...UNITS.flatMap((u) => [
    { id: `marker-${u}-png`, kind: "marker", file: `public/markers/${u}.png`, ...own },
    { id: `marker-${u}-mind`, kind: "marker", file: `public/markers/${u}.mind`, ...own },
  ]),
  { id: "marker-pdf", kind: "marker", file: "public/markers/kartu-penanda.pdf", ...own },
];
manifest.assets = [...manifest.assets.filter((a) => !a.id.startsWith("marker-")), ...entries];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("selesai: public/markers/");
