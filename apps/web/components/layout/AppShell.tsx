import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { SiteFooter } from "./SiteFooter";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="page-glow flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</main>
        <SiteFooter variant="compact" />
      </div>
      <MobileNav />
    </div>
  );
}
