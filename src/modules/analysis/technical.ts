// Module 3 : reglages de l'onglet « Analyse technique » et mise en forme des series pour les graphiques.
import type { IndicatorQuery, IndicatorSeries } from "../../api/endpoints";
import { monthsAgo } from "./format";

export type RangeId = "3M" | "6M" | "1Y" | "2Y" | "5Y" | "MAX" | "CUSTOM";

/** Raccourcis de periode ; months = null : tout l'historique. */
export const RANGES: { id: Exclude<RangeId, "CUSTOM">; label: string; months: number | null }[] = [
  { id: "3M", label: "3 mois", months: 3 },
  { id: "6M", label: "6 mois", months: 6 },
  { id: "1Y", label: "1 an", months: 12 },
  { id: "2Y", label: "2 ans", months: 24 },
  { id: "5Y", label: "5 ans", months: 60 },
  { id: "MAX", label: "Tout", months: null },
];

export interface Periods {
  smaFast: number;
  smaSlow: number;
  ema: number;
  bbPeriod: number;
  bbK: number;
  rsi: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}
export type PeriodKey = keyof Periods;

/** Ce qui est affiche : quatre courbes sur le graphique du prix, deux panneaux en dessous. */
export interface Visibility {
  smaFast: boolean;
  smaSlow: boolean;
  ema: boolean;
  bollinger: boolean;
  rsi: boolean;
  macd: boolean;
}
export type IndicatorId = keyof Visibility;

export interface TechSettings {
  symbol: string;
  range: RangeId;
  /** dates saisies a la main (range = "CUSTOM") ; vide = pas de borne */
  from: string;
  to: string;
  periods: Periods;
  show: Visibility;
}

/** Memes valeurs par defaut que le back (IndicatorService). */
export const DEFAULT_TECH: TechSettings = {
  symbol: "",
  range: "1Y",
  from: "",
  to: "",
  periods: { smaFast: 20, smaSlow: 50, ema: 20, bbPeriod: 20, bbK: 2, rsi: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 },
  show: { smaFast: true, smaSlow: true, ema: true, bollinger: true, rsi: true, macd: true },
};

/** Bornes de dates a envoyer au back pour la periode choisie. */
export function rangeBounds(s: TechSettings): { from?: string; to?: string } {
  if (s.range === "CUSTOM") return { from: s.from || undefined, to: s.to || undefined };
  const months = RANGES.find((r) => r.id === s.range)?.months;
  return months == null ? {} : { from: monthsAgo(months) };
}

/** Toutes les familles d'indicateurs sont demandees a chaque fois : masquer une courbe ne relance pas d'appel. */
export function indicatorQuery(s: TechSettings): IndicatorQuery {
  const p = s.periods;
  return {
    sma: [...new Set([p.smaFast, p.smaSlow])],
    ema: [p.ema],
    rsi: p.rsi,
    macd: [p.macdFast, p.macdSlow, p.macdSignal],
    bollinger: [p.bbPeriod, p.bbK],
    ...rangeBounds(s),
  };
}

// ─── Saisie des periodes ─────────────────────────────────────────────────────
export type PeriodDraft = Record<PeriodKey, string>;
export type PeriodErrors = Partial<Record<PeriodKey, string>>;

export const MAX_PERIOD = 500;

export function periodDraft(p: Periods): PeriodDraft {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) as PeriodDraft;
}

/** Verifie la saisie des periodes (memes regles que le back) ; `periods` est null s'il y a une erreur. */
export function validatePeriods(draft: PeriodDraft): { periods: Periods | null; errors: PeriodErrors } {
  const errors: PeriodErrors = {};
  const values = {} as Periods;
  for (const key of Object.keys(draft) as PeriodKey[]) {
    const raw = draft[key].trim().replace(",", ".");
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) {
      errors[key] = "Valeur obligatoire";
    } else if (key === "bbK") {
      if (!(value > 0 && value <= 10)) errors[key] = "Supérieur à 0 et au plus 10";
    } else if (!Number.isInteger(value) || value < 2 || value > MAX_PERIOD) {
      errors[key] = `Entier entre 2 et ${MAX_PERIOD}`;
    }
    values[key] = value;
  }
  if (!errors.smaFast && !errors.smaSlow && values.smaFast >= values.smaSlow) {
    errors.smaSlow = "Doit être plus grande que la période de la SMA courte";
  }
  if (!errors.macdFast && !errors.macdSlow && values.macdFast >= values.macdSlow) {
    errors.macdSlow = "Doit être plus grande que la période rapide";
  }
  return { periods: Object.keys(errors).length === 0 ? values : null, errors };
}

// ─── Series pour les graphiques ──────────────────────────────────────────────
/** Une ligne par seance ; null = indicateur pas encore calculable (periode de chauffe). */
export interface ChartRow {
  date: string;
  close: number;
  smaFast: number | null;
  smaSlow: number | null;
  ema: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  /** [bande basse, bande haute] : zone coloree entre les deux bandes */
  band: [number, number] | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
}

export function toChartRows(series: IndicatorSeries, p: Periods): ChartRow[] {
  const at = (values: (number | null)[] | undefined, i: number) => values?.[i] ?? null;
  const smaFast = series.sma?.[String(p.smaFast)];
  const smaSlow = series.sma?.[String(p.smaSlow)];
  const ema = series.ema?.[String(p.ema)];
  return series.dates.map((date, i) => {
    const bbUpper = at(series.bollinger?.upper, i);
    const bbLower = at(series.bollinger?.lower, i);
    return {
      date,
      close: series.closes[i],
      smaFast: at(smaFast, i),
      smaSlow: at(smaSlow, i),
      ema: at(ema, i),
      bbUpper,
      bbMiddle: at(series.bollinger?.middle, i),
      bbLower,
      band: bbUpper != null && bbLower != null ? [bbLower, bbUpper] : null,
      rsi: at(series.rsi?.values, i),
      macd: at(series.macd?.macd, i),
      macdSignal: at(series.macd?.signalLine, i),
      macdHist: at(series.macd?.histogram, i),
    };
  });
}
