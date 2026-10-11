import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertOctagon, ArrowDownRight, ArrowUpRight, CircleStop, FastForward, Pause, Play, Power, ShieldAlert, ShieldCheck,
  Target, TrendingDown, TrendingUp, Zap,
} from "lucide-react";
import {
  autopilotApi, type AgentConfig, type AutopilotEvent, type AutopilotEventType, type AutopilotStart, type AutopilotView,
} from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { labelClass, pctPlain, pctSigned } from "../format";

const EVENT_STYLE: Record<AutopilotEventType, { label: string; tone: string; Icon: typeof Play }> = {
  STARTED: { label: "Démarrage", tone: "text-blue-600 bg-blue-50", Icon: Power },
  BUY: { label: "Achat", tone: "text-emerald-700 bg-emerald-50", Icon: ArrowUpRight },
  SELL: { label: "Vente", tone: "text-red-700 bg-red-50", Icon: ArrowDownRight },
  STOP_LOSS: { label: "Stop-loss", tone: "text-red-700 bg-red-50", Icon: TrendingDown },
  TAKE_PROFIT: { label: "Objectif", tone: "text-emerald-700 bg-emerald-50", Icon: Target },
  PAUSED: { label: "Pause", tone: "text-amber-700 bg-amber-50", Icon: Pause },
  RESUMED: { label: "Reprise", tone: "text-blue-600 bg-blue-50", Icon: Play },
  STOPPED: { label: "Arrêt", tone: "text-slate-600 bg-slate-100", Icon: CircleStop },
  LOSS_LIMIT: { label: "Perte max", tone: "text-white bg-red-500", Icon: AlertOctagon },
  ORDER_LIMIT: { label: "Limite d'ordres", tone: "text-amber-700 bg-amber-50", Icon: ShieldAlert },
  ANOMALY_WARNING: { label: "Anomalie", tone: "text-amber-700 bg-amber-50", Icon: ShieldAlert },
  KILL_SWITCH: { label: "Coupe-circuit", tone: "text-white bg-red-600", Icon: Zap },
  ERROR: { label: "Erreur", tone: "text-white bg-red-500", Icon: AlertOctagon },
};

