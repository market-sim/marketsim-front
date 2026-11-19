import { useEffect, useState, type ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { analysisAdminApi, type AdminStats } from "../../../../api/endpoints";
import { errorMessage } from "../../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../../shared/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../app/components/ui/select";
import { Skeleton } from "../../../../app/components/ui/skeleton";
import { CHART_MARGIN, useChartColors, yTick } from "../../chartTheme";
import { DASH, dateTime, num, pctSigned } from "../../format";
import { typeShort } from "../../strategyRules";
import ChartTooltip, { type TooltipSeries } from "../ChartTooltip";
import { EmptyState, ErrorBanner, FIELD_DARK } from "../Feedback";

const WEEK_OPTIONS = [4, 12, 26, 52];
const count = (v: number) => String(v);
/** "2026-11-16" -> "16/11" */
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Petite carte d'un total. */
function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold text-foreground" style={MONO}>{value}</p>
    </div>
  );
}

/** Carte titree d'un graphique ou d'un tableau. */
function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <CardShell className="p-5">
      <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>{title}</h3>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </CardShell>
  );
}

/** Legende commune : trait de couleur et nom. */
function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-3 h-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Statistiques de l'administration (GET /api/analysis/admin/stats) : activite par semaine, actifs et types de
 * strategie les plus utilises, Sharpe moyen par type, utilisateurs les plus actifs, meilleures strategies.
 */
