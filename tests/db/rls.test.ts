/**
 * Uji RLS dan fungsi basis data (PRD §14 "Integrasi": siswa lain, guru kelas lain,
 * kunci jawaban tidak bocor). Berjalan bila TEST_DATABASE_URL diisi.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, pgError, TEST_DATABASE_URL, type Db } from "./harness";

const run = TEST_DATABASE_URL ? describe : describe.skip;

const ID = {
  teacher1: "11111111-0000-0000-0000-000000000001",
  teacher2: "11111111-0000-0000-0000-000000000002",
  admin: "11111111-0000-0000-0000-000000000003",
  studentUserA1: "22222222-0000-0000-0000-0000000000a1",
  studentUserA2: "22222222-0000-0000-0000-0000000000a2",
  studentUserB1: "22222222-0000-0000-0000-0000000000b1",
};

let db: Db;
const F: Record<string, string> = {};

const anon = { role: "anon" as const };
const authed = (sub: string) => ({ role: "authenticated" as const, sub });
const service = { role: "service_role" as const };

run("basis data: RLS dan fungsi", () => {
  beforeAll(async () => {
    db = await createTestDb();
    const q = db.sql;
    // Akun Auth: guru (memicu profil otomatis), admin, siswa (tanpa profil)
    for (const [id, email] of [
      [ID.teacher1, "guru1@contoh.id"],
      [ID.teacher2, "guru2@contoh.id"],
      [ID.admin, "admin@contoh.id"],
    ]) {
      await q("insert into auth.users (id, email) values ($1, $2)", [id, email]);
    }
    await q("update public.profiles set role = 'admin' where id = $1", [ID.admin]);
    for (const id of [ID.studentUserA1, ID.studentUserA2, ID.studentUserB1]) {
      await q(`insert into auth.users (id, email, raw_app_meta_data) values ($1::uuid, $1::text || '@siswa.invalid', '{"kind":"student"}')`, [id]);
    }
    F.school = (await q("insert into public.schools (name) values ('SD Uji') returning id")).rows[0].id;
    F.classA = (await q("insert into public.classes (school_id, teacher_id, name) values ($1, $2, '6A') returning id", [F.school, ID.teacher1])).rows[0].id;
    F.classB = (await q("insert into public.classes (school_id, teacher_id, name) values ($1, $2, '6B') returning id", [F.school, ID.teacher2])).rows[0].id;
    F.joinA = (await q("select join_code from public.classes where id = $1", [F.classA])).rows[0].join_code;

    const mk = async (cls: string, code: string, pin: string, user: string | null) =>
      (
        await q(
          `insert into public.students (class_id, student_code, nickname, pin_hash, pseudo_id, auth_user_id, consent_status)
           values ($1, $2, $3, public.hash_pin($4), public.gen_pseudo_id(), $5, 'granted') returning id`,
          [cls, code, `Anak ${code}`, pin, user],
        )
      ).rows[0].id as string;
    F.A1 = await mk(F.classA, "A01", "1234", ID.studentUserA1);
    F.A2 = await mk(F.classA, "A02", "5678", ID.studentUserA2);
    F.B1 = await mk(F.classB, "B01", "4321", ID.studentUserB1);

    F.rules = (await q(`insert into public.rule_sets (rule_set_id, name, kind, rules, is_default) values ('pedoman-v1', 'Pedoman', 'per_tier', '[]', true) returning id`)).rows[0].id;
    F.test = (await q("insert into public.tests (name, rule_set_id) values ('Tes tata surya', $1) returning id", [F.rules])).rows[0].id;
    F.item = (
      await q(
        `insert into public.test_items (test_id, item_order, content, concept_domain, report_domain)
         values ($1, 1, '{"tier1":{"correct":"C"},"reason":{"correct":"B"}}', 'benda_langit', 'benda_langit') returning id`,
        [F.test],
      )
    ).rows[0].id;
    F.ctA = (await q("insert into public.class_tests (class_id, test_id, phase, status) values ($1, $2, 'pre', 'open') returning id", [F.classA, F.test])).rows[0].id;
    F.ctB = (await q("insert into public.class_tests (class_id, test_id, phase, status) values ($1, $2, 'pre', 'open') returning id", [F.classB, F.test])).rows[0].id;
    for (const [s, ct] of [[F.A1, F.ctA], [F.B1, F.ctB]] as const) {
      const att = (await q("insert into public.test_attempts (student_id, class_test_id) values ($1, $2) returning id", [s, ct])).rows[0].id;
      const resp = (await q("insert into public.item_responses (attempt_id, item_id, tier1_key, reason_key, confidence_a, confidence_r) values ($1, $2, 'C', 'B', 0, 0) returning id", [att, F.item])).rows[0].id;
      await q("insert into public.classifications (item_response_id, rule_set_id, a_correct, r_correct, confident, category) values ($1, $2, true, true, true, 'SC')", [resp, F.rules]);
      F[`resp_${s}`] = resp;
    }
    F.unit = (await q("select id from public.units where slug = 'u1'")).rows[0].id;
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  describe("struktur", () => {
    it("RLS aktif di semua tabel public", async () => {
      const r = await db.sql("select tablename from pg_tables where schemaname = 'public' and not rowsecurity");
      expect(r.rows).toEqual([]);
    });
    it("semua fungsi SECURITY DEFINER mengunci search_path", async () => {
      const r = await db.sql(
        "select proname from pg_proc where prosecdef and pronamespace = 'public'::regnamespace and not coalesce(array_to_string(proconfig, ',') like '%search_path=%', false)",
      );
      expect(r.rows).toEqual([]);
    });
    it("fungsi sensitif tidak bisa dieksekusi anon/authenticated", async () => {
      const r = await db.sql(`
        select p.proname, r.rolname from pg_proc p cross join (values ('anon'), ('authenticated')) r(rolname)
        where p.pronamespace = 'public'::regnamespace
          and p.proname in ('student_login', 'link_student_auth_user', 'hash_pin', 'write_audit', 'purge_login_attempts')
          and has_function_privilege(r.rolname, p.oid, 'execute')`);
      expect(r.rows).toEqual([]);
    });
    it("akun guru otomatis mendapat profil; akun siswa tidak", async () => {
      const r = await db.sql("select id, role from public.profiles order by id");
      expect(r.rows.map((x) => x.id)).toEqual([ID.teacher1, ID.teacher2, ID.admin]);
    });
    it("kode kelas 6 karakter tanpa huruf/angka yang mudah tertukar", async () => {
      expect(F.joinA).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    });
  });

  describe("anon", () => {
    it("tidak bisa membaca data siswa, kelas, atau tes", async () => {
      for (const t of ["students", "classes", "test_items", "item_responses", "classifications"]) {
        const e = await pgError(db.as(anon, (c) => c.query(`select * from public.${t}`)));
        expect(e.code, t).toBe("42501");
      }
    });
    it("bisa membaca konten belajar publik", async () => {
      const r = await db.as(anon, (c) => c.query("select slug from public.units order by sort_order"));
      expect(r.rows.map((x) => x.slug)).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    });
    it("tidak bisa memanggil student_login atau create_students", async () => {
      expect((await pgError(db.as(anon, (c) => c.query("select * from public.student_login('X','Y','1234')")))).code).toBe("42501");
      expect((await pgError(db.as(anon, (c) => c.query("select * from public.create_students($1, '[{}]')", [F.classA])))).code).toBe("42501");
    });
  });

  describe("siswa A1", () => {
    const me = authed(ID.studentUserA1);

    it("hanya melihat baris dirinya sendiri", async () => {
      const r = await db.as(me, (c) => c.query("select id, student_code from public.students"));
      expect(r.rows).toEqual([{ id: F.A1, student_code: "A01" }]);
    });
    it("tidak bisa membaca pin_hash maupun auth_user_id", async () => {
      expect((await pgError(db.as(me, (c) => c.query("select pin_hash from public.students")))).code).toBe("42501");
      expect((await pgError(db.as(me, (c) => c.query("select auth_user_id from public.students")))).code).toBe("42501");
    });
    it("hanya melihat kelasnya", async () => {
      const r = await db.as(me, (c) => c.query("select id from public.classes"));
      expect(r.rows).toEqual([{ id: F.classA }]);
    });
    it("tidak bisa membaca butir tes (kunci jawaban) — PRD §9.2 prinsip 4", async () => {
      const r = await db.as(me, (c) => c.query("select * from public.test_items"));
      expect(r.rows).toEqual([]);
      const t = await db.as(me, (c) => c.query("select * from public.rule_sets"));
      expect(t.rows).toEqual([]);
    });
    it("melihat status tes kelasnya saja", async () => {
      const r = await db.as(me, (c) => c.query("select id from public.class_tests"));
      expect(r.rows).toEqual([{ id: F.ctA }]);
    });
    it("melihat jawabannya sendiri, bukan milik siswa kelas lain", async () => {
      const r = await db.as(me, (c) => c.query("select id from public.item_responses"));
      expect(r.rows).toEqual([{ id: F[`resp_${F.A1}`] }]);
    });
    it("tidak melihat hasil klasifikasi (FR-36)", async () => {
      const r = await db.as(me, (c) => c.query("select * from public.classifications"));
      expect(r.rows).toEqual([]);
    });
    it("tidak bisa menulis jawaban/klasifikasi langsung", async () => {
      const e = await pgError(db.as(me, (c) => c.query("update public.item_responses set tier1_key = 'A'")));
      expect(e.code).toBe("42501");
    });
    it("tidak bisa menulis kemajuan belajar langsung (wajib lewat fungsi, M4)", async () => {
      for (const sql of [
        "insert into public.unit_progress (student_id, unit_id, step) values ($1, $2, 'tebak')",
        "insert into public.discussion_marks (student_id, unit_id) values ($1, $2)",
      ]) {
        const e = await pgError(db.as(me, (c) => c.query(sql, [F.A1, F.unit])));
        expect(e.code).toBe("42501");
      }
    });
    it("tidak bisa mengubah status persetujuannya sendiri (FR-60)", async () => {
      const e = await pgError(db.as(me, (c) => c.query("update public.students set consent_status = 'granted'")));
      expect(e.code).toBe("42501");
      const f = await pgError(db.as(me, (c) => c.query("select public.set_consent($1, 'granted')", [F.A1])));
      expect(f.detail).toBe("not_found");
    });
    it("tidak bisa membuat siswa", async () => {
      const e = await pgError(db.as(me, (c) => c.query("select * from public.create_students($1, '[{}]')", [F.classA])));
      expect(e.detail).toBe("forbidden");
    });
  });

  describe("guru 1 (kelas 6A)", () => {
    const t1 = authed(ID.teacher1);

    it("melihat siswa kelasnya saja", async () => {
      const r = await db.as(t1, (c) => c.query("select student_code from public.students order by 1"));
      expect(r.rows.map((x) => x.student_code)).toEqual(["A01", "A02"]);
    });
    it("melihat klasifikasi kelasnya saja", async () => {
      const r = await db.as(t1, (c) => c.query("select item_response_id from public.classifications"));
      expect(r.rows).toEqual([{ item_response_id: F[`resp_${F.A1}`] }]);
    });
    it("tetap tidak bisa membaca pin_hash", async () => {
      expect((await pgError(db.as(t1, (c) => c.query("select pin_hash from public.students")))).code).toBe("42501");
    });
    it("membuat siswa: kode otomatis, PIN 4 digit, hash bcrypt, pseudo_id unik", async () => {
      const out = await db.as(t1, async (c) => {
        const r = await c.query(
          `select * from public.create_students($1, '[{"nickname":"Raka"},{"code":"x-07","nickname":" Sinta "},{}]')`,
          [F.classA],
        );
        const h = await db.sql("select student_code, pin_hash, pseudo_id from public.students where class_id = $1", [F.classA]);
        return { rows: r.rows, inDb: h.rows };
      });
      expect(out.rows.map((r) => [r.student_code, r.nickname])).toEqual([
        ["S01", "Raka"],
        ["X-07", "Sinta"],
        ["S02", null],
      ]);
      for (const r of out.rows) expect(r.pin).toMatch(/^[0-9]{4}$/);
      // Tersimpan sebagai hash, bukan teks PIN (dibaca superuser di luar transaksi: tidak terlihat karena rollback)
      expect(out.inDb.every((r) => !/^[0-9]{4}$/.test(r.pin_hash))).toBe(true);
    });
    it("menolak kode ganda (di daftar maupun yang sudah ada)", async () => {
      const dup = await pgError(db.as(t1, (c) => c.query(`select * from public.create_students($1, '[{"code":"A01"}]')`, [F.classA])));
      expect(dup.detail).toBe("duplicate_code");
      expect(dup.message).toContain("A01");
      const dup2 = await pgError(db.as(t1, (c) => c.query(`select * from public.create_students($1, '[{"code":"Z1"},{"code":"z1"}]')`, [F.classA])));
      expect(dup2.detail).toBe("duplicate_code");
    });
    it("menolak kode tidak valid dan daftar kosong", async () => {
      expect((await pgError(db.as(t1, (c) => c.query(`select * from public.create_students($1, '[{"code":"A 1"}]')`, [F.classA])))).detail).toBe("invalid_code");
      expect((await pgError(db.as(t1, (c) => c.query(`select * from public.create_students($1, '[]')`, [F.classA])))).detail).toBe("empty");
    });
    it("tidak bisa membuat siswa di kelas guru lain", async () => {
      const e = await pgError(db.as(t1, (c) => c.query(`select * from public.create_students($1, '[{}]')`, [F.classB])));
      expect(e.detail).toBe("forbidden");
    });
    it("mencatat persetujuan dan reset PIN siswa kelasnya", async () => {
      await db.as(t1, async (c) => {
        await c.query("select public.set_consent($1, 'withdrawn')", [F.A2]);
        const r = await c.query("select consent_status, consent_recorded_by, withdrawn_at is not null as w from public.students where id = $1", [F.A2]);
        expect(r.rows[0]).toEqual({ consent_status: "withdrawn", consent_recorded_by: ID.teacher1, w: true });
        const pin = (await c.query("select public.reset_student_pin($1) as pin", [F.A2])).rows[0].pin;
        expect(pin).toMatch(/^[0-9]{4}$/);
      });
      expect((await pgError(db.as(t1, (c) => c.query("select public.reset_student_pin($1)", [F.B1])))).detail).toBe("not_found");
    });
    it("tidak bisa memindahkan kelas ke guru lain atau membuat kelas atas nama guru lain", async () => {
      expect((await pgError(db.as(t1, (c) => c.query("update public.classes set teacher_id = $1", [ID.teacher2])))).code).toBe("42501");
      expect(
        (await pgError(db.as(t1, (c) => c.query("insert into public.classes (teacher_id, name) values ($1, 'Curian')", [ID.teacher2])))).code,
      ).toBe("42501");
    });
    it("bisa membuat kelas sendiri dengan kode kelas otomatis", async () => {
      const r = await db.as(t1, (c) => c.query("insert into public.classes (teacher_id, name) values ($1, '6C') returning join_code, mode", [ID.teacher1]));
      expect(r.rows[0].mode).toBe("learn_only");
      expect(r.rows[0].join_code).toHaveLength(6);
    });
    it("tidak bisa mengubah bank soal atau membaca log audit", async () => {
      const upd = await db.as(t1, (c) => c.query("update public.test_items set concept_domain = 'x'"));
      expect(upd.rowCount).toBe(0); // RLS: baris tidak terlihat untuk ditulis
      const ins = await pgError(
        db.as(t1, (c) => c.query("insert into public.test_items (test_id, item_order, content, concept_domain, report_domain) values ($1, 9, '{}', 'a', 'a')", [F.test])),
      );
      expect(ins.code).toBe("42501");
      const r = await db.as(t1, (c) => c.query("select * from public.audit_log"));
      expect(r.rows).toEqual([]);
    });
  });

  describe("guru 2", () => {
    it("tidak melihat siswa atau jawaban kelas 6A", async () => {
      const t2 = authed(ID.teacher2);
      const s = await db.as(t2, (c) => c.query("select student_code from public.students"));
      expect(s.rows).toEqual([{ student_code: "B01" }]);
      const r = await db.as(t2, (c) => c.query("select id from public.item_responses"));
      expect(r.rows).toEqual([{ id: F[`resp_${F.B1}`] }]);
    });
  });

  describe("admin", () => {
    it("melihat semua kelas dan siswa, serta bisa membuat siswa di kelas mana pun", async () => {
      const a = authed(ID.admin);
      const c = await db.as(a, (c) => c.query("select count(*)::int as n from public.classes"));
      expect(c.rows[0].n).toBe(2);
      const s = await db.as(a, (c) => c.query("select count(*)::int as n from public.students"));
      expect(s.rows[0].n).toBe(3);
      const r = await db.as(a, (c) => c.query(`select * from public.create_students($1, '[{}]')`, [F.classB]));
      expect(r.rows).toHaveLength(1);
    });
    it("membaca log audit tanpa data pribadi", async () => {
      await db.as(authed(ID.teacher1), (c) => c.query(`select * from public.create_students($1, '[{"nickname":"Rahasia"}]')`, [F.classA]), { commit: true });
      const r = await db.as(authed(ID.admin), (c) => c.query("select action, meta from public.audit_log"));
      expect(r.rows).toContainEqual({ action: "students.create", meta: { count: 1 } });
      expect(JSON.stringify(r.rows)).not.toContain("Rahasia");
    });
  });

  describe("masuk siswa (student_login)", () => {
    const login = (join: string, code: string, pin: string) =>
      db.as(service, (c) => c.query("select * from public.student_login($1, $2, $3)", [join, code, pin]), { commit: true }).then((r) => r.rows[0]);

    it("tidak bisa dipanggil peran authenticated", async () => {
      expect((await pgError(db.as(authed(ID.studentUserA1), (c) => c.query("select * from public.student_login('A','B','1234')")))).code).toBe("42501");
    });
    it("berhasil dengan kode benar (huruf kecil & spasi diterima)", async () => {
      const r = await login(` ${F.joinA.toLowerCase()} `, "a01", "1234");
      expect(r).toMatchObject({ status: "ok", student_id: F.A1, auth_user_id: ID.studentUserA1 });
    });
    it("PIN salah dan kelas tak dikenal sama-sama 'invalid' (anti-enumerasi)", async () => {
      expect(await login(F.joinA, "A01", "0000")).toMatchObject({ status: "invalid", student_id: null });
      expect(await login("ZZZZZZ", "A01", "1234")).toMatchObject({ status: "invalid", student_id: null });
      expect(await login(F.joinA, "A01", "12a4")).toMatchObject({ status: "invalid" });
    });
    it("dibatasi setelah 5 kegagalan dalam 10 menit, lalu pulih setelah dibersihkan", async () => {
      const code = "B01";
      const join = (await db.sql("select join_code from public.classes where id = $1", [F.classB])).rows[0].join_code;
      for (let i = 0; i < 5; i++) expect((await login(join, code, "9999")).status).toBe("invalid");
      const blocked = await login(join, code, "4321"); // PIN benar pun ditolak saat dibatasi
      expect(blocked.status).toBe("rate_limited");
      expect(blocked.retry_after_seconds).toBeGreaterThan(500);
      expect(blocked.retry_after_seconds).toBeLessThanOrEqual(600);
      // Simulasikan 10 menit berlalu
      await db.sql("update public.student_login_attempts set created_at = created_at - interval '11 minutes' where student_code = $1", [code]);
      expect((await login(join, code, "4321")).status).toBe("ok");
    });
    it("masuk berhasil mengatur ulang hitungan kegagalan", async () => {
      expect((await login(F.joinA, "A01", "1234")).status).toBe("ok");
      for (let i = 0; i < 4; i++) expect((await login(F.joinA, "A01", "0000")).status).toBe("invalid");
      expect((await login(F.joinA, "A01", "1234")).status).toBe("ok");
      for (let i = 0; i < 4; i++) expect((await login(F.joinA, "A01", "0000")).status).toBe("invalid");
    });
    it("link_student_auth_user hanya mengisi bila belum ada", async () => {
      const fresh = (await db.sql(`insert into public.students (class_id, student_code, pin_hash, pseudo_id) values ($1, 'NEW1', public.hash_pin('1111'), public.gen_pseudo_id()) returning id`, [F.classA])).rows[0].id;
      const u = (await db.sql(`insert into auth.users (email, raw_app_meta_data) values ('n@siswa.invalid', '{"kind":"student"}') returning id`)).rows[0].id;
      await db.as(service, (c) => c.query("select public.link_student_auth_user($1, $2)", [fresh, u]), { commit: true });
      await db.as(service, (c) => c.query("select public.link_student_auth_user($1, $2)", [fresh, ID.studentUserB1]), { commit: true });
      const r = await db.sql("select auth_user_id from public.students where id = $1", [fresh]);
      expect(r.rows[0].auth_user_id).toBe(u);
    });
  });

  describe("integritas asesmen", () => {
    it("perubahan jawaban tercatat di response_events dan menambah answer_changes (FR-33)", async () => {
      const id = F[`resp_${F.A1}`];
      await db.sql("update public.item_responses set tier1_key = 'A', confidence_r = 1 where id = $1", [id]);
      const ev = await db.sql("select field, old_value, new_value from public.response_events where item_response_id = $1 order by field", [id]);
      expect(ev.rows).toEqual([
        { field: "confidence_r", old_value: "0", new_value: "1" },
        { field: "tier1_key", old_value: "C", new_value: "A" },
      ]);
      expect((await db.sql("select answer_changes from public.item_responses where id = $1", [id])).rows[0].answer_changes).toBe(1);
    });
    it("butir tes beku tidak bisa diubah (FR-38)", async () => {
      await db.sql("update public.tests set items_frozen = true where id = $1", [F.test]);
      const e = await pgError(db.sql("update public.test_items set concept_domain = 'x' where id = $1", [F.item]));
      expect(e.detail).toBe("items_frozen");
      await db.sql("update public.tests set items_frozen = false where id = $1", [F.test]);
    });
    it("hapus siswa menghapus jawabannya (kaskade) dan dicatat tanpa data pribadi", async () => {
      await db.sql("delete from public.students where id = $1", [F.B1]);
      expect((await db.sql("select count(*)::int n from public.test_attempts where student_id = $1", [F.B1])).rows[0].n).toBe(0);
      const a = await db.sql("select action, meta from public.audit_log where entity_id = $1", [F.B1]);
      expect(a.rows).toEqual([{ action: "student.delete", meta: { class_id: F.classB } }]);
    });
  });
});
