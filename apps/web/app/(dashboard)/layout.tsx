import { AppShell } from "@/components/layout/AppShell";
import { WalletGate } from "@/components/layout/WalletGate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletGate>
      <AppShell>{children}</AppShell>
    </WalletGate>
  );
}
