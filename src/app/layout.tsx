import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppHeader } from "@/components/layout/AppHeader";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReadingStar Planet — Your Reading Adventure",
  description:
    "A fun, kid-friendly reading assistant for children with dyslexia. Features focus reading, letter helpers, and text-to-speech.",
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
          <AppHeader />

          <main id="main-content" className="max-w-5xl mx-auto px-4 py-6">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
