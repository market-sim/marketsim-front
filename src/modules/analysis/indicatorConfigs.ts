// Module 3 : configurations d'indicateurs de l'onglet « Analyse technique » (comparaison avec les reglages
// affiches, validation du nom, passage a une strategie). Fonctions pures : aucun appel au back ni au DOM.
import type { IndicatorConfig, IndicatorConfigRequest, StrategyParams, StrategyType } from "../../api/endpoints";
import type { PeriodKey, Periods, Visibility } from "./technical";

/** Memes limites que le back (IndicatorConfigService). */
export const CONFIG_NAME_MAX = 80;
export const CONFIG_DESCRIPTION_MAX = 500;

const PERIOD_KEYS: PeriodKey[] = ["smaFast", "smaSlow", "ema", "bbPeriod", "bbK", "rsi", "macdFast", "macdSlow", "macdSignal"];
const SHOW_KEYS: (keyof Visibility)[] = ["smaFast", "smaSlow", "ema", "bollinger", "rsi", "macd"];

/** Vrai si les reglages affiches (periodes appliquees et courbes visibles) sont ceux de la configuration. */
export function matchesConfig(config: IndicatorConfig, periods: Periods, show: Visibility): boolean {
  return PERIOD_KEYS.every((k) => config.periods[k] === periods[k]) && SHOW_KEYS.every((k) => config.show[k] === show[k]);
}

/** Les reglages de l'onglet, au format attendu par le back. */
export const configRequest = (name: string, description: string, periods: Periods, show: Visibility): IndicatorConfigRequest => ({
  name: name.trim(),
  description: description.trim() || null,
  periods: { ...periods },
  show: { ...show },
});

/** Nom deja pris par une autre de mes configurations (sans tenir compte des majuscules, comme le back). */
const taken = (name: string, configs: IndicatorConfig[], exceptId?: number) =>
  configs.some((c) => c.id !== exceptId && c.name.trim().toLocaleLowerCase("fr") === name.trim().toLocaleLowerCase("fr"));

/** Message d'erreur du nom saisi, ou "" s'il est valide. Le back reste l'arbitre (409 si le nom est pris). */
export function configNameError(name: string, configs: IndicatorConfig[], exceptId?: number): string {
  const trimmed = name.trim();
  if (trimmed === "") return "Le nom est obligatoire";
  if (trimmed.length > CONFIG_NAME_MAX) return `${CONFIG_NAME_MAX} caractères au maximum`;
  if (taken(trimmed, configs, exceptId)) return `Vous avez déjà une configuration nommée « ${trimmed} »`;
  return "";
}

// ─── Passage a une strategie ─────────────────────────────────────────────────

/**
 * Parametres de strategie repris des periodes affichees, pour le type choisi dans le formulaire.
 * - SMA_CROSS : SMA courte et longue ;
 * - EMA_CROSS : periodes rapide et lente du MACD. La configuration n'a qu'une EMA ; le MACD est exactement
 *   l'ecart entre ces deux EMA (il passe au-dessus de zero quand la rapide croise la lente), et elles sont
 *   toujours valides (rapide < lente) ;
 * - RSI : periode du RSI ; seuils 30 / 70 (ceux du graphique), la configuration n'en a pas ;
 * - MACD : rapide, lente, signal ;
 * - BOLLINGER : periode et multiplicateur ;
 * - BUY_AND_HOLD : aucun parametre.
 */
export function strategyParamsFromPeriods(type: StrategyType, p: Periods): StrategyParams | null {
  switch (type) {
    case "SMA_CROSS": return { fastPeriod: p.smaFast, slowPeriod: p.smaSlow };
    case "EMA_CROSS": return { fastPeriod: p.macdFast, slowPeriod: p.macdSlow };
    case "RSI": return { period: p.rsi, buyBelow: 30, sellAbove: 70 };
    case "MACD": return { fastPeriod: p.macdFast, slowPeriod: p.macdSlow, signalPeriod: p.macdSignal };
    case "BOLLINGER": return { period: p.bbPeriod, bandK: p.bbK };
    case "BUY_AND_HOLD": return null;
  }
}

/** Phrase expliquant d'ou viennent les parametres, pour le type choisi (affichee dans le formulaire). */
export const STRATEGY_SOURCE: Record<StrategyType, string> = {
  SMA_CROSS: "Périodes rapide et lente = SMA courte et SMA longue de la configuration.",
  EMA_CROSS: "La configuration n'a qu'une EMA : les périodes rapide et lente sont celles du MACD (le MACD est l'écart entre ces deux EMA).",
  RSI: "Période du RSI de la configuration ; seuils 30 et 70, ceux du graphique RSI.",
  MACD: "Périodes rapide, lente et signal du MACD de la configuration.",
  BOLLINGER: "Période et multiplicateur des bandes de Bollinger de la configuration.",
  BUY_AND_HOLD: "Le buy & hold n'a pas de paramètre : la configuration n'est pas utilisée.",
};
