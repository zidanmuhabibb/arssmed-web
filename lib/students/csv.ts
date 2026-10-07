/**
 * Pengurai daftar siswa untuk impor (FR-40). Murni, tanpa UI.
 * Menerima CSV dari Excel/Google Sheets (pemisah koma, titik koma, atau tab; BOM; tanda kutip).
 *
 * Kolom yang dikenali (tidak peka huruf besar/kecil, spasi/garis bawah setara):
 *   kode | kode siswa | kode_siswa | code      → kode siswa (opsional; kosong = dibuat otomatis)
 *   nama panggilan | nama | panggilan | nickname → nama panggilan (opsional)
 * Tanpa baris judul: 1 kolom = nama panggilan; 2 kolom = kode, nama panggilan.
 */

export const STUDENT_CODE_RE = /^[A-Z0-9-]{1,12}$/;
export const MAX_STUDENTS = 60;
export const MAX_NICKNAME = 30;

export interface ImportRow {
  line: number;
  code: string | null;
  nickname: string | null;
}

export type ImportIssue =
  | { kind: "invalid_code"; line: number; value: string }
  | { kind: "duplicate_code"; line: number; value: string; firstLine: number }
  | { kind: "nickname_too_long"; line: number; value: string }
  | { kind: "too_many"; count: number; max: number }
  | { kind: "empty" }
  | { kind: "unknown_header"; value: string };

export type ImportWarning = { kind: "looks_like_full_name"; line: number; value: string };

export interface ImportResult {
  rows: ImportRow[];
  errors: ImportIssue[];
  warnings: ImportWarning[];
  delimiter: "," | ";" | "\t";
  hasHeader: boolean;
}

const CODE_HEADERS = new Set(["kode", "kode siswa", "code", "student code", "no", "nomor"]);
const NICK_HEADERS = new Set(["nama panggilan", "nama", "panggilan", "nickname", "name"]);

function normHeader(h: string) {
  return h.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

/** Pemecah CSV kecil sesuai RFC 4180 (tanda kutip ganda, pemisah di dalam kutip, baris baru di dalam kutip). */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field.trim() === "") {
      quoted = true;
      field = "";
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(firstLine: string): ImportResult["delimiter"] {
  const counts = { ";": 0, ",": 0, "\t": 0 } as Record<ImportResult["delimiter"], number>;
  for (const ch of firstLine) if (ch in counts) counts[ch as ImportResult["delimiter"]] += 1;
  // Excel berbahasa Indonesia memakai titik koma; utamakan bila ada.
  if (counts[";"] > 0 && counts[";"] >= counts[","]) return ";";
  if (counts["\t"] > counts[","]) return "\t";
  return ",";
}

export function parseStudentCsv(input: string): ImportResult {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = text.split("\n").find((l) => l.trim() !== "") ?? "";
  const delimiter = detectDelimiter(firstLine);
  const records = splitCsv(text, delimiter)
    .map((cells, i) => ({ line: i + 1, cells: cells.map((c) => c.trim()) }))
    .filter((r) => r.cells.some((c) => c !== ""));

  const errors: ImportIssue[] = [];
  const warnings: ImportWarning[] = [];
  if (records.length === 0) return { rows: [], errors: [{ kind: "empty" }], warnings, delimiter, hasHeader: false };

  // Baris judul?
  const headerCells = records[0]!.cells.map(normHeader);
  const looksLikeHeader = headerCells.some((h) => CODE_HEADERS.has(h) || NICK_HEADERS.has(h));
  let codeCol: number | null;
  let nickCol: number | null;
  let body = records;
  if (looksLikeHeader) {
    codeCol = headerCells.findIndex((h) => CODE_HEADERS.has(h));
    nickCol = headerCells.findIndex((h) => NICK_HEADERS.has(h));
    if (codeCol < 0) codeCol = null;
    if (nickCol < 0) nickCol = null;
    for (const h of records[0]!.cells) {
      const n = normHeader(h);
      if (n && !CODE_HEADERS.has(n) && !NICK_HEADERS.has(n)) errors.push({ kind: "unknown_header", value: h });
    }
    body = records.slice(1);
  } else {
    const width = Math.max(...records.map((r) => r.cells.filter((c) => c !== "").length));
    [codeCol, nickCol] = width >= 2 ? [0, 1] : [null, 0];
  }

  const rows: ImportRow[] = [];
  const seen = new Map<string, number>();
  for (const { line, cells } of body) {
    const rawCode = codeCol === null ? "" : (cells[codeCol] ?? "");
    const rawNick = nickCol === null ? "" : (cells[nickCol] ?? "");
    const code = rawCode === "" ? null : rawCode.toUpperCase();
    const nickname = rawNick === "" ? null : rawNick.replace(/\s+/g, " ");
    if (code === null && nickname === null) continue;

    if (code !== null) {
      if (!STUDENT_CODE_RE.test(code)) errors.push({ kind: "invalid_code", line, value: rawCode });
      const first = seen.get(code);
      if (first !== undefined) errors.push({ kind: "duplicate_code", line, value: code, firstLine: first });
      else seen.set(code, line);
    }
    if (nickname !== null) {
      if (nickname.length > MAX_NICKNAME) errors.push({ kind: "nickname_too_long", line, value: nickname });
      // Minimasi data (PRD §12.4): nama panggilan saja, bukan nama lengkap.
      else if (nickname.split(" ").length >= 3) warnings.push({ kind: "looks_like_full_name", line, value: nickname });
    }
    rows.push({ line, code, nickname });
  }

  if (rows.length === 0) errors.push({ kind: "empty" });
  if (rows.length > MAX_STUDENTS) errors.push({ kind: "too_many", count: rows.length, max: MAX_STUDENTS });
  return { rows, errors, warnings, delimiter, hasHeader: looksLikeHeader };
}
