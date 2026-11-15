import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CHART_MARGIN as MARGIN, useChartColors, useTimeAxis, Y_AXIS_WIDTH as Y_WIDTH, yTick } from "../chartTheme";
import { macdDigits, macdTick, num, price, priceTick } from "../format";
import { RSI_OVERBOUGHT, RSI_OVERSOLD } from "../signals";
import type { ChartRow, Periods, Visibility } from "../technical";
import ChartTooltip, { type TooltipSeries } from "./ChartTooltip";

/** Les trois graphiques partagent le meme identifiant : survoler l'un deplace le repere sur les autres. */
const SYNC = "analysis-technical";

/** Cours de cloture avec les moyennes mobiles et les bandes de Bollinger superposees. */
export function PriceChart({ rows, periods, show }: { rows: ChartRow[]; periods: Periods; show: Visibility }) {
  const c = useChartColors();
  const xAxis = useTimeAxis(rows, c);
  const series: TooltipSeries[] = [
    { key: "close", label: "Clôture", color: c.ink, format: price },
    ...(show.smaFast ? [{ key: "smaFast", label: `SMA ${periods.smaFast}`, color: c.blue, format: price }] : []),
    ...(show.smaSlow ? [{ key: "smaSlow", label: `SMA ${periods.smaSlow}`, color: c.amber, format: price }] : []),
    ...(show.ema ? [{ key: "ema", label: `EMA ${periods.ema}`, color: c.violet, format: price }] : []),
    ...(show.bollinger ? [
      { key: "bbUpper", label: "Bande haute", color: c.neutral, format: price },
      { key: "bbLower", label: "Bande basse", color: c.neutral, format: price },
    ] : []),
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} syncId={SYNC} margin={MARGIN}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis {...xAxis} />
        <YAxis width={Y_WIDTH} domain={["auto", "auto"]} tick={yTick(c)} tickLine={false} axisLine={false} tickFormatter={priceTick} />
        <Tooltip isAnimationActive={false} cursor={{ stroke: c.axis, strokeWidth: 1 }}
          content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload} series={series} />} />
        {show.bollinger && (
          <>
            <Area dataKey="band" stroke="none" fill={c.neutral} fillOpacity={0.12} isAnimationActive={false} activeDot={false} tooltipType="none" legendType="none" />
            <Line dataKey="bbUpper" stroke={c.neutral} strokeWidth={1} dot={false} activeDot={false} isAnimationActive={false} />
            <Line dataKey="bbLower" stroke={c.neutral} strokeWidth={1} dot={false} activeDot={false} isAnimationActive={false} />
            <Line dataKey="bbMiddle" stroke={c.neutral} strokeWidth={1} strokeDasharray="4 3" dot={false} activeDot={false} isAnimationActive={false} tooltipType="none" />
          </>
        )}
        {show.smaSlow && <Line dataKey="smaSlow" stroke={c.amber} strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />}
        {show.smaFast && <Line dataKey="smaFast" stroke={c.blue} strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />}
        {show.ema && <Line dataKey="ema" stroke={c.violet} strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />}
        <Line dataKey="close" stroke={c.ink} strokeWidth={2} dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** RSI entre 0 et 100, avec les seuils de survente (30) et de surachat (70). */
export function RsiChart({ rows, periods }: { rows: ChartRow[]; periods: Periods }) {
  const c = useChartColors();
  const xAxis = useTimeAxis(rows, c);
  const series: TooltipSeries[] = [{ key: "rsi", label: `RSI ${periods.rsi}`, color: c.ink, format: (v) => num(v, 1) }];
  // etiquettes placees a l'exterieur de la zone 30-70, la ou la courbe passe le moins souvent
  const threshold = { fontSize: 10, fill: c.axis };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} syncId={SYNC} margin={MARGIN}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis {...xAxis} />
        <YAxis width={Y_WIDTH} domain={[0, 100]} ticks={[0, RSI_OVERSOLD, 50, RSI_OVERBOUGHT, 100]} tick={yTick(c)} tickLine={false} axisLine={false} />
        <Tooltip isAnimationActive={false} cursor={{ stroke: c.axis, strokeWidth: 1 }}
          content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload} series={series} />} />
        <ReferenceLine y={RSI_OVERBOUGHT} stroke={c.down} strokeDasharray="4 4" label={{ ...threshold, position: "insideBottomRight", value: "Surachat" }} />
        <ReferenceLine y={RSI_OVERSOLD} stroke={c.up} strokeDasharray="4 4" label={{ ...threshold, position: "insideTopRight", value: "Survente" }} />
        <Line dataKey="rsi" stroke={c.ink} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** MACD, sa ligne de signal, et leur ecart en histogramme (vert au-dessus de zero, rouge en dessous). */
export function MacdChart({ rows }: { rows: ChartRow[] }) {
  const c = useChartColors();
  const xAxis = useTimeAxis(rows, c);
  const digits = macdDigits(rows[rows.length - 1]?.close);
  const fmt = (v: number) => num(v, digits);
  const series: TooltipSeries[] = [
    { key: "macd", label: "MACD", color: c.blue, format: fmt },
    { key: "macdSignal", label: "Signal", color: c.amber, format: fmt },
    { key: "macdHist", label: "Histogramme", color: c.neutral, format: fmt },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} syncId={SYNC} margin={MARGIN}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis {...xAxis} />
        <YAxis width={Y_WIDTH} domain={["auto", "auto"]} tick={yTick(c)} tickLine={false} axisLine={false} tickFormatter={macdTick} />
        <Tooltip isAnimationActive={false} cursor={{ stroke: c.axis, strokeWidth: 1 }}
          content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload} series={series} />} />
        <ReferenceLine y={0} stroke={c.axis} strokeWidth={1} />
        <Bar dataKey="macdHist" isAnimationActive={false}>
          {rows.map((r) => <Cell key={r.date} fill={(r.macdHist ?? 0) >= 0 ? c.up : c.down} fillOpacity={0.5} />)}
        </Bar>
        <Line dataKey="macdSignal" stroke={c.amber} strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
        <Line dataKey="macd" stroke={c.blue} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
