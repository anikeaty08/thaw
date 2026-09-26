"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Icon } from "@/components/ui/Icon";
import { Wordmark } from "@/components/ui/ThawMark";
import { NextHarvest } from "@/components/ui/NextHarvest";
import { NAV, isActive } from "./nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-glacier-700 bg-glacier-950 px-4 py-7 lg:flex">
      <Link href="/" className="px-2" aria-label="Thaw home">
        <Wordmark />
      </Link>

      <nav className="mt-10 flex flex-col gap-1" aria-label="Main">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-glacier-800 text-frostwhite" : "text-mist-400 hover:bg-glacier-800/60 hover:text-frostwhite",
              )}
            >
              {active && <span className="absolute inset-y-2 -left-4 w-[3px] rounded-r-full bg-frost-400" aria-hidden />}
              <Icon
                name={item.icon}
                size={20}
                className={clsx(active ? "text-frost-300" : "text-mist-500 group-hover:text-mist-300")}
              />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        <NextHarvest />
        <div className="flex items-center gap-2 px-2 text-xs text-mist-500">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
          Mezo testnet, chain 31611
        </div>
      </div>
    </aside>
  );
}
