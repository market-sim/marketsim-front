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

// ─── Personnalites (pre-remplissage du formulaire) ──────────────────────────
export type Personality = "PRUDENT" | "EQUILIBRE" | "AGRESSIF";

export const personalities: Record<Personality, { label: string; emoji: string; description: string; riskLevel: number; maxPositionSize: number; strategy: AgentStrategy }> = {
  PRUDENT: { label: "Prudent", emoji: "🛡️", description: "Petites positions, stop-loss larges, n'agit que sur des signaux forts", riskLevel: 20, maxPositionSize: 5000, strategy: "MEAN_REVERSION" },
  EQUILIBRE: { label: "Équilibré", emoji: "⚖️", description: "Compromis rendement / risque", riskLevel: 50, maxPositionSize: 10000, strategy: "MOMENTUM" },
  AGRESSIF: { label: "Agressif", emoji: "🚀", description: "Grosses positions, réagit vite aux tendances", riskLevel: 85, maxPositionSize: 20000, strategy: "MOMENTUM" },
};

export const personalityOf = (riskLevel: number): Personality =>
  riskLevel <= 33 ? "PRUDENT" : riskLevel <= 66 ? "EQUILIBRE" : "AGRESSIF";

// ─── Explication en langage naturel (bulle "l'agent a acheté parce que...") ──
function describe(feature: string, value: number): string {
  switch (feature) {
    case "momentum": return value >= 0 ? "le prix monte depuis 20 jours" : "le prix baisse depuis 20 jours";
    case "trend": return value >= 0 ? "la tendance est haussière (MM10 au-dessus de MM30)" : "la tendance est baissière (MM10 sous MM30)";
    case "rsi": return value > 0.3 ? "le RSI signale un surachat" : value < -0.3 ? "le RSI signale une survente" : value >= 0 ? "le RSI est plutôt élevé" : "le RSI est plutôt bas";
    case "meanReversion": return value >= 0 ? "le prix est anormalement bas par rapport à sa moyenne" : "le prix est anormalement haut par rapport à sa moyenne";
    case "volatility": return value >= 0 ? "le marché est plus agité que d'habitude" : "le marché est calme";
    case "position": return value >= 1 ? "je suis déjà investi" : "je n'ai pas encore de position";
    default: return feature;
  }
}

/**
 * @param relativeToAction true pour le Q-learning : une contribution positive soutient l'action choisie
 *                         (pour les modeles lineaires, positive = pousse a acheter)
 */
export function humanExplanation(
  d: { symbol: string; action: AgentAction; contributions: { feature: string; value: number; contribution: number }[] },
  relativeToAction = false,
): string {
  const sorted = [...d.contributions].filter((c) => Math.abs(c.contribution) > 0.02).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const pro = (c: { contribution: number }) =>
    relativeToAction || d.action !== "SELL" ? c.contribution > 0 : c.contribution < 0;
  if (relativeToAction && d.action === "HOLD") {
    const reasons = sorted.filter(pro).slice(0, 2).map((c) => describe(c.feature, c.value));
    return `J'attends sur ${d.symbol}${reasons.length ? ` parce que ${reasons.join(" et ")}` : " : aucune action n'est clairement meilleure"}.`;
  }
  const support = sorted.filter(pro).slice(0, 2).map((c) => describe(c.feature, c.value));
  const against = sorted.filter((c) => !pro(c)).slice(0, 1).map((c) => describe(c.feature, c.value));
  if (d.action === "HOLD") {
    if (sorted.length === 0) return `J'attends sur ${d.symbol} : le marché n'envoie aucun signal clair.`;
    const up = sorted.filter((c) => c.contribution > 0).map((c) => describe(c.feature, c.value))[0];
    const down = sorted.filter((c) => c.contribution < 0).map((c) => describe(c.feature, c.value))[0];
    return `J'attends sur ${d.symbol} : ${[up && `${up} (pousse à acheter)`, down && `${down} (pousse à vendre)`].filter(Boolean).join(", mais ")} — les signaux se compensent.`;
  }
  const verb = d.action === "BUY" ? "J'achète" : "Je vends";
  const because = support.length ? support.join(" et ") : "le score global le justifie";
  return `${verb} ${d.symbol} parce que ${because}${against.length ? `, malgré le fait que ${against[0]}` : ""}.`;
}
