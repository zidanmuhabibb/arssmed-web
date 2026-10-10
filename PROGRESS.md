# PROGRESS.md

## M7 · Dasbor dan statistik — selesai (10 Oktober 2026)

### Selesai
- **Pustaka `lib/analysis`** (murni): populasi berpasangan + alasan dikeluarkan, distribusi per domain, peta butir, "yang perlu dibahas", profil siswa, statistik (deskriptif, N-Gain + CI-t, uji-t berpasangan, Wilcoxon, Shapiro–Wilk selisih, d_z/Hedges g_z, KR-20 awal/akhir), transisi per domain (per butir / modus), ekspor `responses_long`, `scores_wide`, `domain_distribution`, `transitions`, `stats`, `README`; CSV dan XLSX (penulis sendiri, D-056).
- **Guru — `/guru/kelas/[id]/hasil`** (tombol "Lihat hasil kelas"): catatan interpretasi (FR-46), siapa dianalisis/dikeluarkan, ringkasan skor & N-Gain, yang perlu dibahas (FR-45), profil konsepsi batang bertumpuk berpola (FR-42), peta butir awal/akhir (FR-43), profil per siswa (FR-44), unduh CSV/XLSX kelasnya.
- **Peneliti — `/riset`** (admin): pilih kelas/semua, metode skor, mode transisi; kartu statistik (FR-51), diagram transisi per domain + tabel + pola dengan invarian (FR-52), distribusi, ekspor CSV/XLSX/JSON (FR-53).
- **API:** `GET /api/riset/statistik?kelas=&skor=&transisi=`, `GET /api/riset/ekspor?format=csv|xlsx|json&tabel=` — hanya kode samaran, tanpa siswa withdrawn/pending (FR-61), tercatat di audit (FR-55).
- **DB:** migrasi `*_analysis.sql` — `analysis_dataset` (guru: kelasnya; admin: semua; tanpa kunci jawaban) dan `log_export`.
- **Dataset sintetis + rujukan independen** (pandas/SciPy) — kriteria M7 (D-058). Backend memori memuat kelas contoh dari dataset ini.

### Hasil verifikasi
| Pemeriksaan | Hasil |
|---|---|
| `pnpm lint` / `pnpm typecheck` | lulus |
| `pnpm test` (dengan DB) | 543/543 lulus — 21 uji kesetaraan dengan rujukan pandas/SciPy (distribusi, peta butir, 2 metode skor, statistik, 2 mode transisi, ekspor, privasi, CSV, XLSX), 5 uji DB analisis (kepemilikan, admin, tanpa kunci, withdrawn, audit ekspor) |
| `pnpm e2e` (Pixel 5, iPhone 13*, desktop) | 201 lulus, 12 dilewati sesuai perangkat (213 total) — termasuk angka layar & API = rujukan, ekspor CSV/XLSX/JSON, akses guru lain/tamu ditolak, axe terang & gelap |

### Belum / catatan
- PDF ringkasan kelas, reklasifikasi dengan aturan lain, editor bank soal/aturan, pemetaan pseudo → nama (admin) → M8.
- Jalur Supabase sungguhan belum diuji end-to-end (fungsi DB diuji di Postgres; aplikasi diuji dengan backend memori).
- Halaman notFound di rute yang dialirkan mengembalikan HTTP 200 dengan isi 404 (perilaku PPR); API mengembalikan 404 yang sebenarnya.

### Perlu dari Anda
- Akun peneliti di Supabase: ubah `profiles.role` menjadi `admin` untuk akun Anda dan pembimbing.
- Tinjau teks "konsepsi alternatif" dan "konsep ilmiah" di `data/items.json` (tampil di kartu Yang perlu dibahas).

---
## M6 · Mesin tes diagnostik — selesai (8 Oktober 2026)

