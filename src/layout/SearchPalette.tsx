import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight, Bell, Bot, Clock, CornerDownLeft, GraduationCap, Languages, Loader2, LogOut, Moon, Search, Sun, TrendingUp,
  Trophy, User as UserIcon, Users, X, Zap, type LucideIcon,
} from "lucide-react";
import { searchApi, type SearchHit, type SearchHitType } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import type { Key } from "../i18n/dictionary";
import { useTheme } from "../theme/ThemeContext";
import { STATIONS } from "../modules/education/academy/lessons";
import {
  adminActivityNavItem, adminLoginAnomaliesNavItem, adminNavItem, adminOutboxNavItem, adminSettingsNavItem, adminStatsNavItem,
  adminMessagesNavItem, leaderboardNavItem, messagesNavItem, navItems, progressionNavItem, securityNavItem,
} from "./navConfig";

/** Un resultat affichable : une page, une action, ou un resultat du serveur. */
interface Item {
  id: string;
  group: string;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  Icon: LucideIcon;
  /** lien a ouvrir, ou action a executer */
  link?: string;
  run?: () => void;
  keywords?: string;
}

const RECENT_KEY = "marketsim-search-recent";

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const GROUP_OF: Record<SearchHitType, { label: string; Icon: LucideIcon }> = {
  ASSET: { label: "Actifs", Icon: TrendingUp },
  AGENT: { label: "Mes agents", Icon: Bot },
  COURSE: { label: "Cours", Icon: GraduationCap },
  TRADER: { label: "Traders", Icon: Trophy },
  NOTIFICATION: { label: "Notifications", Icon: Bell },
  USER: { label: "Utilisateurs", Icon: Users },
};

function loadRecent(): Item[] {
  try {
    return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Omit<Item, "Icon">[]).map((r) => ({ ...r, Icon: Clock }));
  } catch {
    return [];
  }
}

/** Surligne la partie qui correspond a la recherche. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="bg-amber-300/40 text-inherit rounded px-0.5">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/**
 * Recherche globale facon « palette de commandes » (Ctrl + K) : pages, actions rapides, stations de l'Academie,
 * et resultats du serveur (actifs, agents, cours, traders, notifications, utilisateurs pour l'admin).
 */
