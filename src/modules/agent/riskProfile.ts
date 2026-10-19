import type { ChartRisk, RiskProfile } from "../../api/endpoints";

/** Les trois styles proposes avant d'analyser une capture ; chacun fixe la part du capital risquee sur un trade. */
export const RISK_PROFILES: { id: RiskProfile; label: string; percent: number; hint: string }[] = [
  { id: "CONSERVATIVE", label: "Prudent", percent: 0.5, hint: "Peu de trades, seulement quand la situation est claire." },
  { id: "BALANCED", label: "Équilibré", percent: 1, hint: "Un compromis entre prudence et opportunités." },
  { id: "AGGRESSIVE", label: "Offensif", percent: 2, hint: "Plus d'entrées, plus de risque. Le stop reste indispensable." },
];

export const DEFAULT_RISK: ChartRisk = { riskProfile: "BALANCED", riskPercent: 1, accountBalance: 1000 };

// memes bornes que la validation du backend (ChartRequest)
const MIN_BALANCE = 100;
const MAX_BALANCE = 10_000_000;

export const clampBalance = (v: number) => (Number.isFinite(v) ? Math.min(MAX_BALANCE, Math.max(MIN_BALANCE, v)) : MIN_BALANCE);

/** Perte maximale (en capital virtuel) si le stop est touche : capital x % de risque. */
export const maxLoss = (r: ChartRisk) => (clampBalance(r.accountBalance) * r.riskPercent) / 100;

export const profileLabel = (id: RiskProfile) => RISK_PROFILES.find((p) => p.id === id)?.label ?? id;

/** Profil pret a envoyer au backend : capital ramene dans les bornes acceptees. */
export const toRequest = (r: ChartRisk): ChartRisk => ({ ...r, accountBalance: clampBalance(r.accountBalance) });
