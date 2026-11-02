import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

// One short message at the bottom of the screen ("Enlace copiado").

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((message: string) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message });
    timer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastContext value={notify}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="animate-toast fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium whitespace-nowrap text-white shadow-lg dark:bg-white dark:text-zinc-900"
        >
          {toast.message}
        </div>
      )}
    </ToastContext>
  );
}

export function useNotify() {
  return useContext(ToastContext);
}
