"use client";

/**
 * Status AR di browser sebagai external store (tanpa setState di effect, tanpa ketidakcocokan hidrasi):
 * kemampuan perangkat (dideteksi sekali per sesi), penanda "AR gagal" dari Scene Viewer, dan izin kamera.
 */
import { useSyncExternalStore } from "react";
import { detectCapabilities, NO_AR_HASH, type Capabilities } from "./capabilities";

const FAILED = "arssmed:ar-gagal";
const CONSENT = "arssmed:izin-ar";

export interface ArState {
  caps: Capabilities | null;
  failed: boolean;
  consent: boolean;
  /** Baru saja kembali dari Scene Viewer yang gagal dibuka (untuk pesan sekali). */
  justFailed: boolean;
}

const SERVER: ArState = { caps: null, failed: false, consent: false, justFailed: false };
let state: ArState = SERVER;
let started = false;
const listeners = new Set<() => void>();

function get(key: string) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function set(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // abaikan
  }
}
function emit(next: Partial<ArState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function checkHash() {
  if (window.location.hash !== NO_AR_HASH) return;
  set(FAILED);
  // Hapus penanda dari alamat tanpa menambah riwayat.
  history.replaceState(history.state, "", window.location.pathname + window.location.search);
  emit({ failed: true, justFailed: true });
}

function start() {
  if (started) return;
  started = true;
  state = { ...state, failed: get(FAILED), consent: get(CONSENT) };
  checkHash();
  window.addEventListener("hashchange", checkHash);
  void detectCapabilities().then((caps) => emit({ caps }));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  start();
  return () => listeners.delete(cb);
}

export function useArState(): ArState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

export const arStore = {
  giveConsent() {
    set(CONSENT);
    emit({ consent: true });
  },
  dismissFailure() {
    emit({ justFailed: false });
  },
};
