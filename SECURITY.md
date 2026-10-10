# SECURITY.md — Keamanan dan pentest dasar ARSSMED Web

Ringkasan kontrol keamanan (PRD §10, §12.4) dan hasil pentest dasar M8 (10 Oktober 2026).
Pentest dijalankan otomatis tiap `pnpm e2e` (`tests/e2e/keamanan.spec.ts`) dan `pnpm test`
dengan basis data (`tests/db/rls.test.ts`, `tes.test.ts`, `analysis.test.ts`, `security.test.ts`).

## Kontrol yang ada

| Area | Kontrol | Diuji di |
|---|---|---|
| Otorisasi data | RLS di semua tabel; fungsi `SECURITY DEFINER` dengan `search_path=''` yang memeriksa peran sendiri; guru hanya kelasnya, admin semua | `rls.test.ts`, `analysis.test.ts`, e2e akses |
| Kunci jawaban | `test_items` tidak terbaca siswa; butir dikirim tanpa kunci/metadata; `analysis_dataset` tidak memuat isi butir | `tes.test.ts`, `keamanan.spec.ts` |
| Hasil tes | Klasifikasi hanya ditulis service role; siswa tidak bisa membaca `classifications` (FR-36) | `tes.test.ts` |
| Masuk siswa | PIN di-hash; 5 percobaan gagal / 10 menit per kode; tidak membedakan kode kelas vs PIN salah | `rls.test.ts`, `auth.spec.ts` |
| Pembatasan laju | `consume_rate_limit` per cakupan & pengguna (batas di DB, bukan pemanggil): mulai tes 30/mnt, simpan 300/mnt, selesai 20/mnt, baca riset 60/mnt, ekspor 20/10 mnt, pemetaan nama 5/10 mnt; pemicu tabel `item_responses` 400/mnt per percobaan (RPC langsung) | `security.test.ts`, `keamanan.spec.ts` |
| Privasi ekspor | Hanya `student_pseudo_id`; siswa `withdrawn`/`pending` tidak ikut; setiap ekspor tercatat di audit | `analysis.test.ts`, `hasil.spec.ts` |
| Pemetaan nama | Admin saja, kalimat konfirmasi, berkas terpisah bertanda RAHASIA, tercatat `export.name_map` | `security.test.ts`, `keamanan.spec.ts` |
| Penghapusan | Hapus siswa (kaskade + audit tanpa data pribadi); `purge_withdrawn_research_data(interval)` untuk admin / penjadwal | `security.test.ts` |
| Header | CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri`, `form-action`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (kamera hanya asal sendiri), `COOP`, tanpa `X-Powered-By` | `keamanan.spec.ts` |
| Pihak ketiga | Tidak ada pelacak, iklan, CDN, atau font eksternal; MindAR & TF.js disalin ke `public/vendor` | `keamanan.spec.ts` |
| XSS | React meng-escape teks; nama panggilan berisi HTML tampil sebagai teks | `keamanan.spec.ts` |
| Injeksi formula | Sel CSV teks yang diawali `= + - @` diberi awalan `'` | `analysis.test.ts` |
| Kamera | Layar penjelasan sebelum izin; gambar kamera diolah di perangkat, tidak disimpan/dikirim; kamera dimatikan saat selesai | `penanda*.spec.ts` |
| Rahasia | Kunci service role hanya di variabel lingkungan server (`server-only`) | tinjauan kode |

## Pentest dasar — hasil

| # | Skenario | Hasil |
|---|---|---|
| 1 | Akses API riset/guru tanpa sesi | 401 ✓ |
| 2 | Siswa memanggil API guru/riset, membuka `/guru`, `/riset` | 401 / dialihkan ke masuk guru ✓ |
| 3 | Guru membaca kelas guru lain (IDOR) lewat halaman dan API | 404 ✓ |
| 4 | Siswa memanggil RPC penyimpan klasifikasi / membaca kunci | 42501 / kosong ✓ |
| 5 | XSS tersimpan lewat nama panggilan (`<img onerror>`) di halaman guru & siswa | tidak dieksekusi ✓ |
| 6 | Pemetaan nama tanpa konfirmasi / oleh guru | 400 / 401 ✓ |
| 7 | Membanjiri endpoint pemetaan | 429 + `Retry-After` ✓ |
| 8 | Pemanggil mengatur batas laju sendiri / membaca tabel batas | ditolak (42501) ✓ |
| 9 | Halaman dimuat dalam iframe | dicegah (`frame-ancestors 'none'`, `DENY`) ✓ |
| 10 | Permintaan ke domain luar dari halaman siswa | tidak ada ✓ |
| 11 | `pnpm audit --prod` | 0 kerentanan ✓ |

## Risiko yang diterima / catatan

- `script-src` memakai `'unsafe-inline'`: Next.js menyisipkan skrip hidrasi inline di halaman prarender parsial; nonce akan memaksa semua halaman dinamis. Dimitigasi: tidak ada `unsafe-eval`, tidak ada asal luar, `object-src 'none'`, React meng-escape keluaran (DECISIONS D-061).
- `pnpm audit` (termasuk dev): 1 temuan tinggi `braces` di `eslint-config-next → fast-glob` — hanya alat lint di mesin pengembang, tidak ikut ke aplikasi; belum ada versi perbaikan.
- Backend memori (`ARSSMED_BACKEND=memory`) hanya untuk demo/uji: sesi tidak ditandatangani. Build produksi menolaknya kecuali diizinkan eksplisit.
- Belum diuji: Supabase Auth sungguhan, HTTPS/HSTS di hosting, cadangan & pemulihan basis data (PRD §12.5) — wajib sebelum pengumpulan data nyata.

## Penjadwalan penghapusan (contoh, Supabase)

```sql
-- pg_cron: setiap Senin 02.00 WIB, hapus data tes siswa yang menarik persetujuan > 30 hari
select cron.schedule('hapus-withdrawn', '0 19 * * 0', $$ select public.purge_withdrawn_research_data('30 days') $$);
```

## Melaporkan masalah keamanan

Hubungi peneliti (zidan@abati.co.id). Jangan membuka isu publik berisi data siswa.
