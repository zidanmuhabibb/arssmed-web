"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useImperativeHandle, useMemo, useRef, type Ref, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { planet as planetColors, type PlanetKey } from "@/lib/design/tokens";
import type { CelestialObject } from "@/lib/content/celestial";
import { cameraForPoint, defaultDistance, latLonToVector, orbitY, zoomTo, type Vec3 } from "@/lib/viewer/geometry";

export interface SceneHandle {
  rotate(deg: number): void;
  zoom(factor: number): void;
  reset(): void;
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
  /** Animasi efek rumah kaca (Venus): posisi 0…3, atau null bila tidak aktif. */
  greenhouse: { position: number; showAtmosphere: boolean } | null;
  handleRef: Ref<SceneHandle>;
}

const SUN_DIR = new THREE.Vector3(-1, 0.25, 0.6).normalize();

export default function Scene(props: SceneProps) {
  const r = props.object.radius;
  const dist = defaultDistance(r * (props.object.ring ? 1.7 : props.object.look === "comet" ? 2.6 : 1));
  const continuous = props.autoRotate || props.greenhouse !== null;
  return (
    <Canvas
      // DPR dibatasi 1,5 (PRD §12.1: maks. 2) dan antialias hanya di layar DPR rendah:
      // menghemat GPU HP kelas menengah tanpa mengurangi ketajaman yang terlihat.
      dpr={[1, 1.5]}
      frameloop={continuous ? "always" : "demand"}
      camera={{ fov: 40, position: [0, 0, dist], near: 0.05, far: 200 }}
      // Material Lambert: shader kecil → kompilasi cepat di HP kelas menengah (PRD §12.1).
      gl={{ antialias: typeof window !== "undefined" && window.devicePixelRatio < 1.5, powerPreference: "low-power" }}
      aria-hidden="true"
    >
      <color attach="background" args={["#0b1626"]} />
      <ambientLight intensity={props.object.look === "sun" ? 1 : 0.18} />
      <directionalLight position={SUN_DIR.clone().multiplyScalar(10)} intensity={2.6} />
      <Suspense fallback={null}>
        <Body object={props.object} greenhouse={props.greenhouse} />
      </Suspense>
      {props.greenhouse ? <Greenhouse radius={r} position={props.greenhouse.position} showAtmosphere={props.greenhouse.showAtmosphere} /> : null}
      <Projector object={props.object} markerRefs={props.markerRefs} />
      <Rig {...props} defaultDist={dist} />
    </Canvas>
  );
}

// ---------------------------------------------------------------- kamera & kontrol

function Rig({ object, activeAnnotation, autoRotate, onInteract, reducedMotion, handleRef, defaultDist }: SceneProps & { defaultDist: number }) {
  const { camera, invalidate, gl } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
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
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);
  const r = object.radius;
  const min = r * 1.6;
  const max = defaultDist * 2.2;

  const moveTo = (to: Vec3) => {
    const target = new THREE.Vector3(...to);
    if (reducedMotion) {
      camera.position.copy(target);
      controls.current?.update();
      invalidate();
      return;
    }
    anim.current = { from: camera.position.clone(), to: target, t: 0 };
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
    reset: () => moveTo([0, 0, defaultDist]),
  }));

  // Objek baru → kamera kembali ke posisi awal
  useEffect(() => {
    anim.current = null;
    camera.position.set(0, 0, defaultDist);
    controls.current?.update();
    invalidate();
  }, [object.id, defaultDist, camera, invalidate]);

  // Fokus ke anotasi aktif (FR-11): kamera berpindah halus ke arah titik itu.
  useEffect(() => {
    const a = object.annotations.find((x) => x.id === activeAnnotation);
    if (!a) return;
    const d = Math.min(camera.position.length(), defaultDist);
    moveTo(cameraForPoint(latLonToVector(a.lat, a.lon, r), d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAnnotation, object.id]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (c) {
      c.minDistance = min;
      c.maxDistance = max;
      // Peredaman dan rotasi otomatis butuh update setiap bingkai.
      if (c.update(dt) && !anim.current) invalidate();
    }
    const a = anim.current;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / 0.6);
    const e = 1 - Math.pow(1 - a.t, 3); // ease-out
    // Interpolasi di permukaan bola agar kamera tidak menembus objek
    const len = THREE.MathUtils.lerp(a.from.length(), a.to.length(), e);
    camera.position.copy(a.from.clone().normalize().lerp(a.to.clone().normalize(), e).normalize().multiplyScalar(len));
    controls.current?.update();
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });

  return null;
}

