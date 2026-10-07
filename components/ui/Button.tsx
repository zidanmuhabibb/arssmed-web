import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "utama" | "kedua";

const base =
  "tekan inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-7 text-[1.05rem] font-semibold no-underline select-none";

const variants: Record<Variant, string> = {
  // Satu aksen: tombol utama memakai --matahari dengan teks --tinta (PRD §8.2).
  utama: "bg-matahari text-matahari-tinta active:bg-matahari-tekan",
  kedua: "border-2 border-garis bg-permukaan text-tinta active:bg-kertas",
};

interface LinkButtonProps extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: Variant;
  /** Lebar penuh di mobile, lebar konten mulai sm. */
  block?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function LinkButton({ variant = "utama", block = true, icon, className = "", children, ...rest }: LinkButtonProps) {
  return (
    <Link
      {...rest}
      className={`${base} ${variants[variant]} ${block ? "w-full sm:w-auto" : ""} ${className}`}
    >
      {children}
      {icon}
    </Link>
  );
}
