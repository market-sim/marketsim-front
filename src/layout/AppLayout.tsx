import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { ChevronRight, LogOut, Menu, Search } from "lucide-react";
import { DISPLAY } from "../shared/ui";
import { BrandName, logoMark } from "../shared/brand";
import { useAuth } from "../auth/AuthContext";
import MarketTicker from "./MarketTicker";
import ThemeToggle from "../theme/ThemeToggle";
import {
  adminActivityNavItem,
  adminLoginAnomaliesNavItem,
  adminNavItem,
  adminOutboxNavItem,
  progressionNavItem,
  leaderboardNavItem,
  securityNavItem,
  messagesNavItem,
  adminMessagesNavItem,
  adminSettingsNavItem,
  adminStatsNavItem,
  navItems,
  pageTitles,
} from "./navConfig";
import CoachDock from "../modules/coach/CoachDock";
import { CoachProvider } from "../modules/coach/coachFocus";
import { LEVEL_LABEL, ProgressionProvider } from "../progression/ProgressionContext";
import LevelBadge from "../progression/LevelBadge";
import GuideBanner from "../progression/GuideBanner";
import EmailBanner from "./EmailBanner";
import NotificationBell from "./NotificationBell";
import ServerVersionBanner from "./ServerVersionBanner";
import { supportApi } from "../api/endpoints";
import SearchPalette from "./SearchPalette";
import UserAvatar from "../auth/UserAvatar";
import { useI18n } from "../i18n/I18nContext";
import type { Key } from "../i18n/dictionary";
import type { TraderLevel } from "../api/endpoints";

/** Sidebar + header du template ; la page du module s'affiche dans <Outlet />. */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { t, lang } = useI18n();
  const label = (path: string, fallback: string) => {
    const key = `nav.${path}` as Key;
    const v = t(key);
    return v === key ? fallback : v;
  };

  const page = pageTitles[pathname] ?? pageTitles["/"];
  const isAdmin = user?.role === "ADMIN";
  const systemItems = isAdmin
    // la page Securite (sessions, passkeys, 2FA, export) n'est pas affichee a l'administrateur : confidentiel
    ? [adminNavItem, adminMessagesNavItem, adminStatsNavItem, adminSettingsNavItem, adminActivityNavItem, adminLoginAnomaliesNavItem, adminOutboxNavItem]
    : [messagesNavItem, securityNavItem];
  // conversations de support avec un message non lu (badge du menu)
  const [supportUnread, setSupportUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    const load = () => supportApi.unread().then(setSupportUnread).catch(() => {});
    load();
    const id = window.setInterval(load, 20_000);
    return () => window.clearInterval(id);
  }, [user, pathname]);
  // « Ma progression » juste apres l'agent IA, seulement pour les traders
  const moduleItems = navItems.flatMap((item) => item.path === "/agent"
    ? (isAdmin ? [item, leaderboardNavItem] : [item, progressionNavItem, leaderboardNavItem])
    : [item]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-blue-600 text-white" : "text-white/55 hover:bg-white/10 hover:text-white"} ${collapsed ? "justify-center" : ""}`;

  return (
    <ProgressionProvider>
    <CoachProvider>
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Bandeau des marches mondiaux (module 6) ── */}
      <MarketTicker />
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className={`flex flex-col shrink-0 transition-all duration-200 ${collapsed ? "w-16" : "w-60"}`} style={{ background: "#0D1B3E" }}>
        <div className="flex items-center gap-3 h-16 px-4 border-b border-white/10 shrink-0">
          <img src={logoMark} alt="MarketSim AI" className={`object-contain shrink-0 ${collapsed ? "w-8 h-8" : "w-10 h-10"}`} />
          {!collapsed && (
            <div>
              <BrandName className="text-sm font-semibold tracking-wide" style={DISPLAY} />
              <div className="text-[10px] text-blue-300/70">Simulation Platform</div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="mx-3 my-3 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">{t("side.marketsOpen")}</span>
            <span className="ms-auto text-[10px] text-white/30">NYSE · LSE</span>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {!collapsed && <p className="px-3 pt-2 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-white/30">{t("side.modules")}</p>}
          <ul className="space-y-0.5">
            {moduleItems.map(({ path, label: text, Icon }) => (
              <li key={path}>
                <NavLink to={path} end={path === "/"} className={linkClass}>
                  {({ isActive }) => (
                    <>
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 text-start">{label(path, text)}</span>
                          {isActive && <ChevronRight className="w-3 h-3 opacity-60 rtl:rotate-180" />}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {!collapsed && <p className="px-3 pt-5 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-white/30">{t("side.system")}</p>}
          <ul className="space-y-0.5 mt-1">
            {systemItems.map(({ path, label: text, Icon }) => (
              <li key={path}>
                <NavLink to={path} end={path === adminNavItem.path} className={linkClass}>
                  <span className="relative">
                    <Icon className="w-4 h-4 shrink-0" />
                    {collapsed && path.endsWith("messages") && supportUnread > 0 && <span className="absolute -top-1 -end-1 w-2 h-2 rounded-full bg-red-500" />}
                  </span>
                  {!collapsed && <span className="flex-1">{label(path, text)}</span>}
                  {!collapsed && path.endsWith("messages") && supportUnread > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">{supportUnread}</span>
                  )}
                </NavLink>
              </li>
            ))}
            <li>
              <button onClick={logout} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/50 hover:bg-white/10 hover:text-white transition-colors ${collapsed ? "justify-center" : ""}`}>
                <LogOut className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{t("side.logout")}</span>}
              </button>
            </li>
          </ul>
        </nav>

        <div className="border-t border-white/10 p-3">
          <NavLink to="/profile" className={`flex items-center gap-3 rounded-lg hover:bg-white/10 transition-colors ${collapsed ? "justify-center" : ""}`}>
            <UserAvatar firstName={user?.firstName} lastName={user?.lastName} avatarUrl={user?.avatarUrl} size={32} />
            {!collapsed && user && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{user.firstName} {user.lastName}</div>
                <div className="text-[11px] text-white/40">{user.role === "ADMIN" ? t("side.admin") : `${t("side.trader")} · ${LEVEL_LABEL[user.level as TraderLevel] ?? user.level}`}</div>
              </div>
            )}
          </NavLink>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-4 px-6 h-16 bg-card border-b border-border shrink-0">
          <button onClick={() => setCollapsed(!collapsed)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
            <Menu className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-foreground" style={DISPLAY}>{lang !== "fr" && pageTitles[pathname] ? label(pathname, page.title) : page.title}</h2>
            <p className="text-[11px] text-muted-foreground">{page.sub}</p>
          </div>
          <div className="ms-auto flex items-center gap-3">
            <LevelBadge />
            <ThemeToggle />
            <SearchPalette />
            <NotificationBell />
            <NavLink to="/profile" title={t("nav./profile")}>
              <UserAvatar firstName={user?.firstName} lastName={user?.lastName} avatarUrl={user?.avatarUrl} size={32} />
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <ServerVersionBanner />
          <EmailBanner />
          <GuideBanner />
          <Outlet />
          <div className="h-4" />
        </main>
      </div>
      </div>
      {/* ── Coach de trading : present sur tous les ecrans ── */}
      <CoachDock />
    </div>
    </CoachProvider>
    </ProgressionProvider>
  );
}
