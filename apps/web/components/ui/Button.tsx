import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function buttonClasses({ variant = "primary", size = "md" }: Pick<ButtonProps, "variant" | "size"> = {}) {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:-translate-y-px active:translate-y-0 disabled:pointer-events-none disabled:opacity-45",
    size === "lg" && "min-h-[48px] px-6 text-[15px]",
    size === "md" && "min-h-[44px] px-[18px] text-sm",
    size === "sm" && "min-h-[36px] px-3.5 text-xs",
    variant === "primary" && "border border-frost-500 bg-frost-500 text-white hover:bg-frost-400 hover:shadow-glow",
    variant === "secondary" && "border border-glacier-600 bg-glacier-900 text-frostwhite hover:border-frost-400",
    variant === "ghost" && "text-mist-300 hover:bg-glacier-800 hover:text-frostwhite",
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return <button ref={ref} type={type} className={clsx(buttonClasses({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
