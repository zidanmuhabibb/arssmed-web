// Membangun model AR: public/models/<id>.glb (Android Scene Viewer) dan .usdz (iPhone Quick Look),
// memeriksa batas ukuran (PRD §12.1), lalu mencatatnya di assets/manifest.json. `pnpm assets:build`.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = process.cwd();
const out = join(tmpdir(), `arssmed-ar-${process.pid}.mjs`);
await build({
  entryPoints: [join(root, "lib/ar/models-entry.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  alias: { "@": root },
  logLevel: "error",
});
const { allSpecs, buildModel } = await import(pathToFileURL(out).href);

// Batas PRD §12.1: ≤ 3 MB per objek, ≤ 15 MB per unit. Kita pasang batas lebih ketat.
const MAX_FILE = 1.5 * 1024 * 1024;
const TEX = 512; // tekstur AR 512×256 cukup untuk benda selebar ±30 cm

const cache = new Map();
async function loadTexture(id) {
  if (!cache.has(id)) {
    const buf = await sharp(join(root, "public/textures", `${id}.webp`)).resize(TEX, TEX / 2, { fit: "fill" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    cache.set(id, new Uint8Array(buf));
  }
  return cache.get(id);
}

mkdirSync(join(root, "public/models"), { recursive: true });
const manifestPath = join(root, "assets/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.assets = manifest.assets.filter((a) => a.kind !== "model");
let failed = false;
for (const spec of allSpecs()) {
  const m = await buildModel(spec, loadTexture);
  for (const [ext, bytes] of [["glb", m.glb], ["usdz", m.usdz]]) {
    const file = `public/models/${m.id}.${ext}`;
    writeFileSync(join(root, file), bytes);
    const kb = bytes.length / 1024;
    if (bytes.length > MAX_FILE) {
      failed = true;
      console.error(`TERLALU BESAR: ${file} ${kb.toFixed(0)} KB`);
    }
    manifest.assets.push({
      id: `model-${m.id}-${ext}`,
      kind: "model",
      file,
      license: "Karya sendiri — dibuat dari bentuk dasar dan tekstur prosedural oleh scripts/build-ar-models.mjs",
      source_url: "https://github.com/zidanmuhabibb/arssmed-web",
      attribution: "Model ilustratif ARSSMED",
      review_status: "reviewed",
    });
  }
  console.log(`${m.id}: ${m.triangles} segitiga, ${(m.glb.length / 1024).toFixed(0)} KB glb, ${(m.usdz.length / 1024).toFixed(0)} KB usdz, ${m.size.map((x) => x.toFixed(2)).join("×")} m`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
if (failed) process.exit(1);
