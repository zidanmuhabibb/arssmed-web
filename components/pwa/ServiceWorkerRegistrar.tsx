"use client";

import { useEffect } from "react";

/** Mendaftarkan service worker hanya di produksi (dev selalu jaringan langsung). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Gagal mendaftar tidak boleh mengganggu belajar; aplikasi tetap jalan online.
    });
  }, []);
  return null;
}