export default function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Item[]>(loadRecent);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, setLang } = useI18n();
  const { setTheme } = useTheme();
  const isAdmin = user?.role === "ADMIN";

  // raccourcis : Ctrl+K / Cmd+K, ou « / » hors d'un champ de saisie
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setActive(0);
      window.setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  // pages et actions (cote navigateur, instantane)
  const statics = useMemo<Item[]>(() => {
    const nav = [...navItems, progressionNavItem, leaderboardNavItem, ...(isAdmin ? [adminMessagesNavItem] : [securityNavItem, messagesNavItem]),
      { path: "/profile", label: "Profil", Icon: UserIcon }, { path: "/notifications", label: "Notifications", Icon: Bell },
      ...(isAdmin ? [adminNavItem, adminStatsNavItem, adminSettingsNavItem, adminActivityNavItem, adminLoginAnomaliesNavItem, adminOutboxNavItem] : [])];
    const pages: Item[] = nav
      .filter((n) => !(isAdmin && n.path === "/progression"))
      .map((n) => {
        const key = `nav.${n.path}` as Key;
        const label = t(key) === key ? n.label : t(key);
        return { id: `page:${n.path}`, group: "Pages", title: label, subtitle: n.path, Icon: n.Icon, link: n.path, keywords: n.label };
      });
    const actions: Item[] = [
      { id: "act:play", group: "Actions", title: "Jouer une partie contre l'agent IA", Icon: Zap, link: "/agent?play=1", keywords: "jeu trading replay" },
      ...(isAdmin ? [] : [{ id: "act:passkey", group: "Actions", title: "Ajouter une passkey (Face ID / empreinte)", Icon: Zap, link: "/security", keywords: "securite connexion biometrie" }]),
      ...(isAdmin ? [] : [{ id: "act:support", group: "Actions", title: "Contacter l'administration / demander du capital", Icon: Zap, link: "/messages", keywords: "support aide fonds argent montant probleme message" }]),
      { id: "act:photo", group: "Actions", title: "Changer ma photo de profil", Icon: UserIcon, link: "/profile", keywords: "avatar image" },
      { id: "act:dark", group: "Actions", title: "Passer en thème sombre", Icon: Moon, run: () => setTheme("dark"), keywords: "dark mode nuit" },
      { id: "act:light", group: "Actions", title: "Passer en thème clair", Icon: Sun, run: () => setTheme("light"), keywords: "light mode jour" },
      { id: "act:fr", group: "Actions", title: "Langue : Français", Icon: Languages, run: () => setLang("fr"), keywords: "language french" },
      { id: "act:en", group: "Actions", title: "Language: English", Icon: Languages, run: () => setLang("en"), keywords: "langue anglais" },
      { id: "act:ar", group: "Actions", title: "اللغة : العربية", Icon: Languages, run: () => setLang("ar"), keywords: "langue arabe arabic" },
      { id: "act:logout", group: "Actions", title: "Se déconnecter", Icon: LogOut, run: logout, keywords: "deconnexion logout" },
    ];
    const academy: Item[] = STATIONS.filter((s) => !s.secret).map((s) => ({
      id: `academy:${s.id}`, group: "Académie", title: `${s.place} — ${s.topic}`, subtitle: s.slides.map((x) => x.title).join(" · "),
      Icon: GraduationCap, link: "/education", keywords: s.slides.map((x) => x.title + " " + x.text).join(" "),
    }));
    return [...pages, ...actions, ...academy];
  }, [isAdmin, t, setTheme, setLang, logout]);

  // resultats du serveur (avec un petit delai pendant la frappe, et annulation de la requete precedente)
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const id = window.setTimeout(() => {
      searchApi.search(q, ctrl.signal)
        .then((r) => setHits(r.hits))
        .catch(() => { /* annulee ou hors ligne : on garde les resultats locaux */ })
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      window.clearTimeout(id);
      ctrl.abort();
    };
  }, [query, open]);

  const items = useMemo<Item[]>(() => {
    const q = norm(query.trim());
    if (!q) return [...recent.map((r) => ({ ...r, group: "Récents" })), ...statics.filter((s) => s.group === "Pages").slice(0, 6)];
    const local = statics
      .map((s) => {
        const title = norm(s.title);
        const score = title.startsWith(q) ? 3 : title.includes(q) ? 2 : norm(`${s.subtitle ?? ""} ${s.keywords ?? ""}`).includes(q) ? 1 : 0;
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s);
    const groups = new Map<string, Item[]>();
    for (const it of local) {
      const g = groups.get(it.group) ?? [];
      if (g.length < 5) g.push(it);
      groups.set(it.group, g);
    }
    const remote: Item[] = hits.map((h, i) => ({
      id: `hit:${h.type}:${i}:${h.title}`, group: GROUP_OF[h.type].label, title: h.title, subtitle: h.subtitle, badge: h.badge,
      Icon: GROUP_OF[h.type].Icon, link: h.link,
    }));
    return [...(groups.get("Pages") ?? []), ...remote, ...(groups.get("Actions") ?? []), ...(groups.get("Académie") ?? [])];
  }, [query, statics, hits, recent]);

  useEffect(() => setActive(0), [query, hits.length]);

  const choose = useCallback((it: Item) => {
    setOpen(false);
    if (it.link) {
      const entry = { id: it.id, group: "Récents", title: it.title, subtitle: it.subtitle, link: it.link };
      const next = [entry, ...loadRecent().filter((r) => r.id !== it.id).map(({ Icon: _i, ...r }) => r)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // stockage indisponible
      }
      setRecent(next.map((r) => ({ ...r, Icon: Clock })));
      navigate(it.link);
    } else it.run?.();
  }, [navigate]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") setOpen(false);
  };

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastGroup = "";
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 w-60 border border-border/50 text-start transition-colors">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-xs text-muted-foreground truncate">{t("header.search")}</span>
        <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-background">Ctrl K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted/60" aria-label="Rechercher">
        <Search className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-[2px] flex items-start justify-center pt-[10vh] px-3" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}
            role="dialog" aria-label="Recherche">
            <div className="flex items-center gap-3 px-4 border-b border-border">
              {loading ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" /> : <Search className="w-4 h-4 text-muted-foreground" />}
              <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Rechercher un actif, un agent, une page, une leçon, un trader…"
                className="flex-1 bg-transparent py-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none" maxLength={60}
                role="combobox" aria-expanded="true" aria-controls="search-results" aria-activedescendant={`search-item-${active}`} />
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Fermer"><X className="w-4 h-4" /></button>
            </div>
            <div ref={list} id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto py-2">
              {items.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  {loading ? "Recherche…" : query.trim().length < 2 ? "Tape au moins 2 lettres." : `Aucun résultat pour « ${query} ».`}
                </p>
              )}
              {items.map((it, i) => {
                const header = it.group !== lastGroup ? it.group : null;
                lastGroup = it.group;
                return (
                  <div key={it.id}>
                    {header && <p className="px-4 pt-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{header}</p>}
                    <button id={`search-item-${i}`} data-index={i} role="option" aria-selected={i === active}
                      onMouseMove={() => setActive(i)} onClick={() => choose(it)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-start ${i === active ? "bg-blue-600/10" : ""}`}>
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i === active ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>
                        <it.Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13.5px] font-medium text-foreground truncate"><Highlight text={it.title} query={query} /></span>
                        {it.subtitle && <span className="block text-[11.5px] text-muted-foreground truncate">{it.subtitle}</span>}
                      </span>
                      {it.badge && <span className={`text-[10.5px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${it.badge.startsWith("-") ? "bg-red-500/10 text-red-600" : it.badge.startsWith("+") ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{it.badge}</span>}
                      {i === active && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 rtl:rotate-180" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10.5px] text-muted-foreground">
              <span><kbd className="border border-border rounded px-1">↑</kbd> <kbd className="border border-border rounded px-1">↓</kbd> naviguer</span>
              <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1"><CornerDownLeft className="w-3 h-3 inline" /></kbd> ouvrir</span>
              <span><kbd className="border border-border rounded px-1">Échap</kbd> fermer</span>
              <span className="ms-auto">Ctrl K partout dans l'application</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
