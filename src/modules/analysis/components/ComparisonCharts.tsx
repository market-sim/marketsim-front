import { useMemo } from "react";
import {
  CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { BacktestComparison } from "../../../api/endpoints";
import { CardShell, DISPLAY } from "../../../shared/ui";
import { CHART_MARGIN, useChartColors, useTimeAxis, Y_AXIS_WIDTH, yTick } from "../chartTheme";
import { money, moneyCompact, pctSigned } from "../format";
import ChartTooltip, { type TooltipSeries } from "./ChartTooltip";

const SERIES_COLORS = ["blue", "amber", "violet", "up", "down"] as const;
const SYNC = "analysis-comparison";

interface Props {
  result: BacktestComparison;
  visible: Record<number | "buyHold", boolean>;
  onToggle: (id: number | "buyHold") => void;
}

type ComparisonRow = Record<string, string | number> & { date: string };

/** Courbes superposees de capital et de drawdown, avec une legende accessible pour chaque serie. */
export default function ComparisonCharts({ result, visible, onToggle }: Props) {
  const c = useChartColors();
  const series = useMemo(() => result.strategies.map((strategy, index) => ({
    id: strategy.strategyId,
    key: String(strategy.strategyId),
    label: strategy.strategyName,
    color: c[SERIES_COLORS[index]],
  })), [result.strategies, c]);
  const rows = useMemo(() => result.dates.map((date, index) => {
    const row: ComparisonRow = { date, buyHold: result.buyHold[index] };
    for (const strategy of result.strategies) {
      row[String(strategy.strategyId)] = strategy.curves.equity[index];
      row[`dd-${strategy.strategyId}`] = strategy.curves.drawdown[index];
    }
    return row;
  }), [result]);
  const xAxis = useTimeAxis(rows, c);
  const equityLines: TooltipSeries[] = [
    { key: "buyHold", label: "Buy & hold", color: c.neutral, format: money },
    ...series.map((item) => ({ key: item.key, label: item.label, color: item.color, format: money })),
  ];
  const drawdownLines: TooltipSeries[] = series.map((item) => ({
    key: `dd-${item.id}`, label: item.label, color: item.color, format: (value) => pctSigned(value),
  }));
  const worstDrawdown = rows.reduce((worst, row) =>
    Math.min(worst, ...series.map((item) => Number(row[`dd-${item.id}`]))), 0);
  const floor = Math.min(-0.05, Math.floor(worstDrawdown * 20) / 20);

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2" style={DISPLAY}>Capital : stratégies et buy &amp; hold</h3>
        <div className="flex flex-wrap gap-x-2 gap-y-1 mb-2" aria-label="Afficher ou masquer les courbes">
          <button type="button" aria-pressed={visible.buyHold} onClick={() => onToggle("buyHold")}
            className={`inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] transition-opacity ${visible.buyHold ? "text-foreground" : "text-muted-foreground opacity-50"}`}>
            <span className="w-3.5 h-0.5 rounded-full" style={{ background: c.neutral }} />Buy &amp; hold
          </button>
          {series.map((item) => (
            <button key={item.id} type="button" aria-pressed={visible[item.id]} onClick={() => onToggle(item.id)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded px-1.5 py-1 text-[11px] transition-opacity ${visible[item.id] ? "text-foreground" : "text-muted-foreground opacity-50"}`}>
              <span className="w-3.5 h-0.5 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} syncId={SYNC} margin={CHART_MARGIN}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis {...xAxis} />
              <YAxis width={Y_AXIS_WIDTH} domain={["auto", "auto"]} tick={yTick(c)} tickLine={false}
                axisLine={false} tickFormatter={moneyCompact} />
              <Tooltip isAnimationActive={false} cursor={{ stroke: c.axis, strokeWidth: 1 }}
                content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload} series={equityLines} />} />
              {visible.buyHold && <Line dataKey="buyHold" name="Buy & hold" stroke={c.neutral} strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />}
              {series.map((item) => visible[item.id] && (
                <Line key={item.id} dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={2}
                  dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardShell>

      <CardShell className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2" style={DISPLAY}>Drawdown : stratégies</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} syncId={SYNC} margin={CHART_MARGIN}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis {...xAxis} />
              <YAxis width={Y_AXIS_WIDTH} domain={[floor, 0]} tick={yTick(c)} tickLine={false}
                axisLine={false} tickFormatter={(value: number) => `${Math.round(value * 100)} %`} />
              <Tooltip isAnimationActive={false} cursor={{ stroke: c.axis, strokeWidth: 1 }}
                content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload} series={drawdownLines} />} />
              {series.map((item) => visible[item.id] && (
                <Line key={item.id} dataKey={`dd-${item.id}`} name={item.label} stroke={item.color} strokeWidth={1.8}
                  dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardShell>
    </div>
  );
}
