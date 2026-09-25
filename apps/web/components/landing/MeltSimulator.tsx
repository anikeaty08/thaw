"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { Icon } from "@/components/ui/Icon";
import { Slider } from "@/components/ui/Slider";

// Illustrative Advance terms, mirroring the deployed demo bucket in RiskEngine:
// max advance = income × haircut × k, and weekly paydown = income × haircut × repayShare.
const ADVANCE_WEEKS = 10;
const HAIRCUT = 0.75;
const APR = 0.06;

// Ice block geometry inside the 240×300 viewBox.
const BLOCK_TOP = 28;
const BLOCK_BASE = 206;
const BLOCK_H = BLOCK_BASE - BLOCK_TOP;

interface Week {
  debt: number;
  repaid: number;
}

function simulate(weekly: number): { loan: number; weeks: Week[] } {
  const loan = weekly * HAIRCUT * ADVANCE_WEEKS;
  const paydown = weekly * HAIRCUT;
  const weeks: Week[] = [{ debt: loan, repaid: 0 }];
  let debt = loan;
  let repaid = 0;
  while (debt > 0.005 && weeks.length < 60) {
    debt += (debt * APR) / 52;
    const pay = Math.min(debt, paydown);
    debt -= pay;
    repaid += pay;
    weeks.push({ debt, repaid });
  }
  return { loan, weeks };
}

const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

