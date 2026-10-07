import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "utama" | "kedua" | "teks" | "bahaya";
type Size = "besar" | "kecil";

const base =
  "tekan inline-flex items-center justify-center gap-2 rounded-full font-semibold no-underline select-none disabled:cursor-not-allowed disabled:opacity-60";

const sizes: Record<Size, string> = {
  besar: "min-h-14 px-7 text-[1.05rem]",
  kecil: "min-h-12 px-5 text-[0.95rem]",
};

const variants: Record<Variant, string> = {
  // Satu aksen: tombol utama memakai --matahari dengan teks --tinta (PRD §8.2).
  utama: "bg-matahari text-matahari-tinta active:bg-matahari-tekan",
  kedua: "border-2 border-garis bg-permukaan text-tinta active:bg-kertas",
  teks: "text-laut-teks active:bg-kertas",
  bahaya: "border-2 border-m text-m bg-permukaan active:bg-kertas",
};

export function buttonClass({ variant = "utama", size = "besar", block = true }: { variant?: Variant; size?: Size; block?: boolean } = {}) {
  return `${base} ${sizes[size]} ${variants[variant]} ${block ? "w-full sm:w-auto" : ""}`;
}

interface LinkButtonProps extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: Variant;
  size?: Size;
  /** Lebar penuh di mobile, lebar konten mulai sm. */
  block?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function LinkButton({ variant, size, block = true, icon, className = "", children, ...rest }: LinkButtonProps) {
  return (
    <Link {...rest} className={`${buttonClass({ variant, size, block })} ${className}`}>
      {children}
      {icon}
    </Link>
  );
}

interface ButtonProps extends Omit<ComponentProps<"button">, "className"> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function Button({ variant, size, block = true, icon, className = "", children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} {...rest} className={`${buttonClass({ variant, size, block })} ${className}`}>
      {children}
      {icon}
    </button>
  );
}
