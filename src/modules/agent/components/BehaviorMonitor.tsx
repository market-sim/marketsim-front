import { AlertTriangle, CheckCircle2, Eye, ShieldQuestion } from "lucide-react";
import type { Anomaly, AnomalyReport } from "../../../api/endpoints";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";

const STATUS = {
  NORMAL: { label: "Comportement normal", Icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50 border-emerald-100" },
  WATCH: { label: "À surveiller", Icon: Eye, tone: "text-amber-700 bg-amber-50 border-amber-100" },
  ALERT: { label: "Comportement inhabituel", Icon: AlertTriangle, tone: "text-red-700 bg-red-50 border-red-100" },
  INSUFFICIENT_DATA: { label: "Pas assez de données", Icon: ShieldQuestion, tone: "text-slate-600 bg-slate-50 border-slate-100" },
} as const;

const SEVERITY = { HIGH: "bg-red-500", MEDIUM: "bg-orange-400", LOW: "bg-amber-300" } as const;

/** Valeur d'une metrique : % pour les proportions / confiances, $ pour les montants. */
function fmt(a: Anomaly, v: number) {
  return a.type === "POSITION_SIZE" ? `${Math.round(v).toLocaleString("fr-FR")} $` : `${Math.round(v * 100)} %`;
}

function Comparison({ a }: { a: Anomaly }) {
  const max = Math.max(a.baseline, a.recent, 1e-9);
  return (
    <div className="grid grid-cols-[70px_1fr_70px] items-center gap-2 text-[10px] mt-1.5">
      <span className="text-muted-foreground">Habituel</span>
      <div className="h-1.5 bg-slate-100 rounded-full"><div className="h-1.5 rounded-full bg-slate-400" style={{ width: `${(a.baseline / max) * 100}%` }} /></div>
      <span className="text-right text-muted-foreground" style={MONO}>{fmt(a, a.baseline)}</span>
      <span className="text-muted-foreground">Récent</span>
      <div className="h-1.5 bg-slate-100 rounded-full"><div className={`h-1.5 rounded-full ${SEVERITY[a.severity]}`} style={{ width: `${(a.recent / max) * 100}%` }} /></div>
      <span className="text-right font-semibold text-foreground" style={MONO}>{fmt(a, a.recent)}</span>
    </div>
  );
}

/** Carte de surveillance comportementale : l'agent agit-il comme d'habitude ? */
export default function BehaviorMonitor({ report }: { report: AnomalyReport | null }) {
  if (!report) return null;
  const s = STATUS[report.status];
  return (
    <CardShell className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Surveillance comportementale</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {report.baselineSource === "HISTORY"
              ? `Les ${report.recentSize} dernières décisions comparées aux ${report.baselineSize} précédentes.`
              : report.baselineSource === "SIMULATED"
                ? `Agent récent : ${report.recentSize} décisions comparées à un profil de référence simulé (${report.baselineSize} décisions).`
                : "Comparaison des décisions récentes au comportement habituel de l'agent."}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border ${s.tone}`}>
          <s.Icon className="w-3.5 h-3.5" />{s.label}
          {report.status !== "INSUFFICIENT_DATA" && <span className="opacity-70" style={MONO}>· {report.anomalyScore}/100</span>}
        </span>
      </div>

      <p className="text-[12px] text-foreground mt-3">{report.summary}</p>

      {report.anomalies.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {report.anomalies.map((a) => (
            <div key={a.type} className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${SEVERITY[a.severity]}`} />
                <span className="text-[12px] font-semibold text-foreground">{a.title}</span>
                <span className="text-[10px] text-muted-foreground ml-auto" style={MONO}>
                  {a.pValue != null && `p = ${a.pValue < 0.0001 ? "<0,0001" : a.pValue.toFixed(4).replace(".", ",")}`}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{a.message}</p>
              <Comparison a={a} />
            </div>
          ))}
        </div>
      )}
      {report.status === "NORMAL" && (
        <p className="text-[10px] text-muted-foreground mt-2">
          Tests surveillés : confiance (z-score), répartition achats / ventes / attentes (test exact), taille des positions,
          décision isolée et approbation humaine. Taux de fausses alertes mesuré : moins de 2 %.
        </p>
      )}
    </CardShell>
  );
}
