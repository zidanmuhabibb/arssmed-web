"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { signInTeacherAction, type TeacherSignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Field, FormAlert } from "@/components/ui/Field";

export function TeacherLoginForm() {
  const t = useTranslations("guru.login");
  const [state, action, pending] = useActionState<TeacherSignInState, FormData>(signInTeacherAction, { error: null, email: "" });
  useEffect(() => {
    // Pintu satu arah + navigasi penuh: "kembali" tidak membuka formulir lagi,
    // dan tidak ada halaman pra-muat dari saat belum masuk yang terpakai.
    if (state.redirectTo) window.location.replace(state.redirectTo);
  }, [state.redirectTo]);
  return (
    <form action={action} className="flex flex-col gap-5" aria-busy={pending}>
      {state.error ? <FormAlert>{t(`errors.${state.error}`)}</FormAlert> : null}
      <Field id="email" name="email" type="email" label={t("email")} autoComplete="username" defaultValue={state.email} required />
      <Field id="password" name="password" type="password" label={t("password")} autoComplete="current-password" required />
      <Button type="submit" disabled={pending || !!state.redirectTo}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
