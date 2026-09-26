"use client";

export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  ariaLabel,
  ariaValueText,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  ariaValueText?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <input
      type="range"
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="block h-6 w-full cursor-pointer appearance-none bg-transparent outline-none
        focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-frost-400/40
        [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[image:var(--track)]
        [&::-webkit-slider-thumb]:mt-[-7px] [&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:w-[22px]
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
        [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-frostwhite
        [&::-webkit-slider-thumb]:bg-frost-500 [&::-webkit-slider-thumb]:shadow-glow [&::-webkit-slider-thumb]:transition-transform
        active:[&::-webkit-slider-thumb]:scale-110
        [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[image:var(--track)]
        [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
        [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-frostwhite [&::-moz-range-thumb]:bg-frost-500"
      style={
        {
          "--track": `linear-gradient(90deg, #0052ff 0%, #2d9cff ${pct}%, rgb(var(--glacier-700)) ${pct}%, rgb(var(--glacier-700)) 100%)`,
        } as React.CSSProperties
      }
    />
  );
}
