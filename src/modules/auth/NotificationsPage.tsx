import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CheckCheck, Settings2, Trash2, X } from "lucide-react";
import { notificationsApi, type NotificationFilter, type NotificationView } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY } from "../../shared/ui";
import { NOTIF_ICON, ago } from "../../layout/NotificationBell";

const FILTERS: { id: NotificationFilter; label: string }[] = [
  { id: "ALL", label: "Toutes" },
  { id: "UNREAD", label: "Non lues" },
  { id: "SECURITY", label: "Sécurité" },
  { id: "PROGRESS", label: "Progression" },
  { id: "INFO", label: "Infos" },
];

/** Toutes les notifications (200 dernieres) : filtres, lecture, suppression. */
export default function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    notificationsApi.history(filter)
      .then((r) => { setItems(r.items); setUnread(r.unread); })
      .catch((e) => setMsg(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  // groupes par jour : aujourd'hui, hier, puis la date
  const day = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === yesterday.toDateString()) return "Hier";
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };
  let lastDay = "";

  return (
    <div className="max-w-3xl space-y-4">
      <CardShell className="p-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium border ${filter === f.id ? "bg-blue-600 border-blue-600 text-white" : "border-border hover:bg-muted/50"}`}>
            {f.label}{f.id === "UNREAD" && unread > 0 ? ` (${unread})` : ""}
          </button>
        ))}
        <div className="ms-auto flex gap-2">
          <button onClick={() => notificationsApi.readAll().then(load)} disabled={unread === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] hover:bg-muted/50 disabled:opacity-40">
            <CheckCheck className="w-3.5 h-3.5" /> Tout marquer comme lu
          </button>
          <button onClick={async () => { const r = await notificationsApi.removeRead(); setMsg(`${r.deleted} notification(s) lue(s) supprimée(s).`); load(); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] hover:bg-muted/50">
            <Trash2 className="w-3.5 h-3.5" /> Supprimer les lues
          </button>
          <Link to="/profile" title="Choisir ce que je reçois (cloche, e-mail)" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] hover:bg-muted/50">
            <Settings2 className="w-3.5 h-3.5" /> Réglages
          </Link>
        </div>
      </CardShell>
      {msg && <p className="text-[12.5px] text-muted-foreground">{msg}</p>}

      <CardShell className="overflow-hidden">
        {loading && <p className="px-5 py-6 text-sm text-muted-foreground">Chargement…</p>}
        {!loading && items.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune notification ici.</p>}
        {items.map((n) => {
          const { Icon, color } = NOTIF_ICON[n.type] ?? NOTIF_ICON.INFO;
          const d = day(n.createdAt);
          const header = d !== lastDay ? d : null;
          lastDay = d;
          return (
            <div key={n.id}>
              {header && <p className="px-5 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" style={DISPLAY}>{header}</p>}
              <div className={`group flex gap-3 px-5 py-3 border-t border-border/40 ${n.read ? "" : "bg-blue-500/5"}`}>
                <span className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0"><Icon className={`w-4 h-4 ${color}`} /></span>
                <button className="flex-1 min-w-0 text-start" onClick={async () => {
                  if (!n.read) await notificationsApi.read(n.id).catch(() => {});
                  if (n.link) navigate(n.link); else load();
                }}>
                  <span className="flex items-center gap-2">
                    <span className={`text-[13px] ${n.read ? "text-foreground" : "font-semibold text-foreground"}`}>{n.title}</span>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  </span>
                  {n.message && <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{n.message}</span>}
                  <span className="block text-[11px] text-muted-foreground mt-1">{ago(n.createdAt)}</span>
                </button>
                <button onClick={() => notificationsApi.remove(n.id).then(load)} aria-label="Supprimer"
                  className="self-start p-1.5 rounded-lg text-muted-foreground opacity-60 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </CardShell>
    </div>
  );
}
