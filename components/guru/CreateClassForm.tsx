"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { createClassAction, type CreateClassState } from "@/app/guru/kelas/actions";
import { Button } from "@/components/ui/Button";
import { Field, FormAlert } from "@/components/ui/Field";

export function CreateClassForm() {
  const t = useTranslations("guru");
  const [state, action, pending] = useActionState<CreateClassState, FormData>(createClassAction, {
    error: null,
    values: { name: "", academicYear: "", mode: "learn_only" },
  });
  return (
    <form action={action} className="flex flex-col gap-5" aria-busy={pending}>
      {state.error === "unknown" ? <FormAlert>{t("classes.create.errors.unknown")}</FormAlert> : null}
      <Field
        id="class-name"
        name="name"
        label={t("classes.create.name")}
        placeholder={t("classes.create.namePlaceholder")}
        defaultValue={state.values.name}
        maxLength={60}
        required
        error={state.error === "name" ? t("classes.create.errors.name") : null}
      />
      <Field
        id="class-year"
        name="academicYear"
        label={t("classes.create.academicYear")}
        placeholder={t("classes.create.academicYearPlaceholder")}
        defaultValue={state.values.academicYear}
        inputMode="numeric"
        maxLength={9}
        error={state.error === "academicYear" ? t("classes.create.errors.academicYear") : null}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 font-semibold">{t("classes.create.mode")}</legend>
        {(["learn_only", "research"] as const).map((m) => (
          <label key={m} className="flex cursor-pointer gap-3 rounded-kontrol border-2 border-garis bg-permukaan p-4 has-[:checked]:border-laut">
            <input type="radio" name="mode" value={m} defaultChecked={state.values.mode === m} className="mt-1 size-5 accent-[var(--laut)]" />
            <span>
              <span className="block font-semibold">{t(`mode.${m}`)}</span>
              <span className="block text-[0.9rem] text-tinta-2">{t(`mode.${m}Hint`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? t("classes.create.submitting") : t("classes.create.submit")}
      </Button>
    </form>
  );
}
