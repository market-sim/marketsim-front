// Module 3 : formats d'affichage. Les taux de l'API sont des fractions (0.0523 = 5,23 %).
import { fmt } from "../../shared/ui";

/** Affichage d'une valeur absente (metrique non calculable, champ vide). */
export const DASH = "—";

const isNum = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** Nombre arrondi puis ecrit avec son signe ; l'arrondi d'abord evite d'afficher "-0.0". */
function signed(v: number, digits: number): string {
  const x = Number(v.toFixed(digits));
  return `${x > 0 ? "+" : ""}${x.toFixed(digits)}`;
}

/** 0.0523 -> "+5.2 %" */
export const pctSigned = (v: number | null | undefined, digits = 1) => (isNum(v) ? `${signed(v * 100, digits)} %` : DASH);
/** 0.0523 -> "5.2 %" */
export const pctPlain = (v: number | null | undefined, digits = 1) => (isNum(v) ? `${(v * 100).toFixed(digits)} %` : DASH);
/** Ecart entre deux rendements, en points de pourcentage : -0.585 -> "-58.5 pts" */
export const ptsSigned = (v: number | null | undefined, digits = 1) => (isNum(v) ? `${signed(v * 100, digits)} pts` : DASH);
/** Ratio sans unite (Sharpe, Sortino, profit factor...). */
export const num = (v: number | null | undefined, digits = 2) => (isNum(v) ? v.toFixed(digits) : DASH);
/** Montant en dollars, comme dans le reste de l'application. */
export const money = (v: number | null | undefined) => (isNum(v) ? fmt(v) : DASH);
export const moneySigned = (v: number | null | undefined) => (isNum(v) ? `${v > 0 ? "+" : ""}${fmt(v)}` : DASH);
/** Cours : 4 decimales pour les petits prix (EUR/USD), 2 sinon. */
export const price = (v: number | null | undefined) => (isNum(v) ? v.toFixed(Math.abs(v) < 10 ? 4 : 2) : DASH);
/** Graduation d'un axe de cours : pas de decimales inutiles pour les grands prix (140000 -> "140,000"). */
export const priceTick = (v: number) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : price(v));
/**
 * Decimales du MACD. C'est un ecart entre deux moyennes de cours, bien plus petit que le cours lui-meme :
 * 5 decimales pour un cours a 4 decimales (EUR/USD), 3 pour une action, 1 pour un cours en milliers (BTC, or).
 */
export function macdDigits(close: number | null | undefined): number {
  if (!isNum(close)) return 3;
  return Math.abs(close) < 10 ? 5 : Math.abs(close) < 1000 ? 3 : 1;
}
/** Graduation de l'axe du MACD : la precision suit la taille de la valeur, et zero s'ecrit "0". */
export const macdTick = (v: number) => (v === 0 ? "0" : num(v, Math.abs(v) < 1 ? 3 : Math.abs(v) < 100 ? 1 : 0));
/** Axe des montants : 950 -> "$950", 12500 -> "$12.5k", 1200000 -> "$1.2M" */
export function moneyCompact(v: number): string {
  const short = (x: number) => String(Number(x.toFixed(1)));
  if (Math.abs(v) >= 1_000_000) return `$${short(v / 1_000_000)}M`;
  if (Math.abs(v) >= 1_000) return `$${short(v / 1_000)}k`;
  return `$${Math.round(v)}`;
}

/** Couleur d'un gain ou d'une perte (memes classes que les autres pages). */
export const gainClass = (v: number | null | undefined) =>
  !isNum(v) || v === 0 ? "text-foreground" : v > 0 ? "text-emerald-600" : "text-red-500";

// ─── Dates (format AAAA-MM-JJ, comme l'API) ──────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);

export const todayIso = () => toIso(new Date());

/** Date d'il y a `months` mois, pour les raccourcis de periode (« 1 an », « 6 mois »...). */
export function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return toIso(d);
}

/** "2026-11-12T01:14:33" -> "12/11/2026 01:14" */
export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : DASH;

/** Empreinte SHA-256 abregee : "06d2a032cf…bd9c9ce". */
export const shortHash = (h: string) => (h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

/**
 * Graduations de l'axe du temps d'un graphique dont l'axe X est la liste des seances.
 * Selon la duree affichee : une graduation par annee, par trimestre, par mois, ou toutes les n seances.
 */
export function timeAxis(dates: string[]): { ticks: string[]; format: (iso: string) => string } {
  if (dates.length < 2) return { ticks: dates, format: (d) => d };
  const spanDays = (parse(dates[dates.length - 1]).getTime() - parse(dates[0]).getTime()) / 86_400_000;
  /** premiere seance de chaque groupe (annee, trimestre, mois) */
  const firstOfEach = (key: (iso: string) => string) => dates.filter((d, i) => i > 0 && key(d) !== key(dates[i - 1]));
  const monthYear = (iso: string) => parse(iso).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

  if (spanDays > 3 * 365) return { ticks: firstOfEach((d) => d.slice(0, 4)), format: (d) => d.slice(0, 4) };
  if (spanDays > 500) {
    const quarter = (d: string) => `${d.slice(0, 4)}-${Math.floor((Number(d.slice(5, 7)) - 1) / 3)}`;
    return { ticks: firstOfEach(quarter), format: monthYear };
  }
  if (spanDays > 75) return { ticks: firstOfEach((d) => d.slice(0, 7)), format: monthYear };
  const step = Math.max(1, Math.ceil(dates.length / 8));
  return {
    ticks: dates.filter((_, i) => i % step === 0),
    format: (iso) => parse(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
  };
}
