import type { ReplayResult } from "../../api/endpoints";
import type { HumanTrade } from "./components/CandleChart";

/** Un ordre execute du joueur. */
export interface Fill {
  day: number;
  side: "BUY" | "SELL";
  price: number;
  units: number;
  /** frais de l'ordre (en monnaie du portefeuille) */
  fee: number;
  /** a la vente : prix d'entree moyen et jour d'ouverture de la position fermee */
  avgEntry?: number;
  entryDay?: number;
}

export interface HumanSim {
  /** valeur du portefeuille chaque jour jusqu'a upTo */
  equity: number[];
  /** investi (au moins une unite) a la cloture de chaque jour */
  investedByDay: boolean[];
  cash: number;
  units: number;
  /** vrai si le joueur detient une position a la fin */
  invested: boolean;
  /** prix d'entree moyen de la position ouverte */
  avgEntry: number | null;
  /** jour d'ouverture de la position ouverte */
  entryDay: number | null;
  fees: number;
  fills: Fill[];
}

/**
 * Simule le portefeuille du joueur sur le marche rejoue. Un achat engage {@code fraction} des liquidites (1 = tout),
 * une vente liquide toute la position ; frais identiques a ceux de l'agent. Les ordres sont executes a la cloture du jour.
 */
export function simulateHuman(replay: ReplayResult, trades: HumanTrade[], upTo: number): HumanSim {
  const sorted = [...trades].sort((a, b) => a.day - b.day);
  let cash = replay.capital;
  let units = 0;
  let basis = 0;
  let entryDay: number | null = null;
  let fees = 0;
  let k = 0;
  const equity: number[] = [];
  const investedByDay: boolean[] = [];
  const fills: Fill[] = [];

  for (let d = 0; d <= upTo; d++) {
    const price = replay.days[d].price;
    while (k < sorted.length && sorted[k].day === d) {
      const t = sorted[k++];
      if (t.side === "BUY") {
        const spend = cash * Math.min(1, Math.max(0, t.fraction ?? 1));
        if (spend > 1e-9) {
          const bought = (spend * (1 - replay.costRate)) / price;
          if (units === 0) entryDay = d;
          units += bought;
          basis += bought * price;
          cash -= spend;
          fees += spend * replay.costRate;
          fills.push({ day: d, side: "BUY", price, units: bought, fee: spend * replay.costRate });
        }
      } else if (units > 0) {
        const proceeds = units * price;
        const fee = proceeds * replay.costRate;
        fills.push({ day: d, side: "SELL", price, units, fee, avgEntry: basis / units, entryDay: entryDay ?? d });
        cash += proceeds - fee;
        fees += fee;
        units = 0;
        basis = 0;
        entryDay = null;
      }
    }
    equity.push(cash + units * price);
    investedByDay.push(units > 0);
  }
  return {
    equity, investedByDay, cash, units, invested: units > 0,
    avgEntry: units > 0 ? basis / units : null, entryDay: units > 0 ? entryDay : null, fees, fills,
  };
}

/** Pire baisse depuis un plus haut (negative : -0.12 = -12 %). */
export function maxDrawdown(values: number[]): number {
  let peak = values[0] ?? 1;
  let worst = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, v / peak - 1);
  }
  return worst;
}
