// Membangun public/sw.js dari app/sw.ts (DECISIONS.md D-007).
// Serwist untuk Turbopack memakai Route Handler yang tidak cocok dengan
// cacheComponents, jadi SW dibundel terpisah sebelum `next build`.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

function revision() {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return String(Date.now());
  }
}

const rev = process.env.VERCEL_GIT_COMMIT_SHA || revision();

// Hanya berkas yang namanya stabil. Aset Next ber-hash di-cache saat dipakai
// oleh defaultCache (StaleWhileRevalidate/CacheFirst).
const precache = [
  { url: "/offline", revision: rev },
  { url: "/icons/icon.svg", revision: rev },
  { url: "/icons/icon-192.png", revision: rev },
];

mkdirSync("public", { recursive: true });
await build({
  entryPoints: ["app/sw.ts"],
  outfile: "public/sw.js",
  bundle: true,
  format: "iife",
  minify: true,
  target: ["es2020"],
  platform: "browser",
  define: {
    "self.__SW_MANIFEST": JSON.stringify(precache),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV === "development" ? "development" : "production"),
  },
  logLevel: "info",
});
