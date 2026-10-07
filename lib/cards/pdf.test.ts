import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildEntryCardsPdf, CARDS_PER_PAGE, toWinAnsi, type EntryCardInput } from "./pdf";

const labels = {
  title: "Kartu masuk ARSSMED",
  joinCode: "Kode kelas",
  studentCode: "Kode siswa",
  pin: "PIN",
  openAt: "Buka",
  keepSafe: "Simpan kartu ini. Jangan beri tahu PIN ke teman.",
  className: "Kelas",
};

function input(n: number): EntryCardInput {
  return {
    className: "6A",
    joinCode: "K7M2QX",
    appUrl: "arssmed.example.id",
    labels,
    cards: Array.from({ length: n }, (_, i) => ({ studentCode: `S${String(i + 1).padStart(2, "0")}`, nickname: i % 2 ? `Anak ${i}` : null, pin: "0427" })),
  };
}

describe("buildEntryCardsPdf", () => {
  it.each([1, 8, 9, 36])("%i kartu → halaman = ⌈n/8⌉", async (n) => {
    const bytes = await buildEntryCardsPdf(input(n));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(Math.ceil(n / CARDS_PER_PAGE));
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]); // A4
  });

  it("menolak daftar kosong dan PIN tidak valid", async () => {
    await expect(buildEntryCardsPdf(input(0))).rejects.toThrow();
    await expect(buildEntryCardsPdf({ ...input(1), cards: [{ studentCode: "S1", nickname: null, pin: "12" }] })).rejects.toThrow(/PIN/);
  });

  it("nama dengan huruf di luar WinAnsi tidak menggagalkan PDF", async () => {
    const bytes = await buildEntryCardsPdf({ ...input(1), cards: [{ studentCode: "S1", nickname: "Ayu 星", pin: "1111" }] });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

describe("toWinAnsi", () => {
  it("mempertahankan huruf Indonesia dan mengganti yang tak didukung", async () => {
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    expect(toWinAnsi(f, "Raka – Śiti 星")).toBe("Raka – ?iti ?");
  });
});
