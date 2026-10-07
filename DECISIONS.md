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
