/**
 * Membuat SQL "upsert" konten (unit, miskonsepsi, objek 3D, soal Tebak) dari berkas content/*.json.
 * Konten di repo adalah satu sumber kebenaran; DB menyimpan salinannya agar jawaban siswa
 * (prediction_responses, object_views, unit_progress) punya kunci asing yang sah.
 * Murni dan tanpa alias impor: dipakai oleh scripts/build-content-sql.ts dan unit test.
 */

export interface ContentInput {
  units: { slug: string; number: number; title: string; summary: string }[];
  learning: {
    misconceptions: { code: string; unit: string; statement: string; scientific: string }[];
    units: Record<
      string,
      {
        objectives: string[];
        predictions: {
          key: string;
          stem: string;
          options: { key: string; text: string }[];
          correct: string;
          misconception_option: string;
          misconception_code: string;
          reveal: string;
        }[];
      }
    >;
  };
  celestial: {
    review_status: string;
    sources: Record<string, { label: string; url: string }>;
    units: Record<string, { objects: { id: string; name: string; annotations: { source: string }[] }[] }>;
  };
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const unitId = (slug: string) => `(select id from public.units where slug = ${q(slug)})`;

export function buildContentSql(c: ContentInput): string {
  const out: string[] = [
    "-- DIBUAT OTOMATIS oleh `pnpm content:sql` dari content/*.json dan messages/id.json. Jangan disunting manual.",
    "-- Upsert idempoten: aman dijalankan ulang. Baris yang dihapus dari konten TIDAK dihapus dari DB",
    "-- (jawaban siswa tetap utuh); tandai saja di konten.",
    "",
  ];

  out.push("insert into public.units (slug, title, sort_order, learning_objectives, intro) values");
  out.push(
    c.units
      .map((u) => `  (${q(u.slug)}, ${q(u.title)}, ${u.number}, ${j(c.learning.units[u.slug]?.objectives ?? [])}, ${q(u.summary)})`)
      .join(",\n") +
      "\non conflict (slug) do update set title = excluded.title, sort_order = excluded.sort_order,\n  learning_objectives = excluded.learning_objectives, intro = excluded.intro;",
  );
  out.push("");

  out.push("insert into public.misconception_targets (code, statement, scientific_explanation, unit_id) values");
  out.push(
    c.learning.misconceptions.map((m) => `  (${q(m.code)}, ${q(m.statement)}, ${q(m.scientific)}, ${unitId(m.unit)})`).join(",\n") +
      "\non conflict (code) do update set statement = excluded.statement,\n  scientific_explanation = excluded.scientific_explanation, unit_id = excluded.unit_id;",
  );
  out.push("");

  const objects: string[] = [];
  for (const u of c.units) {
    (c.celestial.units[u.slug]?.objects ?? []).forEach((o, i) => {
      const src = c.celestial.sources[o.annotations[0]?.source ?? ""];
      objects.push(
        `  (${unitId(u.slug)}, ${q(o.id)}, ${q(o.name)}, ${i}, true, ${q("Karya sendiri — prosedural (lihat assets/manifest.json)")}, ${q("Ilustrasi ARSSMED")}, ${src ? q(src.url) : "null"}, ${q(c.celestial.review_status)})`,
      );
    });
  }
  out.push("insert into public.ar_objects (unit_id, slug, title, sort_order, required, license, attribution, source_url, review_status) values");
  out.push(
    objects.join(",\n") +
      "\non conflict (unit_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order,\n  required = excluded.required, license = excluded.license, attribution = excluded.attribution,\n  source_url = excluded.source_url, review_status = excluded.review_status;",
  );
  out.push("");

  const preds: string[] = [];
  for (const u of c.units) {
    (c.learning.units[u.slug]?.predictions ?? []).forEach((p, i) => {
      preds.push(
        `  (${q(p.key)}, ${unitId(u.slug)}, ${i}, ${q(p.stem)}, ${j(p.options)}, ${q(p.correct)}, ${q(p.reveal)}, ${q(p.misconception_code)}, ${q(p.misconception_option)})`,
      );
    });
  }
  out.push("insert into public.prediction_items (key, unit_id, sort_order, stem, options, correct_key, reveal_text, misconception_code, misconception_option) values");
  out.push(
    preds.join(",\n") +
      "\non conflict (key) do update set unit_id = excluded.unit_id, sort_order = excluded.sort_order, stem = excluded.stem,\n  options = excluded.options, correct_key = excluded.correct_key, reveal_text = excluded.reveal_text,\n  misconception_code = excluded.misconception_code, misconception_option = excluded.misconception_option;",
  );
  out.push("");
  return out.join("\n");
}
