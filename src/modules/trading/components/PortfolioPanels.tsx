import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, MONO, DISPLAY, CardShell } from "../../../shared/ui";
import type { EquityPoint, Portfolio, RiskAssessment } from "../../../api/endpoints";
import { riskBreakdown, signed } from "../tradingLogic";

const ALLOC_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4", "#EC4899", "#84CC16"];
const CASH_COLOR = "#94A3B8";

/** Courbe d'equity (GET /portfolio/history), precedee du capital initial et terminee par l'equity courante. */
export function EquityCurve({ history, portfolio }: { history: EquityPoint[]; portfolio: Portfolio | null }) {
  const initial = portfolio?.initialCapital ?? 100000;
  const points = [
    { label: "Départ", equity: initial },
    ...history.map((h) => ({ label: new Date(h.at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), equity: Number(h.equity) })),
    ...(portfolio ? [{ label: "Maintenant", equity: Number(portfolio.equity) }] : []),
  ];
  const values = points.map((p) => p.equity);
  const pad = Math.max(50, (Math.max(...values) - Math.min(...values)) * 0.2);
  const up = (portfolio?.equity ?? initial) >= initial;
  const color = up ? "#10B981" : "#EF4444";
  return (
    <CardShell className="p-4 col-span-2 md:col-span-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Courbe d'equity</p>
        <span className="text-[11px] text-muted-foreground">{history.length} mouvement(s) de solde</span>
      </div>
      {history.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">La courbe apparaîtra après votre premier ordre exécuté.</p>
      ) : (
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={points} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" strokeOpacity={0.4} interval="preserveStartEnd" />
            <YAxis domain={[Math.min(...values) - pad, Math.max(...values) + pad]} tick={{ fontSize: 10 }} width={70}
              stroke="currentColor" strokeOpacity={0.4} tickFormatter={(v: number) => Math.round(v).toLocaleString("fr-FR")} />
            <Tooltip formatter={(v: number) => [fmt(v), "Equity"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <ReferenceLine y={initial} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="4 4" />
            <Area type="stepAfter" dataKey="equity" stroke={color} strokeWidth={2} fill="url(#equityFill)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </CardShell>
  );
}

/** Positions agregees par actif (portfolio.positions) + repartition du capital. */
export function PositionsBySymbol({ portfolio }: { portfolio: Portfolio | null }) {
  const positions = portfolio?.positions ?? [];
  if (positions.length === 0) {
    return <p className="px-5 py-6 text-center text-xs text-muted-foreground">Aucune position ouverte.</p>;
  }
  const slices = [
    ...positions.map((p) => ({ name: p.symbol, value: Number(p.grossExposure) })),
    { name: "Liquidités", value: Math.max(0, Number(portfolio?.cash ?? 0)) },
  ];
  const th = "text-right px-4 py-3";
  const td = "px-4 py-3.5 text-right text-sm";
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
              <th className="text-left px-5 py-3">Actif</th><th className={th}>Net</th><th className={th}>Long / Short</th>
              <th className={th}>Entrée moy.</th><th className={th}>Cours</th><th className={th}>Valeur</th>
              <th className={th}>P&amp;L latent</th><th className="text-left px-4 py-3 w-[150px]">Poids</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {positions.map((p, i) => (
              <tr key={p.symbol} className="hover:bg-muted/10 transition-colors">
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                    {p.symbol}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">{p.tickets} ticket(s)</span>
                </td>
                <td className={`${td} font-medium ${Number(p.netQuantity) >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{Number(p.netQuantity)}</td>
                <td className={`${td} text-muted-foreground`} style={MONO}>{Number(p.longQuantity)} / {Number(p.shortQuantity)}</td>
                <td className={`${td} text-muted-foreground`} style={MONO}>{fmt(Number(p.avgEntryPrice))}</td>
                <td className={`${td} text-foreground`} style={MONO}>{fmt(Number(p.marketPrice))}</td>
                <td className={`${td} text-foreground`} style={MONO}>{fmt(Number(p.marketValue))}</td>
                <td className={`${td} font-medium ${Number(p.unrealizedPnl) >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{signed(Number(p.unrealizedPnl), fmt)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, Number(p.weightPct))}%`, background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                    </div>
                    <span className="text-[11px] text-muted-foreground w-12 text-right" style={MONO}>{Number(p.weightPct).toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t xl:border-t-0 xl:border-l border-border/60">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1" style={DISPLAY}>Répartition</p>
        <ResponsiveContainer width="100%" height={170}>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
              {slices.map((s, i) => <Cell key={s.name} fill={s.name === "Liquidités" ? CASH_COLOR : ALLOC_COLORS[i % ALLOC_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [fmt(v), n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="space-y-1">
          {slices.map((s, i) => (
            <li key={s.name} className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: s.name === "Liquidités" ? CASH_COLOR : ALLOC_COLORS[i % ALLOC_COLORS.length] }} />{s.name}
              </span>
              <span className="text-foreground" style={MONO}>{fmt(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Apercu de l'ordre (montants) + decomposition du score de risque en 5 composantes. */
export function OrderPreview({ risk }: { risk: RiskAssessment }) {
  const m = risk.metrics;
  const parts = riskBreakdown(risk.components);
  const rows: [string, string, string?][] = [
    ["Montant (notional)", fmt(m.notional), `${m.orderPctOfEquity}% de l'equity`],
    ["Frais d'ouverture", fmt(m.fee)],
    ["Solde après ordre", fmt(m.cashAfter), `${m.cashAfterPct}% de l'equity`],
    ["VaR 95 % (1 jour)", fmt(m.var95), `σ ${m.volatilityAnnualPct}% · ${m.volatilitySource === "REAL" ? "données réelles" : "modèle"}`],
  ];
  return (
    <div className="mt-2 space-y-2">
      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-1">
        {rows.map(([label, value, sub]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right">
              <span className="text-foreground" style={MONO}>{value}</span>
              {sub && <span className="text-[10px] text-muted-foreground block">{sub}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {parts.map((p) => (
          <div key={p.key} className="grid grid-cols-[110px_1fr_52px] items-center gap-2 text-[10px]">
            <span className="text-muted-foreground truncate">{p.label}</span>
            <div className="h-1 bg-muted rounded-full">
              <div className="h-1 rounded-full bg-blue-500" style={{ width: `${p.ratio * 100}%` }} />
            </div>
            <span className="text-right text-foreground" style={MONO}>{p.points}/{p.weight}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
