// Module 3 : comparaison de strategies (formulaire, classement, meilleure valeur par ligne, export CSV).
// Fonctions pures : aucun appel au back ni au DOM.
import type {
  BacktestComparison, BacktestComparisonRequest, BacktestMetrics, StrategyComparison,
} from "../../api/endpoints";
import { buildBacktestRequest, DEFAULT_BACKTEST_FORM, type BacktestErrors, type BacktestFormValues } from "./backtestForm";
import { DASH, money, num, pctPlain, pctSigned, ptsSigned } from "./format";
import { paramsSummary, typeShort } from "./strategyRules";

/** Memes champs que le formulaire de backtest, mais plusieurs strategies. */
export type ComparisonFormValues = Omit<BacktestFormValues, "strategyId"> & { strategyIds: string[] };
export type RankingMetric = "sharpe" | "annualizedReturn" | "maxDrawdown";

export const MIN_COMPARED = 2;
export const MAX_COMPARED = 5;

export const DEFAULT_COMPARISON_FORM: ComparisonFormValues = {
  symbol: "",
  from: "",
  to: "",
  capital: DEFAULT_BACKTEST_FORM.capital,
  feePct: DEFAULT_BACKTEST_FORM.feePct,
  stopLossPct: DEFAULT_BACKTEST_FORM.stopLossPct,
  takeProfitPct: DEFAULT_BACKTEST_FORM.takeProfitPct,
  splitDate: DEFAULT_BACKTEST_FORM.splitDate,
  slippagePct: DEFAULT_BACKTEST_FORM.slippagePct,
  positionPct: DEFAULT_BACKTEST_FORM.positionPct,
  strategyIds: [],
};

export interface ComparisonErrors extends Omit<BacktestErrors, "strategyId"> {
  strategyIds?: string;
}

/** Verifie la saisie (memes regles que le backtest pour les reglages communs) ; `request` est null s'il y a une erreur. */
export function buildComparisonRequest(values: ComparisonFormValues): {
  request: BacktestComparisonRequest | null;
  errors: ComparisonErrors;
} {
  const errors: ComparisonErrors = {};
  if (values.strategyIds.length < MIN_COMPARED || values.strategyIds.length > MAX_COMPARED) {
    errors.strategyIds = `Choisissez entre ${MIN_COMPARED} et ${MAX_COMPARED} stratégies`;
  } else if (new Set(values.strategyIds).size !== values.strategyIds.length) {
    errors.strategyIds = "Chaque stratégie ne peut être choisie qu'une fois";
  } else if (values.strategyIds.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
    errors.strategyIds = "Les stratégies sélectionnées ne sont pas valides";
  }

  // reglages communs : on reutilise la validation du formulaire de backtest
  const { request, errors: commonErrors } = buildBacktestRequest({
    ...values,
    strategyId: values.strategyIds[0] ?? "",
  });
  const { strategyId: _strategyIdError, ...settingsErrors } = commonErrors;
  Object.assign(errors, settingsErrors);
  if (!request || errors.strategyIds) return { request: null, errors };

  const { strategyId: _strategyId, ...settings } = request;
  return {
    request: { ...settings, strategyIds: values.strategyIds.map(Number) },
    errors,
  };
}

// ─── Classement ──────────────────────────────────────────────────────────────

export const RANKING_OPTIONS: { value: RankingMetric; label: string }[] = [
  { value: "sharpe", label: "Ratio de Sharpe" },
  { value: "annualizedReturn", label: "Rendement annualisé" },
  { value: "maxDrawdown", label: "Drawdown maximum" },
];

export interface RankedStrategy {
  strategy: StrategyComparison;
  /** position de la strategie dans la reponse : elle fixe sa couleur */
  index: number;
  /** null si la metrique n'est pas calculable (classee en dernier) */
  rank: number | null;
  score: number | null;
}

