import type { ReactNode } from "react";
import { Layers } from "lucide-react";
import { DISPLAY } from "../../shared/ui";
import ThemeToggle from "../../theme/ThemeToggle";

/** Cadre commun aux pages Login / Register. */
export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative min-h-full flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #0D1B3E, #1D4ED8)" }}>
      <div className="absolute top-4 right-4"><ThemeToggle compact /></div>
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl p-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground" style={DISPLAY}>MarketSim AI</div>
            <div className="text-[11px] text-muted-foreground">Simulateur de salle de marché</div>
          </div>
        </div>
        <h1 className="text-lg font-semibold text-foreground" style={DISPLAY}>{title}</h1>
        <p className="text-xs text-muted-foreground mb-5">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export const inputClass =
  "w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400";
export const labelClass = "text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1";
