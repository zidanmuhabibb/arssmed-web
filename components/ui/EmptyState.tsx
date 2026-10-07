import type { ReactNode } from "react";

/** Kondisi kosong = ajakan bertindak (PRD §8.6). */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-panel border border-garis bg-permukaan p-6 sm:p-8">
      <span className="flex size-14 items-center justify-center rounded-full bg-kertas text-tinta" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h2 className="text-[1.5rem] font-bold">{title}</h2>
        <p className="mt-1 max-w-[60ch] text-tinta-2">{body}</p>
      </div>
      {action}
    </div>
  );
}
