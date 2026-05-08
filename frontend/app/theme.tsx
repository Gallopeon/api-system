"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "system" | "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const saved = localStorage.getItem("app_theme") as Theme;
    if (saved) setThemeState(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const effective = theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : theme;
    if (effective === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("app_theme", t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
