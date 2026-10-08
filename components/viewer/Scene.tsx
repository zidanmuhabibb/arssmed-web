"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useImperativeHandle, useMemo, useRef, type Ref, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { planet as planetColors, type PlanetKey } from "@/lib/design/tokens";
import type { AnimationId, CelestialObject } from "@/lib/content/celestial";
import { anchorPoint, sceneFocus } from "@/lib/viewer/dioramas";
import { Glow, Ring, useRadialTexture, useSurface } from "./three-parts";
import { Diorama } from "./Dioramas";
import { cameraForPoint, defaultDistance, latLonToVector, orbitY, zoomTo, type Vec3 } from "@/lib/viewer/geometry";

export interface SceneHandle {
  rotate(deg: number): void;
  zoom(factor: number): void;
  reset(): void;
}

/** Status animasi yang dibutuhkan kanvas (posisi 0…langkah dan sakelar visual). */
export interface SceneAnim {
  id: AnimationId;
  position: number;
  playing: boolean;
  toggles: Record<string, boolean>;
}

export interface SceneProps {
  object: CelestialObject;
  activeAnnotation: string | null;
  /**
   * Titik anotasi dirender sebagai tombol DOM di atas kanvas (aksesibel, bisa difokus);
   * Scene hanya memproyeksikan posisinya setiap bingkai.
   */
  markerRefs: RefObject<(HTMLElement | null)[]>;
  autoRotate: boolean;
  onInteract: () => void;
  reducedMotion: boolean;
  anim: SceneAnim | null;
  handleRef: Ref<SceneHandle>;
}

const SUN_DIR = new THREE.Vector3(-1, 0.25, 0.6).normalize();

/** Posisi kamera awal: jarak d, terangkat `elevation` derajat, diputar `azimuth` derajat ke kiri (−x). */
function homePosition(d: number, elevation: number, azimuth = 0): Vec3 {
  const e = (elevation * Math.PI) / 180;
  const a = (azimuth * Math.PI) / 180;
  return [-d * Math.cos(e) * Math.sin(a), d * Math.sin(e), d * Math.cos(e) * Math.cos(a)];
}

function cameraSetup(object: CelestialObject) {
  if (object.view) {
    const d = object.view.distance;
    return { home: homePosition(d, object.view.elevation, object.view.azimuth), min: d * 0.35, max: d * 1.9 };
  }
  const r = object.radius;
  const d = defaultDistance(r * (object.ring ? 1.7 : object.look === "comet" ? 2.6 : 1));
  return { home: [0, 0, d] as Vec3, min: r * 1.6, max: d * 2.2 };
}

export default function Scene(props: SceneProps) {
  const cam = cameraSetup(props.object);
  const isDiorama = props.object.scene !== undefined;
  const continuous = props.autoRotate || (props.anim?.playing ?? false) || props.anim?.id === "greenhouse";
  return (
    <Canvas
      // DPR dibatasi 1,5 (PRD §12.1: maks. 2) dan antialias hanya di layar DPR rendah:
      // menghemat GPU HP kelas menengah tanpa mengurangi ketajaman yang terlihat.
      dpr={[1, 1.5]}
      frameloop={continuous ? "always" : "demand"}
      camera={{ fov: 40, position: cam.home, near: 0.05, far: 400 }}
      // Material Lambert: shader kecil → kompilasi cepat di HP kelas menengah (PRD §12.1).
      gl={{ antialias: typeof window !== "undefined" && window.devicePixelRatio < 1.5, powerPreference: "low-power" }}
      aria-hidden="true"
    >
      <color attach="background" args={["#0b1626"]} />
      {isDiorama ? (
        <Suspense fallback={null}>
          <Diorama object={props.object} anim={props.anim} />
        </Suspense>
      ) : (
        <>
          <ambientLight intensity={props.object.look === "sun" ? 1 : 0.18} />
          <directionalLight position={SUN_DIR.clone().multiplyScalar(10)} intensity={2.6} />
          <Suspense fallback={null}>
            <Body object={props.object} anim={props.anim} />
          </Suspense>
          {props.anim?.id === "greenhouse" ? (
            <Greenhouse radius={props.object.radius} position={props.anim.position} showAtmosphere={props.anim.toggles.atmosphere ?? true} />
          ) : null}
        </>
      )}
      <Projector object={props.object} anim={props.anim} markerRefs={props.markerRefs} />
      <Rig {...props} home={cam.home} min={cam.min} max={cam.max} />
      <Invalidator anim={props.anim} />
    </Canvas>
  );
}

