/** Kerangka pemuatan yang meniru bentuk daftar akhir (bukan spinner layar penuh). */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="divide-y divide-garis overflow-hidden rounded-panel border border-garis bg-permukaan">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-4 px-4 py-3">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded-kontrol bg-kertas" />
            <div className="h-3 w-2/3 rounded-kontrol bg-kertas" />
          </div>
        </div>
      ))}
    </div>
  );
}
