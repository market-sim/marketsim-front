import type { AgentAction, ReplayResult } from "../../api/endpoints";
import type { HumanTrade } from "./components/CandleChart";
import { maxDrawdown, simulateHuman, type HumanSim } from "./replayUtils";

/** Logique pure du mode debutant : decisions, conseil adapte a la position du joueur, bilan et lecons. */

export type Choice = "BUY" | "HOLD" | "SELL";

export interface Decision {
  day: number;
  choice: Choice;
  /** part des liquidites engagee (achat) */
  fraction: number;
  coach: AgentAction;
  /** le joueur etait-il investi AVANT sa decision ? */
  invested: boolean;
  followed: boolean;
  price: number;
}

export const eur = (v: number) =>
  v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits).replace(".", ",")} %`;
const pctSigned = (v: number, digits = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(digits).replace(".", ",")} %`;

/** Ce que ferait le joueur en suivant le coach : le conseil de l'agent depend de SA position, pas de celle du joueur. */
export function expectedChoice(coach: AgentAction, invested: boolean): Choice {
  if (invested) return coach === "SELL" ? "SELL" : "HOLD";
  return coach === "BUY" ? "BUY" : "HOLD";
}

/** Le conseil traduit pour le joueur : « garder » si deja investi, « rester a l'ecart » si le coach vend et qu'on est a plat. */
export function adviceLabel(coach: AgentAction, invested: boolean): { label: string; tone: "buy" | "hold" | "sell" } {
  if (invested) {
    return coach === "SELL" ? { label: "VENDRE", tone: "sell" } : { label: coach === "BUY" ? "GARDER · tu es déjà investi" : "GARDER", tone: "hold" };
  }
  return coach === "BUY" ? { label: "ACHETER", tone: "buy" }
    : coach === "SELL" ? { label: "RESTER À L'ÉCART", tone: "sell" } : { label: "ATTENDRE", tone: "hold" };
}

const coachWord: Record<AgentAction, string> = { BUY: "ACHETER", HOLD: "ATTENDRE", SELL: "VENDRE ou rester à l'écart" };

export interface Trip {
  entryDay: number;
  exitDay: number;
  entryPrice: number;
  exitPrice: number;
  /** rendement du prix entre l'entree moyenne et la sortie */
  ret: number;
  /** position encore ouverte au dernier jour */
  open: boolean;
  /** ce que le coach conseillait le jour de l'entree */
  coachAtEntry: AgentAction;
}

/** Les allers-retours (achat puis vente) du joueur ; la position encore ouverte est comptee a la derniere cloture. */
export function roundTrips(replay: ReplayResult, sim: HumanSim, upTo: number): Trip[] {
  const trips: Trip[] = sim.fills
    .filter((f) => f.side === "SELL")
    .map((f) => ({
      entryDay: f.entryDay!, exitDay: f.day, entryPrice: f.avgEntry!, exitPrice: f.price, ret: f.price / f.avgEntry! - 1,
      open: false, coachAtEntry: replay.days[f.entryDay!].action,
    }));
  if (sim.invested && sim.avgEntry != null && sim.entryDay != null) {
    const last = replay.days[upTo].price;
    trips.push({ entryDay: sim.entryDay, exitDay: upTo, entryPrice: sim.avgEntry, exitPrice: last, ret: last / sim.avgEntry - 1, open: true, coachAtEntry: replay.days[sim.entryDay].action });
  }
  return trips;
}

export interface Debrief {
  capital: number;
  final: number;
  pnl: number;
  pnlPct: number;
  benchFinal: number;
  benchPct: number;
  agentFinal: number;
  agentPct: number;
  trips: Trip[];
  wins: number;
  winRate: number | null;
  best: Trip | null;
  worst: Trip | null;
  fees: number;
  orders: number;
  investedPct: number;
  maxDD: number;
  followed: number;
  decisions: number;
  crash: { day: number; wasInvested: boolean; mine: number; market: number; window: number } | null;
  headline: string;
  lessons: string[];
}

