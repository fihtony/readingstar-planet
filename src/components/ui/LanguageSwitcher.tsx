"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE_NAME } from "@/i18n/config";

interface LanguageSwitcherProps {
  currentLocale: string;
}

const LOCALES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
];

export function LanguageSwitcher({
  currentLocale,
}: LanguageSwitcherProps) {
  const router = useRouter();

  const handleSwitch = (locale: string) => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <div
      className="flex gap-1"
      role="radiogroup"
      aria-label="Language selection"
    >
      {LOCALES.map((locale) => (
        <button
          key={locale.code}
          className={`btn-kid px-3 py-2 text-sm rounded-xl ${
            currentLocale === locale.code
              ? "bg-sky-100 text-sky-700 border-2 border-sky-300"
              : "bg-gray-50 text-gray-600"
          }`}
          onClick={() => handleSwitch(locale.code)}
          role="radio"
          aria-checked={currentLocale === locale.code}
          aria-label={locale.label}
        >
          {locale.flag} {locale.label}
        </button>
      ))}
    </div>
  );
}
