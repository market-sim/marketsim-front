import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { BacktestComparison, BacktestMetrics } from "../../../api/endpoints";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../app/components/ui/select";
import { useChartColors } from "../chartTheme";
import {
  bestMetricIndexes, COMPARISON_METRICS, comparisonCsv, RANKING_OPTIONS, rankStrategies,
  type RankingMetric,
} from "../comparison";
import { DASH, num, pctPlain, pctSigned, ptsSigned, shortHash } from "../format";
import { paramsSummary, typeShort } from "../strategyRules";
import ComparisonCharts from "./ComparisonCharts";
import { FIELD_DARK } from "./Feedback";

const SERIES_COLORS = ["blue", "amber", "violet", "up", "down"] as const;

function segmentMetrics(strategy: BacktestComparison["strategies"][number], part: "train" | "test"): BacktestMetrics | null {
  return strategy[part]?.metrics ?? null;
}

function scoreText(score: number | null, metric: RankingMetric): string {
  if (score == null || !Number.isFinite(score)) return DASH;
  return metric === "sharpe" ? num(score) : pctSigned(score);
}

function downloadCsv(result: BacktestComparison) {
  const blob = new Blob([comparisonCsv(result)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const symbol = result.symbol.replace(/[^\w.-]+/g, "-");
  link.download = `comparaison-${symbol}-${result.from}-${result.to}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function MetricsTable({ result, title, getMetrics }: {
  result: BacktestComparison;
  title: string;
  getMetrics: (strategy: BacktestComparison["strategies"][number]) => BacktestMetrics | null;
}) {
  const metrics = result.strategies.map(getMetrics);
  const c = useChartColors();
  return (
    <CardShell className="overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>{title}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          La meilleure valeur de chaque ligne est mise en évidence ; les ex æquo sont tous signalés.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12px]">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
              <th className="sticky left-0 z-10 bg-card text-left px-4 py-3">Métrique</th>
              {result.strategies.map((strategy, index) => (
                <th key={strategy.strategyId} className="min-w-[136px] px-3 py-3 text-right align-top">
                  <span className="inline-flex max-w-full items-center justify-end gap-1.5 text-foreground normal-case tracking-normal">
                    <span className="size-2 rounded-full shrink-0" style={{ background: c[SERIES_COLORS[index]] }} />
                    <span className="truncate" title={strategy.strategyName}>{strategy.strategyName}</span>
                  </span>
                  <span className="block mt-1 text-[10px] font-normal normal-case tracking-normal">{typeShort[strategy.strategyType]}</span>
                  <span className="block mt-0.5 text-[10px] font-normal normal-case tracking-normal">
                    {strategy.metrics.tradeCount} trades · {pctPlain(strategy.metrics.exposure, 0)} investi
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {COMPARISON_METRICS.map((metric) => {
              const values = metrics.map((item) => item?.[metric.key] ?? null);
              const best = new Set(bestMetricIndexes(values, metric.direction));
              return (
                <tr key={metric.key} className="hover:bg-muted/10 transition-colors">
                  <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-medium text-muted-foreground">
                    {metric.label}
                  </th>
                  {values.map((value, index) => (
                    <td key={result.strategies[index].strategyId}
                      className={`px-3 py-2.5 text-right whitespace-nowrap ${best.has(index)
                        ? "bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "text-foreground"}`} style={MONO}>
                      {metric.format(typeof value === "number" ? value : null)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

/** Resultats de la comparaison : courbes, classement et tableaux de metriques exportables. */
export default function ComparisonResult({ result }: { result: BacktestComparison }) {
  const [criterion, setCriterion] = useState<RankingMetric>("sharpe");
  const [visible, setVisible] = useState<Record<number | "buyHold", boolean>>(() => ({
    buyHold: true,
    ...Object.fromEntries(result.strategies.map((strategy) => [strategy.strategyId, true])),
  }));
  useEffect(() => {
    setVisible({
      buyHold: true,
      ...Object.fromEntries(result.strategies.map((strategy) => [strategy.strategyId, true])),
    });
  }, [result]);
  const ranking = useMemo(() => rankStrategies(result.strategies, criterion), [result.strategies, criterion]);
  const sourceLabel = result.dataSource === "YAHOO" ? "Yahoo Finance" : result.dataSource === "CSV" ? "CSV importé" : result.dataSource;

  const toggle = (id: number | "buyHold") => setVisible((current) => ({ ...current, [id]: !current[id] }));

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground" style={DISPLAY}>Comparaison · {result.symbol}</h2>
            <p className="mt-1 text-[11px] text-muted-foreground" style={MONO}>
              {result.from} → {result.to} · {result.dates.length} séances
              {result.splitDate ? ` · coupure ${result.splitDate}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Historique : {sourceLabel} · empreinte {shortHash(result.dataHash)} · résultat calculé à la demande, non enregistré.
            </p>
          </div>
          <Button variant="outline" size="sm" className="dark:border-border" onClick={() => downloadCsv(result)}>
            <Download />Exporter les métriques CSV
          </Button>
        </div>
      </CardShell>

      <ComparisonCharts result={result} visible={visible} onToggle={toggle} />

      <CardShell className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Classement</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Le drawdown le plus proche de zéro est préférable ; les métriques non calculables sont classées en dernier.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Select value={criterion} onValueChange={(value) => setCriterion(value as RankingMetric)}>
              <SelectTrigger className={FIELD_DARK} aria-label="Critère de classement"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANKING_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ranking.map(({ strategy, rank, score }) => (
            <li key={strategy.strategyId} className="flex min-w-0 items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-foreground" style={MONO}>
                {rank ?? "—"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground" title={strategy.strategyName}>{strategy.strategyName}</span>
                <span className="block text-[10px] text-muted-foreground">{typeShort[strategy.strategyType]}</span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold text-foreground" style={MONO}>{scoreText(score, criterion)}</span>
            </li>
          ))}
        </ol>
      </CardShell>

      <MetricsTable result={result} title="Période complète" getMetrics={(strategy) => strategy.metrics} />
      {result.splitDate && (
        <>
          <MetricsTable result={result} title="Entraînement" getMetrics={(strategy) => segmentMetrics(strategy, "train")} />
          <MetricsTable result={result} title="Test" getMetrics={(strategy) => segmentMetrics(strategy, "test")} />
        </>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Les mêmes cours, dates et réglages sont appliqués à chaque stratégie. Le buy &amp; hold investit à la première clôture, sans frais.
        La comparaison ne choisit pas de paramètres et ne constitue pas un conseil d’investissement.
      </p>
    </div>
  );
}
