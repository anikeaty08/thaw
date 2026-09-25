"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Icon } from "@/components/ui/Icon";
import { NAV, isActive } from "./nav";

// Thumb-reach tab bar for phones; the sidebar takes over from lg up.
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-glacier-700 bg-glacier-950/90 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-frostwhite" : "text-mist-500",
                )}
              >
                {active && <span className="absolute inset-x-6 top-0 h-[2px] rounded-b-full bg-frost-400" aria-hidden />}
                <Icon name={item.icon} size={22} className={active ? "text-frost-300" : undefined} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
