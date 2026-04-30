"use client";

import { useToast, type ToastItem } from "@/contexts/toast";

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-brand"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-yes" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg className="h-4 w-4 text-no" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const borderByKind: Record<ToastItem["kind"], string> = {
  pending: "border-border-light",
  success: "border-yes-muted",
  error:   "border-no-muted",
  info:    "border-border-light",
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const icon =
    toast.kind === "pending" ? <Spinner /> :
    toast.kind === "success" ? <CheckIcon /> :
    toast.kind === "error"   ? <XCircleIcon /> :
    <InfoIcon />;

  return (
    <div
      className={`flex gap-3 rounded-lg border bg-surface-card px-4 py-3 shadow-xl min-w-64 max-w-sm ${borderByKind[toast.kind]}`}
      style={{ animation: "slideIn 150ms ease-out" }}
    >
      <div className="mt-0.5 flex-shrink-0">{icon}</div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary leading-snug">
          {toast.title}
        </p>

        {toast.step && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${(toast.step.current / toast.step.total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-text-dim whitespace-nowrap">
              {toast.step.current}/{toast.step.total}
            </span>
          </div>
        )}

        {toast.body && (
          <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{toast.body}</p>
        )}

        {toast.txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${toast.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block font-mono text-xs text-text-dim hover:text-brand transition-colors"
          >
            {toast.txHash.slice(0, 10)}…{toast.txHash.slice(-6)} ↗
          </a>
        )}
      </div>

      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-text-dim hover:text-text-muted transition-colors leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </>
  );
}
