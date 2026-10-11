import { useEffect, useMemo, useState } from "react";
import { Brain, CheckCircle, Star, Zap } from "lucide-react";
import { agentsApi, type AgentConfig, type AgentDecision, type Contribution } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { actionStyle } from "../format";

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

function Stars({ value, onRate }: { value: number | null; onRate: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} type="button" onMouseEnter={() => setHover(v)} onClick={() => onRate(v)} title={`Noter ${v}/5`}>
          <Star className={`w-3.5 h-3.5 ${(hover || value || 0) >= v ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
        </button>
      ))}
    </div>
  );
}

export default function DecisionsPanel({ agent }: { agent: AgentConfig }) {
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    agentsApi.decisions(agent.id!).then(setDecisions).catch((e) => setError(errorMessage(e)));
  }, [agent.id]);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const fresh = await agentsApi.decide(agent.id!);
      setDecisions((prev) => [...fresh, ...prev].slice(0, 50));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const rate = async (d: AgentDecision, rating: number) => {
    const updated = await agentsApi.rate(d.id, rating);
    setDecisions((prev) => prev.map((x) => (x.id === d.id ? updated : x)));
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

  const rated = decisions.filter((d) => d.userRating);
  const avgRating = rated.length ? rated.reduce((s, d) => s + (d.userRating ?? 0), 0) / rated.length : null;
  const avgConfidence = decisions.length ? decisions.reduce((s, d) => s + d.confidence, 0) / decisions.length : 0;
  const counts = { BUY: 0, SELL: 0, HOLD: 0 };
  decisions.forEach((d) => counts[d.action]++);

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Décisions de l'agent &amp; explications XAI</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {agent.strategy === "Q_LEARNING"
                ? "Attribution par occlusion sur la Q-table apprise."
                : "Valeurs SHAP exactes du modèle linéaire (la somme des contributions = score)."}
              {agent.active ? " Agent actif : BUY/SELL deviennent des ordres réels (module Trading)." : " Agent en pause : décisions simulées uniquement."}
            </p>
          </div>
          <button onClick={run} disabled={busy} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">
            <Brain className="w-4 h-4" />{busy ? "Analyse..." : "Analyser le marché"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        {decisions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div className="md:col-span-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Importance globale des variables (moyenne |SHAP|)</p>
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
                { label: "Décisions", value: String(decisions.length) },
                { label: "Confiance moy.", value: `${Math.round(avgConfidence * 100)} %` },
                { label: "BUY / SELL / HOLD", value: `${counts.BUY} / ${counts.SELL} / ${counts.HOLD}` },
                { label: "Note utilisateurs", value: avgRating ? `${avgRating.toFixed(1)} ★` : "—" },
              ].map((k) => (
                <div key={k.label} className="bg-muted/30 rounded-lg p-2.5">
                  <p className="text-[10px] text-muted-foreground">{k.label}</p>
                  <p className="text-sm font-semibold text-foreground" style={MONO}>{k.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardShell>

      <CardShell className="overflow-hidden">
        <div className="divide-y divide-border/40">
          {decisions.length === 0 && (
            <p className="px-5 py-10 text-center text-xs text-muted-foreground">Aucune décision. Cliquez sur « Analyser le marché ».</p>
          )}
          {decisions.map((d) => (
            <div key={d.id} className="px-5 py-4 hover:bg-muted/10 transition-colors">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-blue-700">{d.symbol.slice(0, 2)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{d.symbol}</span>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${actionStyle[d.action]}`}>{d.action}</span>
                      {d.quantity > 0 && <span className="text-[11px] text-muted-foreground" style={MONO}>× {d.quantity}</span>}
                      {d.orderId && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" />Ordre #{d.orderId}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(d.createdAt).toLocaleString("fr-FR")} · prix <span style={MONO}>{d.price.toLocaleString("en-US")}</span>
                      {d.stopLoss != null && <> · SL <span className="text-red-500" style={MONO}>{d.stopLoss.toLocaleString("en-US")}</span></>}
                      {d.takeProfit != null && <> · TP <span className="text-emerald-600" style={MONO}>{d.takeProfit.toLocaleString("en-US")}</span></>}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-[11px] text-muted-foreground">Confiance <span className="font-semibold text-foreground">{Math.round(d.confidence * 100)} %</span></p>
                  <Stars value={d.userRating} onRate={(v) => rate(d, v)} />
                </div>
              </div>

              <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-3">
                <div className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
                  <p className="text-[12px] text-slate-600 leading-relaxed">{d.explanation}</p>
                </div>
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
          ))}
        </div>
      </CardShell>
    </div>
  );
}
