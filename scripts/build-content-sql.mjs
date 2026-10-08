// Tulis ulang migrasi konten dari content/*.json (PRD §13: konten di repo = satu sumber kebenaran).
//   pnpm content:sql          → perbarui berkas konten terakhir (sebelum dirilis)
//   pnpm content:sql --new    → buat migrasi konten BARU (setelah migrasi lama sudah dijalankan di produksi)
import { build } from "esbuild";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/migrations";
const res = await build({
  entryPoints: ["lib/learning/content-sql-data.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  tsconfig: "tsconfig.json",
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(res.outputFiles[0].text).toString("base64")}`);
const sql = mod.currentContentSql();

const existing = readdirSync(dir).filter((f) => /_content\.sql$/.test(f)).sort();
let file = existing.at(-1);
if (!file || process.argv.includes("--new")) {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, "0");
  file = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}_content.sql`;
}
writeFileSync(join(dir, file), sql);
console.log(`Konten ditulis ke ${join(dir, file)}`);
