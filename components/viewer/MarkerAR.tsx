"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Box, Camera, Download, Printer, ScanLine, ShieldCheck, X } from "lucide-react";
import { cameraErrorKind, fitScale, MARKER_PDF, markerLayout, markerUrls, MINDAR_URL } from "@/lib/ar/marker";
import { learning } from "@/lib/learning/client";

/** Bentuk minimal modul MindAR yang dipakai (public/vendor/mindar-1.2.5). */
interface MindarController {
  addImageTargets(url: string): Promise<{ dimensions: [number, number][] }>;
  getProjectionMatrix(): number[];
  dummyRun(input: HTMLVideoElement): void;
  processVideo(input: HTMLVideoElement): void;
  stopProcessVideo(): void;
  dispose(): void;
}
interface MindarModule {
  Controller: new (o: {
    inputWidth: number;
    inputHeight: number;
    maxTrack?: number;
    onUpdate?: (d: { type: string; targetIndex?: number; worldMatrix?: number[] | null }) => void;
  }) => MindarController;
}

type Status = "intro" | "starting" | "scanning" | "found" | "denied" | "unsupported" | "error";

/**
 * FR-15: AR dengan kartu penanda (pelacakan gambar MindAR di perangkat). FR-16: layar penjelasan
 * kamera sebelum izin; tidak ada gambar kamera yang disimpan/dikirim. Gagal/ditolak → 3D.
 */
