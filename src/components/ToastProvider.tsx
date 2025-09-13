import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type Toast = { id: number; kind?: 'info' | 'warn' | 'error' | 'success'; message: string }
type Ctx = { toast: (message: string, kind?: Toast['kind']) => void }

const ToastContext = createContext<Ctx | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((message: string, kind?: Toast['kind']) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((ts) => [...ts, { id, message, kind }])
    setTimeout(() => setToasts((ts) => ts.filter(t => t.id !== id)), 3500)
  }, [])
  const value = useMemo(() => ({ toast }), [toast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{ position: 'fixed', right: 16, top: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }} aria-live="polite" aria-atomic="true" role="status">
        {toasts.map(t => (
          <div key={t.id} style={{ padding: '8px 12px', borderRadius: 10, background: 'var(--panel-elev)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-panel)', color: 'inherit' }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

