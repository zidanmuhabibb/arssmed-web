import { describe, expect, it, vi } from "vitest";
import { loginStudent, studentAuthEmail, type StudentLoginDeps } from "./student-login";
import { BackendError } from "./types";

function deps(over: Partial<StudentLoginDeps> = {}): StudentLoginDeps {
  return {
    verify: vi.fn(async () => ({ status: "ok" as const, student_id: "stu-1", auth_user_id: "user-1", retry_after_seconds: null })),
    createAuthUser: vi.fn(async () => "user-new"),
    linkAuthUser: vi.fn(async () => undefined),
    getLinkedAuthUser: vi.fn(async () => null),
    issueSession: vi.fn(async () => undefined),
    ...over,
  };
}

const good = { joinCode: " k7m2qx ", studentCode: "s01", pin: "0427" };

async function err(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as BackendError;
  }
  throw new Error("diharapkan galat");
}

describe("loginStudent", () => {
  it("menormalkan masukan lalu menerbitkan sesi untuk akun yang sudah ada", async () => {
    const d = deps();
    await expect(loginStudent(d, good)).resolves.toEqual({ studentId: "stu-1" });
    expect(d.verify).toHaveBeenCalledWith({ joinCode: "K7M2QX", studentCode: "S01", pin: "0427" });
    expect(d.createAuthUser).not.toHaveBeenCalled();
    expect(d.issueSession).toHaveBeenCalledWith(studentAuthEmail("stu-1"));
  });

  it("membuat dan menautkan akun Auth pada masuk pertama", async () => {
    const d = deps({ verify: vi.fn(async () => ({ status: "ok" as const, student_id: "stu-2", auth_user_id: null, retry_after_seconds: null })) });
    await loginStudent(d, good);
    expect(d.createAuthUser).toHaveBeenCalledWith("stu-2@siswa.arssmed.invalid", "stu-2");
    expect(d.linkAuthUser).toHaveBeenCalledWith("stu-2", "user-new");
    expect(d.issueSession).toHaveBeenCalledOnce();
  });

  it("menoleransi balapan: akun sudah dibuat permintaan lain", async () => {
    const d = deps({
      verify: vi.fn(async () => ({ status: "ok" as const, student_id: "stu-3", auth_user_id: null, retry_after_seconds: null })),
      createAuthUser: vi.fn(async () => {
        throw new Error("email exists");
      }),
      getLinkedAuthUser: vi.fn(async () => "user-other"),
    });
    await loginStudent(d, good);
    expect(d.issueSession).toHaveBeenCalledOnce();
  });

  it("galat pembuatan akun tanpa akun tertaut diteruskan", async () => {
    const d = deps({
      verify: vi.fn(async () => ({ status: "ok" as const, student_id: "stu-4", auth_user_id: null, retry_after_seconds: null })),
      createAuthUser: vi.fn(async () => {
        throw new Error("down");
      }),
    });
    await expect(loginStudent(d, good)).rejects.toThrow("down");
    expect(d.issueSession).not.toHaveBeenCalled();
  });

  it("kredensial salah → invalid_credentials, tanpa sesi", async () => {
    const d = deps({ verify: vi.fn(async () => ({ status: "invalid" as const, student_id: null, auth_user_id: null, retry_after_seconds: null })) });
    expect((await err(loginStudent(d, good))).code).toBe("invalid_credentials");
    expect(d.issueSession).not.toHaveBeenCalled();
  });

  it("dibatasi → rate_limited dengan waktu tunggu", async () => {
    const d = deps({ verify: vi.fn(async () => ({ status: "rate_limited" as const, student_id: null, auth_user_id: null, retry_after_seconds: 420 })) });
    const e = await err(loginStudent(d, good));
    expect(e.code).toBe("rate_limited");
    expect(e.meta).toEqual({ retryAfterSeconds: 420 });
  });

  it("format salah ditolak sebelum menyentuh basis data", async () => {
    const d = deps();
    const e = await err(loginStudent(d, { joinCode: "K7", studentCode: "S 1", pin: "12" }));
    expect(e.code).toBe("invalid_input");
    expect(e.meta.fields).toEqual(["joinCode", "studentCode", "pin"]);
    expect(d.verify).not.toHaveBeenCalled();
  });
});