// ---------------------------------------------------------------- titik anotasi

function Projector({ object, markerRefs }: { object: CelestialObject; markerRefs: RefObject<(HTMLElement | null)[]> }) {
  const { size } = useThree();
  const pts = useMemo(
    () => object.annotations.map((a) => new THREE.Vector3(...latLonToVector(a.lat, a.lon, object.radius * 1.02))),
    [object],
  );
  const v = useMemo(() => new THREE.Vector3(), []);
  const toCam = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    pts.forEach((p, i) => {
      const el = markerRefs.current?.[i];
      if (!el) return;
      // Sisi belakang benda: sembunyikan dan keluarkan dari urutan fokus.
      const facing = toCam.copy(camera.position).sub(p).normalize().dot(v.copy(p).normalize()) > 0.08;
      v.copy(p).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.style.opacity = facing ? "1" : "0";
      el.style.pointerEvents = facing ? "auto" : "none";
      el.toggleAttribute("inert", !facing);
    });
  });
  return null;
}

// ---------------------------------------------------------------- benda langit

/** Tekstur dibuat saat build (scripts/build-textures.mjs) → WebP kecil, di-cache service worker. */
function configureSurface(tex: THREE.Texture) {
  if (tex.colorSpace === THREE.SRGBColorSpace) return;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
}

function useSurface(id: string) {
  const tex = useLoader(THREE.TextureLoader, `/textures/${id}.webp`);
  const { invalidate } = useThree();
  useEffect(() => {
    configureSurface(tex);
    invalidate();
  }, [tex, invalidate]);
  return tex;
}

function Body({ object, greenhouse }: { object: CelestialObject; greenhouse: SceneProps["greenhouse"] }) {
  const color = planetColors[object.color as PlanetKey];
  const map = useSurface(object.id);
  const r = object.radius;
  const mat = useRef<THREE.MeshLambertMaterial>(null);

  // Venus memanas pada langkah 2–3 animasi
  useFrame(() => {
    if (!mat.current) return;
    const heat = greenhouse ? Math.min(1, Math.max(0, greenhouse.position - 1)) : 0;
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

function Glow({ radius }: { radius: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    grad.addColorStop(0, "rgba(245,166,35,0.55)");
    grad.addColorStop(1, "rgba(245,166,35,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <sprite scale={[radius * 3.4, radius * 3.4, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

function Ring({ radius, color }: { radius: number; color: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 1;
    const g = c.getContext("2d")!;
    for (let x = 0; x < 256; x++) {
      const t = x / 255;
      const a = (0.35 + 0.45 * Math.abs(Math.sin(t * 23))) * (t > 0.62 && t < 0.68 ? 0.1 : 1);
      g.fillStyle = `rgba(230,214,170,${a.toFixed(3)})`;
      g.fillRect(x, 0, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const geo = useMemo(() => {
    const inner = radius * 1.25, outer = radius * 2.25;
    const g = new THREE.RingGeometry(inner, outer, 128, 1);
    const pos = g.attributes.position!;
    const uv = g.attributes.uv!;
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (d - inner) / (outer - inner), 0.5);
    }
    return g;
  }, [radius]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
      <meshLambertMaterial map={tex} color={color} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
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

function useRadialTexture(rgb: string) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.4, `rgba(${rgb},0.45)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, [rgb]);
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