### Selesai
- **Bank soal** `pnpm seed:items`: 20 butir dari `data/items.json` + aturan `pedoman-v1` (bawaan) dan `default-v1` → migrasi `*_items.sql` (diuji sama dengan berkas data).
- **Guru (FR-41):** panel "Tes diagnostik" di halaman kelas — buka/tutup tes awal & akhir dengan konfirmasi, daftar siswa (Belum mulai / Mengerjakan n/20 / Selesai / Belum ada persetujuan), diperbarui tiap 10 detik. Membuka tes membekukan butir (FR-38). Kelas Belajar saja tidak bisa membuka tes (FR-62).
- **Siswa:**
  - `/tes`: status tes awal & akhir; tombol "Kerjakan tes" di Beranda hanya saat tes dibuka (FR-01).
  - `/tes/pre`, `/tes/post`: satu butir per layar, tier bertahap (jawaban → keyakinan → alasan → keyakinan), opsi teracak per siswa, kembali ke butir sebelumnya, periksa jawaban, layar penutup netral tanpa hasil (FR-31…36).
  - Simpan otomatis tiap tier lewat antrean IndexedDB; status tenang; jaringan putus → tetap bisa menjawab, terkirim otomatis saat tersambung (FR-34).
  - Tanpa persetujuan orang tua → tidak bisa memulai (FR-60).
- **API (PRD §11):** `GET /api/tes/[fase]/mulai` (butir tanpa kunci), `PUT /api/tes/attempt/[id]/respons` (idempoten, cap waktu klien terbaru menang), `POST /api/tes/attempt/[id]/selesai` (klasifikasi server).
- **Klasifikasi server** dengan aturan milik tes; disimpan lewat service role; tidak terbaca siswa.

### Hasil verifikasi
| Pemeriksaan | Hasil |
|---|---|
| `pnpm lint` / `pnpm typecheck` | lulus |
| `pnpm test` (dengan DB) | 517/517 lulus — 12 uji DB tes (tertutup, persetujuan, kelas Belajar saja, bekukan butir, validasi, cap waktu klien, audit perubahan, selesai belum lengkap, klasifikasi hanya service role, tutup tes, versi pre=post), antrean luring, acak opsi, butir tanpa kunci |
| `pnpm e2e` (Pixel 5, iPhone 13*, desktop) | 188/188 lulus — **pretest 20 butir selesai dengan jaringan putus di butir 12–15** (kriteria M6), tes tertutup tanpa butir terkirim (PRD §14), persetujuan, lanjut setelah muat ulang, tutup tes oleh guru |

### Belum diuji
- Alur dengan Supabase sungguhan (`pnpm db:start`) — fungsi DB sudah diuji di Postgres, jalur aplikasi diuji dengan backend memori.
- Uji di HP nyata dengan sinyal sekolah.

### Perlu dari Anda
- Instrumen masih berstatus **draf** (`draft_needs_validation`). Setelah validasi ahli, ubah status di `data/items.json`. Bila ada butir yang diubah setelah tes pernah dibuka, naikkan `test_version` lalu `pnpm seed:items --new`.

---

## M5 · AR permukaan — selesai di sisi kode, menunggu uji HP nyata (8 Oktober 2026)

### Selesai
- **"Lihat di ruanganmu" (FR-14)** di Viewer semua unit, di bawah Rel Orbit:
  - iPhone/iPad (Safari) → AR Quick Look dengan berkas USDZ.
  - Android (Chrome) → Scene Viewer dengan berkas GLB; bila gagal, kembali ke 3D dengan pesan ramah dan tombol dinonaktifkan selama sesi.
  - Laptop/browser lain → tombol nonaktif + penjelasan; 3D tetap jalan.
- **Layar izin kamera (FR-16)** sekali per sesi: alasan, jaminan privasi, "Izinkan kamera" / "Lewati, pakai 3D saja".
- **Deteksi perangkat (FR-17)**: WebGL, WebXR, Quick Look, kamera; jenis perangkat dicatat anonim per tampilan (`object_views.device_kind`), AR dicatat sebagai `ar_surface`.
- **21 model AR** (`pnpm assets:build`): GLB + USDZ untuk semua benda U1–U2 dan adegan statis U3–U6; tercatat di `assets/manifest.json`; URL di `ar_objects.glb_url/usdz_url`. Server menyajikan tipe MIME yang benar.
- Panduan langkah AR diperbarui. Formulir masuk siswa aman dikirim sebelum skrip siap (D-048).

