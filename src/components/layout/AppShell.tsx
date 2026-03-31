"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSceneBackdrop } from "@/components/layout/AppBranding";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  if (isHomePage) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <div className="relative min-h-screen">
      <AppSceneBackdrop />
      <div className="relative z-10">
        <AppHeader />
        <main id="main-content" className="mx-auto max-w-5xl px-4 py-6">
          <div className="rounded-2xl bg-white/90 backdrop-blur-sm p-6 shadow-lg shadow-black/10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}