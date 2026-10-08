/**
 * M6 · Fungsi tes diagnostik di basis data: buka/tutup, persetujuan, simpan idempoten dengan
 * cap waktu klien, audit perubahan, selesai, klasifikasi lewat service role, kunci tidak bocor.
 */
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentItemsSql, ITEMS } from "@/lib/tes/items-sql-data";
import { createTestDb, pgError, TEST_DATABASE_URL, type Db } from "./harness";

const run = TEST_DATABASE_URL ? describe : describe.skip;

describe("migrasi bank soal", () => {
  it("migrasi *_items.sql terakhir sama dengan data/items.json (jalankan `pnpm seed:items`)", () => {
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith("_items.sql")).sort();
    expect(readFileSync(`supabase/migrations/${files.at(-1)}`, "utf8")).toBe(currentItemsSql());
  });
});

const ID = {
  teacher: "55555555-0000-0000-0000-000000000001",
  other: "55555555-0000-0000-0000-000000000002",
  s1: "66666666-0000-0000-0000-000000000001",
  s2: "66666666-0000-0000-0000-000000000002",
  s3: "66666666-0000-0000-0000-000000000003",
};
let db: Db;
const F: Record<string, string> = {};
const as = (sub: string) => ({ role: "authenticated" as const, sub });
const commit = { commit: true };
type Item = { id: string; item_order: number; content: { tier1: { correct: string }; reason: { correct: string } } };
let items: Item[] = [];

async function answerAll(sub: string, attempt: string, from = 0, to = items.length) {
  for (const it of items.slice(from, to)) {
    await db.as(
      as(sub),
      (c) => c.query("select public.save_response($1, $2, $3, 0, $4, 0, '2030-01-01T00:00:00Z', 1500, null)", [attempt, it.id, it.content.tier1.correct, it.content.reason.correct]),
      commit,
    );
  }
}

