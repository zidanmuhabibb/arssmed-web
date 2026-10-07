# data/

Data peneliti. Agen tidak mengarang isinya (PRD §6.1).

| Berkas | Isi | Sumber |
|---|---|---|
| `items.json` | 20 butir four-tier, kunci, domain, metadata kisi-kisi | Diimpor dari dokumen instrumen dengan `pnpm items:import "<berkas.docx>"` |
| `rule-sets/pedoman-v1.json` | Aturan klasifikasi 16 baris (tabel D.2), tier kosong → E | Diimpor bersama `items.json` |
| `rule-sets/default-v1.json` | Asumsi PRD §6.2 (8 baris) | PRD — pembanding saja, tidak aktif |
| `analysis.json` | Rule set aktif, metode skor, mode transisi, taksonomi domain | Instrumen bagian D.4–D.6 |

**Status instrumen:** `items.json → source.status = "draft_needs_validation"`. Dokumen instrumen menyatakan
butir dan aturannya disusun baru (bukan salinan instrumen asli artikel). Ubah ke `"validated"` setelah
validasi ahli dan uji reliabilitas.

**Mengubah butir atau aturan:** edit dokumen .docx, lalu jalankan ulang impor (`pip install python-docx` sekali).
Skrip berhenti bila struktur dokumen tidak sesuai (jumlah butir, opsi A–D, kunci rinci ≠ ringkasan, dll.).
Setelah tes dibuka ke siswa, butir dibekukan (FR-38): perubahan harus menaikkan `test_version`, dan perubahan
aturan harus memakai `rule_set_id` baru (mis. `pedoman-v2`), bukan menimpa `pedoman-v1`.

Konvensi keyakinan: `confidence.levels` diurutkan dari paling yakin (indeks 0); "yakin" bila indeks ≤ `threshold_index`.
