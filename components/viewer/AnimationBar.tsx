"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { advance, locate, SPEEDS, stepBack, stepForward, type Speed, type Timeline } from "@/lib/viewer/timeline";

const TL: Timeline = { steps: 3, stepSeconds: 4 };

export interface GreenhouseState {
  active: boolean;
  position: number;
  playing: boolean;
  speed: Speed;
  showAtmosphere: boolean;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: Speed) => void;
  setPosition: (p: number) => void;
  setShowAtmosphere: (v: boolean) => void;
}

/** Status animasi efek rumah kaca Venus; tidak berjalan sendiri (diputar oleh siswa). */
export function useGreenhouse(active: boolean, reduced: boolean): GreenhouseState {
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [showAtmosphere, setShowAtmosphere] = useState(true);
  const raf = useRef<number | null>(null);
  const running = active && playing;

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPosition((p) => {
        const r = advance(TL, p, dt, speed);
        if (r.ended) setPlaying(false);
        return r.position;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, speed]);

  // Gerak dikurangi: "Putar" langsung menampilkan akhir langkah, tanpa animasi berjalan.
  const play = (p: boolean) => {
    if (p && reduced) {
      setPosition((x) => Math.min(TL.steps, Math.floor(x) + 0.999));
      return;
    }
    setPlaying(p);
  };

  return {
    active,
    position: active ? position : 0,
    playing: running,
    speed,
    showAtmosphere,
    setPlaying: play,
    setSpeed,
    setPosition,
    setShowAtmosphere,
  };
}

/** Kontrol animasi berlangkah (FR-13). Dipakai juga untuk U4–U6. */
export function AnimationBar({ state }: { state: GreenhouseState }) {
  const t = useTranslations("viewer.anim");
  const { step } = locate(TL, state.position);
  const btn = "tekan flex size-12 items-center justify-center rounded-full text-panggung-tinta active:bg-white/10";
  const atEnd = state.position >= TL.steps;
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 px-3 py-2 text-panggung-tinta">
      <p className="text-[0.85rem] font-semibold text-panggung-tinta-2">{t("greenhouse.title")}</p>
      <p aria-live="polite" className="min-h-[3em]">
        <span className="sr-only">{t("step", { current: step + 1, total: TL.steps })}. </span>
        {t(`greenhouse.s${step + 1}`)}
      </p>
      <div role="group" aria-label={t("group")} className="flex flex-wrap items-center gap-1">
        <button type="button" className={btn} onClick={() => state.setPosition(stepBack(TL, state.position))} aria-label={t("back")}>
          <SkipBack aria-hidden="true" className="size-6" />
        </button>
        <button
          type="button"
          className={`${btn} bg-matahari text-matahari-tinta active:bg-matahari-tekan`}
          onClick={() => {
            if (atEnd) state.setPosition(0);
            state.setPlaying(!state.playing);
          }}
          aria-label={state.playing ? t("pause") : t("play")}
        >
          {state.playing ? <Pause aria-hidden="true" className="size-6" /> : <Play aria-hidden="true" className="size-6" />}
        </button>
        <button type="button" className={btn} onClick={() => state.setPosition(stepForward(TL, state.position))} aria-label={t("forward")}>
          <SkipForward aria-hidden="true" className="size-6" />
        </button>
        <span className="ml-1 text-[0.85rem] tabular-nums text-panggung-tinta-2" aria-hidden="true">
          {step + 1}/{TL.steps}
        </span>
        <fieldset className="ml-auto flex items-center gap-1">
          <legend className="sr-only">{t("speed")}</legend>
          {SPEEDS.map((s) => (
            <label key={s} className="cursor-pointer">
              <input type="radio" name="kecepatan" className="peer sr-only" checked={state.speed === s} onChange={() => state.setSpeed(s)} />
              <span className="flex min-h-11 min-w-11 items-center justify-center rounded-full px-2 text-[0.85rem] font-semibold tabular-nums peer-checked:bg-white/15 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-laut">
                {s.toLocaleString("id-ID")}×
              </span>
            </label>
          ))}
        </fieldset>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-[0.85rem]">
          <input type="checkbox" checked={state.showAtmosphere} onChange={(e) => state.setShowAtmosphere(e.target.checked)} className="size-5 accent-[var(--matahari)]" />
          {t("atmosphere")}
        </label>
      </div>
    </div>
  );
}
