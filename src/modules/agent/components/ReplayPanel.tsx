import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from "recharts";
import { Bot, Flag, Gamepad2, Pause, Play, RotateCcw, User } from "lucide-react";
import { agentsApi, type AgentConfig, type PriceModel, type ReplayResult } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { actionStyle, inputClass, labelClass, modelLabel, pctPlain, pctSigned } from "../format";
import ConfidenceGauge from "./ConfidenceGauge";

const SPEEDS = [5, 10, 20, 40];
const EVENT_LABEL: Record<number, string> = { 1: "achète", 2: "vend", 3: "stop-loss", 4: "take-profit" };

interface HumanTrade { day: number; side: "BUY" | "SELL"; price: number }

/** Simule le portefeuille du joueur : achat = tout le capital, vente = tout, frais identiques a l'agent. */
function simulateHuman(replay: ReplayResult, trades: HumanTrade[], upTo: number) {
  let cash = replay.capital;
  let units = 0;
  let k = 0;
  const equity: number[] = [];
  for (let d = 0; d <= upTo; d++) {
    const price = replay.days[d].price;
    while (k < trades.length && trades[k].day === d) {
      const t = trades[k++];
      if (t.side === "BUY" && units === 0) {
        units = (cash * (1 - replay.costRate)) / price;
        cash = 0;
      } else if (t.side === "SELL" && units > 0) {
        cash = units * price * (1 - replay.costRate);
        units = 0;
      }
    }
    equity.push(cash + units * price);
  }
  return { equity, invested: units > 0 };
}

function maxDrawdown(values: number[]) {
  let peak = values[0] ?? 1;
  let worst = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, v / peak - 1);
  }
  return worst;
}

