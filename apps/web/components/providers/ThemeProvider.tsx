"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "thaw-theme";

// Runs before first paint (inlined in <head>) so the page never flashes the wrong theme.
// `?theme=light|dark` in the URL wins, then the saved choice, then dark (the brand default).
export const themeInitScript = `(function(){try{var q=new URLSearchParams(location.search).get("theme");var s=null;try{s=localStorage.getItem("${STORAGE_KEY}")}catch(e){}var t=q==="light"||q==="dark"?q:s==="light"?"light":"dark";document.documentElement.dataset.theme=t;}catch(e){}})();`;

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>({
  theme: "dark",
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Adopt whatever the init script already applied.
  useEffect(() => {
    setThemeState(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Storage can be blocked (private mode); the choice then lasts for this page view only.
    }
  }, []);

  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
