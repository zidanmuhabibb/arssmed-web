"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { initialPosition, type AnimationSpec } from "@/lib/viewer/animations";
import { advance, locate, SPEEDS, stepBack, stepForward, type Speed } from "@/lib/viewer/timeline";

export interface AnimationState {
  spec: AnimationSpec;
  position: number;
  playing: boolean;
  speed: Speed;
  toggles: Record<string, boolean>;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: Speed) => void;
  setPosition: (p: number) => void;
  setToggle: (key: string, value: boolean) => void;
}

interface Inner {
  id: string | null;
  position: number;
  playing: boolean;
  speed: Speed;
  toggles: Record<string, boolean>;
}

function fresh(spec: AnimationSpec | null, sceneStep?: number): Inner {
  return {
    id: spec?.id ?? null,
    position: spec ? initialPosition(spec, sceneStep) : 0,
    playing: false,
    speed: 1,
    toggles: { ...(spec?.toggles ?? {}) },
  };
}

/**
 * Status animasi berlangkah (FR-13); tidak berjalan sendiri (diputar oleh siswa).
 * Pindah ke animasi lain = mulai dari awal; objek yang berbagi animasi (U4) berbagi status.
 */
export function useStepAnimation(spec: AnimationSpec | null, sceneStep: number | undefined, reduced: boolean): AnimationState | null {
  const [inner, setInner] = useState<Inner>(() => fresh(spec, sceneStep));
  const cur = spec && inner.id === spec.id ? inner : fresh(spec, sceneStep);
  const raf = useRef<number | null>(null);
  const running = spec !== null && cur.playing;
  const speed = cur.speed;

  const update = useCallback(
    (fn: (s: Inner) => Inner) => setInner((prev) => fn(spec && prev.id === spec.id ? prev : fresh(spec, sceneStep))),
    [spec, sceneStep],
  );

  useEffect(() => {
    if (!running || !spec) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      update((s) => {
        const r = advance(spec, s.position, dt, s.speed);
        return { ...s, position: r.position, playing: !r.ended };
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [running, speed, spec, update]);

  if (!spec) return null;
  return {
    spec,
    position: cur.position,
    playing: running,
    speed: cur.speed,
    toggles: cur.toggles,
    // Gerak dikurangi: "Putar" langsung menampilkan akhir langkah, tanpa animasi berjalan.
    setPlaying: (p) =>
      update((s) => (p && reduced ? { ...s, position: Math.min(spec.steps, Math.floor(s.position) + 0.999) } : { ...s, playing: p })),
    setSpeed: (v) => update((s) => ({ ...s, speed: v })),
    setPosition: (p) => update((s) => ({ ...s, position: p, playing: false })),
    setToggle: (k, v) => update((s) => ({ ...s, toggles: { ...s.toggles, [k]: v } })),
  };
}

/** Kontrol animasi berlangkah (FR-13): putar/jeda, langkah maju/mundur, kecepatan, sakelar visual. */
export function AnimationBar({ state }: { state: AnimationState }) {
  const t = useTranslations("viewer.anim");
  const { spec } = state;
  const { step } = locate(spec, state.position);
  const btn = "tekan flex size-12 items-center justify-center rounded-full text-panggung-tinta active:bg-white/10";
  const atEnd = state.position >= spec.steps;
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 px-3 py-2 text-panggung-tinta" data-testid="animation-bar">
      <p className="text-[0.85rem] font-semibold text-panggung-tinta-2">{t(`${spec.id}.title`)}</p>
      <p aria-live="polite" className="min-h-[3em]">
        <span className="sr-only">{t("step", { current: step + 1, total: spec.steps })}. </span>
        {t(`${spec.id}.s${step + 1}`)}
      </p>
      <div role="group" aria-label={t("group")} className="flex flex-wrap items-center gap-1">
        <button type="button" className={btn} onClick={() => state.setPosition(stepBack(spec, state.position))} aria-label={t("back")}>
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
        <button type="button" className={btn} onClick={() => state.setPosition(stepForward(spec, state.position))} aria-label={t("forward")}>
          <SkipForward aria-hidden="true" className="size-6" />
        </button>
        <span className="ml-1 text-[0.85rem] tabular-nums text-panggung-tinta-2" aria-hidden="true">
          {step + 1}/{spec.steps}
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
      </div>
      {Object.keys(state.toggles).length > 0 ? (
        <div role="group" aria-label={t("toggles.group")} className="flex flex-wrap gap-x-2">
          {Object.entries(state.toggles).map(([k, v]) => (
            <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-[0.85rem]">
              <input type="checkbox" checked={v} onChange={(e) => state.setToggle(k, e.target.checked)} className="size-5 accent-[var(--matahari)]" />
              {t(`toggles.${k}`)}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
