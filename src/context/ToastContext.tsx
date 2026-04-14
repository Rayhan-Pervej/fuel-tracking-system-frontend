'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  phase: 'enter' | 'exit';
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const colors: Record<ToastType, string> = {
  success: 'bg-emerald-500 text-white',
  error:   'bg-red-500 text-white',
  warning: 'bg-amber-400 text-gray-900',
};

const icons: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type, phase: 'enter' }]);

    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, phase: 'exit' } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 400);
    }, 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Fixed container — no transform here so animations work cleanly */}
      <div className="fixed top-5 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`${t.phase === 'enter' ? 'toast-enter' : 'toast-exit'} ${colors[t.type]} px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium pointer-events-auto flex items-center gap-2.5 min-w-[200px] max-w-sm`}
          >
            <span className="font-bold text-base leading-none">{icons[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
