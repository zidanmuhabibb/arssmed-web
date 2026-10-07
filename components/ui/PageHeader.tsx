import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  lead?: string;
  /** Tautan kembali untuk halaman yang dibuka dari Beranda (bukan tab utama). */
  back?: { href: string; label: string };
}

export function PageHeader({ title, lead, back }: PageHeaderProps) {
  return (
    <header className="mb-6">
      {back ? (
        <Link
          href={back.href}
          className="-ml-2 mb-2 inline-flex min-h-12 items-center gap-1 rounded-kontrol px-2 font-semibold text-laut-teks no-underline"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          {back.label}
        </Link>
      ) : null}
      <h1 className="text-[2rem] font-extrabold tracking-[-0.01em] sm:text-[2.4rem]">{title}</h1>
      {lead ? <p className="mt-2 max-w-[60ch] text-tinta-2">{lead}</p> : null}
    </header>
  );
}
