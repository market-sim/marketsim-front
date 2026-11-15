// Module 3 : couleurs des graphiques, en clair et en sombre.
// Les trois couleurs de series (bleu, ambre, violet) ont ete verifiees pour chaque theme : assez de contraste
// avec le fond de la carte et distinguables pour les daltoniens.
import { useMemo } from "react";
import { useTheme } from "../../theme/ThemeContext";
import { timeAxis } from "./format";

export interface ChartColors {
  /** courbe principale (prix) */
  ink: string;
  /** texte des axes */
  axis: string;
  /** lignes de la grille et des axes */
  grid: string;
  blue: string;
  amber: string;
  violet: string;
  /** courbes de reference : bandes de Bollinger, buy & hold */
  neutral: string;
  /** hausse / gain */
  up: string;
  /** baisse / perte */
  down: string;
}

const LIGHT: ChartColors = {
  ink: "#0F172A", axis: "#64748B", grid: "#E8EDF5",
  blue: "#2563EB", amber: "#D97706", violet: "#7C3AED", neutral: "#94A3B8",
  up: "#059669", down: "#DC2626",
};

const DARK: ChartColors = {
  ink: "#E2E8F0", axis: "#94A3B8", grid: "rgba(148,163,184,0.14)",
  blue: "#3B82F6", amber: "#D97706", violet: "#8B5CF6", neutral: "#7C8BA8",
  up: "#34D399", down: "#F87171",
};

/** Couleurs du theme actuellement affiche. */
export function useChartColors(): ChartColors {
  return useTheme().resolved === "dark" ? DARK : LIGHT;
}

/** Meme largeur d'axe vertical partout : les graphiques empiles restent alignes. */
export const Y_AXIS_WIDTH = 58;
export const CHART_MARGIN = { top: 8, right: 12, left: 0, bottom: 0 };
export const yTick = (c: ChartColors) => ({ fontSize: 10, fill: c.axis });

/**
 * Reglages de l'axe du temps d'un graphique qui a une ligne par seance :
 * une graduation par mois, par trimestre ou par annee selon la duree affichee.
 */
export function useTimeAxis(rows: { date: string }[], c: ChartColors) {
  return useMemo(() => {
    const axis = timeAxis(rows.map((r) => r.date));
    return {
      dataKey: "date",
      ticks: axis.ticks,
      tickFormatter: axis.format,
      tick: yTick(c),
      tickLine: false,
      axisLine: { stroke: c.grid },
      minTickGap: 16,
    };
  }, [rows, c]);
}
