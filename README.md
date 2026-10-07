# ARSSMED Web

PWA pembelajaran tata surya kelas VI berbasis 3D/AR dengan asesmen diagnostik four-tier.
Spesifikasi lengkap: PRD ARSSMED Web v1.0. Status per milestone: `PROGRESS.md`. Keputusan teknis: `DECISIONS.md`.

```bash
pnpm install
pnpm dev        # pengembangan
pnpm check      # lint + typecheck + unit test
pnpm e2e        # Playwright (Pixel 5, iPhone 13, desktop) + axe
pnpm build      # service worker + build produksi
```

Struktur penting: `app/` (rute), `components/`, `lib/` (logika murni + test), `messages/id.json` (semua teks UI), `content/`, `assets/manifest.json` (lisensi aset), `supabase/`.
