/**
 * M7 · Fungsi DB dasbor/statistik: kepemilikan kelas, admin lintas kelas, hanya percobaan selesai
 * dengan klasifikasi aturan tes, tanpa kunci jawaban, audit ekspor (FR-55). Hasil RPC diolah
 * lib/analysis dan dibandingkan dengan analisis dataset yang sama yang dibentuk langsung.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyze, datasetFromRpc, responsesLong, type DatasetRpcRow } from "@/lib/analysis";
import { getRuleSet } from "@/lib/classification";
import { classifyAttempt, type StoredItem } from "@/lib/tes/deliver";
import { ITEMS } from "@/lib/tes/items-sql-data";
import { createTestDb, pgError, TEST_DATABASE_URL, type Db } from "./harness";

const run = TEST_DATABASE_URL ? describe : describe.skip;

const ID = {
  teacher: "77777777-0000-0000-0000-000000000001",
  other: "77777777-0000-0000-0000-000000000002",
  admin: "77777777-0000-0000-0000-000000000003",
  s1: "88888888-0000-0000-0000-000000000001",
  s2: "88888888-0000-0000-0000-000000000002",
  s3: "88888888-0000-0000-0000-000000000003",
  s4: "88888888-0000-0000-0000-000000000004",
};
let db: Db;
const F: Record<string, string> = {};
const as = (sub: string) => ({ role: "authenticated" as const, sub });
const commit = { commit: true };
type Item = { id: string; item_order: number; content: { tier1: { correct: string; options: { key: string }[] }; reason: { correct: string; options: { key: string }[] } } };
let items: Item[] = [];
const stored = () => items.map((i): StoredItem => ({ id: i.id, order: i.item_order, content: i.content }));

/** Siswa menjawab semua butir (pola ditentukan nomor siswa), menyelesaikan, lalu server mengklasifikasi. */
async function takeTest(sub: string, phase: "pre" | "post", seed: number) {
  const att = (await db.as(as(sub), (c) => c.query("select * from public.start_attempt($1)", [phase]), commit)).rows[0].attempt_id as string;
  const answers: Record<string, { tier1: string; confidenceA: number; reason: string; confidenceR: number }> = {};
  for (const it of items) {
    const k = (it.item_order + seed) % 4;
    const a = { tier1: k === 0 ? it.content.tier1.options[1]!.key : it.content.tier1.correct, confidenceA: k === 3 ? 1 : 0, reason: k === 1 ? it.content.reason.options[0]!.key : it.content.reason.correct, confidenceR: 0 };
    answers[it.id] = a;
    await db.as(as(sub), (c) => c.query("select public.save_response($1, $2, $3, $4, $5, $6, '2030-01-01T00:00:00Z', 1200, null)", [att, it.id, a.tier1, a.confidenceA, a.reason, a.confidenceR]), commit);
  }
  expect((await db.as(as(sub), (c) => c.query("select public.submit_attempt($1) r", [att]), commit)).rows[0].r.ok).toBe(true);
  const rows = classifyAttempt(stored(), answers, getRuleSet("pedoman-v1"));
  await db.as({ role: "service_role" }, (c) => c.query("select public.store_classifications($1, 'pedoman-v1', $2::jsonb)", [att, JSON.stringify(rows)]), commit);
}

