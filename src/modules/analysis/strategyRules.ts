// Module 3 : types de strategie, parametres par defaut et validation du formulaire.
// Memes regles que le back (tn.esprit.marketsim.analysis.StrategyRules) : le back reste l'arbitre,
// cette validation sert seulement a signaler l'erreur avant l'envoi.
import type { StrategyParams, StrategyType } from "../../api/endpoints";

export const STRATEGY_TYPES: StrategyType[] = ["SMA_CROSS", "EMA_CROSS", "RSI", "MACD", "BOLLINGER", "BUY_AND_HOLD"];

export const typeLabel: Record<StrategyType, string> = {
  SMA_CROSS: "Croisement de moyennes mobiles simples (SMA)",
  EMA_CROSS: "Croisement de moyennes mobiles exponentielles (EMA)",
  RSI: "RSI survendu / suracheté",
  MACD: "MACD (croisement avec la ligne de signal)",
  BOLLINGER: "Bandes de Bollinger (retour à la moyenne)",
  BUY_AND_HOLD: "Buy & hold",
};

export const typeShort: Record<StrategyType, string> = {
  SMA_CROSS: "Croisement SMA",
  EMA_CROSS: "Croisement EMA",
  RSI: "RSI",
  MACD: "MACD",
  BOLLINGER: "Bollinger",
  BUY_AND_HOLD: "Buy & hold",
};

/** Regle d'achat et de vente de chaque type, affichee dans le formulaire. */
export const typeRule: Record<StrategyType, string> = {
  SMA_CROSS: "Achat quand la moyenne rapide passe au-dessus de la moyenne lente, vente quand elle repasse en dessous.",
  EMA_CROSS: "Achat quand la moyenne exponentielle rapide passe au-dessus de la lente, vente quand elle repasse en dessous.",
  RSI: "Achat quand le RSI est sous le seuil d'achat (survente), vente quand il dépasse le seuil de vente (surachat).",
  MACD: "Achat quand le MACD passe au-dessus de sa ligne de signal, vente quand il repasse en dessous.",
  BOLLINGER: "Retour à la moyenne : achat quand la clôture passe sous la bande basse, vente quand elle revient à la moyenne mobile.",
  BUY_AND_HOLD: "Achat au début de la période, conservation jusqu'à la fin. Sert de point de comparaison.",
};

export const MIN_PERIOD = 2;
export const MAX_PERIOD = 500;
export const MAX_BAND_K = 10;

export type ParamKey = keyof StrategyParams;

export interface ParamField {
  key: ParamKey;
  label: string;
  /** valeur par defaut, la meme que celle du back */
  def: number;
  /** true : periode entiere entre MIN_PERIOD et MAX_PERIOD */
  period: boolean;
}

const period = (key: ParamKey, label: string, def: number): ParamField => ({ key, label, def, period: true });
const level = (key: ParamKey, label: string, def: number): ParamField => ({ key, label, def, period: false });

/** Parametres a saisir pour chaque type. */
export const paramFields: Record<StrategyType, ParamField[]> = {
  SMA_CROSS: [period("fastPeriod", "Période rapide", 20), period("slowPeriod", "Période lente", 50)],
  EMA_CROSS: [period("fastPeriod", "Période rapide", 12), period("slowPeriod", "Période lente", 26)],
  RSI: [
    period("period", "Période du RSI", 14),
    level("buyBelow", "Seuil d'achat (survente)", 30),
    level("sellAbove", "Seuil de vente (surachat)", 70),
  ],
  MACD: [
    period("fastPeriod", "Période rapide", 12),
    period("slowPeriod", "Période lente", 26),
    period("signalPeriod", "Période du signal", 9),
  ],
  BOLLINGER: [period("period", "Période", 20), level("bandK", "Multiplicateur (k)", 2)],
  BUY_AND_HOLD: [],
};

/** Valeurs saisies dans le formulaire (du texte tant qu'elles ne sont pas validees). */
export type ParamDraft = Partial<Record<ParamKey, string>>;
export type ParamErrors = Partial<Record<ParamKey, string>>;

/** Saisie initiale : les parametres existants, sinon les valeurs par defaut du type. */
export function draftFor(type: StrategyType, params?: StrategyParams | null): ParamDraft {
  const draft: ParamDraft = {};
  for (const f of paramFields[type]) draft[f.key] = String(params?.[f.key] ?? f.def);
  return draft;
}

/** Verifie la saisie et renvoie les parametres prets a envoyer, ou les erreurs champ par champ. */
export function validateParams(type: StrategyType, draft: ParamDraft): { params: StrategyParams; errors: ParamErrors } {
  const params: StrategyParams = {};
  const errors: ParamErrors = {};

  for (const f of paramFields[type]) {
    const raw = (draft[f.key] ?? "").trim().replace(",", ".");
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) {
      errors[f.key] = "Valeur obligatoire";
    } else if (f.period && (!Number.isInteger(value) || value < MIN_PERIOD || value > MAX_PERIOD)) {
      errors[f.key] = `Entier entre ${MIN_PERIOD} et ${MAX_PERIOD}`;
    } else {
      params[f.key] = value;
    }
  }

  const { fastPeriod, slowPeriod, buyBelow, sellAbove, bandK } = params;
  if (fastPeriod != null && slowPeriod != null && fastPeriod >= slowPeriod) {
    errors.slowPeriod = "Doit être plus longue que la période rapide";
  }
  if (type === "RSI") {
    if (buyBelow != null && buyBelow <= 0) errors.buyBelow = "Doit être supérieur à 0";
    if (sellAbove != null && sellAbove >= 100) errors.sellAbove = "Doit être inférieur à 100";
    else if (buyBelow != null && sellAbove != null && buyBelow >= sellAbove) errors.sellAbove = "Doit être supérieur au seuil d'achat";
  }
  if (type === "BOLLINGER" && bandK != null && !(bandK > 0 && bandK <= MAX_BAND_K)) {
    errors.bandK = `Supérieur à 0 et au plus ${MAX_BAND_K}`;
  }
  return { params, errors };
}

/** Resume lisible des parametres, ex. "SMA 20 / SMA 50" ou "RSI 14 · achat < 30 · vente > 70". */
export function paramsSummary(type: StrategyType, p?: StrategyParams | null): string {
  const v = (x: number | null | undefined) => (x == null ? "?" : String(x));
  switch (type) {
    case "SMA_CROSS": return `SMA ${v(p?.fastPeriod)} / SMA ${v(p?.slowPeriod)}`;
    case "EMA_CROSS": return `EMA ${v(p?.fastPeriod)} / EMA ${v(p?.slowPeriod)}`;
    case "RSI": return `RSI ${v(p?.period)} · achat < ${v(p?.buyBelow)} · vente > ${v(p?.sellAbove)}`;
    case "MACD": return `MACD ${v(p?.fastPeriod)} / ${v(p?.slowPeriod)} / ${v(p?.signalPeriod)}`;
    case "BOLLINGER": return `Bollinger ${v(p?.period)} · k = ${v(p?.bandK)}`;
    case "BUY_AND_HOLD": return "Achat puis conservation";
  }
}
