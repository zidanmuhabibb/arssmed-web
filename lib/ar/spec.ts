/**
 * Deskripsi model AR (GLB untuk Android, USDZ untuk iPhone) per objek Rel Orbit (FR-14, PRD §13).
 * Murni: hanya bentuk dasar + posisi dalam METER. Dibangun menjadi berkas oleh scripts/build-ar-models.mjs.
 * Tata letak adegan memakai konstanta yang sama dengan Viewer 3D (lib/viewer/dioramas.ts)
 * agar AR dan 3D menunjukkan hal yang sama. Ukuran dan jarak tetap tidak sesuai skala.
 */
import type { CelestialObject } from "@/lib/content/celestial";
import {
  EARTH_TILT,
  ECLIPSE,
  REVOLUTION,
  ROTATION,
  ZONES,
  beltPoints,
  earthAxis,
  moonPosition,
  orbitPoint,
  revolutionEarth,
  rotX,
} from "@/lib/viewer/dioramas";
import type { Vec3 } from "@/lib/viewer/geometry";

export type Shape =
  | { kind: "sphere"; radius: number }
  | { kind: "rock"; radius: number }
  | { kind: "cylinder"; radius: number; height: number }
  | { kind: "cone"; radius: number; height: number }
  | { kind: "torus"; radius: number; tube: number; flatten?: number }
  | { kind: "rocks"; points: Vec3[]; size: number };

export interface Part {
  name: string;
  shape: Shape;
  /** Tekstur dari public/textures/<id>.webp (opsional). */
  texture?: string;
  color: string;
  /** Bercahaya sendiri (Matahari, meteor). */
  emissive?: boolean;
  opacity?: number;
  position: Vec3;
  /** Rotasi Euler XYZ dalam derajat. */
  rotation?: Vec3;
}

export interface ModelSpec {
  id: string;
  title: string;
  parts: Part[];
}

const BODY_RADIUS = 0.15; // m — satu benda di atas meja
const C = {
  sun: "#f5a623",
  rock: "#8c8178",
  axis: "#e4ecf2",
  orbit: "#6b86a6",
  pin: "#f5a623",
  shadow: "#3a4656",
  fire: "#ff9a3c",
  ground: "#6b5544",
  ring: "#cdb27a",
  coma: "#bee4ff",
  red: "#c26a4a",
};

const scale = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Sudut Euler (derajat) yang memutar sumbu +Y ke arah `dir` (untuk silinder/kerucut). */
export function alignY(dir: Vec3): Vec3 {
  const l = Math.hypot(...dir) || 1;
  const [x, y, z] = [dir[0] / l, dir[1] / l, dir[2] / l];
  // Putar di sekitar Z lalu X: y' = (−sin rz, cos rz·cos rx, cos rz·sin rx)
  const rz = Math.asin(Math.max(-1, Math.min(1, -x)));
  const rx = Math.atan2(z, y);
  return [(rx * 180) / Math.PI, 0, (rz * 180) / Math.PI];
}

/** Model satu benda (U1, U2). */
function bodyModel(o: CelestialObject): Part[] {
  const r = o.look === "sun" ? BODY_RADIUS * 1.3 : BODY_RADIUS;
  const tilt = o.id === "bumi" ? EARTH_TILT : o.id === "saturnus" ? 26.7 : o.id === "uranus" ? 82 : 0;
  if (o.look === "asteroid") return [{ name: "Asteroid", shape: { kind: "rock", radius: r * 0.8 }, texture: "asteroid", color: "#ffffff", position: [0, 0, 0] }];
  if (o.look === "comet") {
    const n = r * 0.35;
    return [
      { name: "Inti", shape: { kind: "rock", radius: n }, texture: "komet", color: "#ffffff", position: [0, 0, 0] },
      { name: "Koma", shape: { kind: "sphere", radius: n * 2.2 }, color: C.coma, opacity: 0.25, position: [0, 0, 0] },
      // Ekor menjauhi Matahari (Matahari dianggap di kiri, −x).
      { name: "Ekor", shape: { kind: "cone", radius: n * 1.8, height: r * 3 }, color: C.coma, opacity: 0.22, position: [r * 1.5 + n, 0, 0], rotation: [0, 0, 90] },
    ];
  }
  const parts: Part[] = [
    { name: o.name.replace(/\s+/g, ""), shape: { kind: "sphere", radius: o.ring ? r * 0.8 : r }, texture: o.id, color: "#ffffff", emissive: o.look === "sun", position: [0, 0, 0], rotation: [0, 0, tilt] },
  ];
  if (o.ring) {
    const pr = r * 0.8;
    parts.push({ name: "Cincin", shape: { kind: "torus", radius: pr * 1.75, tube: pr * 0.5, flatten: 0.06 }, color: C.ring, opacity: 0.8, position: [0, 0, 0], rotation: [0, 0, tilt] });
  }
  return parts;
}

