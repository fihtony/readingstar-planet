import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReadingStar Planet — Your Reading Adventure",
  description:
    "A playful reading support app with focus reading, letter cues, and read-aloud tools.",
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link
          rel="preload"
          href="/fonts/OpenDyslexic/OpenDyslexic-Regular.otf"
          as="font"
          type="font/otf"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-[#FFF9F0]">
        <NextIntlClientProvider messages={messages}>
          <ServiceWorkerRegister />
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
