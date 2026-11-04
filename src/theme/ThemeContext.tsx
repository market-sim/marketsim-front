import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "marketsim-theme";

interface ThemeState {
  /** choix de l'utilisateur */
  theme: ThemeChoice;
  /** theme reellement affiche */
  resolved: "light" | "dark";
  setTheme: (t: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

/** Theme clair / sombre / systeme : classe "dark" sur <html>, choix memorise dans le navigateur. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // suit le reglage du systeme quand l'utilisateur a choisi "systeme"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = (t: ThemeChoice) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // stockage indisponible (navigation privee) : le choix vaut pour la session
    }
  };

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit etre utilise dans <ThemeProvider>");
  return ctx;
}