/** Kanvas "sesuai permintaan": gambar ulang setiap kali langkah/sakelar berubah. */
function Invalidator({ anim }: { anim: SceneAnim | null }) {
  const { invalidate } = useThree();
  const key = anim ? `${anim.id}:${anim.position}:${JSON.stringify(anim.toggles)}` : "";
  useEffect(() => invalidate(), [key, invalidate]);
  return null;
}

/** Titik dunia sebuah anotasi, relatif terhadap titik fokus kamera. */
function annotationPoint(object: CelestialObject, a: CelestialObject["annotations"][number], anim: SceneAnim | null, lift = 1.02): Vec3 {
  if (a.anchor && object.scene) {
    const p = anchorPoint(object.scene, a.anchor, { position: anim?.position ?? 0, toggles: anim?.toggles ?? {}, variant: object.variant });
    const f = sceneFocus(object.scene);
    return [p[0] - f[0], p[1] - f[1], p[2] - f[2]];
  }
  return latLonToVector(a.lat ?? 0, a.lon ?? 0, object.radius * lift);
}

// ---------------------------------------------------------------- kamera & kontrol

function Rig({
  object,
  anim,
  activeAnnotation,
  autoRotate,
  onInteract,
  reducedMotion,
  handleRef,
  home,
  min,
  max,
}: SceneProps & { home: Vec3; min: number; max: number }) {
  const { camera, invalidate, gl, size } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);

  // Tombol kontrol menutupi tepi kanan kanvas: geser pusat gambar sedikit ke kiri.
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.setViewOffset(size.width, size.height, Math.min(32, size.width * 0.07), 0, size.width, size.height);
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  const onInteractRef = useRef(onInteract);
  useEffect(() => {
    onInteractRef.current = onInteract;
  }, [onInteract]);

  // OrbitControls langsung dari three (tanpa drei) agar bundel lebih kecil.
  useEffect(() => {
    const c = new OrbitControlsImpl(camera, gl.domElement);
    c.enablePan = false;
    const onChange = () => invalidate();
    const onStart = () => onInteractRef.current();
    c.addEventListener("change", onChange);
    c.addEventListener("start", onStart);
    controls.current = c;
    return () => {
      c.removeEventListener("change", onChange);
      c.removeEventListener("start", onStart);
      c.dispose();
      controls.current = null;
    };
  }, [camera, gl, invalidate]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.enableDamping = !reducedMotion;
    c.autoRotate = autoRotate;
    c.autoRotateSpeed = 0.5;
    invalidate();
  });
  const animRef = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);

  const moveTo = (to: Vec3) => {
    const target = new THREE.Vector3(...to);
    if (reducedMotion) {
      camera.position.copy(target);
      controls.current?.update();
      invalidate();
      return;
    }
    animRef.current = { from: camera.position.clone(), to: target, t: 0 };
    invalidate();
  };

  useImperativeHandle(handleRef, () => ({
    rotate: (deg) => {
      onInteract();
      const p = camera.position;
      moveTo(orbitY([p.x, p.y, p.z], deg));
    },
    zoom: (f) => {
      onInteract();
      const p = camera.position;
      moveTo(zoomTo([p.x, p.y, p.z], f, min, max));
    },
    reset: () => moveTo(home),
  }));

  // Objek/adegan baru → kamera kembali ke posisi awal
  const homeKey = home.join(",");
  useEffect(() => {
    animRef.current = null;
    const c = controls.current;
    // Batas zoom baru dipasang DULU, agar posisi awal tidak terpotong batas objek sebelumnya.
    if (c) {
      c.minDistance = min;
      c.maxDistance = max;
    }
    camera.position.set(...home);
    c?.update();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.id, homeKey, camera, invalidate, min, max]);

  // Fokus ke anotasi aktif (FR-11): kamera berpindah halus ke arah titik itu.
  useEffect(() => {
    const a = object.annotations.find((x) => x.id === activeAnnotation);
    if (!a) return;
    const p = annotationPoint(object, a, anim);
    const d = Math.min(camera.position.length(), Math.hypot(...home));
    if (object.scene) {
      // Adegan: geser arah pandang sebagian ke titik, tetap dari atas agar konteks terlihat.
      const cur = camera.position.clone().normalize();
      const dir = new THREE.Vector3(...p).normalize().multiplyScalar(0.45).add(cur).normalize();
      moveTo([dir.x * d, Math.max(dir.y, 0.25) * d, dir.z * d]);
    } else {
      moveTo(cameraForPoint(p, d));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAnnotation, object.id]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (c) {
      c.minDistance = min;
      c.maxDistance = max;
      // Peredaman dan rotasi otomatis butuh update setiap bingkai.
      if (c.update(dt) && !animRef.current) invalidate();
    }
    const a = animRef.current;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / 0.6);
    const e = 1 - Math.pow(1 - a.t, 3); // ease-out
    // Interpolasi di permukaan bola agar kamera tidak menembus objek
    const len = THREE.MathUtils.lerp(a.from.length(), a.to.length(), e);
    camera.position.copy(a.from.clone().normalize().lerp(a.to.clone().normalize(), e).normalize().multiplyScalar(len));
    controls.current?.update();
    if (a.t >= 1) animRef.current = null;
    else invalidate();
  });

  return null;
}

