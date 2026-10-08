/**
 * Deteksi kemampuan perangkat (FR-17) dan pilihan cara membuka AR permukaan (FR-14).
 * Bagian murni (tanpa `window`) diuji di Node; `detectCapabilities` hanya dipanggil di browser.
 *
 * Cara AR (mengikuti @google/model-viewer, tanpa memuat pustakanya):
 *  - iPhone/iPad: AR Quick Look — tautan rel="ar" ke berkas USDZ.
 *  - Android (bukan Firefox/Oculus): Scene Viewer lewat intent; bila tidak tersedia,
 *    Chrome kembali ke halaman ini dengan penanda #tanpa-ar.
 *  - Laptop/lainnya: tidak ada AR; tombol dinonaktifkan dengan penjelasan ramah.
 */

export type DeviceKind = "android" | "ios" | "desktop" | "other";
export type ArMode = "quick-look" | "scene-viewer" | "none";
export type ArUnavailableReason = "desktop" | "browser" | "failed";

export interface Capabilities {
  device: DeviceKind;
  webgl: boolean;
  /** WebXR immersive-ar (dicatat untuk peneliti; tidak dipakai untuk membuka AR). */
  webxrAR: boolean | null;
  quickLook: boolean;
  /** Ada kamera (tanpa meminta izin). null = tidak bisa diketahui. */
  camera: boolean | null;
  firefox: boolean;
  oculus: boolean;
}

export interface UaInfo {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  /** Navigator UA Client Hints, bila ada. */
  uaDataPlatform?: string;
  uaDataMobile?: boolean;
}

export function deviceKind(ua: UaInfo): DeviceKind {
  const s = ua.userAgent;
  if (/android/i.test(s) || ua.uaDataPlatform === "Android") return "android";
  // iPadOS 13+ melapor sebagai Mac; satu-satunya Mac layar sentuh adalah iPad.
  if (/iPad|iPhone|iPod/.test(s) || (ua.platform === "MacIntel" && (ua.maxTouchPoints ?? 0) > 1)) return "ios";
  if (/Windows|Macintosh|Mac OS X|Linux|CrOS/.test(s) && !ua.uaDataMobile) return "desktop";
  return "other";
}

/** Cara AR yang dipakai, atau alasan tidak tersedia. */
export function chooseArMode(c: Capabilities, failedBefore = false): { mode: ArMode; reason: ArUnavailableReason | null } {
  if (failedBefore) return { mode: "none", reason: "failed" };
  if (c.device === "ios") return c.quickLook ? { mode: "quick-look", reason: null } : { mode: "none", reason: "browser" };
  if (c.device === "android") return c.firefox || c.oculus ? { mode: "none", reason: "browser" } : { mode: "scene-viewer", reason: null };
  return { mode: "none", reason: c.device === "desktop" ? "desktop" : "browser" };
}

export const NO_AR_HASH = "#tanpa-ar";

/**
 * Tautan intent Scene Viewer (format sama dengan @google/model-viewer 4.x).
 * `modelUrl` dan `pageUrl` harus absolut (https di produksi).
 */
export function sceneViewerIntent(modelUrl: string, pageUrl: string, title: string) {
  const fallback = new URL(pageUrl);
  fallback.hash = NO_AR_HASH;
  const params = new URLSearchParams({ mode: "ar_preferred", disable_occlusion: "true", title });
  return (
    `intent://arvr.google.com/scene-viewer/1.2?${params.toString()}&file=${encodeURIComponent(modelUrl)}` +
    `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;` +
    `S.browser_fallback_url=${encodeURIComponent(fallback.toString())};end;`
  );
}

// ---------------------------------------------------------------- browser

const KEY = "arssmed:kemampuan";

/** Deteksi sekali per sesi (FR-17); hasil disimpan di sessionStorage. */
export async function detectCapabilities(): Promise<Capabilities> {
  try {
    const cached = sessionStorage.getItem(KEY);
    if (cached) return JSON.parse(cached) as Capabilities;
  } catch {
    // sessionStorage diblokir: deteksi ulang
  }
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string; mobile?: boolean };
    xr?: { isSessionSupported(mode: string): Promise<boolean> };
  };
  const ua: UaInfo = {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    uaDataPlatform: nav.userAgentData?.platform,
    uaDataMobile: nav.userAgentData?.mobile,
  };
  const a = document.createElement("a");
  const quickLook = Boolean(a.relList?.supports?.("ar"));
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  let webxrAR: boolean | null = null;
  try {
    webxrAR = nav.xr ? await nav.xr.isSessionSupported("immersive-ar") : false;
  } catch {
    webxrAR = null;
  }
  let camera: boolean | null = null;
  try {
    const devices = await nav.mediaDevices?.enumerateDevices();
    camera = devices ? devices.some((d) => d.kind === "videoinput") : null;
  } catch {
    camera = null;
  }
  const caps: Capabilities = {
    device: deviceKind(ua),
    webgl,
    webxrAR,
    quickLook,
    camera,
    firefox: /firefox/i.test(ua.userAgent),
    oculus: /OculusBrowser/.test(ua.userAgent),
  };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(caps));
  } catch {
    // abaikan
  }
  return caps;
}
