"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  if (isHomePage) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <>
      <AppHeader />
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>
    </>
  );
}