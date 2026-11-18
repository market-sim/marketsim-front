import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BacktestComparison } from "../../../api/endpoints";
import { CardShell, DISPLAY } from "../../../shared/ui";
import { CHART_MARGIN, SERIES_DASH, useChartColors, useSeriesColors, useTimeAxis, Y_AXIS_WIDTH, yTick } from "../chartTheme";
import { money, moneyCompact, pctSigned } from "../format";
import { drawdownAxis } from "./BacktestCharts";
import ChartTooltip, { type TooltipSeries } from "./ChartTooltip";

/** Les deux graphiques partagent le meme identifiant : survoler l'un deplace le repere sur l'autre. */
const SYNC = "analysis-comparison";
const BUY_HOLD = "buyHold";

/** Une ligne par seance : `s<id>` = capital, `dd-s<id>` = drawdown de la strategie <id>. */
type Row = { date: string } & Record<string, string | number>;

/** Petit trait de legende : couleur et trait (plein, tirets, pointilles) de la courbe. */
export function SeriesSwatch({ color, dash }: { color: string; dash?: string }) {
  return (
    <svg width="18" height="6" viewBox="0 0 18 6" aria-hidden="true" className="shrink-0">
      <line x1="1" y1="3" x2="17" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={dash} />
    </svg>
  );
}

/**
 * Courbes superposees de capital (avec le buy & hold) et de drawdown. La legende est commune aux deux graphiques :
 * cliquer sur un nom masque ou affiche sa courbe dans les deux.
 */
export default function ComparisonCharts({ result }: { result: BacktestComparison }) {
  const c = useChartColors();
  const palette = useSeriesColors();
  /** cles des courbes masquees ; un nouveau resultat les reaffiche toutes */
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  useEffect(() => setHidden(new Set()), [result]);
  const toggle = (key: string) => setHidden((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  // la couleur suit la strategie (son rang dans la reponse), jamais son classement
  const series = result.strategies.map((s, i) => ({
    key: `s${s.strategyId}`, label: s.strategyName, color: palette[i], dash: SERIES_DASH[i],
  }));
  const shown = series.filter((s) => !hidden.has(s.key));

  /** une ligne par seance : capital et drawdown de chaque strategie, buy & hold */
  const rows = useMemo(() => result.dates.map((date, i) => {
    const row: Row = { date, [BUY_HOLD]: result.buyHold[i] };
    for (const s of result.strategies) {
      row[`s${s.strategyId}`] = s.curves.equity[i];
      row[`dd-s${s.strategyId}`] = s.curves.drawdown[i];
    }
    return row;
  }), [result]);
  const xAxis = useTimeAxis(rows, c);
  /** premiere seance de test : la date de coupure peut tomber un jour sans cotation */
  const splitAt = result.splitDate ? result.dates.find((d) => d >= result.splitDate!) : undefined;

  // l'axe du drawdown s'adapte aux courbes affichees
  const worst = result.strategies
    .filter((s) => !hidden.has(`s${s.strategyId}`))
    .reduce((min, s) => Math.min(min, ...s.curves.drawdown), 0);
  const { floor, ticks } = drawdownAxis(worst);

  const equityTooltip: TooltipSeries[] = [
    ...shown.map((s) => ({ key: s.key, label: s.label, color: s.color, format: money })),
    { key: BUY_HOLD, label: "Buy & hold", color: c.neutral, format: money },
  ];
  const drawdownTooltip: TooltipSeries[] = shown.map((s) => ({
    key: `dd-${s.key}`, label: s.label, color: s.color, format: (v: number) => pctSigned(v),
  }));

  const legendButton = (key: string, label: string, color: string, dash?: string) => {
    const on = !hidden.has(key);
    return (
      <button key={key} type="button" aria-pressed={on} onClick={() => toggle(key)}
        title={`${on ? "Masquer" : "Afficher"} la courbe « ${label} »`}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] transition-colors hover:bg-muted/40 ${on ? "text-foreground" : "text-muted-foreground line-through opacity-60"}`}>
        <SeriesSwatch color={color} dash={dash} />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <CardShell className="p-5">
      <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Capital : stratégies et buy &amp; hold</h3>
      <div role="group" aria-label="Afficher ou masquer les courbes" className="flex flex-wrap gap-x-1 gap-y-0.5 mt-1.5 mb-2 -ml-2">
        {series.map((s) => legendButton(s.key, s.label, s.color, s.dash))}
        {legendButton(BUY_HOLD, "Buy & hold", c.neutral)}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId={SYNC} margin={CHART_MARGIN}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis {...xAxis} />
            <YAxis width={Y_AXIS_WIDTH} domain={["auto", "auto"]} tick={yTick(c)} tickLine={false} axisLine={false} tickFormatter={moneyCompact} />
            <Tooltip isAnimationActive={false} cursor={{ stroke: c.axis, strokeWidth: 1 }}
              content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload} series={equityTooltip} />} />
            {splitAt && (
              <ReferenceLine x={splitAt} stroke={c.axis} strokeDasharray="4 4"
                label={{ value: "Début du test", position: "insideTopLeft", fontSize: 10, fill: c.axis }} />
            )}
            {!hidden.has(BUY_HOLD) && (
              <Line dataKey={BUY_HOLD} stroke={c.neutral} strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            )}
            {shown.map((s) => (
              <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={2} strokeDasharray={s.dash}
                dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <h4 className="text-[12px] font-semibold text-foreground mt-4 pt-3 border-t border-border/60 mb-1" style={DISPLAY}>Drawdown des stratégies</h4>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId={SYNC} margin={CHART_MARGIN}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis {...xAxis} />
            <YAxis width={Y_AXIS_WIDTH} domain={[floor, 0]} ticks={ticks} tick={yTick(c)} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => `${Math.round(v * 100)} %`} />
            <Tooltip isAnimationActive={false} cursor={{ stroke: c.axis, strokeWidth: 1 }}
              content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload} series={drawdownTooltip} />} />
            {splitAt && <ReferenceLine x={splitAt} stroke={c.axis} strokeDasharray="4 4" />}
            {shown.map((s) => (
              <Line key={s.key} dataKey={`dd-${s.key}`} stroke={s.color} strokeWidth={1.6} strokeDasharray={s.dash}
                dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}
