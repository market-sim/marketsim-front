import type {
  BacktestComparison, BacktestComparisonRequest, BacktestMetrics, StrategyComparison,
} from "../../api/endpoints";
import { buildBacktestRequest, DEFAULT_BACKTEST_FORM, type BacktestErrors, type BacktestFormValues } from "./backtestForm";
import { DASH, money, num, pctPlain, pctSigned, ptsSigned } from "./format";

export type ComparisonFormValues = Omit<BacktestFormValues, "strategyId"> & { strategyIds: string[] };
export type RankingMetric = "sharpe" | "annualizedReturn" | "maxDrawdown";

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

export function buildComparisonRequest(values: ComparisonFormValues): {
  request: BacktestComparisonRequest | null;
  errors: ComparisonErrors;
} {
  const errors: ComparisonErrors = {};
  if (values.strategyIds.length < 2 || values.strategyIds.length > 5) {
    errors.strategyIds = "Choisissez entre 2 et 5 stratégies";
  } else if (new Set(values.strategyIds).size !== values.strategyIds.length) {
    errors.strategyIds = "Chaque stratégie ne peut être choisie qu'une fois";
  } else if (values.strategyIds.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
    errors.strategyIds = "Les stratégies sélectionnées ne sont pas valides";
  }

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

export const RANKING_OPTIONS: { value: RankingMetric; label: string }[] = [
  { value: "sharpe", label: "Ratio de Sharpe" },
  { value: "annualizedReturn", label: "Rendement annualisé" },
  { value: "maxDrawdown", label: "Drawdown maximum" },
];

export interface RankedStrategy {
  strategy: StrategyComparison;
  rank: number | null;
  score: number | null;
}

/** Un Sharpe, rendement ou drawdown plus élevé (moins negatif) est preferable. */
export function rankStrategies(strategies: StrategyComparison[], criterion: RankingMetric): RankedStrategy[] {
  const sorted = strategies
    .map((strategy, index) => ({ strategy, index, score: strategy.metrics[criterion] }))
    .sort((a, b) => {
      const aValid = a.score != null && Number.isFinite(a.score);
      const bValid = b.score != null && Number.isFinite(b.score);
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (!aValid || !bValid) return a.index - b.index;
      return b.score! - a.score! || a.index - b.index;
    });

  let rank = 0;
  let previous: number | null = null;
  return sorted.map(({ strategy, score }, index) => {
    if (score == null || !Number.isFinite(score)) return { strategy, rank: null, score: null };
    if (previous == null || Math.abs(score - previous) > 1e-10) rank = index + 1;
    previous = score;
    return { strategy, rank, score };
  });
}

export interface ComparisonMetricRow {
  key: ComparisonMetricKey;
  label: string;
  direction: "higher" | "lower";
  format: (value: number | null) => string;
}

export type ComparisonMetricKey =
  | "finalCapital" | "totalReturn" | "annualizedReturn" | "buyHoldReturn" | "excessReturn"
  | "volatility" | "sharpe" | "sortino" | "calmar" | "maxDrawdown" | "maxDrawdownDays" | "winRate" | "profitFactor";

export const COMPARISON_METRICS: ComparisonMetricRow[] = [
  { key: "finalCapital", label: "Capital final", direction: "higher", format: money },
  { key: "totalReturn", label: "Rendement total", direction: "higher", format: pctSigned },
  { key: "annualizedReturn", label: "Rendement annualisé", direction: "higher", format: pctSigned },
  { key: "buyHoldReturn", label: "Buy & hold", direction: "higher", format: pctSigned },
  { key: "excessReturn", label: "Écart au buy & hold", direction: "higher", format: ptsSigned },
  { key: "volatility", label: "Volatilité annualisée", direction: "lower", format: pctPlain },
  { key: "sharpe", label: "Ratio de Sharpe", direction: "higher", format: num },
  { key: "sortino", label: "Ratio de Sortino", direction: "higher", format: num },
  { key: "calmar", label: "Ratio de Calmar", direction: "higher", format: num },
  { key: "maxDrawdown", label: "Drawdown maximum", direction: "higher", format: pctSigned },
  { key: "maxDrawdownDays", label: "Durée du drawdown max", direction: "lower", format: (v) => v == null ? DASH : `${v} j` },
  { key: "winRate", label: "Trades gagnants", direction: "higher", format: (v) => pctPlain(v, 0) },
  { key: "profitFactor", label: "Profit factor", direction: "higher", format: num },
];

/** Indices des valeurs optimales de la ligne ; les valeurs absentes sont ignorees et les ex aequo gardes. */
export function bestMetricIndexes(values: (number | null)[], direction: "higher" | "lower"): number[] {
  const valid = values.map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } =>
      entry.value != null && Number.isFinite(entry.value));
  if (valid.length === 0) return [];
  const best = valid.reduce((chosen, entry) =>
    direction === "higher" ? Math.max(chosen, entry.value) : Math.min(chosen, entry.value), valid[0].value);
  return valid.filter(({ value }) => Math.abs(value - best) <= 1e-10).map(({ index }) => index);
}

const CSV_METRICS: { key: keyof BacktestMetrics; label: string }[] = [
  { key: "finalCapital", label: "Capital final" },
  { key: "totalReturn", label: "Rendement total" },
  { key: "annualizedReturn", label: "Rendement annualisé" },
  { key: "buyHoldReturn", label: "Buy & hold" },
  { key: "excessReturn", label: "Écart au buy & hold" },
  { key: "volatility", label: "Volatilité annualisée" },
  { key: "sharpe", label: "Sharpe" },
  { key: "sortino", label: "Sortino" },
  { key: "calmar", label: "Calmar" },
  { key: "maxDrawdown", label: "Drawdown maximum" },
  { key: "maxDrawdownDays", label: "Durée du drawdown max (jours)" },
  { key: "winRate", label: "Trades gagnants" },
  { key: "profitFactor", label: "Profit factor" },
  { key: "tradeCount", label: "Nombre de trades" },
  { key: "exposure", label: "Temps investi" },
];

const csvCell = (value: string | number | null) => {
  const text = value == null ? "" : typeof value === "number" ? String(value).replace(".", ",") : value;
  return `"${text.replace(/"/g, '""')}"`;
};

/** Exporte les tableaux de resultats, y compris les segments d'entrainement et de test s'ils existent. */
export function comparisonCsv(result: BacktestComparison): string {
  const rows: (string | number | null)[][] = [
    ["Actif", "Stratégie", "Type", "Période", "Du", "Au", ...CSV_METRICS.map((metric) => metric.label)],
  ];
  for (const strategy of result.strategies) {
    const periods = [
      { name: "Complète", from: result.from, to: result.to, metrics: strategy.metrics },
      ...(strategy.train ? [{ name: "Entraînement", from: strategy.train.from, to: strategy.train.to, metrics: strategy.train.metrics }] : []),
      ...(strategy.test ? [{ name: "Test", from: strategy.test.from, to: strategy.test.to, metrics: strategy.test.metrics }] : []),
    ];
    for (const period of periods) {
      rows.push([
        result.symbol, strategy.strategyName, strategy.strategyType, period.name, period.from, period.to,
        ...CSV_METRICS.map(({ key }) => period.metrics[key]),
      ]);
    }
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}