export function MeltSimulator() {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const [weekly, setWeekly] = useState(60);
  const [week, setWeek] = useState(0);
  const [playing, setPlaying] = useState(false);

  const { loan, weeks } = useMemo(() => simulate(weekly), [weekly]);
  const lastWeek = weeks.length - 1;
  const current = weeks[Math.min(week, lastWeek)];
  const ratio = loan > 0 ? current.debt / loan : 0;
  const paidOff = week >= lastWeek;
  const totalInterest = weeks[lastWeek].repaid - loan;

  // Changing the rewards resets the story.
  useEffect(() => {
    setWeek(0);
    setPlaying(false);
  }, [weekly]);

  useEffect(() => {
    if (!playing) return;
    if (week >= lastWeek) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setWeek((w) => w + 1), reduceMotion ? 120 : 520);
    return () => clearTimeout(id);
  }, [playing, week, lastWeek, reduceMotion]);

  function togglePlay() {
    if (paidOff) {
      setWeek(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }

  const iceTop = BLOCK_TOP + BLOCK_H * (1 - ratio);
  const poolLevel = loan > 0 ? Math.min(1, current.repaid / weeks[lastWeek].repaid) : 0;
  const spring = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 18 };

  return (
    <div className="frost-panel-faceted overflow-hidden p-5 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)] sm:items-center">
        {/* The block */}
        <figure className="mx-auto w-full max-w-[200px] sm:max-w-none">
          <svg
            viewBox="0 0 240 300"
            className="w-full"
            role="img"
            aria-label={`Ice block at ${Math.round(ratio * 100)}% of its size: ${fmt(current.debt)} MUSD of debt left after ${week} Thursdays.`}
          >
            <defs>
              <linearGradient id={`ice-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#dcecff" stopOpacity="0.55" />
                <stop offset="0.5" stopColor="#2d9cff" stopOpacity="0.28" />
                <stop offset="1" stopColor="#087cff" stopOpacity="0.22" />
              </linearGradient>
              <linearGradient id={`pool-${uid}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#ffc48a" />
                <stop offset="1" stopColor="#f77f3a" />
              </linearGradient>
              <clipPath id={`melt-${uid}`}>
                <motion.rect x="0" width="240" initial={false} animate={{ y: iceTop, height: BLOCK_BASE - iceTop + 2 }} transition={spring} />
              </clipPath>
              <clipPath id={`tray-${uid}`}>
                <path d="M40 236 L200 236 L192 284 Q190 290 184 290 L56 290 Q50 290 48 284 Z" />
              </clipPath>
            </defs>

            {/* Ghost outline of the original loan */}
            <rect x="50" y={BLOCK_TOP} width="140" height={BLOCK_H} rx="6" fill="none" stroke="#2d9cff" strokeOpacity="0.14" strokeDasharray="3 5" />

            {/* Ice, revealed from the bottom up by the clip */}
            <g clipPath={`url(#melt-${uid})`}>
              <rect x="50" y={BLOCK_TOP} width="140" height={BLOCK_H} rx="6" fill={`url(#ice-${uid})`} stroke="#7cc0ff" strokeOpacity="0.55" />
              {/* facets */}
              <path
                d={`M50 ${BLOCK_TOP + 40} L112 ${BLOCK_TOP + 78} L190 ${BLOCK_TOP + 30} M112 ${BLOCK_TOP + 78} L96 ${BLOCK_BASE} M112 ${BLOCK_TOP + 78} L150 ${BLOCK_TOP + 132} L190 ${BLOCK_TOP + 118} M150 ${BLOCK_TOP + 132} L136 ${BLOCK_BASE} M50 ${BLOCK_TOP + 120} L96 ${BLOCK_TOP + 150}`}
                className="stroke-frost-100"
                strokeOpacity="0.2"
                fill="none"
              />
              <rect x="58" y={BLOCK_TOP + 8} width="6" height={BLOCK_H - 16} rx="3" fill="#eef6ff" opacity="0.12" />
            </g>

            {/* Wet, uneven top edge that rides the melt line */}
            {ratio > 0.01 && (
              <motion.path
                initial={false}
                animate={{ y: iceTop }}
                transition={spring}
                d="M50 0 Q62 5 74 1 T98 2 T124 0 T150 3 T176 1 T190 0"
                className="stroke-frost-300"
                strokeOpacity="0.8"
                strokeWidth="1.5"
                fill="none"
              />
            )}

            {/* Drips while Thursdays are passing */}
            {!paidOff && week > 0 && (
              <g fill="#ffc48a">
                {[86, 122, 158].map((x, i) => (
                  <circle
                    key={x}
                    cx={x}
                    cy={BLOCK_BASE + 6}
                    r="2.6"
                    className={playing ? "animate-drip" : "opacity-0"}
                    style={{ animationDelay: `${i * 0.45}s` }}
                  />
                ))}
              </g>
            )}

            {/* The tray: repaid MUSD collects here */}
            <g clipPath={`url(#tray-${uid})`}>
              <rect x="40" y="236" width="160" height="56" className="fill-glacier-800" />
              <motion.rect
                x="40"
                width="160"
                fill={`url(#pool-${uid})`}
                initial={false}
                animate={{ y: 290 - 54 * poolLevel, height: 54 * poolLevel + 2 }}
                transition={spring}
                opacity="0.9"
              />
            </g>
            <path d="M40 236 L200 236 L192 284 Q190 290 184 290 L56 290 Q50 290 48 284 Z" fill="none" stroke="#ffc48a" strokeOpacity="0.35" />
          </svg>
        </figure>

        {/* Readouts and controls */}
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-mist-400">
                <Icon name="snowflake" size={14} className="text-frost-300" />
                Debt left
              </div>
              <div className="tabular mt-1 font-display text-3xl font-semibold text-frost-200">
                {fmt(current.debt)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-mist-400">
                <Icon name="drop" size={14} className="text-ember-400" />
                Paid by rewards
              </div>
              <div className="tabular mt-1 font-display text-3xl font-semibold text-ember-400">
                {fmt(current.repaid)}
              </div>
            </div>
          </div>

          {/* One tick per Thursday */}
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-mist-400">Thursdays passed</span>
              <span className="tabular text-frostwhite">
                {Math.min(week, lastWeek)} of {lastWeek}
              </span>
            </div>
            {/* A transparent range input sits over the ticks: drag, tap or use arrow keys. */}
            <div className="relative mt-2 rounded-md focus-within:ring-2 focus-within:ring-frost-400 focus-within:ring-offset-2 focus-within:ring-offset-glacier-800">
              <div className="flex gap-[3px]" aria-hidden>
                {weeks.slice(1).map((_, i) => (
                  <span
                    key={i}
                    className={clsx("h-7 flex-1 rounded-[3px] transition-colors duration-300", i < week ? "bg-ember-500/85" : "bg-glacier-700")}
                  />
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={lastWeek}
                value={Math.min(week, lastWeek)}
                onChange={(e) => {
                  setPlaying(false);
                  setWeek(Number(e.target.value));
                }}
                aria-label="Thursdays passed"
                aria-valuetext={`${Math.min(week, lastWeek)} of ${lastWeek} Thursdays, ${fmt(current.debt)} MUSD left`}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-glacier-600 bg-glacier-900/70 px-4 text-sm font-medium text-frost-100 transition-colors hover:border-frost-400/45"
            >
              <Icon name={paidOff ? "check" : "calendar"} size={16} className={paidOff ? "text-ember-400" : "text-frost-300"} />
              {playing ? "Pause" : paidOff ? "Paid off. Replay" : week === 0 ? "Play the Thursdays" : "Keep going"}
            </button>
          </div>

          <div className="mt-6 border-t border-glacier-700 pt-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="whitespace-nowrap text-mist-300">Your lock earns</span>
              <span className="tabular whitespace-nowrap font-medium text-frostwhite">{weekly} MUSD / week</span>
            </div>
            <div className="mt-3">
              <Slider min={10} max={250} step={5} value={weekly} onChange={setWeekly} ariaLabel="Weekly rewards your lock earns, in MUSD" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-mist-500">
              Advance of <span className="tabular text-mist-300">{fmt(loan)} MUSD</span> today. Paid off in{" "}
              <span className="tabular text-mist-300">{lastWeek} weeks</span> with{" "}
              <span className="tabular text-mist-300">{fmt(totalInterest)} MUSD</span> of interest, and nothing out of
              your pocket.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
