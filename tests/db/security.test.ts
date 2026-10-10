/**
 * M8 · Keamanan basis data (PRD §12.4): pembatasan laju, pemetaan nama khusus admin + audit,
 * penghapusan data penelitian siswa yang menarik persetujuan, tabel batas laju tertutup.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, pgError, TEST_DATABASE_URL, type Db } from "./harness";

const run = TEST_DATABASE_URL ? describe : describe.skip;
const ID = {
  teacher: "99999999-0000-0000-0000-000000000001",
  admin: "99999999-0000-0000-0000-000000000002",
  s1: "aaaaaaaa-0000-0000-0000-000000000001",
};
let db: Db;
const F: Record<string, string> = {};
const as = (sub: string) => ({ role: "authenticated" as const, sub });
const commit = { commit: true };

run("basis data: keamanan (M8)", () => {
  beforeAll(async () => {
    db = await createTestDb();
    const q = db.sql;
    await q("insert into auth.users (id, email) values ($1, 't@contoh.id'), ($2, 'r@contoh.id')", [ID.teacher, ID.admin]);
    await q("update public.profiles set role = 'admin' where id = $1", [ID.admin]);
    await q(`insert into auth.users (id, email, raw_app_meta_data) values ($1::uuid, $1::text || '@siswa.invalid', '{"kind":"student"}')`, [ID.s1]);
    F.cls = (await q("insert into public.classes (teacher_id, name, mode) values ($1, '6A', 'research') returning id", [ID.teacher])).rows[0].id;
    const mk = async (code: string, consent: string, user: string | null) =>
      (
        await q(
          `insert into public.students (class_id, student_code, nickname, pin_hash, pseudo_id, auth_user_id, consent_status, withdrawn_at)
           values ($1, $2, 'Nama' || $2, public.hash_pin('1234'), public.gen_pseudo_id(), $3, $4, case when $4 = 'withdrawn' then now() - interval '40 days' end) returning id`,
          [F.cls, code, user, consent],
        )
      ).rows[0].id as string;
    F.keep = await mk("S01", "granted", ID.s1);
    F.gone = await mk("S02", "withdrawn", null);
    const test = (await q("select id from public.tests where status = 'active'")).rows[0].id;
    F.ct = (await q("insert into public.class_tests (class_id, test_id, phase, status) values ($1, $2, 'pre', 'closed') returning id", [F.cls, test])).rows[0].id;
    for (const s of [F.keep, F.gone]) await q("insert into public.test_attempts (student_id, class_test_id, submitted_at) values ($1, $2, now())", [s, F.ct]);
  }, 60_000);
  afterAll(async () => db?.close());

  it("consume_rate_limit: batas per cakupan & pengguna; cakupan tak dikenal ditolak; tamu ditolak", async () => {
    for (let i = 0; i < 5; i++) await db.as(as(ID.teacher), (c) => c.query("select public.consume_rate_limit('riset_name_map')"), commit);
    const e = await pgError(db.as(as(ID.teacher), (c) => c.query("select public.consume_rate_limit('riset_name_map')"), commit));
    expect(e.detail).toBe("rate_limited");
    // Pengguna lain punya kuota sendiri
    await db.as(as(ID.admin), (c) => c.query("select public.consume_rate_limit('riset_name_map')"), commit);
    expect((await pgError(db.as(as(ID.teacher), (c) => c.query("select public.consume_rate_limit('sesuka_hati')")))).detail).toBe("invalid_input");
    expect((await pgError(db.as({ role: "anon" }, (c) => c.query("select public.consume_rate_limit('tes_save')")))).code).toBe("42501");
    // Batas tidak bisa diatur pemanggil
    expect((await pgError(db.as(as(ID.teacher), (c) => c.query("select public.hit_rate_limit('x', 1000000, 1)")))).code).toBe("42501");
    expect((await pgError(db.as(as(ID.teacher), (c) => c.query("select * from public.rate_limits")))).code).toBe("42501");
  });

  it("jendela tetap: melewati batas → rate_limited", async () => {
    await db.sql("select public.hit_rate_limit('uji', 2, 3600)");
    await db.sql("select public.hit_rate_limit('uji', 2, 3600)");
    expect((await pgError(db.sql("select public.hit_rate_limit('uji', 2, 3600)"))).detail).toBe("rate_limited");
  });

  it("pemetaan nama: admin saja, tercatat di audit", async () => {
    expect((await pgError(db.as(as(ID.teacher), (c) => c.query("select * from public.research_name_map(null)")))).code).toBe("42501");
    expect((await pgError(db.as(as(ID.teacher), (c) => c.query("select public.log_name_map(null)")))).code).toBe("42501");
    await db.as(as(ID.admin), (c) => c.query("select public.log_name_map($1)", [F.cls]), commit);
    const rows = (await db.as(as(ID.admin), (c) => c.query("select * from public.research_name_map($1)", [F.cls]))).rows;
    expect(rows.map((r) => [r.student_code, r.nickname, r.consent])).toEqual([
      ["S01", "NamaS01", "granted"],
      ["S02", "NamaS02", "withdrawn"],
    ]);
    expect((await db.sql("select actor_id from public.audit_log where action = 'export.name_map'")).rows).toEqual([{ actor_id: ID.admin }]);
  });

  it("FR-61: hapus data tes siswa withdrawn (admin); siswa tetap ada; guru ditolak", async () => {
    expect((await pgError(db.as(as(ID.teacher), (c) => c.query("select public.purge_withdrawn_research_data()")))).code).toBe("42501");
    // Ambang usia: data ditarik 40 hari lalu, ambang 60 hari → belum dihapus
    expect((await db.as(as(ID.admin), (c) => c.query("select public.purge_withdrawn_research_data('60 days') n"), commit)).rows[0].n).toBe(0);
    expect((await db.as(as(ID.admin), (c) => c.query("select public.purge_withdrawn_research_data('30 days') n"), commit)).rows[0].n).toBe(1);
    const left = (await db.sql("select student_id from public.test_attempts")).rows.map((r) => r.student_id);
    expect(left).toEqual([F.keep]);
    expect((await db.sql("select count(*)::int n from public.students")).rows[0].n).toBe(2);
    expect((await db.sql("select meta->>'students' n from public.audit_log where action = 'purge.withdrawn' order by created_at desc limit 1")).rows[0].n).toBe("1");
    // Penjadwal basis data (sesi postgres tanpa JWT) juga boleh
    expect((await db.sql("select public.purge_withdrawn_research_data() n")).rows[0].n).toBe(0);
  });
});