/** Bilan de fin de partie : resultat, statistiques, et au plus 4 lecons deduites de CE qui s'est passe (aucun conseil generique). */
export function buildDebrief(replay: ReplayResult, trades: HumanTrade[], decisions: Decision[], upTo: number): Debrief {
  const sim = simulateHuman(replay, trades, upTo);
  const capital = replay.capital;
  const final = sim.equity[upTo];
  const pnl = final - capital;
  const pnlPct = final / capital - 1;
  const benchFinal = replay.days[upTo].benchmarkEquity;
  const benchPct = benchFinal / capital - 1;
  const agentFinal = replay.days[upTo].agentEquity;
  const agentPct = agentFinal / capital - 1;
  const trips = roundTrips(replay, sim, upTo);
  const wins = trips.filter((t) => t.ret > 0).length;
  const sortedTrips = [...trips].sort((a, b) => b.ret - a.ret);
  const best = sortedTrips[0] ?? null;
  const worst = sortedTrips.length > 1 ? sortedTrips[sortedTrips.length - 1] : sortedTrips[0] ?? null;
  const investedPct = sim.investedByDay.filter(Boolean).length / sim.investedByDay.length;
  const maxDD = maxDrawdown(sim.equity);
  const followed = decisions.filter((d) => d.followed).length;
  const orders = sim.fills.length;

  let crash: Debrief["crash"] = null;
  if (replay.crashDay != null && replay.crashDay >= 1 && replay.crashDay <= upTo) {
    const before = replay.crashDay - 1;
    const end = Math.min(upTo, replay.crashDay + 10);
    crash = {
      day: replay.crashDay, wasInvested: sim.investedByDay[before], window: end - before,
      mine: sim.equity[end] / sim.equity[before] - 1, market: replay.days[end].price / replay.days[before].price - 1,
    };
  }

  const lessons: string[] = [];
  if (worst && worst.ret < -0.02) {
    lessons.push(`Ton pire trade : acheté au jour ${worst.entryDay} (${worst.entryPrice.toFixed(2)})${worst.open ? ", encore ouvert à la fin" : `, vendu au jour ${worst.exitDay}`} → ${pctSigned(worst.ret)}. `
      + `Ce jour-là, le coach conseillait : ${coachWord[worst.coachAtEntry]}. ${worst.coachAtEntry !== "BUY" ? "Tu es entré contre son avis : pose-toi la question de ce qui t'a poussé." : "Même le coach se trompe : c'est pour ça qu'on limite la perte avec un stop-loss."}`);
  }
  if (crash) {
    lessons.push(crash.wasInvested
      ? `Au krach (jour ${crash.day}) tu étais investi : ton portefeuille a fait ${pctSigned(crash.mine)} sur les ${crash.window} jours suivants, le marché ${pctSigned(crash.market)}. Un krach arrive sans prévenir : ne mets jamais tout ton capital sur un seul pari.`
      : `Au krach (jour ${crash.day}) tu étais à l'abri en liquidités, alors que le marché faisait ${pctSigned(crash.market)}. Bien joué… ou un peu de chance ? Ce qui compte, c'est de savoir pourquoi tu étais à l'écart.`);
  }
  if (maxDD <= -0.12) {
    lessons.push(`Ton portefeuille a perdu jusqu'à ${pct(-maxDD)} depuis son plus haut. Règle simple : couper la perte à ${pct(replay.stopPct)} sous ton prix d'achat (le « stop-loss » du coach) évite qu'une mauvaise position devienne un gros trou.`);
  } else if (investedPct > 0.5 && maxDD > -0.06) {
    lessons.push(`Belle maîtrise du risque : ta pire baisse n'a été que de ${pct(-maxDD)}.`);
  }
  if (investedPct < 0.5 && benchPct > 0.03 && pnlPct < benchPct) {
    lessons.push(`Tu es resté en liquidités ${pct(1 - investedPct, 0)} du temps pendant que le marché faisait ${pctSigned(benchPct)}. Rater les hausses coûte aussi cher que subir les baisses : ne pas investir est aussi une décision.`);
  } else if (pnlPct > benchPct + 0.02) {
    lessons.push(`Tu as fait mieux que le simple « acheter et garder » (${pctSigned(pnlPct)} contre ${pctSigned(benchPct)}). Une seule partie peut être due à la chance : rejoue sur un autre marché pour vérifier.`);
  } else if (pnlPct < benchPct - 0.02) {
    lessons.push(`Le marché a fait ${pctSigned(benchPct)} tout seul, toi ${pctSigned(pnlPct)} : trader activement ne bat pas toujours le simple fait de garder.`);
  }
  if (decisions.length >= 5) {
    const adherence = followed / decisions.length;
    if (adherence >= 0.7) {
      lessons.push(`Tu as suivi le coach ${followed} fois sur ${decisions.length}. Son résultat : ${pctSigned(agentPct)}, le tien : ${pctSigned(pnlPct)}. Le coach n'est pas magique : il applique des règles chiffrées, et se trompe aussi.`);
    } else if (adherence <= 0.4) {
      lessons.push(`Tu t'es souvent écarté du coach (${decisions.length - followed} fois sur ${decisions.length}) : toi ${pctSigned(pnlPct)}, lui ${pctSigned(agentPct)}. Ce n'est pas mal en soi, mais note pourquoi tu t'en écartes : c'est comme ça qu'on construit sa propre méthode.`);
    }
  }
  if (orders >= 8 || sim.fees / capital > 0.01) {
    lessons.push(`Tu as passé ${orders} ordres : ${eur(sim.fees)} de frais (${(replay.costRate * 100).toFixed(1).replace(".", ",")} % par ordre). Plus on trade, plus les frais rongent le capital.`);
  }
  if (best && best.ret > 0.02 && lessons.length < 4) {
    lessons.push(`Ton meilleur trade : acheté au jour ${best.entryDay}${best.open ? ", toujours ouvert" : `, vendu au jour ${best.exitDay}`} → ${pctSigned(best.ret)}. Ce jour-là, le coach conseillait : ${coachWord[best.coachAtEntry]}.`);
  }
  if (lessons.length === 0) {
    lessons.push("Compare ton résultat à celui du coach et du simple « acheter et garder » : c'est la seule façon de savoir si ton trading ajoute de la valeur.");
  }

  const headline = pnl >= 0
    ? `Tu as transformé ${eur(capital)} en ${eur(final)} (${pctSigned(pnlPct)}).`
    : `Tu as perdu ${eur(-pnl)} : ${eur(capital)} sont devenus ${eur(final)} (${pctSigned(pnlPct)}).`;

  return {
    capital, final, pnl, pnlPct, benchFinal, benchPct, agentFinal, agentPct, trips, wins, winRate: trips.length ? wins / trips.length : null,
    best, worst, fees: sim.fees, orders, investedPct, maxDD, followed, decisions: decisions.length, crash, headline, lessons: lessons.slice(0, 4),
  };
}
