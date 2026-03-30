"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export function AppHeader() {
  const nav = useTranslations("nav");
  const app = useTranslations("app");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <nav className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold"
          style={{ color: "var(--color-warm-orange)" }}
        >
          <span className="text-2xl">🌍</span>
          <span className="hidden sm:inline">{app("name")}</span>
        </Link>
        <div className="flex items-center gap-2">
          <NavLink href="/" active={pathname === "/"}>
            🗺️ <span className="hidden sm:inline">{nav("home")}</span>
          </NavLink>
          <NavLink href="/library" active={pathname === "/library"}>
            📚 <span className="hidden sm:inline">{nav("library")}</span>
          </NavLink>
          <NavLink href="/settings" active={pathname === "/settings"}>
            ⚙️ <span className="hidden sm:inline">{nav("settings")}</span>
          </NavLink>
          <LanguageSwitcher currentLocale={locale} />
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`btn-kid px-3 py-2 text-sm rounded-xl ${
        active
          ? "bg-sky-100 text-sky-700 border-2 border-sky-200"
          : "bg-gray-50 text-gray-600 hover:bg-sky-50"
      }`}
    >
      {children}
    </Link>
  );
}