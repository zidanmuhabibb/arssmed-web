"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Camera, ShieldCheck, View } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { chooseArMode, sceneViewerIntent } from "@/lib/ar/capabilities";
import { arStore, useArState } from "@/lib/ar/store";

/**
 * "Lihat di ruanganmu" (FR-14) dengan layar penjelasan kamera (FR-16) dan cadangan 3D.
 * iPhone/iPad: AR Quick Look (USDZ). Android: Scene Viewer (GLB). Laptop: tombol nonaktif + alasan.
 */
export function ArButton({
  title,
  glb,
  usdz,
  onLaunch,
}: {
  title: string;
  glb: string;
  usdz: string;
  /** Dipanggil tepat sebelum AR dibuka (mencatat tampilan ar_surface). */
  onLaunch: () => void;
}) {
  const t = useTranslations("viewer.ar");
  const ar = useArState();
  const [asking, setAsking] = useState(false);
  const hintId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const { mode, reason } = ar.caps ? chooseArMode(ar.caps, ar.failed) : { mode: "none" as const, reason: null };

  function launch() {
    onLaunch();
    const a = document.createElement("a");
    if (mode === "quick-look") {
      // Quick Look mensyaratkan tautan rel="ar" berisi satu <img>.
      a.rel = "ar";
      a.href = new URL(usdz, window.location.href).toString();
      a.appendChild(document.createElement("img"));
    } else {
      a.href = sceneViewerIntent(new URL(glb, window.location.href).toString(), window.location.href, title);
    }
    a.click();
  }

  function onClick() {
    if (ar.consent) launch();
    else setAsking(true);
  }

  const disabled = !ar.caps || mode === "none";
  return (
    <div className="flex flex-col gap-2" data-testid="ar-panel" data-ar-mode={ar.caps ? mode : "checking"}>
      <button
        ref={trigger}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-describedby={reason ? hintId : undefined}
        className="tekan inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-matahari px-6 text-[1.05rem] font-semibold text-matahari-tinta active:bg-matahari-tekan disabled:cursor-not-allowed disabled:opacity-50"
      >
        <View aria-hidden="true" className="size-5" />
        {t("open")}
      </button>
      {reason ? (
        <p id={hintId} className="text-[0.9rem] text-tinta-2">
          {t(`unavailable.${reason}`)}
        </p>
      ) : null}
      {ar.justFailed ? (
        <p role="status" className="rounded-kontrol border border-garis bg-permukaan p-3 text-[0.9rem]">
          {t("failedNow")}{" "}
          <button type="button" className="font-semibold text-laut-teks underline" onClick={() => arStore.dismissFailure()}>
            {t("ok")}
          </button>
        </p>
      ) : null}

      <Dialog
        open={asking}
        onClose={() => {
          setAsking(false);
          trigger.current?.focus();
        }}
        title={t("consent.title")}
        labelledBy="izin-kamera"
      >
        <ul className="flex flex-col gap-3">
          <li className="flex gap-3">
            <Camera aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-laut-teks" />
            <span>{t("consent.why")}</span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sc" />
            <span>{t("consent.privacy")}</span>
          </li>
        </ul>
        <p className="text-[0.9rem] text-tinta-2">{t(mode === "quick-look" ? "consent.howIos" : "consent.howAndroid")}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="tekan inline-flex min-h-12 items-center justify-center rounded-full bg-matahari px-5 font-semibold text-matahari-tinta active:bg-matahari-tekan"
            onClick={() => {
              arStore.giveConsent();
              setAsking(false);
              launch();
            }}
          >
            {t("consent.allow")}
          </button>
          <button
            type="button"
            className="tekan inline-flex min-h-12 items-center justify-center rounded-full border-2 border-garis bg-permukaan px-5 font-semibold text-tinta active:bg-kertas"
            onClick={() => {
              setAsking(false);
              trigger.current?.focus();
            }}
          >
            {t("consent.skip")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
