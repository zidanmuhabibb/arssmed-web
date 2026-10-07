"use client";

import { useTranslations } from "next-intl";
import type { EntryCardLabels } from "@/lib/cards/pdf";

export function useCardLabels(): { labels: EntryCardLabels; fileName: (className: string) => string } {
  const t = useTranslations("guru.cards");
  return {
    labels: {
      title: t("title"),
      joinCode: t("joinCode"),
      studentCode: t("studentCode"),
      pin: t("pin"),
      openAt: t("openAt"),
      keepSafe: t("keepSafe"),
      className: t("className"),
    },
    fileName: (className) => t("fileName", { className: className.replace(/[^\p{L}\p{N}-]+/gu, "-") }),
  };
}
