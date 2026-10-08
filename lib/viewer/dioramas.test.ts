import { describe, expect, it } from "vitest";
import { CELESTIAL } from "@/lib/content/celestial";
import { ANIMATIONS, initialPosition } from "./animations";
import {
  anchorPoint,
  beltPoints,
  eclipseDepth,
  meteorState,
  METEOR_POINTS,
  moonPosition,
  northTowardSun,
  REVOLUTION,
  revolutionEarth,
  rotationPin,
  sunlitness,
  ZONES,
  zonePlanet,
} from "./dioramas";
import { length } from "./geometry";

const close = (a: number[], b: number[], d = 1e-9) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, -Math.log10(d)));

describe("adegan U3 zona planet", () => {
  it("urutan orbit: 4 planet dalam, sabuk asteroid, 4 planet luar", () => {
    const orbits = ZONES.planets.map((p) => p.orbit);
    expect([...orbits].sort((a, b) => a - b)).toEqual(orbits);
    expect(ZONES.planets[3]!.orbit).toBeLessThan(ZONES.belt.inner);
    expect(ZONES.planets[4]!.orbit).toBeGreaterThan(ZONES.belt.outer);
    expect(ZONES.planets.map((p) => p.id)).toEqual(["merkurius", "venus", "bumi", "mars", "jupiter", "saturnus", "uranus", "neptunus"]);
  });
  it("planet dalam digambar lebih kecil dari planet luar", () => {
    const inner = Math.max(...ZONES.planets.slice(0, 4).map((p) => p.radius));
    const outer = Math.min(...ZONES.planets.slice(4).map((p) => p.radius));
    expect(inner).toBeLessThan(outer);
  });
  it("sabuk: deterministik dan di dalam cincin", () => {
    const a = beltPoints(50);
    expect(beltPoints(50)).toEqual(a);
    for (const p of a) {
      const r = Math.hypot(p[0], p[2]);
      expect(r).toBeGreaterThanOrEqual(ZONES.belt.inner - 1e-9);
      expect(r).toBeLessThanOrEqual(ZONES.belt.outer + 1e-9);
    }
    expect(length(zonePlanet("bumi"))).toBeCloseTo(2.6);
  });
});

describe("adegan U4 meteor", () => {
  it("langkah 1 meteoroid (tidak menyala), 2 meteor (menyala, menyusut), 3 meteorit (mendarat)", () => {
    expect(meteorState(0.5).glow).toBe(0);
    expect(meteorState(0.5).scale).toBe(1);
    const burn = meteorState(1.5);
    expect(burn.glow).toBeGreaterThan(0.5);
    expect(burn.scale).toBeLessThan(1);
    expect(meteorState(3).landed).toBe(true);
    close(meteorState(3).rock, METEOR_POINTS.ground);
    expect(meteorState(2.2).landed).toBe(false);
  });
});

describe("adegan U5 rotasi & revolusi", () => {
  it("titik tempatmu: pagi di batas terang, siang menghadap Matahari, malam membelakangi", () => {
    expect(Math.abs(sunlitness(rotationPin(0.5, false)))).toBeLessThan(0.15);
    expect(sunlitness(rotationPin(1.5, false))).toBeGreaterThan(0.9);
    expect(Math.abs(sunlitness(rotationPin(2.5, false)))).toBeLessThan(0.15);
    expect(sunlitness(rotationPin(3.5, false))).toBeLessThan(-0.9);
    // Pagi: menuju terang (berputar ke barat→timur), sore: menuju gelap
    expect(sunlitness(rotationPin(0.8, false))).toBeGreaterThan(sunlitness(rotationPin(0.5, false)));
    expect(sunlitness(rotationPin(2.8, false))).toBeLessThan(sunlitness(rotationPin(2.5, false)));
  });
  it("revolusi: jarak tetap; Juni utara condong ke Matahari, Desember menjauh, tanpa kemiringan tidak ada musim", () => {
    for (const p of [0.5, 1.5, 2.5, 3.5]) expect(length(revolutionEarth(p))).toBeCloseTo(REVOLUTION.orbit);
    expect(northTowardSun(1.5, true)).toBeGreaterThan(0.35);
    expect(northTowardSun(3.5, true)).toBeLessThan(-0.35);
    expect(Math.abs(northTowardSun(0.5, true))).toBeLessThan(1e-9);
    for (const p of [0.5, 1.5, 2.5, 3.5]) expect(Math.abs(northTowardSun(p, false))).toBeLessThan(1e-9);
  });
});

describe("adegan U6 gerhana", () => {
  it("segaris di tengah langkah 2; tidak gerhana di awal dan akhir", () => {
    for (const v of ["solar", "lunar"] as const) {
      expect(eclipseDepth(1.5, v)).toBeCloseTo(1);
      expect(eclipseDepth(0, v)).toBe(0);
      expect(eclipseDepth(3, v)).toBe(0);
    }
  });
  it("gerhana Matahari: Bulan di antara Matahari dan Bumi; gerhana Bulan: Bumi di tengah", () => {
    expect(moonPosition(1.5, "solar")[0]).toBeLessThan(0); // Matahari di −x
    expect(moonPosition(1.5, "lunar")[0]).toBeGreaterThan(0);
  });
});

describe("anchor dan animasi untuk semua konten adegan", () => {
  it("setiap anotasi adegan punya anchor yang dikenal pada semua posisi", () => {
    for (const u of Object.values(CELESTIAL.units))
      for (const o of u.objects) {
        if (!o.scene) continue;
        const spec = o.animation ? ANIMATIONS[o.animation] : null;
        for (const a of o.annotations)
          for (const p of [0, 0.5, 1.5, 2.9])
            expect(() => anchorPoint(o.scene!, a.anchor!, { position: p, toggles: spec?.toggles ?? {}, variant: o.variant }), `${o.id}/${a.id}`).not.toThrow();
      }
  });
  it("objek yang mewakili langkah mulai di tengah langkahnya", () => {
    expect(initialPosition(ANIMATIONS.meteor, 1)).toBe(1.5);
    expect(initialPosition(ANIMATIONS.greenhouse)).toBe(0);
    expect(initialPosition(ANIMATIONS.rotation)).toBe(0.5);
  });
  it("U4–U6 memakai animasi berlangkah (FR-13)", () => {
    for (const slug of ["u4", "u5", "u6"]) for (const o of CELESTIAL.units[slug]!.objects) expect(o.animation, o.id).toBeDefined();
  });
});