// ---------------------------------------------------------------- titik anotasi

function Projector({ object, anim, markerRefs }: { object: CelestialObject; anim: SceneAnim | null; markerRefs: RefObject<(HTMLElement | null)[]> }) {
  const { size } = useThree();
  const animRef = useRef(anim);
  useEffect(() => {
    animRef.current = anim;
  }, [anim]);
  const v = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const toCam = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    object.annotations.forEach((a, i) => {
      const el = markerRefs.current?.[i];
      if (!el) return;
      p.set(...annotationPoint(object, a, animRef.current));
      // Benda: titik di sisi belakang disembunyikan. Adegan: sembunyikan bila di belakang kamera.
      const facing = object.scene
        ? v.copy(p).project(camera).z < 1
        : toCam.copy(camera.position).sub(p).normalize().dot(v.copy(p).normalize()) > 0.08;
      v.copy(p).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const inside = x > -20 && x < size.width + 20 && y > -20 && y < size.height + 20;
      const show = facing && inside;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.style.opacity = show ? "1" : "0";
      el.style.pointerEvents = show ? "auto" : "none";
      el.toggleAttribute("inert", !show);
    });
  });
  return null;
}

// ---------------------------------------------------------------- benda langit

function Body({ object, anim }: { object: CelestialObject; anim: SceneAnim | null }) {
  const color = planetColors[object.color as PlanetKey];
  const map = useSurface(object.id);
  const r = object.radius;
  const mat = useRef<THREE.MeshLambertMaterial>(null);

  // Venus memanas pada langkah 2–3 animasi
  useFrame(() => {
    if (!mat.current) return;
    const heat = anim?.id === "greenhouse" ? Math.min(1, Math.max(0, anim.position - 1)) : 0;
    mat.current.emissive.setRGB(0.55 * heat, 0.12 * heat, 0.02 * heat);
  });

  if (object.look === "sun") {
    return (
      <group>
        <mesh>
          <sphereGeometry args={[r, 64, 32]} />
          <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>
        <Glow radius={r} />
      </group>
    );
  }
  if (object.look === "asteroid") return <Asteroid radius={r} map={map} />;
  if (object.look === "comet") return <Comet radius={r} map={map} />;

  const tilt = object.id === "bumi" ? 23.4 : object.id === "saturnus" ? 26.7 : object.id === "uranus" ? 82 : 0;
  return (
    <group rotation={[0, 0, THREE.MathUtils.degToRad(tilt)]}>
      <mesh>
        <sphereGeometry args={[r, 64, 32]} />
        <meshLambertMaterial ref={mat} map={map} />
      </mesh>
      {object.ring ? <Ring radius={r} color={color} /> : null}
    </group>
  );
}