/** U3: Matahari, orbit, sabuk asteroid, 8 planet. 1 satuan Viewer = 4,5 cm. */
function zonesModel(): Part[] {
  const s = 0.045;
  const parts: Part[] = [{ name: "Matahari", shape: { kind: "sphere", radius: ZONES.sun.radius * s }, texture: "matahari", color: "#ffffff", emissive: true, position: [0, 0, 0] }];
  for (const p of ZONES.planets) {
    parts.push({ name: `Orbit${p.id}`, shape: { kind: "torus", radius: p.orbit * s, tube: 0.0012 }, color: C.orbit, opacity: 0.6, position: [0, 0, 0] });
    parts.push({ name: p.id, shape: { kind: "sphere", radius: p.radius * s * 1.6 }, texture: p.id, color: "#ffffff", position: scale(orbitPoint(p.orbit, p.deg), s) });
    if (p.id === "saturnus") {
      const pr = p.radius * s * 1.6;
      parts.push({ name: "CincinSaturnus", shape: { kind: "torus", radius: pr * 1.75, tube: pr * 0.5, flatten: 0.06 }, color: C.ring, opacity: 0.8, position: scale(orbitPoint(p.orbit, p.deg), s), rotation: [0, 0, 26.7] });
    }
  }
  parts.push({ name: "SabukAsteroid", shape: { kind: "rocks", points: beltPoints(110).map((v) => scale(v, s)), size: 0.004 }, texture: "asteroid", color: "#b9b2a6", position: [0, 0, 0] });
  return parts;
}

/** U4: batu yang sama, tiga tempat. */
function meteorModel(step: number): Part[] {
  const r = 0.07;
  const rock: Part = { name: "Batu", shape: { kind: "rock", radius: r }, texture: "asteroid", color: "#ffffff", position: [0, 0, 0] };
  if (step === 0) return [rock];
  if (step === 1) {
    return [
      { ...rock, emissive: true, color: "#ffd0a0" },
      { name: "Nyala", shape: { kind: "sphere", radius: r * 1.6 }, color: C.fire, opacity: 0.35, emissive: true, position: [0, 0, 0] },
      // Jejak cahaya di belakang batu yang jatuh miring
      { name: "Jejak", shape: { kind: "cone", radius: r * 1.2, height: 0.5 }, color: C.fire, opacity: 0.3, emissive: true, position: [-0.21, 0.15, 0], rotation: [0, 0, 55] },
    ];
  }
  return [
    { name: "Tanah", shape: { kind: "cylinder", radius: 0.22, height: 0.02 }, color: C.ground, position: [0, -r * 0.55, 0] },
    { ...rock, color: "#9a8f86", position: [0, -r * 0.15, 0] },
  ];
}

/** U5 rotasi: Bumi miring dengan sumbu dan titik Indonesia. */
function rotationModel(): Part[] {
  const r = BODY_RADIUS;
  const lat = (ROTATION.pinLat * Math.PI) / 180;
  const pin = rotX([0, r * Math.sin(lat), r * Math.cos(lat)], EARTH_TILT);
  return [
    { name: "Bumi", shape: { kind: "sphere", radius: r }, texture: "bumi", color: "#ffffff", position: [0, 0, 0], rotation: [EARTH_TILT, 0, 0] },
    { name: "Sumbu", shape: { kind: "cylinder", radius: 0.004, height: r * 2.9 }, color: C.axis, position: [0, 0, 0], rotation: [EARTH_TILT, 0, 0] },
    { name: "Indonesia", shape: { kind: "sphere", radius: 0.012 }, color: C.pin, emissive: true, position: scale(pin, 1.02) },
  ];
}

