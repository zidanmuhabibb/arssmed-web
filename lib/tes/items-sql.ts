/**
 * SQL bank soal dan aturan klasifikasi dari data/items.json + data/rule-sets/*.json (PRD §6.1 `seed:items`).
 * Butir yang sudah dibekukan (tes pernah dibuka) TIDAK bisa diubah lewat berkas ini: naikkan
 * `test_version` di items.json untuk membuat versi tes baru (FR-38).
 */
import type { ItemsFile, RuleSet } from "@/lib/classification";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

export function buildItemsSql(items: ItemsFile, ruleSets: RuleSet[], defaultRuleSet: string): string {
  const out: string[] = [
    "-- DIBUAT OTOMATIS oleh `pnpm seed:items` dari data/items.json dan data/rule-sets/*.json. Jangan disunting manual.",
    "-- Aturan klasifikasi: upsert. Tes: dibuat sekali per (nama, versi); butir hanya ditambahkan bila tes belum dibekukan.",
    "",
    "insert into public.rule_sets (rule_set_id, name, version, kind, rules, confidence_mode, incomplete_category, is_default) values",
    ruleSets
      .map(
        (r) =>
          `  (${q(r.rule_set_id)}, ${q(r.rule_set_id)}, 1, ${q(r.kind)}, ${j(r.rules)}, ${r.kind === "combined" ? q(r.confidence_mode) : "null"}, ${r.incomplete_category ? q(r.incomplete_category) : "null"}, ${r.rule_set_id === defaultRuleSet})`,
      )
      .join(",\n") +
      "\non conflict (rule_set_id) do update set kind = excluded.kind, rules = excluded.rules,\n  confidence_mode = excluded.confidence_mode, incomplete_category = excluded.incomplete_category, is_default = excluded.is_default;",
    "",
    "insert into public.tests (name, version, status, rule_set_id)",
    `select ${q(items.test_name)}, ${items.test_version}, 'active', id from public.rule_sets where rule_set_id = ${q(defaultRuleSet)}`,
    "on conflict (name, version) do nothing;",
    "",
    "-- Hanya versi terbaru yang aktif.",
    `update public.tests set status = 'archived' where name = ${q(items.test_name)} and version < ${items.test_version} and status = 'active';`,
    "",
    "insert into public.test_items (test_id, item_order, content, concept_domain, report_domain, misconception_code, fixed_order)",
    "select t.id, v.item_order, v.content, v.concept_domain, v.report_domain, v.misconception_code, v.fixed_order",
    `from public.tests t, (values`,
    items.items
      .map(
        (it) =>
          `  (${it.item_order}, ${j(it.content)}, ${q(it.content.concept_domain)}, ${q(it.content.report_domain)}, ${it.content.misconception_target ? q(it.content.misconception_target) : "null::text"}, ${it.content.tier1.fixed_order})`,
      )
      .join(",\n"),
    `) as v(item_order, content, concept_domain, report_domain, misconception_code, fixed_order)`,
    `where t.name = ${q(items.test_name)} and t.version = ${items.test_version} and not t.items_frozen`,
    "on conflict (test_id, item_order) do nothing;",
    "",
  ];
  return out.join("\n");
}
