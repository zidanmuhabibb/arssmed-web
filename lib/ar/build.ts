/**
 * Membangun berkas AR dari spesifikasi (lib/ar/spec.ts): geometri dari three.js, GLB lewat
 * glTF-Transform, USDZ lewat lib/ar/usdz.ts. Transformasi "dipanggang" ke titik-titik sehingga
 * kedua format pasti sama. Model diangkat agar dasarnya tepat di lantai (y = 0).
 */
import { Document, NodeIO } from "@gltf-transform/core";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ModelSpec, Part, Shape } from "./spec";
import { buildUsda, packUsdz, type MaterialData, type MeshData } from "./usdz";

function rockGeometry(radius: number, detail = 3) {
  // Bentuk batu yang sama dengan Viewer 3D (components/viewer/Scene.tsx → Asteroid).
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position!;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).divideScalar(radius);
    const k = 1 + 0.18 * Math.sin(v.x * 4.1) * Math.cos(v.y * 3.3) + 0.1 * Math.sin(v.z * 7.7);
    v.multiplyScalar(radius * k);
    v.y *= 0.75;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function shapeGeometry(s: Shape): THREE.BufferGeometry {
  switch (s.kind) {
    case "sphere":
      // Benda kecil di adegan tidak butuh banyak segitiga.
      if (s.radius < 0.03) return new THREE.SphereGeometry(s.radius, 20, 10);
      return s.radius < 0.08 ? new THREE.SphereGeometry(s.radius, 32, 16) : new THREE.SphereGeometry(s.radius, 48, 24);
    case "rock":
      return rockGeometry(s.radius);
    case "cylinder":
      return new THREE.CylinderGeometry(s.radius, s.radius, s.height, 24);
    case "cone":
      return new THREE.ConeGeometry(s.radius, s.height, 32);
    case "torus": {
      const thin = s.tube < 0.005;
      const g = new THREE.TorusGeometry(s.radius, s.tube, thin ? 3 : 10, thin ? 64 : 96);
      g.rotateX(Math.PI / 2); // berbaring di bidang xz (bidang orbit)
      if (s.flatten) g.scale(1, s.flatten, 1);
      return g;
    }
    case "rocks": {
      const parts = s.points.map((p, i) => {
        const g = new THREE.IcosahedronGeometry(s.size * (0.6 + ((i * 37) % 10) / 12), 0);
        g.rotateX(i * 0.7).rotateY(i * 1.3);
        g.translate(p[0], p[1], p[2]);
        return g;
      });
      const merged = mergeGeometries(parts)!;
      merged.computeVertexNormals();
      return merged;
    }
  }
}

function partGeometry(part: Part) {
  const g = shapeGeometry(part.shape);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...part.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...((part.rotation ?? [0, 0, 0]).map((d) => (d * Math.PI) / 180) as [number, number, number]), "XYZ")),
    new THREE.Vector3(1, 1, 1),
  );
  g.applyMatrix4(m);
  return g.index ? g : (() => {
    const idx = new Uint32Array(g.attributes.position!.count).map((_, i) => i);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  })();
}

function linear(hex: string): [number, number, number] {
  const c = new THREE.Color(hex); // ColorManagement aktif: disimpan linear
  return [c.r, c.g, c.b];
}

export interface BuiltModel {
  id: string;
  glb: Uint8Array;
  usdz: Uint8Array;
  triangles: number;
  textures: string[];
  /** Ukuran kotak pembatas (m). */
  size: [number, number, number];
}

/** `loadTexture(id)` mengembalikan JPEG tekstur (dibuat skrip dari public/textures/<id>.webp). */
export async function buildModel(spec: ModelSpec, loadTexture: (id: string) => Promise<Uint8Array>): Promise<BuiltModel> {
  const geoms = spec.parts.map(partGeometry);

  // Angkat agar titik terendah di y = 0 (diletakkan di lantai/meja).
  const box = new THREE.Box3();
  for (const g of geoms) {
    g.computeBoundingBox();
    box.union(g.boundingBox!);
  }
  const lift = -box.min.y;
  for (const g of geoms) g.translate(0, lift, 0);
  const size = box.getSize(new THREE.Vector3());

  // Material unik
  const materials: MaterialData[] = [];
  const keyOf = (m: MaterialData) => JSON.stringify(m);
  const matIndex = new Map<string, number>();
  const meshes: MeshData[] = spec.parts.map((part, i) => {
    const mat: MaterialData = { color: linear(part.color), opacity: part.opacity ?? 1, emissive: !!part.emissive, texture: part.texture ?? null };
    const k = keyOf(mat);
    if (!matIndex.has(k)) {
      matIndex.set(k, materials.length);
      materials.push(mat);
    }
    const g = geoms[i]!;
    return {
      name: part.name,
      positions: new Float32Array(g.attributes.position!.array),
      normals: new Float32Array(g.attributes.normal!.array),
      uvs: part.texture && g.attributes.uv ? new Float32Array(g.attributes.uv.array) : null,
      indices: new Uint32Array(g.index!.array),
      material: matIndex.get(k)!,
    };
  });

  const texIds = [...new Set(materials.map((m) => m.texture).filter((t): t is string => !!t))];
  const texBytes = Object.fromEntries(await Promise.all(texIds.map(async (id) => [id, await loadTexture(id)] as const)));

  // ---- GLB
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene(spec.id);
  const gTex = Object.fromEntries(texIds.map((id) => [id, doc.createTexture(id).setImage(texBytes[id]!).setMimeType("image/jpeg").setURI(`${id}.jpg`)]));
  const gMat = materials.map((m, i) => {
    const mat = doc.createMaterial(`Material_${i}`).setBaseColorFactor([...m.color, m.opacity]).setRoughnessFactor(1).setMetallicFactor(0);
    if (m.texture) mat.setBaseColorTexture(gTex[m.texture]!);
    if (m.emissive) {
      mat.setEmissiveFactor(m.texture ? [1, 1, 1] : m.color);
      if (m.texture) mat.setEmissiveTexture(gTex[m.texture]!);
    }
    if (m.opacity < 1) mat.setAlphaMode("BLEND");
    return mat;
  });
  for (const m of meshes) {
    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(m.positions))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(m.normals))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(m.indices))
      .setMaterial(gMat[m.material]!);
    if (m.uvs) {
      // glTF: v = 0 di tepi ATAS gambar (kebalikan three.js).
      const uv = new Float32Array(m.uvs);
      for (let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i]!;
      prim.setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(uv));
    }
    scene.addChild(doc.createNode(m.name).setMesh(doc.createMesh(m.name).addPrimitive(prim)));
  }
  doc.getRoot().setDefaultScene(scene);
  doc.getRoot().getAsset().generator = "ARSSMED (glTF-Transform)";
  const glb = await new NodeIO().writeBinary(doc);

  // ---- USDZ
  const usdz = packUsdz(buildUsda(meshes, materials), texBytes);

  return {
    id: spec.id,
    glb,
    usdz,
    triangles: meshes.reduce((n, m) => n + m.indices.length / 3, 0),
    textures: texIds,
    size: [size.x, size.y, size.z],
  };
}
