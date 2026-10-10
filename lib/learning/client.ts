"use client";

/**
 * Kemajuan belajar di browser: simpanan perangkat (per siswa, atau "tamu") digabung dengan
 * status server. Halaman tetap statis; status dibaca sebagai external store agar tidak
 * ada ketidakcocokan hidrasi. Tulis ke perangkat dulu (jalan saat sinyal lemah), lalu ke
 * server; yang belum terkirim dikirim ulang saat halaman dibuka lagi (PRD §12.3).
 */
import { useSyncExternalStore } from "react";
import { learningAction, type LearningOp } from "@/app/actions/learning";
import { EMPTY_STATE, mergeStates, pendingSync, STEPS, type LearningState, type Step } from "./flow";

export interface LearningSnapshotClient {
  /** false sampai status server diketahui (atau gagal diambil). */
  ready: boolean;
  scope: string | null;
  isStudent: boolean;
  freeMode: boolean;
  state: LearningState;
}

type Remote = { scope: string; server: LearningState | null; freeMode: boolean };

const LAST_SCOPE = "arssmed:belajar:scope";
const keyOf = (scope: string) => `arssmed:belajar:${scope}`;
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
let remote: Remote | null = null;
let fetching: Promise<void> | null = null;
let snapshot: LearningSnapshotClient | null = null;

const SERVER_SNAPSHOT: LearningSnapshotClient = { ready: false, scope: null, isStudent: false, freeMode: false, state: EMPTY_STATE };

function read(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    // mode privat / diblokir
  }
  return memory.get(key) ?? null;
}
function write(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // abaikan: tetap tersimpan di memori selama halaman terbuka
  }
}

