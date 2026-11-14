import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Ban, Bot, Pencil, X } from "lucide-react";
import { fmt, MONO, DISPLAY, CardShell } from "../../shared/ui";
import {
  assetsApi, ordersApi, portfolioApi, riskApi,
  type Asset, type EquityPoint, type OrderSide, type OrderType, type Portfolio, type PortfolioRisk, type RiskAssessment,
  type TradeOrder, type UpdateOrderRequest,
} from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import {
  buildOrderRequest, buildRiskRequest, distancePct, filterHistory, formatDistance, historyReason, riskStyle, signed, splitOrders,
  type HistoryFilter, type OrderForm,
} from "./tradingLogic";
import { CloseConfirmDialog, EditProtectionDialog } from "./components/TradeDialogs";
import { EquityCurve, OrderPreview, PositionsBySymbol } from "./components/PortfolioPanels";

const inputClass = "w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400";
const labelClass = "text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1";
const thClass = "text-right px-4 py-3";
const tdNum = "px-4 py-3.5 text-right text-sm";

type Tab = "open" | "pending" | "history";

/** Message lisible : 400 de validation (detail par champ), 400 d'ordre refuse, 409 de transition interdite... */
function apiError(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data?.errors) {
    const details = Object.entries(e.response.data.errors as Record<string, string>).map(([k, v]) => `${k} : ${v}`).join(" ; ");
    return `${e.response.data.message ?? "Données invalides"} (${details})`;
  }
  return errorMessage(e);
}

const num = (v: number | null | undefined) => (v == null ? "—" : fmt(Number(v)));
const pnlClass = (v: number) => (v >= 0 ? "text-emerald-600" : "text-red-500");

