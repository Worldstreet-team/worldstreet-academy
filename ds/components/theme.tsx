'use client';
// VENDORED from worldstreet/design-system by scripts/vendor.mjs. Don't edit: change the design system and re-run it.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';
type ThemeCtx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const ThemeContext = createContext<ThemeCtx | null>(null);

function readStored(key: string): Theme | null {
  try {
    const v = window.localStorage.getItem(key);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export type ThemeProviderProps = {
  children?: ReactNode;
  /** Used for SSR and before the client resolves storage / media query. */
  defaultTheme?: Theme;
  storageKey?: string;
};
/**
 * Sets data-theme on <html>. Initial value: stored choice, else
 * prefers-color-scheme. Follows the OS until the user picks explicitly.
 */
export function ThemeProvider({ children, defaultTheme = 'dark', storageKey = 'cx-theme' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const explicit = useRef(false);

  useEffect(() => {
    const stored = readStored(storageKey);
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (stored) {
      explicit.current = true;
      setThemeState(stored);
    } else if (mq) {
      setThemeState(mq.matches ? 'light' : 'dark');
    }
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => {
      if (!explicit.current) setThemeState(e.matches ? 'light' : 'dark');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [storageKey]);

  // Skip the first run: the pre-paint script (themeScript) already set data-theme,
  // and writing defaultTheme here would flash dark for light-mode users.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback(
    (t: Theme) => {
      explicit.current = true;
      setThemeState(t);
      try {
        window.localStorage.setItem(storageKey, t);
      } catch {
        /* storage unavailable — theme still applies for this session */
      }
    },
    [storageKey],
  );
  const value = useMemo<ThemeCtx>(() => ({ theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

