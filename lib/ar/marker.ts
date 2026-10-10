/**
 * AR penanda (FR-15): bagian murni untuk penataan kamera dan video. Mengikuti MindAR 1.2.5
 * (src/image-target/three.js, lisensi MIT) untuk kasus inputWidth/Height = ukuran video.
 */

export const MINDAR_URL = "/vendor/mindar-1.2.5/mindar-image.prod.js";
export const markerUrls = (unit: string) => ({ mind: `/markers/${unit}.mind`, png: `/markers/${unit}.png` });
export const MARKER_PDF = "/markers/kartu-penanda.pdf";

export interface MarkerLayout {
  /** Kamera three.js (derajat, satuan dunia MindAR). */
  fov: number;
  near: number;
  far: number;
  aspect: number;
  /** Posisi & ukuran CSS video agar menutupi kotak (object-fit: cover, terpusat). */
  video: { top: number; left: number; width: number; height: number };
}

/**
 * @param proj matriks proyeksi MindAR (kolom-mayor, 16 angka)
 * @param videoW,videoH ukuran asli video kamera
 * @param boxW,boxH ukuran kotak tampilan (CSS px)
 */
export function markerLayout(proj: readonly number[], videoW: number, videoH: number, boxW: number, boxH: number): MarkerLayout {
  if (!(videoW > 0 && videoH > 0 && boxW > 0 && boxH > 0)) throw new Error("Ukuran video dan kotak harus positif");
  const videoRatio = videoW / videoH;
  const boxRatio = boxW / boxH;
  let vw: number;
  let vh: number;
  if (videoRatio > boxRatio) {
    vh = boxH;
    vw = vh * videoRatio;
  } else {
    vw = boxW;
    vh = vw / videoRatio;
  }
  // Tinggi video yang tampil menentukan seberapa besar kamera virtual "memotong" bidang pandang.
  const fovAdjust = boxH / vh;
  return {
    fov: (2 * Math.atan((1 / proj[5]!) * fovAdjust) * 180) / Math.PI,
    near: proj[14]! / (proj[10]! - 1),
    far: proj[14]! / (proj[10]! + 1),
    aspect: boxW / boxH,
    video: { top: -(vh - boxH) / 2, left: -(vw - boxW) / 2, width: vw, height: vh },
  };
}

/** Skala agar benda (dimensi terbesar `maxDim`) selebar `fraction` kartu. */
export function fitScale(maxDim: number, fraction = 0.6) {
  return maxDim > 0 ? fraction / maxDim : 1;
}

/** Alasan kamera gagal → status tampilan. */
export function cameraErrorKind(e: unknown): "denied" | "unsupported" | "error" {
  const name = typeof e === "object" && e && "name" in e ? String((e as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotSupportedError" || name === "TypeError") return "unsupported";
  return "error";
}
