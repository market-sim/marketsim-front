import { useEffect, useState } from "react";
import axios from "axios";
import { adminApi, type AdminStats } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
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

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const total = rows.reduce((sum, [, n]) => sum + n, 0);
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-foreground">{title}</h4>
      {rows.map(([label, n]) => (
        <div key={label} className="flex items-center gap-3 text-[12px]">
          <span className="w-28 text-muted-foreground">{label}</span>
          <div className="h-1.5 flex-1 rounded-full bg-muted/40">
            <div
              className="h-1.5 rounded-full bg-blue-600"
              style={{ width: total ? `${(100 * n) / total}%` : "0%" }}
            />
          </div>
          <span className="w-8 text-right text-foreground">{n}</span>
        </div>
      ))}
    </div>
  );
}

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
              <Breakdown title="Par rôle" rows={Object.entries(shown.users.byRole)} />
              <Breakdown
                title="Par niveau de trader"
                rows={Object.entries(shown.users.byLevel).map(([k, n]) => [LEVEL_LABELS[k] ?? k, n])}
              />
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
              <Breakdown title="Par niveau de risque" rows={Object.entries(shown.anomalies.byRiskLevel)} />
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
