import { describe, expect, it } from "vitest";
import { parseStudentCsv, splitCsv } from "./csv";

describe("parseStudentCsv", () => {
  it("CSV Excel Indonesia: titik koma, BOM, baris judul, CRLF", () => {
    const r = parseStudentCsv("﻿Kode;Nama panggilan\r\ns01;Raka\r\nS02;Sinta\r\n\r\n");
    expect(r.delimiter).toBe(";");
    expect(r.hasHeader).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { line: 2, code: "S01", nickname: "Raka" },
      { line: 3, code: "S02", nickname: "Sinta" },
    ]);
  });

  it("koma, kolom terbalik, judul dengan garis bawah", () => {
    const r = parseStudentCsv("nama_panggilan,kode_siswa\nRaka,A1\n");
    expect(r.rows).toEqual([{ line: 2, code: "A1", nickname: "Raka" }]);
  });

  it("satu kolom tanpa judul = daftar nama panggilan (kode otomatis)", () => {
    const r = parseStudentCsv("Raka\nSinta\nBudi\n");
    expect(r.hasHeader).toBe(false);
    expect(r.rows.map((x) => [x.code, x.nickname])).toEqual([[null, "Raka"], [null, "Sinta"], [null, "Budi"]]);
  });

  it("dua kolom tanpa judul = kode, nama panggilan; tab dari tempel Google Sheets", () => {
    const r = parseStudentCsv("S01\tRaka\nS02\tSinta");
    expect(r.delimiter).toBe("\t");
    expect(r.rows[1]).toEqual({ line: 2, code: "S02", nickname: "Sinta" });
  });

  it("kode boleh kosong per baris; nama panggilan boleh kosong", () => {
    const r = parseStudentCsv("kode;nama\n;Raka\nS09;\n");
    expect(r.rows).toEqual([
      { line: 2, code: null, nickname: "Raka" },
      { line: 3, code: "S09", nickname: null },
    ]);
  });

  it("tanda kutip dan pemisah di dalam kutip", () => {
    const r = parseStudentCsv('kode,nama\nS01,"Raka, kecil"\nS02,"Si ""Bintang"""\n');
    expect(r.rows.map((x) => x.nickname)).toEqual(["Raka, kecil", 'Si "Bintang"']);
  });

  it("melaporkan kode tidak valid dan ganda dengan nomor baris", () => {
    const r = parseStudentCsv("kode;nama\nS 01;A\nS02;B\ns02;C\n");
    expect(r.errors).toEqual([
      { kind: "invalid_code", line: 2, value: "S 01" },
      { kind: "duplicate_code", line: 4, value: "S02", firstLine: 3 },
    ]);
  });

  it("nama terlalu panjang = galat; tiga kata atau lebih = peringatan nama lengkap", () => {
    const r = parseStudentCsv(`nama\n${"a".repeat(31)}\nRaka Putra Pratama\nRaka Putra\n`);
    expect(r.errors).toEqual([{ kind: "nickname_too_long", line: 2, value: "a".repeat(31) }]);
    expect(r.warnings).toEqual([{ kind: "looks_like_full_name", line: 3, value: "Raka Putra Pratama" }]);
  });

  it("kosong dan terlalu banyak", () => {
    expect(parseStudentCsv("  \n\n").errors).toEqual([{ kind: "empty" }]);
    expect(parseStudentCsv("kode;nama\n").errors).toEqual([{ kind: "empty" }]);
    const many = Array.from({ length: 61 }, (_, i) => `Anak${i}`).join("\n");
    expect(parseStudentCsv(many).errors).toEqual([{ kind: "too_many", count: 61, max: 60 }]);
  });

  it("kolom judul tak dikenal dilaporkan", () => {
    expect(parseStudentCsv("kode;nama;nilai\nS1;A;90\n").errors).toEqual([{ kind: "unknown_header", value: "nilai" }]);
  });
});

describe("splitCsv", () => {
  it("baris baru di dalam kutip", () => {
    expect(splitCsv('a,"b\nc"\nd,e', ",")).toEqual([["a", "b\nc"], ["d", "e"]]);
  });
});
