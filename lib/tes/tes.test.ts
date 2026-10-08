import { describe, expect, it } from "vitest";
import { backoff, enqueue, flush, memoryQueueStore, queueKey, type QueuedResponse } from "./queue";
import { countComplete, EMPTY_ANSWER, firstIncomplete, isComplete, tierOrder, validateAnswer, visibleTiers } from "./session";
import { hash32, optionOrder, seededShuffle } from "./shuffle";

describe("acak opsi per siswa (FR-35)", () => {
  it("deterministik untuk benih yang sama, berbeda antarsiswa, tetap utuh", () => {
    const keys = ["A", "B", "C", "D"];
    const a = optionOrder(keys, "att-1:item-1", false);
    expect(optionOrder(keys, "att-1:item-1", false)).toEqual(a);
    expect([...a].sort()).toEqual(keys);
    const variants = new Set(Array.from({ length: 40 }, (_, i) => optionOrder(keys, `att-${i}:item-1`, false).join("")));
    expect(variants.size).toBeGreaterThan(8);
  });
  it("butir fixed_order tidak diacak", () => {
    expect(optionOrder(["A", "B", "C", "D"], "x", true)).toEqual(["A", "B", "C", "D"]);
  });
  it("sebaran posisi kira-kira rata (tidak bias ke satu posisi)", () => {
    const first: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (let i = 0; i < 4000; i++) first[seededShuffle(["A", "B", "C", "D"], `s${i}`)[0]!]!++;
    for (const v of Object.values(first)) expect(v).toBeGreaterThan(850);
    expect(hash32("a")).not.toBe(hash32("b"));
  });
});

describe("tier bertahap (FR-32)", () => {
  it("four_tier_standard: 4 tier; modified_tier2: 3", () => {
    expect(tierOrder("four_tier_standard")).toEqual(["tier1", "confidenceA", "reason", "confidenceR"]);
    expect(tierOrder("modified_tier2")).toEqual(["tier1", "reason", "confidenceR"]);
  });
  it("tier berikutnya muncul setelah tier sebelumnya dijawab", () => {
    expect(visibleTiers("four_tier_standard", EMPTY_ANSWER)).toEqual(["tier1"]);
    expect(visibleTiers("four_tier_standard", { ...EMPTY_ANSWER, tier1: "A" })).toEqual(["tier1", "confidenceA"]);
    const full = { tier1: "A", confidenceA: 0, reason: "B", confidenceR: 1 };
    expect(visibleTiers("four_tier_standard", full)).toEqual(tierOrder("four_tier_standard"));
    expect(isComplete("four_tier_standard", full)).toBe(true);
    expect(isComplete("four_tier_standard", { ...full, confidenceR: null })).toBe(false);
  });
  it("kemajuan dan butir pertama yang belum lengkap", () => {
    const items = [{ id: "1", format: "four_tier_standard" as const }, { id: "2", format: "four_tier_standard" as const }];
    const answers = { "1": { tier1: "A", confidenceA: 0, reason: "B", confidenceR: 0 } };
    expect(countComplete(items, answers)).toBe(1);
    expect(firstIncomplete(items, answers)).toBe(1);
    expect(firstIncomplete(items, { ...answers, "2": answers["1"] })).toBeNull();
  });
  it("validasi server: kunci dikenal, skala keyakinan, tanpa lompat tier", () => {
    const item = { format: "four_tier_standard" as const, tier1Keys: ["A", "B"], reasonKeys: ["A", "B"], levels: 2 };
    expect(validateAnswer(item, { tier1: "A", confidenceA: 0, reason: null, confidenceR: null })).toBeNull();
    expect(validateAnswer(item, { tier1: "Z", confidenceA: null, reason: null, confidenceR: null })).toBe("tier1");
    expect(validateAnswer(item, { tier1: "A", confidenceA: 2, reason: null, confidenceR: null })).toBe("confidenceA");
    expect(validateAnswer(item, { tier1: "A", confidenceA: null, reason: "B", confidenceR: null })).toBe("order");
    expect(validateAnswer({ ...item, format: "modified_tier2" }, { tier1: "A", confidenceA: 0, reason: null, confidenceR: null })).toBe("confidenceA");
  });
});

const R = (itemId: string, clientTs: number, tier1 = "A"): Omit<QueuedResponse, "key"> => ({
  attemptId: "att",
  itemId,
  clientTs,
  answer: { ...EMPTY_ANSWER, tier1 },
  responseTimeMs: 1000,
  optionOrder: { tier1: ["A", "B"], reason: ["A", "B"] },
});

