import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Layers, Play } from "lucide-react";
import { portfolioApi, type AgentConfig, type PortfolioResult } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { inputClass, labelClass } from "../format";
import { usePersistentState } from "../usePersistentState";

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")} %`;

/** Module 6 : l'agent gere tous ses actifs en meme temps, chacun avec un poids — effet de la diversification. */
export default function PortfolioPanel({ agent }: { agent: AgentConfig }) {
  const symbols = useMemo(() => agent.allowedAssets.split(",").map((s) => s.trim()).filter(Boolean), [agent.allowedAssets]);
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(symbols.map((s) => [s, 1])));
  const [days, setDays] = useState(252);
  const [capital, setCapital] = useState(10000);
  const [realData, setRealData] = useState(true);
  const [result, setResult] = usePersistentState<PortfolioResult | null>(`portfolio:${agent.id}`, null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = symbols.reduce((a, s) => a + (weights[s] ?? 0), 0);
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await portfolioApi.run(agent.id!, { days, capital, realData, weights }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const curve = result ? result.equity.map((v, i) => ({ day: i, agent: v, bench: result.benchmark[i] })) : [];

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Portefeuille multi-actifs</h3>
        </div>
        <p className="text-[12px] text-muted-foreground mb-4 max-w-3xl">
          {agent.name} gère en même temps tous ses actifs ({symbols.join(", ")}), chacun avec une part du capital.
          Si les actifs ne bougent pas ensemble, une chute sur l'un est amortie par les autres : c'est la diversification.
          Les données réelles sont utilisées quand l'historique a été téléchargé dans l'onglet « Données réelles ».
        </p>
        {symbols.length < 2 && (
          <p className="mb-3 text-[12px] text-amber-600">Cet agent n'a qu'un seul actif : modifie-le pour en ajouter d'autres.</p>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          {symbols.map((s) => (
            <div key={s}>
              <label className={labelClass}>{s} · {total > 0 ? Math.round(((weights[s] ?? 0) / total) * 100) : 0} %</label>
              <input type="range" min={0} max={10} value={weights[s] ?? 0} onChange={(e) => setWeights({ ...weights, [s]: Number(e.target.value) })}
                className="w-full accent-blue-600" />
            </div>
          ))}
          <div>
            <label className={labelClass}>Durée</label>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputClass}>
              <option value={126}>6 mois</option><option value={252}>1 an</option><option value={504}>2 ans</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Capital ($)</label>
            <input type="number" min={100} step={1000} value={capital} onChange={(e) => setCapital(Number(e.target.value))} className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-foreground pb-2">
            <input type="checkbox" checked={realData} onChange={(e) => setRealData(e.target.checked)} className="accent-blue-600" />
            Données réelles si disponibles
          </label>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        <button onClick={run} disabled={busy || total <= 0}
          className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-5 py-2.5">
          <Play className="w-4 h-4" />{busy ? "Simulation…" : "Simuler le portefeuille"}
        </button>
      </CardShell>

      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CardShell className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Agent (portefeuille)</p>
              <p className={`text-xl font-semibold mt-1 ${result.agentReturn >= 0 ? "text-emerald-500" : "text-red-500"}`} style={MONO}>{pct(result.agentReturn)}</p>
              <p className="text-[11px] text-muted-foreground">Sharpe {result.sharpe.toFixed(2).replace(".", ",")}</p>
            </CardShell>
            <CardShell className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Acheter et garder</p>
              <p className={`text-xl font-semibold mt-1 ${result.benchmarkReturn >= 0 ? "text-emerald-500" : "text-red-500"}`} style={MONO}>{pct(result.benchmarkReturn)}</p>
              <p className="text-[11px] text-muted-foreground">mêmes poids, sans agent</p>
            </CardShell>
            <CardShell className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Baisse maximale</p>
              <p className="text-xl font-semibold mt-1 text-red-500" style={MONO}>{pct(result.maxDrawdown)}</p>
              <p className="text-[11px] text-muted-foreground">pire actif seul : {pct(result.worstSingleDrawdown)}</p>
            </CardShell>
            <CardShell className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Diversification</p>
              <p className="text-xl font-semibold mt-1 text-foreground" style={MONO}>{Math.round(result.diversification * 100)} / 100</p>
              <p className="text-[11px] text-muted-foreground">corrélation moyenne {result.avgCorrelation.toFixed(2).replace(".", ",")}</p>
            </CardShell>
          </div>
          <CardShell className="p-5">
            <p className="text-[12.5px] text-foreground mb-3">{result.verdict}</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curve} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => `${Math.round(v).toLocaleString("fr-FR")} $`} domain={["auto", "auto"]} />
                  <Tooltip formatter={(v: number) => `${Math.round(v).toLocaleString("fr-FR")} $`} labelFormatter={(d) => `Jour ${d}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="agent" name="Agent (portefeuille)" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="bench" name="Acheter et garder" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="w-full min-w-[560px] text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-3 py-2">Actif</th><th className="text-right px-3 py-2">Poids</th><th className="text-left px-3 py-2">Données</th>
                    <th className="text-right px-3 py-2">Agent</th><th className="text-right px-3 py-2">Acheter et garder</th>
                    <th className="text-right px-3 py-2">Baisse max</th><th className="text-right px-3 py-2">Trades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {result.assets.map((a) => (
                    <tr key={a.symbol}>
                      <td className="px-3 py-2 font-medium text-foreground">{a.symbol}</td>
                      <td className="px-3 py-2 text-right" style={MONO}>{Math.round(a.weight * 100)} %</td>
                      <td className="px-3 py-2 text-muted-foreground">{a.source === "REEL" ? "réelles" : "simulées"}</td>
                      <td className={`px-3 py-2 text-right ${a.agentReturn >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{pct(a.agentReturn)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground" style={MONO}>{pct(a.benchmarkReturn)}</td>
                      <td className="px-3 py-2 text-right text-red-500" style={MONO}>{pct(a.maxDrawdown)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground" style={MONO}>{a.wins}/{a.trades}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardShell>
        </>
      )}
    </div>
  );
}
