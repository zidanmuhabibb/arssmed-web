/** Geometri murni untuk Viewer (tanpa three.js agar bisa diuji di Node). */
export type Vec3 = [number, number, number];

/** Lintang/bujur (derajat) → titik di permukaan bola berjari-jari r. Bujur 0 menghadap kamera awal (+z). */
export function latLonToVector(lat: number, lon: number, r: number): Vec3 {
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  return [r * Math.cos(phi) * Math.sin(lam), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(lam)];
}

export function length(v: Vec3) {
  return Math.hypot(v[0], v[1], v[2]);
}

export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

/** Posisi kamera yang menatap titik anotasi dari arah normalnya, pada jarak d dari pusat. */
export function cameraForPoint(point: Vec3, d: number): Vec3 {
  const l = length(point) || 1;
  return scale(point, d / l);
}

/** Putar posisi kamera mengelilingi sumbu Y (derajat), jarak tetap. */
export function orbitY(pos: Vec3, deg: number): Vec3 {
  const a = (deg * Math.PI) / 180;
  const [x, y, z] = pos;
  return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
}

/** Ubah jarak kamera ke pusat dengan faktor, dibatasi [min, max]. */
export function zoomTo(pos: Vec3, factor: number, min: number, max: number): Vec3 {
  const l = length(pos) || 1;
  const target = Math.min(max, Math.max(min, l * factor));
  return scale(pos, target / l);
}

/** Jarak kamera bawaan agar objek berjari-jari r memenuhi ±60% tinggi pandang (fov derajat). */
export function defaultDistance(r: number, fovDeg = 40) {
  const half = ((fovDeg / 2) * Math.PI) / 180;
  return (r / 0.6) / Math.tan(half);
}
