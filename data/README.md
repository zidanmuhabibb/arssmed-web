# data/

Diisi oleh peneliti, bukan oleh agen (PRD §6.1).

- `items.json` — 20 butir instrumen asli (skema: `ItemsFile` di `lib/classification/item.ts`).
  Sengaja masih kosong. Validasi otomatis berjalan di `pnpm test`.
- `rule-sets/*.json` — aturan klasifikasi berversi (skema: `RuleSet` di `lib/classification/rules.ts`).
  `default-v1.json` adalah ASUMSI PRD §6.2 dan wajib dicocokkan dengan Pedoman Klasifikasi
  (Lampiran 4 proposal) sebelum data nyata dikumpulkan. Untuk mengubah aturan, buat berkas
  baru (mis. `pedoman-v1.json`) — jangan mengedit versi yang sudah dipakai.

Konvensi keyakinan: `confidence.levels` diurutkan dari paling yakin (indeks 0) ke paling ragu;
"yakin" bila indeks yang dipilih ≤ `threshold_index`.
