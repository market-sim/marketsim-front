import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  adminApi,
  type LoginAnomaly,
  type LoginAnomalyPage,
  type LoginAnomalyStatus,
  type LoginRiskLevel,
} from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY } from "../../shared/ui";
import { inputClass, labelClass } from "../auth/AuthLayout";

const STATUSES: LoginAnomalyStatus[] = ["ASSESSED", "INSUFFICIENT_HISTORY", "UNAVAILABLE"];
const LEVELS: LoginRiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

function toIsoOrUndefined(localValue: string): string | undefined {
  if (!localValue) return undefined;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function riskBadge(level: LoginRiskLevel | null) {
  if (!level) return "bg-muted text-muted-foreground";
  if (level === "HIGH") return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (level === "MEDIUM") return "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
}

function statusLabel(status: LoginAnomalyStatus) {
  if (status === "INSUFFICIENT_HISTORY") return "Historique insuffisant";
  if (status === "UNAVAILABLE") return "Indisponible";
  return "Évalué";
}

export default function AdminLoginAnomaliesPage() {
  const [pageData, setPageData] = useState<LoginAnomalyPage | null>(null);
  const [page, setPage] = useState(0);
  const [actorId, setActorId] = useState("");
  const [riskLevel, setRiskLevel] = useState<LoginRiskLevel | "">("");
  const [status, setStatus] = useState<LoginAnomalyStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<LoginAnomaly | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailMissing, setDetailMissing] = useState(false);
  const [featureSummary, setFeatureSummary] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async (pageIndex: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.loginAnomalies({
        actorId: actorId.trim() || undefined,
        riskLevel,
        status,
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
  }, [actorId, riskLevel, status, from, to]);

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (row: LoginAnomaly) => {
    setSelected(row);
    setFeatureSummary(null);
    setDetailError("");
    setDetailMissing(false);
    setDetailLoading(true);
    try {
      const detail = await adminApi.loginAnomalyDetail(row.id);
      setFeatureSummary(detail.featureSummary ?? {});
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setDetailMissing(true);
      } else {
        setDetailError(errorMessage(e));
      }
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <p className="text-[12px] text-muted-foreground mb-3">
          Résultats purement consultatifs : un score élevé n&apos;bloque pas la connexion et ne modifie pas les rôles.
        </p>
        <h3 className="text-sm font-semibold text-foreground mb-3" style={DISPLAY}>Filtres</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load(0);
          }}
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end"
        >
          <div>
            <label className={labelClass}>Actor ID</label>
            <input value={actorId} onChange={(e) => setActorId(e.target.value)} className={inputClass} placeholder="ex: 1" />
          </div>
          <div>
            <label className={labelClass}>Risque</label>
            <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as LoginRiskLevel | "")} className={inputClass}>
              <option value="">Tous</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Statut</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as LoginAnomalyStatus | "")} className={inputClass}>
              <option value="">Tous</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Anomalies de connexion</h3>
          <span className="text-[11px] text-muted-foreground">
            {pageData ? `${pageData.totalElements} évaluations` : "—"}
          </span>
        </div>

        {loading && <p className="px-5 py-6 text-xs text-muted-foreground">Chargement...</p>}
        {!loading && error && <p className="px-5 py-4 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {!loading && !error && pageData && pageData.content.length === 0 && (
          <p className="px-5 py-6 text-xs text-muted-foreground">Aucune évaluation pour ces filtres.</p>
        )}

        {!loading && !error && pageData && pageData.content.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-5 py-3">Quand (UTC)</th>
                    <th className="text-left px-5 py-3">Actor</th>
                    <th className="text-left px-5 py-3">Statut</th>
                    <th className="text-left px-5 py-3">Score</th>
                    <th className="text-left px-5 py-3">Risque</th>
                    <th className="text-left px-5 py-3">Explications</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {pageData.content.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-nowrap">
                        {new Date(row.occurredAt).toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{row.actorId ?? "—"}</td>
                      <td className="px-5 py-3.5 text-[12px] text-foreground">{statusLabel(row.status)}</td>
                      <td className="px-5 py-3.5 text-[12px] text-foreground">
                        {row.riskScore == null ? "—" : Math.round(row.riskScore)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${riskBadge(row.riskLevel)}`}>
                          {row.riskLevel ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[11px] text-muted-foreground max-w-[220px] truncate">
                        {row.reasonCodes?.join(", ") || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => void openDetail(row)}
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
                onClick={() => void load(page - 1)}
                className="text-xs font-medium text-blue-600 disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-[11px] text-muted-foreground">
                Page {pageData.page + 1} / {Math.max(pageData.totalPages, 1)}
              </span>
              <button
                disabled={pageData.page + 1 >= pageData.totalPages}
                onClick={() => void load(page + 1)}
                className="text-xs font-medium text-blue-600 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </>
        )}
      </CardShell>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Évaluation #{selected.id}</h3>
                <p className="text-[11px] text-muted-foreground">Journal d&apos;activité #{selected.activityLogId}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">Fermer</button>
            </div>

            {detailLoading && <p className="text-xs text-muted-foreground py-4">Chargement...</p>}
            {!detailLoading && detailMissing && (
              <p className="text-xs text-muted-foreground py-4">
                Évaluation introuvable. L&apos;enregistrement a peut‑être été supprimé ou l&apos;identifiant est invalide.
              </p>
            )}
            {!detailLoading && !detailMissing && detailError && (
              <p className="text-xs text-red-600 dark:text-red-400 py-4">{detailError}</p>
            )}
            {!detailLoading && !detailMissing && !detailError && (
              <div className="space-y-3 text-[12px]">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <dt className="text-muted-foreground">Statut</dt>
                  <dd>{statusLabel(selected.status)}</dd>
                  <dt className="text-muted-foreground">Score</dt>
                  <dd>{selected.riskScore == null ? "—" : Math.round(selected.riskScore)}</dd>
                  <dt className="text-muted-foreground">Risque</dt>
                  <dd>{selected.riskLevel ?? "—"}</dd>
                  <dt className="text-muted-foreground">Modèle</dt>
                  <dd>{selected.modelVersion ?? "—"}</dd>
                  <dt className="text-muted-foreground">Explications</dt>
                  <dd>{selected.reasonCodes?.join(", ") || "—"}</dd>
                </dl>
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Résumé des features (sûr)
                  </h4>
                  {featureSummary == null || Object.keys(featureSummary).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun résumé de features disponible.</p>
                  ) : (
                    <ul className="space-y-1">
                      {Object.entries(featureSummary).map(([k, v]) => (
                        <li key={k} className="rounded-lg border border-border/60 px-3 py-2">
                          <span className="font-medium text-foreground">{k}</span>
                          <span className="text-muted-foreground"> : {String(v)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
