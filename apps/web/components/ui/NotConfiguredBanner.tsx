import { Icon } from "./Icon";

export function NotConfiguredBanner() {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-2xl border border-ember-500/25 bg-ember-500/[0.06] px-5 py-4">
      <Icon name="warning" size={18} className="mt-0.5 text-ember-400" />
      <div className="text-sm text-mist-300">
        <p className="font-medium text-frostwhite">Contracts aren't connected yet</p>
        <p className="mt-1 leading-relaxed text-mist-400">
          Figures show "—" until you set the{" "}
          <code className="rounded bg-glacier-900 px-1 py-0.5 font-mono text-xs">NEXT_PUBLIC_*_ADDRESS</code> variables in{" "}
          <code className="rounded bg-glacier-900 px-1 py-0.5 font-mono text-xs">apps/web/.env.local</code>. Run{" "}
          <code className="rounded bg-glacier-900 px-1 py-0.5 font-mono text-xs">forge script script/Deploy.s.sol --broadcast</code>{" "}
          to get them.
        </p>
      </div>
    </div>
  );
}
