/**
 * Penulis USDZ minimal untuk AR Quick Look (iPhone/iPad): satu berkas model.usda + tekstur JPEG,
 * dikemas tanpa kompresi dengan data tiap berkas sejajar 64 byte (syarat format USDZ).
 * Struktur mengikuti three.js USDZExporter (MIT) yang sudah teruji di Quick Look.
 * Murni: tidak membaca berkas; tidak bergantung pada DOM.
 */
import { strToU8, zipSync, type Zippable } from "fflate";

export interface MeshData {
  name: string;
  positions: Float32Array<ArrayBuffer>;
  normals: Float32Array<ArrayBuffer>;
  /** UV gaya three.js: v = 1 di tepi atas gambar. */
  uvs: Float32Array<ArrayBuffer> | null;
  indices: Uint32Array<ArrayBuffer>;
  material: number;
}

export interface MaterialData {
  /** Warna linear 0–1. */
  color: [number, number, number];
  opacity: number;
  emissive: boolean;
  texture: string | null;
}

const P = 5;
const f = (x: number) => Number(x.toPrecision(P)).toString();
const safe = (s: string) => {
  const n = s.replace(/[^A-Za-z0-9_]/g, "");
  return /^[0-9]/.test(n) || n === "" ? `_${n}` : n;
};

function vec3s(a: Float32Array) {
  const out: string[] = [];
  for (let i = 0; i < a.length; i += 3) out.push(`(${f(a[i]!)}, ${f(a[i + 1]!)}, ${f(a[i + 2]!)})`);
  return out.join(", ");
}
function vec2s(a: Float32Array) {
  const out: string[] = [];
  for (let i = 0; i < a.length; i += 2) out.push(`(${f(a[i]!)}, ${f(a[i + 1]!)})`);
  return out.join(", ");
}
const color = (c: [number, number, number]) => `(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;

function materialUsda(m: MaterialData, i: number) {
  const path = `/Materials/Material_${i}`;
  const lines: string[] = [];
  const surface: string[] = ['uniform token info:id = "UsdPreviewSurface"'];
  let textureNodes = "";
  if (m.texture) {
    surface.push(`color3f inputs:diffuseColor.connect = <${path}/Texture.outputs:rgb>`);
    if (m.emissive) surface.push(`color3f inputs:emissiveColor.connect = <${path}/Texture.outputs:rgb>`);
    textureNodes = `
		def Shader "PrimvarReader"
		{
			uniform token info:id = "UsdPrimvarReader_float2"
			float2 inputs:fallback = (0.0, 0.0)
			string inputs:varname = "st"
			float2 outputs:result
		}

		def Shader "Texture"
		{
			uniform token info:id = "UsdUVTexture"
			asset inputs:file = @textures/${m.texture}.jpg@
			float2 inputs:st.connect = <${path}/PrimvarReader.outputs:result>
			float4 inputs:scale = (${f(m.color[0])}, ${f(m.color[1])}, ${f(m.color[2])}, 1)
			token inputs:sourceColorSpace = "sRGB"
			token inputs:wrapS = "repeat"
			token inputs:wrapT = "clamp"
			float3 outputs:rgb
		}
`;
  } else {
    surface.push(`color3f inputs:diffuseColor = ${color(m.color)}`);
    if (m.emissive) surface.push(`color3f inputs:emissiveColor = ${color(m.color)}`);
  }
  surface.push(`float inputs:opacity = ${f(m.opacity)}`, "float inputs:roughness = 1", "float inputs:metallic = 0", "int inputs:useSpecularWorkflow = 0", "token outputs:surface");
  lines.push(`	def Material "Material_${i}"
	{
		token outputs:surface.connect = <${path}/PreviewSurface.outputs:surface>
${textureNodes}
		def Shader "PreviewSurface"
		{
${surface.map((l) => `			${l}`).join("\n")}
		}
	}`);
  return lines.join("\n");
}

function meshUsda(m: MeshData, used: Set<string>) {
  let name = safe(m.name);
  while (used.has(name)) name += "_";
  used.add(name);
  const tris = m.indices.length / 3;
  const st = m.uvs
    ? `
				texCoord2f[] primvars:st = [${vec2s(m.uvs)}] (
					interpolation = "vertex"
				)`
    : "";
  return `			def Xform "${name}" (
				prepend apiSchemas = ["MaterialBindingAPI"]
			)
			{
				rel material:binding = </Materials/Material_${m.material}>

				def Mesh "Geometry"
				{
					int[] faceVertexCounts = [${Array(tris).fill(3).join(", ")}]
					int[] faceVertexIndices = [${Array.from(m.indices).join(", ")}]
					normal3f[] normals = [${vec3s(m.normals)}] (
						interpolation = "vertex"
					)
					point3f[] points = [${vec3s(m.positions)}]${st.replace(/\n\t\t\t\t/g, "\n\t\t\t\t\t")}
					uniform token subdivisionScheme = "none"
				}
			}`;
}

export function buildUsda(meshes: MeshData[], materials: MaterialData[]) {
  const used = new Set<string>();
  return `#usda 1.0
(
	customLayerData = {
		string creator = "ARSSMED"
	}
	defaultPrim = "Root"
	metersPerUnit = 1
	upAxis = "Y"
)

def Xform "Root"
{
	def Scope "Scenes" (
		kind = "sceneLibrary"
	)
	{
		def Xform "Scene" (
			customData = {
				bool preliminary_collidesWithEnvironment = 0
				string sceneName = "Scene"
			}
			sceneName = "Scene"
		)
		{
			token preliminary:anchoring:type = "plane"
			token preliminary:planeAnchoring:alignment = "horizontal"

${meshes.map((m) => meshUsda(m, used)).join("\n\n")}
		}
	}
}

def "Materials"
{
${materials.map(materialUsda).join("\n\n")}
}
`;
}

/** Kemas menjadi USDZ: tanpa kompresi, data tiap berkas mulai di kelipatan 64 byte. */
export function packUsdz(usda: string, textures: Record<string, Uint8Array>): Uint8Array {
  const entries: [string, Uint8Array][] = [["model.usda", strToU8(usda)], ...Object.entries(textures).map(([k, v]) => [`textures/${k}.jpg`, v] as [string, Uint8Array])];
  const files: Zippable = {};
  let offset = 0;
  for (const [name, data] of entries) {
    const base = offset + 30 + name.length;
    const pad = base % 64 === 0 ? -1 : (64 - ((base + 4) % 64)) % 64;
    if (pad >= 0) {
      files[name] = [data, { extra: { 12345: new Uint8Array(pad) } }];
      offset = base + 4 + pad + data.length;
    } else {
      files[name] = data;
      offset = base + data.length;
    }
  }
  return zipSync(files, { level: 0, mtime: new Date("2026-01-01T00:00:00Z") });
}

/** Baca ulang arsip: nama berkas dan offset data (untuk uji keselarasan 64 byte). */
export function usdzEntries(zip: Uint8Array) {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const out: { name: string; dataOffset: number; size: number; method: number }[] = [];
  let p = 0;
  while (p + 30 <= zip.length && dv.getUint32(p, true) === 0x04034b50) {
    const method = dv.getUint16(p + 8, true);
    const size = dv.getUint32(p + 18, true);
    const nameLen = dv.getUint16(p + 26, true);
    const extraLen = dv.getUint16(p + 28, true);
    const name = new TextDecoder().decode(zip.subarray(p + 30, p + 30 + nameLen));
    const dataOffset = p + 30 + nameLen + extraLen;
    out.push({ name, dataOffset, size, method });
    p = dataOffset + size;
  }
  return out;
}
