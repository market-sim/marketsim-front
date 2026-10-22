import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { Bell, ChevronRight, LogOut, Menu, Search } from "lucide-react";
import { DISPLAY } from "../shared/ui";
import { BrandName, logoMark } from "../shared/brand";
import { useAuth } from "../auth/AuthContext";
import MarketTicker from "./MarketTicker";
import ThemeToggle from "../theme/ThemeToggle";
import {
  adminActivityNavItem,
  adminLoginAnomaliesNavItem,
  adminNavItem,
  adminSettingsNavItem,
  navItems,
  pageTitles,
} from "./navConfig";
import CoachDock from "../modules/coach/CoachDock";
import { CoachProvider } from "../modules/coach/coachFocus";

/** Sidebar + header du template ; la page du module s'affiche dans <Outlet />. */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const page = pageTitles[pathname] ?? pageTitles["/"];
  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : "?";
  const systemItems = user?.role === "ADMIN"
    ? [adminNavItem, adminSettingsNavItem, adminActivityNavItem, adminLoginAnomaliesNavItem]
    : [];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-blue-600 text-white" : "text-white/55 hover:bg-white/10 hover:text-white"} ${collapsed ? "justify-center" : ""}`;

  return (
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
            <span className="text-[11px] text-emerald-400 font-medium">Markets Open</span>
            <span className="ml-auto text-[10px] text-white/30">NYSE · LSE</span>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {!collapsed && <p className="px-3 pt-2 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-white/30">Modules</p>}
          <ul className="space-y-0.5">
            {navItems.map(({ path, label, Icon }) => (
              <li key={path}>
                <NavLink to={path} end={path === "/"} className={linkClass}>
                  {({ isActive }) => (
                    <>
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 text-left">{label}</span>
                          {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {!collapsed && <p className="px-3 pt-5 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-white/30">System</p>}
          <ul className="space-y-0.5 mt-1">
            {systemItems.map(({ path, label, Icon }) => (
              <li key={path}>
                <NavLink to={path} className={linkClass}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              </li>
            ))}
            <li>
              <button onClick={logout} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/50 hover:bg-white/10 hover:text-white transition-colors ${collapsed ? "justify-center" : ""}`}>
                <LogOut className="w-4 h-4 shrink-0" />
                {!collapsed && <span>Déconnexion</span>}
              </button>
            </li>
          </ul>
        </nav>

        <div className="border-t border-white/10 p-3">
          <NavLink to="/profile" className={`flex items-center gap-3 rounded-lg hover:bg-white/10 transition-colors ${collapsed ? "justify-center" : ""}`}>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
            {!collapsed && user && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{user.firstName} {user.lastName}</div>
                <div className="text-[11px] text-white/40">{user.role === "ADMIN" ? "Administrateur" : "Trader"} · {user.level}</div>
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
            <h2 className="text-sm font-semibold text-foreground" style={DISPLAY}>{page.title}</h2>
            <p className="text-[11px] text-muted-foreground">{page.sub}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden md:flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 w-52 border border-border/50">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input type="text" placeholder="Search assets, news..." className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground border-none outline-none w-full" />
            </div>
            <button className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-500" />
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{initials}</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
          <div className="h-4" />
        </main>
      </div>
      </div>
      {/* ── Coach de trading : present sur tous les ecrans ── */}
      <CoachDock />
    </div>
    </CoachProvider>
  );
}
