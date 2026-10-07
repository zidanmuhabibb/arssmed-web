import { describe, expect, it } from "vitest";
import { activeNavKey, PRIMARY_NAV } from "./routes";

describe("activeNavKey", () => {
  it("menganggap Beranda bagian dari Belajar", () => {
    expect(activeNavKey("/")).toBe("belajar");
  });

  it.each([
    ["/belajar", "belajar"],
    ["/belajar/u2", "belajar"],
    ["/belajar/u2/viewer", "belajar"],
    ["/tes", "tes"],
    ["/tes/pre", "tes"],
    ["/panduan", "panduan"],
    ["/panduan/", "panduan"],
    ["/tes?x=1", "tes"],
  ] as const)("%s → %s", (path, key) => {
    expect(activeNavKey(path)).toBe(key);
  });

  it("tidak menandai rute yang hanya berawalan sama", () => {
    expect(activeNavKey("/tesla")).toBeNull();
    expect(activeNavKey("/belajarlah")).toBeNull();
  });

  it("tidak menandai halaman di luar navigasi utama", () => {
    expect(activeNavKey("/pembuat")).toBeNull();
    expect(activeNavKey("/guru/kelas")).toBeNull();
  });

  it("punya tepat tiga tujuan (FR-02)", () => {
    expect(PRIMARY_NAV.map((i) => i.key)).toEqual(["belajar", "tes", "panduan"]);
  });
});
