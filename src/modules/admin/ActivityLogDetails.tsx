import { useEffect, useState } from "react";
import { Link } from "react-router";
import { adminApi, type ActivityLogDetail, type LoginAnomaly } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { DISPLAY } from "../../shared/ui";

export default function ActivityLogDetails({
  logId,
  onClose,
}: {
  logId: number;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ActivityLogDetail | null>(null);
  const [anomaly, setAnomaly] = useState<LoginAnomaly | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setDetail(null);
    setAnomaly(undefined);
    adminApi.activityLogDetail(logId)
      .then(async (data) => {
        if (cancelled) return;
        setDetail(data);
        if (data.action === "LOGIN") {
          try {
            const page = await adminApi.loginAnomalies({ activityLogId: logId, size: 1 });
            if (!cancelled) {
              setAnomaly(page.content[0] ?? null);
            }
          } catch {
            if (!cancelled) setAnomaly(null);
          }
        } else if (!cancelled) {
          setAnomaly(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [logId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Détail de l&apos;opération</h3>
            <p className="text-[11px] text-muted-foreground">Journal #{logId}</p>
          </div>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Fermer</button>
        </div>

        {loading && <p className="text-xs text-muted-foreground py-6">Chargement...</p>}
        {!loading && error && <p className="text-xs text-red-600 dark:text-red-400 py-4">{error}</p>}
        {!loading && !error && !detail && (
          <p className="text-xs text-muted-foreground py-4">Enregistrement introuvable.</p>
        )}

        {!loading && detail && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
              <dt className="text-muted-foreground">Quand (UTC)</dt>
              <dd className="text-foreground">{new Date(detail.occurredAt).toISOString().replace("T", " ").slice(0, 19)}</dd>
              <dt className="text-muted-foreground">Action</dt>
              <dd className="text-foreground">{detail.action}</dd>
              <dt className="text-muted-foreground">Résultat</dt>
              <dd className="text-foreground">{detail.outcome}</dd>
              <dt className="text-muted-foreground">Actor</dt>
              <dd className="text-foreground">{detail.actorId ?? "—"}</dd>
              <dt className="text-muted-foreground">Cible</dt>
              <dd className="text-foreground">{detail.targetUserId ?? "—"}</dd>
              <dt className="text-muted-foreground">Code</dt>
              <dd className="text-foreground">{detail.reasonCode}</dd>
              <dt className="text-muted-foreground">Correlation ID</dt>
              <dd className="text-foreground break-all">{detail.correlationId ?? "—"}</dd>
              <dt className="text-muted-foreground">Mot de passe</dt>
              <dd className="text-foreground">{detail.passwordChanged ? "passwordChanged: true" : "passwordChanged: false"}</dd>
            </dl>

            {detail.action === "LOGIN" && (
              <div className="rounded-lg border border-border/60 px-3 py-3 space-y-1.5">
                <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Risque de connexion (consultatif)
                </h4>
                {anomaly === undefined && (
                  <p className="text-xs text-muted-foreground">Chargement de l&apos;évaluation...</p>
                )}
                {anomaly === null && (
                  <p className="text-xs text-muted-foreground">Aucune évaluation liée à cette entrée.</p>
                )}
                {anomaly && (
                  <>
                    <p className="text-[12px] text-foreground">
                      {anomaly.status === "ASSESSED"
                        ? `Score ${anomaly.riskScore == null ? "—" : Math.round(anomaly.riskScore)} · ${anomaly.riskLevel ?? "—"}`
                        : anomaly.status === "INSUFFICIENT_HISTORY"
                          ? "Historique insuffisant (pas de score inventé)"
                          : "Modèle indisponible"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {anomaly.reasonCodes?.join(", ") || "—"}
                      {anomaly.modelVersion ? ` · ${anomaly.modelVersion}` : ""}
                    </p>
                    <Link
                      to="/admin/login-anomalies"
                      className="inline-block text-[11px] font-medium text-blue-600 hover:underline"
                      onClick={onClose}
                    >
                      Voir les anomalies de connexion
                    </Link>
                  </>
                )}
              </div>
            )}

            <div>
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Changements</h4>
              {!detail.detailsAvailable ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Détails indisponibles (entrée historique avant la traçabilité enrichie).
                </p>
              ) : detail.changes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun changement committed (échec ou pas de champ sensible modifié).</p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.changes.map((c) => (
                    <li key={`${c.field}-${c.before}-${c.after}`} className="rounded-lg border border-border/60 px-3 py-2 text-[12px]">
                      <span className="font-medium text-foreground">{c.field}</span>
                      <span className="text-muted-foreground"> : {c.before ?? "—"} → {c.after ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
