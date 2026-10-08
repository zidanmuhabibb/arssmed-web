import celestial from "@/content/celestial.json";
import learning from "@/content/learning.json";
import messages from "@/messages/id.json";
import { UNITS } from "@/content/units";
import { buildContentSql, type ContentInput } from "./content-sql";

/** Masukan generator SQL dari berkas konten repo. */
export function contentInput(): ContentInput {
  const titles = messages.units as Record<string, { title: string; summary: string }>;
  return {
    units: UNITS.map((u) => ({ slug: u.slug, number: u.number, title: titles[u.key]!.title, summary: titles[u.key]!.summary })),
    learning,
    celestial,
  };
}

export function currentContentSql() {
  return buildContentSql(contentInput());
}
