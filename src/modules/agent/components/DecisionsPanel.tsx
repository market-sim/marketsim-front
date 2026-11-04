import { useEffect, useMemo, useState } from "react";
import { Bot, Brain, CheckCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { agentsApi, type AgentConfig, type AgentDecision, type AnomalyReport, type Contribution } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { actionStyle, humanExplanation, pctPlain } from "../format";
import BehaviorMonitor from "./BehaviorMonitor";
import ConfidenceGauge from "./ConfidenceGauge";

/** Barres divergentes : contribution de chaque variable (vert pousse a acheter / a la decision, rouge freine). */
function ContributionBars({ contributions }: { contributions: Contribution[] }) {
  const max = Math.max(0.05, ...contributions.map((c) => Math.abs(c.contribution)));
  return (
    <div className="space-y-1.5">
      {contributions.map((c) => {
        const width = (Math.abs(c.contribution) / max) * 50;
        const positive = c.contribution >= 0;
        return (
          <div key={c.feature} className="grid grid-cols-[150px_1fr_52px] items-center gap-2 text-[11px]">
            <span className="text-slate-500 truncate" title={`valeur observée : ${c.value.toFixed(2)}`}>{c.label}</span>
            <div className="relative h-3 bg-slate-100 rounded">
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300" />
              <div className={`absolute top-0.5 bottom-0.5 rounded ${positive ? "bg-emerald-500" : "bg-red-400"}`}
                style={positive ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }} />
            </div>
            <span className={`text-right font-medium ${positive ? "text-emerald-600" : "text-red-500"}`} style={MONO}>
              {positive ? "+" : ""}{c.contribution.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Evaluation humaine (cahier des charges : bonne / mauvaise decision). Stockee en 5 / 1 etoiles. */
function Approval({ value, onRate }: { value: number | null; onRate: (v: number) => void }) {
  const good = value != null && value >= 4;
  const bad = value != null && value <= 2;
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onRate(5)} title="Bonne décision"
        className={`p-1.5 rounded-md transition-colors ${good ? "bg-emerald-100 text-emerald-700" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}>
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => onRate(1)} title="Mauvaise décision"
        className={`p-1.5 rounded-md transition-colors ${bad ? "bg-red-100 text-red-600" : "text-slate-400 hover:bg-red-50 hover:text-red-500"}`}>
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function DecisionsPanel({ agent, onChange }: { agent: AgentConfig; onChange?: () => void }) {
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [report, setReport] = useState<AnomalyReport | null>(null);
  const [simWinRate, setSimWinRate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isQ = agent.strategy === "Q_LEARNING";

  const loadReport = () => agentsApi.anomalies(agent.id!).then(setReport).catch(() => setReport(null));

  useEffect(() => {
    setError("");
    setReport(null);
    loadReport();
    agentsApi.decisions(agent.id!).then(setDecisions).catch((e) => setError(errorMessage(e)));
    // dernier Monte Carlo ayant enregistre des trades (les anciens runs n'avaient pas ce champ)
    agentsApi.monteCarloRuns(agent.id!).then((runs) => setSimWinRate(runs.find((r) => r.winRate > 0)?.winRate ?? null)).catch(() => setSimWinRate(null));
  }, [agent.id]);

  const run = async (rounds = 1) => {
    setBusy(true);
    setError("");
    try {
      const fresh = await agentsApi.decide(agent.id!, rounds);
      setDecisions((prev) => [...fresh, ...prev].slice(0, 50));
      await loadReport();
      onChange?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const rate = async (d: AgentDecision, rating: number) => {
    const updated = await agentsApi.rate(d.id, rating);
    setDecisions((prev) => prev.map((x) => (x.id === d.id ? updated : x)));
    loadReport();
    onChange?.();
  };

  // XAI global : importance moyenne |contribution| de chaque variable sur l'historique
  const importance = useMemo(() => {
    const acc = new Map<string, { label: string; sum: number; n: number }>();
    decisions.forEach((d) => d.contributions.forEach((c) => {
      const e = acc.get(c.feature) ?? { label: c.label, sum: 0, n: 0 };
      e.sum += Math.abs(c.contribution);
      e.n++;
      acc.set(c.feature, e);
    }));
    const rows = [...acc.values()].map((e) => ({ label: e.label, value: e.sum / e.n })).sort((a, b) => b.value - a.value);
    const max = Math.max(1e-9, ...rows.map((r) => r.value));
    return rows.map((r) => ({ ...r, share: r.value / max }));
  }, [decisions]);

  const rated = decisions.filter((d) => d.userRating != null);
  const approved = rated.filter((d) => (d.userRating ?? 0) >= 4).length;
  const approval = rated.length ? approved / rated.length : null;
  const avgConfidence = decisions.length ? decisions.reduce((s, d) => s + d.confidence, 0) / decisions.length : 0;
  const counts = { BUY: 0, SELL: 0, HOLD: 0 };
  decisions.forEach((d) => counts[d.action]++);
  const latest = decisions[0];

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex-1 min-w-[240px]">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Décisions de l'agent &amp; explications XAI</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isQ ? "Attribution par occlusion sur la Q-table apprise." : "Valeurs SHAP exactes du modèle linéaire (la somme des contributions = score)."}
              {agent.active ? " Agent actif : BUY/SELL deviennent des ordres réels (module Trading)." : " Agent en pause : décisions simulées uniquement."}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => run(1)} disabled={busy} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">
                <Brain className="w-4 h-4" />{busy ? "Analyse..." : "Analyser le marché"}
              </button>
              <button onClick={() => run(5)} disabled={busy} title="5 analyses successives sur 5 états de marché différents"
                className="text-sm font-semibold rounded-lg px-3 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-60">
                ×5
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
          {latest && (
            <div className="flex flex-col items-center">
              <ConfidenceGauge value={latest.confidence} action={latest.action} label={`${latest.action} ${latest.symbol}`} />
              <span className="text-[10px] text-muted-foreground -mt-0.5">Dernière décision</span>
            </div>
          )}
        </div>

        {decisions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-border/40">
            <div className="md:col-span-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Importance globale des variables (moyenne |{isQ ? "attribution" : "SHAP"}|)</p>
              <div className="space-y-1.5">
                {importance.map((r) => (
                  <div key={r.label} className="grid grid-cols-[150px_1fr_40px] items-center gap-2 text-[11px]">
                    <span className="text-slate-500 truncate">{r.label}</span>
                    <div className="h-2 bg-slate-100 rounded-full"><div className="h-2 bg-violet-500 rounded-full" style={{ width: `${r.share * 100}%` }} /></div>
                    <span className="text-right text-slate-500" style={MONO}>{r.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 content-start">
              {[
                { label: "Approbation humaine", value: approval == null ? "—" : pctPlain(approval, 0), sub: `${approved} 👍 / ${rated.length} notées` },
                { label: "Win rate simulé", value: simWinRate == null ? "—" : pctPlain(simWinRate, 0), sub: simWinRate == null ? "lancez un Monte Carlo" : "dernier Monte Carlo" },
                { label: "Confiance moy.", value: `${Math.round(avgConfidence * 100)} %`, sub: `${decisions.length} décisions` },
                { label: "BUY / SELL / HOLD", value: `${counts.BUY} / ${counts.SELL} / ${counts.HOLD}`, sub: "répartition" },
              ].map((k) => (
                <div key={k.label} className="bg-muted/30 rounded-lg p-2.5">
                  <p className="text-[10px] text-muted-foreground">{k.label}</p>
                  <p className="text-sm font-semibold text-foreground" style={MONO}>{k.value}</p>
                  <p className="text-[9px] text-muted-foreground">{k.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardShell>

      <BehaviorMonitor report={report} />

      <CardShell className="overflow-hidden">
        <div className="divide-y divide-border/40">
          {decisions.length === 0 && (
            <p className="px-5 py-10 text-center text-xs text-muted-foreground">Aucune décision. Cliquez sur « Analyser le marché ».</p>
          )}
          {decisions.map((d) => (
            <div key={d.id} className="px-5 py-4 hover:bg-muted/10 transition-colors">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{d.symbol}</span>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${actionStyle[d.action]}`}>{d.action}</span>
                  {d.quantity > 0 && <span className="text-[11px] text-muted-foreground" style={MONO}>× {d.quantity}</span>}
                  {d.orderId && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" />Ordre #{d.orderId}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString("fr-FR")} · prix <span style={MONO}>{d.price.toLocaleString("en-US")}</span>
                    {d.stopLoss != null && <> · SL <span className="text-red-500" style={MONO}>{d.stopLoss.toLocaleString("en-US")}</span></>}
                    {d.takeProfit != null && <> · TP <span className="text-emerald-600" style={MONO}>{d.takeProfit.toLocaleString("en-US")}</span></>}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-20">
                    <div className="flex justify-between text-[10px] text-muted-foreground"><span>Confiance</span><span className="font-semibold text-foreground">{Math.round(d.confidence * 100)}%</span></div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-0.5"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${d.confidence * 100}%` }} /></div>
                  </div>
                  <Approval value={d.userRating} onRate={(v) => rate(d, v)} />
                </div>
              </div>

              {/* Bulle : l'agent explique sa decision */}
              <div className="mt-3 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="inline-block max-w-full bg-blue-50 border border-blue-100 text-[13px] text-slate-700 rounded-2xl rounded-tl-sm px-3.5 py-2 leading-relaxed">
                    {humanExplanation(d, isQ)}
                  </div>
                  <div className="mt-2 bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2.5">
                    <p className="text-[11px] text-slate-500 leading-relaxed">{d.explanation}</p>
                    <ContributionBars contributions={d.contributions} />
                    {d.qValues && (
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                        <span className="font-semibold uppercase tracking-wide">Valeurs Q</span>
                        {(["HOLD", "BUY", "SELL"] as const).map((a, i) => (
                          <span key={a} className={a === d.action ? "font-semibold text-slate-800" : ""} style={MONO}>{a} {d.qValues![i].toFixed(3)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardShell>
    </div>
  );
}
