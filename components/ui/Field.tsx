import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "block w-full min-h-14 rounded-kontrol border-2 border-garis bg-permukaan px-4 text-[1.05rem] text-tinta placeholder:text-tinta-2/70 focus-visible:border-laut focus-visible:outline-none aria-[invalid=true]:border-m";

interface FieldProps extends Omit<ComponentProps<"input">, "className" | "id" | "name"> {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string | null;
  trailing?: ReactNode;
  inputClassName?: string;
}

/** Isian berlabel dengan petunjuk dan galat yang terhubung lewat aria-describedby. */
export function Field({ id, name, label, hint, error, trailing, inputClassName = "", ...rest }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
          className={`${inputClass} ${inputClassName}`}
          {...rest}
        />
        {trailing}
      </div>
      {hint ? (
        <p id={hintId} className="text-[0.875rem] text-tinta-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="text-[0.9rem] font-semibold text-m-teks">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Pesan galat formulir: diumumkan pembaca layar, tanpa dialog yang menghalangi. */
export function FormAlert({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-kontrol border-2 border-m bg-permukaan px-4 py-3 font-semibold text-m-teks">
      {children}
    </div>
  );
}
