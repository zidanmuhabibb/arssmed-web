import { AppNav } from "@/components/nav/AppNav";

/** Kerangka aplikasi siswa: navigasi + area isi. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:pl-(--rel-lebar)">
      <AppNav />
      <main
        id="isi"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-4 pt-5 pb-[calc(var(--tab-tinggi)+env(safe-area-inset-bottom)+2rem)] outline-none sm:px-6 lg:px-10 lg:pt-10 lg:pb-12"
      >
        {children}
      </main>
    </div>
  );
}