function parseState(raw: string | null): LearningState {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<LearningState>) : {};
    return {
      steps: Object.fromEntries(
        Object.entries(v.steps ?? {}).map(([u, ss]) => [u, (Array.isArray(ss) ? ss : []).filter((s): s is Step => (STEPS as readonly string[]).includes(s))]),
      ),
      predictions: typeof v.predictions === "object" && v.predictions ? (v.predictions as Record<string, string>) : {},
      viewed: typeof v.viewed === "object" && v.viewed ? (v.viewed as Record<string, string[]>) : {},
      discussed: Array.isArray(v.discussed) ? v.discussed : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

function currentScope(): string | null {
  return remote?.scope ?? read(LAST_SCOPE);
}

function emit() {
  snapshot = null;
  listeners.forEach((l) => l());
}

function getSnapshot(): LearningSnapshotClient {
  if (snapshot) return snapshot;
  const scope = currentScope();
  const local = scope ? parseState(read(keyOf(scope))) : EMPTY_STATE;
  const state = remote?.server ? mergeStates(remote.server, local) : local;
  snapshot = { ready: remote !== null, scope, isStudent: !!scope && scope !== "tamu", freeMode: remote?.freeMode ?? false, state };
  return snapshot;
}

async function send(op: LearningOp) {
  try {
    return await learningAction(op);
  } catch {
    return null; // jaringan putus: tetap tersimpan di perangkat, dikirim ulang nanti
  }
}

/** Kirim ulang yang tersimpan di perangkat tetapi belum di server (urutan langkah dijaga). */
async function resync(scope: string, server: LearningState) {
  const p = pendingSync(parseState(read(keyOf(scope))), server);
  if (p.empty) return;
  for (const x of p.predictions) await send({ kind: "prediction", key: x.key, option: x.option as "A" | "B" | "C" });
  for (const x of p.views) await send({ kind: "view", unit: x.unit, object: x.object });
  for (const s of STEPS) for (const x of p.steps.filter((y) => y.step === s)) await send({ kind: "step", unit: x.unit, step: x.step });
  for (const u of p.discussed) await send({ kind: "discussed", unit: u });
}

function ensureFetched() {
  if (fetching) return;
  fetching = fetch("/api/belajar/kemajuan", { cache: "no-store", credentials: "same-origin" })
    .then((r) => (r.ok ? (r.json() as Promise<Remote>) : Promise.reject(new Error(String(r.status)))))
    .then((r) => {
      remote = r;
      write(LAST_SCOPE, r.scope);
      emit();
      if (r.server) void resync(r.scope, r.server);
    })
    .catch(() => {
      // Luring: pakai simpanan perangkat terakhir.
      remote = { scope: read(LAST_SCOPE) ?? "tamu", server: null, freeMode: false };
      emit();
    });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  ensureFetched();
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("arssmed:belajar:")) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function update(fn: (s: LearningState) => LearningState) {
  const scope = currentScope() ?? "tamu";
  const next = fn(parseState(read(keyOf(scope))));
  write(keyOf(scope), JSON.stringify(next));
  emit();
}

function applyServer(fn: (s: LearningState) => LearningState) {
  if (remote?.server) {
    remote = { ...remote, server: fn(remote.server) };
    emit();
  }
}

const addUnique = <T,>(xs: readonly T[] | undefined, x: T) => (xs?.includes(x) ? [...xs] : [...(xs ?? []), x]);

export function useLearning(): LearningSnapshotClient {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

/** Aksi; semuanya menulis ke perangkat dulu lalu ke server bila siswa masuk. */
export const learning = {
  /** Tebakan pertama berlaku. Mengembalikan jawaban yang tersimpan. */
  async answer(key: string, option: "A" | "B" | "C") {
    const existing = getSnapshot().state.predictions[key];
    if (existing) return existing;
    update((s) => ({ ...s, predictions: { ...s.predictions, [key]: option } }));
    const r = await send({ kind: "prediction", key, option });
    if (r?.ok && r.selected) {
      const selected = r.selected;
      update((s) => ({ ...s, predictions: { ...s.predictions, [key]: selected } }));
      applyServer((s) => ({ ...s, predictions: { ...s.predictions, [key]: selected } }));
      return selected;
    }
    return option;
  },
  async view(unit: string, object: string) {
    if (getSnapshot().state.viewed[unit]?.includes(object)) return;
    update((s) => ({ ...s, viewed: { ...s.viewed, [unit]: addUnique(s.viewed[unit], object) } }));
    const r = await send({ kind: "view", unit, object });
    if (r?.ok && !r.local) applyServer((s) => ({ ...s, viewed: { ...s.viewed, [unit]: addUnique(s.viewed[unit], object) } }));
  },
  /** AR permukaan dibuka (FR-14): selalu dicatat sebagai tampilan "ar_surface". */
  arView(unit: string, object: string) {
    update((s) => ({ ...s, viewed: { ...s.viewed, [unit]: addUnique(s.viewed[unit], object) } }));
    void send({ kind: "view", unit, object, mode: "ar_surface" });
  },
  /** AR penanda (FR-15): kartu dikenali dan benda tampil → tampilan "ar_marker". */
  markerView(unit: string, object: string) {
    update((s) => ({ ...s, viewed: { ...s.viewed, [unit]: addUnique(s.viewed[unit], object) } }));
    void send({ kind: "view", unit, object, mode: "ar_marker" });
  },
  /** Mengembalikan galat server (mis. "locked") bila ada, agar UI bisa menjelaskan. */
  async complete(unit: string, step: Step): Promise<string | null> {
    update((s) => ({ ...s, steps: { ...s.steps, [unit]: STEPS.filter((x) => addUnique(s.steps[unit], step).includes(x)) } }));
    const r = await send({ kind: "step", unit, step });
    if (r && !r.ok) {
      // Server menolak (mis. urutan belum lengkap): batalkan tanda di perangkat agar tidak menyesatkan.
      update((s) => ({ ...s, steps: { ...s.steps, [unit]: (s.steps[unit] ?? []).filter((x) => x !== step) } }));
      return r.error;
    }
    if (r?.ok && !r.local) applyServer((s) => ({ ...s, steps: { ...s.steps, [unit]: STEPS.filter((x) => addUnique(s.steps[unit], step).includes(x)) } }));
    return null;
  },
  async discussed(unit: string): Promise<string | null> {
    update((s) => ({
      ...s,
      discussed: addUnique(s.discussed, unit),
      steps: { ...s.steps, [unit]: STEPS.filter((x) => addUnique(s.steps[unit], "jelaskan").includes(x)) },
    }));
    const r = await send({ kind: "discussed", unit });
    if (r && !r.ok) {
      update((s) => ({
        ...s,
        discussed: s.discussed.filter((u) => u !== unit),
        steps: { ...s.steps, [unit]: (s.steps[unit] ?? []).filter((x) => x !== "jelaskan") },
      }));
      return r.error;
    }
    if (r?.ok && !r.local)
      applyServer((s) => ({ ...s, discussed: addUnique(s.discussed, unit), steps: { ...s.steps, [unit]: STEPS.filter((x) => addUnique(s.steps[unit], "jelaskan").includes(x)) } }));
    return null;
  },
};