/** U5 revolusi: Matahari, orbit, Bumi di empat posisi dengan sumbu ke arah yang sama (penyebab musim). */
function revolutionModel(): Part[] {
  const s = 0.1;
  const parts: Part[] = [
    { name: "Matahari", shape: { kind: "sphere", radius: REVOLUTION.sunRadius * s }, texture: "matahari", color: "#ffffff", emissive: true, position: [0, 0, 0] },
    { name: "Orbit", shape: { kind: "torus", radius: REVOLUTION.orbit * s, tube: 0.0015 }, color: C.orbit, opacity: 0.7, position: [0, 0, 0] },
  ];
  const axis = earthAxis(true);
  ["Maret", "Juni", "September", "Desember"].forEach((m, i) => {
    const e = scale(revolutionEarth(i + 0.5), s);
    parts.push({ name: `Bumi${m}`, shape: { kind: "sphere", radius: REVOLUTION.earthRadius * s }, texture: "bumi", color: "#ffffff", position: e, rotation: [0, 0, EARTH_TILT] });
    parts.push({ name: `Sumbu${m}`, shape: { kind: "cylinder", radius: 0.0025, height: REVOLUTION.earthRadius * s * 3.2 }, color: C.axis, position: e, rotation: alignY(axis) });
  });
  return parts;
}

/** U6: Matahari–Bulan–Bumi (gerhana Matahari) atau Matahari–Bumi–Bulan (gerhana Bulan), segaris. */
function eclipseModel(variant: "solar" | "lunar"): Part[] {
  const s = 0.06;
  const shift: Vec3 = [1.4, 0, 0];
  const at = (v: Vec3) => scale(add(v, shift), s);
  const m = moonPosition(1.5, variant);
  const parts: Part[] = [
    { name: "Matahari", shape: { kind: "sphere", radius: ECLIPSE.sunRadius * s }, texture: "matahari", color: "#ffffff", emissive: true, position: at(ECLIPSE.sun) },
    { name: "Bumi", shape: { kind: "sphere", radius: ECLIPSE.earthRadius * s }, texture: "bumi", color: "#ffffff", position: at([0, 0, 0]) },
    { name: "Bulan", shape: { kind: "sphere", radius: ECLIPSE.moonRadius * s }, texture: "bulan", color: variant === "lunar" ? C.red : "#ffffff", position: at(m) },
    { name: "OrbitBulan", shape: { kind: "torus", radius: ECLIPSE.moonOrbit * s, tube: 0.0012 }, color: C.orbit, opacity: 0.6, position: at([0, 0, 0]) },
  ];
  if (variant === "solar") {
    parts.push({ name: "BayanganBulan", shape: { kind: "cone", radius: ECLIPSE.moonRadius * s, height: ECLIPSE.moonShadow * s }, color: C.shadow, opacity: 0.45, position: at([m[0] + ECLIPSE.moonShadow / 2, 0, 0]), rotation: [0, 0, -90] });
  } else {
    parts.push({ name: "BayanganBumi", shape: { kind: "cone", radius: ECLIPSE.earthRadius * s, height: ECLIPSE.earthShadow * s }, color: C.shadow, opacity: 0.35, position: at([ECLIPSE.earthShadow / 2, 0, 0]), rotation: [0, 0, -90] });
  }
  return parts;
}

/** Spesifikasi model untuk satu objek Rel Orbit. */
export function arModelSpec(o: CelestialObject): ModelSpec {
  const parts =
    o.scene === "zones"
      ? zonesModel()
      : o.scene === "meteor"
        ? meteorModel(o.sceneStep ?? 0)
        : o.scene === "rotation"
          ? rotationModel()
          : o.scene === "revolution"
            ? revolutionModel()
            : o.scene === "eclipse"
              ? eclipseModel(o.variant ?? "solar")
              : bodyModel(o);
  return { id: arModelId(o), title: o.name, parts };
}

/** Satu berkas per id; "bumi" di U1 dan U2 berbagi model yang sama. Tiga objek U3 berbagi satu adegan. */
export function arModelId(o: CelestialObject): string {
  return o.scene === "zones" ? "zona-planet" : o.id;
}

export function arModelUrls(o: CelestialObject) {
  const id = arModelId(o);
  return { glb: `/models/${id}.glb`, usdz: `/models/${id}.usdz` };
}
