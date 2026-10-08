/**
 * Antrean jawaban luring (FR-34, PRD §12.3). Murni: penyimpanan disuntikkan (IndexedDB di browser,
 * memori di test). Satu entri per (percobaan, butir); jawaban terbaru (cap waktu klien) menggantikan
 * yang lama sehingga tidak ada duplikat dan server menerima kondisi terakhir.
 */
import type { Answer } from "./session";

export interface QueuedResponse {
  key: string;
  attemptId: string;
  itemId: string;
  answer: Answer;
  /** Cap waktu klien (ms sejak epoch). */
  clientTs: number;
  responseTimeMs: number | null;
  optionOrder: { tier1: string[]; reason: string[] };
}

export interface QueueStore {
  getAll(): Promise<QueuedResponse[]>;
  put(r: QueuedResponse): Promise<void>;
  delete(key: string): Promise<void>;
}

export const queueKey = (attemptId: string, itemId: string) => `${attemptId}:${itemId}`;

// Baca-lalu-tulis harus berurutan: dua ketukan cepat (tier 1 lalu keyakinan) tidak boleh saling timpa.
const locks = new WeakMap<QueueStore, Promise<unknown>>();
function serialized<T>(store: QueueStore, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(store) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(store, next.catch(() => undefined));
  return next;
}

/** Masukkan jawaban; abaikan bila yang tersimpan lebih baru (urutan kejadian bisa terbalik). */
export function enqueue(store: QueueStore, r: Omit<QueuedResponse, "key">) {
  return serialized(store, async () => {
    const key = queueKey(r.attemptId, r.itemId);
    const existing = (await store.getAll()).find((x) => x.key === key);
    if (existing && existing.clientTs > r.clientTs) return existing;
    const entry = { ...r, key };
    await store.put(entry);
    return entry;
  });
}

export type SendResult = "ok" | "retry" | "drop";

/**
 * Kirim semua entri berurutan (cap waktu terlama dulu). Entri dihapus hanya bila server menerima
 * ("ok") atau menolak permanen ("drop", mis. tes sudah ditutup) DAN entri itu belum diganti jawaban
 * yang lebih baru selama pengiriman. Berhenti pada galat jaringan pertama ("retry").
 */
export async function flush(store: QueueStore, send: (r: QueuedResponse) => Promise<SendResult>) {
  const pending = (await store.getAll()).sort((a, b) => a.clientTs - b.clientTs);
  let sent = 0;
  const dropped: QueuedResponse[] = [];
  for (const r of pending) {
    const res = await send(r);
    if (res === "retry") return { sent, dropped, remaining: (await store.getAll()).length };
    await serialized(store, async () => {
      const now = (await store.getAll()).find((x) => x.key === r.key);
      if (now && now.clientTs === r.clientTs) await store.delete(r.key);
    });
    if (res === "drop") dropped.push(r);
    else sent++;
  }
  return { sent, dropped, remaining: (await store.getAll()).length };
}

/** Penyimpanan di memori (test, dan cadangan bila IndexedDB tidak tersedia). */
export function memoryQueueStore(): QueueStore {
  const m = new Map<string, QueuedResponse>();
  return {
    getAll: async () => [...m.values()].map((x) => structuredClone(x)),
    put: async (r) => void m.set(r.key, structuredClone(r)),
    delete: async (k) => void m.delete(k),
  };
}

/** Penundaan percobaan ulang: 1 s, 2 s, 4 s … maks. 30 s. */
export function backoff(attempt: number) {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
}
