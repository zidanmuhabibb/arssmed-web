/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: (PrecacheEntry | string)[] | undefined };

/*
 * Service worker ARSSMED (PRD §12.3, DECISIONS.md D-007).
 * M0: shell + halaman offline + strategi cache bawaan Next.
 * M8: aset 3D/AR (model, tekstur, kartu penanda, MindAR) CacheFirst. M6: antrean jawaban tes tetap di IndexedDB
 * (bukan di SW), agar logika sinkron dapat diuji tanpa browser.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // PRD §12.3: setelah unit dibuka sekali, aset 3D/AR-nya (model, tekstur, kartu penanda, MindAR) tersedia luring.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && /^\/(models|textures|markers|vendor)\//.test(url.pathname),
      handler: new CacheFirst({
        cacheName: "arssmed-aset-3d",
        plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 60 })],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