/** Module 2 : passage d'ordres, positions, ordres en attente, historique, portefeuille et risque. */
export default function TradingPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [pRisk, setPRisk] = useState<PortfolioRisk | null>(null);
  const [form, setForm] = useState<OrderForm>({ symbol: "", side: "BUY", orderType: "MARKET", quantity: "10", limitPrice: "", stopLoss: "", takeProfit: "" });
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [riskError, setRiskError] = useState("");
  const [riskLoading, setRiskLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("open");
  const [history, setHistory] = useState<EquityPoint[]>([]);
  const [editing, setEditing] = useState<TradeOrder | null>(null);
  const [closing, setClosing] = useState<TradeOrder | null>(null);
  const [openView, setOpenView] = useState<"tickets" | "symbols">("tickets");
  const [filter, setFilter] = useState<HistoryFilter>({ status: "", symbol: "", from: "", to: "" });

  const set = <K extends keyof OrderForm>(key: K, value: OrderForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const refresh = useCallback(async () => {
    try {
      // GET /orders et /portfolio declenchent aussi un balayage SL/TP/LIMIT cote serveur
      const [o, p, r, h] = await Promise.all([ordersApi.list(), portfolioApi.get(), riskApi.portfolio(), portfolioApi.history()]);
      setOrders(o);
      setPortfolio(p);
      setPRisk(r);
      setHistory(h);
    } catch (e) {
      setError(apiError(e));
    }
  }, []);

  useEffect(() => {
    assetsApi.list().then((list) => {
      setAssets(list);
      if (list.length) setForm((f) => ({ ...f, symbol: f.symbol || list[0].symbol }));
    }).catch((e) => setError(apiError(e)));
    refresh();
    const timer = setInterval(refresh, 5000);   // affiche les stop-loss / take-profit declenches par le moteur
    return () => clearInterval(timer);
  }, [refresh]);

  // Jauge de risque : simulation a blanc avec debounce de 400 ms
  const riskRequest = useMemo(() => buildRiskRequest(form), [form]);
  const riskKey = JSON.stringify(riskRequest);
  useEffect(() => {
    if (!riskRequest) { setRisk(null); setRiskError(""); return; }
    let cancelled = false;
    setRiskLoading(true);
    const t = setTimeout(() => {
      riskApi.assess(riskRequest)
        .then((r) => { if (!cancelled) { setRisk(r); setRiskError(""); } })
        .catch((e) => { if (!cancelled) { setRisk(null); setRiskError(apiError(e)); } })
        .finally(() => { if (!cancelled) setRiskLoading(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskKey, portfolio?.equity]);

  const asset = assets.find((a) => a.symbol === form.symbol);
  const blocked = risk?.level === "BLOCKED";
  const style = riskStyle(risk?.level);
  const failed = risk?.checks.filter((c) => !c.passed) ?? [];

  const placeOrder = async () => {
    setError(""); setNotice("");
    const { request, error: formError } = buildOrderRequest(form);
    if (!request) { setError(formError ?? "Formulaire invalide"); return; }
    setBusy(true);
    try {
      const o = await ordersApi.create(request);
      setNotice(o.status === "PENDING"
        ? `Ordre ${o.orderType} #${o.id} en attente à ${fmt(Number(o.limitPrice))}`
        : `Ordre #${o.id} exécuté à ${fmt(Number(o.executedPrice))} (frais ${fmt(Number(o.fees ?? 0))})`);
      setForm((f) => ({ ...f, stopLoss: "", takeProfit: "", limitPrice: "" }));
      setTab(o.status === "PENDING" ? "pending" : "open");
    } catch (e) {
      setError(apiError(e));          // 400 : refus (solde, risque), saisie invalide
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const act = async (fn: () => Promise<TradeOrder>, label: string) => {
    setError(""); setNotice("");
    try {
      const o = await fn();
      setNotice(o.status === "CLOSED"
        ? `${label} #${o.id} : P&L réalisé ${signed(Number(o.realizedPnl ?? 0), fmt)}, frais ${fmt(Number(o.fees ?? 0))}`
        : `${label} #${o.id}`);
    } catch (e) {
      setError(apiError(e));          // 409 : deja cloture / annule ailleurs
    } finally {
      refresh();
    }
  };

  /** PUT partiel ; renvoie le message d'erreur (affiche dans la boite de dialogue) ou null. */
  const saveProtection = async (id: number, req: UpdateOrderRequest): Promise<string | null> => {
    try {
      await ordersApi.update(id, req);
      setNotice(`Protections de l'ordre #${id} mises à jour`);
      refresh();
      return null;
    } catch (e) {
      return apiError(e);
    }
  };

  const priceOf = (symbol: string) => {
    const a = assets.find((x) => x.symbol === symbol);
    return a ? Number(a.price) : null;
  };

  const { open, pending, history: done } = splitOrders(orders);
  const filteredHistory = filterHistory(done, filter);
  const historySymbols = Array.from(new Set(done.map((o) => o.symbol))).sort();
  const stats = [
    { label: "Equity", value: portfolio ? fmt(portfolio.equity) : "—", sub: portfolio ? `${portfolio.totalReturnPct >= 0 ? "+" : ""}${portfolio.totalReturnPct}% depuis le départ` : "", positive: (portfolio?.totalReturnPct ?? 0) >= 0 },
    { label: "Solde disponible", value: portfolio ? fmt(portfolio.cash) : "—", sub: portfolio ? `${portfolio.openPositions} position(s), ${portfolio.pendingOrders} en attente` : "", positive: true },
    { label: "Exposition brute", value: portfolio ? fmt(portfolio.grossExposure) : "—", sub: pRisk ? `${pRisk.grossExposurePct}% de l'equity · nette ${fmt(portfolio?.netExposure ?? 0)}` : "", positive: true },
    { label: "P&L latent", value: portfolio ? signed(portfolio.unrealizedPnl, fmt) : "—", sub: "Positions ouvertes", positive: (portfolio?.unrealizedPnl ?? 0) >= 0 },
    { label: "P&L réalisé", value: portfolio ? signed(portfolio.realizedPnl, fmt) : "—", sub: portfolio ? `Frais payés ${fmt(portfolio.totalFees)}` : "", positive: (portfolio?.realizedPnl ?? 0) >= 0 },
    { label: "VaR 95 % (1 jour)", value: pRisk ? fmt(pRisk.var95) : "—", sub: pRisk ? `CVaR ${fmt(pRisk.cvar95)} · ${pRisk.varMethod === "HISTORICAL" ? "historique" : pRisk.varMethod === "PARAMETRIC" ? "paramétrique" : "aucune position"}` : "", positive: true },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Formulaire d'ordre */}
        <CardShell className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4" style={DISPLAY}>Passer un ordre</h3>
          <div className="flex rounded-lg overflow-hidden border border-border mb-4">
            {(["BUY", "SELL"] as OrderSide[]).map((s) => (
              <button key={s} onClick={() => set("side", s)}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${form.side === s ? (s === "BUY" ? "bg-emerald-500 text-white" : "bg-red-500 text-white") : "text-muted-foreground hover:bg-muted/50"}`}>
                {s === "BUY" ? "BUY · LONG" : "SELL · SHORT"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Actif</label>
              <select value={form.symbol} onChange={(e) => set("symbol", e.target.value)} className={inputClass}>
                {assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Type</label>
                <select value={form.orderType} onChange={(e) => set("orderType", e.target.value as OrderType)} className={inputClass}>
                  <option value="MARKET">Marché</option>
                  <option value="LIMIT">Limite</option>
                  <option value="STOP">Stop</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Quantité</label>
                <input type="number" min="0" step="any" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className={inputClass} />
              </div>
            </div>
            {form.orderType !== "MARKET" && (
              <div>
                <label className={labelClass}>Prix limite / déclencheur</label>
                <input type="number" min="0" step="any" value={form.limitPrice} onChange={(e) => set("limitPrice", e.target.value)} className={inputClass}
                  placeholder={asset ? `Cours actuel ${Number(asset.price)}` : ""} />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {form.orderType === "LIMIT"
                    ? (form.side === "BUY" ? "Exécuté si le prix descend au niveau ou en dessous." : "Exécuté si le prix monte au niveau ou au-dessus.")
                    : (form.side === "BUY" ? "Déclenché si le prix monte au niveau ou au-dessus." : "Déclenché si le prix descend au niveau ou en dessous.")}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Stop-Loss</label>
                <input type="number" step="any" value={form.stopLoss} onChange={(e) => set("stopLoss", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Take-Profit</label>
                <input type="number" step="any" value={form.takeProfit} onChange={(e) => set("takeProfit", e.target.value)} className={inputClass} />
              </div>
            </div>

            {/* Jauge de risque reelle (POST /risk/assess) */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>Évaluation du risque {riskLoading && "…"}</span>
                <span className={`font-medium ${style.text}`}>{risk ? `${style.label} (${risk.score} / 100)` : "—"}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full">
                <div className={`h-1.5 rounded-full transition-all ${style.bar}`} style={{ width: `${risk ? Math.max(3, risk.score) : 0}%` }} />
              </div>
              {risk && <OrderPreview risk={risk} />}
              {failed.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {failed.map((c) => (
                    <li key={c.name} className={`text-[11px] ${c.blocking ? "text-red-600" : "text-amber-600"}`}>
                      {c.blocking ? "⛔" : "⚠"} {c.message}
                    </li>
                  ))}
                </ul>
              )}
              {riskError && <p className="text-[11px] text-red-600 mt-1">{riskError}</p>}
            </div>
          </div>
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
          {notice && <p className="text-xs text-emerald-600 mt-3">{notice}</p>}
          <button onClick={placeOrder} disabled={!form.symbol || busy || blocked}
            className={`w-full mt-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${form.side === "BUY" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}>
            {blocked ? "Ordre bloqué par le contrôle de risque"
              : `${form.side} ${form.symbol} ${form.orderType === "MARKET" ? `@ ${asset ? fmt(Number(asset.price)) : "marché"}` : form.orderType}`}
          </button>
          <p className="text-[10px] text-muted-foreground mt-2">Prix fixé par le serveur au moment de l'exécution · frais 0,1 % à l'ouverture et à la clôture.</p>
        </CardShell>

        {/* Statistiques du portefeuille */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4 content-start">
          {stats.map(({ label, value, sub, positive }) => (
            <CardShell key={label} className="p-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
              <p className="text-xl font-semibold text-foreground" style={MONO}>{value}</p>
              <p className={`text-[11px] mt-1 ${positive ? "text-emerald-600" : "text-red-500"}`}>{sub}</p>
            </CardShell>
          ))}
          {pRisk && pRisk.positions > 0 && (
            <CardShell className="p-4 col-span-2 md:col-span-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">Risque du portefeuille</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm" style={MONO}>
                <div><span className="text-muted-foreground text-[11px] block">VaR 99 %</span>{fmt(pRisk.var99)}</div>
                <div><span className="text-muted-foreground text-[11px] block">Concentration (HHI)</span>{pRisk.hhi}</div>
                <div><span className="text-muted-foreground text-[11px] block">Diversification</span>{pRisk.diversificationScore} / 100</div>
                <div><span className="text-muted-foreground text-[11px] block">Drawdown max</span>{pRisk.maxDrawdownPct != null ? `${pRisk.maxDrawdownPct}%` : "—"}</div>
              </div>
            </CardShell>
          )}
          <EquityCurve history={history} portfolio={portfolio} />
        </div>
      </div>

      {/* Onglets : positions / en attente / historique */}
      <CardShell className="overflow-hidden">
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-border/60">
          {([["open", `Positions ouvertes (${open.length})`], ["pending", `Ordres en attente (${pending.length})`], ["history", `Historique (${done.length})`]] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${tab === key ? "border-blue-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              style={DISPLAY}>
              {label}
            </button>
          ))}
          {tab === "open" && (
            <div className="ml-auto mb-2 flex rounded-md border border-border overflow-hidden text-[11px]">
              {([["tickets", "Par ticket"], ["symbols", "Par actif"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setOpenView(v)}
                  className={`px-2.5 py-1 font-semibold ${openView === v ? "bg-blue-500 text-white" : "text-muted-foreground hover:bg-muted/50"}`}>{l}</button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          {tab === "open" && openView === "symbols" && <PositionsBySymbol portfolio={portfolio} />}
          {tab === "open" && openView === "tickets" && (
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-3">Actif</th><th className="text-center px-4 py-3">Sens</th>
                  <th className={thClass}>Qté</th><th className={thClass}>Entrée</th><th className={thClass}>Actuel</th>
                  <th className={thClass}>P&amp;L latent</th><th className={thClass}>Stop-Loss</th><th className={thClass}>Take-Profit</th><th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {open.length === 0 && <EmptyRow cols={9} text="Aucune position. Passez votre premier ordre !" />}
                {open.map((o) => {
                  const pnl = Number(o.unrealizedPnl ?? 0);
                  return (
                    <tr key={o.id} className="hover:bg-muted/10 transition-colors">
                      <SymbolCell o={o} />
                      <td className="px-4 py-3.5 text-center"><SideBadge o={o} /></td>
                      <td className={`${tdNum} text-foreground`} style={MONO}>{Number(o.quantity)}</td>
                      <td className={`${tdNum} text-muted-foreground`} style={MONO}>{num(o.executedPrice ?? o.price)}</td>
                      <td className={`${tdNum} text-foreground`} style={MONO}>{num(o.currentPrice)}</td>
                      <td className={`${tdNum} font-medium ${pnlClass(pnl)}`} style={MONO}>{signed(pnl, fmt)}</td>
                      <LevelCell value={o.stopLoss} price={o.currentPrice} tone="text-red-500" />
                      <LevelCell value={o.takeProfit} price={o.currentPrice} tone="text-emerald-600" />
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <EditButton onClick={() => setEditing(o)} />
                        <button onClick={() => setClosing(o)} title="Clôturer au prix du marché"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border text-foreground hover:bg-muted/50">
                          <X className="w-3 h-3" /> Clôturer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === "pending" && (
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-3">Actif</th><th className="text-center px-4 py-3">Sens</th><th className="text-center px-4 py-3">Type</th>
                  <th className={thClass}>Qté</th><th className={thClass}>Niveau / écart</th><th className={thClass}>Stop-Loss</th><th className={thClass}>Take-Profit</th><th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pending.length === 0 && <EmptyRow cols={8} text="Aucun ordre LIMIT / STOP en attente." />}
                {pending.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/10 transition-colors">
                    <SymbolCell o={o} />
                    <td className="px-4 py-3.5 text-center"><SideBadge o={o} /></td>
                    <td className="px-4 py-3.5 text-center text-[11px] font-semibold text-muted-foreground">{o.orderType}</td>
                    <td className={`${tdNum} text-foreground`} style={MONO}>{Number(o.quantity)}</td>
                    <LevelCell value={o.limitPrice} price={priceOf(o.symbol)} tone="text-foreground" label="du cours" />
                    <td className="px-4 py-3.5 text-right text-[11px] text-red-500" style={MONO}>{num(o.stopLoss)}</td>
                    <td className="px-4 py-3.5 text-right text-[11px] text-emerald-600" style={MONO}>{num(o.takeProfit)}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <EditButton onClick={() => setEditing(o)} />
                      <button onClick={() => act(() => ordersApi.cancel(o.id), "Annulation")} title="Annuler l'ordre"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border text-red-600 hover:bg-red-50">
                        <Ban className="w-3 h-3" /> Annuler
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "history" && (
            <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b border-border/40">
              <FilterField label="Statut">
                <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as HistoryFilter["status"] }))} className={filterClass}>
                  <option value="">Tous</option><option value="CLOSED">Clôturés</option><option value="CANCELLED">Annulés</option><option value="REJECTED">Refusés</option>
                </select>
              </FilterField>
              <FilterField label="Actif">
                <select value={filter.symbol} onChange={(e) => setFilter((f) => ({ ...f, symbol: e.target.value }))} className={filterClass}>
                  <option value="">Tous</option>{historySymbols.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FilterField>
              <FilterField label="Du"><input type="date" value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} className={filterClass} /></FilterField>
              <FilterField label="Au"><input type="date" value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} className={filterClass} /></FilterField>
              {(filter.status || filter.symbol || filter.from || filter.to) && (
                <button onClick={() => setFilter({ status: "", symbol: "", from: "", to: "" })} className="text-[11px] font-semibold text-blue-600 hover:underline pb-2">Réinitialiser</button>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground pb-2">{filteredHistory.length} / {done.length} ordre(s)</span>
            </div>
          )}
          {tab === "history" && (
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-3">Actif</th><th className="text-center px-4 py-3">Sens</th><th className="text-center px-4 py-3">Statut</th>
                  <th className={thClass}>Qté</th><th className={thClass}>Entrée</th><th className={thClass}>Sortie</th>
                  <th className={thClass}>P&amp;L réalisé</th><th className={thClass}>Frais</th><th className="text-left px-4 py-3">Raison</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredHistory.length === 0 && <EmptyRow cols={9} text={done.length ? "Aucun ordre ne correspond aux filtres." : "Aucun ordre terminé."} />}
                {filteredHistory.map((o) => {
                  const pnl = Number(o.realizedPnl ?? 0);
                  return (
                    <tr key={o.id} className="hover:bg-muted/10 transition-colors">
                      <SymbolCell o={o} />
                      <td className="px-4 py-3.5 text-center"><SideBadge o={o} /></td>
                      <td className="px-4 py-3.5 text-center"><StatusBadge status={o.status} /></td>
                      <td className={`${tdNum} text-foreground`} style={MONO}>{Number(o.quantity)}</td>
                      <td className={`${tdNum} text-muted-foreground`} style={MONO}>{num(o.executedPrice)}</td>
                      <td className={`${tdNum} text-muted-foreground`} style={MONO}>{num(o.closePrice)}</td>
                      <td className={`${tdNum} font-medium ${o.status === "CLOSED" ? pnlClass(pnl) : "text-muted-foreground"}`} style={MONO}>
                        {o.status === "CLOSED" ? signed(pnl, fmt) : "—"}
                      </td>
                      <td className={`${tdNum} text-muted-foreground`} style={MONO}>{o.fees ? fmt(Number(o.fees)) : "—"}</td>
                      <td className="px-4 py-3.5 text-[11px] text-muted-foreground min-w-[260px] max-w-[360px]">{historyReason(o)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </CardShell>

      <EditProtectionDialog order={editing} onClose={() => setEditing(null)} onSave={saveProtection} />
      <CloseConfirmDialog order={closing} onClose={() => setClosing(null)}
        onConfirm={(id) => act(() => ordersApi.close(id), "Clôture")} />
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="px-5 py-6 text-center text-xs text-muted-foreground">{text}</td></tr>;
}

const filterClass = "bg-muted/30 border border-border rounded-md px-2 py-1.5 text-xs text-foreground outline-none focus:border-blue-400";

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">{label}</span>{children}</label>;
}

function SymbolCell({ o }: { o: TradeOrder }) {
  const agent = o.source === "AGENT" || o.closeReason === "AGENT";
  return (
    <td className="px-5 py-3.5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-blue-700">{o.symbol.slice(0, 2)}</span>
        </div>
        <div>
          <span className="text-sm font-medium text-foreground block">{o.symbol}</span>
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1.5" style={MONO}>
            #{o.id}
            {agent && (
              <span className="inline-flex items-center gap-0.5 px-1.5 rounded-full bg-violet-50 text-violet-700 font-semibold"
                title={o.source === "AGENT" ? "Ordre passé par l'agent IA" : "Clôturé par l'agent IA"}>
                <Bot className="w-2.5 h-2.5" /> Agent
              </span>
            )}
          </span>
        </div>
      </div>
    </td>
  );
}

/** Niveau (SL, TP, limite) et son ecart en % au cours actuel. */
function LevelCell({ value, price, tone, label = "" }: { value: number | null | undefined; price: number | null | undefined; tone: string; label?: string }) {
  const d = formatDistance(distancePct(value, price));
  return (
    <td className={`px-4 py-3.5 text-right text-[11px] ${tone}`} style={MONO}>
      {num(value)}
      {value != null && d && <span className="block text-[10px] text-muted-foreground">{d}{label ? ` ${label}` : ""}</span>}
    </td>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Modifier stop-loss / take-profit"
      className="inline-flex items-center justify-center w-7 h-7 mr-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 align-middle">
      <Pencil className="w-3 h-3" />
    </button>
  );
}

function SideBadge({ o }: { o: TradeOrder }) {
  const long = o.side === "BUY";
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${long ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
      {long ? "LONG" : "SHORT"}
    </span>
  );
}

function StatusBadge({ status }: { status: TradeOrder["status"] }) {
  const cls = status === "CLOSED" ? "bg-blue-50 text-blue-700" : status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground";
  const label = status === "CLOSED" ? "Clôturé" : status === "REJECTED" ? "Refusé" : status === "CANCELLED" ? "Annulé" : status;
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}
