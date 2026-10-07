import { TestItemContent } from "./item";

/** Butir ilustrasi PRD §6.1 (BUKAN butir instrumen asli). */
export const ITEM_MODIFIED = TestItemContent.parse({
  stem: "Planet manakah yang paling panas permukaannya?",
  format: "modified_tier2",
  tier1: {
    options: [
      { key: "A", text: "Merkurius" },
      { key: "B", text: "Venus" },
      { key: "C", text: "Mars" },
    ],
    correct: "B",
  },
  reason: {
    options: [
      { key: "R1", text: "Karena paling dekat dengan Matahari", maps_to_misconception: "M-HOTTEST-CLOSEST" },
      { key: "R2", text: "Karena atmosfernya tebal dan menjebak panas" },
      { key: "R3", text: "Karena ukurannya paling besar" },
    ],
    correct: "R2",
  },
  confidence: { levels: ["Yakin", "Ragu-ragu"], threshold_index: 0 },
  concept_domain: "planet_characteristics",
  report_domain: "planets",
  misconception_target: "M-HOTTEST-CLOSEST",
});

export const ITEM_STANDARD = TestItemContent.parse({
  ...ITEM_MODIFIED,
  format: "four_tier_standard",
});

export function withLevels(levels: string[], threshold_index: number) {
  return TestItemContent.parse({ ...ITEM_MODIFIED, confidence: { levels, threshold_index } });
}
