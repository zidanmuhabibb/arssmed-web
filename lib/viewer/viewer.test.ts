import { describe, expect, it } from "vitest";
import { cameraForPoint, defaultDistance, latLonToVector, length, orbitY, zoomTo } from "./geometry";
import { markViewed, nextUnviewed, progressOf } from "./progress";
import { advance, locate, stepBack, stepForward } from "./timeline";

describe("geometri", () => {
  it("lat/lon → titik di permukaan bola", () => {
    const v = latLonToVector(0, 0, 2);
    expect(v[0]).toBeCloseTo(0);
    expect(v[1]).toBeCloseTo(0);
    expect(v[2]).toBeCloseTo(2);
    expect(latLonToVector(90, 0, 1)[1]).toBeCloseTo(1);
    expect(length(latLonToVector(33, -120, 1.5))).toBeCloseTo(1.5);
  });
  it("kamera menatap anotasi dari arah normalnya", () => {
    const p = latLonToVector(20, 45, 1);
    const c = cameraForPoint(p, 5);
    expect(length(c)).toBeCloseTo(5);
    expect(c[0] / p[0]).toBeCloseTo(5);
  });
  it("orbit mempertahankan jarak; zoom dibatasi", () => {
    expect(length(orbitY([0, 1, 4], 37))).toBeCloseTo(length([0, 1, 4]));
    expect(length(zoomTo([0, 0, 4], 0.1, 2, 10))).toBeCloseTo(2);
    expect(length(zoomTo([0, 0, 4], 10, 2, 10))).toBeCloseTo(10);
  });
  it("jarak bawaan bertambah sesuai jari-jari", () => {
    expect(defaultDistance(2)).toBeCloseTo(2 * defaultDistance(1));
  });
});

describe("kemajuan Rel Orbit", () => {
  const all = ["a", "b", "c"];
  it("menandai tanpa duplikat dan menghitung kemajuan", () => {
    const v = markViewed(markViewed([], "a"), "a");
    expect(v).toEqual(["a"]);
    expect(progressOf(v, all)).toEqual({ seen: 1, total: 3, complete: false });
    expect(progressOf(["a", "b", "c", "x"], all).complete).toBe(true);
  });
  it("objek berikutnya yang belum dilihat, berputar dari posisi sekarang", () => {
    expect(nextUnviewed(["a"], all, "a")).toBe("b");
    expect(nextUnviewed(["a", "b"], all, "b")).toBe("c");
    expect(nextUnviewed(["b", "c"], all, "c")).toBe("a");
    expect(nextUnviewed(all, all, "a")).toBeNull();
  });
});

describe("garis waktu animasi", () => {
  const tl = { steps: 3, stepSeconds: 4 };
  it("menemukan langkah dan kemajuan", () => {
    expect(locate(tl, 0)).toEqual({ step: 0, within: 0 });
    expect(locate(tl, 1.5)).toEqual({ step: 1, within: 0.5 });
    expect(locate(tl, 3)).toEqual({ step: 2, within: 1 });
    expect(locate(tl, 9)).toEqual({ step: 2, within: 1 });
  });
  it("kecepatan 2× dua kali lebih cepat; berhenti di akhir", () => {
    expect(advance(tl, 0, 2, 1).position).toBeCloseTo(0.5);
    expect(advance(tl, 0, 2, 2).position).toBeCloseTo(1);
    expect(advance(tl, 2.9, 10, 1)).toEqual({ position: 3, ended: true });
  });
  it("maju/mundur per langkah", () => {
    expect(Math.floor(stepForward(tl, 0.3))).toBe(1);
    expect(Math.floor(stepForward(tl, 2.5))).toBe(2);
    expect(stepBack(tl, 1.5)).toBe(1);
    expect(stepBack(tl, 1)).toBe(0);
    expect(stepBack(tl, 0)).toBe(0);
  });
});

import { makeNoise, paintSurface } from "./textures";
describe("tekstur prosedural", () => {
  it("derau deterministik dan dalam 0–1", () => {
    const a = makeNoise(3), b = makeNoise(3);
    for (let i = 0; i < 50; i++) {
      const v = a(i * 0.37, i * 0.11, 4, 8);
      expect(v).toBe(b(i * 0.37, i * 0.11, 4, 8));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it("menghasilkan piksel buram berukuran benar", () => {
    const px = paintSurface("jupiter", "#b88b63", 64, 32);
    expect(px.length).toBe(64 * 32 * 4);
    expect(px[3]).toBe(255);
  });
});