export function MarkerAR({ unit, unitNumber, objectId, objectName, glb, viewerHref }: { unit: string; unitNumber: number; objectId: string; objectName: string; glb: string; viewerHref: string }) {
  const t = useTranslations("viewer.marker");
  const [status, setStatus] = useState<Status>("intro");
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const statusRef = useRef<Status>("intro");
  const logged = useRef(false);

  const set = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  useEffect(() => () => stopRef.current(), []);

  async function start() {
    set("starting");
    if (!navigator.mediaDevices?.getUserMedia) return set("unsupported");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment" } });
    } catch (e) {
      return set(cameraErrorKind(e));
    }
    let disposed = false;
    let raf = 0;
    const cleanups: (() => void)[] = [() => stream.getTracks().forEach((tr) => tr.stop())];
    stopRef.current = () => {
      disposed = true;
      cancelAnimationFrame(raf);
      for (const c of cleanups.splice(0).reverse()) c();
    };
    try {
      const v = video.current!;
      v.srcObject = stream;
      await new Promise<void>((resolve) => (v.readyState >= 1 ? resolve() : v.addEventListener("loadedmetadata", () => resolve(), { once: true })));
      await v.play();
      v.width = v.videoWidth;
      v.height = v.videoHeight;

      const [THREE, { GLTFLoader }, mindar] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import(/* webpackIgnore: true */ /* turbopackIgnore: true */ MINDAR_URL) as Promise<MindarModule>,
      ]);
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const renderer = new THREE.WebGLRenderer({ canvas: canvas.current!, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      cleanups.push(() => renderer.dispose());
      scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 2);
      sun.position.set(0.5, 1, 2);
      scene.add(sun);

      const anchor = new THREE.Group();
      anchor.matrixAutoUpdate = false;
      anchor.visible = false;
      scene.add(anchor);
      const pivot = new THREE.Group();
      // Model GLB tegak sumbu Y; bidang kartu MindAR = XY dengan Z mengarah ke kamera.
      pivot.rotation.x = Math.PI / 2;
      anchor.add(pivot);

      const gltf = await new GLTFLoader().loadAsync(glb);
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = fitScale(Math.max(size.x, size.y, size.z));
      model.scale.setScalar(s);
      const center = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
      model.position.set(-center.x, -center.y + (size.y * s) / 2, -center.z);
      pivot.add(model);

      const controller = new mindar.Controller({
        inputWidth: v.videoWidth,
        inputHeight: v.videoHeight,
        maxTrack: 1,
        onUpdate: (d) => {
          if (d.type !== "updateMatrix") return;
          if (!d.worldMatrix) {
            anchor.visible = false;
            if (statusRef.current === "found") set("scanning");
            return;
          }
          anchor.matrix.fromArray(d.worldMatrix).multiply(post);
          anchor.visible = true;
          if (statusRef.current !== "found") set("found");
          if (!logged.current) {
            logged.current = true;
            learning.markerView(unit, objectId);
          }
        },
      });
      cleanups.push(() => {
        controller.stopProcessVideo();
        controller.dispose();
      });
      const { dimensions } = await controller.addImageTargets(markerUrls(unit).mind);
      const [mw, mh] = dimensions[0]!;
      const post = new THREE.Matrix4().compose(new THREE.Vector3(mw / 2, mw / 2 + (mh - mw) / 2, 0), new THREE.Quaternion(), new THREE.Vector3(mw, mw, mw));

      const layout = () => {
        const el = stage.current!;
        const l = markerLayout(controller.getProjectionMatrix(), v.videoWidth, v.videoHeight, el.clientWidth, el.clientHeight);
        Object.assign(camera, { fov: l.fov, near: l.near, far: l.far, aspect: l.aspect });
        camera.updateProjectionMatrix();
        Object.assign(v.style, { top: `${l.video.top}px`, left: `${l.video.left}px`, width: `${l.video.width}px`, height: `${l.video.height}px` });
        renderer.setSize(el.clientWidth, el.clientHeight, false);
      };
      layout();
      window.addEventListener("resize", layout);
      cleanups.push(() => window.removeEventListener("resize", layout));

      controller.dummyRun(v);
      if (disposed) return;
      controller.processVideo(v);
      set("scanning");

      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (document.hidden) return;
        if (!still && anchor.visible) model.rotation.y += 0.006;
        renderer.render(scene, camera);
      };
      loop();
    } catch (e) {
      console.warn("[AR penanda] tidak bisa dimulai", e instanceof Error ? e.message : e);
      stopRef.current();
      if (!disposed) set("error");
    }
  }

  function stop() {
    stopRef.current();
    stopRef.current = () => {};
    set("intro");
  }

  const live = status === "starting" || status === "scanning" || status === "found";
  return (
    <div className="flex flex-col gap-4" data-testid="marker-ar" data-status={status}>
      <div
        ref={stage}
        className={`relative overflow-hidden rounded-panel bg-panggung text-panggung-tinta ${live ? "h-[70dvh] min-h-[22rem]" : "hidden"}`}
        aria-hidden={!live}
      >
        {/* Gambar kamera hanya ditampilkan di layar ini; tidak direkam atau dikirim. */}
        <video ref={video} muted playsInline className="absolute max-w-none" />
        <canvas ref={canvas} className="absolute inset-0 size-full" />
        <button
          type="button"
          onClick={stop}
          className="tekan absolute top-3 right-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-panggung/80 px-4 font-semibold text-panggung-tinta"
        >
          <X aria-hidden="true" className="size-5" />
          {t("stop")}
        </button>
      </div>

      <p role="status" aria-live="polite" className="rounded-kontrol border border-garis bg-permukaan p-3 font-semibold" data-testid="marker-status">
        {status === "intro" ? t("introStatus", { unit: unitNumber }) : null}
        {status === "starting" ? t("starting") : null}
        {status === "scanning" ? (
          <span className="inline-flex items-center gap-2">
            <ScanLine aria-hidden="true" className="size-5" />
            {t("scanning", { unit: unitNumber })}
          </span>
        ) : null}
        {status === "found" ? t("found", { name: objectName }) : null}
        {status === "denied" ? t("denied") : null}
        {status === "unsupported" ? t("unsupported") : null}
        {status === "error" ? t("error") : null}
      </p>

      {status === "intro" ? (
        <div className="flex flex-col gap-4 rounded-panel border border-garis bg-permukaan p-5">
          <h2 className="text-[1.3rem] font-bold">{t("consentTitle")}</h2>
          <ul className="flex flex-col gap-3">
            <li className="flex gap-3">
              <Printer aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-laut-teks" />
              <span>
                {t("print", { unit: unitNumber })}{" "}
                <a href={MARKER_PDF} download className="inline-flex items-center gap-1 font-semibold text-laut-teks">
                  <Download aria-hidden="true" className="size-4" />
                  {t("pdf")}
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <Camera aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-laut-teks" />
              <span>{t("why")}</span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sc" />
              <span>{t("privacy")}</span>
            </li>
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={start}
              className="tekan inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-matahari px-6 font-semibold text-matahari-tinta active:bg-matahari-tekan"
            >
              <Camera aria-hidden="true" className="size-5" />
              {t("allow")}
            </button>
            <Link href={viewerHref} className="tekan inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-garis bg-permukaan px-6 font-semibold text-tinta no-underline active:bg-kertas">
              <Box aria-hidden="true" className="size-5" />
              {t("skip")}
            </Link>
          </div>
        </div>
      ) : null}

      {status === "denied" || status === "unsupported" || status === "error" ? (
        <div className="flex flex-col gap-3 rounded-panel border border-garis bg-permukaan p-5" data-testid="marker-fallback">
          <p>{t("fallback")}</p>
          <Link href={viewerHref} className="tekan inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full bg-matahari px-6 font-semibold text-matahari-tinta no-underline active:bg-matahari-tekan">
            <Box aria-hidden="true" className="size-5" />
            {t("open3d")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
