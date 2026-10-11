import type { AgentAction, AgentStrategy, PriceModel } from "../../api/endpoints";

/** 0.0523 -> "+5.23 %" */
export const pctSigned = (v: number, digits = 1) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)} %`;
/** 0.0523 -> "5.2 %" */
export const pctPlain = (v: number, digits = 1) => `${(v * 100).toFixed(digits)} %`;

export const strategyLabel: Record<AgentStrategy, string> = {
  MOMENTUM: "Momentum (suivi de tendance)",
  MEAN_REVERSION: "Retour à la moyenne",
  Q_LEARNING: "Reinforcement Learning (Q-learning)",
};

export const strategyShort: Record<AgentStrategy, string> = {
  MOMENTUM: "Momentum",
  MEAN_REVERSION: "Mean Reversion",
  Q_LEARNING: "Q-Learning",
};

export const modelLabel: Record<PriceModel, string> = {
  GBM: "Brownien géométrique (GBM)",
  JUMP_DIFFUSION: "Merton jump-diffusion (krachs)",
  REGIME_SWITCHING: "Changement de régimes (Hamilton)",
};

export const actionStyle: Record<AgentAction, string> = {
  BUY: "bg-emerald-50 text-emerald-700",
  SELL: "bg-red-50 text-red-700",
  HOLD: "bg-amber-50 text-amber-700",
};

export const inputClass =
  "w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400";
export const labelClass = "text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1";
