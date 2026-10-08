"use client";

/**
 * Nilai yang hanya ada di browser (WebGL, gerak dikurangi, kemajuan tersimpan) sebagai
 * "external store" agar Viewer tetap bisa dirender server (cepat tampil) tanpa
 * ketidakcocokan hidrasi: di server nilainya netral, di browser nilai sebenarnya.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { hasWebGL, prefersReducedMotion } from "./webgl";

const noop = () => () => {};

export function useWebGL(): boolean | null {
  return useSyncExternalStore(noop, hasWebGLCached, () => null);
}
let webglCache: boolean | undefined;
function hasWebGLCached() {
  return (webglCache ??= hasWebGL());
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      try {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        mq.addEventListener("change", cb);
        return () => mq.removeEventListener("change", cb);
      } catch {
        return () => {};
      }
    },
    prefersReducedMotion,
    () => false,
  );
}

// ---- kemajuan "sudah dilihat" per unit (localStorage, cadangan di memori)

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function read(key: string): string {
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    // privat/diblokir: pakai memori
  }
  return memory.get(key) ?? "";
}
function write(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // abaikan
  }
  listeners.forEach((l) => l());
}
function parse(raw: string): string[] {
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useViewed(key: string): [string[], (id: string) => void] {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => read(key),
    () => "",
  );
  const viewed = useMemo(() => parse(raw), [raw]);
  const markSeen = useCallback(
    (id: string) => {
      const current = parse(read(key));
      if (!current.includes(id)) write(key, JSON.stringify([...current, id]));
    },
    [key],
  );
  return [viewed, markSeen];
}
