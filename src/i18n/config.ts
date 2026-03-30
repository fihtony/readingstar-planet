export const APP_LOCALES = ["en", "zh"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const LOCALE_COOKIE_NAME = "readingstar-locale";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "en" || value === "zh";
}