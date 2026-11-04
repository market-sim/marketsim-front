import type { ReactNode } from "react";
import { DISPLAY } from "../../shared/ui";
import ThemeToggle from "../../theme/ThemeToggle";
import { logoFull } from "../../shared/brand";

/** Cadre commun aux pages Login / Register. */
export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative min-h-full flex items-center justify-center p-4 py-8" style={{ background: "linear-gradient(135deg, #0D1B3E, #1D4ED8)" }}>
      <div className="absolute top-4 right-4"><ThemeToggle compact /></div>
      <div className="w-full max-w-sm flex flex-col items-center gap-5">
        {/* Le logo est prevu pour un fond sombre : il se place sur le degrade, au-dessus de la carte */}
        <div className="flex flex-col items-center gap-1.5">
          <img src={logoFull} alt="MarketSim AI" className="w-40 h-auto select-none" style={{ filter: "drop-shadow(0 8px 28px rgba(0,0,0,0.35))" }} />
          <p className="text-[10.5px] tracking-[0.22em] uppercase text-white/60">Simulateur de salle de marché</p>
        </div>
        <div className="w-full bg-card rounded-2xl shadow-xl p-7">
          <h1 className="text-lg font-semibold text-foreground" style={DISPLAY}>{title}</h1>
          <p className="text-xs text-muted-foreground mb-5">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export const inputClass =
  "w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400";
export const labelClass = "text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1";
