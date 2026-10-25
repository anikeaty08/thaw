"use client";

import { useRef } from "react";
import clsx from "clsx";
import { ScrollTrigger, gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";
import { onIntroDone } from "./IntroCurtain";

/**
 * Types each word out letter by letter, holds it, deletes it, then types the next, with a blinking
 * caret. An invisible copy of the longest word reserves the space, so nothing around it shifts.
 * Pauses on hover and while off screen; with reduced motion the first word just sits there.
 * The words are decorative: put the sentence the reader should hear in an sr-only sibling.
 */
export function TypeWords({
  words,
  hold = 1.8,
  className,
  textClassName,
}: {
  words: string[];
  /** Seconds a finished word stays up before it is deleted. */
  hold?: number;
  className?: string;
  /** Applied to the typed text, e.g. a gradient fill. */
  textClassName?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");

  useGSAP(
    () => {
      const el = root.current;
      const out = text.current;
      if (!el || !out || words.length < 2 || prefersReducedMotion()) return;

      const show = (s: string) => {
        // A zero-width space keeps the line box (and the gradient) alive while the word is empty.
        out.textContent = s || "​";
      };
      const tl = gsap.timeline({ repeat: -1, paused: true });
      words.forEach((word, i) => {
        const next = words[(i + 1) % words.length];
        tl.to({}, { duration: hold });
        for (let k = word.length - 1; k >= 0; k--) tl.call(show, [word.slice(0, k)], "+=0.04");
        tl.to({}, { duration: 0.25 });
        for (let k = 1; k <= next.length; k++) tl.call(show, [next.slice(0, k)], `+=${0.07 + Math.random() * 0.05}`);
      });

      let hovered = false;
      let onScreen = true;
      const sync = () => (hovered || !onScreen ? tl.pause() : tl.resume());
      const enter = () => ((hovered = true), sync());
      const leave = () => ((hovered = false), sync());
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      const visibility = ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => ((onScreen = self.isActive), sync()),
      });
      const unsubscribe = onIntroDone(() => tl.play());

      return () => {
        unsubscribe();
        visibility.kill();
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
        show(words[0]);
      };
    },
    { scope: root, dependencies: [words.join("|"), hold] },
  );

  return (
    <span ref={root} aria-hidden className={clsx("relative inline-grid whitespace-nowrap", className)}>
      <span className="invisible [grid-area:1/1]">{longest}</span>
      <span className="[grid-area:1/1]">
        <span ref={text} className={textClassName}>
          {words[0]}
        </span>
        <span className="type-caret" />
      </span>
    </span>
  );
}
