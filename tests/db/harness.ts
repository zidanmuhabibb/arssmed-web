/**
 * Harness uji basis data: membuat database baru, memasang tiruan Supabase,
 * menjalankan semua migrasi, lalu menyediakan eksekusi "sebagai" peran tertentu.
 * Aktif hanya bila TEST_DATABASE_URL diisi (superuser Postgres ≥ 15).
 */
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const SHIM = join(process.cwd(), "tests/db/supabase-shim.sql");

export interface Db {
  url: string;
  /** Sebagai superuser (melewati RLS). */
  sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>>;
  /**
   * Jalankan `fn` dalam transaksi sebagai peran tertentu. Default di-ROLLBACK
   * sehingga tiap uji terisolasi; `commit: true` untuk menyimpan.
   */
  as<T>(
    who: { role: "anon" | "authenticated" | "service_role"; sub?: string | null },
    fn: (q: pg.ClientBase) => Promise<T>,
    opts?: { commit?: boolean },
  ): Promise<T>;
  close(): Promise<void>;
}

export async function createTestDb(): Promise<Db> {
  if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL belum diisi");
  const name = `arssmed_test_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });

  await pool.query(readFileSync(SHIM, "utf8"));
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await pool.query(readFileSync(join(MIGRATIONS, f), "utf8"));
    } catch (e) {
      throw new Error(`Migrasi ${f} gagal: ${(e as Error).message}`);
    }
  }

  return {
    url: url.toString(),
    sql: (text, params) => pool.query(text, params as unknown[]),
    async as(who, fn, opts) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(`set local role ${who.role}`);
        const claims = JSON.stringify(who.sub ? { sub: who.sub, role: who.role } : { role: who.role });
        await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
        const out = await fn(client);
        await client.query(opts?.commit ? "commit" : "rollback");
        return out;
      } catch (e) {
        await client.query("rollback").catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
      const a = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

/** Tangkap galat Postgres sebagai objek agar bisa diperiksa kode/pesannya. */
export async function pgError(p: Promise<unknown>): Promise<{ code?: string; message: string; detail?: string }> {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; message: string; detail?: string };
    return { code: err.code, message: err.message, detail: err.detail };
  }
  throw new Error("Diharapkan galat, tetapi kueri berhasil");
}
