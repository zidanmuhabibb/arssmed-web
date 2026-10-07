"use client";

import type { EntryCard, EntryCardLabels } from "@/lib/cards/pdf";

/** Membuat dan mengunduh PDF kartu masuk di browser. PIN tidak dikirim ulang ke server. */
export async function downloadEntryCards(opts: {
  className: string;
  joinCode: string;
  cards: EntryCard[];
  labels: EntryCardLabels;
  fileName: string;
}) {
  const { buildEntryCardsPdf } = await import("@/lib/cards/pdf"); // pdf-lib dimuat hanya saat dibutuhkan
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") || window.location.host;
  const bytes = await buildEntryCardsPdf({ className: opts.className, joinCode: opts.joinCode, appUrl, cards: opts.cards, labels: opts.labels });
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
