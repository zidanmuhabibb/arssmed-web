import raw from "@/data/items.json";
import { ANALYSIS_CONFIG, ItemsFile, RULE_SETS } from "@/lib/classification";
import { buildItemsSql } from "./items-sql";

export const ITEMS = ItemsFile.parse(raw);

export function currentItemsSql() {
  const def = ITEMS.default_rule_set_id ?? ANALYSIS_CONFIG.rule_set_id;
  return buildItemsSql(ITEMS, Object.values(RULE_SETS), def);
}
