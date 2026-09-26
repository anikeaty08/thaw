import type { IconName } from "@/components/ui/Icon";

export const NAV: { href: string; label: string; icon: IconName; blurb: string }[] = [
  { href: "/portfolio", label: "Portfolio", icon: "wallet", blurb: "Your loans and locks" },
  { href: "/lend", label: "Lend", icon: "coins", blurb: "Earn on MUSD" },
  { href: "/auctions", label: "Auctions", icon: "gavel", blurb: "Buy defaulted veNFTs" },
  { href: "/transparency", label: "Transparency", icon: "eye", blurb: "Parameters and flows" },
];

export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  // A loan detail page belongs to the portfolio.
  if (href === "/portfolio" && pathname.startsWith("/loans")) return true;
  return pathname.startsWith(href);
}
