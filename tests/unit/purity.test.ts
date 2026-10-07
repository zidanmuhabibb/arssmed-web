/** PRD §9.2 prinsip 1: pustaka inti murni — tanpa React, Next, Supabase, atau akses jaringan/DOM. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LIBS = ["lib/classification", "lib/stats", "lib/transitions"];
const FORBIDDEN = /from\s+["'](react|react-dom|next(\/.*)?|next-intl.*|@supabase\/.*|idb)["']|\b(fetch|window|document|localStorage)\s*[.(]/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });
}

describe("pustaka inti murni", () => {
  it.each(LIBS.flatMap(files))("%s", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(FORBIDDEN);
  });
});
