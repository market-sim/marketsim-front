import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { BacktestComparison, BacktestMetrics, StrategyComparison } from "../../../api/endpoints";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../app/components/ui/select";
import { SERIES_DASH, useSeriesColors } from "../chartTheme";
import {
  bestMetricIndexes, COMPARISON_METRICS, comparisonCsv, comparisonCsvName, RANKING_OPTIONS, rankStrategies,
  type RankingMetric,
} from "../comparison";
import { DASH, money, num, pctPlain, pctSigned, shortHash } from "../format";
import { paramsSummary, typeShort } from "../strategyRules";
import ComparisonCharts, { SeriesSwatch } from "./ComparisonCharts";
import { FIELD_DARK, OUTLINE_DARK } from "./Feedback";

const sourceLabel = (source: string) => (source === "YAHOO" ? "Yahoo Finance" : source === "CSV" ? "CSV importé" : source);

/** Telecharge le tableau des metriques en CSV (fichier genere dans le navigateur, rien n'est envoye au back). */
function downloadCsv(result: BacktestComparison) {
  const url = URL.createObjectURL(new Blob([comparisonCsv(result)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = comparisonCsvName(result);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Tableau des metriques cote a cote : une colonne par strategie, la meilleure valeur de chaque ligne surlignee. */
function MetricsTable({ result, title, subtitle, getMetrics }: {
  result: BacktestComparison;
  title: string;
  subtitle?: string;
  getMetrics: (strategy: StrategyComparison) => BacktestMetrics | null;
}) {
  const palette = useSeriesColors();
  const metrics = result.strategies.map(getMetrics);
  return (
    <CardShell className="overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5" style={MONO}>{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12px]">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
              {/* colonne figee : le nom de la metrique reste visible quand on fait defiler le tableau (petits ecrans) */}
              <th className="sticky left-0 z-10 bg-card bg-linear-to-r from-muted/20 to-muted/20 text-left px-4 py-3">Métrique</th>
              {result.strategies.map((s, i) => (
                <th key={s.strategyId} className="min-w-[128px] px-3 py-3 text-right align-top font-medium">
                  <span className="inline-flex max-w-[180px] items-center justify-end gap-1.5 text-foreground normal-case tracking-normal">
                    <SeriesSwatch color={palette[i]} dash={SERIES_DASH[i]} />
                    <span className="truncate" title={s.strategyName}>{s.strategyName}</span>
                  </span>
                  <span className="block mt-1 font-normal normal-case tracking-normal">{typeShort[s.strategyType]}</span>
                  <span className="block mt-0.5 font-normal normal-case tracking-normal" style={MONO}>
                    {metrics[i] ? `${metrics[i]!.tradeCount} trades · ${pctPlain(metrics[i]!.exposure, 0)} investi` : DASH}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {COMPARISON_METRICS.map((row) => {
              const values = metrics.map((m) => m?.[row.key] ?? null);
              const best = new Set(bestMetricIndexes(values, row.direction, row.format));
              return (
                <tr key={row.key}>
                  <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-normal text-muted-foreground whitespace-nowrap">
                    {row.label}
                  </th>
                  {values.map((value, i) => (
                    <td key={result.strategies[i].strategyId} style={MONO}
                      className={`px-3 py-2.5 text-right whitespace-nowrap ${best.has(i)
                        ? "bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : row.direction == null ? "text-muted-foreground" : "text-foreground"}`}>
                      {row.format(value)}
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

/** Resultat d'une comparaison : courbes superposees, classement, tableaux de metriques et export CSV. */
export default function ComparisonResult({ result }: { result: BacktestComparison }) {
  const palette = useSeriesColors();
  const [criterion, setCriterion] = useState<RankingMetric>("sharpe");
  const ranking = useMemo(() => rankStrategies(result.strategies, criterion), [result.strategies, criterion]);
  const s = result.settings;
  const first = result.strategies[0];
  const scoreText = (score: number | null) => (criterion === "sharpe" ? num(score) : pctSigned(score));

  return (
    <div className="space-y-4">
      {/* ── En-tete ── */}
      <CardShell className="p-5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>
              Comparaison de {result.strategies.length} stratégies · {result.symbol}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1" style={MONO}>
              {result.from} → {result.to} · {result.dates.length} séances
              {result.splitDate ? ` · coupure ${result.splitDate}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Capital {money(s.initialCapital)} · frais {pctPlain(s.feeRate, 2)} · glissement {pctPlain(s.slippage, 2)}
              {" · "}stop-loss {s.stopLoss == null ? "aucun" : pctPlain(s.stopLoss)} · take-profit {s.takeProfit == null ? "aucun" : pctPlain(s.takeProfit)}
              {" · "}part engagée {pctPlain(s.positionFraction, 0)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Données {sourceLabel(result.dataSource)} · empreinte <span style={MONO}>{shortHash(result.dataHash)}</span> · calculée à la demande, non enregistrée dans l'historique.
            </p>
          </div>
          <Button variant="outline" size="sm" className={`ml-auto ${OUTLINE_DARK}`} onClick={() => downloadCsv(result)}>
            <Download />Exporter en CSV
          </Button>
        </div>
      </CardShell>

      {/* ── Courbes ── */}
      <ComparisonCharts result={result} />

      {/* ── Classement ── */}
      <CardShell className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Classement</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {criterion === "maxDrawdown"
                ? "Le drawdown le plus proche de zéro est le meilleur."
                : "La valeur la plus élevée est la meilleure."} Une métrique non calculable est classée en dernier.
            </p>
          </div>
          <div className="w-full sm:w-60">
            <Select value={criterion} onValueChange={(v) => setCriterion(v as RankingMetric)}>
              <SelectTrigger className={FIELD_DARK} aria-label="Critère de classement"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANKING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ranking.map(({ strategy, index, rank, score }) => (
            <li key={strategy.strategyId}
              className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 ${rank === 1 ? "border-blue-200 bg-blue-50/60" : "border-border/60"}`}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-foreground" style={MONO}
                aria-label={rank == null ? "Non classée" : `Rang ${rank}`}>
                {rank ?? DASH}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 min-w-0">
                  <SeriesSwatch color={palette[index]} dash={SERIES_DASH[index]} />
                  {/* deux lignes au plus : sur un telephone, un nom tronque apres quelques lettres ne se lit pas */}
                  <span className="line-clamp-2 wrap-anywhere text-[13px] font-medium leading-snug text-foreground" title={strategy.strategyName}>{strategy.strategyName}</span>
                </span>
                <span className="block text-[11px] text-muted-foreground truncate" style={MONO}>{paramsSummary(strategy.strategyType, strategy.params)}</span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-foreground" style={MONO}>{scoreText(score)}</span>
            </li>
          ))}
        </ol>
      </CardShell>

      {/* ── Metriques ── */}
      <MetricsTable result={result} title="Métriques sur la période complète"
        subtitle={`${result.from} → ${result.to} · meilleure valeur de chaque ligne surlignée (ex æquo compris)`}
        getMetrics={(strategy) => strategy.metrics} />
      {first?.train && first.test && (
        <>
          <MetricsTable result={result} title="Entraînement (avant la coupure)" subtitle={`${first.train.from} → ${first.train.to}`}
            getMetrics={(strategy) => strategy.train?.metrics ?? null} />
          <MetricsTable result={result} title="Test (à partir de la coupure)" subtitle={`${first.test.from} → ${first.test.to}`}
            getMetrics={(strategy) => strategy.test?.metrics ?? null} />
        </>
      )}

      <CardShell className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2" style={DISPLAY}>Comment lire cette comparaison</h3>
        <ul className="space-y-1.5 text-[12px] text-muted-foreground list-disc pl-4">
          <li>Chaque stratégie est rejouée par le même moteur que l'onglet Backtest, sur les mêmes cours et avec les mêmes réglages.</li>
          <li>Le buy &amp; hold de référence investit tout le capital à la première clôture, sans frais : il est identique pour toutes les stratégies.</li>
          {result.splitDate && (
            <li>Entraînement et test sont rejoués séparément, depuis le capital initial. Une stratégie en tête sur l'entraînement mais pas sur le test est probablement sur-ajustée.</li>
          )}
          <li>Une ligne où toutes les valeurs sont égales n'est pas surlignée. Les 4e et 5e courbes sont en tirets et en pointillés pour rester lisibles sans les couleurs.</li>
          <li>Biais du survivant : on ne teste que des actifs qui existent encore aujourd'hui.</li>
        </ul>
      </CardShell>
    </div>
  );
}
