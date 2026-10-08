import { describe, expect, it } from "vitest";
import items from "@/data/items.json";
import { UNITS } from "@/content/units";
import { CELESTIAL, unitObjects } from "@/lib/content/celestial";
import { LEARNING, findPrediction, unitLearning } from "./content";
import {
  blockingStep,
  canFinishObserve,
  canOpen,
  compareTone,
  EMPTY_STATE,
  mergeStates,
  nextStep,
  pendingSync,
  predictionsComplete,
  stepStatus,
  unitStatus,
  type Step,
} from "./flow";

const sentences = (t: string) => t.split(/(?<=[.?!])\s+/).filter(Boolean).length;
const words = (t: string) =>
  new Set(
    t
      .toLowerCase()
      .replace(/[^a-z0-9à-ÿ\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
const jaccard = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / (a.size + b.size - inter || 1);
};

type TestItem = { item_code: string; content: { stem: string; tier1: { options: { text: string }[] } } };
const TEST_ITEMS = (items as { items: TestItem[] }).items;

describe("konten alur belajar", () => {
  it("keenam unit punya tujuan, prediksi, penjelasan, refleksi", () => {
    for (const u of UNITS) {
      const l = unitLearning(u.slug);
      expect(l, u.slug).not.toBeNull();
      expect(l!.predictions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("setiap unit punya objek Viewer untuk langkah Amati", () => {
    for (const u of UNITS) expect(unitObjects(u.slug).length, u.slug).toBeGreaterThan(0);
  });

  it("penjelasan ilmiah maksimal 3 kalimat (PRD §4.2)", () => {
    for (const [slug, u] of Object.entries(LEARNING.units)) expect(sentences(u.explanation.text), slug).toBeLessThanOrEqual(3);
  });

  it("tanpa kata 'salah' atau 'benar' kepada siswa (PRD §8.6)", () => {
    const text = JSON.stringify(LEARNING.units) + JSON.stringify(CELESTIAL.units);
    expect(text).not.toMatch(/\bsalah\b/i);
    expect(text).not.toMatch(/\bbenar\b/i);
  });

  it("'Tebak dulu' berbeda dari 20 butir tes (validitas penelitian, PRD §4.2)", () => {
    expect(TEST_ITEMS).toHaveLength(20);
    for (const u of Object.values(LEARNING.units))
      for (const p of u.predictions) {
        const ps = words(p.stem);
        const pAll = words(p.stem + " " + p.options.map((o) => o.text).join(" "));
        for (const it of TEST_ITEMS) {
          const ts = words(it.content.stem);
          const tAll = words(it.content.stem + " " + it.content.tier1.options.map((o) => o.text).join(" "));
          expect(p.stem.trim().toLowerCase(), `${p.key} vs ${it.item_code}`).not.toBe(it.content.stem.trim().toLowerCase());
          expect(jaccard(ps, ts), `${p.key} vs ${it.item_code} (soal)`).toBeLessThan(0.4);
          expect(jaccard(pAll, tAll), `${p.key} vs ${it.item_code} (soal+opsi)`).toBeLessThan(0.4);
        }
      }
  });

  it("prediksi bisa dicari dengan kuncinya; kode miskonsepsi milik unit yang sama", () => {
    for (const [slug, u] of Object.entries(LEARNING.units))
      for (const p of u.predictions) {
        expect(findPrediction(p.key)?.unit).toBe(slug);
        expect(LEARNING.misconceptions.find((m) => m.code === p.misconception_code)?.unit).toBe(slug);
      }
  });

  it("pengungkapan memakai bahasa netral 'Ternyata…' (PRD §4.2)", () => {
    for (const u of Object.values(LEARNING.units)) for (const p of u.predictions) expect(p.reveal.startsWith("Ternyata")).toBe(true);
  });
});

describe("alur Tebak → Amati → Bandingkan → Jelaskan", () => {
  it("hanya langkah pertama yang terbuka di awal", () => {
    expect(stepStatus([], "tebak")).toBe("current");
    expect(stepStatus([], "amati")).toBe("locked");
    expect(canOpen([], "bandingkan")).toBe(false);
    expect(blockingStep([], "jelaskan")).toBe("tebak");
  });

  it("langkah terbuka berurutan dan status unit mengikuti", () => {
    const done: Step[] = [];
    expect(unitStatus(done)).toBe("notStarted");
    for (const s of ["tebak", "amati", "bandingkan", "jelaskan"] as Step[]) {
      expect(nextStep(done)).toBe(s);
      expect(stepStatus(done, s)).toBe("current");
      done.push(s);
      expect(stepStatus(done, s)).toBe("done");
    }
    expect(unitStatus(done)).toBe("done");
    expect(nextStep(done)).toBeNull();
    expect(unitStatus(["tebak"])).toBe("inProgress");
  });

  it("Amati selesai bila semua objek wajib dilihat, atau mode bebas (FR-22)", () => {
    expect(canFinishObserve(["a"], ["a", "b"], false)).toBe(false);
    expect(canFinishObserve(["a", "b", "x"], ["a", "b"], false)).toBe(true);
    expect(canFinishObserve([], ["a", "b"], true)).toBe(true);
  });

  it("Tebak selesai bila semua prediksi terjawab", () => {
    expect(predictionsComplete({ a: "A" }, ["a", "b"])).toBe(false);
    expect(predictionsComplete({ a: "A", b: "C" }, ["a", "b"])).toBe(true);
    expect(predictionsComplete({}, [])).toBe(false);
  });

  it("nada Bandingkan", () => {
    expect(compareTone("B", "B")).toBe("same");
    expect(compareTone("A", "B")).toBe("different");
    expect(compareTone(undefined, "B")).toBe("missing");
  });

  it("menggabungkan status: jawaban server tidak ditimpa, langkah & tampilan digabung", () => {
    const server = { ...EMPTY_STATE, steps: { u1: ["tebak"] as Step[] }, predictions: { p: "A" }, viewed: { u1: ["bumi"] } };
    const local = { ...EMPTY_STATE, steps: { u1: ["amati"] as Step[], u2: ["tebak"] as Step[] }, predictions: { p: "B", q: "C" }, viewed: { u1: ["bulan"] }, discussed: ["u1"] };
    const m = mergeStates(server, local);
    expect(m.predictions).toEqual({ p: "A", q: "C" });
    expect(m.steps).toEqual({ u1: ["tebak", "amati"], u2: ["tebak"] });
    expect(m.viewed.u1!.sort()).toEqual(["bulan", "bumi"]);
    expect(m.discussed).toEqual(["u1"]);
    const p = pendingSync(local, server);
    expect(p.predictions).toEqual([{ key: "q", option: "C" }]);
    expect(p.steps).toEqual([{ unit: "u1", step: "amati" }, { unit: "u2", step: "tebak" }]);
    expect(p.views).toEqual([{ unit: "u1", object: "bulan" }]);
    expect(p.discussed).toEqual(["u1"]);
    expect(pendingSync(server, server).empty).toBe(true);
  });
});
