"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastKind = "pending" | "success" | "error" | "info";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  txHash?: string;
  step?: { current: number; total: number };
}

interface ToastCtx {
  toasts: ToastItem[];
  push(toast: Omit<ToastItem, "id">): string;
  update(id: string, patch: Partial<Omit<ToastItem, "id">>): void;
  dismiss(id: string): void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleRemove = useCallback((id: string) => {
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6_000);
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id">): string => {
      const id = String(++counter.current);
      setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
      if (toast.kind === "success" || toast.kind === "error") {
        scheduleRemove(id);
      }
      return id;
    },
    [scheduleRemove]
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<ToastItem, "id">>) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      if (patch.kind === "success" || patch.kind === "error") {
        scheduleRemove(id);
      }
    },
    [scheduleRemove]
  );

  return (
    <Ctx.Provider value={{ toasts, push, update, dismiss }}>
      {children}
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