function Asteroid({ radius, map }: { radius: number; map: THREE.Texture }) {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(radius, 4);
    const p = g.attributes.position!;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = 1 + 0.18 * Math.sin(v.x * 4.1) * Math.cos(v.y * 3.3) + 0.1 * Math.sin(v.z * 7.7);
      v.multiplyScalar(k);
      v.y *= 0.75;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, [radius]);
  return (
    <mesh geometry={geo}>
      <meshLambertMaterial map={map} flatShading />
    </mesh>
  );
}

const TAIL = 16;
/** Komet: inti kecil + koma + ekor yang selalu mengarah MENJAUHI Matahari (Matahari di kiri). */
function Comet({ radius, map }: { radius: number; map: THREE.Texture }) {
  const glow = useRadialTexture("190,228,255");
  const away = SUN_DIR.clone().negate().setZ(0).normalize();
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[radius, 3]} />
        <meshLambertMaterial map={map} flatShading />
      </mesh>
      <sprite scale={[radius * 3.6, radius * 3.6, 1]}>
        <spriteMaterial map={glow} opacity={0.55} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {Array.from({ length: TAIL }, (_, i) => {
        const t = (i + 1) / TAIL;
        const d = radius * (0.8 + t * 7);
        const size = radius * (1.6 + t * 2.4);
        return (
          <sprite key={i} position={[away.x * d, away.y * d, -0.01 * i]} scale={[size, size, 1]}>
            <spriteMaterial map={glow} opacity={0.42 * (1 - t) + 0.04} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------- animasi efek rumah kaca

const RAYS = 6;
function Greenhouse({ radius, position, showAtmosphere }: { radius: number; position: number; showAtmosphere: boolean }) {
  const shell = radius * 1.18;
  const incoming = useRef<THREE.Group>(null);
  const outgoing = useRef<THREE.Group>(null);
  // Cahaya masuk mengenai sisi kiri (menghadap Matahari); panas keluar menyebar ke segala arah.
  const starts = useMemo(
    () => Array.from({ length: RAYS }, (_, i) => new THREE.Vector3(-0.75, -0.62 + (i / (RAYS - 1)) * 1.24, 0.45).normalize()),
    [],
  );
  const heats = useMemo(
    () => Array.from({ length: RAYS }, (_, i) => {
      const a = (i / RAYS) * Math.PI * 2 + 0.3;
      return new THREE.Vector3(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.6).normalize();
    }),
    [],
  );
  const halo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        uniforms: { glow: { value: new THREE.Color("#f5b04a") } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 glow; varying vec3 vN; varying vec3 vV;
          void main(){ float r = pow(1.0 - max(dot(vN, vV), 0.0), 2.2); gl_FragColor = vec4(glow * r, r); }`,
      }),
    [],
  );
  useEffect(() => () => halo.dispose(), [halo]);

  useFrame(() => {
    // Langkah 1 (0–1): cahaya kuning datang dari arah Matahari menuju permukaan
    const p1 = THREE.MathUtils.clamp(position, 0, 1);
    incoming.current?.children.forEach((m, i) => {
      const target = starts[i]!.clone().multiplyScalar(radius);
      const start = target.clone().add(new THREE.Vector3(-radius * 2.6, 0, 0));
      m.position.copy(start.lerp(target, p1));
      m.visible = position < 1.05;
    });
    // Langkah 3 (2–3): panas (merah) naik ke atmosfer lalu dipantulkan kembali
    const p3 = THREE.MathUtils.clamp(position - 2, 0, 1);
    outgoing.current?.children.forEach((m, i) => {
      const n = heats[i]!.clone();
      const surf = n.clone().multiplyScalar(radius * 1.01);
      const top = n.clone().multiplyScalar(shell * 0.98);
      const k = p3 < 0.5 ? p3 * 2 : 2 - p3 * 2; // naik lalu turun
      m.position.copy(surf.lerp(top, k));
      m.visible = position >= 2;
    });
  });

  return (
    <group>
      {showAtmosphere ? (
        <mesh material={halo}>
          <sphereGeometry args={[shell, 48, 24]} />
        </mesh>
      ) : null}
      <group ref={incoming}>
        {starts.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[radius * 0.05, 12, 8]} />
            <meshBasicMaterial color="#ffd36b" toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={outgoing}>
        {starts.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[radius * 0.05, 12, 8]} />
            <meshBasicMaterial color="#ff5a3c" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