run("basis data: tes diagnostik (M6)", () => {
  beforeAll(async () => {
    db = await createTestDb();
    const q = db.sql;
    await q("insert into auth.users (id, email) values ($1, 't@contoh.id'), ($2, 'u@contoh.id')", [ID.teacher, ID.other]);
    for (const id of [ID.s1, ID.s2, ID.s3])
      await q(`insert into auth.users (id, email, raw_app_meta_data) values ($1::uuid, $1::text || '@siswa.invalid', '{"kind":"student"}')`, [id]);
    F.research = (await q("insert into public.classes (teacher_id, name, mode) values ($1, '6A', 'research') returning id", [ID.teacher])).rows[0].id;
    F.learn = (await q("insert into public.classes (teacher_id, name, mode) values ($1, '6B', 'learn_only') returning id", [ID.teacher])).rows[0].id;
    const mk = async (cls: string, code: string, user: string, consent: string) =>
      (
        await q(
          `insert into public.students (class_id, student_code, pin_hash, pseudo_id, auth_user_id, consent_status)
           values ($1, $2, public.hash_pin('1234'), public.gen_pseudo_id(), $3, $4) returning id`,
          [cls, code, user, consent],
        )
      ).rows[0].id as string;
    F.s1 = await mk(F.research, "S01", ID.s1, "granted");
    F.s2 = await mk(F.research, "S02", ID.s2, "pending");
    F.s3 = await mk(F.learn, "S01", ID.s3, "granted");
    items = (await q("select i.id, i.item_order, i.content from public.test_items i join public.tests t on t.id = i.test_id where t.status = 'active' order by item_order")).rows as Item[];
  }, 60_000);
  afterAll(async () => db?.close());

  it("bank soal ter-seed: 20 butir aktif, aturan pedoman-v1 bawaan, belum dibekukan", async () => {
    expect(items).toHaveLength(ITEMS.items.length);
    const rs = await db.sql("select rule_set_id from public.rule_sets where is_default");
    expect(rs.rows).toEqual([{ rule_set_id: "pedoman-v1" }]);
    const t = await db.sql("select items_frozen from public.tests where status = 'active'");
    expect(t.rows).toEqual([{ items_frozen: false }]);
  });

  it("tes belum dibuka → siswa ditolak dan tidak ada butir/percobaan (PRD §14)", async () => {
    const e = await pgError(db.as(as(ID.s1), (c) => c.query("select * from public.start_attempt('pre')")));
    expect(e.detail).toBe("closed");
    expect(e.message).toBe("Tes belum dibuka. Tanyakan ke gurumu.");
    expect((await db.sql("select count(*)::int n from public.test_attempts")).rows[0].n).toBe(0);
  });

  it("guru: kelas Belajar saja tidak bisa membuka tes (FR-62); guru lain ditolak", async () => {
    expect((await pgError(db.as(as(ID.teacher), (c) => c.query("select public.open_class_test($1, 'pre')", [F.learn])))).detail).toBe("learn_only");
    expect((await pgError(db.as(as(ID.other), (c) => c.query("select public.open_class_test($1, 'pre')", [F.research])))).detail).toBe("not_found");
    expect((await pgError(db.as(as(ID.s1), (c) => c.query("select public.open_class_test($1, 'pre')", [F.research])))).detail).toBe("not_found");
  });

  it("guru membuka pretest: butir dibekukan (FR-38) dan tercatat di audit", async () => {
    await db.as(as(ID.teacher), (c) => c.query("select public.open_class_test($1, 'pre')", [F.research]), commit);
    expect((await db.sql("select items_frozen from public.tests where status = 'active'")).rows[0].items_frozen).toBe(true);
    const e = await pgError(db.sql("update public.test_items set content = content where item_order = 1"));
    expect(e.detail).toBe("items_frozen");
    expect((await db.sql("select count(*)::int n from public.audit_log where action = 'class_test.open'")).rows[0].n).toBe(1);
  });

  it("FR-60: siswa tanpa persetujuan tidak bisa memulai", async () => {
    expect((await pgError(db.as(as(ID.s2), (c) => c.query("select * from public.start_attempt('pre')")))).detail).toBe("consent");
    const st = (await db.as(as(ID.s2), (c) => c.query("select public.student_tests() s"))).rows[0].s;
    expect(st[0]).toMatchObject({ phase: "pre", status: "open", blocked: "consent_pending", attempt: null });
  });

  it("mulai idempoten; kunci jawaban tidak terbaca siswa", async () => {
    const a = (await db.as(as(ID.s1), (c) => c.query("select * from public.start_attempt('pre', 'android')"), commit)).rows[0];
    const b = (await db.as(as(ID.s1), (c) => c.query("select * from public.start_attempt('pre', 'android')"), commit)).rows[0];
    expect(b.attempt_id).toBe(a.attempt_id);
    expect(a.submitted).toBe(false);
    F.att = a.attempt_id;
    expect((await db.as(as(ID.s1), (c) => c.query("select * from public.test_items"))).rows).toEqual([]);
    expect((await db.sql("select device_kind, total_items from public.test_attempts where id = $1", [F.att])).rows[0]).toEqual({ device_kind: "android", total_items: 20 });
  });

  it("simpan: validasi kunci & skala; jawaban terbaru (cap waktu klien) menang; perubahan diaudit", async () => {
    const it0 = items[0]!;
    const bad = await pgError(db.as(as(ID.s1), (c) => c.query("select public.save_response($1, $2, 'Z', null, null, null, now())", [F.att, it0.id])));
    expect(bad.detail).toBe("invalid_input");
    const bad2 = await pgError(db.as(as(ID.s1), (c) => c.query("select public.save_response($1, $2, 'A', 5, null, null, now())", [F.att, it0.id])));
    expect(bad2.detail).toBe("invalid_input");

    const save = (tier1: string, ts: string) =>
      db.as(as(ID.s1), (c) => c.query("select public.save_response($1, $2, $3, null, null, null, $4::timestamptz) r", [F.att, it0.id, tier1, ts]), commit);
    expect((await save("A", "2026-10-08T10:00:00Z")).rows[0].r).toBe("saved");
    expect((await save("B", "2026-10-08T10:00:05Z")).rows[0].r).toBe("saved");
    // Kiriman lama yang tertunda di antrean tiba belakangan → diabaikan
    expect((await save("C", "2026-10-08T10:00:02Z")).rows[0].r).toBe("stale");
    const r = await db.sql("select tier1_key, answer_changes from public.item_responses where attempt_id = $1 and item_id = $2", [F.att, it0.id]);
    expect(r.rows).toEqual([{ tier1_key: "B", answer_changes: 1 }]);
    const ev = await db.sql("select field, old_value, new_value from public.response_events");
    expect(ev.rows).toEqual([{ field: "tier1_key", old_value: "A", new_value: "B" }]);
    expect((await db.sql("select count(*)::int n from public.item_responses where attempt_id = $1", [F.att])).rows[0].n).toBe(1);
  });

  it("siswa lain tidak bisa menulis ke percobaan ini", async () => {
    const e = await pgError(db.as(as(ID.s3), (c) => c.query("select public.save_response($1, $2, 'A', null, null, null, now())", [F.att, items[0]!.id])));
    expect(e.detail).toBe("not_found");
  });

  it("selesai ditolak bila ada butir belum lengkap; daftar butir dikembalikan", async () => {
    await answerAll(ID.s1, F.att!, 0, 18);
    const r = (await db.as(as(ID.s1), (c) => c.query("select public.submit_attempt($1) r", [F.att]), commit)).rows[0].r;
    expect(r).toEqual({ ok: false, missing: [19, 20] });
    const ov = (await db.as(as(ID.teacher), (c) => c.query("select public.class_test_overview($1) o", [F.research]))).rows[0].o;
    expect(ov[0].students.find((s: { code: string }) => s.code === "S01")).toMatchObject({ started: true, submitted: false, answered: 18 });
  });

  it("selesai → percobaan terkunci; klasifikasi hanya lewat service role; siswa tidak melihat hasil", async () => {
    await answerAll(ID.s1, F.att!, 18, 20);
    const r = (await db.as(as(ID.s1), (c) => c.query("select public.submit_attempt($1) r", [F.att]), commit)).rows[0].r;
    expect(r).toEqual({ ok: true, missing: [] });
    const again = await pgError(db.as(as(ID.s1), (c) => c.query("select public.save_response($1, $2, 'A', null, null, null, now())", [F.att, items[0]!.id])));
    expect(again.detail).toBe("submitted");

    const rows = JSON.stringify(items.map((i) => ({ item_id: i.id, a_correct: true, r_correct: true, confident: true, confident_a: true, confident_r: true, category: "SC" })));
    const denied = await pgError(db.as(as(ID.s1), (c) => c.query("select public.store_classifications($1, 'pedoman-v1', $2)", [F.att, rows])));
    expect(denied.code).toBe("42501");
    const n = (await db.as({ role: "service_role" }, (c) => c.query("select public.store_classifications($1, 'pedoman-v1', $2::jsonb) n", [F.att, rows]), commit)).rows[0].n;
    expect(n).toBe(20);
    // ulang = perbarui, bukan duplikat
    await db.as({ role: "service_role" }, (c) => c.query("select public.store_classifications($1, 'pedoman-v1', $2::jsonb)", [F.att, rows]), commit);
    expect((await db.sql("select count(*)::int n from public.classifications")).rows[0].n).toBe(20);
    expect((await db.as(as(ID.s1), (c) => c.query("select * from public.classifications"))).rows).toEqual([]);
    expect((await db.as(as(ID.teacher), (c) => c.query("select count(*)::int n from public.classifications"))).rows[0].n).toBe(20);
    // setelah selesai, mulai lagi → layar penutup
    expect((await db.as(as(ID.s1), (c) => c.query("select * from public.start_attempt('pre')"))).rows[0].submitted).toBe(true);
  });

  it("tes ditutup: jawaban baru ditolak; posttest memakai versi tes yang sama", async () => {
    await db.as(as(ID.teacher), (c) => c.query("select public.close_class_test($1, 'pre')", [F.research]), commit);
    await db.sql("update public.students set consent_status = 'granted' where id = $1", [F.s2]);
    const e = await pgError(db.as(as(ID.s2), (c) => c.query("select * from public.start_attempt('pre')")));
    expect(e.detail).toBe("closed");
    await db.as(as(ID.teacher), (c) => c.query("select public.open_class_test($1, 'post')", [F.research]), commit);
    const t = await db.sql("select count(distinct test_id)::int n from public.class_tests where class_id = $1", [F.research]);
    expect(t.rows[0].n).toBe(1);
    const ov = (await db.as(as(ID.teacher), (c) => c.query("select public.class_test_overview($1) o", [F.research]))).rows[0].o;
    expect(ov.map((p: { phase: string; status: string }) => [p.phase, p.status])).toEqual([["pre", "closed"], ["post", "open"]]);
    expect(ov[0].total).toBe(20);
  });
});
