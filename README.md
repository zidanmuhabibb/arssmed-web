# ARSSMED Web

PWA pembelajaran tata surya kelas VI berbasis 3D/AR dengan asesmen diagnostik four-tier.
Status per milestone: `PROGRESS.md`. Keputusan teknis: `DECISIONS.md`. Data peneliti: `data/README.md`.

## Menjalankan cepat (tanpa Supabase, data contoh di memori)

```bash
pnpm install
# Windows PowerShell:  $env:ARSSMED_BACKEND="memory"; pnpm dev
ARSSMED_BACKEND=memory pnpm dev
```
- Siswa: http://localhost:3000/masuk — kode kelas `K7M2QX`, kode siswa `S01`, PIN `1234`
- Guru: http://localhost:3000/guru/masuk — `guru@contoh.id` / `rahasia123`

Data hilang setiap server dimatikan. Hanya untuk mencoba tampilan.

## Menjalankan dengan Supabase lokal (butuh Docker Desktop)

```bash
pnpm db:start          # menyalakan Supabase lokal, menampilkan URL dan kunci
cp .env.example .env.local   # isi NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
pnpm db:reset          # menjalankan migrasi + seed (akun contoh sama seperti di atas)
pnpm dev
```
Uji yang perlu dilakukan: masuk sebagai guru, buat kelas, impor siswa, unduh kartu, lalu masuk sebagai siswa dengan kartu itu.

## Pemeriksaan

```bash
pnpm check     # lint + typecheck + unit test
pnpm test:db   # uji migrasi/RLS — butuh TEST_DATABASE_URL (Postgres superuser)
pnpm e2e       # Playwright (Pixel 5, iPhone 13, desktop) + axe, memakai backend memori
pnpm build     # service worker + build produksi
```
