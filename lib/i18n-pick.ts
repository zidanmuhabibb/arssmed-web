import { getMessages } from "next-intl/server";

/**
 * Hanya kirim namespace pesan yang dipakai komponen klien di bawah provider,
 * agar HTML/JS awal tidak membawa seluruh messages/id.json.
 */
export async function pickMessages(namespaces: readonly string[]) {
  const all = (await getMessages()) as Record<string, unknown>;
  return Object.fromEntries(namespaces.filter((n) => n in all).map((n) => [n, all[n]]));
}
