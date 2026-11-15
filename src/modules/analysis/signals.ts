// Module 3 : resume des signaux de l'onglet « Analyse technique ».
// Chaque indicateur est lu a la DERNIERE seance affichee : c'est un etat (au-dessus / en dessous d'un seuil),
// pas un conseil d'investissement. Le moteur de backtest, lui, agit sur les croisements, cote back.
import type { Signal } from "../../shared/ui";
import { macdDigits, num, price } from "./format";
import type { ChartRow, IndicatorId, Periods, Visibility } from "./technical";

export const RSI_OVERSOLD = 30;
export const RSI_OVERBOUGHT = 70;

export const signalWord: Record<Signal, string> = { BUY: "Achat", SELL: "Vente", HOLD: "Neutre" };

export interface SignalRow {
  id: IndicatorId;
  indicator: string;
  /** derniere valeur de l'indicateur, deja formatee */
  value: string;
  signal: Signal;
  /** explication en une phrase */
  reading: string;
}

const WARMUP = "Pas assez d'historique pour calculer cet indicateur.";

/** Moyenne mobile : cloture au-dessus = tendance haussiere, en dessous = baissiere. */
function versusAverage(id: IndicatorId, name: string, close: number, average: number | null): SignalRow {
  if (average == null) return { id, indicator: name, value: "—", signal: "HOLD", reading: WARMUP };
  const signal: Signal = close > average ? "BUY" : close < average ? "SELL" : "HOLD";
  const reading =
    signal === "BUY" ? `La clôture (${price(close)}) est au-dessus de la moyenne : tendance haussière.`
    : signal === "SELL" ? `La clôture (${price(close)}) est sous la moyenne : tendance baissière.`
    : "La clôture est exactement sur la moyenne.";
  return { id, indicator: name, value: price(average), signal, reading };
}

/** Un signal par indicateur affiche, calcule sur la derniere seance. */
export function readSignals(rows: ChartRow[], periods: Periods, show: Visibility): SignalRow[] {
  const last = rows[rows.length - 1];
  if (!last) return [];
  const out: SignalRow[] = [];

  if (show.smaFast) out.push(versusAverage("smaFast", `SMA ${periods.smaFast}`, last.close, last.smaFast));
  if (show.smaSlow) out.push(versusAverage("smaSlow", `SMA ${periods.smaSlow}`, last.close, last.smaSlow));
  if (show.ema) out.push(versusAverage("ema", `EMA ${periods.ema}`, last.close, last.ema));

  if (show.bollinger) {
    const name = `Bollinger ${periods.bbPeriod} · k = ${periods.bbK}`;
    if (last.bbLower == null || last.bbUpper == null) {
      out.push({ id: "bollinger", indicator: name, value: "—", signal: "HOLD", reading: WARMUP });
    } else {
      const value = `${price(last.bbLower)} – ${price(last.bbUpper)}`;
      const signal: Signal = last.close < last.bbLower ? "BUY" : last.close > last.bbUpper ? "SELL" : "HOLD";
      const reading =
        signal === "BUY" ? "La clôture est sous la bande basse : excès baissier, un retour vers la moyenne est possible."
        : signal === "SELL" ? "La clôture est au-dessus de la bande haute : excès haussier, un retour vers la moyenne est possible."
        : "La clôture est à l'intérieur des bandes.";
      out.push({ id: "bollinger", indicator: name, value, signal, reading });
    }
  }

  if (show.rsi) {
    const name = `RSI ${periods.rsi}`;
    if (last.rsi == null) {
      out.push({ id: "rsi", indicator: name, value: "—", signal: "HOLD", reading: WARMUP });
    } else {
      const signal: Signal = last.rsi < RSI_OVERSOLD ? "BUY" : last.rsi > RSI_OVERBOUGHT ? "SELL" : "HOLD";
      const reading =
        signal === "BUY" ? `Sous ${RSI_OVERSOLD} : zone de survente.`
        : signal === "SELL" ? `Au-dessus de ${RSI_OVERBOUGHT} : zone de surachat.`
        : `Entre ${RSI_OVERSOLD} et ${RSI_OVERBOUGHT} : ni survente ni surachat.`;
      out.push({ id: "rsi", indicator: name, value: num(last.rsi, 1), signal, reading });
    }
  }

  if (show.macd) {
    const name = `MACD ${periods.macdFast} / ${periods.macdSlow} / ${periods.macdSignal}`;
    if (last.macd == null || last.macdSignal == null) {
      out.push({ id: "macd", indicator: name, value: "—", signal: "HOLD", reading: WARMUP });
    } else {
      const signal: Signal = last.macd > last.macdSignal ? "BUY" : last.macd < last.macdSignal ? "SELL" : "HOLD";
      const digits = macdDigits(last.close);
      const reading =
        signal === "BUY" ? `Le MACD est au-dessus de sa ligne de signal (${num(last.macdSignal, digits)}) : élan haussier.`
        : signal === "SELL" ? `Le MACD est sous sa ligne de signal (${num(last.macdSignal, digits)}) : élan baissier.`
        : "Le MACD est exactement sur sa ligne de signal.";
      out.push({ id: "macd", indicator: name, value: num(last.macd, digits), signal, reading });
    }
  }
  return out;
}
