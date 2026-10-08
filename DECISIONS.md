# DECISIONS.md

Format: keputusan · alasan · alternatif yang dipertimbangkan. Terbaru di bawah.

## D-001 · Tetap PWA web (Next.js), bukan Expo/React Native
- **Keputusan:** Aplikasi dibangun sebagai PWA Next.js sesuai PRD §9.1. Prinsip dari skill desain "appllama" (dibuat untuk aplikasi native) diterjemahkan ke web: satu aksen terkunci (`--matahari`), satu keluarga abu-abu dingin, skala radius tetap, tanpa emoji di chrome, satu label per niat, state lengkap (kosong/memuat/galat), gerak hanya bila punya tujuan, area sentuh ≥ 48 px, bottom sheet di mobile.
- **Alasan:** PRD §2.2 melarang aplikasi native; pengguna memilih opsi ini.
- **Alternatif:** Expo (ditolak: bertentangan dengan non-tujuan).

## D-002 · Next.js 16 (App Router) + Tailwind CSS v4
- **Keputusan:** Versi stabil terbaru saat M0 (Next 16.x, Tailwind 4.x). Token desain didefinisikan sebagai variabel CSS di `app/globals.css` lalu dipetakan ke tema Tailwind lewat `@theme inline`.
- **Alasan:** Tailwind v4 berbasis CSS, sehingga token tetap satu sumber kebenaran (variabel CSS) yang juga dipakai komponen non-Tailwind (kanvas 3D, grafik).
- **Alternatif:** Tailwind v3 + `tailwind.config.js` (lebih banyak duplikasi token).

## D-003 · next-intl tanpa prefiks lokal di URL
- **Keputusan:** Satu lokal (`id`), dimuat lewat `i18n/request.ts` tanpa middleware dan tanpa segmen `[locale]`. Semua teks UI di `messages/id.json`.
- **Alasan:** PRD hanya meminta bahasa Indonesia; rute di PRD §11 tanpa prefiks (`/belajar`, bukan `/id/belajar`). Struktur tetap siap ditambah lokal lain.
- **Alternatif:** Routing `[locale]` (menambah kerumitan URL tanpa manfaat saat ini).

## D-004 · Font self-host via @fontsource
- **Keputusan:** `@fontsource/baloo-2` (700, 800) dan `@fontsource-variable/lexend`, diimpor di layout root. Subset latin saja.
- **Alasan:** PRD §8.3: tanpa permintaan ke Google Fonts, jalan offline.

## D-005 · Ukuran dasar teks dan skala radius
- **Keputusan:** `html { font-size: 112.5% }` (18 px) di mobile; Mode Kelas memakai 125% (20 px) lewat atribut `data-mode="kelas"`. Skala radius: tombol utama = pil (999 px), panel/sheet = 20 px, input/chip = 12 px. Tidak ada radius lain.
- **Alasan:** PRD §8.3; "shape lock" agar tampilan tidak terasa dirakit dari banyak templat.

## D-006 · Mode gelap
- **Keputusan:** Token disediakan untuk `prefers-color-scheme: dark` dan atribut `data-theme`. Kanvas Viewer selalu `--panggung` di kedua mode. Pada mode gelap `--matahari` tetap sama (teks tombol tetap `--tinta` gelap) agar kontras terjaga.
- **Alasan:** PRD §8.2.

## D-007 · PWA: Serwist dibundel terpisah dengan esbuild
- **Keputusan:** `app/sw.ts` (Serwist 9.5 + `defaultCache` dari `@serwist/turbopack/worker`) dibundel oleh `scripts/build-sw.mjs` menjadi `public/sw.js` sebelum `next build`. Precache hanya berkas bernama stabil (`/offline`, ikon) dengan revisi = SHA git; aset Next ber-hash di-cache saat runtime. Navigasi offline yang belum pernah dibuka jatuh ke `/offline`.
- **Alasan:** `@serwist/next` butuh webpack; `@serwist/turbopack` memakai Route Handler `force-static` yang (menurut sumbernya) ditujukan untuk proyek tanpa `cacheComponents`, sedangkan Next 16 di sini memakai `cacheComponents`. Bundel terpisah paling sederhana dan bebas dari keduanya.
- **Alternatif:** `next build --webpack` + `@serwist/next` (kehilangan Turbopack); mematikan `cacheComponents` (melawan arah Next).
- **Catatan:** Cache aset 3D per unit dan tombol "Siapkan untuk offline" dikerjakan di M3/M5.