### Hasil verifikasi
| Pemeriksaan | Hasil |
|---|---|
| `pnpm lint` / `pnpm typecheck` | lulus |
| `pnpm test` (dengan DB) | 490/490 lulus — deteksi perangkat, pilihan mode AR, intent Scene Viewer, struktur & ukuran berkas AR, bangun ulang identik, DB `ar_surface` + `device_kind` |
| Validator USD resmi (`pxr.UsdValidation`) | 21 USDZ, 0 galat, 0 peringatan |
| `pnpm e2e` | 176/176 lulus — laptop nonaktif, Android: izin → intent GLB, izin diingat, gagal → kembali 3D; iPhone: tautan rel=ar + gambar → USDZ; tanpa Quick Look → nonaktif; tipe MIME; masuk tanpa JavaScript |
| Lighthouse Viewer | Accessibility 100 |

### Belum diuji (butuh perangkat dan HTTPS)
- **AR sungguhan di HP**: kriteria M5 "AR jalan di perangkat nyata". Scene Viewer dan Quick Look hanya berjalan dari alamat **HTTPS** yang bisa dijangkau HP (mis. Vercel). Uji di ≥ 3 HP Android (RAM 3/4/6 GB) dan 1 iPhone: tombol muncul, benda tampil di meja, ukuran wajar, tekstur benar, kembali ke halaman.
- AR penanda/marker (FR-15, P1) → M8 sesuai rencana.

---

## M4 · Alur belajar — selesai (8 Oktober 2026)

### Selesai
- **Alur Tebak → Amati → Bandingkan → Jelaskan untuk keenam unit** (FR-20…24):
  - `/belajar/[unit]`: tujuan belajar, empat langkah dengan status (Selesai / Bisa dikerjakan / Terkunci), tombol Mulai/Lanjut, jelajah 3D bebas.
  - `/belajar/[unit]/tebak`: 1–2 pertanyaan prediksi (3 opsi), tanpa nilai, "Tersimpan", tebakan pertama dikunci.
  - Amati = Viewer: panel "Langkah 2 · Amati", tombol "Lanjut ke Bandingkan" aktif setelah semua objek di Rel Orbit dibuka atau mode bebas guru.
  - `/belajar/[unit]/bandingkan`: "Tebakanmu" di samping "Yang kamu lihat", kalimat netral ("Ternyata…", tanpa kata salah/benar).
  - `/belajar/[unit]/jelaskan`: penjelasan ilmiah (maks. 3 kalimat) + sumber, pertanyaan diskusi, "Sudah kudiskusikan", layar "Unit n selesai".
  - Daftar unit menampilkan status Sedang dipelajari / Selesai.
- **Viewer U3–U6** dengan animasi berlangkah (FR-13): zona planet, meteoroid→meteor→meteorit (Rel Orbit mengikuti langkah), rotasi (pagi–malam), revolusi (Maret–Desember, sakelar sumbu miring), gerhana Matahari dan Bulan (sakelar bayangan & orbit).
- **Data**: migrasi `…_learning.sql` (fungsi `learning_state`, `save_prediction`, `record_object_view`, `complete_step`, `mark_discussed`; `classes.free_explore`), migrasi konten buatan `pnpm content:sql`, backend memori + Supabase, API `GET /api/belajar/kemajuan`, server action.
- **Guru**: sakelar "Mode bebas" di halaman kelas.
- **Halaman**: Panduan (6 langkah berilustrasi), Identitas materi (CP IPAS Fase C, tujuan tiap unit, petunjuk belajar), Profil pembuat (data dari dokumen instrumen, atribusi, daftar sumber).

