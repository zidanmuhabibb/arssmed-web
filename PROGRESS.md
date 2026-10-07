# PROGRESS.md

## M2 · Data dan autentikasi — selesai (8 Oktober 2026)

### Selesai
- **Migrasi Supabase** (`supabase/migrations/`): seluruh tabel PRD §10 + `student_login_attempts`; RLS aktif di semua tabel dengan fungsi bantu (`is_admin`, `teaches_class`, `current_student_id`, …); hak kolom (`pin_hash` tidak terbaca klien); fungsi `create_students`, `reset_student_pin`, `set_consent`, `student_login` (bcrypt + batas 5/10 menit), `link_student_auth_user`; pemicu profil guru otomatis, audit perubahan jawaban (FR-33), pembekuan butir (FR-38), audit hapus siswa tanpa data pribadi.
- **Seed lokal** (`supabase/seed.sql`): guru `guru@contoh.id`, peneliti (admin) `peneliti@contoh.id` (sandi `rahasia123`), kelas 6A kode `K7M2QX`, siswa S01/1234 dan S02/5678.
- **Masuk siswa** `/masuk` + `POST /api/auth/siswa`: tiga isian besar, PIN numerik, pesan tanpa kata "salah", batas percobaan dengan waktu tunggu.
- **Masuk guru** `/guru/masuk` (email + sandi), keluar dari area siswa dan guru (navigasi penuh, D-030).
- **Dasbor guru**: `/guru/kelas` (daftar kelas milik guru, buat kelas: nama, tahun ajaran, "Belajar saja"/"Ikut penelitian"), `/guru/kelas/[id]` (kode kelas besar, daftar siswa responsif, status persetujuan FR-60, PIN baru, hapus dengan konfirmasi, impor CSV/tempel dengan pratinjau dan galat per baris, unduh kartu masuk PDF).
- **Pustaka murni + test**: `lib/students/csv.ts` (titik koma/koma/tab, BOM, kutip, judul kolom fleksibel, peringatan nama lengkap), `lib/cards/pdf.ts` (A4, 8 kartu/halaman), `lib/backend/student-login.ts` (orkestrasi masuk, termasuk balapan pembuatan akun).
- **Status akun** di bilah atas/rel siswa ("Halo, Raka" + Keluar).

### Hasil verifikasi
| Pemeriksaan | Hasil |
|---|---|
| `pnpm lint` / `pnpm typecheck` | lulus |
| `pnpm test` (dengan `TEST_DATABASE_URL`, Postgres 16 lokal) | 423/423 lulus (44 uji DB: RLS, fungsi, seed) |
| `pnpm e2e` (backend memori; Pixel 5, iPhone 13*, desktop) | 102/102 lulus — masuk/keluar siswa & guru, batas percobaan, kartu siswa ditolak di area guru, buat kelas → impor → PDF → siswa baru masuk, persetujuan/PIN baru/hapus, guru lain tidak bisa membuka kelas, axe, tanpa geser horizontal |
| Lighthouse mobile | Beranda: Performance 86, Accessibility 100 · `/masuk`: 91 / 100 |
| JS awal Beranda | 156 KB (≤ 200 KB) |

### Belum diuji (butuh Docker di komputer Anda)
- `pnpm db:start` + `pnpm db:reset` dengan Supabase sungguhan: migrasi di Postgres 17 Supabase, pemicu pada `auth.users`, dan alur masuk siswa (`admin.createUser` → `generateLink` → `verifyOtp`). Langkah uji ada di README.
- Masuk guru lewat Supabase Auth sungguhan.

### Catatan
- Butir tes belum dimuat ke tabel `tests/test_items` (M6, dari `data/items.json`).
- Sesi siswa memakai bawaan Supabase (token 1 jam + refresh). Untuk perangkat bersama, pertimbangkan sesi lebih pendek di M6.

---

## M1.1 · Impor instrumen peneliti — selesai (8 Oktober 2026)

- `scripts/import_instrument.py` membaca .docx instrumen → `data/items.json` (20 butir), `data/rule-sets/pedoman-v1.json` (tabel D.2), `tests/fixtures/pedoman-examples.json` (D.3). Pemeriksaan bawaan: 20 butir, opsi A–D, skala Yakin/Tidak yakin, kunci rinci = ringkasan.
- Mesin klasifikasi mendukung aturan `per_tier` (16 kombinasi A × CA × R × CR) dan kebijakan tier kosong (`incomplete_category`).
- `data/analysis.json`: rule set `pedoman-v1`, skor `score_sc`, transisi `per_butir`, domain kisi-kisi.
- Test: 354/354 lulus (16 baris D.2, 5 contoh D.3, tier kosong → E, 64 kombinasi × 20 butir, kunci vs ringkasan, konsistensi domain).

