import fs from "fs";
import path from "path";
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

  // Use fs.readFileSync to bypass Node.js module cache so the dev server
  // always picks up the latest translations without a restart.
  const messagesPath = path.join(
    process.cwd(),
    "src/messages",
    `${locale}.json`
  );
  const messages = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));

  return {
    locale,
    messages,
  };
});
