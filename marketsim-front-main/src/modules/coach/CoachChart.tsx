import { useMemo } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CoachAnalysis } from "../../api/endpoints";

export const fmtPx = (v: number) =>
  v < 10 ? v.toFixed(4) : v < 1000 ? v.toFixed(2) : Math.round(v).toLocaleString("fr-FR");

const axis = { fontSize: 9, fill: "#64748B" };

/** Courbe reelle des 140 derniers jours avec les niveaux que le coach commente (support, resistance, stop, objectif). */
export default function CoachChart({ a }: { a: CoachAnalysis }) {
  const data = useMemo(() => a.chart.map((p) => ({ t: Date.parse(p.date), close: p.close, sma20: p.sma20, sma50: p.sma50 })), [a.chart]);
  const l = a.levels;
  const showEntry = a.action === "BUY";
  const lines = [
    { y: l.support, color: "#34D399", label: "support", dash: "4 3" },
    ...(l.resistance != null ? [{ y: l.resistance, color: "#F87171", label: "résistance", dash: "4 3" }] : []),
    ...(showEntry ? [{ y: l.stop, color: "#FB923C", label: "stop", dash: "2 2" }, { y: l.target, color: "#4ADE80", label: "objectif", dash: "2 2" }] : []),
  ];
  const values = [...data.map((d) => d.close), ...lines.map((x) => x.y)];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.06;

  return (
    <div className="h-44 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={axis} tickLine={false} axisLine={false}
            tickFormatter={(t) => new Date(t).toLocaleDateString("fr-FR", { month: "short" })} minTickGap={28} />
          <YAxis domain={[lo - pad, hi + pad]} tick={axis} tickLine={false} axisLine={false} width={44} tickFormatter={fmtPx} />
          <Tooltip contentStyle={{ background: "#0A1530", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 11, color: "#E2E8F0" }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleDateString("fr-FR")}
            formatter={(v, n) => [fmtPx(Number(v)), n === "close" ? "Cours" : n === "sma20" ? "MM 20 j" : "MM 50 j"]} />
          {lines.map((x) => (
            <ReferenceLine key={x.label} y={x.y} stroke={x.color} strokeDasharray={x.dash}
              label={{ value: `${x.label} ${fmtPx(x.y)}`, fill: x.color, fontSize: 9, position: "insideTopLeft" }} />
          ))}
          <Line type="monotone" dataKey="sma50" stroke="#A78BFA" strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="sma20" stroke="#FBBF24" strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="close" stroke="#E2E8F0" strokeWidth={1.8} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
