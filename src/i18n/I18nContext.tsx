import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { profileApi, type Language, type Preferences, type ThemePref } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { DICT, type Key } from "./dictionary";

const LANG_KEY = "marketsim-lang";

function storedLang(): Language {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "en" || v === "ar" ? v : "fr";
  } catch {
    return "fr";
  }
}

interface I18nState {
  lang: Language;
  dir: "ltr" | "rtl";
  t: (key: Key, vars?: Record<string, string | number>) => string;
  /** change la langue (et l'enregistre sur le serveur si connecte) */
  setLang: (l: Language) => void;
  /** preferences du compte, chargees depuis le serveur (null si deconnecte) */
  prefs: Preferences | null;
  setPrefs: (p: Preferences) => void;
}

const Ctx = createContext<I18nState | null>(null);

/**
 * Langue (FR / EN / AR) et preferences du compte. A la connexion, la langue et le theme enregistres sur le
 * serveur sont appliques (ils suivent l'utilisateur sur tous ses appareils) ; un changement est renvoye au serveur.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [lang, setLangState] = useState<Language>(storedLang);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const loadedFor = useRef<number | null>(null);
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // stockage indisponible
    }
  }, [lang, dir]);

  // connexion : on applique les preferences du serveur
  useEffect(() => {
    if (!user) {
      loadedFor.current = null;
      setPrefs(null);
      return;
    }
    if (loadedFor.current === user.id) return;
    loadedFor.current = user.id;
    profileApi.preferences()
      .then((p) => {
        setPrefs(p);
        setLangState(p.language);
        if (p.theme !== theme) setTheme(p.theme);
      })
      .catch(() => { /* ancien serveur ou hors ligne : on garde les reglages du navigateur */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // le bouton Clair / Sombre / Auto du bandeau : on enregistre le choix sur le serveur
  useEffect(() => {
    if (!prefs || prefs.theme === (theme as ThemePref)) return;
    profileApi.updatePreferences({ theme: theme as ThemePref }).then(setPrefs).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    if (user) profileApi.updatePreferences({ language: l }).then(setPrefs).catch(() => {});
  }, [user]);

  const t = useCallback((key: Key, vars?: Record<string, string | number>) => {
    let s: string = DICT[lang][key] ?? DICT.fr[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  }, [lang]);

  return <Ctx.Provider value={{ lang, dir, t, setLang, prefs, setPrefs }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n doit etre utilise dans <I18nProvider>");
  return c;
}
