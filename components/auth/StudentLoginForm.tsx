"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormAlert } from "@/components/ui/Field";

type ErrorCode = "invalid_credentials" | "invalid_input" | "rate_limited" | "not_configured" | "network" | "unknown";

export function StudentLoginForm() {
  const t = useTranslations("masuk");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ code: ErrorCode; minutes?: number } | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const alertRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const body = {
      joinCode: String(form.get("joinCode") ?? ""),
      studentCode: String(form.get("studentCode") ?? ""),
      pin: String(form.get("pin") ?? ""),
    };
    setPending(true);
    setError(null);
    setFields([]);
    try {
      const res = await fetch("/api/auth/siswa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: ErrorCode; retryAfterSeconds?: number; fields?: string[]; redirect?: string };
      if (res.ok) {
        // Pintu satu arah + navigasi penuh: "kembali" tidak membuka formulir lagi dan
        // tidak ada data halaman dari pengguna sebelumnya di perangkat bersama.
        window.location.replace(data.redirect ?? "/belajar");
        return;
      }
      const code: ErrorCode = data.error && data.error in { invalid_credentials: 1, invalid_input: 1, rate_limited: 1, not_configured: 1 } ? data.error : "unknown";
      setError({ code, minutes: code === "rate_limited" ? Math.max(1, Math.ceil((data.retryAfterSeconds ?? 600) / 60)) : undefined });
      setFields(data.fields ?? []);
    } catch {
      setError({ code: "network" });
    }
    setPending(false);
    requestAnimationFrame(() => alertRef.current?.focus());
  }

  const fieldError = (name: string) => (fields.includes(name) ? " " : null);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-busy={pending}>
      <div ref={alertRef} tabIndex={-1} className="outline-none">
        {error ? <FormAlert>{t(`errors.${error.code}`, { minutes: error.minutes ?? 10 })}</FormAlert> : null}
      </div>
      <Field
        id="joinCode"
        name="joinCode"
        label={t("joinCode")}
        hint={t("joinCodeHint")}
        error={fieldError("joinCode")}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={8}
        required
        inputClassName="font-mono uppercase tracking-[0.15em]"
      />
      <Field
        id="studentCode"
        name="studentCode"
        label={t("studentCode")}
        hint={t("studentCodeHint")}
        error={fieldError("studentCode")}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        required
        inputClassName="font-mono uppercase tracking-[0.15em]"
      />
      <Field
        id="pin"
        name="pin"
        type="password"
        label={t("pin")}
        hint={t("pinHint")}
        error={fieldError("pin")}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        required
        inputClassName="font-mono tracking-[0.4em]"
      />
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
