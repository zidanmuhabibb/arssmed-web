/**
 * Kartu masuk siswa (FR-40): A4, 8 kartu per halaman (2 × 4), garis potong putus-putus.
 * Murni: menerima data + label teks, mengembalikan byte PDF. Dipakai di browser
 * (PIN tidak pernah dikirim ulang ke server) dan di test Node.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export interface EntryCard {
  studentCode: string;
  nickname: string | null;
  pin: string;
}

export interface EntryCardLabels {
  title: string;
  joinCode: string;
  studentCode: string;
  pin: string;
  openAt: string;
  keepSafe: string;
  className: string;
}

export interface EntryCardInput {
  className: string;
  joinCode: string;
  appUrl: string;
  cards: readonly EntryCard[];
  labels: EntryCardLabels;
}

// A4 dalam pt
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 28;
const COLS = 2;
const ROWS = 4;
export const CARDS_PER_PAGE = COLS * ROWS;

const INK = rgb(0x14 / 255, 0x28 / 255, 0x3c / 255); // --tinta
const INK2 = rgb(0x44 / 255, 0x58 / 255, 0x6d / 255); // --tinta-2
const LINE = rgb(0.7, 0.75, 0.8);
const SUN = rgb(0xf5 / 255, 0xa6 / 255, 0x23 / 255); // --matahari

/** Huruf standar PDF hanya WinAnsi; karakter lain diganti '?' agar tidak gagal. */
export function toWinAnsi(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -2) + "…";
  return t;
}

export async function buildEntryCardsPdf(input: EntryCardInput): Promise<Uint8Array> {
  if (input.cards.length === 0) throw new Error("Tidak ada kartu untuk dicetak");
  for (const c of input.cards) {
    if (!/^[0-9]{4}$/.test(c.pin)) throw new Error(`PIN tidak valid untuk ${c.studentCode}`);
  }
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.labels.title} – ${input.className}`);
  doc.setCreator("ARSSMED");
  doc.setProducer("ARSSMED");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.CourierBold);

  const cardW = (PAGE_W - MARGIN * 2) / COLS;
  const cardH = (PAGE_H - MARGIN * 2) / ROWS;

  let page: PDFPage | null = null;
  input.cards.forEach((card, i) => {
    const slot = i % CARDS_PER_PAGE;
    if (slot === 0) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      drawCutLines(page, cardW, cardH);
    }
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const x = MARGIN + col * cardW;
    const yTop = PAGE_H - MARGIN - row * cardH;
    drawCard(page!, { x, yTop, w: cardW, h: cardH }, card, input, { regular, bold, mono });
  });

  return doc.save();
}

function drawCutLines(page: PDFPage, cardW: number, cardH: number) {
  const dash = { dashArray: [4, 4], color: LINE, thickness: 0.7 };
  for (let c = 0; c <= COLS; c++) {
    const x = MARGIN + c * cardW;
    page.drawLine({ start: { x, y: MARGIN }, end: { x, y: PAGE_H - MARGIN }, ...dash });
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = MARGIN + r * cardH;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, ...dash });
  }
}

function drawCard(
  page: PDFPage,
  box: { x: number; yTop: number; w: number; h: number },
  card: EntryCard,
  input: EntryCardInput,
  f: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
) {
  const pad = 16;
  const left = box.x + pad;
  const inner = box.w - pad * 2;
  let y = box.yTop - pad - 12;
  const L = input.labels;

  // Strip aksen + judul
  page.drawRectangle({ x: left, y: y - 2, width: 4, height: 16, color: SUN });
  page.drawText(toWinAnsi(f.bold, L.title), { x: left + 10, y, size: 12, font: f.bold, color: INK });
  y -= 22;
  const name = toWinAnsi(f.bold, card.nickname ?? card.studentCode);
  page.drawText(fit(f.bold, name, 16, inner), { x: left, y, size: 16, font: f.bold, color: INK });
  y -= 15;
  page.drawText(fit(f.regular, toWinAnsi(f.regular, `${L.className}: ${input.className}`), 9, inner), {
    x: left, y, size: 9, font: f.regular, color: INK2,
  });
  y -= 24;

  const field = (label: string, value: string, size: number) => {
    page.drawText(toWinAnsi(f.regular, label), { x: left, y, size: 8.5, font: f.regular, color: INK2 });
    page.drawText(value, { x: left + 78, y: y - (size - 10) / 2, size, font: f.mono, color: INK });
    y -= size + 9;
  };
  field(L.joinCode, toWinAnsi(f.mono, input.joinCode), 14);
  field(L.studentCode, toWinAnsi(f.mono, card.studentCode), 14);
  field(L.pin, card.pin.split("").join(" "), 18);

  y = box.yTop - box.h + pad + 14;
  page.drawText(fit(f.regular, toWinAnsi(f.regular, `${L.openAt} ${input.appUrl}`), 8.5, inner), {
    x: left, y, size: 8.5, font: f.regular, color: INK2,
  });
  y -= 12;
  page.drawText(fit(f.regular, toWinAnsi(f.regular, L.keepSafe), 8.5, inner), {
    x: left, y, size: 8.5, font: f.regular, color: INK2,
  });
}
