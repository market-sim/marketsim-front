import { useEffect, useMemo, useState } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Dices, Play, RotateCcw } from "lucide-react";
import {
  agentsApi, type AgentConfig, type MonteCarloRequest, type MonteCarloResult, type MonteCarloRun, type PriceModel,
} from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { inputClass, labelClass, modelLabel, pctPlain, pctSigned, strategyShort } from "../format";

const tooltipStyle = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "11px" };
const axisTick = { fontSize: 10, fill: "#94A3B8" };
const SAMPLE_COLORS = ["#60A5FA", "#A78BFA", "#F472B6", "#FBBF24", "#34D399", "#F87171", "#22D3EE", "#A3E635"];

function fmtTooltip(v: unknown) {
  if (Array.isArray(v)) return v.map((x) => Number(x).toFixed(1)).join(" – ");
  return typeof v === "number" ? v.toFixed(2) : String(v);
}

function Kpi({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-500" : "text-foreground";
  return (
    <CardShell className="p-3.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
      <p className={`text-lg font-semibold ${color}`} style={MONO}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </CardShell>
  );
}

export default function MonteCarloPanel({ agent }: { agent: AgentConfig }) {
  const symbols = agent.allowedAssets.split(",").map((s) => s.trim()).filter(Boolean);
  const [form, setForm] = useState<MonteCarloRequest>({
    symbol: symbols[0] ?? "AAPL", paths: 2000, horizonDays: 252, model: "REGIME_SWITCHING", antithetic: true, seed: null,
    mu: null, sigma: null,
  });
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [runs, setRuns] = useState<MonteCarloRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSamples, setShowSamples] = useState(false);

  const loadRuns = () => agentsApi.monteCarloRuns(agent.id!).then(setRuns).catch(() => setRuns([]));

  useEffect(() => {
    setResult(null);
    setError("");
    setForm((f) => ({ ...f, symbol: symbols[0] ?? f.symbol }));
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  const run = async (req: MonteCarloRequest) => {
    setBusy(true);
    setError("");
    try {
      setResult(await agentsApi.monteCarlo(agent.id!, req));
      loadRuns();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const replay = (r: MonteCarloRun) => {
    const req: MonteCarloRequest = {
      symbol: r.symbol, paths: r.paths, horizonDays: r.horizonDays, model: r.model, seed: r.seed, antithetic: r.antithetic,
      mu: r.mu, sigma: r.sigma,
    };
    setForm(req);
    run(req);
  };

  const fanData = useMemo(() => result?.fan.map((p, i) => {
    const row: Record<string, number | number[]> = {
      day: p.day, band90: [p.p5, p.p95], band50: [p.p25, p.p75], p50: p.p50, bench: p.benchmarkP50,
    };
    result.samplePaths.forEach((s, k) => { row[`s${k}`] = s[i]; });
    return row;
  }) ?? [], [result]);

  const histData = useMemo(() => result?.histogram.map((b) => ({
    label: `${((b.from + b.to) / 2 * 100).toFixed(0)}%`, agent: b.agent, benchmark: b.benchmark,
  })) ?? [], [result]);

  const convData = useMemo(() => result?.convergence.map((c) => ({
    paths: c.paths, mean: c.mean * 100, ci: [c.lower * 100, c.upper * 100],
  })) ?? [], [result]);

  const a = result?.agent;
  const b = result?.benchmark;

  return (
    <div className="space-y-4">
      {/* Parametres */}
      <CardShell className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Dices className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Simulation Monte Carlo</h3>
          <span className="text-[11px] text-muted-foreground">— l'agent trade sur des milliers de futurs possibles</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={labelClass}>Actif</label>
            <select value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} className={inputClass}>
              {symbols.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Trajectoires</label>
            <select value={form.paths} onChange={(e) => setForm({ ...form, paths: Number(e.target.value) })} className={inputClass}>
              {[500, 1000, 2000, 5000].map((n) => <option key={n} value={n}>{n.toLocaleString("fr-FR")}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Horizon</label>
            <select value={form.horizonDays} onChange={(e) => setForm({ ...form, horizonDays: Number(e.target.value) })} className={inputClass}>
              <option value={63}>3 mois (63 j)</option>
              <option value={126}>6 mois (126 j)</option>
              <option value={252}>1 an (252 j)</option>
              <option value={504}>2 ans (504 j)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Modèle de marché</label>
            <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value as PriceModel })} className={inputClass}>
              {(Object.keys(modelLabel) as PriceModel[]).map((m) => <option key={m} value={m}>{modelLabel[m]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Seed (reproductible)</label>
            <input type="number" placeholder="aléatoire" value={form.seed ?? ""} onChange={(e) => setForm({ ...form, seed: e.target.value ? Number(e.target.value) : null })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Volatilité forcée (%/an)</label>
            <input type="number" placeholder="calibrée" value={form.sigma != null ? form.sigma * 100 : ""} onChange={(e) => setForm({ ...form, sigma: e.target.value ? Number(e.target.value) / 100 : null })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Drift forcé (%/an)</label>
            <input type="number" placeholder="calibré" value={form.mu != null ? form.mu * 100 : ""} onChange={(e) => setForm({ ...form, mu: e.target.value ? Number(e.target.value) / 100 : null })} className={inputClass} />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={form.antithetic} onChange={(e) => setForm({ ...form, antithetic: e.target.checked })} className="accent-blue-600" />
              Variables antithétiques
            </label>
            <button onClick={() => run(form)} disabled={busy} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">
              <Play className="w-4 h-4" />{busy ? "Simulation..." : "Lancer"}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </CardShell>

      {result && a && b && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Rendement espéré" value={pctSigned(a.meanReturn)} sub={`Buy & hold : ${pctSigned(b.meanReturn)}`} tone={a.meanReturn >= 0 ? "good" : "bad"} />
            <Kpi label="VaR 95 %" value={pctPlain(a.var95)} sub={`B&H : ${pctPlain(b.var95)} · VaR 99 % : ${pctPlain(a.var99)}`} tone={a.var95 < b.var95 ? "good" : "bad"} />
            <Kpi label="CVaR 95 % (Expected Shortfall)" value={pctPlain(a.cvar95)} sub={`B&H : ${pctPlain(b.cvar95)}`} tone={a.cvar95 < b.cvar95 ? "good" : "bad"} />
            <Kpi label="Probabilité de gain" value={pctPlain(a.probProfit, 0)} sub={`Bat le B&H : ${pctPlain(result.probBeatBenchmark, 0)}`} />
            <Kpi label="Drawdown max moyen" value={pctPlain(a.meanMaxDrawdown)} sub={`B&H : ${pctPlain(b.meanMaxDrawdown)} · pire : ${pctPlain(a.worstMaxDrawdown)}`} tone={a.meanMaxDrawdown > b.meanMaxDrawdown ? "good" : "bad"} />
            <Kpi label="Sharpe moyen" value={a.meanSharpe.toFixed(2)} sub={`B&H : ${b.meanSharpe.toFixed(2)}`} tone={a.meanSharpe > b.meanSharpe ? "good" : "bad"} />
            <Kpi label="Activité" value={`${result.avgTrades.toFixed(1)} trades`} sub={`Exposition ${pctPlain(result.avgExposure, 0)} · gagnants ${pctPlain(result.winRate, 0)}`} />
            <Kpi label="Calcul" value={`${result.elapsedMs} ms`} sub={`${result.paths.toLocaleString("fr-FR")} trajectoires · seed ${result.seed}`} />
          </div>

          {/* Cone de projection */}
          <CardShell className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Cône de projection du portefeuille (base 100)</h3>
                <p className="text-[11px] text-muted-foreground">{modelLabel[result.model]} · μ {pctSigned(result.mu, 0)} · σ {pctPlain(result.sigma, 0)} · départ {result.startPrice.toLocaleString("en-US")}</p>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={showSamples} onChange={(e) => setShowSamples(e.target.checked)} className="accent-blue-600" />
                Afficher {result.samplePaths.length} trajectoires
              </label>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={fanData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} labelFormatter={(d) => `Jour ${d}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={100} stroke="#CBD5E1" />
                <Area dataKey="band90" name="Intervalle 5–95 %" stroke="none" fill="#2563EB" fillOpacity={0.1} isAnimationActive={false} />
                <Area dataKey="band50" name="Intervalle 25–75 %" stroke="none" fill="#2563EB" fillOpacity={0.22} isAnimationActive={false} />
                {showSamples && result.samplePaths.map((_, k) => (
                  <Line key={k} dataKey={`s${k}`} stroke={SAMPLE_COLORS[k % SAMPLE_COLORS.length]} strokeWidth={1} dot={false} legendType="none" name={`Trajectoire ${k + 1}`} isAnimationActive={false} />
                ))}
                <Line dataKey="p50" name={`Médiane agent (${strategyShort[agent.strategy]})`} stroke="#1D4ED8" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="bench" name="Médiane buy & hold" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardShell>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Distribution */}
            <CardShell className="p-5">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Distribution des rendements finaux</h3>
              <p className="text-[11px] text-muted-foreground mb-3">Une queue gauche plus courte = moins de pertes extrêmes</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={histData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={0} barCategoryGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="agent" name="Agent" fill="#2563EB" isAnimationActive={false} />
                  <Bar dataKey="benchmark" name="Buy & hold" fill="#CBD5E1" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </CardShell>

            {/* Convergence */}
            <CardShell className="p-5">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Convergence de l'estimateur</h3>
              <p className="text-[11px] text-muted-foreground mb-3">Rendement moyen (%) et intervalle de confiance à 95 % selon le nombre de trajectoires</p>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={convData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="paths" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} labelFormatter={(n) => `${n} trajectoires`} />
                  <Area dataKey="ci" name="IC 95 %" stroke="none" fill="#7C3AED" fillOpacity={0.15} isAnimationActive={false} />
                  <Line dataKey="mean" name="Moyenne" stroke="#7C3AED" strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardShell>
          </div>

          {/* Comparaison */}
          <CardShell className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Agent vs buy &amp; hold</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-2.5">Indicateur</th>
                  <th className="text-right px-5 py-2.5">Agent</th>
                  <th className="text-right px-5 py-2.5">Buy &amp; hold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {[
                  ["Rendement moyen", pctSigned(a.meanReturn), pctSigned(b.meanReturn)],
                  ["Rendement médian", pctSigned(a.medianReturn), pctSigned(b.medianReturn)],
                  ["Écart-type", pctPlain(a.stdReturn), pctPlain(b.stdReturn)],
                  ["VaR 95 %", pctPlain(a.var95), pctPlain(b.var95)],
                  ["VaR 99 %", pctPlain(a.var99), pctPlain(b.var99)],
                  ["CVaR 95 %", pctPlain(a.cvar95), pctPlain(b.cvar95)],
                  ["Probabilité de gain", pctPlain(a.probProfit, 0), pctPlain(b.probProfit, 0)],
                  ["Drawdown max moyen", pctPlain(a.meanMaxDrawdown), pctPlain(b.meanMaxDrawdown)],
                  ["Pire drawdown", pctPlain(a.worstMaxDrawdown), pctPlain(b.worstMaxDrawdown)],
                  ["Sharpe moyen", a.meanSharpe.toFixed(2), b.meanSharpe.toFixed(2)],
                ].map(([label, x, y]) => (
                  <tr key={label} className="hover:bg-muted/10">
                    <td className="px-5 py-2 text-muted-foreground text-[12px]">{label}</td>
                    <td className="px-5 py-2 text-right font-medium text-foreground" style={MONO}>{x}</td>
                    <td className="px-5 py-2 text-right text-muted-foreground" style={MONO}>{y}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardShell>
        </>
      )}

      {/* Historique */}
      {runs.length > 0 && (
        <CardShell className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Historique des simulations</h3>
            <span className="text-[11px] text-muted-foreground">Rejouer = même seed → résultat identique</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-2.5">Date</th>
                  <th className="text-left px-3 py-2.5">Actif · modèle</th>
                  <th className="text-right px-3 py-2.5">Traj.</th>
                  <th className="text-right px-3 py-2.5">Rdt moyen</th>
                  <th className="text-right px-3 py-2.5">VaR 95</th>
                  <th className="text-right px-3 py-2.5">Sharpe</th>
                  <th className="text-right px-3 py-2.5">Seed</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-[12px]">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/10">
                    <td className="px-5 py-2 text-muted-foreground">{new Date(r.createdAt).toLocaleString("fr-FR")}</td>
                    <td className="px-3 py-2 text-foreground">{r.symbol} · {r.model.replace("_", " ").toLowerCase()}</td>
                    <td className="px-3 py-2 text-right" style={MONO}>{r.paths}</td>
                    <td className={`px-3 py-2 text-right ${r.meanReturn >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{pctSigned(r.meanReturn)}</td>
                    <td className="px-3 py-2 text-right" style={MONO}>{pctPlain(r.var95)}</td>
                    <td className="px-3 py-2 text-right" style={MONO}>{r.meanSharpe.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground" style={MONO}>{r.seed}</td>
                    <td className="px-5 py-2 text-right">
                      <button onClick={() => replay(r)} disabled={busy} className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-medium hover:text-blue-800">
                        <RotateCcw className="w-3 h-3" />Rejouer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardShell>
      )}
    </div>
  );
}
