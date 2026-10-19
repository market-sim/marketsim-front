import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Database, FlaskConical, Play, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import {
  marketDataApi, walkForwardApi, type AgentConfig, type SeriesInfo, type WalkForwardResult,
} from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { useAuth } from "../../../auth/AuthContext";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { usePersistentState } from "../usePersistentState";
import { inputClass, labelClass, pctSigned, shortHash, strategyShort } from "../format";

const tooltipStyle = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "11px" };
const axisTick = { fontSize: 10, fill: "#94A3B8" };
const TRAIN_OPTIONS = [{ v: 252, l: "1 an" }, { v: 504, l: "2 ans" }, { v: 756, l: "3 ans" }];
const TEST_OPTIONS = [{ v: 63, l: "3 mois" }, { v: 126, l: "6 mois" }, { v: 252, l: "1 an" }];

const year = (t: number) => String(new Date(t).getUTCFullYear());
const dateLabel = (t: number) => new Date(t).toISOString().slice(0, 10);
const stars = (p: number) => (p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "");
const fmtP = (p: number) => (p < 0.0001 ? "< 0.0001" : p.toFixed(4));

function Kpi({ label, agent, bench, fmt, better }: { label: string; agent: number; bench: number; fmt: (v: number) => string; better: "high" | "low" }) {
  const win = better === "high" ? agent > bench : agent < bench;
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-lg font-semibold ${win ? "text-emerald-600" : "text-foreground"}`} style={MONO}>{fmt(agent)}</span>
        <span className="text-[11px] text-muted-foreground" style={MONO}>B&H {fmt(bench)}</span>
      </div>
    </div>
  );
}

/** Backtest walk-forward sur historique REEL : entrainement sur le passe, test sur ce que l'agent n'a jamais vu. */
export default function WalkForwardPanel({ agent, onOpenAudit }: { agent: AgentConfig; onOpenAudit?: (recordId: number) => void }) {
  const { user } = useAuth();
  const symbols = useMemo(() => agent.allowedAssets.split(",").map((s) => s.trim()).filter(Boolean), [agent.allowedAssets]);
  const learns = agent.strategy === "Q_LEARNING";

  const [symbol, setSymbol] = usePersistentState<string>(`marketsim:wf:symbol:${agent.id}`, symbols[0] ?? "AAPL");
  const [trainDays, setTrainDays] = usePersistentState<number>("marketsim:wf:train", 504);
  const [testDays, setTestDays] = usePersistentState<number>("marketsim:wf:test", 126);
  const [episodes, setEpisodes] = usePersistentState<number>("marketsim:wf:episodes", 300);
  const [result, setResult] = usePersistentState<WalkForwardResult | null>(`marketsim:wf:result:${agent.id}`, null);
  const [series, setSeries] = useState<SeriesInfo | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const activeSymbol = symbols.includes(symbol) ? symbol : symbols[0];

  const loadSeries = async (action: () => Promise<SeriesInfo>) => {
    setLoadingData(true);
    setError("");
    try {
      setSeries(await action());
    } catch (e) {
      setSeries(null);
      setError(errorMessage(e));
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (activeSymbol) loadSeries(() => marketDataApi.series(activeSymbol));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol]);

  const run = async () => {
    if (!agent.id || !activeSymbol) return;
    setBusy(true);
    setError("");
    try {
      setResult(await walkForwardApi.run(agent.id, { symbol: activeSymbol, trainDays, testDays, episodes }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file || !activeSymbol) return;
    await loadSeries(async () => marketDataApi.importCsv(activeSymbol, await file.text()));
    if (fileRef.current) fileRef.current.value = "";
  };

  const shown = result && result.symbol === activeSymbol ? result : null;

  const priceData = useMemo(
    () => (shown ?? series)?.prices.map((p) => ({ t: Date.parse(p.date), close: p.close })) ?? [],
    [shown, series],
  );
  const curveData = useMemo(
    () => shown?.curve.map((p) => ({ t: Date.parse(p.date), agent: p.agent, benchmark: p.benchmark })) ?? [],
    [shown],
  );

  const t = shown?.test ?? null;
  const good = !!t && t.pValue < 0.05 && t.meanExcess > 0;

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Backtest walk-forward sur données réelles</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 max-w-3xl">
              Les cours sont de vrais cours journaliers (Yahoo Finance). À chaque fenêtre, l'agent{learns ? " apprend" : " est calibré"} uniquement
              sur le <b>passé</b>, puis il est évalué sur la période suivante qu'il n'a jamais vue ; les fenêtres de test mises bout à bout forment
              un historique hors échantillon, comparé au buy &amp; hold sur exactement la même période.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className={labelClass}>Actif</label>
            <select value={activeSymbol} onChange={(e) => setSymbol(e.target.value)} className={inputClass}>
              {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Entraînement</label>
            <select value={trainDays} onChange={(e) => setTrainDays(Number(e.target.value))} className={inputClass}>
              {TRAIN_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Test (hors échantillon)</label>
            <select value={testDays} onChange={(e) => setTestDays(Number(e.target.value))} className={inputClass}>
              {TEST_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Épisodes RL</label>
            <input type="number" min={50} max={2000} step={50} value={episodes} disabled={!learns}
              onChange={(e) => setEpisodes(Number(e.target.value))} className={`${inputClass} disabled:opacity-50`} />
          </div>
          <button onClick={run} disabled={busy || !activeSymbol || !series}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">
            <Play className="w-4 h-4" />{busy ? "Calcul…" : "Lancer"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </CardShell>

      {/* Jeu de donnees */}
      <CardShell className="p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>
            {activeSymbol} · historique réel{shown ? " et fenêtres de test" : ""}
          </h3>
          {series && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${series.source === "YAHOO" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>
              {series.source === "YAHOO" ? "Yahoo Finance" : "CSV importé"}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => activeSymbol && loadSeries(() => marketDataApi.refresh(activeSymbol))} disabled={loadingData}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`} />Actualiser
            </button>
            {user?.role === "ADMIN" && (
              <>
                <button onClick={() => fileRef.current?.click()} disabled={loadingData}
                  title="Remplace l'historique de cet actif par un export CSV (Date, Close)"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50">
                  <Upload className="w-3.5 h-3.5" />Importer un CSV
                </button>
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
              </>
            )}
          </div>
        </div>
        {series && (
          <p className="text-[11px] text-muted-foreground mb-2" style={MONO}>
            {series.points.toLocaleString("fr-FR")} jours · {series.from} → {series.to} · empreinte SHA-256 {shortHash(series.dataHash)}
          </p>
        )}
        {loadingData && !series ? (
          <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Téléchargement de l'historique…</div>
        ) : series ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={priceData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={year} tick={axisTick} />
                <YAxis tick={axisTick} domain={["auto", "auto"]} scale="log" allowDataOverflow />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => dateLabel(Number(v))} formatter={(v) => [Number(v).toFixed(2), "Cours ajusté"]} />
                {shown?.windows.map((w, i) => (
                  <ReferenceArea key={w.index} x1={Date.parse(w.testFrom)} x2={Date.parse(w.testTo)}
                    fill={i % 2 === 0 ? "#2563EB" : "#7C3AED"} fillOpacity={0.1} strokeOpacity={0} />
                ))}
                <Line type="monotone" dataKey="close" stroke="#0F172A" strokeWidth={1.4} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : null}
        {shown && <p className="text-[11px] text-muted-foreground mt-1">Zones colorées = fenêtres de test hors échantillon (échelle logarithmique) ; le reste sert uniquement à l'entraînement.</p>}
      </CardShell>

      {busy && <CardShell className="p-8 text-center text-sm text-muted-foreground">Entraînement et test de {Math.max(1, Math.floor(((series?.points ?? 2500) - trainDays) / testDays))} fenêtres…</CardShell>}

      {shown && !busy && (
        <>
          <CardShell className="p-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <FlaskConical className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>
                Résultat hors échantillon · {strategyShort[shown.strategy]} (risque {shown.riskLevel})
              </h3>
              <span className="text-[11px] text-muted-foreground ml-auto" style={MONO}>
                {shown.windows.length} fenêtres · test {shown.windows[0].testFrom} → {shown.windows[shown.windows.length - 1].testTo} · {shown.elapsedMs} ms · graine {shown.seed}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="Rendement total" agent={shown.agent.totalReturn} bench={shown.benchmark.totalReturn} fmt={(v) => pctSigned(v, 0)} better="high" />
              <Kpi label="Rendement annualisé" agent={shown.agent.annualizedReturn} bench={shown.benchmark.annualizedReturn} fmt={(v) => pctSigned(v)} better="high" />
              <Kpi label="Ratio de Sharpe" agent={shown.agent.sharpe} bench={shown.benchmark.sharpe} fmt={(v) => v.toFixed(2)} better="high" />
              <Kpi label="Perte max (drawdown)" agent={shown.agent.maxDrawdown} bench={shown.benchmark.maxDrawdown} fmt={(v) => pctSigned(v, 0)} better="high" />
            </div>

            <div className={`mt-4 rounded-lg border px-4 py-3 text-[13px] leading-relaxed ${good ? "bg-emerald-50/60 border-emerald-200 text-emerald-900" : "bg-amber-50/60 border-amber-200 text-amber-950"}`}>
              <b>Verdict statistique.</b> {shown.verdict}
            </div>

            <div className="h-60 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={curveData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={year} tick={axisTick} />
                  <YAxis tick={axisTick} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => dateLabel(Number(v))} formatter={(v, n) => [Number(v).toFixed(1), n === "agent" ? "Agent" : "Buy & hold"]} />
                  <Legend formatter={(v) => (v === "agent" ? "Agent (hors échantillon, base 100)" : "Buy & hold (base 100)")} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="benchmark" stroke="#94A3B8" strokeWidth={1.6} dot={false} />
                  <Line type="monotone" dataKey="agent" stroke="#2563EB" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {shown.auditRecordId != null && onOpenAudit && (
              <button onClick={() => onOpenAudit(shown.auditRecordId!)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white text-[12px] font-medium px-3 py-1.5 hover:bg-slate-700">
                <ShieldCheck className="w-3.5 h-3.5" />Certifié dans le registre d'audit · enregistrement #{shown.auditRecordId}
              </button>
            )}
          </CardShell>

          {t && (
            <CardShell className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1" style={DISPLAY}>Test statistique : agent − buy &amp; hold, par fenêtre</h3>
              <p className="text-[11px] text-muted-foreground mb-3">
                Test t apparié sur {t.windows} fenêtres. Peu d'observations = peu de puissance : une « non-significativité » ne prouve pas l'absence d'effet.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                {[
                  ["Écart moyen / fenêtre", `${pctSigned(t.meanExcess)} ${stars(t.pValue)}`],
                  ["IC bootstrap 95 %", `[${pctSigned(t.ciLow)} ; ${pctSigned(t.ciHigh)}]`],
                  ["p (test t)", fmtP(t.pValue)],
                  ["p (bootstrap)", fmtP(t.pBootstrap)],
                  ["p (test des signes)", fmtP(t.pSign)],
                  ["Fenêtres gagnées", `${(t.winRate * 100).toFixed(0)} %`],
                  ["d de Cohen", t.cohenD.toFixed(2)],
                  ...(learns ? [["Écart d'apprentissage", `${(shown.overfitGap * 100).toFixed(1)} pts`]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted/30 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
                    <p className="font-semibold text-foreground mt-0.5" style={MONO}>{v}</p>
                  </div>
                ))}
              </div>
              {learns && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Écart d'apprentissage = (avantage sur le buy &amp; hold pendant l'entraînement) − (avantage hors échantillon). Un écart positif élevé signale du sur-apprentissage.
                </p>
              )}
            </CardShell>
          )}

          <CardShell className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Détail des fenêtres</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-4 py-2.5">#</th>
                    <th className="text-left px-4 py-2.5">Test (jamais vu)</th>
                    <th className="text-right px-4 py-2.5">Agent</th>
                    <th className="text-right px-4 py-2.5">Buy &amp; hold</th>
                    <th className="text-right px-4 py-2.5">Écart</th>
                    {learns && <th className="text-right px-4 py-2.5">Écart en entraînement</th>}
                    <th className="text-right px-4 py-2.5">Perte max</th>
                    <th className="text-right px-4 py-2.5">Trades</th>
                    <th className="text-right px-4 py-2.5">Investi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {shown.windows.map((w) => (
                    <tr key={w.index} className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 text-muted-foreground" style={MONO}>{w.index}</td>
                      <td className="px-4 py-2.5" style={MONO}>{w.testFrom} → {w.testTo}</td>
                      <td className={`px-4 py-2.5 text-right ${w.agentReturn >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{pctSigned(w.agentReturn)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground" style={MONO}>{pctSigned(w.benchmarkReturn)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${w.excess >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{pctSigned(w.excess)}</td>
                      {learns && <td className="px-4 py-2.5 text-right text-muted-foreground" style={MONO}>{pctSigned(w.inSampleReturn - w.inSampleBenchmark)}</td>}
                      <td className="px-4 py-2.5 text-right text-muted-foreground" style={MONO}>{pctSigned(w.maxDrawdown, 0)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground" style={MONO}>{w.trades}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground" style={MONO}>{(w.exposure * 100).toFixed(0)} %</td>
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
