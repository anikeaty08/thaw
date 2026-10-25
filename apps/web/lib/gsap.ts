"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

// Registered once for the whole client bundle; import GSAP from here, never from "gsap" directly.
gsap.registerPlugin(useGSAP, ScrollTrigger, ScrambleTextPlugin, SplitText);

/** Characters the scramble effect draws from while text is still "frozen". */
export const NOISE_CHARS = "▖▗▘▝▚▞░▒#%&*+=<>/\\";

export const EASE_OUT = "expo.out";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