describe("antrean luring (FR-34)", () => {
  it("satu entri per butir; jawaban terbaru menang, yang lebih lama diabaikan", async () => {
    const s = memoryQueueStore();
    await enqueue(s, R("i1", 10, "A"));
    await enqueue(s, R("i1", 20, "B"));
    await enqueue(s, R("i1", 15, "C")); // datang terlambat, lebih lama
    const all = await s.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]!.answer.tier1).toBe("B");
    expect(all[0]!.key).toBe(queueKey("att", "i1"));
  });

  it("ketukan beruntun tidak saling timpa (baca-lalu-tulis berurutan)", async () => {
    const base = memoryQueueStore();
    // Penyimpanan lambat seperti IndexedDB: getAll dan put di transaksi terpisah.
    const slow = { ...base, getAll: async () => { await new Promise((r) => setTimeout(r, 5)); return base.getAll(); } };
    await Promise.all([enqueue(slow, R("i1", 1, "A")), enqueue(slow, R("i1", 2, "B")), enqueue(slow, R("i1", 3, "C"))]);
    expect((await base.getAll())[0]!.answer.tier1).toBe("C");
  });

  it("jaringan putus: berhenti, simpan sisanya; pulih: terkirim semua tanpa duplikat", async () => {
    const s = memoryQueueStore();
    for (let i = 12; i <= 15; i++) await enqueue(s, R(`i${i}`, i));
    const server = new Map<string, number>();
    let online = false;
    const send = async (r: QueuedResponse) => {
      if (!online) return "retry" as const;
      server.set(r.itemId, (server.get(r.itemId) ?? 0) + 1);
      return "ok" as const;
    };
    expect((await flush(s, send)).remaining).toBe(4);
    online = true;
    const res = await flush(s, send);
    expect(res).toMatchObject({ sent: 4, remaining: 0 });
    expect([...server.values()]).toEqual([1, 1, 1, 1]);
    expect([...server.keys()]).toEqual(["i12", "i13", "i14", "i15"]); // urut cap waktu
  });

  it("jawaban yang berubah saat sedang dikirim tidak ikut terhapus", async () => {
    const s = memoryQueueStore();
    await enqueue(s, R("i1", 1, "A"));
    const res = await flush(s, async () => {
      await enqueue(s, R("i1", 2, "B")); // siswa mengubah jawaban di tengah pengiriman
      return "ok";
    });
    expect(res.remaining).toBe(1);
    expect((await s.getAll())[0]!.answer.tier1).toBe("B");
  });

  it("ditolak permanen (tes ditutup) → dibuang dan dilaporkan", async () => {
    const s = memoryQueueStore();
    await enqueue(s, R("i1", 1));
    const res = await flush(s, async () => "drop");
    expect(res.dropped).toHaveLength(1);
    expect(res.remaining).toBe(0);
  });

  it("penundaan percobaan ulang bertambah dan dibatasi", () => {
    expect([0, 1, 2, 10].map(backoff)).toEqual([1000, 2000, 4000, 30000]);
  });
});

import { PEDOMAN_V1_RULE_SET } from "@/lib/classification";
import { ITEMS } from "./items-sql-data";
import { classifyAttempt, deliverItems } from "./deliver";

describe("butir untuk siswa (PRD §9.2 prinsip 4)", () => {
  const stored = ITEMS.items.map((i) => ({ id: `item-${i.item_order}`, order: i.item_order, content: i.content }));
  it("tanpa kunci jawaban dan tanpa pemetaan miskonsepsi; opsi lengkap teracak", () => {
    const d = deliverItems("att-1", stored);
    expect(d).toHaveLength(20);
    const text = JSON.stringify(d);
    expect(text).not.toMatch(/correct|maps_to_misconception|misconception_target|concept_domain/);
    for (const [i, it] of d.entries()) {
      expect(it.tier1.map((o) => o.key).sort()).toEqual(ITEMS.items[i]!.content.tier1.options.map((o) => o.key).sort());
    }
    expect(JSON.stringify(deliverItems("att-1", stored))).toBe(text); // stabil
    expect(JSON.stringify(deliverItems("att-2", stored))).not.toBe(text); // beda siswa, beda urutan
  });
  it("klasifikasi percobaan: semua benar + yakin → SC; jawaban benar alasan keliru yakin → M (pedoman D.2 baris 5)", () => {
    const answers = Object.fromEntries(
      ITEMS.items.map((i) => [`item-${i.item_order}`, { tier1: i.content.tier1.correct, confidenceA: 0, reason: i.content.reason.correct, confidenceR: 0 }]),
    );
    const first = ITEMS.items[0]!.content;
    answers["item-1"] = { tier1: first.tier1.correct, confidenceA: 0, reason: first.reason.options.find((o) => o.key !== first.reason.correct)!.key, confidenceR: 0 };
    const rows = classifyAttempt(stored, answers, PEDOMAN_V1_RULE_SET);
    expect(rows).toHaveLength(20);
    expect(rows[0]!.category).toBe("M");
    expect(rows.slice(1).every((r) => r.category === "SC")).toBe(true);
  });
});
