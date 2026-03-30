import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  APP_LOCALES,
  LOCALE_COOKIE_NAME,
  isAppLocale,
} from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isAppLocale(requestedLocale)
    ? requestedLocale
    : APP_LOCALES[0];

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
