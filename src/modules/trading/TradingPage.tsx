import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { fmt, MONO, DISPLAY, CardShell } from "../../shared/ui";
import { assetsApi, ordersApi, type Asset, type TradeOrder } from "../../api/endpoints";
import { errorMessage } from "../../api/client";

const inputClass = "w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400";
const labelClass = "text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1";

/** Module 2 : passage d'ordres + positions ouvertes (CRUD /api/trading/orders). */
export default function TradingPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [symbol, setSymbol] = useState("");
  const [orderType, setOrderType] = useState<TradeOrder["orderType"]>("MARKET");
  const [quantity, setQuantity] = useState("10");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [error, setError] = useState("");

  const loadOrders = () => ordersApi.list().then(setOrders).catch((e) => setError(errorMessage(e)));

  useEffect(() => {
    assetsApi.list().then((list) => {
      setAssets(list);
      if (list.length) setSymbol(list[0].symbol);
    }).catch((e) => setError(errorMessage(e)));
    loadOrders();
  }, []);

  const priceOf = (s: string) => Number(assets.find((a) => a.symbol === s)?.price ?? 0);

  const placeOrder = async () => {
    setError("");
    try {
      await ordersApi.create({
        symbol,
        side,
        orderType,
        quantity: Number(quantity),
        price: priceOf(symbol),
        stopLoss: stopLoss ? Number(stopLoss) : null,
        takeProfit: takeProfit ? Number(takeProfit) : null,
      });
      setStopLoss("");
      setTakeProfit("");
      loadOrders();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const cancelOrder = async (id: number) => {
    await ordersApi.remove(id);
    loadOrders();
  };

  const openOrders = orders.filter((o) => o.status === "OPEN");
  const pnlOf = (o: TradeOrder) => {
    const diff = (priceOf(o.symbol) - Number(o.price)) * Number(o.quantity);
    return (o.side === "BUY" ? diff : -diff) || 0; // "|| 0" evite d'afficher -0
  };
  const unrealized = openOrders.reduce((sum, o) => sum + pnlOf(o), 0);
  const exposure = openOrders.reduce((sum, o) => sum + Number(o.price) * Number(o.quantity), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Order Form */}
        <CardShell className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4" style={DISPLAY}>Place Order</h3>
          <div className="flex rounded-lg overflow-hidden border border-border mb-4">
            <button onClick={() => setSide("BUY")} className={`flex-1 py-2 text-sm font-semibold transition-colors ${side === "BUY" ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-muted/50"}`}>BUY</button>
            <button onClick={() => setSide("SELL")} className={`flex-1 py-2 text-sm font-semibold transition-colors ${side === "SELL" ? "bg-red-500 text-white" : "text-muted-foreground hover:bg-muted/50"}`}>SELL</button>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Asset</label>
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputClass}>
                {assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Order Type</label>
              <select value={orderType} onChange={(e) => setOrderType(e.target.value as TradeOrder["orderType"])} className={inputClass}>
                <option value="MARKET">Market Order</option>
                <option value="LIMIT">Limit Order</option>
                <option value="STOP">Stop Order</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Quantity</label>
              <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Stop-Loss</label>
                <input type="number" step="any" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Take-Profit</label>
                <input type="number" step="any" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              {/* TODO IA module 2 : remplacer par la vraie prediction du risque */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>AI Risk Assessment</span>
                <span className="text-emerald-600 font-medium">Low Risk (23 / 100)</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full">
                <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width: "23%" }} />
              </div>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
          <button onClick={placeOrder} disabled={!symbol} className={`w-full mt-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${side === "BUY" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}>
            {side} {symbol} @ {fmt(priceOf(symbol))}
          </button>
        </CardShell>

        {/* Quick Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4 content-start">
          {[
            { label: "Open Positions", value: String(openOrders.length), sub: `${orders.length} ordres au total`, positive: true },
            { label: "Exposure",       value: fmt(exposure),             sub: "Montant engagé",                    positive: true },
            { label: "Unrealized P&L", value: `${unrealized >= 0 ? "+" : ""}${fmt(unrealized)}`, sub: "Sur les positions ouvertes", positive: unrealized >= 0 },
            { label: "Assets",         value: String(assets.length),     sub: "Actifs disponibles",                positive: true },
          ].map(({ label, value, sub, positive }) => (
            <CardShell key={label} className="p-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
              <p className="text-xl font-semibold text-foreground" style={MONO}>{value}</p>
              <p className={`text-[11px] mt-1 ${positive ? "text-emerald-600" : "text-red-500"}`}>{sub}</p>
            </CardShell>
          ))}
        </div>
      </div>

      {/* Open Positions */}
      <CardShell className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Open Positions</h3>
          <span className="text-[11px] text-muted-foreground">{openOrders.length} active</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                <th className="text-left px-5 py-3">Asset</th>
                <th className="text-center px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Qty</th>
                <th className="text-right px-4 py-3">Entry</th>
                <th className="text-right px-4 py-3">Current</th>
                <th className="text-right px-4 py-3">P&amp;L</th>
                <th className="text-right px-4 py-3">Stop-Loss</th>
                <th className="text-right px-4 py-3">Take-Profit</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {openOrders.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-6 text-center text-xs text-muted-foreground">Aucune position. Passez votre premier ordre !</td></tr>
              )}
              {openOrders.map((o) => {
                const pnl = pnlOf(o);
                return (
                  <tr key={o.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-blue-700">{o.symbol.slice(0, 2)}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{o.symbol}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${o.side === "BUY" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{o.side === "BUY" ? "LONG" : "SHORT"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm text-foreground" style={MONO}>{o.quantity}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-muted-foreground" style={MONO}>{fmt(Number(o.price))}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-foreground" style={MONO}>{fmt(priceOf(o.symbol))}</td>
                    <td className={`px-4 py-3.5 text-right text-sm font-medium ${pnl >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>
                      {pnl >= 0 ? "+" : ""}{fmt(pnl)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[11px] text-red-500" style={MONO}>{o.stopLoss != null ? fmt(Number(o.stopLoss)) : "—"}</td>
                    <td className="px-4 py-3.5 text-right text-[11px] text-emerald-600" style={MONO}>{o.takeProfit != null ? fmt(Number(o.takeProfit)) : "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => cancelOrder(o.id!)} title="Supprimer" className="text-muted-foreground hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardShell>
    </div>
  );
}
