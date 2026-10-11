// Helpers et petits composants partages par tous les modules.

export type Signal = "BUY" | "HOLD" | "SELL";
export type Sentiment = "bullish" | "caution" | "neutral";
export type Direction = "UP" | "DOWN" | "FLAT";
export type BankStatus = "Pass" | "Warn" | "Fail";

export const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
export const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
export const priceDisplay = (p: number) =>
  p >= 1000 ? `$${p.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : `$${p.toFixed(4)}`;
export const MONO: React.CSSProperties = { fontFamily: '"JetBrains Mono", monospace' };
export const DISPLAY: React.CSSProperties = { fontFamily: '"Outfit", sans-serif' };

export function SignalBadge({ signal }: { signal: Signal }) {
  const s: Record<Signal, string> = {
    BUY:  "bg-emerald-50 text-emerald-700",
    SELL: "bg-red-50 text-red-700",
    HOLD: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${s[signal]}`}>
      {signal}
    </span>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>{title}</h3>
      {action}
    </div>
  );
}

export function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-border/60 ${className}`}>{children}</div>
  );
}
