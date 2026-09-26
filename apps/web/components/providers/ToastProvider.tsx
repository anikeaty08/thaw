"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { Icon } from "@/components/ui/Icon";

const EXPLORER = "https://explorer.test.mezo.org";

type Status = "pending" | "success" | "error";

interface Toast {
  id: number;
  status: Status;
  title: string;
  body?: string;
  hash?: `0x${string}`;
}

export interface TxLabels {
  /** Shown while waiting, e.g. "Depositing 500 MUSD". */
  pending: string;
  /** Shown once mined, e.g. "Deposited 500 MUSD". */
  success: string;
  /** Optional follow-up line on success. */
  successBody?: string;
}

interface ToastApi {
  /** Follow a submitted transaction from pending to its receipt. */
  track: (hash: `0x${string}`, labels: TxLabels) => void;
  /** Report a wallet rejection or a failure before a hash exists. */
  fail: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi>({ track: () => {}, fail: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/** Describe a wagmi/viem write error in plain words. */
export function describeTxError(error: unknown): string {
  const msg = String((error as { shortMessage?: string; message?: string })?.shortMessage ?? (error as Error)?.message ?? "");
  if (/reject|denied|cancel/i.test(msg)) return "You declined the request in your wallet. Nothing was sent.";
  if (/insufficient funds/i.test(msg)) return "This wallet doesn't have enough BTC to pay the network fee.";
  return msg ? msg.split("\n")[0].slice(0, 160) : "Check your wallet and network, then try again.";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const config = useConfig();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const tracked = useRef(new Set<string>());

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { ...toast, id }]);
      return id;
    },
    [],
  );

  const update = useCallback((id: number, patch: Partial<Toast>) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const track = useCallback(
    (hash: `0x${string}`, labels: TxLabels) => {
      if (tracked.current.has(hash)) return; // effects may fire twice for one hash
      tracked.current.add(hash);
      const id = push({ status: "pending", title: labels.pending, body: "Waiting for Mezo to confirm it.", hash });
      waitForTransactionReceipt(config, { hash })
        .then((receipt) => {
          if (receipt.status === "success") {
            update(id, { status: "success", title: labels.success, body: labels.successBody });
          } else {
            update(id, { status: "error", title: "Transaction failed", body: "It was mined but reverted. Nothing changed." });
          }
        })
        .catch(() => update(id, { status: "error", title: "Couldn't confirm the transaction", body: "Check it on the explorer." }));
    },
    [config, push, update],
  );

  const fail = useCallback((title: string, body?: string) => void push({ status: "error", title, body }), [push]);

  return (
    <ToastContext.Provider value={{ track, fail }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const reduce = useReducedMotion();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[76px] z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end lg:bottom-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <ToastCard toast={t} onDismiss={() => onDismiss(t.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  // Settled toasts clear themselves; pending ones stay until their receipt arrives.
  useEffect(() => {
    if (toast.status === "pending") return;
    const id = setTimeout(onDismiss, toast.status === "success" ? 6000 : 9000);
    return () => clearTimeout(id);
  }, [toast.status, onDismiss]);

  return (
    <div
      role={toast.status === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-glacier-600 bg-glacier-900 px-4 py-3 shadow-frost sm:w-[360px]"
    >
      <span className="mt-0.5 shrink-0">
        {toast.status === "pending" ? (
          <span className="block h-4 w-4 animate-spin rounded-full border-2 border-frost-400/25 border-t-frost-400" aria-hidden />
        ) : (
          <Icon
            name={toast.status === "success" ? "check" : "warning"}
            size={16}
            className={toast.status === "success" ? "text-success" : "text-danger"}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-frostwhite">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-xs leading-relaxed text-mist-400">{toast.body}</p>}
        {toast.hash && (
          <a
            href={`${EXPLORER}/tx/${toast.hash}`}
            target="_blank"
            rel="noreferrer"
            className={clsx("mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-frost-300 hover:text-frost-200")}
          >
            View on explorer
            <Icon name="external" size={12} />
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-mist-500 hover:bg-glacier-800 hover:text-frostwhite"
      >
        <Icon name="close" size={13} />
      </button>
    </div>
  );
}
