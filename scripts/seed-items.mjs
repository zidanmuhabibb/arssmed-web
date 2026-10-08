// Bank soal tes → migrasi Supabase (PRD §6.1 `seed:items`). Membaca data/items.json dan data/rule-sets/*.json.
//   pnpm seed:items         → perbarui berkas *_items.sql terakhir (sebelum dirilis)
//   pnpm seed:items --new   → migrasi baru (mis. setelah test_version dinaikkan dan migrasi lama sudah dijalankan)
import { build } from "esbuild";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/migrations";
const res = await build({ entryPoints: ["lib/tes/items-sql-data.ts"], bundle: true, write: false, format: "esm", platform: "node", tsconfig: "tsconfig.json", logLevel: "error" });
const mod = await import(`data:text/javascript;base64,${Buffer.from(res.outputFiles[0].text).toString("base64")}`);
const sql = mod.currentItemsSql();
const existing = readdirSync(dir).filter((f) => /_items\.sql$/.test(f)).sort();
let file = existing.at(-1);
if (!file || process.argv.includes("--new")) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  file = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}_items.sql`;
}
writeFileSync(join(dir, file), sql);
console.log(`Bank soal ditulis ke ${join(dir, file)} (${mod.ITEMS.items.length} butir, versi ${mod.ITEMS.test_version})`);
