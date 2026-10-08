"use client";

/**
 * Penyimpanan perangkat untuk tes (FR-34): antrean jawaban dan salinan butir terakhir di IndexedDB,
 * agar tes bisa dilanjutkan saat sinyal hilang, bahkan setelah halaman dimuat ulang.
 * Bila IndexedDB tidak tersedia (mode privat lama), jatuh ke memori.
 */
import { memoryQueueStore, type QueuedResponse, type QueueStore } from "./queue";
import type { AttemptPayload } from "./types";

const DB = "arssmed-tes";
const QUEUE = "antrean";
const SNAP = "salinan";

let dbPromise: Promise<IDBDatabase | null> | null = null;
function open(): Promise<IDBDatabase | null> {
  return (dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(QUEUE, { keyPath: "key" });
        req.result.createObjectStore(SNAP);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const fallback = memoryQueueStore();
const memSnap = new Map<string, AttemptPayload>();

export const deviceQueue: QueueStore = {
  async getAll() {
    const db = await open();
    return db ? tx<QueuedResponse[]>(db, QUEUE, "readonly", (s) => s.getAll() as IDBRequest<QueuedResponse[]>) : fallback.getAll();
  },
  async put(r) {
    const db = await open();
    if (db) await tx(db, QUEUE, "readwrite", (s) => s.put(r));
    else await fallback.put(r);
  },
  async delete(key) {
    const db = await open();
    if (db) await tx(db, QUEUE, "readwrite", (s) => s.delete(key));
    else await fallback.delete(key);
  },
};

/** Salinan butir + jawaban per siswa per fase (tanpa kunci jawaban). */
export async function saveSnapshot(scope: string, p: AttemptPayload) {
  const key = `${scope}:${p.phase}`;
  const db = await open();
  if (db) await tx(db, SNAP, "readwrite", (s) => s.put(p, key)).catch(() => undefined);
  else memSnap.set(key, p);
}
export async function loadSnapshot(scope: string, phase: string): Promise<AttemptPayload | null> {
  const key = `${scope}:${phase}`;
  const db = await open();
  if (!db) return memSnap.get(key) ?? null;
  return ((await tx(db, SNAP, "readonly", (s) => s.get(key)).catch(() => null)) as AttemptPayload | undefined) ?? null;
}
