import { NextResponse } from "next/server";
import { BackendError, getBackend, getViewer } from "@/lib/backend";

/**
 * Kemajuan belajar pengguna saat ini. Halaman belajar tetap statis (cepat tampil);
 * status dibaca klien dari sini. `scope` memisahkan simpanan perangkat per siswa
 * (perangkat sering dipakai bergantian, PRD §3).
 */
export async function GET() {
  const viewer = await getViewer();
  const headers = { "Cache-Control": "no-store" };
  if (viewer.kind !== "student") return NextResponse.json({ scope: "tamu", server: null, freeMode: false }, { headers });
  try {
    const s = await getBackend().getLearningState();
    const { freeMode, ...server } = s;
    return NextResponse.json({ scope: viewer.studentId, server, freeMode }, { headers });
  } catch (e) {
    const code = e instanceof BackendError ? e.code : "unknown";
    return NextResponse.json({ error: code }, { status: code === "forbidden" ? 403 : 500, headers });
  }
}
