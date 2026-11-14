import { useEffect } from "react";
import type { ChartRisk } from "../../../api/endpoints";
import { useProgression } from "../../../progression/ProgressionContext";
import { MONO } from "../../../shared/ui";
import { eur } from "../schoolLogic";
import { RISK_PROFILES, maxLoss } from "../riskProfile";

/** Choix du style de trading et du capital virtuel avant l'analyse d'une capture (comme le « Trade Profile » des outils IA). */
export default function RiskProfilePicker({ value, onChange, disabled }: { value: ChartRisk; onChange: (r: ChartRisk) => void; disabled?: boolean }) {
  const current = RISK_PROFILES.find((p) => p.id === value.riskProfile) ?? RISK_PROFILES[1];
  // niveau Debutant : seul le profil Prudent est permis (le serveur applique la meme regle)
  const beginner = useProgression().progression?.level === "DEBUTANT";
  useEffect(() => {
    if (beginner && value.riskProfile !== "CONSERVATIVE") onChange({ ...value, riskProfile: "CONSERVATIVE", riskPercent: 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginner, value.riskProfile]);
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Profil</span>
        <div className="flex gap-1 bg-muted/40 rounded-lg p-0.5">
          {RISK_PROFILES.map((p) => (
            <button key={p.id} type="button" disabled={disabled || (beginner && p.id !== "CONSERVATIVE")}
              title={beginner && p.id !== "CONSERVATIVE" ? "Débloqué au niveau Intermédiaire" : undefined}
              onClick={() => onChange({ ...value, riskProfile: p.id, riskPercent: p.percent })}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium disabled:opacity-50 ${value.riskProfile === p.id ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
              {p.label} <span style={MONO} className="opacity-70">{String(p.percent).replace(".", ",")} %</span>
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Capital virtuel
          <input type="number" min={100} step={100} value={value.accountBalance} disabled={disabled}
            onChange={(e) => onChange({ ...value, accountBalance: Number(e.target.value) })}
            className="w-24 bg-white border border-border rounded-md px-2 py-1 text-[12px] text-foreground outline-none focus:border-blue-400" style={MONO} />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {beginner && <b className="text-amber-600">Niveau Débutant : profil Prudent imposé. </b>}
        {current.hint} Risque maximum par trade : <b className="text-foreground" style={MONO}>{eur(maxLoss(value))}</b>
        {" "}({String(value.riskPercent).replace(".", ",")} % de {eur(value.accountBalance > 0 ? value.accountBalance : 0)}).
      </p>
    </div>
  );
}
