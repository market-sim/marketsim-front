import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_MARGIN, useChartColors, useTimeAxis, Y_AXIS_WIDTH, yTick } from "../chartTheme";
import { money, moneyCompact, pctSigned } from "../format";
import ChartTooltip, { type TooltipSeries } from "./ChartTooltip";

/** Les deux graphiques partagent le meme identifiant : survoler l'un deplace le repere sur l'autre. */
const SYNC = "analysis-backtest";

/** Une ligne par seance du backtest. */
export interface CurveRow {
  date: string;
  equity: number;
  buyHold: number;
  drawdown: number;
}

interface Props {
  rows: CurveRow[];
  /** premiere seance de la periode de test, si une date de coupure a ete fournie */
  splitAt?: string;
}

/** Capital de la strategie compare au buy & hold sur la meme periode. */
export function EquityChart({ rows, splitAt }: Props) {
  const c = useChartColors();
  const xAxis = useTimeAxis(rows, c);
  const series: TooltipSeries[] = [
    { key: "equity", label: "Stratégie", color: c.blue, format: money },
    { key: "buyHold", label: "Buy & hold", color: c.neutral, format: money },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} syncId={SYNC} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis {...xAxis} />
        <YAxis width={Y_AXIS_WIDTH} domain={["auto", "auto"]} tick={yTick(c)} tickLine={false} axisLine={false} tickFormatter={moneyCompact} />
        <Tooltip isAnimationActive={false} cursor={{ stroke: c.axis, strokeWidth: 1 }}
          content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload} series={series} />} />
        {splitAt && (
          <ReferenceLine x={splitAt} stroke={c.axis} strokeDasharray="4 4"
            label={{ value: "Début du test", position: "insideTopLeft", fontSize: 10, fill: c.axis }} />
        )}
        <Line dataKey="buyHold" stroke={c.neutral} strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
        <Line dataKey="equity" stroke={c.blue} strokeWidth={2} dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Graduations rondes de l'axe du drawdown (0 %, -10 %, -20 %...) : le pas (1, 2, 5, 10, 20 ou 25 points)
 * est le plus petit qui couvre le pire drawdown (ex. -0.244) en quatre graduations au plus.
 * Aussi utilise par l'onglet Comparaison.
 */
export function drawdownAxis(worst: number): { floor: number; ticks: number[] } {
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25].find((s) => -worst / s <= 4) ?? 0.25;
  const count = Math.max(1, Math.ceil(-worst / step - 1e-9));
  const ticks = Array.from({ length: count + 1 }, (_, i) => -Number((i * step).toFixed(2)));
  return { floor: ticks[count], ticks };
}

/** Drawdown de la strategie : distance (en %) entre le capital et son plus haut precedent. */
export function DrawdownChart({ rows, splitAt }: Props) {
  const c = useChartColors();
  const xAxis = useTimeAxis(rows, c);
  const { floor, ticks } = drawdownAxis(rows.reduce((min, r) => Math.min(min, r.drawdown), 0));
  const series: TooltipSeries[] = [{ key: "drawdown", label: "Drawdown", color: c.down, format: (v) => pctSigned(v) }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} syncId={SYNC} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis {...xAxis} />
        <YAxis width={Y_AXIS_WIDTH} domain={[floor, 0]} ticks={ticks} tick={yTick(c)} tickLine={false} axisLine={false}
          tickFormatter={(v: number) => `${Math.round(v * 100)} %`} />
        <Tooltip isAnimationActive={false} cursor={{ stroke: c.axis, strokeWidth: 1 }}
          content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload} series={series} />} />
        {splitAt && <ReferenceLine x={splitAt} stroke={c.axis} strokeDasharray="4 4" />}
        <Area dataKey="drawdown" stroke={c.down} strokeWidth={1.5} fill={c.down} fillOpacity={0.12} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
