export type NavKey = "belajar" | "tes" | "panduan";

export interface NavItem {
  key: NavKey;
  href: `/${string}`;
}

/** Tiga tujuan utama (FR-02). Urutan = urutan tampil. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { key: "belajar", href: "/belajar" },
  { key: "tes", href: "/tes" },
  { key: "panduan", href: "/panduan" },
] as const;

/**
 * Menentukan tujuan aktif dari pathname.
 * Beranda ("/") dianggap bagian dari Belajar karena merupakan pintu masuk belajar.
 */
export function activeNavKey(pathname: string): NavKey | null {
  const path = normalize(pathname);
  if (path === "/") return "belajar";
  for (const item of PRIMARY_NAV) {
    if (path === item.href || path.startsWith(`${item.href}/`)) return item.key;
  }
  return null;
}

function normalize(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/)[0] ?? "/";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery || "/";
}
