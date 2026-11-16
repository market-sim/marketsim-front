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

// ======================= Module 2 : logique du formulaire de trading =======================
{
  const src = path.join(FRONT, "src/modules/trading/tradingLogic.ts");
  const js = ts.transpileModule(fs.readFileSync(src, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  fs.writeFileSync(path.join(OUT, "tradingLogic.js"), js);
  const t = require(path.join(OUT, "tradingLogic.js"));
  const form = { symbol: "AAPL", side: "BUY", orderType: "MARKET", quantity: "10", limitPrice: "999", stopLoss: "", takeProfit: "" };

  // MARKET : jamais de prix envoye (ni price, ni limitPrice)
  const m = t.buildOrderRequest(form).request;
  assert.ok(m && !("price" in m) && !("limitPrice" in m), "MARKET sans prix");
  assert.strictEqual(m.quantity, 10);
  assert.strictEqual(m.stopLoss, null);

  // LIMIT / STOP : prix limite obligatoire, virgule francaise acceptee
  assert.ok(t.buildOrderRequest({ ...form, orderType: "LIMIT", limitPrice: "" }).error, "LIMIT sans niveau refuse");
  assert.strictEqual(t.buildOrderRequest({ ...form, orderType: "STOP", limitPrice: "150,5" }).request.limitPrice, 150.5);

  // saisies invalides
  assert.ok(t.buildOrderRequest({ ...form, quantity: "0" }).error);
  assert.ok(t.buildOrderRequest({ ...form, quantity: "abc" }).error);
  assert.ok(t.buildOrderRequest({ ...form, stopLoss: "-3" }).error);
  assert.ok(t.buildOrderRequest({ ...form, symbol: "" }).error);
  assert.strictEqual(t.buildRiskRequest({ ...form, quantity: "" }), null, "pas de simulation de risque sur un formulaire incomplet");
  assert.deepStrictEqual(t.buildRiskRequest({ ...form, stopLoss: "180" }),
    { symbol: "AAPL", side: "BUY", orderType: "MARKET", quantity: 10, limitPrice: null, stopLoss: 180 });

  // niveaux de risque
  assert.strictEqual(t.riskStyle("BLOCKED").label, "Ordre bloqué");
  assert.ok(t.riskStyle("LOW").bar.includes("emerald"));
  assert.strictEqual(t.riskStyle(undefined).label, "—");

  // repartition des onglets et historique trie (plus recent d'abord)
  const orders = [
    { id: 1, status: "OPEN" }, { id: 2, status: "PENDING" },
    { id: 3, status: "CLOSED", closedAt: "2026-11-01T10:00:00", closeReason: "STOP_LOSS" },
    { id: 4, status: "REJECTED", createdAt: "2026-11-02T10:00:00", rejectReason: "Solde insuffisant" },
    { id: 5, status: "CANCELLED", createdAt: "2026-10-01T10:00:00" },
  ];
  const s = t.splitOrders(orders);
  assert.deepStrictEqual(s.open.map((o) => o.id), [1]);
  assert.deepStrictEqual(s.pending.map((o) => o.id), [2]);
  assert.deepStrictEqual(s.history.map((o) => o.id), [4, 3, 5]);
  assert.strictEqual(t.historyReason(orders[2]), "Stop-loss");
  assert.strictEqual(t.historyReason(orders[3]), "Solde insuffisant");
  assert.strictEqual(t.historyReason(orders[4]), "Annulé");

  // signe explicite, pas de "-0"
  const f = (n) => n.toFixed(2);
  assert.strictEqual(t.signed(75.5, f), "+75.50");
  assert.strictEqual(t.signed(-53.2, f), "-53.20");
  assert.strictEqual(t.signed(-0.001, f), "0.00");
  console.log("module 2 trading : tous les tests passent");
}

// ======================= Module 2 : ameliorations (lots 1 et 2) =======================
{
  const t = require(path.join(OUT, "tradingLogic.js"));
  // distance au declenchement
  near(t.distancePct(95, 100), -5, 1e-9, "SL 5 % sous le prix");
  assert.strictEqual(t.distancePct(null, 100), null);
  assert.strictEqual(t.formatDistance(t.distancePct(103.2, 100)), "+3.20 %");
  assert.strictEqual(t.formatDistance(null), "");

  // estimation de cloture (LONG et SHORT), memes regles que le serveur
  const long = { status: "OPEN", side: "BUY", quantity: 10, price: 192.45, executedPrice: 192.45, currentPrice: 200 };
  assert.deepStrictEqual(t.estimateClose(long), { pnl: 75.5, closeFee: 2, net: 73.5 });
  const short = { ...long, side: "SELL", currentPrice: 180 };
  assert.deepStrictEqual(t.estimateClose(short), { pnl: 124.5, closeFee: 1.8, net: 122.7 });
  assert.strictEqual(t.estimateClose({ ...long, status: "CLOSED" }), null);

  // filtres de l'historique
  const h = [
    { id: 1, status: "CLOSED", symbol: "AAPL", createdAt: "2026-11-01T09:00:00" },
    { id: 2, status: "REJECTED", symbol: "BTC/USD", createdAt: "2026-11-05T09:00:00" },
    { id: 3, status: "CANCELLED", symbol: "AAPL", createdAt: "2026-11-10T23:59:00" },
  ];
  const ids = (f) => t.filterHistory(h, { status: "", symbol: "", from: "", to: "", ...f }).map((o) => o.id);
  assert.deepStrictEqual(ids({}), [1, 2, 3]);
  assert.deepStrictEqual(ids({ symbol: "AAPL" }), [1, 3]);
  assert.deepStrictEqual(ids({ status: "REJECTED" }), [2]);
  assert.deepStrictEqual(ids({ from: "2026-11-05", to: "2026-11-10" }), [2, 3], "bornes incluses");

  // decomposition du score : somme des points ~ score serveur
  const parts = t.riskBreakdown({ concentration: 0.588, orderSize: 0.941, volatility: 0.875, grossExposure: 0.635, liquidity: 0.636 });
  near(parts.reduce((s, p) => s + p.points, 0), 75, 0.6, "score reconstruit");
  assert.strictEqual(parts[0].label, "Concentration");
  assert.deepStrictEqual(t.riskBreakdown(null), []);

  // mise a jour partielle SL/TP
  const o = { stopLoss: 180, takeProfit: 215 };
  assert.deepStrictEqual(t.buildProtectionUpdate(o, "185", "215").request, { stopLoss: 185 }, "seul le champ modifie part");
  assert.deepStrictEqual(t.buildProtectionUpdate(o, "", "215").request, { clearStopLoss: true }, "champ vide = effacement");
  assert.deepStrictEqual(t.buildProtectionUpdate({ stopLoss: null, takeProfit: null }, "", "250").request, { takeProfit: 250 });
  assert.ok(t.buildProtectionUpdate(o, "180", "215").error, "aucune modification");
  assert.ok(t.buildProtectionUpdate(o, "-1", "").error);
  console.log("module 2 ameliorations : tous les tests passent");
}

// ======================= Module 1 : profil, mots de passe, liste admin =======================
{
  const src = path.join(FRONT, "src/modules/auth/userLogic.ts");
  const js = ts.transpileModule(fs.readFileSync(src, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  fs.writeFileSync(path.join(OUT, "userLogic.js"), js);
  const u = require(path.join(OUT, "userLogic.js"));

  // progression de niveau : seuils 25 / 50 / 75 du modele serveur
  assert.deepStrictEqual(u.levelProgress(0), { level: "DEBUTANT", next: "INTERMEDIAIRE", pointsToNext: 25, pctInLevel: 0, index: 0 });
  const p = u.levelProgress(60);
  assert.strictEqual(p.level, "AVANCE");
  assert.strictEqual(p.next, "EXPERT");
  assert.strictEqual(p.pointsToNext, 15);
  assert.strictEqual(p.pctInLevel, 40);
  assert.strictEqual(u.levelProgress(100).next, null);
  assert.strictEqual(u.levelProgress(null).level, "DEBUTANT");
  assert.strictEqual(u.reasonText("RISK_CONTROLS_USED"), "Utilisation des stop-loss / take-profit");
  assert.strictEqual(u.reasonText("UNKNOWN_CODE"), "UNKNOWN_CODE");

  // conseils : un par critere manquant, chiffres a partir des ordres
  const orders = [{ symbol: "AAPL", stopLoss: 180 }, { symbol: "AAPL" }, { symbol: "AAPL" }];
  const facts = u.activityFacts(orders, 4);
  assert.deepStrictEqual(facts, { logins: 4, orders: 3, protectedOrders: 1, symbols: 1 });
  const tips = u.levelTips(["RISK_CONTROLS_USED"], facts);
  assert.ok(!tips.some((t) => t.code === "RISK_CONTROLS_USED"), "critere rempli : pas de conseil");
  assert.deepStrictEqual(tips.map((t) => t.code), ["TRADING_ACTIVITY", "DIVERSIFIED_SYMBOLS", "ENGAGED_LOGINS", "PROFILE_MAINTAINED"]);
  const protect = u.levelTips([], facts).find((t) => t.code === "RISK_CONTROLS_USED");
  assert.strictEqual(protect.target, 2, "40 % de 3 ordres -> 2 ordres proteges");
  assert.strictEqual(protect.done, false, "1 ordre protege sur 2 requis");
  const rich = u.levelTips([], { logins: 2, orders: 5, protectedOrders: 2, symbols: 2 });
  assert.strictEqual(rich.find((t) => t.code === "TRADING_ACTIVITY").done, true, "objectif atteint -> coche");
  assert.strictEqual(rich.find((t) => t.code === "DIVERSIFIED_SYMBOLS").done, true);
  assert.strictEqual(rich.find((t) => t.code === "ENGAGED_LOGINS").done, false);
  assert.strictEqual(rich.find((t) => t.code === "PROFILE_MAINTAINED").done, false, "jamais coche (donnee non exposee)");

  // score de securite : haut = risque
  assert.ok(u.securityStyle("HIGH").bar.includes("red"));
  assert.strictEqual(u.securityStyle(null).label, "—");

  // mot de passe
  assert.strictEqual(u.passwordStrength("abc").score, 0);
  assert.ok(u.passwordStrength("Abcdef12!xyz").score >= 3);
  assert.ok(u.passwordStrength("abcdefgh").score < u.passwordStrength("Abcdefg1!").score);
  assert.strictEqual(u.passwordError("abc", "abc"), "Le mot de passe doit contenir au moins 6 caractères.");
  assert.strictEqual(u.passwordError("abcdef", "abcdeg"), "Les deux mots de passe ne correspondent pas.");
  assert.strictEqual(u.passwordError("abcdef", "abcdef"), null);

  // liste admin : recherche, filtres, tri
  const users = [
    { id: 1, firstName: "Sara", lastName: "Ben Ali", email: "sara@x.tn", role: "USER", level: "AVANCE", enabled: true, createdAt: "2026-10-01" },
    { id: 2, firstName: "Admin", lastName: "Root", email: "admin@x.tn", role: "ADMIN", level: "DEBUTANT", enabled: true, createdAt: "2026-09-01" },
    { id: 3, firstName: "Omar", lastName: "Trabelsi", email: "omar@x.tn", role: "USER", level: "EXPERT", enabled: false, createdAt: "2026-11-01" },
  ];
  const all = { q: "", role: "", status: "", level: "" };
  const ids = (f, s, d) => u.filterUsers(users, { ...all, ...f }, s, d).map((x) => x.id);
  assert.deepStrictEqual(ids({}), [1, 2, 3], "tri par nom de famille");
  assert.deepStrictEqual(ids({ q: "OMAR" }), [3], "recherche insensible a la casse");
  assert.deepStrictEqual(ids({ q: "x.tn", role: "USER" }), [1, 3]);
  assert.deepStrictEqual(ids({ status: "DISABLED" }), [3]);
  assert.deepStrictEqual(ids({ level: "AVANCE" }), [1]);
  assert.deepStrictEqual(ids({}, "level", true), [3, 1, 2], "niveau decroissant");
  assert.deepStrictEqual(ids({}, "createdAt"), [2, 1, 3]);
  console.log("module 1 profil / admin : tous les tests passent");
}
