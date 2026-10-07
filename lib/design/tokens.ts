/**
 * Salinan token warna untuk kode non-CSS (kanvas 3D, grafik, test kontras).
 * Harus sama dengan app/globals.css — dijaga oleh tokens.test.ts.
 */
export const light = {
  kertas: "#eef3f6",
  permukaan: "#ffffff",
  tinta: "#14283c",
  "tinta-2": "#44586d",
  garis: "#cdd8e1",
  matahari: "#f5a623",
  laut: "#2a7fba",
  "laut-teks": "#1f6aa0",
  panggung: "#0b1626",
  "panggung-tinta": "#e4ecf2",
  "panggung-tinta-2": "#9fb2c4",
} as const;

export const dark = {
  kertas: "#0e1a27",
  permukaan: "#15253a",
  tinta: "#e4ecf2",
  "tinta-2": "#a9b9c8",
  garis: "#263a51",
  laut: "#6cb4e8",
  "laut-teks": "#6cb4e8",
} as const;

export const category = {
  sc: "#1f8a70",
  m: "#c23b4e",
  e: "#b7791f",
  lk: "#5b6b7f",
  lc: "#7a5bb5",
} as const;

export type PlanetKey =
  | "matahari"
  | "merkurius"
  | "venus"
  | "bumi"
  | "mars"
  | "jupiter"
  | "saturnus"
  | "uranus"
  | "neptunus";

export const planet: Record<PlanetKey, string> = {
  matahari: "#f5a623",
  merkurius: "#8c8c8c",
  venus: "#d9a441",
  bumi: "#2a7fba",
  mars: "#c1572f",
  jupiter: "#b88b63",
  saturnus: "#cdb27a",
  uranus: "#6bbfc9",
  neptunus: "#3f5fc4",
};
