import type { AgentAction } from "../../../api/endpoints";

const ACTION_COLOR: Record<AgentAction, string> = { BUY: "#059669", SELL: "#DC2626", HOLD: "#D97706" };

/** Cadran semi-circulaire : confiance de l'agent dans sa decision (0 a 100 %). */
export default function ConfidenceGauge({ value, action, label = "Confiance", size = 180 }: {
  value: number; action?: AgentAction | null; label?: string; size?: number;
}) {
  const v = Math.max(0, Math.min(1, value));
  const r = 70;
  const cx = 90;
  const cy = 86;
  const point = (t: number) => {
    const angle = Math.PI * (1 - t);
    return [cx + r * Math.cos(angle), cy - r * Math.sin(angle)];
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const color = action ? ACTION_COLOR[action] : v >= 0.75 ? "#059669" : v >= 0.55 ? "#D97706" : "#94A3B8";
  const [nx, ny] = point(v);
  const level = v >= 0.8 ? "Très sûr" : v >= 0.65 ? "Confiant" : v >= 0.5 ? "Hésitant" : "Incertain";

  return (
    <svg viewBox="0 0 180 112" width={size} height={(size * 112) / 180} className="block">
      <path d={arc(0, 1)} stroke="var(--muted)" strokeWidth={14} fill="none" strokeLinecap="round" />
      {v > 0.005 && <path d={arc(0, v)} stroke={color} strokeWidth={14} fill="none" strokeLinecap="round" style={{ transition: "all .3s" }} />}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--foreground)" strokeWidth={2.5} strokeLinecap="round" style={{ transition: "all .3s" }} />
      <circle cx={cx} cy={cy} r={5} fill="var(--foreground)" />
      <text x={cx} y={cy - 22} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--foreground)" fontFamily="JetBrains Mono, monospace">
        {Math.round(v * 100)}%
      </text>
      <text x={cx} y={108} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{label} · {level}</text>
    </svg>
  );
}
