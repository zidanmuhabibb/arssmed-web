"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Dialog modal memakai <dialog> bawaan (fokus terkunci, Esc menutup, latar inert).
 * Dipakai untuk konfirmasi tindakan merusak dan menampilkan PIN baru.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  labelledBy = "dialog-title",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(92vw,28rem)] rounded-panel border border-garis bg-permukaan p-0 text-tinta backdrop:bg-[#0b1626]/60"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={labelledBy} className="text-[1.4rem] font-bold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
