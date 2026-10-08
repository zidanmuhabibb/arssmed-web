/**
 * M4 · Fungsi alur belajar di basis data: urutan langkah, tebakan pertama berlaku,
 * mode bebas guru, dan isolasi antarsiswa. Berjalan bila TEST_DATABASE_URL diisi.
 */
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentContentSql } from "@/lib/learning/content-sql-data";
import { unitObjects } from "@/lib/content/celestial";
import { LEARNING } from "@/lib/learning/content";
import { createTestDb, pgError, TEST_DATABASE_URL, type Db } from "./harness";

const run = TEST_DATABASE_URL ? describe : describe.skip;

describe("migrasi konten", () => {
  it("migrasi *_content.sql terakhir sama dengan content/*.json (jalankan `pnpm content:sql`)", () => {
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith("_content.sql")).sort();
    expect(files.length).toBeGreaterThan(0);
    expect(readFileSync(`supabase/migrations/${files.at(-1)}`, "utf8")).toBe(currentContentSql());
  });
});

const ID = {
  teacher: "33333333-0000-0000-0000-000000000001",
  other: "33333333-0000-0000-0000-000000000002",
  s1: "44444444-0000-0000-0000-000000000001",
  s2: "44444444-0000-0000-0000-000000000002",
};
let db: Db;
const F: Record<string, string> = {};
const as = (sub: string) => ({ role: "authenticated" as const, sub });
const commit = { commit: true };