## D-008 · Supabase lokal
- **Keputusan:** M0 menyiapkan `supabase/config.toml`, folder `migrations/` (kosong, skema dikerjakan di M2), `seed.sql`, dan `.env.example`. Klien Supabase belum dipanggil dari UI di M0.
- **Alasan:** Skema dan RLS adalah lingkup M2. M0 hanya fondasi.
- **Catatan lingkungan:** Supabase CLI 2.120 terpasang sebagai devDependency (`pnpm db:start`), tetapi `supabase start` belum dijalankan di lingkungan build ini karena daemon Docker tidak tersedia. Harus diuji di mesin pengembang/CI sebelum M2 selesai.

## D-009 · Ikon
- **Keputusan:** Satu keluarga ikon: `lucide-react` (garis 2 px, sudut membulat) — tidak dicampur dengan keluarga lain.
- **Alasan:** Padanan web untuk aturan "satu keluarga simbol". Berlisensi ISC; dicatat di `assets/manifest.json`.

## D-010 · Token tambahan `--laut-teks`, `--matahari-tinta`, `--tinta-2`, `--garis`, `--permukaan`
- **Keputusan:** `--laut` (#2A7FBA) hanya 3,88:1 di atas `--kertas`, jadi gagal untuk teks tautan. Tautan memakai `--laut-teks` (#1F6AA0, 5,18:1); `--laut` tetap untuk cincin fokus dan elemen grafis (≥ 3:1). `--matahari-tinta` menjaga teks tombol tetap gelap di mode gelap. Token netral (`--tinta-2`, `--garis`, `--permukaan`) satu keluarga abu-abu dingin.
- **Alasan:** PRD §8.2 (verifikasi kontras) dan §8.7 (WCAG AA). Semua pasangan diuji otomatis di `lib/design/tokens.test.ts`.

## D-011 · Emulasi iPhone 13 di Chromium saat WebKit tidak tersedia
- **Keputusan:** `playwright.config.ts` memakai WebKit untuk proyek `iphone-13` di CI. Bila `PW_CHROMIUM_PATH` diisi (lingkungan tanpa unduhan browser), proyek itu berjalan di Chromium dengan profil viewport/UA iPhone 13.
- **Alasan:** Lingkungan build agen hanya punya Chromium terpasang. Uji Safari sungguhan tetap wajib di CI dan perangkat nyata (PRD §14).

## D-012 · Isi halaman statis menunggu data peneliti
- **Keputusan:** Profil pembuat hanya mencantumkan nama peneliti (dari PRD §18); institusi, tahun, dan pembimbing resmi belum diisi. Identitas materi dan Privasi berisi kondisi kosong yang jujur ("sedang disiapkan").
- **Alasan:** Aturan PRD §0.2 dan §4.3: jangan mengarang isi. Diisi peneliti di M4.

## D-013 · Kontras warna kategori (SC/E) untuk M7
- **Temuan:** Teks putih di atas `--sc` (4,26:1) dan `--e` (3,64:1) gagal AA; teks `--tinta` juga gagal di atas keduanya. Warna kategori tetap dipakai sebagai isian grafik (objek grafis ≥ 3:1), tetapi label teks kategori di M7 harus diletakkan di luar batang atau di atas latar muda. Diputuskan saat M7.

## D-014 · Warna planet bukan latar teks kecil
- **Keputusan:** Warna planet dipakai untuk titik, penanda, dan isian bulatan di atas `--panggung` (semua ≥ 3:1, diuji). Merkurius, Bumi, Mars, dan Neptunus gagal 4,5:1 untuk teks putih maupun `--tinta`, maka judul lembar info memakai teks `--tinta` dengan aksen warna planet (garis/titik), bukan latar penuh.
- **Alasan:** PRD §8.2.

## D-015 · Beranda termasuk tujuan "Belajar"
- **Keputusan:** Bilah tab hanya punya 3 tujuan (FR-02). Beranda (`/`) menandai tab Belajar sebagai aktif; logo di bilah atas/rel kiri membawa kembali ke Beranda.
- **Alasan:** Beranda adalah pintu masuk belajar; menambah tab keempat melanggar FR-02.

## D-016 · Gutter dan satuan ruang mengikuti rem
- **Keputusan:** Karena ukuran dasar 18 px, spasi Tailwind berbasis rem ikut membesar (gutter mobile `px-4` = 18 px). Diterima: proporsi tetap konsisten dengan teks dan Mode Kelas ikut membesar otomatis.

---

# M1 · Pustaka inti

## D-017 · Konvensi skala keyakinan
- **Keputusan:** `confidence.levels` diurutkan dari paling yakin (indeks 0) ke paling ragu. "Yakin" bila indeks yang dipilih ≤ `threshold_index`. Kolom `item_responses.confidence_a/_r` menyimpan indeks ini. `threshold_index` harus menyisakan minimal satu level "ragu".
- **Alasan:** Contoh PRD §6.1 (`["Yakin","Ragu-ragu"]`, `threshold_index: 0`) hanya konsisten dengan arah ini. Mendukung 2–4 level tanpa ubah kode.
- **Tier keyakinan wajib per format:** `four_tier_standard` → keyakinan jawaban dan alasan; `modified_tier2` → hanya keyakinan atas alasan.

## D-018 · Aturan klasifikasi = berkas JSON berversi
- **Keputusan:** Aturan disimpan di `data/rule-sets/<rule_set_id>.json` dan divalidasi Zod (8 kombinasi, lengkap, saling lepas). `default-v1.json` = tabel PRD §6.2 apa adanya. Tiga `confidence_mode`: `all_tiers_at_or_above_threshold` (default), `answer_tier_only`, `reason_tier_only` — dua terakhir disediakan karena pertanyaan terbuka #5 (definisi "yakin" untuk tier modifikasi) belum terjawab.
- **Respons tidak lengkap/tidak valid** tidak dipaksa masuk kategori: hasilnya `incomplete`/`invalid` dan tidak dihitung.
- **Status:** ASUMSI. Wajib dicocokkan dengan Lampiran 4 proposal (PRD §16.1 #3) sebelum data nyata. Perubahan = berkas baru, bukan edit.

## D-019 · Pilihan statistik
- **N-Gain:** rerata dari N-Gain individual (bukan g dari rerata kelas). pre = 100 → `null`, dikeluarkan dan dihitung. Kategori: tinggi `g ≥ 0,70`; sedang `0,30 ≤ g < 0,70`; rendah `g < 0,30` (termasuk negatif).
- **CI:** distribusi t, `n − 1`. Fixture artikel lolos: [47,34; 62,09] ±0,05.
- **Uji-t berpasangan:** selisih = post − pre (setara `ttest_rel(post, pre)`). Ukuran efek: Cohen's d_z = d̄ ÷ s_d; Hedges' g_z = d_z × (1 − 3/(4·df − 1)).
- **Wilcoxon:** mengikuti default `scipy.stats.wilcoxon` (zero_method `wilcox`, tanpa koreksi kontinuitas, method `auto`: eksak bila tanpa seri/nol dan n ≤ 50; permutasi eksak bila ada seri/nol dan n ≤ 13; selain itu asimtotik dengan koreksi seri). Dilaporkan W = min(R+, R−), z, p, dan r = |z|/√n.
- **Shapiro-Wilk:** port dari implementasi Python SciPy (Royston), cabang n = 3 dan n ≤ 11 ikut.
- **KR-20:** default varians total populasi (÷ N), konsisten dengan p·q populasi (setara Cronbach α untuk butir 0/1). Opsi `sample` tersedia.
- **Tanpa dependensi statistik** (jstat tidak dipakai): fungsi distribusi diimplementasi sendiri dan diverifikasi ke SciPy dengan toleransi relatif 1e-6 sampai 1e-12.

## D-020 · Analisis berpasangan dan transisi
- **Inklusi:** persetujuan `granted` + pretest dan posttest selesai. Alasan pengecualian dilaporkan (withdrawn, pending, pre/post belum selesai).
- **Persentase domain:** penyebut = respons yang ada; bila ≠ siswa × butir, `denominatorConsistent = false` → peringatan di dasbor (PRD §16.3).
- **Transisi:** tabel pola sebagai data (`PATTERN_MAP`); kombinasi lain → `other` ("Lainnya"). Unit tanpa pre/post dilaporkan, tidak dibuang diam-diam. Invarian Σ pola = jumlah unit diuji pada data acak.

## D-021 · Kunci jawaban tidak pernah ke klien
- **Keputusan:** `toStudentItem()` membuang `correct`, `maps_to_misconception`, domain, dan target miskonsepsi. Test memastikan tidak ada kata kunci tersebut di JSON siswa. Endpoint tes (M6) wajib memakai fungsi ini.

---

# M1.1 · Impor instrumen peneliti (8 Oktober 2026)

## D-022 · Butir tes diambil dari dokumen instrumen peneliti
- **Keputusan:** `data/items.json` diisi dari "Instrumen Tes Diagnostik Four-Tier Tata Surya" (Zidan Muhabib, UMP 2026) dengan skrip `scripts/import_instrument.py` (python-docx), bukan diketik ulang. Skrip memeriksa: 20 butir, opsi A–D, skala Yakin/Tidak yakin, kunci rinci = kunci ringkasan. Test juga membandingkan kunci dengan salinan tangan tabel ringkasan.
- **Status:** dokumen menyebut dirinya **draf** — butir, kunci, dan aturan disusun baru, bukan salinan instrumen tervalidasi di artikel; CVI 0,87 dan KR-20 0,79 tidak berlaku untuknya. Dicatat sebagai `source.status = "draft_needs_validation"`. Aplikasi tetap bisa dipakai untuk uji coba, tetapi data penelitian sebaiknya baru dikumpulkan setelah validasi.
- **Berkas .docx tidak di-commit** ke repo (dokumen penelitian belum terbit). Simpan di luar repo; jalankan ulang `pnpm items:import "<path>"` bila ada revisi.

## D-023 · Format butir: four-tier baku → menjawab PRD §16.1 #5
- **Keputusan:** Semua butir `four_tier_standard` (tier 2 = keyakinan jawaban, tier 4 = keyakinan alasan), keyakinan dua level `["Yakin", "Tidak yakin"]`, ambang indeks 0.
- **Alasan:** Struktur butir dan catatan di dokumen ("keyakinan terhadap penjelasan siswa tercatat terpisah dari keyakinan terhadap jawabannya").

## D-024 · Aturan `pedoman-v1` (16 baris, per tier) menggantikan asumsi PRD → menjawab #3
- **Keputusan:** Mesin klasifikasi diperluas dengan `kind: "per_tier"` (variabel A, CA, R, CR) karena tabel D.2 membedakan keyakinan konsisten vs tidak konsisten — tidak bisa diwakili 8 baris A/R/C. `pedoman-v1` menjadi aturan aktif (`data/analysis.json`). `default-v1` tetap ada sebagai pembanding, diberi `kind: "combined"` (tanpa perubahan arti).
- **Perbedaan penting dari asumsi PRD:** (1) jawaban/alasan ada yang salah + yakin pada keduanya → **M** (PRD: bisa E); (2) salah + keyakinan tidak konsisten → **E** (PRD: LK); (3) benar-benar + ragu salah satu → LC (sama).
- **Tier kosong → E** (`incomplete_category: "E"`), sesuai catatan di bawah tabel D.2. Di default-v1, respons tidak lengkap tetap dikeluarkan. "Lebih dari satu pilihan" tidak mungkin terjadi di aplikasi (satu pilihan per tier).
- **Verifikasi:** 16 baris D.2 dan 5 contoh D.3 dijadikan test; uji aturan semua 64 kombinasi pada tiap butir menghasilkan tepat 1 SC.

## D-025 · Domain, skor, dan transisi dari instrumen → menjawab #1, #2, #4
- **Domain:** 4 domain kisi-kisi × 5 butir: `benda_langit` (1–5), `planet` (6–10), `rotasi_revolusi` (11–15), `gerhana` (16–20). Rekap D.5 memakai domain yang sama, jadi `report_domain = concept_domain`. Domain pelaporan artikel (Benda Langit, Planet, **Zona Planet, Meteor**) tidak dipakai karena tidak ada pemetaannya di instrumen.
- **Skor:** `score_sc` (D.4: jumlah SC ÷ 20 × 100).
- **Transisi:** `per_butir` (D.6: "perpindahan kategori setiap siswa pada butir yang sama").
- **Miskonsepsi:** setiap butir diberi kode `MK-Bnn`; teks konsepsi alternatif (kisi-kisi) dan catatan pengecoh (kunci) disimpan di `meta`. `maps_to_misconception` per opsi alasan sengaja dibiarkan kosong: kolom pengecoh di dokumen kadang tidak jelas merujuk opsi tier 1 atau tier 3, jadi pemetaannya perlu dikonfirmasi peneliti.

---

# M2 · Data dan autentikasi (8 Oktober 2026)

## D-026 · Lapisan akses data (DAL) dengan dua implementasi
- **Keputusan:** Semua halaman dan aksi server memakai antarmuka `Backend` (`lib/backend`). Implementasi `supabase` untuk produksi; implementasi `memory` hanya untuk uji e2e/demo tanpa Supabase (`ARSSMED_BACKEND=memory`, dan di build produksi wajib `ARSSMED_ALLOW_MEMORY_BACKEND=1`).
- **Alasan:** Lingkungan agen tidak punya Docker/GoTrue/PostgREST, jadi alur UI (masuk, kelola kelas, impor, kartu) tidak bisa diuji ujung ke ujung melawan Supabase. Backend memori meniru aturan DB (kepemilikan kelas, kode unik, PIN, pembatasan laju) dan memakai fungsi orkestrasi masuk siswa yang sama.
- **Batas:** Otorisasi sesungguhnya ada di basis data (RLS + fungsi SECURITY DEFINER) dan diuji terpisah di Postgres nyata (D-028). Backend memori tidak aman untuk produksi.

## D-027 · Masuk siswa: PIN di DB, sesi lewat Supabase Auth
- **Alur:** `POST /api/auth/siswa` → `student_login()` (service role) memverifikasi kode kelas + kode siswa + PIN (bcrypt) dengan batas 5 kegagalan / 10 menit per pasangan kode, tanpa membedakan "kelas salah" dan "PIN salah". Saat masuk pertama, server membuat akun Auth siswa tanpa kata sandi (`<student_id>@siswa.arssmed.invalid`, `app_metadata.kind = "student"`), menautkannya, lalu menerbitkan sesi dengan token magiclink sekali pakai yang langsung ditukar di server (tidak ada surel terkirim).
- **Alasan:** RLS bisa memakai `auth.uid()` untuk siswa seperti untuk guru — satu model keamanan. PIN 4 digit hanya cukup karena digabung dua kode dan dibatasi lajunya (PRD §10).
- **Kartu masuk:** PIN hanya ada dalam bentuk teks saat dibuat/di-reset; yang disimpan hanya hash. PDF kartu dibuat di browser (pdf-lib) sehingga PIN tidak dikirim ulang ke server. Guru yang kehilangan kartu membuat PIN baru.
- **Perlu diuji di Supabase lokal:** `generateLink` + `verifyOtp` dan pembuatan akun admin belum bisa dijalankan di lingkungan agen.

## D-028 · Migrasi diuji di Postgres biasa dengan tiruan Supabase
- **Keputusan:** `tests/db/supabase-shim.sql` meniru peran `anon/authenticated/service_role`, skema `auth` (`users`, `identities`, `uid()`, `jwt()`), skema `extensions`, dan hak bawaan Supabase. `tests/db/*.test.ts` membuat database baru, menjalankan semua migrasi + seed, lalu menguji RLS dan fungsi sebagai tiap peran. Berjalan bila `TEST_DATABASE_URL` diisi; CI memakai layanan `postgres:17`.
- **Cakupan:** 44 uji — RLS aktif di semua tabel; siswa hanya melihat dirinya, tidak bisa membaca `pin_hash`, butir tes (kunci), atau hasil klasifikasi; guru hanya kelasnya; admin semuanya; pembatasan laju; perubahan jawaban tercatat (FR-33); butir beku (FR-38); hapus siswa = kaskade + audit tanpa data pribadi.

## D-029 · Skema lengkap PRD §10 sejak M2, dengan penyesuaian
- `classes.research_mode` dijadikan kolom turunan dari `mode` agar tidak bisa bertentangan.
- `students.auth_user_id` dan tabel `student_login_attempts` ditambahkan (D-027).
- `rule_sets` menyimpan `rule_set_id` teks, `kind`, `incomplete_category` agar sama dengan `data/rule-sets/*.json`.
- Tulis jawaban/klasifikasi dari klien ditutup; dibuka lewat fungsi server di M6.
- Unduhan PDF di emulasi HP Playwright tidak memicu event unduhan; diuji di profil desktop.

## D-030 · Navigasi penuh saat masuk/keluar
- **Keputusan:** Setelah masuk atau keluar, klien memakai `window.location.replace(...)`, bukan router klien.
- **Alasan:** (1) pintu satu arah — "kembali" tidak membuka formulir masuk lagi; (2) cache router berisi halaman pra-muat dari sebelum masuk (mis. redirect ke halaman masuk) dan, di perangkat bersama, data pengguna sebelumnya — keduanya terbuang.
- **Terkait:** `getViewer()` memanggil `connection()` agar halaman yang membaca sesi selalu dirender per permintaan; sebelumnya halaman guru bisa terprarender saat build sebagai "anon" dan redirect-nya terbekukan.

---

# M3 · Viewer 3D (8 Oktober 2026)

## D-031 · Benda langit prosedural, tekstur dibuat saat build
- **Keputusan:** Tidak memakai model/tekstur pihak ketiga. Tekstur dibuat prosedural oleh `lib/viewer/textures.ts` dan dirender menjadi WebP kecil (`public/textures/*.webp`, total ±108 KB) oleh `pnpm build:textures`. Dicatat di `assets/manifest.json` sebagai karya sendiri.
- **Alasan:** PRD §13 mengizinkan prosedural dan melarang aset berlisensi tidak jelas. Membuat tekstur di HP siswa memakan 0,6 s per objek di CPU desktop (jauh lebih lama di HP), jadi dipindah ke waktu build.
- **Terbuka (PRD §16.1 #6):** model asli Assemblr/Sketchfab bisa menggantikan ini bila lisensinya jelas.

## D-032 · Konten ilmiah Viewer diverifikasi ke NASA
- **Keputusan:** Semua angka di `content/celestial.json` diambil dari NASA NSSDCA Planetary/Sun/Venus Fact Sheet (diperbarui 18 Maret 2025) dan halaman NASA Science (Bulan, komet, asteroid, definisi planet IAU 2006). Setiap anotasi menyimpan `source`; seluruh berkas `review_status: needs_review` sampai diperiksa ahli materi.
- **Konsistensi:** test memastikan angka di teks sama dengan `facts`, Venus terpanas meski lebih jauh dari Merkurius, Jupiter terbesar, perbandingan "11 kali", "setengah", "kurang dari sepertiga", "109 kali" cocok dengan angka.

## D-033 · Titik anotasi = tombol DOM di atas kanvas
- **Keputusan:** Posisi titik diproyeksikan dari 3D setiap bingkai, tetapi tombolnya elemen DOM biasa (bisa difokus, berlabel, `inert` saat di balik benda). Titik yang sama juga tersedia sebagai daftar tombol di bawah kanvas.
- **Alasan:** Komponen `Html` dari drei memicu galat `removeChild` saat berganti objek di React 19, dan daftar terpisah membuat anotasi bisa dipilih tanpa menyentuh kanvas. drei dilepas; OrbitControls diambil langsung dari three.

## D-034 · Kinerja Viewer
- **Keputusan:** Material Lambert (shader kecil), DPR maks. 1,5, antialias hanya di layar DPR rendah, render "on demand" kecuali saat rotasi otomatis/animasi, tekstur WebP prabuat, rangka halaman dirender server (LCP tidak menunggu three.js).
- **Hasil Lighthouse mobile `/belajar/u2/viewer`:** Accessibility 100; Performance 63–64 (LCP 2,9 s, TBT 3–4 s). Di bawah target PRD (≥ 85).
- **Penyebab:** Lighthouse di lingkungan ini memakai SwiftShader (GPU diemulasikan CPU); satu tugas panjang 2,7–3,8 s terjadi saat kanvas WebGL pertama dirender. Profil CPU dengan throttling 4× menunjukkan kerja JavaScript sebenarnya ±0,6 s. Perlu diukur di HP Android nyata (PRD §14) sebelum memutuskan.
- **Pilihan bila HP nyata juga lambat:** tampilkan gambar statis dulu dan buat 3D setelah siswa menyentuh ("Ketuk untuk memutar") — skor naik, tetapi ada satu ketukan tambahan dan rotasi pembuka hilang. Keputusan menunggu uji perangkat.

## D-035 · Animasi berlangkah dan "Bandingkan ukuran"
- **Keputusan:** Kontrol animasi (putar/jeda, langkah maju/mundur, 0,5×/1×/2×, sakelar atmosfer) dibuat generik (`lib/viewer/timeline.ts`, `AnimationBar`) untuk dipakai ulang di U4–U6; contoh pertama: efek rumah kaca Venus (3 langkah, keterangan dibacakan pembaca layar). Animasi tidak berjalan sendiri; dengan "gerak dikurangi", Putar langsung menampilkan akhir langkah.
- **Skala:** Rel Orbit sengaja tidak proporsional dengan label jelas; U2 punya "Bandingkan ukuran sesuai skala" (diameter proporsional + "×Bumi") agar tidak menimbulkan miskonsepsi baru (PRD §13).
- **Belum:** U3–U6 belum punya konten 3D (dikerjakan bersama alur belajar M4); AR (M5).

---

# M4 · Alur belajar (8 Oktober 2026)

## D-036 · Urutan langkah ditegakkan, termasuk di basis data
- **Keputusan:** Tebak → Amati → Bandingkan → Jelaskan dibuka berurutan (`lib/learning/flow.ts`). Untuk siswa yang masuk, urutan juga ditegakkan oleh fungsi DB `complete_step` (Tebak butuh semua prediksi terjawab; Amati butuh semua objek wajib dilihat atau mode bebas). Tulis langsung ke `unit_progress`, `prediction_responses`, `object_views`, `discussion_marks` dicabut; siswa menulis lewat fungsi.
- **Alasan:** PRD §4.2 — tebakan harus ada sebelum siswa melihat jawaban (konflik kognitif). Halaman Bandingkan dan Jelaskan tidak menampilkan isi sebelum status diketahui.

## D-037 · Tebakan pertama yang berlaku
- **Keputusan:** `prediction_responses` unik per siswa per pertanyaan; `save_prediction` mengembalikan jawaban yang sudah tersimpan. Di layar, pilihan dikunci setelah "Simpan tebakan".
- **Alasan:** Data penelitian = konsepsi awal sebelum mengamati. **Bisa diubah** bila peneliti ingin siswa boleh mengubah tebakan (cukup hapus batasan unik).

## D-038 · Soal "Tebak dulu" disusun agen, berbeda dari butir tes
- **Keputusan:** 10 pertanyaan prediksi (1–2 per unit, 3 opsi, satu opsi miskonsepsi) di `content/learning.json`, terpisah dari bank soal tes. Test otomatis menolak soal yang sama atau terlalu mirip dengan 20 butir instrumen (kemiripan kata < 0,4; tertinggi saat ini 0,31: `u2-merkurius-venus` vs B06).
- **Perlu dari peneliti:** tinjau isi dan kemiripan konsep. Soal U2 (Merkurius vs Venus) menyentuh konsep yang sama dengan butir 7; bentuknya berbeda, tetapi peneliti yang memutuskan apakah cukup aman dari efek pengulangan.

## D-039 · Kemajuan: perangkat dulu, lalu server
- **Keputusan:** Halaman belajar tetap statis (cepat). Klien membaca `GET /api/belajar/kemajuan` dan menggabungkannya dengan simpanan perangkat per siswa (`arssmed:belajar:<id siswa>` atau `tamu`). Tulis ke perangkat dulu, lalu ke server lewat server action; yang belum terkirim dikirim ulang saat halaman dibuka lagi. Bila server menolak (mis. `locked`), tanda di perangkat dibatalkan.
- **Tamu** (belum masuk) tetap bisa belajar; kemajuannya hanya di perangkat dan ini diberitahukan di layar.

## D-040 · Mode bebas guru (FR-22)
- **Keputusan:** Kolom `classes.free_explore` + sakelar "Mode bebas" di halaman kelas guru. Bila aktif, tombol "Lanjut ke Bandingkan" langsung aktif.

## D-041 · Konten di repo, disalin ke DB oleh migrasi buatan
- **Keputusan:** `content/*.json` tetap satu sumber kebenaran. `pnpm content:sql` menulis `supabase/migrations/*_content.sql` (upsert idempoten unit, miskonsepsi, objek 3D, soal Tebak). Test gagal bila migrasi konten tidak sama dengan isi JSON. Setelah rilis produksi, perubahan konten = `pnpm content:sql --new` (migrasi baru, bukan menyunting yang lama).
- **Catatan:** teks anotasi tidak disalin ke tabel `annotations` (belum ada pemakai di DB); dipertimbangkan saat CMS `/riset/konten`.

## D-042 · Adegan 3D U3–U6
- **Keputusan:** Satu komponen `Dioramas` dengan tata letak murni teruji (`lib/viewer/dioramas.ts`): zona planet (planet dalam, sabuk asteroid, planet luar), meteoroid → meteor → meteorit, rotasi (titik "tempatmu" pagi/siang/sore/malam, sumbu miring 23,44°), revolusi (Maret/Juni/September/Desember, sakelar sumbu miring untuk membuktikan penyebab musim), gerhana Matahari dan Bulan (bayangan inti digambar abu-abu agar terlihat). Animasi berlangkah (FR-13) generik untuk semua.
- **Skala:** semua adegan tidak sesuai skala, label tetap tampil. Fakta yang ditulis diverifikasi ke NASA/IAU (Earth & Moon Fact Sheet, Seasons, Eclipse Types & Safety, Meteors) dan bertanda `needs_review`.
- **Tata letak HP:** kamera digeser sedikit ke kiri (`setViewOffset`) karena tombol kontrol menutupi tepi kanan kanvas.

## D-043 · Profil pembuat dan identitas materi
- **Keputusan:** Profil diambil dari halaman judul dokumen instrumen (Zidan Muhabib, Magister Pendidikan Dasar, Pascasarjana UMP, 2026) di `content/profile.json`. Pembimbing ditampilkan "Belum diisi peneliti" (tidak menebak dari daftar penulis artikel).
- **CP IPAS Fase C:** kalimat "Peserta didik mendemonstrasikan bagaimana sistem tata surya bekerja dan kaitannya dengan gerak rotasi dan revolusi bumi." diperiksa pada dokumen CP 2022; nomor keputusan CP 2024 tidak bisa diverifikasi dari sini, jadi sumber ditulis umum dan diberi catatan untuk dicek.

## D-044 · Kinerja Viewer (lanjutan D-034)
- **Pengukuran ulang:** Lighthouse mobile Viewer di lingkungan ini 46–48 (LCP 5,8–6,5 s). Untuk pembanding, build M3 yang sama diukur ulang hari ini: 46 dan 63. Variasi berasal dari GPU emulasi (SwiftShader), bukan regresi M4. Halaman non-3D: Beranda 86, unit 89, Tebak 91 (Accessibility 100 semua).
- **Status:** tetap menunggu uji HP nyata (D-034).