### Hasil verifikasi
| Pemeriksaan | Hasil |
|---|---|
| `pnpm lint` / `pnpm typecheck` | lulus |
| `pnpm test` (dengan DB) | 480/480 lulus — termasuk 11 uji DB alur belajar, uji kemiripan soal Tebak vs butir tes, geometri adegan |
| `pnpm e2e` (Pixel 5, iPhone 13*, desktop) | 165/165 lulus — **siswa menamatkan U1 end-to-end** dan status terbaca dari server di perangkat lain; langkah terkunci; tamu; mode bebas; animasi U4/U5; adegan U3/U6; axe |
| Lighthouse mobile | Beranda 86 · Unit 89 · Tebak 91 (Accessibility 100) · Viewer 46–48 (lihat D-044) |

### Perlu dari Anda
- Tinjau 10 soal "Tebak dulu" dan kunci ilmiahnya (`content/learning.json`), terutama U2 (D-038).
- Tinjau tujuan belajar tiap unit dan teks anotasi U3–U6 (status `needs_review`).
- Isi nama pembimbing (`content/profile.json`) dan cek nomor keputusan CP yang berlaku (D-043).
- Masih dari M3: uji Viewer di HP nyata (D-034/D-044).

### Belum (sesuai rencana)
- Kartu diskusi guru (FR-25) dan kuis latihan (FR-26) → M8. AR → M5.

---

## M3 · Viewer 3D — selesai, dengan catatan kinerja (8 Oktober 2026)

### Selesai
- **Viewer** `/belajar/u1/viewer` (Benda langit: Matahari, Bumi, Bulan, Pluto, komet, asteroid) dan `/belajar/u2/viewer` (8 planet). Tombol "Buka 3D" di halaman unit.
- **Kanvas 3D** (three.js + React Three Fiber): putar dengan geser, perbesar dengan cubit/gulir, rotasi pelan pembuka yang berhenti saat disentuh (mati bila "gerak dikurangi"), kemiringan sumbu Bumi/Saturnus/Uranus, cincin Saturnus, ekor komet selalu menjauhi Matahari.
- **Anotasi** (FR-11): titik bernomor di benda + daftar tombol; lembar info naik dari bawah (HP) / panel kanan (desktop), kamera berpindah halus ke titik, sumber NASA ditautkan, "Info berikutnya", Esc menutup.
- **Rel Orbit** (FR-12): navigasi + tanda sudah dilihat + "Dilihat n dari N" (tersimpan di perangkat), label "Ukuran dan jarak tidak sesuai skala".
- **Kontrol**: tombol layar (perbesar/perkecil/putar/kembalikan) dan papan ketik (panah, +/−, 0); layar penuh; Mode Kelas (teks 20 px).
- **Animasi berlangkah** (FR-13) untuk efek rumah kaca Venus; **Bandingkan ukuran sesuai skala** (U2).
- **Baca penjelasan**: alternatif teks tanpa 3D (PRD §8.7). **Tanpa WebGL** → gambar statis + deskripsi.
- **Konten ilmiah** terverifikasi ke NASA, menunggu tinjauan ahli materi (D-032).

### Hasil verifikasi
| Pemeriksaan | Hasil |
|---|---|
| `pnpm lint` / `pnpm typecheck` | lulus |
| `pnpm test` (dengan DB) | 444/444 lulus |
| `pnpm e2e` (Pixel 5, iPhone 13*, desktop) | 135/135 lulus — termasuk 12 uji Viewer: rel & kemajuan tersimpan, lembar info + sumber + fokus, titik di kanvas, tombol & papan ketik, penjelasan teks, skala, animasi Venus, cadangan tanpa WebGL, axe |
| Lighthouse mobile Viewer | Accessibility 100 · Performance 63–64 (LCP 2,9 s; TBT 3–4 s di GPU emulasi) — **di bawah target 85**, lihat D-034 |
| Lighthouse mobile Beranda | Performance 86–87 · Accessibility 100 (tidak berubah) |
| 30 FPS di HP uji | **belum diukur** — butuh HP Android nyata |

### Perlu dari Anda
- Uji Viewer di HP Android kelas menengah dan iPhone: kelancaran putar, waktu tampil, panas/baterai. Hasilnya menentukan D-034.
- Tinjauan ahli materi untuk teks anotasi (`content/celestial.json`).

---

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