/**
 * Classe les strategies, la meilleure en premier. Pour les trois criteres, plus grand = meilleur :
 * le drawdown est negatif, le plus proche de zero est donc le meilleur. Ex aequo : meme rang.
 */
export function rankStrategies(strategies: StrategyComparison[], criterion: RankingMetric): RankedStrategy[] {
  const valid = (v: number | null): v is number => v != null && Number.isFinite(v);
  const sorted = strategies
    .map((strategy, index) => ({ strategy, index, score: strategy.metrics[criterion] }))
    .sort((a, b) => {
      if (valid(a.score) !== valid(b.score)) return valid(a.score) ? -1 : 1;
      if (!valid(a.score) || !valid(b.score)) return a.index - b.index;
      return b.score - a.score || a.index - b.index;
    });

  let rank = 0;
  let previous: number | null = null;
  return sorted.map(({ strategy, index, score }, position) => {
    if (!valid(score)) return { strategy, index, rank: null, score: null };
    if (previous == null || Math.abs(score - previous) > 1e-10) rank = position + 1;
    previous = score;
    return { strategy, index, rank, score };
  });
}

// ─── Tableau des metriques ───────────────────────────────────────────────────

export type ComparisonMetricKey =
  | "finalCapital" | "totalReturn" | "annualizedReturn" | "buyHoldReturn" | "excessReturn"
  | "volatility" | "sharpe" | "sortino" | "calmar" | "maxDrawdown" | "maxDrawdownDays" | "winRate" | "profitFactor";

export interface ComparisonMetricRow {
  key: ComparisonMetricKey;
  label: string;
  /** sens du « meilleur » ; null : ligne de reference, jamais surlignee */
  direction: "higher" | "lower" | null;
  format: (value: number | null) => string;
}

export const COMPARISON_METRICS: ComparisonMetricRow[] = [
  { key: "finalCapital", label: "Capital final", direction: "higher", format: money },
  { key: "totalReturn", label: "Rendement total", direction: "higher", format: (v) => pctSigned(v) },
  { key: "annualizedReturn", label: "Rendement annualisé", direction: "higher", format: (v) => pctSigned(v) },
  // meme periode et meme capital : le buy & hold est identique pour toutes les strategies
  { key: "buyHoldReturn", label: "Buy & hold (référence)", direction: null, format: (v) => pctSigned(v) },
  { key: "excessReturn", label: "Écart au buy & hold", direction: "higher", format: (v) => ptsSigned(v) },
  { key: "volatility", label: "Volatilité annualisée", direction: "lower", format: (v) => pctPlain(v) },
  { key: "sharpe", label: "Ratio de Sharpe", direction: "higher", format: (v) => num(v) },
  { key: "sortino", label: "Ratio de Sortino", direction: "higher", format: (v) => num(v) },
  { key: "calmar", label: "Ratio de Calmar", direction: "higher", format: (v) => num(v) },
  { key: "maxDrawdown", label: "Drawdown maximum", direction: "higher", format: (v) => pctSigned(v) },
  { key: "maxDrawdownDays", label: "Durée du drawdown max", direction: "lower", format: (v) => (v == null ? DASH : `${v} j`) },
  { key: "winRate", label: "Trades gagnants", direction: "higher", format: (v) => pctPlain(v, 0) },
  { key: "profitFactor", label: "Profit factor", direction: "higher", format: (v) => num(v) },
];

/**
 * Indices des meilleures valeurs d'une ligne. La comparaison se fait sur les valeurs affichees : deux Sharpe
 * de 1.2345 et 1.2349 s'affichent tous deux « 1.23 » et sont donc ex aequo. Les valeurs absentes sont ignorees.
 * Si toutes les valeurs affichees sont egales, rien n'est surligne : il n'y a pas de meilleure.
 */
