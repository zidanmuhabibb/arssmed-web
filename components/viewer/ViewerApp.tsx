"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ChevronLeft,
  Expand,
  FileText,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Presentation,
  RotateCcw,
  RotateCw,
  Ruler,
  Undo2,
} from "lucide-react";
import type { CelestialObject } from "@/lib/content/celestial";
import { planet as planetColors, type PlanetKey } from "@/lib/design/tokens";
import { useReducedMotion, useViewed, useWebGL } from "@/lib/viewer/browser-stores";
import { progressOf } from "@/lib/viewer/progress";
import type { SceneHandle } from "./Scene";
import { AnimationBar, useGreenhouse } from "./AnimationBar";
import { ExplainPanel } from "./ExplainPanel";
import { InfoSheet } from "./InfoSheet";
import { RelOrbit } from "./RelOrbit";
import { ScaleCompare } from "./ScaleCompare";
import { StaticBody } from "./StaticBody";

const Scene = dynamic(() => import("./Scene"), { ssr: false });

type Source = { label: string; url: string };

export function ViewerApp({
  unitSlug,
  unitTitle,
  objects,
  sources,
}: {
  unitSlug: string;
  unitTitle: string;
  objects: CelestialObject[];
  sources: Record<string, Source>;
}) {
  const t = useTranslations("viewer");
  const ids = useMemo(() => objects.map((o) => o.id), [objects]);
  const storageKey = `arssmed:viewed:${unitSlug}`;

  // Dirender server untuk tampilan awal yang cepat; nilai khusus browser dibaca lewat external store.
  const [currentId, setCurrentId] = useState(ids[0]!);
  const [viewed, markSeen] = useViewed(storageKey);
  const [annotation, setAnnotation] = useState<string | null>(null);
  const webgl = useWebGL();
  const reduced = useReducedMotion();
  // Satu-satunya gerak tanpa pemicu: rotasi pelan di layar pembuka, berhenti saat disentuh (PRD §8.5).
  const [rotateWanted, setAutoRotate] = useState(true);
  const autoRotate = rotateWanted && !reduced;
  const [explain, setExplain] = useState(false);
  const [scaleView, setScaleView] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [classMode, setClassMode] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle>(null);
  const markerRefs = useRef<(HTMLElement | null)[]>([]);

  const current = objects.find((o) => o.id === currentId)!;
  const greenhouse = useGreenhouse(current.animation === "greenhouse", reduced);

  // Objek pertama langsung terhitung dilihat (penyimpanan eksternal, bukan state React).
  useEffect(() => markSeen(ids[0]!), [markSeen, ids]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (classMode) html.dataset.mode = "kelas";
    else delete html.dataset.mode;
    return () => {
      delete html.dataset.mode;
    };
  }, [classMode]);

  const select = useCallback(
    (id: string) => {
      setCurrentId(id);
      setAnnotation(null);
      setScaleView(false);
      markSeen(id);
    },
    [markSeen],
  );

  const stopAuto = useCallback(() => setAutoRotate(false), []);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const h = scene.current;
    if (!h) return;
    const map: Record<string, () => void> = {
      ArrowLeft: () => h.rotate(-20),
      ArrowRight: () => h.rotate(20),
      "+": () => h.zoom(0.8),
      "=": () => h.zoom(0.8),
      "-": () => h.zoom(1.25),
      "0": () => h.reset(),
      Home: () => h.reset(),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      stopAuto();
      fn();
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch {
      // Safari iPhone tidak mendukung layar penuh untuk elemen; abaikan dengan tenang.
    }
  }

  const progress = progressOf(viewed, ids);
  const color = planetColors[current.color as PlanetKey];
  const activeIndex = current.annotations.findIndex((a) => a.id === annotation);
  const activeAnn = activeIndex >= 0 ? current.annotations[activeIndex]! : null;
  const canScale = unitSlug === "u2";
  const iconBtn =
    "tekan flex size-12 items-center justify-center rounded-full text-panggung-tinta active:bg-white/10 disabled:opacity-40";

  return (
    <div className="-mx-4 -mt-5 flex flex-col sm:-mx-6 lg:-mx-10 lg:-mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-0">
      <div
        ref={stage}
        className={`relative flex flex-col bg-panggung ${fullscreen ? "h-dvh" : ""}`}
        data-testid="viewer-stage"
      >
        {/* Bilah atas: kembali, unit, penjelasan, layar penuh (PRD §8.4) */}
        <div className="flex h-14 items-center gap-1 px-2 text-panggung-tinta">
          <Link href={`/belajar/${unitSlug}`} className={`${iconBtn} no-underline`} aria-label={`${t("back")}: ${unitTitle}`}>
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8rem] text-panggung-tinta-2">{unitTitle}</p>
            <h1 className="truncate font-judul text-[1.3rem] leading-tight font-extrabold" style={{ color: current.look === "sun" ? color : undefined }}>
              {current.name}
            </h1>
          </div>
          <button type="button" className={iconBtn} onClick={() => setClassMode((v) => !v)} aria-pressed={classMode} aria-label={t("controls.classMode")} title={t("controls.classMode")}>
            <Presentation aria-hidden="true" className="size-6" />
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={toggleFullscreen}
            aria-label={fullscreen ? t("controls.exitFullscreen") : t("controls.fullscreen")}
            title={fullscreen ? t("controls.exitFullscreen") : t("controls.fullscreen")}
          >
            {fullscreen ? <Minimize2 aria-hidden="true" className="size-6" /> : <Maximize2 aria-hidden="true" className="size-6" />}
          </button>
        </div>

        {/* Kanvas ± 55% tinggi layar */}
        <div
          className={`relative w-full ${fullscreen ? "flex-1" : "h-[55dvh] min-h-[300px] lg:h-[calc(100dvh-14rem)]"}`}
          tabIndex={0}
          role="group"
          aria-roledescription="3D"
          aria-label={t("canvasLabel", { name: current.name })}
          onKeyDown={onKey}
          onPointerDown={stopAuto}
        >
          {scaleView ? (
            <ScaleCompare objects={objects} onClose={() => setScaleView(false)} />
          ) : webgl === null ? (
            <p className="p-6 text-panggung-tinta-2" role="status">
              {t("loading")}
            </p>
          ) : !webgl ? (
            <StaticBody object={current} />
          ) : (
            <Scene
              object={current}
              activeAnnotation={annotation}
              markerRefs={markerRefs}
              autoRotate={autoRotate && annotation === null}
              onInteract={stopAuto}
              reducedMotion={reduced}
              greenhouse={greenhouse.active ? { position: greenhouse.position, showAtmosphere: greenhouse.showAtmosphere } : null}
              handleRef={scene}
            />
          )}

          {/* Titik info di atas kanvas (posisi diproyeksikan oleh Scene) */}
          {!scaleView && webgl ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {current.annotations.map((a, i) => (
                <button
                  key={`${current.id}-${a.id}`}
                  ref={(el) => {
                    markerRefs.current[i] = el;
                  }}
                  type="button"
                  onClick={() => {
                    stopAuto();
                    setAnnotation(a.id);
                  }}
                  aria-label={t("annotation", { number: i + 1, title: a.title })}
                  aria-pressed={a.id === annotation}
                  className="tekan pointer-events-auto absolute top-0 left-0 flex size-11 items-center justify-center rounded-full border-2 font-judul text-[1.1rem] font-extrabold tabular-nums opacity-0 shadow-[0_0_0_4px_rgb(11_22_38/0.55)]"
                  style={{ background: a.id === annotation ? color : "#0b1626", borderColor: color, color: a.id === annotation ? "#14283c" : "#e4ecf2" }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          ) : null}

          {/* Tombol layar: alternatif gestur (PRD §8.7) */}
          {!scaleView && webgl ? (
            <div role="group" aria-label={t("controls.group")} className="absolute right-2 bottom-2 flex flex-col gap-1 rounded-full bg-panggung/80 p-1">
              <button type="button" className={iconBtn} onClick={() => scene.current?.zoom(0.8)} aria-label={t("controls.zoomIn")}>
                <Plus aria-hidden="true" className="size-6" />
              </button>
              <button type="button" className={iconBtn} onClick={() => scene.current?.zoom(1.25)} aria-label={t("controls.zoomOut")}>
                <Minus aria-hidden="true" className="size-6" />
              </button>
              <button type="button" className={iconBtn} onClick={() => scene.current?.rotate(-30)} aria-label={t("controls.rotateLeft")}>
                <RotateCcw aria-hidden="true" className="size-6" />
              </button>
              <button type="button" className={iconBtn} onClick={() => scene.current?.rotate(30)} aria-label={t("controls.rotateRight")}>
                <RotateCw aria-hidden="true" className="size-6" />
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={() => {
                  setAnnotation(null);
                  scene.current?.reset();
                }}
                aria-label={t("controls.reset")}
              >
                <Undo2 aria-hidden="true" className="size-6" />
              </button>
            </div>
          ) : null}
        </div>

        {greenhouse.active && !scaleView ? <AnimationBar state={greenhouse} /> : null}

        {/* Titik info sebagai daftar juga, agar bisa dipilih tanpa menyentuh kanvas */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2" role="group" aria-label={t("controls.annotations")}>
          {current.annotations.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                stopAuto();
                setScaleView(false);
                setAnnotation(a.id);
              }}
              aria-pressed={a.id === annotation}
              className="tekan inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-3 text-[0.9rem] text-panggung-tinta active:bg-white/10 aria-pressed:border-transparent aria-pressed:bg-white/15"
            >
              <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full text-[0.8rem] font-bold text-[#0b1626]" style={{ background: color }}>
                {i + 1}
              </span>
              {a.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4 sm:px-6 lg:border-l lg:border-garis lg:px-5 lg:pt-5">
        <RelOrbit objects={objects} currentId={currentId} viewed={viewed} progress={progress} onSelect={select} />
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <button
            type="button"
            onClick={() => setExplain((v) => !v)}
            aria-expanded={explain}
            aria-controls="penjelasan"
            className="tekan inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-garis bg-permukaan px-5 font-semibold text-tinta active:bg-kertas"
          >
            <FileText aria-hidden="true" className="size-5" />
            {explain ? t("explain.close") : t("explain.open")}
          </button>
          {canScale ? (
            <button
              type="button"
              onClick={() => {
                stopAuto();
                setAnnotation(null);
                setScaleView((v) => !v);
              }}
              aria-pressed={scaleView}
              className="tekan inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-garis bg-permukaan px-5 font-semibold text-tinta active:bg-kertas"
            >
              {scaleView ? <Expand aria-hidden="true" className="size-5" /> : <Ruler aria-hidden="true" className="size-5" />}
              {scaleView ? t("scale.close") : t("scale.open")}
            </button>
          ) : null}
        </div>
        {explain ? <ExplainPanel object={current} sources={sources} /> : null}
      </div>

      <InfoSheet
        annotation={activeAnn}
        index={activeIndex}
        total={current.annotations.length}
        color={color}
        source={activeAnn ? sources[activeAnn.source] : undefined}
        onClose={() => setAnnotation(null)}
        onNext={() => setAnnotation(current.annotations[(activeIndex + 1) % current.annotations.length]!.id)}
      />
    </div>
  );
}