### Terjawab dari dokumen instrumen (PRD §16.1)
| # | Pertanyaan | Jawaban |
|---|---|---|
| 1 | Domain kisi-kisi vs pelaporan | Pakai 4 domain kisi-kisi untuk keduanya (D.5) |
| 2 | Butir per domain | 5 butir per domain |
| 3 | Aturan klasifikasi | Tabel D.2 → `pedoman-v1` |
| 4 | Definisi skor | `score_sc` (D.4) |
| 5 | Format tier | Four-tier baku, keyakinan jawaban & alasan terpisah |

### Masih terbuka
- **Validasi instrumen:** dokumen berstatus draf (bukan instrumen tervalidasi artikel). Ubah `source.status` ke `validated` setelah validasi ahli + uji reliabilitas.
- **Pemetaan pengecoh → kode miskonsepsi per opsi** (untuk Peta Butir FR-43): perlu konfirmasi peneliti.
- #6–#8 (aset 3D asli, izin etik, data residency) belum tersentuh.

---

## M1 · Pustaka inti — selesai (7 Oktober 2026)

### Rencana M1
1. `/lib/classification`: skema butir (Zod), aturan berversi sebagai JSON, `classifyResponse`, uji aturan semua kombinasi (FR-54), skor `score_sc`/`score_tier1`, distribusi per domain, seleksi siswa berpasangan.
2. `/lib/transitions`: kategori dominan (modus + pemecah seri konservatif) dan per butir, pola Retensi/Revisi/Konstruksi/Statis/Lainnya, invarian.
3. `/lib/stats`: N-Gain + kategori, CI-t, uji-t berpasangan, Wilcoxon, Shapiro-Wilk, d_z/Hedges g_z, KR-20.
4. Fixture artikel + verifikasi silang SciPy pada dataset sintetis.

### Selesai
- **Klasifikasi** (`lib/classification`): 8 kombinasi default, variasi ambang 2/3/4 level, format baku dan modifikasi, tiga mode keyakinan, respons tidak lengkap/tidak valid, validasi rule set (lengkap & saling lepas), aturan alternatif tanpa ubah kode, uji aturan 18/36 kombinasi, versi butir siswa tanpa kunci.
- **Data peneliti** (`data/`): `items.json` kosong berskema (`ItemsFile`), `rule-sets/default-v1.json`, README. Divalidasi di `pnpm test`; bila diisi, wajib 20 butir berurutan.
- **Transisi** (`lib/transitions`): matriks pre→post berisi daftar unit (untuk diagram alur), hitungan pola, pengecualian beralasan.
- **Statistik** (`lib/stats`): semua fungsi PRD §7.1, tanpa dependensi luar.
- **Verifikasi:** `tests/fixtures/generate_scipy_reference.py` → `scipy-reference.json` (SciPy 1.18.1). Dataset: n = 36 (skor kelipatan 5, banyak seri), n = 10 (Wilcoxon eksak), n = 12 (seri + nol → permutasi), n = 60 (asimtotik); Shapiro n = 3…400; kuantil/CDF t dan normal; KR-20; N-Gain dengan pre = 100.
- **Invarian** pada 4 dataset acak (36 siswa × 20 butir × 4 domain): Σ pola = unit, Σ kategori = penyebut.
- **Kemurnian**: test memastikan tiga pustaka inti tidak mengimpor React/Next/Supabase atau menyentuh jaringan/DOM.

### Hasil verifikasi
| Pemeriksaan | Hasil |
|---|---|
| `pnpm lint` / `pnpm typecheck` | lulus |
| `pnpm test` | 312/312 lulus (M0: 69) |
| Fixture artikel `meanCI(54,71; 21,80; 36)` | [47,33; 62,09] — dalam ±0,05 dari [47,34; 62,09] |
| Silang SciPy | t-test, Wilcoxon (eksak/permutasi/asimtotik), Shapiro, distribusi, KR-20, CI N-Gain: semua cocok (toleransi relatif ≤ 1e-6) |
| `pnpm e2e` | 69/69 lulus (tidak ada regresi UI) |

### Perlu keputusan peneliti sebelum data nyata (PRD §16.1)
- **#3 Aturan klasifikasi resmi**: `default-v1` masih asumsi. Kirim tabel Lampiran 4 → saya buat `pedoman-v1.json` + test 8 kombinasinya.
- **#4 Definisi skor**: default `score_sc`; `score_tier1` tersedia sebagai pembanding.
- **#5 Tier kedua modifikasi**: "yakin" saat ini = keyakinan atas alasan. Bila artikel memakai satu keyakinan untuk jawaban+alasan, cukup ganti `confidence_mode`.
- **#1/#2 Domain**: setiap butir menyimpan `concept_domain` dan `report_domain`; isi di `data/items.json`.

### Cara memperbarui rujukan SciPy
```bash
pip install scipy numpy
pnpm stats:reference   # menulis ulang tests/fixtures/scipy-reference.json
pnpm test
```

---

## M0 · Fondasi — selesai (7 Oktober 2026)

