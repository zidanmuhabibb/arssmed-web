/** Format angka Indonesia (koma desimal) untuk dasbor. Murni. */
const cache = new Map<number, Intl.NumberFormat>();
function nf(digits: number) {
  let f = cache.get(digits);
  if (!f) cache.set(digits, (f = new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits })));
  return f;
}

export const fmt = (x: number, digits = 1) => (Number.isFinite(x) ? nf(digits).format(x) : "—");
export const fmtPct = (x: number, digits = 1) => `${fmt(x, digits)}%`;
/** p < 0,001 ditulis sebagai batas (konvensi APA). */
export const fmtP = (p: number) => (p < 0.001 ? "< 0,001" : fmt(p, 3));
