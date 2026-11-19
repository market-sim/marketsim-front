// Module 3 : formulaire de lancement d'un backtest.
// L'utilisateur saisit des pourcentages ; l'API attend des fractions (0,1 % -> 0.001).
// Memes bornes que le back (BacktestService) : le back reste l'arbitre.
import type { BacktestRequest, BacktestSettings } from "../../api/endpoints";

export interface BacktestFormValues {
  strategyId: string;
  symbol: string;
  /** vide = debut de l'historique */
  from: string;
  /** vide = derniere seance disponible */
  to: string;
  capital: string;
  feePct: string;
  /** vide = pas de stop-loss */
  stopLossPct: string;
  /** vide = pas de take-profit */
  takeProfitPct: string;
  /** vide = pas de separation entrainement / test */
  splitDate: string;
  slippagePct: string;
  positionPct: string;
  /** taux sans risque annuel (%), utilise par Sharpe et Sortino */
  riskFreePct: string;
}
export type BacktestField = keyof BacktestFormValues;
export type BacktestErrors = Partial<Record<BacktestField, string>>;

/**
 * Valeurs d'origine du back (BacktestSettings.BUILT_IN) : 10 000 $, frais de 0,1 % par ordre, tout le capital
 * engage. Les formulaires les remplacent par les parametres par defaut de l'administrateur des qu'ils sont lus.
 */
export const DEFAULT_BACKTEST_FORM: BacktestFormValues = {
  strategyId: "",
  symbol: "",
  from: "",
  to: "",
  capital: "10000",
  feePct: "0.1",
  stopLossPct: "",
  takeProfitPct: "",
  splitDate: "",
  slippagePct: "0",
  positionPct: "100",
  riskFreePct: "0",
};

/** Taux sans risque maximal accepte (meme borne que le back : BacktestSettings.MAX_RISK_FREE_RATE). */
export const MAX_RISK_FREE_PCT = 20;

const parse = (raw: string) => Number(raw.trim().replace(",", "."));
/** 0.1 (%) -> 0.001, sans erreur d'arrondi visible (0.1 / 100 = 0.001). */
const fraction = (pct: number) => Number((pct / 100).toFixed(8));
/** 0.001 -> "0.1" (pourcentage saisi), sans erreur d'arrondi visible. */
const percentText = (rate: number) => String(Number((rate * 100).toFixed(6)));

/** Les champs de reglages (communs aux formulaires Backtest et Comparaison). */
export const SETTINGS_KEYS = ["capital", "feePct", "slippagePct", "positionPct", "stopLossPct", "takeProfitPct", "riskFreePct"] as const;
export type SettingsFields = Pick<BacktestFormValues, (typeof SETTINGS_KEYS)[number]>;

/**
 * Applique de nouveaux parametres par defaut a un formulaire, champ par champ : un champ que l'utilisateur
 * n'a pas modifie (il vaut encore l'ancien defaut) prend le nouveau ; un champ saisi par l'utilisateur reste.
 */
export function applyDefaults<T extends SettingsFields>(values: T, previous: SettingsFields, next: SettingsFields): T {
  const out = { ...values };
  for (const key of SETTINGS_KEYS) {
    if (values[key] === previous[key]) out[key] = next[key];
  }
  return out;
}

/**
 * Champs de reglages remplis avec des reglages enregistres ou avec les parametres par defaut (pour relancer un
 * backtest ou une comparaison avec les memes valeurs, ou preremplir les formulaires). La periode et la coupure
 * sont fournies a part.
 */
export function settingsFields(s: BacktestSettings): SettingsFields {
  return {
    capital: String(s.initialCapital),
    feePct: percentText(s.feeRate),
    slippagePct: percentText(s.slippage),
    positionPct: percentText(s.positionFraction),
    stopLossPct: s.stopLoss == null ? "" : percentText(s.stopLoss),
    takeProfitPct: s.takeProfit == null ? "" : percentText(s.takeProfit),
    riskFreePct: percentText(s.riskFreeRate ?? 0),
  };
}

/** Verifie la saisie ; `request` est null s'il y a une erreur. */
export function buildBacktestRequest(v: BacktestFormValues): { request: BacktestRequest | null; errors: BacktestErrors } {
  const errors: BacktestErrors = {};

  /** Champ numerique obligatoire, dans les bornes donnees. */
  const required = (field: BacktestField, ok: (x: number) => boolean, message: string): number => {
    const x = parse(v[field]);
    if (v[field].trim() === "" || !Number.isFinite(x) || !ok(x)) errors[field] = message;
    return x;
  };
  /** Champ numerique facultatif : vide = non utilise. */
  const optional = (field: BacktestField, ok: (x: number) => boolean, message: string): number | undefined => {
    if (v[field].trim() === "") return undefined;
    const x = parse(v[field]);
    if (!Number.isFinite(x) || !ok(x)) errors[field] = message;
    return x;
  };

  if (!v.strategyId) errors.strategyId = "Choisissez une stratégie";
  if (!v.symbol) errors.symbol = "Choisissez un actif";

  const capital = required("capital", (x) => x > 0, "Montant strictement positif");
  const fee = required("feePct", (x) => x >= 0 && x <= 5, "Entre 0 et 5 %");
  const slippage = required("slippagePct", (x) => x >= 0 && x <= 5, "Entre 0 et 5 %");
  const position = required("positionPct", (x) => x > 0 && x <= 100, "Supérieur à 0 et au plus 100 %");
  const stopLoss = optional("stopLossPct", (x) => x > 0 && x < 100, "Entre 0 et 100 % (exclus), ou vide");
  const takeProfit = optional("takeProfitPct", (x) => x > 0 && x <= 1000, "Supérieur à 0 et au plus 1000 %, ou vide");
  const riskFree = required("riskFreePct", (x) => x >= 0 && x <= MAX_RISK_FREE_PCT, `Entre 0 et ${MAX_RISK_FREE_PCT} %`);

  // les dates AAAA-MM-JJ se comparent comme du texte
  if (v.from && v.to && v.from >= v.to) errors.to = "La date de fin doit suivre la date de début";
  if (v.splitDate) {
    if (v.from && v.splitDate <= v.from) errors.splitDate = "La coupure doit être après la date de début";
    else if (v.to && v.splitDate > v.to) errors.splitDate = "La coupure doit être avant la date de fin";
  }

  if (Object.keys(errors).length > 0) return { request: null, errors };
  return {
    errors,
    request: {
      strategyId: Number(v.strategyId),
      symbol: v.symbol,
      from: v.from || undefined,
      to: v.to || undefined,
      initialCapital: capital,
      feeRate: fraction(fee),
      slippage: fraction(slippage),
      // champ vide = 0, qui veut dire « aucun » pour le back (sans valeur, il prendrait le defaut de l'administrateur)
      stopLoss: stopLoss == null ? 0 : fraction(stopLoss),
      takeProfit: takeProfit == null ? 0 : fraction(takeProfit),
      positionFraction: fraction(position),
      splitDate: v.splitDate || undefined,
      riskFreeRate: fraction(riskFree),
    },
  };
}