### Rencana M0 (10 baris)
1. Scaffold Next.js 16 App Router + TypeScript strict + pnpm.
2. Tailwind v4; token desain PRD §8.2 sebagai variabel CSS (terang + gelap), Viewer selalu gelap.
3. Font Baloo 2 (judul) + Lexend (isi) self-host via @fontsource; dasar 18 px.
4. next-intl dengan lokal tunggal `id`; semua teks di `messages/id.json`.
5. App shell: tab bawah (Belajar, Tes, Panduan) di mobile, rel kiri ≥ 1024 px.
6. Beranda (FR-01): sapaan, "Mulai belajar", Panduan, Profil pembuat, slot "Kerjakan tes".
7. Halaman rintisan untuk rute PRD §11 dengan state kosong yang mengajak bertindak.
8. PWA: manifest, ikon, service worker Serwist, halaman offline.
9. Supabase lokal (config, folder migrasi, .env.example); CI GitHub Actions (lint, typecheck, test, e2e).
10. Vitest + Playwright (Pixel 5, iPhone 13, desktop) + axe; verifikasi 360/768/1280.

### Selesai
- Next.js 16.4 (cacheComponents + partial prefetching), TS strict, Tailwind 4.3, ESLint (0 peringatan).
- Token desain di `app/globals.css` + salinan TS `lib/design/tokens.ts`, disinkronkan oleh test. Mode gelap (sistem dan `data-theme`). Mode Kelas/teks besar disiapkan via `data-mode="kelas"` / `data-text="besar"` (20 px).
- Font self-host (Baloo 2 700/800, Lexend variable), tanpa permintaan ke Google Fonts.
- i18n `id` (next-intl); tidak ada teks UI di komponen.
- App shell: bilah atas + tab bawah (mobile/tablet), rel kiri (≥ 1024 px), tautan "Langsung ke isi", area sentuh ≥ 48 px.
- Beranda dengan panggung orbit statis (8 planet berwarna khas, label "Ukuran dan jarak tidak sesuai skala"), tombol "Mulai belajar", daftar Lainnya. Tombol "Kerjakan tes" tersembunyi sampai status tes tersedia (M6).
- Halaman: `/belajar` (6 unit), `/belajar/[unit]` (rintisan), `/tes` (pesan tes belum dibuka), `/panduan` (4 langkah), `/materi`, `/pembuat`, `/privasi`, `/masuk` (rintisan), `/offline`, 404 berbahasa Indonesia.
- PWA: `manifest.webmanifest`, ikon 192/512/maskable/apple-touch/SVG, service worker (`scripts/build-sw.mjs`), fallback offline teruji.
- Header keamanan dasar (nosniff, Referrer-Policy, Permissions-Policy kamera self, X-Frame-Options DENY, tanpa X-Powered-By).
- Supabase: `supabase/config.toml`, `migrations/`, `seed.sql`, `.env.example`, skrip `db:*`.
- `assets/manifest.json` + skema Zod (lisensi/sumber/atribusi wajib) dan test.
- CI: `.github/workflows/ci.yml` (lint → typecheck → unit → e2e Chromium + WebKit).

### Hasil verifikasi
| Pemeriksaan | Hasil |
|---|---|
| `pnpm lint` | lulus (0 galat, 0 peringatan) |
| `pnpm typecheck` | lulus |
| `pnpm test` (Vitest) | 69/69 lulus — navigasi, kontras token, sinkron token, skema manifest aset, kualitas teks |
| `pnpm e2e` (Playwright: Pixel 5, iPhone 13*, desktop 1280) | 69/69 lulus — termasuk axe WCAG 2.1 AA terang & gelap, tanpa error console, tanpa geser horizontal, SW offline |
| Lighthouse mobile, Beranda | Performance 89, Accessibility 100, Best Practices 100, SEO 100 (FCP 1,4 s, LCP 2,5 s, TBT 370 ms, CLS 0,039) |
| JS awal Beranda | 155 KB (transfer, gzip) ≤ 200 KB |
| Tangkapan layar 360 / 768 / 1280, terang & gelap | diperiksa manual |

\* iPhone 13 diemulasikan di Chromium di lingkungan agen (DECISIONS D-011); WebKit dijalankan di CI.

### Belum / catatan untuk milestone berikut
- `supabase start` belum diuji: daemon Docker tidak tersedia di lingkungan agen (D-008). Jalankan di mesin lokal sebelum M2.
- CLS 0,039 berasal dari pergantian font judul. Kandidat perbaikan: preload Baloo 2 800 atau `size-adjust` pada font cadangan.
- TBT 370 ms: tinjau ulang setelah Viewer 3D (M3) — Lighthouse Viewer juga harus ≥ 85/95.
- Belum ada CSP penuh (M8, setelah sumber aset dan Supabase pasti).
- Halaman Identitas materi, Profil pembuat (institusi, pembimbing), dan Privasi menunggu isi dari peneliti (D-012).
- Pertanyaan terbuka PRD §16.1 belum disentuh; relevan mulai M1 (aturan klasifikasi, definisi skor).

### Cara menjalankan
```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm check          # lint + typecheck + unit test
pnpm e2e            # build produksi + Playwright
pnpm db:start       # Supabase lokal (butuh Docker)
```
