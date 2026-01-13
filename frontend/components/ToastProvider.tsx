"use client";
import { createContext, useCallback, useContext, useState, useRef } from "react";

type Toast = { id: number; title: string; description?: string };
const ToastCtx = createContext<{ toast: (t: Omit<Toast, "id">) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounterRef = useRef(0);
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() * 1000 + idCounterRef.current;
    idCounterRef.current += 1;
    setToasts((prev) => [...prev, { id, ...t }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3000);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-md border bg-white px-4 py-3 shadow">
            <div className="text-sm font-semibold">{t.title}</div>
            {t.description && <div className="text-xs text-gray-600">{t.description}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