run("basis data: alur belajar (M4)", () => {
  beforeAll(async () => {
    db = await createTestDb();
    const q = db.sql;
    await q("insert into auth.users (id, email) values ($1, 'g@contoh.id'), ($2, 'h@contoh.id')", [ID.teacher, ID.other]);
    for (const id of [ID.s1, ID.s2])
      await q(`insert into auth.users (id, email, raw_app_meta_data) values ($1::uuid, $1::text || '@siswa.invalid', '{"kind":"student"}')`, [id]);
    F.cls = (await q("insert into public.classes (teacher_id, name) values ($1, '6A') returning id", [ID.teacher])).rows[0].id;
    const mk = async (code: string, user: string) =>
      (
        await q(
          `insert into public.students (class_id, student_code, pin_hash, pseudo_id, auth_user_id)
           values ($1, $2, public.hash_pin('1234'), public.gen_pseudo_id(), $3) returning id`,
          [F.cls, code, user],
        )
      ).rows[0].id as string;
    F.s1 = await mk("S01", ID.s1);
    F.s2 = await mk("S02", ID.s2);
  }, 60_000);
  afterAll(async () => db?.close());

  it("konten ter-seed: 6 unit, objek Viewer, dan soal Tebak", async () => {
    const units = await db.sql("select slug from public.units order by sort_order");
    expect(units.rows.map((r) => r.slug)).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    const objs = await db.sql("select count(*)::int n from public.ar_objects o join public.units u on u.id = o.unit_id where u.slug = 'u4'");
    expect(objs.rows[0].n).toBe(unitObjects("u4").length);
    const preds = await db.sql("select count(*)::int n from public.prediction_items");
    expect(preds.rows[0].n).toBe(Object.values(LEARNING.units).flatMap((u) => u.predictions).length);
  });

  it("migrasi konten idempoten (aman dijalankan ulang)", async () => {
    await db.sql(currentContentSql());
    const r = await db.sql("select count(*)::int n from public.units");
    expect(r.rows[0].n).toBe(6);
  });

  it("anon dan guru tidak bisa memanggil fungsi siswa", async () => {
    const e = await pgError(db.as({ role: "anon" }, (c) => c.query("select public.learning_state()")));
    expect(e.code).toBe("42501");
    const f = await pgError(db.as(as(ID.teacher), (c) => c.query("select public.learning_state()")));
    expect(f.detail).toBe("forbidden");
  });

  it("langkah terkunci sampai langkah sebelumnya selesai", async () => {
    const e = await pgError(db.as(as(ID.s1), (c) => c.query("select public.complete_step('u1', 'amati')")));
    expect(e.detail).toBe("locked");
    const f = await pgError(db.as(as(ID.s1), (c) => c.query("select public.complete_step('u1', 'tebak')")));
    expect(f.detail).toBe("locked"); // belum menjawab semua prediksi
  });

  it("tebakan: opsi divalidasi, jawaban pertama berlaku", async () => {
    const bad = await pgError(db.as(as(ID.s1), (c) => c.query("select public.save_prediction('u1-cahaya-bulan', 'D')")));
    expect(bad.detail).toBe("invalid_input");
    const a = await db.as(as(ID.s1), (c) => c.query("select public.save_prediction('u1-cahaya-bulan', 'A') v"), commit);
    expect(a.rows[0].v).toBe("A");
    const b = await db.as(as(ID.s1), (c) => c.query("select public.save_prediction('u1-cahaya-bulan', 'B') v"), commit);
    expect(b.rows[0].v).toBe("A");
  });

  it("satu unit end-to-end: Tebak → Amati → Bandingkan → Jelaskan", async () => {
    await db.as(as(ID.s1), (c) => c.query("select public.save_prediction('u1-bintang-dekat', 'B')"), commit);
    await db.as(as(ID.s1), (c) => c.query("select public.complete_step('u1', 'tebak')"), commit);
    const objs = unitObjects("u1").map((o) => o.id);
    await db.as(as(ID.s1), (c) => c.query("select public.record_object_view('u1', $1)", [objs[0]]), commit);
    const locked = await pgError(db.as(as(ID.s1), (c) => c.query("select public.complete_step('u1', 'amati')")));
    expect(locked.detail).toBe("locked");
    for (const o of objs.slice(1)) await db.as(as(ID.s1), (c) => c.query("select public.record_object_view('u1', $1)", [o]), commit);
    await db.as(as(ID.s1), (c) => c.query("select public.complete_step('u1', 'amati')"), commit);
    await db.as(as(ID.s1), (c) => c.query("select public.complete_step('u1', 'bandingkan')"), commit);
    await db.as(as(ID.s1), (c) => c.query("select public.mark_discussed('u1')"), commit);
    await db.as(as(ID.s1), (c) => c.query("select public.mark_discussed('u1')"), commit); // idempoten
    const st = (await db.as(as(ID.s1), (c) => c.query("select public.learning_state() s"))).rows[0].s;
    expect(st.steps.u1).toEqual(["tebak", "amati", "bandingkan", "jelaskan"]);
    expect(st.predictions).toEqual({ "u1-cahaya-bulan": "A", "u1-bintang-dekat": "B" });
    expect([...st.viewed.u1].sort()).toEqual([...objs].sort());
    expect(st.discussed).toEqual(["u1"]);
    expect(st.free_explore).toBe(false);
  });

  it("siswa lain tidak melihat kemajuan siswa ini; guru kelasnya bisa", async () => {
    const st = (await db.as(as(ID.s2), (c) => c.query("select public.learning_state() s"))).rows[0].s;
    expect(st.steps).toEqual({});
    const peers = await db.as(as(ID.s2), (c) => c.query("select * from public.prediction_responses"));
    expect(peers.rows).toEqual([]);
    const teacher = await db.as(as(ID.teacher), (c) => c.query("select count(*)::int n from public.unit_progress"));
    expect(teacher.rows[0].n).toBe(4);
    const other = await db.as(as(ID.other), (c) => c.query("select count(*)::int n from public.unit_progress"));
    expect(other.rows[0].n).toBe(0);
  });

  it("mode bebas (FR-22): guru kelas mengaktifkan, Amati selesai tanpa melihat semua", async () => {
    const no = await db.as(as(ID.other), (c) => c.query("update public.classes set free_explore = true where id = $1", [F.cls]));
    expect(no.rowCount).toBe(0);
    await db.as(as(ID.teacher), (c) => c.query("update public.classes set free_explore = true where id = $1", [F.cls]), commit);
    await db.as(as(ID.s2), (c) => c.query("select public.save_prediction('u4-nasib-batuan', 'A')"), commit);
    await db.as(as(ID.s2), (c) => c.query("select public.complete_step('u4', 'tebak')"), commit);
    await db.as(as(ID.s2), (c) => c.query("select public.complete_step('u4', 'amati')"), commit);
    const st = (await db.as(as(ID.s2), (c) => c.query("select public.learning_state() s"))).rows[0].s;
    expect(st.free_explore).toBe(true);
    expect(st.steps.u4).toEqual(["tebak", "amati"]);
  });

  it("siswa tidak bisa mengubah mode kelas", async () => {
    const r = await db.as(as(ID.s1), (c) => c.query("update public.classes set free_explore = false"));
    expect(r.rowCount).toBe(0);
  });

  it("AR permukaan dicatat dengan jenis perangkat (FR-14, FR-17)", async () => {
    await db.as(as(ID.s2), (c) => c.query("select public.record_object_view('u2', 'bumi', 'ar_surface', 'android')"), commit);
    const r = await db.sql("select mode, device_kind from public.object_views v join public.students s on s.id = v.student_id where s.id = $1 and v.mode = 'ar_surface'", [F.s2]);
    expect(r.rows).toEqual([{ mode: "ar_surface", device_kind: "android" }]);
    const e = await pgError(db.as(as(ID.s2), (c) => c.query("select public.record_object_view('u2', 'bumi', 'ar_surface', 'konsol')")));
    expect(e.detail).toBe("invalid_input");
    const urls = await db.sql("select glb_url, usdz_url from public.ar_objects where slug = 'bumi' limit 1");
    expect(urls.rows[0]).toEqual({ glb_url: "/models/bumi.glb", usdz_url: "/models/bumi.usdz" });
  });

  it("unit/objek/langkah tak dikenal ditolak dengan kode yang jelas", async () => {
    expect((await pgError(db.as(as(ID.s1), (c) => c.query("select public.complete_step('u9', 'tebak')")))).detail).toBe("not_found");
    expect((await pgError(db.as(as(ID.s1), (c) => c.query("select public.complete_step('u1', 'main')")))).detail).toBe("invalid_input");
    expect((await pgError(db.as(as(ID.s1), (c) => c.query("select public.record_object_view('u1', 'pluto-x')")))).detail).toBe("not_found");
  });
});
