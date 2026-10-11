import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronUp, Play, RotateCcw, Trophy } from "lucide-react";
import {
  agentsApi, type AgentConfig, type Asset, type PairwiseTest, type PriceModel, type TournamentRequest,
  type TournamentResult, type TournamentRun,
} from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { inputClass, labelClass, modelLabel, pctPlain, pctSigned, strategyShort } from "../format";

const PALETTE = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DB2777", "#0891B2"];
const BENCH_COLOR = "#94A3B8";
const MEDALS = ["🥇", "🥈", "🥉"];
const MAX_AGENTS = 6;

const stars = (p: number) => (p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "");
const fmtP = (p: number) => (p < 0.0001 ? "<0.0001" : p.toFixed(4));

/** Boites a moustaches horizontales (quantiles 5-25-50-75-95 %) des rendements finaux. */
function BoxPlots({ result, colors }: { result: TournamentResult; colors: string[] }) {
  const rows = result.ranking;
  const min = Math.min(...rows.map((r) => r.q05), 0);
  const max = Math.max(...rows.map((r) => r.q95), 0);
  const width = 640;
  const left = 140;
  const right = 20;
  const rowH = 34;
  const height = rows.length * rowH + 30;
  const x = (v: number) => left + ((v - min) / (max - min || 1)) * (width - left - right);
  const ticks = Array.from({ length: 6 }, (_, i) => min + ((max - min) * i) / 5);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={x(t)} x2={x(t)} y1={6} y2={height - 22} stroke="#F1F5F9" />
          <text x={x(t)} y={height - 8} textAnchor="middle" fontSize="10" fill="#94A3B8">{(t * 100).toFixed(0)}%</text>
        </g>
      ))}
      <line x1={x(0)} x2={x(0)} y1={6} y2={height - 22} stroke="#CBD5E1" strokeDasharray="4 3" />
      {rows.map((r, i) => {
        const y = 10 + i * rowH + rowH / 2;
        const c = colors[i];
        return (
          <g key={r.name}>
            <text x={left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#475569">{r.name}</text>
            <line x1={x(r.q05)} x2={x(r.q95)} y1={y} y2={y} stroke={c} strokeWidth={1.5} />
            <line x1={x(r.q05)} x2={x(r.q05)} y1={y - 6} y2={y + 6} stroke={c} strokeWidth={1.5} />
            <line x1={x(r.q95)} x2={x(r.q95)} y1={y - 6} y2={y + 6} stroke={c} strokeWidth={1.5} />
            <rect x={x(r.q25)} y={y - 9} width={Math.max(1, x(r.q75) - x(r.q25))} height={18} rx={3} fill={c} fillOpacity={0.18} stroke={c} />
            <line x1={x(r.q50)} x2={x(r.q50)} y1={y - 9} y2={y + 9} stroke={c} strokeWidth={2.5} />
            <title>{`${r.name}\n5 % : ${pctSigned(r.q05)} · 25 % : ${pctSigned(r.q25)} · médiane : ${pctSigned(r.q50)} · 75 % : ${pctSigned(r.q75)} · 95 % : ${pctSigned(r.q95)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

/** Matrice des comparaisons : case (ligne, colonne) = ligne - colonne, coloree si significative. */
function PairMatrix({ result, tests, percent }: { result: TournamentResult; tests: PairwiseTest[]; percent: boolean }) {
  const n = result.ranking.length;
  const cell = (i: number, j: number) => {
    const t = tests.find((x) => (x.a === i && x.b === j) || (x.a === j && x.b === i));
    if (!t) return null;
    const diff = t.a === i ? t.meanDiff : -t.meanDiff;
    return { t, diff };
  };
  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th />
            {result.ranking.map((r) => <th key={r.name} className="text-[10px] font-medium text-muted-foreground px-1 max-w-[90px] truncate">{r.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {result.ranking.map((row, i) => (
            <tr key={row.name}>
              <td className="text-[11px] text-slate-600 pr-2 whitespace-nowrap">{row.name}</td>
              {Array.from({ length: n }, (_, j) => {
                if (i === j) return <td key={j} className="w-[88px] h-10 rounded bg-slate-50" />;
                const c = cell(i, j)!;
                const tone = !c.t.significant ? "bg-slate-100 text-slate-500" : c.diff > 0 ? "bg-emerald-500 text-white" : "bg-red-400 text-white";
                return (
                  <td key={j} title={c.t.verdict} className={`w-[88px] h-10 rounded text-center text-[11px] font-semibold ${tone}`} style={MONO}>
                    {percent ? `${c.diff >= 0 ? "+" : ""}${(c.diff * 100).toFixed(1)}` : `${c.diff >= 0 ? "+" : ""}${c.diff.toFixed(2)}`}
                    <span className="ml-0.5">{stars(c.t.pHolm)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-muted-foreground mt-2">
        Case = ligne − colonne. Vert : la ligne fait significativement mieux · rouge : significativement moins bien · gris : non significatif.
        * p&lt;0,05 · ** p&lt;0,01 · *** p&lt;0,001 (p corrigées de Holm).
      </p>
    </div>
  );
}

export default function TournamentPanel({ agents, assets }: { agents: AgentConfig[]; assets: Asset[] }) {
  const eligible = (a: AgentConfig) => a.strategy !== "Q_LEARNING" || !!a.trained;
  const [selected, setSelected] = useState<number[]>(() => agents.filter(eligible).slice(0, MAX_AGENTS).map((a) => a.id!));
  const [form, setForm] = useState({ symbol: "AAPL", paths: 2000, horizonDays: 252, model: "REGIME_SWITCHING" as PriceModel, seed: null as number | null, antithetic: true });
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [runs, setRuns] = useState<TournamentRun[]>([]);
  const [metric, setMetric] = useState<"sharpe" | "return">("sharpe");
  const [showMethod, setShowMethod] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadRuns = () => agentsApi.tournaments().then(setRuns).catch(() => setRuns([]));
  useEffect(() => { loadRuns(); }, []);

  const toggle = (id: number) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_AGENTS ? cur : [...cur, id]));

  const run = async (req: TournamentRequest) => {
    if (req.agentIds.length === 0) {
      setError("Sélectionnez au moins un agent");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setResult(await agentsApi.tournament(req));
      loadRuns();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const replay = (r: TournamentRun) => {
    const ids = r.agentIds.split(",").map(Number).filter((id) => agents.some((a) => a.id === id));
    const req: TournamentRequest = { agentIds: ids, symbol: r.symbol, paths: r.paths, horizonDays: r.horizonDays, model: r.model, seed: r.seed, antithetic: r.antithetic };
    setSelected(ids);
    setForm({ symbol: r.symbol, paths: r.paths, horizonDays: r.horizonDays, model: r.model, seed: r.seed, antithetic: r.antithetic });
    run(req);
  };

  // couleur stable par concurrent (le buy & hold toujours en gris)
  const colors = useMemo(() => {
    let k = 0;
    return result?.ranking.map((r) => (r.agentId == null ? BENCH_COLOR : PALETTE[k++ % PALETTE.length])) ?? [];
  }, [result]);

  const equityData = useMemo(() => result?.medianEquity.map((p) => {
    const row: Record<string, number> = { day: p.day };
    result.ranking.forEach((r, i) => { row[r.name] = p.values[i]; });
    return row;
  }) ?? [], [result]);

  const tests = result ? (metric === "sharpe" ? result.sharpeTests : result.returnTests) : [];

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Tournoi d'agents</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Tous les agents et le buy &amp; hold tradent exactement les mêmes marchés simulés (nombres aléatoires communs),
          puis chaque paire est comparée par des tests statistiques appariés avec correction de Holm.
        </p>

        <label className={labelClass}>Participants ({selected.length}/{MAX_AGENTS} + Buy &amp; Hold)</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {agents.map((a) => {
            const ok = eligible(a);
            const on = selected.includes(a.id!);
            return (
              <button key={a.id} type="button" disabled={!ok} onClick={() => toggle(a.id!)}
                title={ok ? "" : "Agent Q-learning non entraîné"}
                className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${on ? "bg-blue-600 border-blue-600 text-white" : "border-border text-muted-foreground hover:border-blue-300"}`}>
                {a.name} <span className="opacity-70 text-[10px]">· {strategyShort[a.strategy]}</span>
              </button>
            );
          })}
          <span className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500">Buy &amp; Hold (référence)</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className={labelClass}>Actif</label>
            <select value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} className={inputClass}>
              {assets.map((a) => <option key={a.symbol}>{a.symbol}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Marchés</label>
            <select value={form.paths} onChange={(e) => setForm({ ...form, paths: Number(e.target.value) })} className={inputClass}>
              {[500, 1000, 2000, 3000].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Horizon</label>
            <select value={form.horizonDays} onChange={(e) => setForm({ ...form, horizonDays: Number(e.target.value) })} className={inputClass}>
              <option value={126}>6 mois</option>
              <option value={252}>1 an</option>
              <option value={504}>2 ans</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className={labelClass}>Modèle</label>
            <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value as PriceModel })} className={inputClass}>
              {(Object.keys(modelLabel) as PriceModel[]).map((m) => <option key={m} value={m}>{modelLabel[m]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Seed</label>
            <input type="number" placeholder="aléatoire" value={form.seed ?? ""} onChange={(e) => setForm({ ...form, seed: e.target.value ? Number(e.target.value) : null })} className={inputClass} />
          </div>
          <div className="flex items-end">
            <button onClick={() => run({ ...form, agentIds: selected })} disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">
              <Play className="w-4 h-4" />{busy ? "Tournoi..." : "Lancer"}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </CardShell>

      {result && (
        <>
          {/* Verdict */}
          <div className="rounded-xl p-5 text-white" style={{ background: "linear-gradient(135deg, #1D4ED8, #0F2E7A)" }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0"><Trophy className="w-5 h-5 text-amber-300" /></div>
              <div>
                <p className="text-sm font-semibold mb-1">Verdict statistique</p>
                <p className="text-[13px] text-blue-100 leading-relaxed">{result.conclusion}</p>
                <p className="text-[11px] text-blue-200/80 mt-2" style={MONO}>
                  {result.paths} marchés communs · {result.symbol} · {modelLabel[result.model]} · {result.bootstrapSamples} rééchantillons bootstrap · seed {result.seed} · {result.elapsedMs} ms
                </p>
              </div>
            </div>
          </div>

          {/* Classement */}
          <CardShell className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Classement (Sharpe moyen)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-5 py-2.5">#</th>
                    <th className="text-left px-3 py-2.5">Concurrent</th>
                    <th className="text-right px-3 py-2.5">Sharpe</th>
                    <th className="text-right px-3 py-2.5">Rdt moyen</th>
                    <th className="text-right px-3 py-2.5">VaR 95</th>
                    <th className="text-right px-3 py-2.5">CVaR 95</th>
                    <th className="text-right px-3 py-2.5">Drawdown</th>
                    <th className="text-right px-3 py-2.5">P(gain)</th>
                    <th className="text-right px-5 py-2.5">Trades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-[12px]">
                  {result.ranking.map((c, i) => (
                    <tr key={c.name} className={c.agentId == null ? "bg-slate-50/60" : "hover:bg-muted/10"}>
                      <td className="px-5 py-2.5 text-base">{MEDALS[i] ?? <span className="text-xs text-muted-foreground">{c.rank}</span>}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors[i] }} />
                          <span className="font-medium text-foreground">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground">{c.strategy ? `${strategyShort[c.strategy]} · risque ${c.riskLevel}` : "référence"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-foreground" style={MONO}>{c.meanSharpe.toFixed(3)}</td>
                      <td className={`px-3 py-2.5 text-right ${c.meanReturn >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{pctSigned(c.meanReturn)}</td>
                      <td className="px-3 py-2.5 text-right" style={MONO}>{pctPlain(c.var95)}</td>
                      <td className="px-3 py-2.5 text-right" style={MONO}>{pctPlain(c.cvar95)}</td>
                      <td className="px-3 py-2.5 text-right" style={MONO}>{pctPlain(c.meanMaxDrawdown)}</td>
                      <td className="px-3 py-2.5 text-right" style={MONO}>{pctPlain(c.probProfit, 0)}</td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground" style={MONO}>{c.agentId == null ? "—" : c.avgTrades.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardShell>

          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            <CardShell className="p-5">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Distribution des rendements finaux</h3>
              <p className="text-[11px] text-muted-foreground mb-2">Moustaches 5–95 %, boîte 25–75 %, trait = médiane</p>
              <BoxPlots result={result} colors={colors} />
            </CardShell>
            <CardShell className="p-5">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Portefeuille médian (base 100)</h3>
              <p className="text-[11px] text-muted-foreground mb-2">Trajectoire médiane de chaque concurrent sur les mêmes marchés</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={equityData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "11px" }} labelFormatter={(d) => `Jour ${d}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={100} stroke="#E2E8F0" />
                  {result.ranking.map((r, i) => (
                    <Line key={r.name} dataKey={r.name} stroke={colors[i]} strokeWidth={r.agentId == null ? 1.5 : 2}
                      strokeDasharray={r.agentId == null ? "5 4" : undefined} dot={false} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardShell>
          </div>

          {/* Tests */}
          <CardShell className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Comparaisons appariées</h3>
                <p className="text-[11px] text-muted-foreground">Différence moyenne par marché et significativité</p>
              </div>
              <div className="flex gap-1 bg-muted/40 rounded-lg p-0.5">
                {(["sharpe", "return"] as const).map((m) => (
                  <button key={m} onClick={() => setMetric(m)}
                    className={`px-3 py-1 rounded-md text-[12px] font-medium ${metric === m ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
                    {m === "sharpe" ? "Sharpe" : "Rendement (pts %)"}
                  </button>
                ))}
              </div>
            </div>
            <PairMatrix result={result} tests={tests} percent={metric === "return"} />

            <div className="overflow-x-auto mt-5">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-3 py-2.5">Paire (A vs B)</th>
                    <th className="text-right px-3 py-2.5">Δ moyen</th>
                    <th className="text-right px-3 py-2.5">IC 95 % bootstrap</th>
                    <th className="text-right px-3 py-2.5">t</th>
                    <th className="text-right px-3 py-2.5">p (t)</th>
                    <th className="text-right px-3 py-2.5">p Holm</th>
                    <th className="text-right px-3 py-2.5">p boot.</th>
                    <th className="text-right px-3 py-2.5">p signes</th>
                    <th className="text-right px-3 py-2.5">A gagne</th>
                    <th className="text-right px-3 py-2.5">d Cohen</th>
                    <th className="text-right px-3 py-2.5">Gain CRN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-[11px]" style={MONO}>
                  {tests.map((t) => {
                    const f = (v: number) => (metric === "return" ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}` : `${v >= 0 ? "+" : ""}${v.toFixed(3)}`);
                    return (
                      <tr key={`${t.a}-${t.b}`} className={t.significant ? "" : "text-slate-400"}>
                        <td className="px-3 py-2 font-sans text-[12px] text-foreground">{t.nameA} <span className="text-muted-foreground">vs</span> {t.nameB}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${t.significant ? (t.meanDiff > 0 ? "text-emerald-600" : "text-red-500") : ""}`}>{f(t.meanDiff)}</td>
                        <td className="px-3 py-2 text-right">[{f(t.ciLow)} ; {f(t.ciHigh)}]</td>
                        <td className="px-3 py-2 text-right">{Number.isFinite(t.tStat) ? t.tStat.toFixed(2) : "∞"}</td>
                        <td className="px-3 py-2 text-right">{fmtP(t.pValue)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmtP(t.pHolm)} {stars(t.pHolm)}</td>
                        <td className="px-3 py-2 text-right">{fmtP(t.pBootstrap)}</td>
                        <td className="px-3 py-2 text-right">{fmtP(t.pSign)}</td>
                        <td className="px-3 py-2 text-right">{pctPlain(t.winRate, 0)}</td>
                        <td className="px-3 py-2 text-right">{t.cohenD.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">×{t.varianceFactor >= 1e5 ? "∞" : t.varianceFactor.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button onClick={() => setShowMethod(!showMethod)} className="mt-4 flex items-center gap-1 text-[12px] text-blue-600 font-medium">
              {showMethod ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}Méthodologie
            </button>
            {showMethod && (
              <div className="mt-2 bg-slate-50 rounded-lg p-4 border border-slate-100 text-[12px] text-slate-600 leading-relaxed space-y-1.5">
                <p><b>Nombres aléatoires communs (CRN).</b> Tous les concurrents tradent les mêmes marchés : la « chance du marché » s'annule dans la différence A − B, ce qui divise sa variance (colonne « Gain CRN »).</p>
                <p><b>Unité statistique.</b> Avec les variables antithétiques, les deux trajectoires (Z, −Z) d'une paire sont corrélées : les tests portent sur la moyenne de chaque paire, qui sont des observations indépendantes.</p>
                <p><b>Test t apparié.</b> t = moyenne(d) / (écart-type(d) / √n), loi de Student à n − 1 degrés de liberté.</p>
                <p><b>Bootstrap.</b> {result.bootstrapSamples} rééchantillonnages avec remise des différences : intervalle de confiance à 95 % par percentiles et p-value bootstrap, sans hypothèse de normalité.</p>
                <p><b>Test des signes.</b> Non paramétrique : A gagne-t-il sur plus de la moitié des marchés ? Robuste aux valeurs extrêmes.</p>
                <p><b>Correction de Holm-Bonferroni.</b> Avec {result.ranking.length} concurrents on fait {(result.ranking.length * (result.ranking.length - 1)) / 2} tests ; sans correction, on trouverait des « différences » par hasard. Seuil α = 5 % sur les p corrigées.</p>
                <p><b>d de Cohen.</b> Taille d'effet : 0,2 petit · 0,5 moyen · 0,8 grand. Une différence peut être significative mais minuscule.</p>
              </div>
            )}
          </CardShell>
        </>
      )}

      {runs.length > 0 && (
        <CardShell className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Historique des tournois</h3>
            <span className="text-[11px] text-muted-foreground">Rejouer = même seed → même résultat</span>
          </div>
          <div className="divide-y divide-border/40">
            {runs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[12px]">
                <span className="text-muted-foreground w-36 shrink-0">{new Date(r.createdAt).toLocaleString("fr-FR")}</span>
                <span className="font-medium text-foreground">🏆 {r.winner}</span>
                <span className="text-muted-foreground flex-1 min-w-[200px] truncate">{r.ranking} · {r.symbol} · {r.paths} marchés</span>
                <span className="text-muted-foreground" style={MONO}>seed {r.seed}</span>
                <button onClick={() => replay(r)} disabled={busy} className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-medium hover:text-blue-800">
                  <RotateCcw className="w-3 h-3" />Rejouer
                </button>
              </div>
            ))}
          </div>
        </CardShell>
      )}
    </div>
  );
}
