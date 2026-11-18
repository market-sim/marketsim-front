// Module 3 : affichage de l'analyse fondamentale (formats, reperes, etats). Fonctions pures.
// Une valeur null veut dire « non disponible » : elle n'est jamais affichee comme 0.
import type {
  FundamentalItemValue, FundamentalRatio, FundamentalRatioView, FundamentalsStatus, RatioLevel,
} from "../../api/endpoints";
import { money, num, pctPlain, pctSigned } from "./format";

export const NOT_AVAILABLE = "non disponible";

const isNum = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** Grand nombre abrege : 478 834 000 000 -> "478.83 Md", 3 794 000 000 -> "3.79 Md", 8 153 000 -> "8.15 M". */
export function compact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)} Md`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)} M`;
  return v.toLocaleString("en-US");
}

/** Valeur d'une donnee du 10-K, selon son unite. */
export function itemValue(i: FundamentalItemValue): string {
  if (!isNum(i.value)) return NOT_AVAILABLE;
  switch (i.unit) {
    case "USD": return `$${compact(i.value)}`;
    case "USD_PER_SHARE": return money(i.value);
    case "SHARES": return `${compact(i.value)} actions`;
  }
}

/** Ratios dont la variation s'affiche avec son signe (+15,1 %). */
const SIGNED: FundamentalRatio[] = ["REVENUE_GROWTH", "NET_INCOME_GROWTH"];

/** Valeur d'un ratio : 27.8 x, $8.98, 27.6 %, +15.1 %... */
export function ratioValue(r: Pick<FundamentalRatioView, "ratio" | "unit" | "value">): string {
  if (!isNum(r.value)) return NOT_AVAILABLE;
  switch (r.unit) {
    case "MULTIPLE": return `${num(r.value, Math.abs(r.value) < 10 ? 2 : 1)} x`;
    case "USD": return money(r.value);
    case "RATE":
      if (SIGNED.includes(r.ratio)) return pctSigned(r.value);
      return pctPlain(r.value, r.ratio === "DIVIDEND_YIELD" ? 2 : 1);
  }
}

export const LEVEL_LABEL: Record<RatioLevel, string> = { LOW: "Bas", MEDIUM: "Moyen", HIGH: "Élevé" };

/** Couleurs neutres : un repere n'est ni bon ni mauvais (un PER eleve veut dire « cher », pas « meilleur »). */
export const LEVEL_CLASS: Record<RatioLevel, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-violet-50 text-violet-700",
};

/** Phrase courte du repere : « Élevé parmi 7 actions » ou la raison de son absence. */
export function levelText(r: Pick<FundamentalRatioView, "level" | "compared" | "value">): string {
  if (!isNum(r.value)) return "";
  if (r.level == null) return "Pas de repère : aucune autre action analysée n'a ce ratio";
  return `${LEVEL_LABEL[r.level]} parmi les ${r.compared} actions analysées`;
}

export const STATUS_LABEL: Record<FundamentalsStatus, string> = {
  FRESH: "À jour",
  STALE: "Ancien",
  MISSING: "Non téléchargé",
};

export const STATUS_CLASS: Record<FundamentalsStatus, string> = {
  FRESH: "bg-emerald-50 text-emerald-700",
  STALE: "bg-amber-50 text-amber-700",
  MISSING: "bg-slate-100 text-slate-600",
};

/** "2026-09-26" -> "26/09/2026" */
export const frDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

/** Colonnes du tableau comparatif, dans l'ordre (les ratios les plus parlants d'abord). */
export const COMPARED_RATIOS: FundamentalRatio[] = [
  "PER", "PRICE_TO_BOOK", "ROE", "NET_MARGIN", "DEBT_TO_EQUITY", "DIVIDEND_YIELD", "REVENUE_GROWTH", "NET_INCOME_GROWTH",
];

/** Titre court d'une colonne du tableau comparatif. */
export const SHORT_LABEL: Record<FundamentalRatio, string> = {
  PER: "PER",
  PRICE_TO_BOOK: "Cours / VC",
  EPS: "BPA",
  ROE: "ROE",
  NET_MARGIN: "Marge nette",
  DEBT_TO_EQUITY: "Dette / CP",
  DIVIDEND_YIELD: "Rendement div.",
  REVENUE_GROWTH: "Croiss. CA",
  NET_INCOME_GROWTH: "Croiss. résultat",
};
