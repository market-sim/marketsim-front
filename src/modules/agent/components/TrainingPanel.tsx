import { useEffect, useState } from "react";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GraduationCap, Info, Play } from "lucide-react";
import { agentsApi, type AgentConfig, type PolicyState, type PriceModel, type TrainingResult } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { inputClass, labelClass, modelLabel, pctPlain, pctSigned } from "../format";

const TREND = ["Baissière", "Neutre", "Haussière"];
const RSI = ["Survente", "Neutre", "Surachat"];
const COLS = [
  { vol: 0, position: 0, label: "Calme · à plat" },
  { vol: 0, position: 1, label: "Calme · investi" },
  { vol: 1, position: 0, label: "Agité · à plat" },
  { vol: 1, position: 1, label: "Agité · investi" },
];
const cellStyle = {
  BUY: "bg-emerald-500 text-white",
  SELL: "bg-red-400 text-white",
  HOLD: "bg-amber-100 text-amber-800",
} as const;

/** Heatmap de la politique apprise : action choisie pour chacun des 36 etats. */
function PolicyHeatmap({ policy }: { policy: PolicyState[] }) {
  const find = (trend: number, rsi: number, vol: number, position: number) =>
    policy.find((p) => p.trend === trend && p.rsi === rsi && p.volatility === vol && p.position === position);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr className="text-[10px] text-muted-foreground">
            <th className="text-left font-medium px-2">Tendance · RSI</th>
            {COLS.map((c) => <th key={c.label} className="font-medium">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {TREND.map((t, ti) => RSI.map((r, ri) => (
            <tr key={`${ti}-${ri}`}>
              <td className="text-[11px] text-slate-500 px-2 whitespace-nowrap">{t} · {r}</td>
              {COLS.map((c) => {
                const s = find(ti, ri, c.vol, c.position);
                if (!s) return <td key={c.label} />;
                const unvisited = s.q.every((v) => v === 0);
                return (
                  <td key={c.label}
                    title={`${s.description}\nQ(HOLD)=${s.q[0].toFixed(3)}  Q(BUY)=${s.q[1].toFixed(3)}  Q(SELL)=${s.q[2].toFixed(3)}${s.visits ? `\n${s.visits} visites` : ""}`}
                    className={`text-center text-[10px] font-semibold rounded py-1.5 ${unvisited ? "bg-slate-100 text-slate-400" : cellStyle[s.best]}`}>
                    {unvisited ? "—" : s.best}
                  </td>
                );
              })}
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}

export default function TrainingPanel({ agent, onTrained }: { agent: AgentConfig; onTrained: () => void }) {
  const symbols = agent.allowedAssets.split(",").map((s) => s.trim()).filter(Boolean);
  const [symbol, setSymbol] = useState(symbols[0] ?? "AAPL");
  const [episodes, setEpisodes] = useState(2000);
  const [model, setModel] = useState<PriceModel>("REGIME_SWITCHING");
  const [seed, setSeed] = useState<number | null>(null);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [policy, setPolicy] = useState<PolicyState[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Changement d'agent : on repart de zero et on charge sa politique deja apprise
  useEffect(() => {
    setResult(null);
    setError("");
    setSymbol(symbols[0] ?? "AAPL");
    if (agent.trained) agentsApi.policy(agent.id!).then(setPolicy).catch(() => setPolicy([]));
    else setPolicy([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  if (agent.strategy !== "Q_LEARNING") {
    return (
      <CardShell className="p-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">Cet agent utilise un modèle explicable à règles pondérées</p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
            L'apprentissage par renforcement concerne les agents « Q-learning ». Créez un agent avec cette stratégie
            (ou modifiez celui-ci) pour l'entraîner sur des marchés simulés par Monte Carlo, puis comparez ses performances
            avec cet agent dans l'onglet Monte Carlo.
          </p>
        </div>
      </CardShell>
    );
  }

  const train = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await agentsApi.train(agent.id!, { symbol, episodes, model, seed });
      setResult(r);
      setPolicy(r.policy);
      onTrained();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const e = result?.evaluation;

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-4 h-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Entraînement par renforcement (Q-learning)</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Chaque épisode = 1 an de marché simulé. Récompense = P&amp;L − frais − λ·variance (λ dépend de l'appétit pour le risque).
          Exploration ε-greedy, pas d'apprentissage α = 1/(1+n)<sup>0,6</sup>.
          {agent.trained && <> Dernier entraînement : <b>{agent.trainedEpisodes} épisodes</b> sur {agent.trainedOn}.</>}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className={labelClass}>Actif</label>
            <select value={symbol} onChange={(ev) => setSymbol(ev.target.value)} className={inputClass}>
              {symbols.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Épisodes</label>
            <select value={episodes} onChange={(ev) => setEpisodes(Number(ev.target.value))} className={inputClass}>
              {[300, 1000, 2000, 3000].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className={labelClass}>Marché d'entraînement</label>
            <select value={model} onChange={(ev) => setModel(ev.target.value as PriceModel)} className={inputClass}>
              {(Object.keys(modelLabel) as PriceModel[]).map((m) => <option key={m} value={m}>{modelLabel[m]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Seed</label>
            <input type="number" placeholder="aléatoire" value={seed ?? ""} onChange={(ev) => setSeed(ev.target.value ? Number(ev.target.value) : null)} className={inputClass} />
          </div>
          <div className="flex items-end">
            <button onClick={train} disabled={busy} className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">
              <Play className="w-4 h-4" />{busy ? "Entraînement..." : "Entraîner"}
            </button>
          </div>
        </div>
        {model === "GBM" && (
          <p className="text-[11px] text-amber-700 mt-3">
            Sous GBM le prix est une marche aléatoire : aucun signal n'est prévisible, l'agent apprendra surtout à gérer le risque.
          </p>
        )}
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </CardShell>

      {result && e && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Rendement moyen (test)", value: pctSigned(e.meanReturn), sub: `Buy & hold : ${pctSigned(e.benchmarkMeanReturn)}`, good: e.meanReturn >= e.benchmarkMeanReturn },
              { label: "Sharpe moyen (test)", value: e.meanSharpe.toFixed(2), sub: `Buy & hold : ${e.benchmarkMeanSharpe.toFixed(2)}`, good: e.meanSharpe >= e.benchmarkMeanSharpe },
              { label: "Drawdown max moyen", value: pctPlain(e.meanMaxDrawdown), sub: `Buy & hold : ${pctPlain(e.benchmarkMeanMaxDrawdown)}`, good: e.meanMaxDrawdown >= e.benchmarkMeanMaxDrawdown },
              { label: "Bat le buy & hold", value: pctPlain(e.probBeatBenchmark, 0), sub: `${e.paths} marchés jamais vus · ${result.elapsedMs} ms`, good: e.probBeatBenchmark >= 0.5 },
            ].map((k) => (
              <CardShell key={k.label} className="p-3.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">{k.label}</p>
                <p className={`text-lg font-semibold ${k.good ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
              </CardShell>
            ))}
          </div>

          <CardShell className="p-5">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Courbe d'apprentissage</h3>
            <p className="text-[11px] text-muted-foreground mb-3">Récompense moyenne par épisode et taux d'exploration ε</p>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={result.curve} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="episode" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="e" orientation="right" domain={[0, 1]} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "11px" }}
                  formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(3) : String(v))} labelFormatter={(ep) => `Épisode ${ep}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="r" dataKey="avgReward" name="Récompense moyenne" stroke="#7C3AED" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="e" dataKey="epsilon" name="ε (exploration)" stroke="#94A3B8" strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardShell>
        </>
      )}

      {policy.length > 0 && (
        <CardShell className="p-5">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Politique apprise (36 états)</h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Action choisie dans chaque situation de marché. Survolez une case pour voir les valeurs Q.
          </p>
          <PolicyHeatmap policy={policy} />
        </CardShell>
      )}
    </div>
  );
}
