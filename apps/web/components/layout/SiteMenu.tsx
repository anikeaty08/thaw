"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/ui/ThawMark";
import { RollText } from "@/components/motion/RollText";
import { EASE_OUT, gsap, prefersReducedMotion } from "@/lib/gsap";

// Only the public story: the landing page's sections and the docs. The app has its own navigation.
const LINKS = [
  { href: "/#lifecycle", label: "How it works", note: "From frozen to free" },
  { href: "/#story", label: "One loan", note: "Watch the debt melt" },
  { href: "/#modes", label: "Two ways to borrow", note: "Advance or Credit Line" },
  { href: "/#lenders", label: "Lend MUSD", note: "The tMUSD vault" },
  { href: "/docs", label: "Docs", note: "Contracts and parameters" },
];

/**
 * A six-dot button in the centre of the header that opens a full-screen panel on a native modal
 * <dialog> (focus trap and Esc for free). The panel thaws in: it wipes down out of a frost blur,
 * then the links rise from their masks one after another.
 */
export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const reduce = prefersReducedMotion();

    if (open && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
      if (!reduce) {
        gsap
          .timeline({ defaults: { ease: EASE_OUT } })
          .fromTo(
            d,
            { clipPath: "inset(0% 0% 100% 0%)", filter: "blur(14px)" },
            { clipPath: "inset(0% 0% 0% 0%)", filter: "blur(0px)", duration: 0.8, ease: "expo.inOut" },
          )
          .fromTo(d.querySelectorAll("[data-menu-link]"), { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.07 }, 0.35)
          .fromTo(d.querySelectorAll("[data-menu-fade]"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.05 }, 0.55);
      }
    } else if (!open && d.open) {
      const finish = () => {
        d.close();
        document.documentElement.style.overflow = "";
      };
      if (reduce) finish();
      else gsap.to(d, { clipPath: "inset(100% 0% 0% 0%)", duration: 0.6, ease: "expo.inOut", onComplete: finish });
    }
  }, [open]);

  // Changing page closes the menu (same-page section links close it on click).
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <MenuDots label="Open menu" expanded={open} onClick={() => setOpen(true)} />

      <dialog
        ref={dialog}
        aria-label="Site menu"
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        className="site-menu"
      >
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.16]" aria-hidden />
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative mx-auto flex min-h-full max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
          {/* Mirrors the header: mark on the left, the same dots in the same centre spot. */}
          <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center">
            <Link href="/" aria-label="Thaw home" onClick={() => setOpen(false)} className="justify-self-start">
              <Wordmark size={24} />
            </Link>
            <MenuDots label="Close menu" expanded onClick={() => setOpen(false)} active />
          </div>

          <nav aria-label="Site" className="flex flex-1 items-center justify-center py-10">
            <ol className="flex flex-col items-center gap-3 text-center sm:gap-4">
              {LINKS.map((link, i) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={() => setOpen(false)} className="roll-host group flex flex-col items-center px-4 py-1">
                    <span className="flex items-start gap-2 sm:gap-3">
                      <span data-menu-fade className="mt-1.5 font-mono text-[11px] text-mist-500 sm:mt-3">
                        0{i + 1}
                      </span>
                      <span className="overflow-hidden">
                        <span
                          data-menu-link
                          className="display block text-[clamp(2.2rem,6vw,4.6rem)] leading-[1.05] text-frostwhite transition-colors group-hover:text-frost-200"
                        >
                          <RollText text={link.label} />
                        </span>
                      </span>
                    </span>
                    <span data-menu-fade className="text-sm text-mist-500 transition-colors group-hover:text-mist-300">
                      {link.note}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </dialog>
    </>
  );
}

function MenuDots({ label, expanded, onClick, active = false }: { label: string; expanded: boolean; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      className="roll-host flex h-11 w-11 items-center justify-center rounded-full text-frostwhite transition-colors hover:bg-glacier-800"
    >
      <span className={active ? "menu-dots is-open" : "menu-dots"} aria-hidden>
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}
