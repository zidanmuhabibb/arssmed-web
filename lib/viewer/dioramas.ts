/**
 * Tata letak adegan 3D unit 3–6 (murni, tanpa three.js agar bisa diuji di Node).
 * Ukuran dan jarak SENGAJA tidak sesuai skala (PRD §13); label skala selalu tampil.
 * Arah: Matahari di kiri (−x) untuk rotasi, meteor, dan gerhana; di pusat untuk zona & revolusi.
 * Rotasi positif mengelilingi +y = berlawanan jarum jam dilihat dari kutub utara (arah gerak nyata).
 */
import type { SceneKind } from "@/lib/content/celestial";
import type { Vec3 } from "./geometry";

const rad = (d: number) => (d * Math.PI) / 180;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Titik pada orbit lingkaran di bidang xz (sudut derajat, berlawanan jarum jam dari +x). */
export function orbitPoint(radius: number, deg: number, y = 0): Vec3 {
  return [radius * Math.cos(rad(deg)), y, -radius * Math.sin(rad(deg))];
}

/** Putar vektor mengelilingi sumbu x (derajat). */
export function rotX(v: Vec3, deg: number): Vec3 {
  const a = rad(deg);
  return [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
}
/** Putar vektor mengelilingi sumbu y (derajat). */
export function rotY(v: Vec3, deg: number): Vec3 {
  const a = rad(deg);
  return [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
}
/** Putar vektor mengelilingi sumbu z (derajat). */
export function rotZ(v: Vec3, deg: number): Vec3 {
  const a = rad(deg);
  return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
}

export const EARTH_TILT = 23.44; // NASA Earth Fact Sheet (obliquity to orbit)

// ------------------------------------------------------------------ U3 zona planet

export const ZONES = {
  sun: { radius: 0.7 },
  planets: [
    { id: "merkurius", orbit: 1.6, radius: 0.14, deg: 212 },
    { id: "venus", orbit: 2.1, radius: 0.2, deg: 238 },
    { id: "bumi", orbit: 2.6, radius: 0.21, deg: 264 },
    { id: "mars", orbit: 3.1, radius: 0.17, deg: 290 },
    { id: "jupiter", orbit: 5.2, radius: 0.55, deg: 292 },
    { id: "saturnus", orbit: 6.4, radius: 0.46, deg: 246 },
    { id: "uranus", orbit: 7.5, radius: 0.34, deg: 68 },
    { id: "neptunus", orbit: 8.5, radius: 0.33, deg: 108 },
  ],
  belt: { inner: 3.6, outer: 4.3, count: 420 },
  /** Batas zona untuk pewarnaan lembut. */
  innerZone: 3.4,
} as const;

export function zonePlanet(id: string): Vec3 {
  const p = ZONES.planets.find((x) => x.id === id);
  if (!p) throw new Error(`planet zona tidak dikenal: ${id}`);
  return orbitPoint(p.orbit, p.deg);
}

/** Sabuk asteroid: titik pseudo-acak deterministik di cincin (tanpa Math.random agar stabil). */
export function beltPoints(count: number = ZONES.belt.count): Vec3[] {
  const out: Vec3[] = [];
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < count; i++) {
    const r = lerp(ZONES.belt.inner, ZONES.belt.outer, rnd());
    out.push(orbitPoint(r, rnd() * 360, (rnd() - 0.5) * 0.25));
  }
  return out;
}

// ------------------------------------------------------------------ U4 meteoroid → meteor → meteorit

export const METEOR = {
  earth: { center: [0, -6.5, 0] as Vec3, radius: 6 },
  atmosphere: 7.4,
  start: [-6.2, 3.1, 0] as Vec3,
};
const onSphere = (r: number, degFromTop: number): Vec3 => [
  METEOR.earth.center[0] - r * Math.sin(rad(degFromTop)),
  METEOR.earth.center[1] + r * Math.cos(rad(degFromTop)),
  0,
];
/** Titik masuk atmosfer, titik habis menyala, titik jatuh di tanah. */
export const METEOR_POINTS = {
  entry: onSphere(METEOR.atmosphere, 33),
  burnout: onSphere(METEOR.earth.radius + 0.55, 19),
  ground: onSphere(METEOR.earth.radius + 0.02, 12),
};

/** Keadaan batu pada posisi animasi 0…3. Langkah 1: meteoroid, 2: meteor, 3: meteorit. */
export function meteorState(position: number) {
  const p = Math.min(Math.max(position, 0), 3);
  if (p < 1) {
    return { rock: lerp3(METEOR.start, METEOR_POINTS.entry, p), scale: 1, glow: 0, landed: false };
  }
  if (p < 2) {
    const t = p - 1;
    // Menyala paling terang di tengah, batu menyusut karena terbakar.
    return { rock: lerp3(METEOR_POINTS.entry, METEOR_POINTS.burnout, t), scale: lerp(1, 0.4, t), glow: Math.sin(Math.PI * clamp01(t * 1.15)), landed: false };
  }
  const t = clamp01((p - 2) / 0.7);
  return { rock: lerp3(METEOR_POINTS.burnout, METEOR_POINTS.ground, t), scale: 0.4, glow: 0, landed: t >= 1 };
}

// ------------------------------------------------------------------ U5 rotasi

export const ROTATION = { earthRadius: 1.3, sun: [-5.2, 0, 0] as Vec3, sunRadius: 0.9, pinLat: -6 };

/**
 * Sudut putar Bumi (derajat) pada posisi animasi 0…4. Langkah 1–4 = pagi, siang, sore, malam
 * bagi titik tempatmu. Tengah langkah k ⇒ sudut (k − 0,5)·90° − 0 sehingga titik ada di
 * fajar (−z), tengah hari (−x, menghadap Matahari), senja (+z), tengah malam (+x).
 */
export function rotationAngle(position: number) {
  return (Math.min(Math.max(position, 0), 4) - 0.5) * 90;
}

/** Posisi titik "tempatmu" di permukaan Bumi (dunia), dengan/tanpa kemiringan sumbu. */
export function rotationPin(position: number, tilted: boolean): Vec3 {
  const r = ROTATION.earthRadius * 1.01;
  const lat = rad(ROTATION.pinLat);
  const local: Vec3 = [0, r * Math.sin(lat), -r * Math.cos(lat)]; // menghadap −z pada sudut 0
  return rotX(rotY(local, rotationAngle(position)), tilted ? EARTH_TILT : 0);
}

/** Bagian siang/malam untuk titik: cos sudut ke arah Matahari (−x). > 0 = siang. */
export function sunlitness(point: Vec3) {
  const l = Math.hypot(...point) || 1;
  return -point[0] / l;
}

// ------------------------------------------------------------------ U5 revolusi

export const REVOLUTION = { orbit: 2.8, sunRadius: 0.7, earthRadius: 0.45 };

/** Langkah 1–4 = Maret, Juni, September, Desember. Juni: Bumi di +x, kutub utara condong ke Matahari. */
export function revolutionAngle(position: number) {
  return (Math.min(Math.max(position, 0), 4) - 1.5) * 90;
}
export function revolutionEarth(position: number): Vec3 {
  return orbitPoint(REVOLUTION.orbit, revolutionAngle(position));
}
/** Arah sumbu Bumi (tetap di ruang): miring ke −x sebesar EARTH_TILT, atau tegak. */
export function earthAxis(tilted: boolean): Vec3 {
  return rotZ([0, 1, 0], tilted ? EARTH_TILT : 0);
}
/** Seberapa condong kutub utara ke Matahari (−1 … 1). > 0: musim panas di belahan utara. */
export function northTowardSun(position: number, tilted: boolean) {
  const e = revolutionEarth(position);
  const toSun: Vec3 = [-e[0], -e[1], -e[2]];
  const l = Math.hypot(...toSun);
  const a = earthAxis(tilted);
  return (a[0] * toSun[0] + a[1] * toSun[1] + a[2] * toSun[2]) / l;
}

// ------------------------------------------------------------------ U6 gerhana

export const ECLIPSE = {
  sun: [-5.4, 0, 0] as Vec3,
  sunRadius: 1.2,
  earthRadius: 0.9,
  moonOrbit: 2.4,
  moonRadius: 0.26,
  /** Panjang kerucut bayangan inti (digambar, tidak sesuai skala). */
  moonShadow: 1.6,
  earthShadow: 4,
};

/** Sudut Bulan (derajat) pada posisi 0…3; langkah 2 = segaris. Gerhana Matahari: Bulan di −x. */
export function moonAngle(position: number, variant: "solar" | "lunar") {
  const base = variant === "solar" ? 180 : 0;
  return base + (Math.min(Math.max(position, 0), 3) - 1.5) * 22;
}
export function moonPosition(position: number, variant: "solar" | "lunar"): Vec3 {
  return orbitPoint(ECLIPSE.moonOrbit, moonAngle(position, variant));
}

/** Kegelapan gerhana 0…1 (1 = segaris sempurna). */
export function eclipseDepth(position: number, variant: "solar" | "lunar") {
  const m = moonPosition(position, variant);
  const off = Math.abs(m[2]); // jarak dari garis Matahari–Bumi
  if (variant === "solar" ? m[0] > 0 : m[0] < 0) return 0;
  const reach = variant === "solar" ? ECLIPSE.moonRadius + 0.25 : ECLIPSE.earthRadius * (1 - ECLIPSE.moonOrbit / ECLIPSE.earthShadow) + ECLIPSE.moonRadius;
  return clamp01(1 - off / reach);
}

// ------------------------------------------------------------------ titik anotasi bernama

export interface AnchorContext {
  position: number;
  toggles: Record<string, boolean>;
  variant?: "solar" | "lunar";
}

/** Posisi dunia sebuah anchor anotasi (sebelum digeser ke titik fokus kamera). */
export function anchorPoint(scene: SceneKind, anchor: string, ctx: AnchorContext): Vec3 {
  switch (scene) {
    case "zones": {
      if (anchor === "sabuk") return orbitPoint((ZONES.belt.inner + ZONES.belt.outer) / 2, 250, 0.15);
      if (anchor === "sabuk-jauh") return orbitPoint((ZONES.belt.inner + ZONES.belt.outer) / 2, 120, 0.15);
      const p = ZONES.planets.find((x) => x.id === anchor);
      if (p) {
        const v = zonePlanet(p.id);
        return [v[0], v[1] + p.radius + 0.12, v[2]];
      }
      break;
    }
    case "meteor": {
      const s = meteorState(ctx.position);
      if (anchor === "batu") return [s.rock[0], s.rock[1] + 0.35, s.rock[2]];
      if (anchor === "atmosfer") return onSphere(METEOR.atmosphere - 0.3, 11);
      if (anchor === "jejak") return [METEOR_POINTS.entry[0] - 0.4, METEOR_POINTS.entry[1] + 0.75, 0];
      if (anchor === "tanah") return [METEOR_POINTS.ground[0] + 0.5, METEOR_POINTS.ground[1] - 0.25, 0];
      break;
    }
    case "rotation": {
      const tilted = ctx.toggles.tilt ?? true;
      const r = ROTATION.earthRadius;
      if (anchor === "siang") return [-r * 0.92, 0.35, 0.45];
      if (anchor === "malam") return [r * 0.92, 0.35, 0.45];
      if (anchor === "tempatmu") {
        // Penanda sedikit di atas titik oranye agar titiknya tetap terlihat.
        const p = rotationPin(ctx.position, tilted);
        return [p[0] * 1.32, p[1] * 1.32 + 0.1, p[2] * 1.32];
      }
      if (anchor === "sumbu") return rotX([0, r * 1.45, 0], tilted ? EARTH_TILT : 0);
      break;
    }
    case "revolution": {
      const e = revolutionEarth(ctx.position);
      if (anchor === "bumi") return [e[0], e[1] + REVOLUTION.earthRadius + 0.2, e[2]];
      if (anchor === "kutub") {
        const a = earthAxis(ctx.toggles.tilt ?? true);
        const k = REVOLUTION.earthRadius * 1.6;
        return [e[0] + a[0] * k, e[1] + a[1] * k, e[2] + a[2] * k];
      }
      if (anchor === "matahari") return [0, REVOLUTION.sunRadius + 0.3, 0];
      if (anchor === "jarak") return [e[0] / 2, 0.25, e[2] / 2];
      break;
    }
    case "eclipse": {
      const v = ctx.variant ?? "solar";
      const m = moonPosition(ctx.position, v);
      if (anchor === "bulan") return [m[0], m[1] + ECLIPSE.moonRadius + 0.2, m[2]];
      if (anchor === "bumi") return [0, ECLIPSE.earthRadius + 0.2, 0];
      if (anchor === "matahari") return [ECLIPSE.sun[0], ECLIPSE.sunRadius + 0.3, 0];
      if (anchor === "bayangan") return [-ECLIPSE.earthRadius * 0.95, -0.25, 0.25];
      if (anchor === "orbit") return orbitPoint(ECLIPSE.moonOrbit, 90);
      break;
    }
  }
  throw new Error(`anchor tidak dikenal: ${scene}/${anchor}`);
}

/** Titik fokus kamera per adegan (kamera berputar mengelilingi titik ini). */
export function sceneFocus(scene: SceneKind): Vec3 {
  switch (scene) {
    case "zones":
      return [0, 0, 0];
    case "meteor":
      return [-3.1, 0.3, 0];
    case "rotation":
      return [-0.7, 0, 0];
    case "revolution":
      return [0, 0, 0];
    case "eclipse":
      return [-0.9, 0, 0];
  }
}
