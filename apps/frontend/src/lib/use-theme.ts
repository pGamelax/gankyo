import { useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

const KEY = "gankyo:theme";

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem(KEY) as Theme) ?? "system"; } catch { return "system"; }
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Reage a mudanças no sistema quando o tema é "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    try { localStorage.setItem(KEY, t); } catch {}
    setThemeState(t);
  }, []);

  return { theme, setTheme };
}
