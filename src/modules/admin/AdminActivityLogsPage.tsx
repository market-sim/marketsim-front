import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  type ActivityAction,
  type ActivityLogPage,
  type ActivityOutcome,
} from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY } from "../../shared/ui";
import { inputClass, labelClass } from "../auth/AuthLayout";
import ActivityLogDetails from "./ActivityLogDetails";

const ACTIONS: ActivityAction[] = [
  "REGISTER",
  "LOGIN",
  "PROFILE_UPDATE",
  "ADMIN_SET_ENABLED",
  "ADMIN_DELETE_USER",
  "SETTINGS_UPDATE",
];

function toIsoOrUndefined(localValue: string): string | undefined {
  if (!localValue) return undefined;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export default function AdminActivityLogsPage() {
  const [pageData, setPageData] = useState<ActivityLogPage | null>(null);
  const [page, setPage] = useState(0);
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState<ActivityAction | "">("");
  const [outcome, setOutcome] = useState<ActivityOutcome | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async (pageIndex: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.activityLogs({
        actorId: actorId.trim() || undefined,
        action,
        outcome,
        from: toIsoOrUndefined(from),
        to: toIsoOrUndefined(to),
        page: pageIndex,
        size: 20,
      });
      setPageData(data);
      setPage(pageIndex);
    } catch (e) {
      setPageData(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [actorId, action, outcome, from, to]);

  useEffect(() => {
    void load(0);
    // Filters apply via the form button, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    load(0);
  };

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3" style={DISPLAY}>Filtres</h3>
        <form onSubmit={applyFilters} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className={labelClass}>Actor ID</label>
            <input value={actorId} onChange={(e) => setActorId(e.target.value)} className={inputClass} placeholder="ex: 1" />
          </div>
          <div>
            <label className={labelClass}>Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value as ActivityAction | "")} className={inputClass}>
              <option value="">Toutes</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Résultat</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as ActivityOutcome | "")} className={inputClass}>
              <option value="">Tous</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILURE">FAILURE</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Du (local → UTC)</label>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Au (local → UTC)</label>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
            Appliquer
          </button>
        </form>
      </CardShell>

      <CardShell className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Journal d'activité</h3>
          <span className="text-[11px] text-muted-foreground">
            {pageData ? `${pageData.totalElements} entrées` : "—"}
          </span>
        </div>

        {loading && <p className="px-5 py-6 text-xs text-muted-foreground">Chargement...</p>}
        {!loading && error && <p className="px-5 py-4 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {!loading && !error && pageData && pageData.content.length === 0 && (
          <p className="px-5 py-6 text-xs text-muted-foreground">Aucune activité pour ces filtres.</p>
        )}

        {!loading && !error && pageData && pageData.content.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-5 py-3">Quand (UTC)</th>
                    <th className="text-left px-5 py-3">Action</th>
                    <th className="text-left px-5 py-3">Résultat</th>
                    <th className="text-left px-5 py-3">Actor</th>
                    <th className="text-left px-5 py-3">Cible</th>
                    <th className="text-left px-5 py-3">Code</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {pageData.content.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-nowrap">
                        {new Date(row.occurredAt).toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-foreground">{row.action}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          row.outcome === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        }`}>
                          {row.outcome}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{row.actorId ?? "—"}</td>
                      <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{row.targetUserId ?? "—"}</td>
                      <td className="px-5 py-3.5 text-[12px] text-foreground">{row.reasonCode}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedId(row.id)}
                          className="text-[11px] font-medium text-blue-600 hover:underline"
                        >
                          Détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/60">
              <button
                disabled={page <= 0}
                onClick={() => load(page - 1)}
                className="text-xs font-medium text-blue-600 disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-[11px] text-muted-foreground">
                Page {pageData.page + 1} / {Math.max(pageData.totalPages, 1)}
              </span>
              <button
                disabled={pageData.page + 1 >= pageData.totalPages}
                onClick={() => load(page + 1)}
                className="text-xs font-medium text-blue-600 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </>
        )}
      </CardShell>

      {selectedId != null && (
        <ActivityLogDetails logId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