run("basis data: dataset analisis (M7)", () => {
  beforeAll(async () => {
    db = await createTestDb();
    const q = db.sql;
    await q("insert into auth.users (id, email) values ($1, 'a@contoh.id'), ($2, 'b@contoh.id'), ($3, 'r@contoh.id')", [ID.teacher, ID.other, ID.admin]);
    await q("update public.profiles set role = 'admin' where id = $1", [ID.admin]);
    for (const id of [ID.s1, ID.s2, ID.s3, ID.s4])
      await q(`insert into auth.users (id, email, raw_app_meta_data) values ($1::uuid, $1::text || '@siswa.invalid', '{"kind":"student"}')`, [id]);
    F.cls = (await q("insert into public.classes (teacher_id, name, mode) values ($1, '6A', 'research') returning id", [ID.teacher])).rows[0].id;
    F.cls2 = (await q("insert into public.classes (teacher_id, name, mode) values ($1, '6B', 'research') returning id", [ID.other])).rows[0].id;
    const mk = async (cls: string, code: string, user: string) =>
      (
        await q(
          `insert into public.students (class_id, student_code, nickname, pin_hash, pseudo_id, auth_user_id, consent_status)
           values ($1, $2, 'Nama' || $2, public.hash_pin('1234'), public.gen_pseudo_id(), $3, 'granted') returning id`,
          [cls, code, user],
        )
      ).rows[0].id as string;
    F.s1 = await mk(F.cls, "S01", ID.s1);
    F.s2 = await mk(F.cls, "S02", ID.s2);
    F.s3 = await mk(F.cls, "S03", ID.s3);
    F.s4 = await mk(F.cls2, "S01", ID.s4);
    items = (await q("select i.id, i.item_order, i.content from public.test_items i join public.tests t on t.id = i.test_id where t.status = 'active' order by item_order")).rows as Item[];

    for (const cls of [[ID.teacher, F.cls], [ID.other, F.cls2]] as const)
      for (const phase of ["pre", "post"]) await db.as(as(cls[0]), (c) => c.query("select public.open_class_test($1, $2)", [cls[1], phase]), commit);
    await takeTest(ID.s1, "pre", 0);
    await takeTest(ID.s1, "post", 1);
    await takeTest(ID.s2, "pre", 2);
    await takeTest(ID.s2, "post", 2);
    await takeTest(ID.s3, "pre", 3); // posttest belum
    await takeTest(ID.s4, "pre", 1);
    await takeTest(ID.s4, "post", 3);
    // S03 kelas lain: mulai posttest tanpa selesai → tidak boleh masuk
    await db.as(as(ID.s3), (c) => c.query("select * from public.start_attempt('post')"), commit);
  }, 120_000);
  afterAll(async () => db?.close());

  const dataset = async (sub: string, cls: string | null) => (await db.as(as(sub), (c) => c.query("select public.analysis_dataset($1) d", [cls]))).rows[0].d as DatasetRpcRow;

  it("guru melihat kelasnya: hanya percobaan selesai, klasifikasi aturan tes, tanpa kunci jawaban", async () => {
    const d = await dataset(ID.teacher, F.cls!);
    expect(d.rule_set_id).toBe("pedoman-v1");
    expect(d.classes).toEqual([{ id: F.cls, name: "6A" }]);
    expect(d.students.map((s) => [s.code, s.pre_submitted, s.post_submitted])).toEqual([
      ["S01", true, true],
      ["S02", true, true],
      ["S03", true, false],
    ]);
    expect(d.responses).toHaveLength(20 * 5);
    const text = JSON.stringify(d);
    expect(text).not.toContain('"correct"');
    expect(text).not.toContain('"content"');
  });

  it("guru lain, siswa, dan tamu ditolak; guru tidak bisa meminta semua kelas", async () => {
    expect((await pgError(dataset(ID.other, F.cls!))).detail).toBe("not_found");
    expect((await pgError(dataset(ID.s1, F.cls!))).detail).toBe("not_found");
    expect((await pgError(dataset(ID.teacher, null))).detail).toBe("forbidden");
    expect((await pgError(db.as({ role: "anon" }, (c) => c.query("select public.analysis_dataset(null)")))).code).toBe("42501");
  });

  it("admin: semua kelas penelitian", async () => {
    const d = await dataset(ID.admin, null);
    expect(d.classes.map((c) => c.name)).toEqual(["6A", "6B"]);
    expect(d.students).toHaveLength(4);
    expect(d.responses).toHaveLength(20 * 7);
  });

  it("hasil RPC → lib/analysis: berpasangan, withdrawn keluar dari ekspor (FR-61)", async () => {
    await db.sql("update public.students set consent_status = 'withdrawn' where id = $1", [F.s2]);
    const ds = datasetFromRpc(await dataset(ID.teacher, F.cls!), stored(), ITEMS);
    expect(ds.items[0]!.code).toBe(ITEMS.items[0]!.item_code);
    const a = analyze(ds, { scoreMethod: "score_sc", transitionMode: "per_butir", taxonomy: "concept_domain" });
    expect(a.participation.paired).toEqual([F.s1]);
    expect(a.participation.excludedByReason).toMatchObject({ consent_withdrawn: 1, post_incomplete: 1 });
    const long = responsesLong(ds);
    expect(long.rows).toHaveLength(20 * 3); // S01 pre+post, S03 pre
    const pseudo = ds.students.find((s) => s.id === F.s2)!.pseudoId;
    expect(long.rows.some((r) => r[0] === pseudo)).toBe(false);
  });

  it("FR-55: ekspor tercatat di audit tanpa data pribadi; guru lain ditolak", async () => {
    await db.as(as(ID.teacher), (c) => c.query("select public.log_export($1, 'csv:responses_long')", [F.cls]), commit);
    await db.as(as(ID.admin), (c) => c.query("select public.log_export(null, 'xlsx')"), commit);
    expect((await pgError(db.as(as(ID.other), (c) => c.query("select public.log_export($1, 'csv')", [F.cls])))).detail).toBe("not_found");
    expect((await pgError(db.as(as(ID.teacher), (c) => c.query("select public.log_export(null, 'csv')")))).detail).toBe("forbidden");
    const rows = (await db.sql("select actor_id, entity_id, meta from public.audit_log where action = 'export' order by created_at")).rows;
    expect(rows).toEqual([
      { actor_id: ID.teacher, entity_id: F.cls, meta: { format: "csv:responses_long" } },
      { actor_id: ID.admin, entity_id: null, meta: { format: "xlsx" } },
    ]);
  });
});
