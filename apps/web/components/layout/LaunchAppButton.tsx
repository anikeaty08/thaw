"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import clsx from "clsx";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * The way into the app from public pages. The app needs a connected wallet, so when there isn't one
 * this opens the wallet modal first and carries on to `href` the moment a wallet connects.
 */
export function LaunchAppButton({
  href = "/portfolio",
  children = "Launch app",
  variant = "primary",
  size = "md",
  arrow = false,
  className,
}: {
  href?: string;
  children?: ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  arrow?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (pending && isConnected) {
      setPending(false);
      router.push(href);
    }
  }, [pending, isConnected, href, router]);

  function launch() {
    if (isConnected) {
      router.push(href);
      return;
    }
    setPending(true);
    openConnectModal?.();
  }

  return (
    <button
      type="button"
      onClick={launch}
      onMouseEnter={() => router.prefetch(href)}
      className={clsx(buttonClasses({ variant, size }), arrow && "group", className)}
    >
      {children}
      {arrow && <Icon name="arrow-right" size={16} className="transition-transform duration-200 group-hover:translate-x-1" />}
    </button>
  );
}
