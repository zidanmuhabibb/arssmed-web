/**
 * Dataset sintetis M7 (tests/fixtures/analysis-synthetic.json, dibuat skrip Python dengan benih tetap).
 * Dipakai uji kesetaraan dengan hitungan rujukan dan sebagai kelas contoh di backend memori.
 * BUKAN data siswa nyata.
 */
import raw from "@/tests/fixtures/analysis-synthetic.json";
import { getRuleSet } from "@/lib/classification";
import type { StoredItem } from "@/lib/tes/deliver";
import { ITEMS } from "@/lib/tes/items-sql-data";
import { datasetFromRaw, type SyntheticRaw } from "./dataset";
import type { AnalysisDataset } from "./types";

export const SYNTHETIC_RAW = raw as unknown as SyntheticRaw & { rule_set_id: string };

/** Butir bank soal dengan id yang sama seperti backend memori. */
export const BANK_ITEMS: StoredItem[] = ITEMS.items.map((i) => ({ id: `item-${i.item_order}`, order: i.item_order, content: i.content }));

export function syntheticDataset(): AnalysisDataset {
  return datasetFromRaw(SYNTHETIC_RAW, BANK_ITEMS, ITEMS, getRuleSet(SYNTHETIC_RAW.rule_set_id));
}
