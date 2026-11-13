// Logique pure du module 2 (sans React) : testee par scripts/test-logic.cjs.
import type { CreateOrderRequest, OrderSide, OrderType, RiskAssessRequest, RiskLevel, TradeOrder } from "../../api/endpoints";

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
