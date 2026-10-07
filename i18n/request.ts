import { getRequestConfig } from "next-intl/server";

export const DEFAULT_LOCALE = "id" as const;

// Lokal tunggal (lihat DECISIONS.md D-003): tidak membaca header/cookie,
// sehingga aman dipakai bersama cacheComponents.
export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  timeZone: "Asia/Jakarta",
  messages: (await import(`../messages/${DEFAULT_LOCALE}.json`)).default,
}));
