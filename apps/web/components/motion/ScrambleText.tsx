"use client";

import { useRef } from "react";
import clsx from "clsx";
import { NOISE_CHARS, ScrollTrigger, gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

/**
 * Text that arrives as noise and resolves into words, the first time it scrolls into view and again
 * whenever `text` changes (a live figure loading in, say). There is exactly one copy of the real
 * text: it holds the layout and is what screen readers hear and people copy. While it animates it
 * is see-through, and a decorative layer on top draws the noise; when done, the layer clears.
 */
export function ScrambleText({
  text,
  duration = 1.1,
  delay = 0,
  className,
}: {
  text: string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const real = useRef<HTMLSpanElement>(null);
  const noise = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = real.current;
      const layer = noise.current;
      if (!el || !layer || prefersReducedMotion()) return;

      const settle = () => {
        el.style.color = "";
        layer.textContent = "";
      };
      // Start frozen: the real text hidden, noise of the same shape in its place.
      el.style.color = "transparent";
      layer.textContent = text.replace(/\S/g, () => NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]);

      const tween = gsap.to(layer, {
        duration,
        delay,
        ease: "none",
        paused: true,
        scrambleText: { text, chars: NOISE_CHARS, revealDelay: duration * 0.3, speed: 0.6 },
        onComplete: settle,
      });
      const trigger = ScrollTrigger.create({ trigger: el, start: "top 92%", once: true, onEnter: () => tween.play() });
      return () => {
        trigger.kill();
        tween.kill();
        settle();
      };
    },
    { dependencies: [text, duration, delay] },
  );

  return (
    <span className={clsx("relative inline-block", className)}>
      <span ref={real}>{text}</span>
      <span ref={noise} aria-hidden className="pointer-events-none absolute inset-0 select-none" />
    </span>
  );
}
