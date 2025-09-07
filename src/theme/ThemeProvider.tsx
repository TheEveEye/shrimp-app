import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'dark' | 'light' | 'system';

type ThemeContextType = {
  mode: ThemeMode;
  effective: 'dark' | 'light';
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('system');
  const [system, setSystem] = useState<'dark' | 'light'>(() =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, []);

  const effective = useMemo<'dark' | 'light'>(() => (mode === 'system' ? system : mode), [mode, system]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effective);
  }, [effective]);

  const value = useMemo(() => ({ mode, effective, setMode }), [mode, effective]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