export default function AdminStatistics() {
  const c = useChartColors();
  const [weeks, setWeeks] = useState(12);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    analysisAdminApi.stats(weeks)
      .then((s) => { if (!cancelled) setStats(s); })
      .catch((e) => { if (!cancelled) setError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [weeks, reload]);

  if (error) return <ErrorBanner message={error} onRetry={() => setReload((n) => n + 1)} />;
  if (!stats) return <CardShell className="p-5 space-y-3"><Skeleton className="h-5 w-56" /><Skeleton className="h-60 w-full" /></CardShell>;

  const usage: TooltipSeries[] = [
    { key: "backtests", label: "Backtests", color: c.blue, format: count },
    { key: "comparisons", label: "Comparaisons", color: c.amber, format: count },
  ];
  const weekly = stats.weekly.map((w) => ({ ...w, label: shortDate(w.start) }));
  const assets = stats.assets;
  const types = stats.types.map((t) => ({ ...t, label: typeShort[t.type] ?? t.type, comparisons: t.inComparisons }));
  const axis = { tick: yTick(c), tickLine: false, axisLine: { stroke: c.grid } };
  const empty = stats.totals.backtests + stats.totals.comparisons === 0;

  return (
    <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <CardShell className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Statistiques des simulations</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Backtests et comparaisons enregistrés par tous les utilisateurs.</p>
          </div>
          <div className="w-full sm:w-48">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Activité sur</span>
            <Select value={String(weeks)} onValueChange={(v) => setWeeks(Number(v))}>
              <SelectTrigger className={`w-full ${FIELD_DARK}`} aria-label="Nombre de semaines"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEEK_OPTIONS.map((w) => <SelectItem key={w} value={String(w)}>{w} semaines</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 mt-4 sm:grid-cols-3">
          <Total label="Backtests enregistrés" value={stats.totals.backtests} />
          <Total label="Comparaisons enregistrées" value={stats.totals.comparisons} />
          <Total label="Utilisateurs actifs" value={stats.totals.users} />
        </div>
      </CardShell>

      {empty ? (
        <CardShell>
          <EmptyState icon={<BarChart3 className="w-6 h-6" />} title="Aucune donnée"
            text="Aucun backtest ni aucune comparaison n'a encore été enregistré." />
        </CardShell>
      ) : (
        <>
          <Panel title="Activité par semaine" subtitle={`Du lundi au dimanche, sur les ${stats.weeks} dernières semaines (semaine en cours comprise).`}>
            <Legend items={[{ color: c.blue, label: "Backtests" }, { color: c.amber, label: "Comparaisons" }]} />
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={CHART_MARGIN}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="label" {...axis} minTickGap={8} />
                  <YAxis width={36} allowDecimals={false} tick={yTick(c)} tickLine={false} axisLine={false} />
                  <Tooltip isAnimationActive={false} cursor={{ fill: c.grid }}
                    content={(p) => <ChartTooltip active={p.active} label={p.label ? `Semaine du ${p.label}` : ""} payload={p.payload} series={usage} />} />
                  <Bar dataKey="backtests" stackId="a" fill={c.blue} isAnimationActive={false} />
                  <Bar dataKey="comparisons" stackId="a" fill={c.amber} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Actifs les plus testés" subtitle="Nombre de backtests et de comparaisons par actif (10 premiers).">
              <Legend items={[{ color: c.blue, label: "Backtests" }, { color: c.amber, label: "Comparaisons" }]} />
              <div style={{ height: Math.max(120, assets.length * 30 + 30) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assets} layout="vertical" margin={{ ...CHART_MARGIN, left: 4 }}>
                    <CartesianGrid horizontal={false} stroke={c.grid} />
                    <XAxis type="number" allowDecimals={false} {...axis} />
                    <YAxis type="category" dataKey="symbol" width={72} tick={yTick(c)} tickLine={false} axisLine={false} />
                    <Tooltip isAnimationActive={false} cursor={{ fill: c.grid }}
                      content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload} series={usage} />} />
                    <Bar dataKey="backtests" stackId="a" fill={c.blue} isAnimationActive={false} />
                    <Bar dataKey="comparisons" stackId="a" fill={c.amber} radius={[0, 3, 3, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Types de stratégie" subtitle="Utilisation (chaque stratégie d'une comparaison compte une fois) et Sharpe moyen des backtests.">
              <Legend items={[{ color: c.blue, label: "Backtests" }, { color: c.amber, label: "Dans des comparaisons" }]} />
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={types} margin={CHART_MARGIN}>
                    <CartesianGrid vertical={false} stroke={c.grid} />
                    <XAxis dataKey="label" {...axis} interval={0} tick={{ ...yTick(c), fontSize: 9 }} />
                    <YAxis width={36} allowDecimals={false} tick={yTick(c)} tickLine={false} axisLine={false} />
                    <Tooltip isAnimationActive={false} cursor={{ fill: c.grid }}
                      content={(p) => <ChartTooltip active={p.active} label={p.label} payload={p.payload}
                        series={[usage[0], { ...usage[1], label: "Dans des comparaisons" }]} />} />
                    <Bar dataKey="backtests" stackId="a" fill={c.blue} isAnimationActive={false} />
                    <Bar dataKey="comparisons" stackId="a" fill={c.amber} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto mt-3">
                <table className="w-full min-w-[360px] text-[12px]">
                  <thead>
                    <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-right px-3 py-2">Backtests</th>
                      <th className="text-right px-3 py-2">Comparaisons</th>
                      <th className="text-right px-3 py-2">Sharpe moyen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {stats.types.map((t) => (
                      <tr key={t.type}>
                        <td className="px-3 py-2 text-foreground">{typeShort[t.type] ?? t.type}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground" style={MONO}>{t.backtests}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground" style={MONO}>{t.inComparisons}</td>
                        <td className="px-3 py-2 text-right font-medium text-foreground" style={MONO}>{num(t.averageSharpe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <Panel title="Utilisateurs les plus actifs" subtitle="Nombre de résultats enregistrés et Sharpe moyen de leurs backtests (10 premiers).">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-[12px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-3 py-2">Utilisateur</th>
                    <th className="text-right px-3 py-2">Backtests</th>
                    <th className="text-right px-3 py-2">Comparaisons</th>
                    <th className="text-right px-3 py-2">Sharpe moyen</th>
                    <th className="text-right px-3 py-2">Dernière activité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {stats.users.map((u) => (
                    <tr key={u.owner.id}>
                      <td className="px-3 py-2 max-w-[260px]">
                        <div className="truncate text-foreground" title={u.owner.name}>{u.owner.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{u.owner.email}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground" style={MONO}>{u.backtests}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground" style={MONO}>{u.comparisons}</td>
                      <td className="px-3 py-2 text-right font-medium text-foreground" style={MONO}>{num(u.averageSharpe)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap" style={MONO}>{dateTime(u.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Meilleures stratégies par Sharpe"
            subtitle="Pour chaque stratégie, son meilleur backtest sur une période d'au moins un an (10 premières).">
            {stats.best.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-muted-foreground">Aucun backtest d'au moins un an pour l'instant.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-[12px]">
                  <thead>
                    <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">Stratégie</th>
                      <th className="text-left px-3 py-2">Utilisateur</th>
                      <th className="text-left px-3 py-2">Actif</th>
                      <th className="text-left px-3 py-2">Période</th>
                      <th className="text-right px-3 py-2">Sharpe</th>
                      <th className="text-right px-3 py-2 whitespace-nowrap">Rend. annualisé</th>
                      <th className="text-right px-3 py-2 whitespace-nowrap">Drawdown max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {stats.best.map((b, i) => (
                      <tr key={b.backtestId}>
                        <td className="px-3 py-2 text-muted-foreground" style={MONO}>{i + 1}</td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <div className="truncate font-medium text-foreground" title={b.strategyName}>{b.strategyName}</div>
                          <div className="text-[10px] text-muted-foreground">{typeShort[b.strategyType] ?? b.strategyType}</div>
                        </td>
                        <td className="px-3 py-2 max-w-[180px] truncate text-foreground" title={b.owner.email}>{b.owner.name}</td>
                        <td className="px-3 py-2 font-medium text-foreground">{b.symbol}</td>
                        <td className="px-3 py-2 text-[11px] text-muted-foreground whitespace-nowrap" style={MONO}>{b.from} → {b.to}</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground" style={MONO}>{num(b.sharpe)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground" style={MONO}>{pctSigned(b.annualizedReturn)}</td>
                        <td className="px-3 py-2 text-right text-red-600 dark:text-red-400" style={MONO}>{b.maxDrawdown == null ? DASH : pctSigned(b.maxDrawdown)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
