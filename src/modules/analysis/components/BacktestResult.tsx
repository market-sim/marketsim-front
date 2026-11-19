import { useMemo, type ReactNode } from "react";
import type { BacktestDetail, BacktestMetrics, ExitReason } from "../../../api/endpoints";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { useChartColors } from "../chartTheme";
import {
  DASH, dateTime, gainClass, money, moneySigned, num, pctPlain, pctSigned, periodsPerYearText, price, ptsSigned, shortHash,
} from "../format";
import { paramsSummary, typeLabel, typeShort } from "../strategyRules";
import { DrawdownChart, EquityChart, type CurveRow } from "./BacktestCharts";

const REASON: Record<ExitReason, { label: string; className: string }> = {
  SIGNAL: { label: "Signal de vente", className: "bg-blue-50 text-blue-700" },
  STOP_LOSS: { label: "Stop-loss", className: "bg-red-50 text-red-700" },
  TAKE_PROFIT: { label: "Take-profit", className: "bg-emerald-50 text-emerald-700" },
  END_OF_PERIOD: { label: "Fin de période", className: "bg-slate-100 text-slate-600" },
};

const sourceLabel = (source: string) => (source === "YAHOO" ? "Yahoo Finance" : source === "CSV" ? "CSV importé" : source);

/** Carte d'une metrique : libelle, valeur, precision facultative. */
function Tile({ label, value, sub, tone = "text-foreground" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">{label}</p>
      {/* wrap-anywhere : un montant plus long que la tuile se coupe au lieu de deborder sur la tuile voisine */}
      <p className={`text-lg font-semibold wrap-anywhere ${tone}`} style={MONO}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/**
 * Groupe de tuiles. Le nombre de colonnes suit la largeur reelle du groupe (requete de conteneur @...), pas celle de
 * la fenetre : la barre laterale en prend une partie, et une tuile trop etroite coupe sa valeur sur deux lignes.
 */
function Group({ title, columns, children }: { title: string; columns: 4 | 5; children: ReactNode }) {
  return (
    <div className="@container">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h4>
      <div className={`grid grid-cols-1 @xs:grid-cols-2 @lg:grid-cols-3 gap-3 ${columns === 5 ? "@4xl:grid-cols-5" : "@3xl:grid-cols-4"}`}>{children}</div>
    </div>
  );
}

/** Lignes du tableau entrainement / test : la meme metrique lue sur chaque periode. */
const SEGMENT_ROWS: { label: string; value: (m: BacktestMetrics) => string; tone?: (m: BacktestMetrics) => string }[] = [
  { label: "Rendement total", value: (m) => pctSigned(m.totalReturn), tone: (m) => gainClass(m.totalReturn) },
  { label: "Rendement annualisé", value: (m) => pctSigned(m.annualizedReturn), tone: (m) => gainClass(m.annualizedReturn) },
  { label: "Buy & hold", value: (m) => pctSigned(m.buyHoldReturn) },
  { label: "Écart au buy & hold", value: (m) => ptsSigned(m.excessReturn), tone: (m) => gainClass(m.excessReturn) },
  { label: "Volatilité annualisée", value: (m) => pctPlain(m.volatility) },
  { label: "Ratio de Sharpe", value: (m) => num(m.sharpe) },
  { label: "Ratio de Sortino", value: (m) => num(m.sortino) },
  { label: "Ratio de Calmar", value: (m) => num(m.calmar) },
  { label: "Drawdown maximum", value: (m) => pctSigned(m.maxDrawdown), tone: (m) => gainClass(m.maxDrawdown) },
  { label: "Nombre de trades", value: (m) => String(m.tradeCount) },
  { label: "Trades gagnants", value: (m) => pctPlain(m.winRate, 0) },
  { label: "Profit factor", value: (m) => num(m.profitFactor) },
  { label: "Temps investi", value: (m) => pctPlain(m.exposure, 0) },
];

/** Ecran de resultats d'un backtest : metriques, courbes, comparaison entrainement / test, trades. */
export default function BacktestResult({ detail, actions }: { detail: BacktestDetail; actions?: ReactNode }) {
  const c = useChartColors();
  const m = detail.metrics;
  const s = detail.settings;

  const rows: CurveRow[] = useMemo(
    () => detail.curves.dates.map((date, i) => ({
      date, equity: detail.curves.equity[i], buyHold: detail.curves.buyHold[i], drawdown: detail.curves.drawdown[i],
    })),
    [detail.curves],
  );
  /** premiere seance de test : la date de coupure peut tomber un jour sans cotation */
  const splitAt = detail.splitDate ? rows.find((r) => r.date >= detail.splitDate!)?.date : undefined;

  const drawdownSub = m.maxDrawdown === 0 ? "Aucune baisse sur la période"
    : `${m.maxDrawdownDays} j · sommet le ${m.maxDrawdownPeak ?? DASH}, ${m.maxDrawdownRecovery ? `récupéré le ${m.maxDrawdownRecovery}` : "pas encore récupéré"}`;

  return (
    <div className="space-y-4">
      {/* ── En-tete et metriques ── */}
      <CardShell className="p-5 space-y-5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>{detail.strategyName} · {detail.symbol}</h3>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">{typeShort[detail.strategyType]}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1" style={MONO}>
              {detail.from} → {detail.to} · {rows.length} séances · lancé le {dateTime(detail.createdAt)}
            </p>
          </div>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>

        <p className={`rounded-lg px-4 py-3 text-[13px] leading-relaxed ${m.tradeCount === 0 ? "bg-amber-50 text-amber-700" : m.excessReturn > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {m.tradeCount === 0
            ? "Aucun trade : la stratégie n'a donné aucun signal d'achat exploitable sur la période, le capital est resté en liquidités."
            : <>Sur la période, la stratégie fait <b>{pctSigned(m.totalReturn)}</b> contre <b>{pctSigned(m.buyHoldReturn)}</b> pour le buy &amp; hold :
              elle fait {m.excessReturn > 0 ? "mieux" : "moins bien"} de <b>{(Math.abs(m.excessReturn) * 100).toFixed(1)} pts</b>.
              {/* une strategie buy & hold ne colle pas exactement a la reference : on dit pourquoi */}
              {detail.strategyType === "BUY_AND_HOLD" && (
                <> L'écart vient de l'exécution : la stratégie achète à la clôture du lendemain (J+1) et paie les frais,
                  alors que la référence investit dès la première clôture, sans frais.</>
              )}</>}
        </p>

        <Group title="Performance" columns={5}>
          <Tile label="Capital final" value={money(m.finalCapital)} sub={`Départ ${money(s.initialCapital)}`} />
          <Tile label="Rendement total" value={pctSigned(m.totalReturn)} tone={gainClass(m.totalReturn)} />
          <Tile label="Rendement annualisé" value={pctSigned(m.annualizedReturn)} tone={gainClass(m.annualizedReturn)} />
          <Tile label="Buy & hold" value={pctSigned(m.buyHoldReturn)} sub="Même période, sans frais" />
          <Tile label="Écart au buy & hold" value={ptsSigned(m.excessReturn)} tone={gainClass(m.excessReturn)} sub="Points de pourcentage" />
        </Group>

        <Group title="Risque" columns={5}>
          <Tile label="Volatilité annualisée" value={pctPlain(m.volatility)} />
          <Tile label="Ratio de Sharpe" value={num(m.sharpe)}
            sub={(s.riskFreeRate ?? 0) > 0 ? `Au-dessus de ${pctPlain(s.riskFreeRate, 2)} / risque total` : "Rendement / risque total"} />
          <Tile label="Ratio de Sortino" value={num(m.sortino)} sub={m.sortino == null ? "Aucune séance en baisse" : "Rendement / risque de baisse"} />
          <Tile label="Ratio de Calmar" value={num(m.calmar)} sub={m.calmar == null ? "Non calculable" : "Annualisé / drawdown max"} />
          <Tile label="Drawdown maximum" value={pctSigned(m.maxDrawdown)} tone={gainClass(m.maxDrawdown)} sub={drawdownSub} />
        </Group>

        <Group title="Trades" columns={4}>
          <Tile label="Nombre de trades" value={String(m.tradeCount)} sub="Allers-retours complets" />
          <Tile label="Trades gagnants" value={pctPlain(m.winRate, 0)} />
          <Tile label="Temps investi" value={pctPlain(m.exposure, 0)} sub="Part des séances en position" />
          <Tile label="Profit factor" value={num(m.profitFactor)} sub={m.profitFactor == null && m.tradeCount > 0 ? "Aucun trade perdant" : "Gains / pertes"} />
          <Tile label="Gain moyen" value={moneySigned(m.averageWin)} tone={gainClass(m.averageWin)} sub={m.averageWinReturn == null ? undefined : pctSigned(m.averageWinReturn)} />
          <Tile label="Perte moyenne" value={moneySigned(m.averageLoss)} tone={gainClass(m.averageLoss)} sub={m.averageLossReturn == null ? undefined : pctSigned(m.averageLossReturn)} />
          <Tile label="Durée moyenne de détention" value={m.averageHoldingDays == null ? DASH : `${Math.round(m.averageHoldingDays)} j`} sub="Jours calendaires" />
        </Group>
      </CardShell>

      {/* ── Courbes ── */}
      <CardShell className="p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Capital : stratégie et buy &amp; hold</h3>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-3.5 h-0.5 rounded-full" style={{ background: c.blue }} />Stratégie</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-3.5 h-0.5 rounded-full" style={{ background: c.neutral }} />Buy &amp; hold</span>
        </div>
        <div className="h-72"><EquityChart rows={rows} splitAt={splitAt} /></div>
        <h4 className="text-[12px] font-semibold text-foreground mt-4 pt-3 border-t border-border/60 mb-1" style={DISPLAY}>Drawdown de la stratégie</h4>
        <div className="h-36"><DrawdownChart rows={rows} splitAt={splitAt} /></div>
      </CardShell>

      {/* ── Entrainement / test ── */}
      {detail.train && detail.test && (
        <CardShell className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Avant et après la date de coupure ({detail.splitDate})</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Chaque période est rejouée séparément, en repartant du capital initial et sans position. Une stratégie réglée sur
              l'entraînement qui s'effondre sur le test est probablement sur-ajustée.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-3">Métrique</th>
                  {[["Entraînement", detail.train.from, detail.train.to], ["Test", detail.test.from, detail.test.to], ["Période complète", detail.from, detail.to]].map(([name, from, to]) => (
                    <th key={name} className="text-right px-5 py-3">
                      {name}<div className="font-normal normal-case tracking-normal mt-0.5" style={MONO}>{from} → {to}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {SEGMENT_ROWS.map((row) => (
                  <tr key={row.label} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-2.5 text-muted-foreground">{row.label}</td>
                    {[detail.train!.metrics, detail.test!.metrics, m].map((metrics, i) => (
                      <td key={i} className={`px-5 py-2.5 text-right ${row.tone ? row.tone(metrics) : "text-foreground"}`} style={MONO}>{row.value(metrics)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardShell>
      )}

      {/* ── Parametres et limites ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardShell className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2" style={DISPLAY}>Paramètres du backtest</h3>
          {[
            ["Stratégie", typeLabel[detail.strategyType]],
            ["Paramètres", paramsSummary(detail.strategyType, detail.params)],
            ["Capital initial", money(s.initialCapital)],
            ["Frais par ordre", pctPlain(s.feeRate, 2)],
            ["Glissement de prix", pctPlain(s.slippage, 2)],
            ["Stop-loss", s.stopLoss == null ? "Aucun" : pctPlain(s.stopLoss)],
            ["Take-profit", s.takeProfit == null ? "Aucun" : pctPlain(s.takeProfit)],
            ["Part du capital engagée", pctPlain(s.positionFraction, 0)],
            ["Taux sans risque", `${pctPlain(s.riskFreeRate ?? 0, 2)} par an`],
            ["Annualisation", periodsPerYearText(detail.periodsPerYear)],
            ["Date de coupure", detail.splitDate ?? "Aucune"],
            ["Données", `${sourceLabel(detail.dataSource)} · empreinte ${shortHash(detail.dataHash)}`],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0 text-[12px]">
              <span className="text-muted-foreground shrink-0">{label}</span>
              <span className="font-medium text-foreground text-right" style={MONO}>{value}</span>
            </div>
          ))}
        </CardShell>

        <CardShell className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2" style={DISPLAY}>Comment lire ce résultat</h3>
          <ul className="space-y-1.5 text-[12px] text-muted-foreground list-disc pl-4">
            <li>Le signal est calculé à la clôture du jour J et l'ordre est exécuté à la clôture du jour J+1 : aucune donnée future n'est utilisée.</li>
            <li>L'historique ne contient que les clôtures : stop-loss et take-profit sont vérifiés à la clôture, pas en cours de séance.</li>
            <li>Achat uniquement, une position à la fois. La position encore ouverte est vendue le dernier jour.</li>
            <li>Le buy &amp; hold de référence investit tout le capital à la première clôture, sans frais.</li>
            <li>Biais du survivant : on ne teste que des actifs qui existent encore aujourd'hui.</li>
          </ul>
        </CardShell>
      </div>

      {/* ── Trades ── */}
      <CardShell className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Trades</h3>
          <span className="text-[11px] text-muted-foreground">{detail.trades.length} aller{detail.trades.length > 1 ? "s" : ""}-retour{detail.trades.length > 1 ? "s" : ""}</span>
        </div>
        {detail.trades.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-muted-foreground">Aucun trade sur cette période.</p>
        ) : (
          <div className="overflow-auto max-h-[520px]">
            <table className="w-full min-w-[880px] text-[12px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {["#", "Entrée", "Prix d'entrée", "Sortie", "Prix de sortie", "Durée", "Résultat", "Rendement", "Frais", "Raison de la sortie"].map((h, i) => (
                    <th key={h} className={`sticky top-0 bg-card border-b border-border/60 py-3 ${i === 0 ? "pl-5 pr-3 text-left" : i === 9 ? "px-5 text-left" : i === 1 || i === 3 ? "px-3 text-left" : "px-3 text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {detail.trades.map((t, i) => (
                  <tr key={`${t.entryDate}-${i}`} className="hover:bg-muted/10 transition-colors">
                    <td className="pl-5 pr-3 py-2.5 text-muted-foreground" style={MONO}>{i + 1}</td>
                    <td className="px-3 py-2.5 text-foreground" style={MONO}>{t.entryDate}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground" style={MONO}>{price(t.entryPrice)}</td>
                    <td className="px-3 py-2.5 text-foreground" style={MONO}>{t.exitDate}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground" style={MONO}>{price(t.exitPrice)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground" style={MONO}>{t.holdingDays} j</td>
                    <td className={`px-3 py-2.5 text-right font-medium ${gainClass(t.pnl)}`} style={MONO}>{moneySigned(t.pnl)}</td>
                    <td className={`px-3 py-2.5 text-right ${gainClass(t.returnRate)}`} style={MONO}>{pctSigned(t.returnRate, 2)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground" style={MONO}>{money(t.fees)}</td>
                    <td className="px-5 py-2.5">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${REASON[t.reason].className}`}>{REASON[t.reason].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>
    </div>
  );
}
