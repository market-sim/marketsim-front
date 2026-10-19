// Tests de la logique pure du mode debutant (portefeuille du joueur, allers-retours, bilan, lecons).
// Pas de lanceur de tests dans le projet : on transpile les modules TypeScript purs avec `typescript` et on les execute.
// Lancer : npm run test:logic
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const FRONT = path.join(__dirname, "..");
const ts = require(path.join(FRONT, "node_modules/typescript"));
const SRC = path.join(FRONT, "src/modules/agent");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "marketsim-logic-"));
fs.mkdirSync(OUT, { recursive: true });
for (const f of ["replayUtils.ts", "schoolLogic.ts"]) {
  const js = ts.transpileModule(fs.readFileSync(path.join(SRC, f), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  fs.writeFileSync(path.join(OUT, f.replace(".ts", ".js")), js);
}
const { simulateHuman, maxDrawdown } = require(path.join(OUT, "replayUtils.js"));
const logic = require(path.join(OUT, "schoolLogic.js"));

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} vs ${b}`);

/** Marche fictif : prix donnes, le coach dit toujours `coach`, capital 1000, frais 0,1 %. */
function replayOf(prices, { coach = "HOLD", crashDay = null, capital = 1000 } = {}) {
  return {
    capital, costRate: 0.001, stopPct: 0.08, crashDay, positionFraction: 0.65, horizonDays: prices.length - 1,
    days: prices.map((p, i) => ({ day: i, price: p, action: Array.isArray(coach) ? coach[i] : coach, confidence: 0.6, event: 0,
      agentPosition: 0, agentEquity: capital, benchmarkEquity: capital * p / prices[0], why: "" })),
  };
}

// ---- 1. Portefeuille : achat de 50 % puis vente ----
{
  const r = replayOf([100, 110, 121, 100]);
  const sim = simulateHuman(r, [{ day: 0, side: "BUY", price: 100, fraction: 0.5 }, { day: 2, side: "SELL", price: 121 }], 3);
  near(sim.equity[0], 500 + 500 * 0.999, 1e-9, "valeur jour 0 (frais de 0,5 EUR)");
  near(sim.equity[1], 500 + 4.995 * 110, 1e-9, "valeur jour 1");
  const proceeds = 4.995 * 121;
  near(sim.cash, 500 + proceeds * 0.999, 1e-9, "liquidites apres la vente");
  assert.strictEqual(sim.invested, false);
  assert.strictEqual(sim.fills.length, 2);
  near(sim.fills[1].avgEntry, 100, 1e-9, "prix d'entree moyen a la vente");
  assert.strictEqual(sim.fills[1].entryDay, 0);
  near(sim.fees, 0.5 + proceeds * 0.001, 1e-9, "frais cumules");
  assert.deepStrictEqual(sim.investedByDay, [true, true, false, false]);
  near(sim.equity[3], sim.cash, 1e-9, "a plat : la valeur ne bouge plus avec le prix");
}

// ---- 2. Achats successifs : prix d'entree moyen ; ordres impossibles ignores ----
{
  const r = replayOf([100, 100, 120, 120]);
  const sim = simulateHuman(r, [{ day: 0, side: "BUY", price: 100, fraction: 0.5 }, { day: 2, side: "BUY", price: 120, fraction: 1 }, { day: 3, side: "SELL", price: 120 }, { day: 3, side: "BUY", price: 120, fraction: 1 }], 3);
  assert.strictEqual(sim.fills.filter((f) => f.side === "BUY").length, 3);
  assert.ok(sim.fills[1].units > 0 && sim.fills[0].units > 0);
  const noOrders = simulateHuman(r, [{ day: 1, side: "SELL", price: 100 }], 3);
  assert.strictEqual(noOrders.fills.length, 0, "vendre sans position ne fait rien");
  assert.ok(Math.abs(noOrders.equity[3] - 1000) < 1e-9);
  const dup = simulateHuman(r, [{ day: 0, side: "BUY", price: 100, fraction: 1 }, { day: 1, side: "BUY", price: 100, fraction: 1 }], 3);
  assert.strictEqual(dup.fills.length, 1, "plus de liquidites : le deuxieme achat est ignore");
}

// ---- 3. Allers-retours : un ferme, un ouvert ----
{
  const r = replayOf([100, 105, 90, 95, 120, 130], { coach: ["BUY", "BUY", "HOLD", "SELL", "BUY", "HOLD"] });
  const trades = [{ day: 0, side: "BUY", price: 100, fraction: 1 }, { day: 2, side: "SELL", price: 90 }, { day: 4, side: "BUY", price: 120, fraction: 1 }];
  const sim = simulateHuman(r, trades, 5);
  const trips = logic.roundTrips(r, sim, 5);
  assert.strictEqual(trips.length, 2);
  near(trips[0].ret, -0.10, 1e-9, "premier trade : -10 %");
  assert.strictEqual(trips[0].open, false);
  assert.strictEqual(trips[0].coachAtEntry, "BUY");
  near(trips[1].ret, 130 / 120 - 1, 1e-9, "trade ouvert marque a la derniere cloture");
  assert.strictEqual(trips[1].open, true);
}

// ---- 4. Conseil adapte a la position du joueur ----
{
  assert.strictEqual(logic.expectedChoice("BUY", false), "BUY");
  assert.strictEqual(logic.expectedChoice("BUY", true), "HOLD", "deja investi : on garde");
  assert.strictEqual(logic.expectedChoice("SELL", false), "HOLD", "a plat : vendre = rester a l'ecart");
  assert.strictEqual(logic.expectedChoice("SELL", true), "SELL");
  assert.strictEqual(logic.adviceLabel("SELL", false).label, "RESTER À L'ÉCART");
  assert.strictEqual(logic.adviceLabel("HOLD", false).label, "ATTENDRE");
  assert.strictEqual(logic.adviceLabel("BUY", true).tone, "hold");
  assert.strictEqual(logic.adviceLabel("SELL", true).label, "VENDRE");
}

// ---- 5. Bilan : krach subi, pire trade, resultat ----
{
  // le joueur achete tout au jour 0, le krach tombe au jour 5, il garde jusqu'a la fin
  const prices = [100, 101, 102, 103, 104, 80, 78, 79, 81, 83, 84, 85];
  const r = replayOf(prices, { coach: "SELL", crashDay: 5 });
  const trades = [{ day: 0, side: "BUY", price: 100, fraction: 1 }];
  const decisions = Array.from({ length: 11 }, (_, i) => ({ day: i, choice: i === 0 ? "BUY" : "HOLD", fraction: 1, coach: "SELL", invested: i > 0, followed: i > 0 ? false : false, price: prices[i] }));
  const d = logic.buildDebrief(r, trades, decisions, 11);
  assert.ok(d.pnl < 0 && d.headline.startsWith("Tu as perdu"), d.headline);
  near(d.pnlPct, 0.85 * 0.999 - 1, 1e-6, "perte finale");
  assert.ok(d.crash && d.crash.wasInvested && d.crash.day === 5);
  near(d.crash.market, 85 / 104 - 1 < 0 ? 85 / 104 - 1 : 0, 0.2, "marche pendant le krach (borne par la fin de partie)");
  assert.ok(d.lessons.length >= 2 && d.lessons.length <= 4, `lecons : ${d.lessons.length}`);
  assert.ok(d.lessons.some((l) => l.includes("Au krach") && l.includes("tu étais investi")), "lecon sur le krach");
  assert.ok(d.lessons.some((l) => l.includes("Ton pire trade")), "lecon sur le pire trade");
  assert.ok(d.lessons.some((l) => l.includes("stop-loss")), "lecon sur le risque (baisse > 12 %)");
  assert.strictEqual(d.trips.length, 1);
  assert.strictEqual(d.trips[0].open, true);
  assert.strictEqual(d.winRate, 0);
  assert.ok(d.maxDD < -0.15);
}

// ---- 6. Bilan : joueur a l'ecart pendant que le marche monte ----
{
  const prices = Array.from({ length: 41 }, (_, i) => 100 * (1 + i * 0.004));
  const r = replayOf(prices, { coach: "BUY" });
  const decisions = Array.from({ length: 40 }, (_, i) => ({ day: i, choice: "HOLD", fraction: 1, coach: "BUY", invested: false, followed: false, price: prices[i] }));
  const d = logic.buildDebrief(r, [], decisions, 40);
  near(d.pnl, 0, 1e-9, "aucun ordre : capital intact");
  assert.strictEqual(d.investedPct, 0);
  assert.ok(d.lessons.some((l) => l.includes("liquidités") && l.includes("Rater les hausses")), "lecon sur les hausses ratees");
  assert.ok(d.lessons.some((l) => l.includes("écarté du coach")), "lecon sur l'ecart avec le coach (0 conseil suivi)");
  assert.strictEqual(d.winRate, null);
  assert.ok(d.headline.includes("transformé"), d.headline);
}

// ---- 7. Bilan : trop d'ordres ----
{
  const prices = Array.from({ length: 21 }, (_, i) => 100 + (i % 2 ? 1 : -1));
  const r = replayOf(prices, { coach: "HOLD" });
  const trades = [];
  for (let i = 0; i < 20; i += 2) { trades.push({ day: i, side: "BUY", price: prices[i], fraction: 1 }); trades.push({ day: i + 1, side: "SELL", price: prices[i + 1] }); }
  const decisions = Array.from({ length: 20 }, (_, i) => ({ day: i, choice: i % 2 ? "SELL" : "BUY", fraction: 1, coach: "HOLD", invested: i % 2 === 1, followed: false, price: prices[i] }));
  const d = logic.buildDebrief(r, trades, decisions, 20);
  assert.ok(d.orders >= 8);
  assert.ok(d.lessons.some((l) => l.includes("frais")), d.lessons.join(" | "));
}

// ---- 8. Pire baisse ----
near(maxDrawdown([100, 120, 90, 110]), 90 / 120 - 1, 1e-12, "drawdown");
near(maxDrawdown([100, 101, 102]), 0, 1e-12, "pas de baisse");

console.log("mode debutant : tous les tests passent");