export default function ReplayPanel({ agent }: { agent: AgentConfig }) {
  const symbols = agent.allowedAssets.split(",").map((s) => s.trim()).filter(Boolean);
  const [config, setConfig] = useState({ symbol: symbols[0] ?? "AAPL", days: 252, model: "REGIME_SWITCHING" as PriceModel, crash: true, seed: null as number | null });
  const [replay, setReplay] = useState<ReplayResult | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [trades, setTrades] = useState<HumanTrade[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReplay(null);
    setPlaying(false);
    setConfig((c) => ({ ...c, symbol: symbols[0] ?? c.symbol }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  const start = async (seed: number | null = config.seed) => {
    setBusy(true);
    setError("");
    try {
      const r = await agentsApi.replay(agent.id!, { symbol: config.symbol, days: config.days, model: config.model, seed, crashPct: config.crash ? 20 : null });
      setReplay(r);
      setT(0);
      setTrades([]);
      setPlaying(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const finished = replay != null && t >= replay.horizonDays;

  // horloge du replay
  useEffect(() => {
    if (!playing || !replay) return;
    const id = setInterval(() => {
      setT((cur) => {
        if (cur >= replay.horizonDays) {
          setPlaying(false);
          return cur;
        }
        return cur + 1;
      });
    }, 1000 / speed);
    return () => clearInterval(id);
  }, [playing, speed, replay]);

  const human = useMemo(() => (replay ? simulateHuman(replay, trades, t) : null), [replay, trades, t]);

  const trade = useCallback((side: "BUY" | "SELL") => {
    if (!replay || finished || !human) return;
    if (side === "BUY" && human.invested) return;
    if (side === "SELL" && !human.invested) return;
    setTrades((cur) => [...cur.filter((x) => x.day !== t), { day: t, side, price: replay.days[t].price }]);
  }, [replay, finished, human, t]);

  // raccourcis clavier : B = acheter, S = vendre, espace = pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!replay || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "b" || e.key === "B") trade("BUY");
      else if (e.key === "s" || e.key === "S") trade("SELL");
      else if (e.key === " ") {
        e.preventDefault();
        if (!finished) setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replay, trade, finished]);

  const chartData = useMemo(() => {
    if (!replay || !human) return [];
    const rows: Record<string, number | null>[] = replay.context.map((p, i) => ({ day: i - replay.context.length, price: p }));
    for (let d = 0; d <= t; d++) {
      const day = replay.days[d];
      rows.push({
        day: d,
        price: day.price,
        agent: (day.agentEquity / replay.capital) * 100,
        bench: (day.benchmarkEquity / replay.capital) * 100,
        human: (human.equity[d] / replay.capital) * 100,
      });
    }
    return rows;
  }, [replay, human, t]);

  // marqueurs de transactions (series separees : seuls les vrais points sont dessines)
  const markers = useMemo(() => {
    if (!replay) return { agentBuy: [], agentSell: [], humanBuy: [], humanSell: [] };
    const upTo = replay.days.slice(0, t + 1);
    return {
      agentBuy: upTo.filter((d) => d.event === 1).map((d) => ({ day: d.day, price: d.price })),
      agentSell: upTo.filter((d) => d.event >= 2).map((d) => ({ day: d.day, price: d.price })),
      humanBuy: trades.filter((x) => x.side === "BUY" && x.day <= t).map((x) => ({ day: x.day, price: x.price })),
      humanSell: trades.filter((x) => x.side === "SELL" && x.day <= t).map((x) => ({ day: x.day, price: x.price })),
    };
  }, [replay, trades, t]);

  if (!replay) {
    return (
      <CardShell className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <Gamepad2 className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-semibold text-foreground" style={DISPLAY}>Replay : vous contre l'agent</h3>
        </div>
        <p className="text-[12px] text-muted-foreground mb-5 max-w-2xl">
          Un marché simulé défile en accéléré. Vous tradez à la main (bouton ou touche <b>B</b> pour acheter, <b>S</b> pour vendre,
          <b> espace</b> pour pause) pendant que l'agent trade tout seul sur les mêmes prix. À la fin : qui a battu le buy &amp; hold ?
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className={labelClass}>Actif</label>
            <select value={config.symbol} onChange={(e) => setConfig({ ...config, symbol: e.target.value })} className={inputClass}>
              {symbols.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Durée</label>
            <select value={config.days} onChange={(e) => setConfig({ ...config, days: Number(e.target.value) })} className={inputClass}>
              <option value={126}>6 mois</option>
              <option value={252}>1 an</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Marché</label>
            <select value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value as PriceModel })} className={inputClass}>
              {(Object.keys(modelLabel) as PriceModel[]).map((m) => <option key={m} value={m}>{modelLabel[m]}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground pb-2">
            <input type="checkbox" checked={config.crash} onChange={(e) => setConfig({ ...config, crash: e.target.checked })} className="accent-red-500" />
            Krach surprise (−20 %)
          </label>
          <button onClick={() => start()} disabled={busy} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">
            <Play className="w-4 h-4" />{busy ? "Préparation..." : "Commencer"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </CardShell>
    );
  }

  const today = replay.days[t];
  const humanReturn = human!.equity[t] / replay.capital - 1;
  const agentReturn = today.agentEquity / replay.capital - 1;
  const benchReturn = today.benchmarkEquity / replay.capital - 1;
  const crashVisible = replay.crashDay != null && t >= replay.crashDay;
  const lastAgentEvent = [...replay.days.slice(0, t + 1)].reverse().find((d) => d.event > 0);

  const scoreboard = [
    { name: "Vous", Icon: User, ret: humanReturn, color: "text-amber-600", dd: maxDrawdown(human!.equity), trades: trades.length },
    { name: agent.name, Icon: Bot, ret: agentReturn, color: "text-blue-600", dd: maxDrawdown(replay.days.slice(0, t + 1).map((d) => d.agentEquity)), trades: replay.days.slice(0, t + 1).filter((d) => d.event > 0).length },
    { name: "Buy & Hold", Icon: Flag, ret: benchReturn, color: "text-slate-500", dd: maxDrawdown(replay.days.slice(0, t + 1).map((d) => d.benchmarkEquity)), trades: 1 },
  ].sort((x, y) => y.ret - x.ret);

  return (
    <div className="space-y-4">
      {/* Barre de controle */}
      <CardShell className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setPlaying(!playing)} disabled={finished}
            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center">
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="flex gap-1 bg-muted/40 rounded-lg p-0.5">
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${speed === s ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {s} j/s
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Jour {t} / {replay.horizonDays}</span>
              <span style={MONO}>{replay.symbol} {today.price.toLocaleString("en-US")}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full"><div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${(t / replay.horizonDays) * 100}%` }} /></div>
          </div>
          <button onClick={() => trade("BUY")} disabled={finished || human!.invested}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-35">ACHETER (B)</button>
          <button onClick={() => trade("SELL")} disabled={finished || !human!.invested}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-35">VENDRE (S)</button>
          <button onClick={() => { setReplay(null); setPlaying(false); }} title="Nouvelle partie" className="p-2 rounded-lg text-muted-foreground hover:bg-muted/50">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </CardShell>

      <div className="grid grid-cols-1 2xl:grid-cols-4 gap-4">
        {/* Graphiques */}
        <CardShell className="2xl:col-span-3 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2" style={DISPLAY}>Prix &amp; transactions</h3>
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" type="number" domain={[-replay.context.length, replay.horizonDays]} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "11px" }} labelFormatter={(d) => `Jour ${d}`} />
              <ReferenceLine x={0} stroke="#CBD5E1" label={{ value: "Début", position: "insideTopLeft", fontSize: 10, fill: "#94A3B8" }} />
              {crashVisible && <ReferenceLine x={replay.crashDay!} stroke="#DC2626" strokeDasharray="4 3" label={{ value: "Krach !", position: "insideTopRight", fontSize: 10, fill: "#DC2626" }} />}
              <Line dataKey="price" name="Prix" stroke="#0F172A" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Scatter data={markers.agentBuy} dataKey="price" name="Agent achète" fill="#2563EB" shape="triangle" isAnimationActive={false} />
              <Scatter data={markers.agentSell} dataKey="price" name="Agent vend" fill="#93C5FD" shape="diamond" isAnimationActive={false} />
              <Scatter data={markers.humanBuy} dataKey="price" name="Vous achetez" fill="#059669" shape="triangle" isAnimationActive={false} />
              <Scatter data={markers.humanSell} dataKey="price" name="Vous vendez" fill="#DC2626" shape="diamond" isAnimationActive={false} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2" style={DISPLAY}>Portefeuilles (base 100)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" type="number" domain={[-replay.context.length, replay.horizonDays]} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "11px" }}
                formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) : String(v))} labelFormatter={(d) => `Jour ${d}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={100} stroke="#E2E8F0" />
              {crashVisible && <ReferenceLine x={replay.crashDay!} stroke="#DC2626" strokeDasharray="4 3" />}
              <Line dataKey="human" name="Vous" stroke="#D97706" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="agent" name={agent.name} stroke="#2563EB" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="bench" name="Buy & Hold" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardShell>

        {/* Agent en direct + score */}
        <div className="space-y-4">
          <CardShell className="p-4 flex flex-col items-center">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide self-start">L'agent en direct</p>
            <ConfidenceGauge value={today.confidence} action={today.action} label={`Pense ${today.action}`} size={170} />
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${actionStyle[today.action]}`}>{today.action}</span>
              <span className="text-[11px] text-muted-foreground">{today.agentPosition ? "Investi" : "À plat"}</span>
            </div>
            {lastAgentEvent && (
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                Dernière action : <b className="text-foreground">{EVENT_LABEL[lastAgentEvent.event]}</b> au jour {lastAgentEvent.day} à <span style={MONO}>{lastAgentEvent.price.toLocaleString("en-US")}</span>
              </p>
            )}
          </CardShell>

          <CardShell className="p-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{finished ? "Résultat final" : "Classement en direct"}</p>
            <div className="space-y-2">
              {scoreboard.map((s, i) => (
                <div key={s.name} className={`flex items-center gap-2 rounded-lg p-2 ${i === 0 ? "bg-amber-50 border border-amber-100" : "bg-muted/20"}`}>
                  <span className="text-sm w-5">{["🥇", "🥈", "🥉"][i]}</span>
                  <s.Icon className={`w-3.5 h-3.5 ${s.color}`} />
                  <span className="text-[12px] font-medium text-foreground flex-1 truncate">{s.name}</span>
                  <div className="text-right">
                    <p className={`text-[12px] font-semibold ${s.ret >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{pctSigned(s.ret)}</p>
                    <p className="text-[9px] text-muted-foreground">DD {pctPlain(s.dd, 0)} · {s.trades} ordres</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Vous : {human!.invested ? "investi (100 %)" : "à plat"} · L'agent investit {Math.round(replay.positionFraction * 100)} % de son capital · frais {replay.costRate * 100} %
            </p>
          </CardShell>
        </div>
      </div>

      {finished && (
        <div className="rounded-xl p-5 text-white" style={{ background: "linear-gradient(135deg, #1D4ED8, #0F2E7A)" }}>
          <p className="text-sm font-semibold mb-1">{scoreboard[0].name === "Vous" ? "🎉 Vous avez battu l'agent !" : scoreboard[0].name === "Buy & Hold" ? "Le buy & hold gagne cette fois" : `🤖 ${agent.name} gagne la partie`}</p>
          <p className="text-[13px] text-blue-100">
            Vous {pctSigned(humanReturn)} · {agent.name} {pctSigned(agentReturn)} · Buy &amp; Hold {pctSigned(benchReturn)}.
            {" "}Une seule partie peut être due à la chance : pour une conclusion fiable, comparez les agents dans l'onglet Tournoi (tests statistiques sur des milliers de marchés).
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => start(replay.seed)} className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-xs font-medium">Rejouer le même marché (seed {replay.seed})</button>
            <button onClick={() => start(null)} className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-xs font-medium">Nouveau marché</button>
          </div>
        </div>
      )}
    </div>
  );
}
