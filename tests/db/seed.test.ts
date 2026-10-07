/** supabase/seed.sql berjalan di atas migrasi dan menghasilkan akun contoh yang bisa masuk. */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, TEST_DATABASE_URL, type Db } from "./harness";

const run = TEST_DATABASE_URL ? describe : describe.skip;
let db: Db;

run("supabase/seed.sql", () => {
  beforeAll(async () => {
    db = await createTestDb();
    await db.sql(readFileSync("supabase/seed.sql", "utf8"));
  }, 60_000);
  afterAll(async () => db?.close());

  it("membuat guru (teacher) dan peneliti (admin)", async () => {
    const r = await db.sql("select u.email, p.role from public.profiles p join auth.users u on u.id = p.id order by 1");
    expect(r.rows).toEqual([
      { email: "guru@contoh.id", role: "teacher" },
      { email: "peneliti@contoh.id", role: "admin" },
    ]);
  });

  it("siswa contoh bisa masuk dengan kartu K7M2QX / S01 / 1234", async () => {
    const r = await db.as({ role: "service_role" }, (c) => c.query("select status from public.student_login('K7M2QX', 'S01', '1234')"));
    expect(r.rows[0].status).toBe("ok");
  });
});