export function bestMetricIndexes(
  values: (number | null)[], direction: "higher" | "lower" | null, format: (value: number | null) => string,
): number[] {
  if (direction == null) return [];
  const valid = values
    .map((value, index) => ({ value, index }))
    .filter((e): e is { value: number; index: number } => e.value != null && Number.isFinite(e.value));
  if (valid.length === 0) return [];
  const best = valid.reduce((a, b) => (direction === "higher" ? (b.value > a.value ? b : a) : (b.value < a.value ? b : a)));
  const bestText = format(best.value);
  const winners = valid.filter((e) => format(e.value) === bestText).map((e) => e.index);
  return winners.length === values.length && values.length > 1 ? [] : winners;
}

// ─── Export CSV ──────────────────────────────────────────────────────────────

/**
 * Colonnes de metriques du CSV. Les taux sont convertis en pourcentage (comme a l'ecran) et l'unite
 * est dans le titre de la colonne : « pct » = fraction x 100.
 */
const CSV_METRICS: { key: keyof BacktestMetrics; label: string; pct: boolean }[] = [
  { key: "finalCapital", label: "Capital final ($)", pct: false },
  { key: "totalReturn", label: "Rendement total (%)", pct: true },
  { key: "annualizedReturn", label: "Rendement annualisé (%)", pct: true },
  { key: "buyHoldReturn", label: "Buy & hold (%)", pct: true },
  { key: "excessReturn", label: "Écart au buy & hold (pts)", pct: true },
  { key: "volatility", label: "Volatilité annualisée (%)", pct: true },
  { key: "sharpe", label: "Sharpe", pct: false },
  { key: "sortino", label: "Sortino", pct: false },
  { key: "calmar", label: "Calmar", pct: false },
  { key: "maxDrawdown", label: "Drawdown maximum (%)", pct: true },
  { key: "maxDrawdownDays", label: "Durée du drawdown max (jours)", pct: false },
  { key: "tradeCount", label: "Nombre de trades", pct: false },
  { key: "winRate", label: "Trades gagnants (%)", pct: true },
  { key: "profitFactor", label: "Profit factor", pct: false },
  { key: "exposure", label: "Temps investi (%)", pct: true },
];

/** Cellule CSV entre guillemets ; nombres avec une virgule decimale, comme l'attend Excel en francais. */
const csvCell = (value: string | number | null) => {
  const text = value == null ? "" : typeof value === "number" ? String(value).replace(".", ",") : value;
  return `"${text.replace(/"/g, '""')}"`;
};

const csvNumber = (value: unknown, pct: boolean): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return pct ? Number((value * 100).toFixed(4)) : value;
};

/**
 * Tableau des metriques en CSV (separateur « ; », BOM UTF-8 pour Excel) : une ligne par strategie et par periode
 * (complete, puis entrainement et test s'il y a une date de coupure).
 */
export function comparisonCsv(result: BacktestComparison): string {
  const rows: (string | number | null)[][] = [
    ["Actif", "Stratégie", "Type", "Paramètres", "Période", "Du", "Au", ...CSV_METRICS.map((m) => m.label)],
  ];
  for (const strategy of result.strategies) {
    const periods = [
      { name: "Complète", from: result.from, to: result.to, metrics: strategy.metrics },
      ...(strategy.train ? [{ name: "Entraînement", ...strategy.train }] : []),
      ...(strategy.test ? [{ name: "Test", ...strategy.test }] : []),
    ];
    for (const period of periods) {
      rows.push([
        result.symbol, strategy.strategyName, typeShort[strategy.strategyType] ?? strategy.strategyType,
        paramsSummary(strategy.strategyType, strategy.params), period.name, period.from, period.to,
        ...CSV_METRICS.map(({ key, pct }) => csvNumber(period.metrics[key], pct)),
      ]);
    }
  }
  return `﻿${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

/** Nom du fichier exporte, sans caractere interdit (EUR/USD -> EUR-USD). */
export const comparisonCsvName = (result: BacktestComparison) =>
  `comparaison-${result.symbol.replace(/[^\w.-]+/g, "-")}-${result.from}-${result.to}.csv`;
