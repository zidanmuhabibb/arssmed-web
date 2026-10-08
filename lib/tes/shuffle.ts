/**
 * Urutan opsi diacak per siswa per butir (FR-35), deterministik dari benih (id percobaan + id butir)
 * sehingga urutan yang sama muncul lagi saat siswa kembali ke butir atau memuat ulang halaman.
 */

/** Hash 32-bit FNV-1a. */
export function hash32(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Pembangkit acak mulberry32. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const r = rng(hash32(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Urutan kunci opsi untuk satu siswa. `fixed` = urutan asli (mis. urutan planet). */
export function optionOrder(keys: readonly string[], seed: string, fixed: boolean) {
  return fixed ? [...keys] : seededShuffle(keys, seed);
}
