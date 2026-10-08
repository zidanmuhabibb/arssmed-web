"use client";

/** Potongan three.js yang dipakai bersama oleh Scene (benda tunggal) dan Dioramas (adegan U3–U6). */
import { useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Tekstur dibuat saat build (scripts/build-textures.mjs) → WebP kecil, di-cache service worker. */
function configureSurface(tex: THREE.Texture) {
  if (tex.colorSpace === THREE.SRGBColorSpace) return;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
}

export function useSurface(id: string) {
  const tex = useLoader(THREE.TextureLoader, `/textures/${id}.webp`);
  const { invalidate } = useThree();
  useEffect(() => {
    configureSurface(tex);
    invalidate();
  }, [tex, invalidate]);
  return tex;
}

export function Glow({ radius }: { radius: number }) {
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

export function Ring({ radius, color }: { radius: number; color: string }) {
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

export function useRadialTexture(rgb: string) {
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


/** Lingkaran orbit tipis di bidang xz. */
export function OrbitLine({ radius, color = "#3a5574", opacity = 0.9 }: { radius: number; color?: string; opacity?: number }) {
  const line = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, -Math.sin(a) * radius));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }, [radius, color, opacity]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}

/** Garis lurus antara dua titik (sumbu Bumi, berkas cahaya). */
export function Segment({ from, to, color, opacity = 1 }: { from: [number, number, number]; to: [number, number, number]; color: string; opacity?: number }) {
  const [ax, ay, az] = from;
  const [bx, by, bz] = to;
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz)]);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
  }, [ax, ay, az, bx, by, bz, color, opacity]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}

/** Selubung atmosfer: tepi bercahaya (fresnel), tengah transparan. */
export function useFresnel(hex: string, power = 2.2) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        uniforms: { glow: { value: new THREE.Color(hex) } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 glow; varying vec3 vN; varying vec3 vV;
          void main(){ float r = pow(1.0 - max(dot(vN, vV), 0.0), ${power.toFixed(2)}); gl_FragColor = vec4(glow * r, r); }`,
      }),
    [hex, power],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}
