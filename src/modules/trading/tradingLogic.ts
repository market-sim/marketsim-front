// Logique pure du module 2 (sans React) : testee par scripts/test-logic.cjs.
import type { CreateOrderRequest, OrderSide, OrderStatus, OrderType, RiskAssessRequest, RiskAssessment, RiskLevel, TradeOrder, UpdateOrderRequest } from "../../api/endpoints";

export interface OrderForm {
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: string;
  limitPrice: string;
  stopLoss: string;
  takeProfit: string;
}

/** "" -> null ; "12,5" accepte (virgule francaise) ; NaN -> undefined (= invalide). */
export function parseOptional(raw: string): number | null | undefined {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Construit la requete envoyee au serveur. Jamais de prix pour un MARKET (le serveur lit le prix lui-meme) ;
 * prix limite / declencheur obligatoire pour LIMIT et STOP.
 */
export function buildOrderRequest(f: OrderForm): { request?: CreateOrderRequest; error?: string } {
  if (!f.symbol) return { error: "Choisissez un actif" };
  const quantity = parseOptional(f.quantity);
  if (quantity == null || quantity <= 0) return { error: "Quantité invalide" };
  const stopLoss = parseOptional(f.stopLoss);
  const takeProfit = parseOptional(f.takeProfit);
  if (stopLoss === undefined || (stopLoss != null && stopLoss <= 0)) return { error: "Stop-loss invalide" };
  if (takeProfit === undefined || (takeProfit != null && takeProfit <= 0)) return { error: "Take-profit invalide" };
  const request: CreateOrderRequest = { symbol: f.symbol, side: f.side, orderType: f.orderType, quantity, stopLoss, takeProfit };
  if (f.orderType !== "MARKET") {
    const limitPrice = parseOptional(f.limitPrice);
    if (limitPrice == null || limitPrice <= 0) return { error: "Prix limite / déclencheur obligatoire" };
    request.limitPrice = limitPrice;
  }
  return { request };
}

/** Requete de simulation du risque, ou null si le formulaire n'est pas encore evaluable. */
export function buildRiskRequest(f: OrderForm): RiskAssessRequest | null {
  const { request } = buildOrderRequest(f);
  if (!request) return null;
  return { symbol: request.symbol, side: request.side, orderType: request.orderType, quantity: request.quantity,
    limitPrice: request.limitPrice ?? null, stopLoss: request.stopLoss ?? null };
}

export interface RiskStyle { label: string; text: string; bar: string }

export function riskStyle(level: RiskLevel | undefined): RiskStyle {
  switch (level) {
    case "LOW": return { label: "Risque faible", text: "text-emerald-600", bar: "bg-emerald-500" };
    case "MEDIUM": return { label: "Risque modéré", text: "text-amber-600", bar: "bg-amber-500" };
    case "HIGH": return { label: "Risque élevé", text: "text-orange-600", bar: "bg-orange-500" };
    case "BLOCKED": return { label: "Ordre bloqué", text: "text-red-600", bar: "bg-red-500" };
    default: return { label: "—", text: "text-muted-foreground", bar: "bg-muted-foreground/40" };
  }
}

/** Repartition des tickets pour les onglets. Historique : CLOSED / CANCELLED / REJECTED, plus recents d'abord. */
export function splitOrders(orders: TradeOrder[]) {
  const time = (o: TradeOrder) => Date.parse(o.closedAt ?? o.createdAt ?? "") || 0;
  return {
    open: orders.filter((o) => o.status === "OPEN"),
    pending: orders.filter((o) => o.status === "PENDING"),
    history: orders.filter((o) => o.status === "CLOSED" || o.status === "CANCELLED" || o.status === "REJECTED")
      .sort((a, b) => time(b) - time(a)),
  };
}

export const CLOSE_REASON_LABEL: Record<string, string> = {
  MANUAL: "Manuelle", STOP_LOSS: "Stop-loss", TAKE_PROFIT: "Take-profit", AGENT: "Agent IA",
};

/** Libelle de la raison affichee dans l'historique. */
export function historyReason(o: TradeOrder): string {
  if (o.status === "REJECTED") return o.rejectReason ?? "Refusé";
  if (o.status === "CANCELLED") return "Annulé";
  return o.closeReason ? CLOSE_REASON_LABEL[o.closeReason] ?? o.closeReason : "—";
}

/** Signe explicite et -0 evite. */
export function signed(v: number, format: (n: number) => string): string {
  const n = Math.abs(v) < 0.005 ? 0 : v;
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${format(Math.abs(n))}`;
}

/** Frais par transaction (doit rester egal a trading.fee-rate cote serveur ; sert uniquement aux estimations). */
export const FEE_RATE = 0.001;

/** Ecart en % entre un niveau (SL, TP, limite) et le prix courant : negatif = niveau sous le prix. */
export function distancePct(level: number | null | undefined, price: number | null | undefined): number | null {
  if (level == null || price == null || !(Number(price) > 0)) return null;
  return (Number(level) / Number(price) - 1) * 100;
}

/** "-3.20 %" / "+1.05 %" (2 decimales), ou "" si non calculable. */
export function formatDistance(d: number | null): string {
  if (d == null || !Number.isFinite(d)) return "";
  const v = Math.abs(d) < 0.005 ? 0 : d;
  return `${v > 0 ? "+" : ""}${v.toFixed(2)} %`;
}

/** Estimation de la cloture d'un ticket OPEN au prix courant (le prix reel est fixe par le serveur). */
export function estimateClose(o: TradeOrder, feeRate = FEE_RATE): { pnl: number; closeFee: number; net: number } | null {
  if (o.status !== "OPEN" || o.currentPrice == null) return null;
  const qty = Number(o.quantity);
  const entry = Number(o.executedPrice ?? o.price);
  const exit = Number(o.currentPrice);
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const pnl = round2((o.side === "BUY" ? exit - entry : entry - exit) * qty);
  const closeFee = round2(qty * exit * feeRate);
  return { pnl, closeFee, net: round2(pnl - closeFee) };
}

export interface HistoryFilter { status: "" | OrderStatus; symbol: string; from: string; to: string }

/** Filtre de l'historique (dates yyyy-MM-dd incluses, sur la date de creation, comme l'API). */
export function filterHistory(orders: TradeOrder[], f: HistoryFilter): TradeOrder[] {
  return orders.filter((o) => {
    if (f.status && o.status !== f.status) return false;
    if (f.symbol && o.symbol !== f.symbol) return false;
    const day = (o.createdAt ?? "").slice(0, 10);
    if (f.from && (!day || day < f.from)) return false;
    if (f.to && (!day || day > f.to)) return false;
    return true;
  });
}

/** Contribution de chaque composante au score (memes poids que RiskCalculator cote serveur). */
export const RISK_WEIGHTS = [
  { key: "concentration", label: "Concentration", weight: 30 },
  { key: "orderSize", label: "Taille de l'ordre", weight: 25 },
  { key: "volatility", label: "Volatilité", weight: 20 },
  { key: "grossExposure", label: "Exposition brute", weight: 15 },
  { key: "liquidity", label: "Liquidité restante", weight: 10 },
] as const;

export function riskBreakdown(components: RiskAssessment["components"] | null | undefined) {
  if (!components) return [];
  return RISK_WEIGHTS.map(({ key, label, weight }) => {
    const ratio = Math.max(0, Math.min(1, Number(components[key]) || 0));
    return { key, label, weight, ratio, points: Math.round(ratio * weight * 10) / 10 };
  });
}

/**
 * Requete PUT partielle a partir des champs SL/TP saisis. Champ vide alors qu'un niveau existait = effacement
 * explicite ; valeur identique = rien a envoyer pour ce champ.
 */
export function buildProtectionUpdate(o: Pick<TradeOrder, "stopLoss" | "takeProfit">, sl: string, tp: string): { request?: UpdateOrderRequest; error?: string } {
  const req: UpdateOrderRequest = {};
  const pairs: [string, number | null | undefined, "stopLoss" | "takeProfit", "clearStopLoss" | "clearTakeProfit", string][] = [
    [sl, o.stopLoss, "stopLoss", "clearStopLoss", "Stop-loss"],
    [tp, o.takeProfit, "takeProfit", "clearTakeProfit", "Take-profit"],
  ];
  for (const [raw, current, field, clear, label] of pairs) {
    const v = parseOptional(raw);
    if (v === undefined || (v != null && v <= 0)) return { error: `${label} invalide` };
    if (v == null) { if (current != null) req[clear] = true; }
    else if (current == null || Number(current) !== v) req[field] = v;
  }
  if (Object.keys(req).length === 0) return { error: "Aucune modification" };
  return { request: req };
}
