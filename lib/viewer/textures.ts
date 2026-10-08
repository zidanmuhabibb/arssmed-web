/**
 * Tekstur prosedural benda langit (PRD §13: dibuat prosedural, tanpa aset berlisensi).
 * Bersifat ilustratif, bukan peta permukaan sebenarnya. Dibuat saat build oleh
 * scripts/build-textures.mjs menjadi WebP di public/textures/ (tidak membebani HP siswa).
 */
import { planet } from "@/lib/design/tokens";

export type Look = "sun" | "earth" | "moon" | "dwarf" | "comet" | "asteroid" | "rocky" | "venus" | "mars" | "jupiter" | "saturn" | "icy";

/** Derau nilai 2D yang bisa diulang (seed tetap → gambar sama setiap kali). */
export function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
  const fade = (t: number) => t * t * (3 - 2 * t);
  const hash = (x: number, y: number) => perm[(perm[x & 255]! + y) & 255]! / 255;
  const value = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  /** Derau fraktal 0–1. Periodik pada sumbu x dengan periode `wrap` agar jahitan peta tidak terlihat. */
  return (x: number, y: number, octaves = 4, wrap = 0) => {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const fx = x * freq, fy = y * freq;
      let v = value(fx, fy);
      if (wrap) {
        const w = wrap * freq;
        const t = (fx % w) / w;
        v = v * (1 - t) + value(fx - w, fy) * t;
      }
      sum += v * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function shade(c: [number, number, number], k: number): [number, number, number] {
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
}

/** Lukis peta equirectangular ke ImageData (w × h). */
export function paintSurface(look: Look, color: string, w = 512, h = 256, seed = 7): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const noise = makeNoise(seed);
  const base = hexToRgb(color);
  const wrapX = 8;
  const craters = look === "moon" || look === "rocky" || look === "dwarf" || look === "asteroid"
    ? Array.from({ length: 70 }, (_, i) => {
        const r = makeNoise(seed + i);
        return { x: r(i * 3.1, 1.7) * w, y: (0.1 + 0.8 * r(1.3, i * 2.2)) * h, rad: 3 + r(i, i) * 14 };
      })
    : [];

  for (let y = 0; y < h; y++) {
    const lat = (y / h) * 2 - 1; // -1 kutub utara … 1 kutub selatan
    const rowCraters = craters.filter((cr) => Math.abs(y - cr.y) * 1.6 < cr.rad);
    for (let x = 0; x < w; x++) {
      const u = (x / w) * wrapX;
      const v = (y / h) * 4;
      let c: [number, number, number];
      switch (look) {
        case "sun": {
          const n = noise(u * 2, v * 2, 5, wrapX * 2);
          c = mix(hexToRgb("#e8890c"), hexToRgb("#ffd36b"), n);
          break;
        }
        case "earth": {
          const n = noise(u * 0.8, v * 0.8, 5, wrapX * 0.8);
          const ocean = hexToRgb(planet.bumi);
          if (Math.abs(lat) > 0.86) c = [235, 242, 247];
          else if (n > 0.55) c = mix(hexToRgb("#5a8f3c"), hexToRgb("#a68558"), Math.min(1, (n - 0.55) * 4));
          else c = shade(ocean, 0.8 + n * 0.4);
          const cloud = noise(u * 1.6 + 40, v * 2.4, 4, wrapX * 1.6);
          if (cloud > 0.62) c = mix(c, [250, 252, 255], Math.min(1, (cloud - 0.62) * 3));
          break;
        }
        case "venus": {
          const n = noise(u * 0.6, v * 2.2 + noise(u, v, 2, wrapX) * 2, 4, wrapX * 0.6);
          c = mix(hexToRgb("#c98f2f"), hexToRgb("#f2d48f"), n);
          break;
        }
        case "mars": {
          const n = noise(u, v, 5, wrapX);
          c = shade(base, 0.7 + n * 0.55);
          if (Math.abs(lat) > 0.9) c = [240, 236, 230];
          break;
        }
        case "jupiter":
        case "saturn": {
          const band = Math.sin(lat * (look === "jupiter" ? 22 : 14) + noise(u, v * 3, 3, wrapX) * 2.2);
          const light = look === "jupiter" ? hexToRgb("#efe1c6") : hexToRgb("#efe2b8");
          c = mix(shade(base, 0.85), light, (band + 1) / 2);
          if (look === "jupiter") {
            const dx = (x / w - 0.62) * 3.2, dy = (lat - 0.35) * 6;
            if (dx * dx + dy * dy < 1) c = mix(c, hexToRgb("#b5533b"), 0.75);
          }
          break;
        }
        case "icy": {
          const band = Math.sin(lat * 10 + noise(u, v, 2, wrapX)) * 0.06;
          c = shade(base, 0.92 + band + noise(u, v, 3, wrapX) * 0.1);
          break;
        }
        case "comet": {
          const n = noise(u * 2, v * 2, 4, wrapX * 2);
          c = mix([70, 74, 82], [150, 155, 162], n);
          break;
        }
        default: {
          // moon, rocky, dwarf, asteroid
          const n = noise(u * 1.5, v * 1.5, 5, wrapX * 1.5);
          c = shade(base, 0.65 + n * 0.6);
        }
      }
      for (const cr of rowCraters) {
        const dx = Math.min(Math.abs(x - cr.x), w - Math.abs(x - cr.x));
        if (dx > cr.rad) continue;
        const d = Math.hypot(dx, (y - cr.y) * 1.6) / cr.rad;
        if (d < 1) c = shade(c, d > 0.78 ? 1.08 : 0.88 + 0.08 * d);
      }
      const i = (y * w + x) * 4;
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = 255;
    }
  }
  return out;
}
