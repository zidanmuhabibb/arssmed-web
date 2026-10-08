"use client";

/**
 * Adegan 3D unit 3–6 (zona planet, meteor, rotasi, revolusi, gerhana).
 * Semua posisi dihitung oleh lib/viewer/dioramas.ts (murni, teruji); di sini hanya digambar.
 * Ukuran dan jarak tidak sesuai skala — label skala tampil di Rel Orbit (PRD §13).
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CelestialObject } from "@/lib/content/celestial";
import { planet as planetColors } from "@/lib/design/tokens";
import {
  beltPoints,
  ECLIPSE,
  EARTH_TILT,
  eclipseDepth,
  earthAxis,
  METEOR,
  METEOR_POINTS,
  meteorState,
  moonPosition,
  REVOLUTION,
  revolutionEarth,
  ROTATION,
  rotationAngle,
  sceneFocus,
  zonePlanet,
  ZONES,
} from "@/lib/viewer/dioramas";
import type { Vec3 } from "@/lib/viewer/geometry";
import type { SceneAnim } from "./Scene";
import { Glow, OrbitLine, Ring, Segment, useFresnel, useRadialTexture, useSurface } from "./three-parts";

const deg = THREE.MathUtils.degToRad;

export function Diorama({ object, anim }: { object: CelestialObject; anim: SceneAnim | null }) {
  const f = sceneFocus(object.scene!);
  const position = anim?.position ?? 0;
  const toggles = anim?.toggles ?? {};
  return (
    <group position={[-f[0], -f[1], -f[2]]}>
      {object.scene === "zones" ? <Zones focus={object.view?.focus ?? ""} /> : null}
      {object.scene === "meteor" ? <Meteor position={position} atmosphere={toggles.atmosphere ?? true} /> : null}
      {object.scene === "rotation" ? <Rotation position={position} tilted={toggles.tilt ?? true} axis={toggles.axis ?? true} /> : null}
      {object.scene === "revolution" ? <Revolution position={position} tilted={toggles.tilt ?? true} orbit={toggles.orbit ?? true} /> : null}
      {object.scene === "eclipse" ? (
        <Eclipse position={position} variant={object.variant ?? "solar"} shadow={toggles.shadow ?? true} orbit={toggles.orbit ?? true} />
      ) : null}
    </group>
  );
}

function Sphere({ id, radius, position, basic = false }: { id: string; radius: number; position?: Vec3; basic?: boolean }) {
  const map = useSurface(id);
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 48, 24]} />
      {basic ? <meshBasicMaterial map={map} toneMapped={false} /> : <meshLambertMaterial map={map} />}
    </mesh>
  );
}

function Sun({ radius, position }: { radius: number; position?: Vec3 }) {
  return (
    <group position={position}>
      <Sphere id="matahari" radius={radius} basic />
      <Glow radius={radius} />
    </group>
  );
}

/** Pita zona datar (cincin) untuk menandai kelompok planet. */
function ZoneBand({ inner, outer, color, opacity }: { inner: number; outer: number; color: string; opacity: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <ringGeometry args={[inner, outer, 96, 1]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// ------------------------------------------------------------------ U3

function Zones({ focus }: { focus: string }) {
  const rocks = useMemo(() => beltPoints(), []);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const rockMap = useSurface("asteroid");
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    rocks.forEach((p, i) => {
      o.position.set(...p);
      o.rotation.set(i * 0.7, i * 1.3, 0);
      o.scale.setScalar(0.6 + ((i * 37) % 10) / 12);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [rocks]);
  const inner = ZONES.planets.slice(0, 4);
  const outer = ZONES.planets.slice(4);
  return (
    <group>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 0, 0]} intensity={3} decay={0} />
      <Sun radius={ZONES.sun.radius} />
      <ZoneBand inner={1.2} outer={ZONES.innerZone} color="#c1572f" opacity={focus === "dalam" ? 0.16 : 0.06} />
      <ZoneBand inner={4.75} outer={9.1} color="#3f5fc4" opacity={focus === "luar" ? 0.16 : 0.06} />
      {ZONES.planets.map((p) => (
        <OrbitLine key={p.id} radius={p.orbit} />
      ))}
      <instancedMesh ref={mesh} args={[undefined, undefined, rocks.length]}>
        <icosahedronGeometry args={[0.035, 0]} />
        <meshLambertMaterial map={rockMap} color={focus === "sabuk" ? "#ffffff" : "#b9b2a6"} emissive={focus === "sabuk" ? "#3d362c" : "#000000"} flatShading />
      </instancedMesh>
      {[...inner, ...outer].map((p) => (
        <group key={p.id} position={zonePlanet(p.id)}>
          <Sphere id={p.id} radius={p.radius} />
          {p.id === "saturnus" ? <Ring radius={p.radius} color={planetColors.saturnus} /> : null}
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ U4

const TRAIL = 12;
function Meteor({ position, atmosphere }: { position: number; atmosphere: boolean }) {
  const s = meteorState(position);
  const map = useSurface("asteroid");
  const fire = useRadialTexture("255,170,80");
  const air = useFresnel("#6cb4e8", 3);
  const inBurn = position >= 1 && position < 2;
  const trail = useMemo(() => {
    const out: Vec3[] = [];
    for (let i = 1; i <= TRAIL; i++) {
      const t = i / TRAIL;
      out.push([
        s.rock[0] + (METEOR_POINTS.entry[0] - s.rock[0]) * t,
        s.rock[1] + (METEOR_POINTS.entry[1] - s.rock[1]) * t,
        0,
      ]);
    }
    return out;
  }, [s.rock]);
  return (
    <group>
      <ambientLight intensity={0.35} />
      <directionalLight position={[-6, 8, 6]} intensity={2.2} />
      <group position={METEOR.earth.center}>
        {/* Diputar agar daerah khatulistiwa (bukan kutub es) yang menghadap meteor. */}
        <group rotation={[Math.PI / 2, 0, 0.4]}>
          <Sphere id="bumi" radius={METEOR.earth.radius} />
        </group>
        {atmosphere ? (
          <mesh material={air}>
            <sphereGeometry args={[METEOR.atmosphere, 64, 32]} />
          </mesh>
        ) : null}
      </group>
      <group position={s.rock}>
        <mesh scale={s.scale}>
          <icosahedronGeometry args={[0.28, 1]} />
          <meshLambertMaterial map={map} flatShading emissive={new THREE.Color(0.9 * s.glow, 0.35 * s.glow, 0.05 * s.glow)} />
        </mesh>
        {s.glow > 0.02 ? (
          <sprite scale={[1.6 * s.glow + 0.3, 1.6 * s.glow + 0.3, 1]}>
            <spriteMaterial map={fire} transparent opacity={s.glow} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        ) : null}
      </group>
      {inBurn
        ? trail.map((p, i) => (
            <sprite key={i} position={p} scale={[0.7 * (1 - i / TRAIL) + 0.15, 0.7 * (1 - i / TRAIL) + 0.15, 1]}>
              <spriteMaterial map={fire} transparent opacity={s.glow * 0.6 * (1 - i / TRAIL)} depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>
          ))
        : null}
      {s.landed ? (
        <mesh position={[METEOR_POINTS.ground[0], METEOR_POINTS.ground[1] - 0.12, 0.01]} rotation={[0, 0, deg(12)]}>
          <cylinderGeometry args={[0.32, 0.22, 0.05, 24]} />
          <meshLambertMaterial color="#3b2f28" />
        </mesh>
      ) : null}
    </group>
  );
}

// ------------------------------------------------------------------ U5 rotasi

function Rotation({ position, tilted, axis }: { position: number; tilted: boolean; axis: boolean }) {
  const r = ROTATION.earthRadius;
  const lat = deg(ROTATION.pinLat);
  const pin: Vec3 = [0, r * 1.01 * Math.sin(lat), -r * 1.01 * Math.cos(lat)];
  return (
    <group>
      <ambientLight intensity={0.1} />
      <directionalLight position={[-10, 0, 0]} intensity={2.8} />
      <Sun radius={ROTATION.sunRadius} position={ROTATION.sun} />
      {[-0.8, -0.4, 0, 0.4, 0.8].map((y) => (
        <Segment key={y} from={[-5.1, y, 0.3]} to={[-1.75, y * 0.9, 0.3]} color="#f5a623" opacity={0.35} />
      ))}
      <group rotation={[deg(tilted ? EARTH_TILT : 0), 0, 0]}>
        <group rotation={[0, deg(rotationAngle(position)), 0]}>
          <Sphere id="bumi" radius={r} />
          <mesh position={pin}>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshBasicMaterial color="#f5a623" toneMapped={false} />
          </mesh>
        </group>
        {axis ? <Segment from={[0, -r * 1.45, 0]} to={[0, r * 1.45, 0]} color="#e4ecf2" /> : null}
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ U5 revolusi

function Revolution({ position, tilted, orbit }: { position: number; tilted: boolean; orbit: boolean }) {
  const e = revolutionEarth(position);
  const a = earthAxis(tilted);
  const k = REVOLUTION.earthRadius * 1.6;
  return (
    <group>
      <ambientLight intensity={0.12} />
      <pointLight position={[0, 0, 0]} intensity={3.2} decay={0} />
      <Sun radius={REVOLUTION.sunRadius} />
      {orbit ? <OrbitLine radius={REVOLUTION.orbit} color="#6b86a6" /> : null}
      <group position={e}>
        <group rotation={[0, 0, deg(tilted ? EARTH_TILT : 0)]}>
          <Sphere id="bumi" radius={REVOLUTION.earthRadius} />
        </group>
        <Segment from={[-a[0] * k, -a[1] * k, -a[2] * k]} to={[a[0] * k, a[1] * k, a[2] * k]} color="#e4ecf2" />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ U6 gerhana

function Eclipse({ position, variant, shadow, orbit }: { position: number; variant: "solar" | "lunar"; shadow: boolean; orbit: boolean }) {
  const m = moonPosition(position, variant);
  const depth = eclipseDepth(position, variant);
  // Gerhana Bulan: Bulan meredup dan tampak kemerahan di dalam bayangan inti Bumi.
  const moonColor = useMemo(
    () => (variant === "lunar" ? new THREE.Color(1 - 0.45 * depth, 1 - 0.72 * depth, 1 - 0.8 * depth) : new THREE.Color(1, 1, 1)),
    [variant, depth],
  );
  const moonMap = useSurface("bulan");
  return (
    <group>
      <ambientLight intensity={0.12} />
      <directionalLight position={[-12, 0, 0]} intensity={2.6} />
      <Sun radius={ECLIPSE.sunRadius} position={ECLIPSE.sun} />
      <Sphere id="bumi" radius={ECLIPSE.earthRadius} />
      {orbit ? <OrbitLine radius={ECLIPSE.moonOrbit} color="#6b86a6" /> : null}
      <mesh position={m}>
        <sphereGeometry args={[ECLIPSE.moonRadius, 32, 16]} />
        <meshLambertMaterial map={moonMap} color={moonColor} emissive={variant === "lunar" ? new THREE.Color(0.22 * depth, 0.05 * depth, 0.02 * depth) : undefined} />
      </mesh>
      {shadow ? (
        <>
          {/* Bayangan inti Bulan (gerhana Matahari) dan Bumi (gerhana Bulan), digambar abu-abu agar terlihat. */}
          <mesh position={[m[0] + ECLIPSE.moonShadow / 2, m[1], m[2]]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[ECLIPSE.moonRadius, ECLIPSE.moonShadow, 24, 1, true]} />
            <meshBasicMaterial color="#9fb2c4" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={[ECLIPSE.earthShadow / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[ECLIPSE.earthRadius, ECLIPSE.earthShadow, 32, 1, true]} />
            <meshBasicMaterial color="#9fb2c4" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </>
      ) : null}
      {variant === "solar" && depth > 0.02 ? (
        <mesh position={[-ECLIPSE.earthRadius * 1.004, 0, m[2] * 0.3]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[0.12 + 0.16 * depth, 32]} />
          <meshBasicMaterial color="#05080d" transparent opacity={0.8 * depth} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}
