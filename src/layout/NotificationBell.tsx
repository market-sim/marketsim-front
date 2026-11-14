import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bell, BellRing, Bot, Info, KeyRound, ShieldAlert, ShieldCheck, TrendingDown, Trophy, Wallet, X } from "lucide-react";
import { notificationsApi, type NotificationType, type NotificationView } from "../api/endpoints";

export const NOTIF_ICON: Record<NotificationType, { Icon: typeof Bell; color: string }> = {
  LEVEL_UP: { Icon: Trophy, color: "text-emerald-500" },
  LEVEL_DOWN: { Icon: TrendingDown, color: "text-amber-500" },
  LOW_BALANCE: { Icon: Wallet, color: "text-amber-500" },
  BANKRUPT: { Icon: Wallet, color: "text-red-500" },
  NEW_DEVICE: { Icon: ShieldAlert, color: "text-red-500" },
  PASSWORD_CHANGED: { Icon: KeyRound, color: "text-blue-500" },
  TWO_FACTOR: { Icon: ShieldCheck, color: "text-blue-500" },
  AUTOPILOT: { Icon: Bot, color: "text-violet-500" },
  INFO: { Icon: Info, color: "text-sky-500" },
};

export const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
};

/** Petit « ding » genere (pas de fichier audio). */
function ding() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.09);
      g.gain.linearRampToValueAtTime(0.08, t + i * 0.09 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.45);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // son indisponible
  }
}

const desktopSupported = () => typeof window !== "undefined" && "Notification" in window;

/**
 * Cloche du bandeau : notifications du compte, mises a jour toutes les 15 s et au retour sur l'onglet.
 * Une nouvelle notification apparait aussi en pop-up (avec un petit son) et, si l'onglet est en arriere-plan
 * et que l'utilisateur l'a autorise, en notification du bureau Windows.
 */
export default function NotificationBell() {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [toasts, setToasts] = useState<NotificationView[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(desktopSupported() ? Notification.permission : "unsupported");
  const lastSeen = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    notificationsApi.list().then((r) => {
      setItems(r.items);
      setUnread(r.unread);
      const maxId = r.items.reduce((m, n) => Math.max(m, n.id), 0);
      if (lastSeen.current !== null) {
        const fresh = r.items.filter((n) => n.id > (lastSeen.current ?? 0) && !n.read).reverse();
        if (fresh.length > 0) {
          ding();
          setToasts((ts) => [...ts, ...fresh].slice(-3));
          if (document.hidden && desktopSupported() && Notification.permission === "granted") {
            fresh.forEach((n) => {
              const d = new Notification(n.title, { body: n.message ?? "", tag: `marketsim-${n.id}`, icon: "/favicon.ico" });
              d.onclick = () => {
                window.focus();
                if (n.link) navigate(n.link);
              };
            });
          }
        }
      }
      lastSeen.current = Math.max(lastSeen.current ?? 0, maxId);
    }).catch(() => { /* hors ligne */ });
  }, [navigate]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 15_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // les pop-ups disparaissent seules
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = window.setTimeout(() => setToasts((ts) => ts.slice(1)), 7000);
    return () => window.clearTimeout(id);
  }, [toasts]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const openItem = async (n: NotificationView) => {
    if (!n.read) {
      await notificationsApi.read(n.id).catch(() => {});
      load();
    }
    setOpen(false);
    setToasts((ts) => ts.filter((x) => x.id !== n.id));
    if (n.link) navigate(n.link);
  };

  const remove = async (e: React.MouseEvent, n: NotificationView) => {
    e.stopPropagation();
    await notificationsApi.remove(n.id).catch(() => {});
    load();
  };

  const askDesktop = async () => {
    if (!desktopSupported()) return;
    setPermission(await Notification.requestPermission());
  };

  const shown = onlyUnread ? items.filter((n) => !n.read) : items;

  return (
    <div className="relative" ref={box}>
      <button onClick={() => { setOpen((o) => !o); if (!open) load(); }} aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
        className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
        {unread > 0 ? <BellRing className="w-4 h-4 text-foreground" /> : <Bell className="w-4 h-4" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-11 z-50 w-[380px] max-w-[calc(100vw-24px)] rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <div className="flex rounded-lg bg-muted/60 p-0.5 text-[11px]">
              <button onClick={() => setOnlyUnread(false)} className={`px-2 py-0.5 rounded-md ${!onlyUnread ? "bg-card shadow-sm font-semibold" : "text-muted-foreground"}`}>Toutes</button>
              <button onClick={() => setOnlyUnread(true)} className={`px-2 py-0.5 rounded-md ${onlyUnread ? "bg-card shadow-sm font-semibold" : "text-muted-foreground"}`}>Non lues ({unread})</button>
            </div>
            {unread > 0 && (
              <button onClick={() => notificationsApi.readAll().then(load)} className="ms-auto text-[11px] text-blue-600 hover:underline">Tout lire</button>
            )}
          </div>
          {permission === "default" && (
            <button onClick={askDesktop} className="w-full flex items-center gap-2 px-4 py-2 text-[11.5px] text-start bg-blue-500/5 hover:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-b border-border/60">
              <BellRing className="w-3.5 h-3.5" /> Recevoir aussi les alertes sur le bureau (même quand l'onglet est caché)
            </button>
          )}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border/40">
            {shown.length === 0 && <p className="px-4 py-6 text-[12px] text-muted-foreground text-center">{onlyUnread ? "Tout est lu 👍" : "Rien de nouveau pour l'instant."}</p>}
            {shown.map((n) => {
              const { Icon, color } = NOTIF_ICON[n.type] ?? NOTIF_ICON.INFO;
              return (
                <div key={n.id} role="button" tabIndex={0} onClick={() => openItem(n)} onKeyDown={(e) => { if (e.key === "Enter") openItem(n); }}
                  className={`group w-full flex gap-3 px-4 py-3 text-start cursor-pointer hover:bg-muted/40 ${n.read ? "" : "bg-blue-500/5"}`}>
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`text-[12.5px] ${n.read ? "text-foreground" : "font-semibold text-foreground"}`}>{n.title}</span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </span>
                    {n.message && <span className="block text-[11.5px] text-muted-foreground leading-snug mt-0.5">{n.message}</span>}
                    <span className="block text-[10.5px] text-muted-foreground mt-1">{ago(n.createdAt)}</span>
                  </span>
                  <button onClick={(e) => remove(e, n)} aria-label="Supprimer" title="Supprimer"
                    className="self-start p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-muted text-muted-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-center text-[12px] font-medium text-blue-600 border-t border-border/60 hover:bg-muted/40">
            Voir toutes les notifications
          </Link>
        </div>
      )}

      {/* pop-ups des nouvelles notifications */}
      <div className="fixed top-20 end-4 z-[90] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-32px)] pointer-events-none">
        {!open && toasts.map((n) => {
          const { Icon, color } = NOTIF_ICON[n.type] ?? NOTIF_ICON.INFO;
          return (
            <div key={n.id} role="status" onClick={() => openItem(n)}
              className="pointer-events-auto cursor-pointer flex gap-3 rounded-xl border border-border bg-card shadow-2xl px-4 py-3"
              style={{ animation: "notifIn .3s ease-out" }}>
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground">{n.title}</p>
                {n.message && <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.message}</p>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setToasts((ts) => ts.filter((x) => x.id !== n.id)); }} aria-label="Fermer"
                className="self-start p-0.5 rounded hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes notifIn { from { transform: translateY(-8px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}
