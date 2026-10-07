import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** Daftar berkelompok: satu panel, pemisah garis rambut, tanpa bayangan. */
export function ListGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section aria-label={label}>
      {label ? <h2 className="mb-2 px-1 font-isi text-sm font-semibold text-tinta-2">{label}</h2> : null}
      <ul className="divide-y divide-garis overflow-hidden rounded-panel border border-garis bg-permukaan">
        {children}
      </ul>
    </section>
  );
}

interface ListRowProps {
  href: string;
  title: string;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function ListRow({ href, title, hint, leading, trailing }: ListRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-16 items-center gap-4 px-4 py-3 text-tinta no-underline transition-colors duration-100 active:bg-kertas"
      >
        {leading ? <span className="flex shrink-0 items-center justify-center">{leading}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">{title}</span>
          {hint ? <span className="block text-[0.875rem] leading-snug text-tinta-2">{hint}</span> : null}
        </span>
        {trailing}
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-tinta-2" />
      </Link>
    </li>
  );
}
