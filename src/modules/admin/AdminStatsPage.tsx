import { useEffect, useState } from "react";
import axios from "axios";
import { adminApi, type AdminStats } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CardShell, DISPLAY } from "../../shared/ui";

const WINDOWS = [1, 7, 30] as const;

const LEVEL_LABELS: Record<string, string> = {
  DEBUTANT: "Débutant",
  INTERMEDIAIRE: "Intermédiaire",
  AVANCE: "Avancé",
  EXPERT: "Expert",
};

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground" style={DISPLAY}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const LEVEL_COLORS: Record<string, string> = { DEBUTANT: "#94A3B8", INTERMEDIAIRE: "#3B82F6", AVANCE: "#8B5CF6", EXPERT: "#10B981" };
const ROLE_COLORS: Record<string, string> = { USER: "#3B82F6", ADMIN: "#8B5CF6" };
const RISK_COLORS: Record<string, string> = { LOW: "#10B981", MEDIUM: "#F59E0B", HIGH: "#EF4444" };
const tooltipStyle = { fontSize: 12, borderRadius: 8 };

interface Row { key: string; label: string; value: number; color: string }

/** Repartition en anneau avec legende chiffree (et pourcentage). */
function Donut({ title, rows }: { title: string; rows: Row[] }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <div>
      <h4 className="text-xs font-semibold text-foreground mb-1">{title}</h4>
      {total === 0 ? <p className="text-[11px] text-muted-foreground py-6">Aucune donnée.</p> : (
        <div className="flex items-center gap-4">
          <div className="w-[130px] h-[130px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="value" nameKey="label" innerRadius={38} outerRadius={60} paddingAngle={2} stroke="none">
                  {rows.map((r) => <Cell key={r.key} fill={r.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-[12px] flex-1">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                <span className="text-muted-foreground flex-1">{r.label}</span>
                <span className="text-foreground font-medium">{r.value}</span>
                <span className="text-[10px] text-muted-foreground w-10 text-right">{Math.round((100 * r.value) / total)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Histogramme horizontal (une barre par categorie). */
function Bars({ title, rows, height = 150 }: { title: string; rows: Row[]; height?: number }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <div>
      <h4 className="text-xs font-semibold text-foreground mb-1">{title}</h4>
      {total === 0 ? <p className="text-[11px] text-muted-foreground py-6">Aucune donnée.</p> : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="currentColor" strokeOpacity={0.08} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} stroke="currentColor" strokeOpacity={0.4} />
            <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fillOpacity: 0.06 }} />
            <Bar dataKey="value" name="Nombre" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "currentColor" }}>
              {rows.map((r) => <Cell key={r.key} fill={r.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const toRows = (data: Record<string, number>, labels: Record<string, string>, colors: Record<string, string>, order?: string[]): Row[] =>
  (order ?? Object.keys(data)).filter((k) => k in data || order).map((k) => ({
    key: k, label: labels[k] ?? k, value: data[k] ?? 0, color: colors[k] ?? "#64748B",
  }));

/** Module 1 : supervision du back-office (comptes, connexions, actions admin, anomalies). Lecture seule. */
export default function AdminStatsPage() {
  const [days, setDays] = useState<number>(7);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    adminApi.stats(days, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setStats(data);
      })
      .catch((e) => {
        if (controller.signal.aborted || axios.isCancel(e)) return;
        setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days]);

  const shown = stats && stats.windowDays === days ? stats : null;

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Statistiques</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Comptes à l&apos;instant présent ; connexions, actions admin et anomalies sur la période choisie.
            </p>
          </div>
          <div className="flex gap-1" role="group" aria-label="Période">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setDays(w)}
                aria-pressed={days === w}
                className={`text-[11px] font-semibold px-3 py-1 rounded-full ${days === w ? "bg-blue-600 text-white" : "bg-muted/30 text-muted-foreground hover:text-foreground"}`}
              >
                {w === 1 ? "24 h" : `${w} jours`}
              </button>
            ))}
          </div>
        </div>
        {loading && <p className="mt-4 text-xs text-muted-foreground">Chargement des statistiques...</p>}
        {!loading && error && <p className="mt-4 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </CardShell>

      {shown && (
        <>
          <CardShell className="p-5 space-y-4">
            <h4 className="text-sm font-semibold text-foreground" style={DISPLAY}>Comptes</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Total" value={shown.users.total} />
              <Stat label="Actifs" value={shown.users.enabled} />
              <Stat label="Désactivés" value={shown.users.disabled} />
              <Stat label="Verrouillés" value={shown.users.lockedNow} hint="en ce moment" />
              <Stat label="Nouveaux" value={shown.users.newInWindow} hint="sur la période" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <Donut title="Par rôle" rows={toRows(shown.users.byRole, {}, ROLE_COLORS)} />
              <Bars title="Par niveau de trader"
                rows={toRows(shown.users.byLevel, LEVEL_LABELS, LEVEL_COLORS, ["DEBUTANT", "INTERMEDIAIRE", "AVANCE", "EXPERT"])} />
            </div>
          </CardShell>

          <div className="grid gap-4 lg:grid-cols-2">
            <CardShell className="p-5 space-y-3">
              <h4 className="text-sm font-semibold text-foreground" style={DISPLAY}>Connexions</h4>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Réussies" value={shown.logins.success} />
                <Stat label="Échouées" value={shown.logins.failure} />
                <Stat label="Bloquées" value={shown.logins.blockedWhileLocked} hint="compte verrouillé" />
              </div>
              <Donut title="Issue des tentatives de connexion" rows={[
                { key: "ok", label: "Réussies", value: shown.logins.success, color: "#10B981" },
                { key: "ko", label: "Échouées", value: shown.logins.failure, color: "#F59E0B" },
                { key: "locked", label: "Bloquées (verrou)", value: shown.logins.blockedWhileLocked, color: "#EF4444" },
              ]} />
            </CardShell>

            <CardShell className="p-5 space-y-3">
              <h4 className="text-sm font-semibold text-foreground" style={DISPLAY}>Actions admin</h4>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Activations" value={shown.adminActions.setEnabled} />
                <Stat label="Suppressions" value={shown.adminActions.deleteUser} />
                <Stat label="Refusées" value={shown.adminActions.deleteRefused} hint="suppressions" />
                <Stat label="Paramètres" value={shown.adminActions.settingsUpdates} />
              </div>
            </CardShell>
          </div>

          <CardShell className="p-5 space-y-3">
            <h4 className="text-sm font-semibold text-foreground" style={DISPLAY}>Anomalies de connexion (IA, consultatif)</h4>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Évaluées" value={shown.anomalies.assessed} />
                <Stat label="Historique insuffisant" value={shown.anomalies.insufficientHistory} />
              </div>
              <Bars title="Par niveau de risque" height={120}
                rows={toRows(shown.anomalies.byRiskLevel, { LOW: "Faible", MEDIUM: "Moyen", HIGH: "Élevé" }, RISK_COLORS, ["LOW", "MEDIUM", "HIGH"])} />
            </div>
            {shown.anomalies.assessed === 0 && (
              <p className="text-[11px] text-muted-foreground">Aucune connexion évaluée sur la période.</p>
            )}
          </CardShell>
        </>
      )}
    </div>
  );
}
