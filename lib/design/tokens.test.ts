import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../a11y/contrast";
import { category, dark, light, planet } from "./tokens";

const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));

function cssVar(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  return m?.[1]?.toLowerCase();
}

describe("token CSS dan TS sinkron", () => {
  it.each(Object.entries(light))("--%s (terang)", (name, value) => {
    expect(cssVar(rootBlock, name)).toBe(value);
  });
  it.each(Object.entries(category))("--%s (kategori)", (name, value) => {
    expect(cssVar(rootBlock, name)).toBe(value);
  });
  it.each(Object.entries(planet))("--planet-%s", (name, value) => {
    expect(cssVar(rootBlock, `planet-${name}`)).toBe(value);
  });
  it("token gelap ada di blok data-theme=dark", () => {
    const start = css.indexOf(':root[data-theme="dark"]');
    const block = css.slice(start, css.indexOf("}", start));
    for (const [name, value] of Object.entries(dark)) {
      expect(cssVar(block, name), name).toBe(value);
    }
  });
});

describe("kontras teks WCAG AA (≥ 4,5:1)", () => {
  const AA = 4.5;
  it.each([
    ["tinta di kertas", light.tinta, light.kertas],
    ["tinta-2 di kertas", light["tinta-2"], light.kertas],
    ["tinta-2 di permukaan", light["tinta-2"], light.permukaan],
    ["tinta di tombol matahari", light.tinta, light.matahari],
    ["laut-teks di kertas", light["laut-teks"], light.kertas],
    ["laut-teks di permukaan", light["laut-teks"], light.permukaan],
    ["panggung-tinta di panggung", light["panggung-tinta"], light.panggung],
    ["panggung-tinta-2 di panggung", light["panggung-tinta-2"], light.panggung],
    ["gelap: tinta di kertas", dark.tinta, dark.kertas],
    ["gelap: tinta-2 di kertas", dark["tinta-2"], dark.kertas],
    ["gelap: tinta-2 di permukaan", dark["tinta-2"], dark.permukaan],
    ["gelap: laut-teks di kertas", dark["laut-teks"], dark.kertas],
  ])("%s", (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });
});

describe("benda langit terlihat di panggung (objek grafis ≥ 3:1, WCAG 1.4.11)", () => {
  it.each(Object.entries(planet))("%s", (_name, color) => {
    expect(contrastRatio(color, light.panggung)).toBeGreaterThanOrEqual(3);
  });
});

describe("contrastRatio", () => {
  it("hitam-putih = 21", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
  });
  it("simetris", () => {
    expect(contrastRatio("#14283c", "#eef3f6")).toBeCloseTo(contrastRatio("#eef3f6", "#14283c"), 10);
  });
  it("menolak hex tidak valid", () => {
    expect(() => contrastRatio("biru", "#fff")).toThrow();
  });
});
