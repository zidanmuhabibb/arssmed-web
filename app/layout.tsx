import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import "@fontsource/baloo-2/latin-700.css";
import "@fontsource/baloo-2/latin-800.css";
import "@fontsource-variable/lexend/wght.css";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { pickMessages } from "@/lib/i18n-pick";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("description"),
    applicationName: t("name"),
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
    formatDetection: { telephone: false },
    icons: {
      icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef3f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1a27" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("app");
  // Namespace untuk komponen klien area siswa; area guru menambah miliknya sendiri.
  const messages = await pickMessages(["app", "nav", "masuk", "akun"]);
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full">
        <a href="#isi" className="lewati">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