const INTERVALS = [
  { value: 2, label: "2 s (démo rapide)" },
  { value: 5, label: "5 s" },
  { value: 10, label: "10 s" },
  { value: 30, label: "30 s" },
  { value: 60, label: "1 min" },
];

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 28 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="w-24 h-7" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={up ? "#10B981" : "#EF4444"} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${tone ?? "text-foreground"}`} style={MONO}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Pilote automatique : l'agent trade seul sur un marche simule, avec garde-fous et coupe-circuit. */
export default function AutopilotPanel({ agent }: { agent: AgentConfig }) {
  const [view, setView] = useState<AutopilotView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<AutopilotStart>({ intervalSeconds: 5, maxOrdersPerDay: 20, maxLossPct: 10, killSwitch: true, capital: 10000 });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = () => autopilotApi.get(agent.id!).then(setView).catch((e) => setError(errorMessage(e))).finally(() => setLoaded(true));

  useEffect(() => {
    setView(null);
    setLoaded(false);
    setError("");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  // rafraichissement en direct pendant que le pilote tourne
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (view?.status === "RUNNING") {
      timer.current = setInterval(refresh, Math.max(1500, Math.min(5000, view.intervalSeconds * 1000)));
    }
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.status, view?.intervalSeconds, agent.id]);

  const act = async (fn: () => Promise<AutopilotView>) => {
    setBusy(true);
    setError("");
    try {
      setView(await fn());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const running = view?.status === "RUNNING";
  const live = view && view.status !== "STOPPED";
  const curve = view ? view.equityCurve.map((v, i) => ({ day: i, agent: v, bench: view.benchmarkCurve[i] })) : [];
  const lossUsed = view ? Math.max(0, -view.returnPct * 100) / view.maxLossPct : 0;

  const startForm = (
    <CardShell className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <Power className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Pilote automatique</h3>
      </div>
      <p className="text-[12px] text-muted-foreground mb-4 max-w-3xl">
        {agent.name} trade seul, sans intervention, sur un marché simulé en continu (un jour de bourse à chaque intervalle),
        avec un portefeuille papier. Trois garde-fous le surveillent : une perte maximale, un nombre d'ordres par jour et un
        coupe-circuit qui l'arrête si son comportement devient inhabituel.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className={labelClass}>Rythme</label>
          <select value={config.intervalSeconds} onChange={(e) => setConfig({ ...config, intervalSeconds: Number(e.target.value) })}
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none">
            {INTERVALS.map((i) => <option key={i.value} value={i.value}>1 jour / {i.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Capital ($)</label>
          <input type="number" min={1000} step={1000} value={config.capital} onChange={(e) => setConfig({ ...config, capital: Number(e.target.value) })}
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
        </div>
        <div>
          <div className="flex justify-between"><label className={labelClass}>Perte maximale</label><span className="text-xs font-semibold text-red-500" style={MONO}>−{config.maxLossPct} %</span></div>
          <input type="range" min={3} max={30} value={config.maxLossPct} onChange={(e) => setConfig({ ...config, maxLossPct: Number(e.target.value) })} className="w-full accent-red-500" />
        </div>
        <div>
          <div className="flex justify-between"><label className={labelClass}>Ordres / jour</label><span className="text-xs font-semibold" style={MONO}>{config.maxOrdersPerDay}</span></div>
          <input type="range" min={1} max={50} value={config.maxOrdersPerDay} onChange={(e) => setConfig({ ...config, maxOrdersPerDay: Number(e.target.value) })} className="w-full accent-blue-600" />
        </div>
        <label className="flex items-start gap-2 text-[12px] text-foreground cursor-pointer pt-5">
          <input type="checkbox" checked={config.killSwitch} onChange={(e) => setConfig({ ...config, killSwitch: e.target.checked })} className="accent-blue-600 mt-0.5" />
          <span><b>Coupe-circuit</b><br /><span className="text-muted-foreground text-[11px]">arrêt si comportement inhabituel</span></span>
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      <button onClick={() => act(() => autopilotApi.start(agent.id!, config))} disabled={busy}
        className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-5 py-2.5">
        <Play className="w-4 h-4" />{busy ? "Démarrage…" : view ? "Démarrer une nouvelle session" : "Démarrer le pilote automatique"}
      </button>
    </CardShell>
  );

  if (!loaded) return <CardShell className="p-6 text-sm text-muted-foreground">Chargement…</CardShell>;
  if (!view) return startForm;

  return (
    <div className="space-y-4">
      {/* Bandeau d'etat */}
      {view.status === "STOPPED" && view.stopReason && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${/Coupe-circuit|Perte maximale|erreur/i.test(view.stopReason) ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
          {/Coupe-circuit/.test(view.stopReason) ? <Zap className="w-5 h-5 text-red-600 shrink-0" /> : <CircleStop className="w-5 h-5 text-slate-500 shrink-0" />}
          <div>
            <p className="text-sm font-semibold text-foreground">Pilote arrêté</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{view.stopReason}</p>
          </div>
        </div>
      )}

      <CardShell className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {running ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />EN DIRECT
              </span>
            ) : view.status === "PAUSED" ? (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">EN PAUSE</span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">ARRÊTÉ</span>
            )}
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Pilote automatique · {agent.name}</h3>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Jour {view.step} · 1 jour / {view.intervalSeconds} s · démarré {new Date(view.startedAt).toLocaleTimeString("fr-FR")}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {live && (running ? (
              <button onClick={() => act(() => autopilotApi.pause(agent.id!))} disabled={busy} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40">
                <Pause className="w-3.5 h-3.5" />Pause
              </button>
            ) : (
              <button onClick={() => act(() => autopilotApi.resume(agent.id!))} disabled={busy} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40">
                <Play className="w-3.5 h-3.5" />Reprendre
              </button>
            ))}
            {live && (
              <button onClick={() => act(() => autopilotApi.step(agent.id!))} disabled={busy} title="Simuler un jour de bourse immédiatement"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40">
                <FastForward className="w-3.5 h-3.5" />+1 jour
              </button>
            )}
            {live && (
              <button onClick={() => { if (confirm("Arrêter le pilote et liquider toutes les positions ?")) act(() => autopilotApi.stop(agent.id!)); }} disabled={busy}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white">
                <CircleStop className="w-3.5 h-3.5" />Arrêter
              </button>
            )}
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        {/* Indicateurs */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-4">
          <Kpi label="Portefeuille" value={`${Math.round(view.equity).toLocaleString("fr-FR")} $`} sub={`capital ${view.capital.toLocaleString("fr-FR")} $`} />
          <Kpi label="Rendement" value={pctSigned(view.returnPct)} tone={view.returnPct >= 0 ? "text-emerald-600" : "text-red-500"} sub={`buy & hold ${pctSigned(view.benchmarkReturnPct)}`} />
          <Kpi label="Drawdown max" value={pctPlain(-view.maxDrawdown)} sub="depuis le plus haut" />
          <Kpi label="Trades clôturés" value={String(view.trades)} sub={`${pctPlain(view.winRate, 0)} gagnants`} />
          <Kpi label="Ordres aujourd'hui" value={`${view.ordersToday} / ${view.maxOrdersPerDay}`} sub="limite journalière" />
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Coupe-circuit</p>
            {view.killSwitch ? (
              <p className={`text-sm font-semibold mt-1 flex items-center gap-1 ${view.consecutiveAlerts > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {view.consecutiveAlerts > 0 ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                {view.consecutiveAlerts > 0 ? "1 alerte" : "Armé"}
              </p>
            ) : <p className="text-sm font-semibold mt-1 text-muted-foreground">Désactivé</p>}
            <p className="text-[10px] text-muted-foreground">surveillance toutes les 8 décisions</p>
          </div>
        </div>

        {/* Jauge de perte maximale */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Perte utilisée sur la limite de −{view.maxLossPct} %</span>
            <span style={MONO}>{Math.round(Math.min(1, lossUsed) * 100)} %</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full">
            <div className={`h-1.5 rounded-full ${lossUsed > 0.7 ? "bg-red-500" : lossUsed > 0.4 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(1, lossUsed) * 100}%` }} />
          </div>
        </div>
      </CardShell>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4">
        {/* Courbe */}
        <CardShell className="p-5 2xl:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-2" style={DISPLAY}>Valeur du portefeuille (base 100)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={curve} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "11px" }}
                formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v))} labelFormatter={(d) => `Jour ${d}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={100} stroke="#E2E8F0" />
              <ReferenceLine y={100 - view.maxLossPct} stroke="#EF4444" strokeDasharray="4 3"
                label={{ value: `Perte max −${view.maxLossPct} %`, position: "insideBottomRight", fontSize: 10, fill: "#EF4444" }} />
              <Line dataKey="agent" name={agent.name} stroke="#2563EB" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="bench" name="Buy & Hold" stroke="#94A3B8" strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardShell>

        {/* Positions */}
        <CardShell className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3" style={DISPLAY}>Marché & positions</h3>
          <div className="space-y-3">
            {view.positions.map((p) => {
              const series = p.recentPrices;
              const up = series[series.length - 1] >= series[0];
              return (
                <div key={p.symbol} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{p.symbol}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${p.bear ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {p.bear ? <TrendingDown className="w-3 h-3 inline" /> : <TrendingUp className="w-3 h-3 inline" />} {p.bear ? "baissier" : "haussier"}
                    </span>
                    <span className="ml-auto text-[12px] text-foreground" style={MONO}>{p.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <Sparkline values={series} up={up} />
                    {p.units > 0 ? (
                      <div className="text-right text-[11px]">
                        <p className={`font-semibold ${p.pnlPct >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{pctSigned(p.pnlPct)}</p>
                        <p className="text-muted-foreground" style={MONO}>{Math.round(p.value).toLocaleString("fr-FR")} $</p>
                      </div>
                    ) : <span className="text-[11px] text-muted-foreground">à plat</span>}
                  </div>
                  {p.units > 0 && p.stopLoss != null && (
                    <p className="text-[10px] text-muted-foreground mt-1" style={MONO}>
                      entrée {p.entryPrice.toFixed(2)} · <span className="text-red-500">SL {p.stopLoss.toFixed(2)}</span> · <span className="text-emerald-600">TP {p.takeProfit!.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardShell>
      </div>

      {/* Journal */}
      <CardShell className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Journal du pilote</h3>
          <span className="text-[11px] text-muted-foreground">chaque ordre est expliqué (XAI) et enregistré</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/40">
          {view.events.map((e: AutopilotEvent) => {
            const st = EVENT_STYLE[e.type];
            return (
              <div key={e.id} className="flex items-start gap-3 px-5 py-2.5">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${st.tone}`}>
                  <st.Icon className="w-3 h-3" />{st.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground leading-snug">{e.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5" style={MONO}>
                    jour {e.step}{e.symbol ? ` · ${e.symbol}` : ""}{e.price != null ? ` @ ${e.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : ""}
                    {e.equity != null ? ` · portefeuille ${e.equity.toFixed(1)}` : ""} · {new Date(e.at).toLocaleTimeString("fr-FR")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardShell>

      {view.status === "STOPPED" && startForm}
    </div>
  );
}
