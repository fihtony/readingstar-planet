"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AppWordmark } from "@/components/layout/AppBranding";

export function AppHeader() {
  const nav = useTranslations("nav");
  const app = useTranslations("app");

  return (
    <header className="sticky top-0 z-50 bg-[#0b2144]/85 backdrop-blur-md border-b border-white/10">
      <nav className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          aria-label={app("name")}
          className="flex min-w-0 items-center transition-opacity hover:opacity-80"
        >
          <AppWordmark className="block max-w-full truncate" />
        </Link>
        <Link
          href="/settings"
          aria-label={nav("settings")}
          title={nav("settings")}
          className="group relative flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110"
        >
          <Image
            src="/images/settings_dark.png"
            alt=""
            width={32}
            height={32}
            aria-hidden="true"
            className="select-none object-contain opacity-100 transition-opacity duration-200 group-hover:opacity-0"
          />
          <Image
            src="/images/settings_lit.png"
            alt=""
            width={32}
            height={32}
            aria-hidden="true"
            className="absolute inset-0 m-auto select-none object-contain opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
        </Link>
      </nav>
    </header>
  );
}