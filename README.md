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

## Konten belajar (M4)

- Isi ilmiah dan soal "Tebak dulu" ada di `content/celestial.json` dan `content/learning.json`; profil pembuat di `content/profile.json`.
- Setelah mengubah konten, jalankan `pnpm content:sql` agar migrasi konten Supabase ikut diperbarui (test akan gagal bila lupa).
- Coba alur belajar: masuk sebagai siswa contoh (kode kelas `K7M2QX`, siswa `S01`, PIN `1234`), buka **Belajar → Unit 1 → Mulai: Tebak dulu**.

## Model AR (M5)

- `pnpm assets:build` membangun ulang `public/models/*.glb` dan `*.usdz` dari konten (jalankan setelah mengubah `content/celestial.json` atau tekstur), lalu `pnpm content:sql`.
- AR hanya berjalan dari alamat **HTTPS** di HP (Android Chrome → Scene Viewer, iPhone Safari → Quick Look). Untuk uji, deploy ke Vercel atau layanan HTTPS lain.

## Tes diagnostik (M6)

- Bank soal: `data/items.json` → `pnpm seed:items` (menulis migrasi `supabase/migrations/*_items.sql`).
- Coba dengan backend memori: masuk sebagai guru (`guru@contoh.id` / `rahasia123`) → kelas 6A → **Buka tes** pada Tes awal; lalu masuk sebagai siswa `K7M2QX` / `S01` / `1234` → **Kerjakan tes**.
