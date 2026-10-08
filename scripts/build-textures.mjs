// Membuat tekstur prosedural benda langit menjadi WebP (public/textures/<id>.webp).
// Deterministik: hasil sama setiap kali. Dijalankan oleh `pnpm build:textures`.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = process.cwd();
const out = join(tmpdir(), `arssmed-textures-${process.pid}.mjs`);
await build({
  entryPoints: [join(root, "lib/viewer/textures.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  alias: { "@": root },
  logLevel: "error",
});
const { paintSurface } = await import(pathToFileURL(out).href);
const content = JSON.parse(readFileSync(join(root, "content/celestial.json"), "utf8"));
const colors = (await import(pathToFileURL(join(root, "scripts/planet-colors.mjs")).href)).default;

mkdirSync(join(root, "public/textures"), { recursive: true });
const seen = new Set();
for (const unit of Object.values(content.units)) {
  for (const o of unit.objects) {
    if (o.scene || seen.has(o.id)) continue; // adegan U3–U6 memakai tekstur benda yang ada
    seen.add(o.id);
    const small = o.look === "asteroid" || o.look === "comet";
    const w = small ? 256 : 1024;
    const h = w / 2;
    const px = paintSurface(o.look, colors[o.color], w, h, o.id.length * 13 + 7);
    const file = join(root, "public/textures", `${o.id}.webp`);
    const buf = await sharp(Buffer.from(px.buffer), { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 82 }).toBuffer();
    writeFileSync(file, buf);
    console.log(`tekstur ${o.id}.webp ${(buf.length / 1024).toFixed(1)} KB`);
  }
}
