import { connection, NextResponse } from "next/server";
import { getBackend, getViewer } from "@/lib/backend";
import { errorResponse, NO_STORE } from "@/lib/tes/http";

/** Status pre/post untuk siswa yang masuk (halaman /tes dan Beranda). Tamu: daftar kosong. */
export async function GET() {
  await connection(); // selalu per permintaan (bergantung sesi)
  try {
    const viewer = await getViewer();
    if (viewer.kind !== "student") return NextResponse.json({ tests: [] }, { headers: NO_STORE });
    return NextResponse.json({ tests: await getBackend().studentTests() }, { headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
