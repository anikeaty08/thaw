"use client";

import { useRef } from "react";
import { ThawMark } from "@/components/ui/ThawMark";
import { EASE_OUT, NOISE_CHARS, gsap, useGSAP } from "@/lib/gsap";
import { INTRO_SESSION_KEY } from "@/lib/motionInit";

const TAGLINE = "Self-repaying credit on Mezo";

const listeners = new Set<() => void>();

function isPlaying() {
  return document.documentElement.dataset.intro === "play";
}

/** Calls `cb` once the curtain starts lifting, or right away when there is no curtain. */
export function onIntroDone(cb: () => void): () => void {
  if (!isPlaying()) {
    cb();
    return () => {};
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function finishIntro() {
  // Flip the flag first so anything subscribing from here on runs immediately.
  document.documentElement.dataset.intro = "lifting";
  listeners.forEach((cb) => cb());
  listeners.clear();
}

export function IntroCurtain() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || !isPlaying()) return;
      el.style.animation = "none"; // GSAP is in charge; drop the no-JS safety fade.

      const tl = gsap.timeline({
        defaults: { ease: EASE_OUT },
        onComplete: () => {
          document.documentElement.dataset.intro = "done";
          try {
            sessionStorage.setItem(INTRO_SESSION_KEY, "1");
          } catch {
            // Storage blocked: the intro simply plays again next load.
          }
        },
      });

      tl.from("[data-intro-mark]", { scale: 0.3, rotate: -180, autoAlpha: 0, duration: 0.9 })
        .from("[data-intro-char]", { yPercent: 110, rotateX: -90, autoAlpha: 0, duration: 0.8, stagger: 0.08 }, 0.15)
        .fromTo("[data-intro-bar]", { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power2.inOut" }, 0.25)
        .to(
          "[data-intro-tag]",
          { duration: 0.9, ease: "none", scrambleText: { text: TAGLINE, chars: NOISE_CHARS, revealDelay: 0.35, speed: 0.7 } },
          0.45,
        )
        .to("[data-intro-char]", { yPercent: -110, autoAlpha: 0, duration: 0.45, stagger: 0.04, ease: "power3.in" }, "+=0.25")
        .to(["[data-intro-mark]", "[data-intro-tag]", "[data-intro-bar]"], { autoAlpha: 0, duration: 0.35, ease: "power2.in" }, "<")
        .add(finishIntro, "-=0.1")
        .to(el, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.8, ease: "expo.inOut" }, "<");

      // Any click or key skips ahead instead of making people wait.
      const skip = () => tl.timeScale(5);
      window.addEventListener("pointerdown", skip, { once: true });
      window.addEventListener("keydown", skip, { once: true });
      return () => {
        window.removeEventListener("pointerdown", skip);
        window.removeEventListener("keydown", skip);
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="intro-curtain fixed inset-0 z-[100] items-center justify-center bg-glacier-950" aria-hidden>
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="hero-glow pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col items-center">
        <span data-intro-mark>
          <ThawMark size={56} />
        </span>
        <span className="display mt-5 flex overflow-hidden text-[clamp(3.5rem,12vw,7.5rem)] leading-none [perspective:600px]">
          {"Thaw".split("").map((c, i) => (
            <span key={i} data-intro-char className="inline-block">
              {c}
            </span>
          ))}
        </span>
        {/* Starts empty: the tagline scrambles in from noise. */}
        <span data-intro-tag className="mt-4 h-4 font-mono text-xs uppercase tracking-[0.28em] text-mist-400" />
        <span className="mt-8 h-px w-48 overflow-hidden rounded-full bg-glacier-700">
          <span data-intro-bar className="block h-full origin-left bg-thaw-gradient" />
        </span>
      </div>
    </div>
  );
}
