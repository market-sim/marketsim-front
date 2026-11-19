import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, Inbox, Trash2 } from "lucide-react";
import {
  analysisAdminApi, type AdminBacktestItem, type AdminComparisonItem, type AdminOwner, type AdminUserActivity,
  type Asset, type BacktestDetail, type ResultPage, type SavedComparisonDetail, type StrategyType,
} from "../../../../api/endpoints";
import { errorMessage } from "../../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../../shared/ui";
import { Button } from "../../../../app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../app/components/ui/select";
import { Skeleton } from "../../../../app/components/ui/skeleton";
import { rankingFromApi, type RankingMetric } from "../../comparison";
import { ignoreNotFound } from "../../errors";
import { DASH, dateTime, gainClass, num, pctSigned } from "../../format";
import { STRATEGY_TYPES, typeShort } from "../../strategyRules";
import BacktestResult from "../BacktestResult";
import ComparisonResult from "../ComparisonResult";
import ConfirmDialog from "../ConfirmDialog";
import { EmptyState, ErrorBanner, FIELD_DARK, OUTLINE_DARK } from "../Feedback";

export type ResultsView = "backtests" | "comparisons";

const PAGE_SIZE = 25;
const ALL = "all";

interface Props {
  assets: Asset[];
  view: ResultsView;
  /** element ouvert en lecture seule, ou null pour la liste */
  openId: number | null;
  onNavigate: (params: Record<string, string>) => void;
}

/** Proprietaire d'un resultat : nom, puis e-mail en petit. */
function OwnerCell({ owner }: { owner: AdminOwner }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-foreground" title={owner.name}>{owner.name}</div>
      <div className="truncate text-[10px] text-muted-foreground" title={owner.email}>{owner.email}</div>
    </div>
  );
}

/** Bandeau du detail : a qui appartient le resultat, et rappel de la lecture seule. */
function OwnerBanner({ owner, kind }: { owner: AdminOwner; kind: string }) {
  return (
    <p className="rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5 text-[12px] text-muted-foreground">
      {kind} de <span className="font-medium text-foreground">{owner.name}</span> ({owner.email}). Lecture seule :
      {kind === "Backtest" ? " seul son propriétaire peut le relancer." : " seul son propriétaire peut la renommer ou la relancer."}
    </p>
  );
}

/**
 * Resultats de tous les utilisateurs (GET /api/analysis/admin/backtests et /comparisons) : filtres par utilisateur,
 * actif et type de strategie, pages de {@value PAGE_SIZE}, detail en lecture seule et suppression.
 */
export default function AdminResults({ assets, view, openId, onNavigate }: Props) {
  const [users, setUsers] = useState<AdminUserActivity[]>([]);
  const [userId, setUserId] = useState(ALL);
  const [symbol, setSymbol] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [page, setPage] = useState(0);
  const [backtests, setBacktests] = useState<ResultPage<AdminBacktestItem> | null>(null);
  const [comparisons, setComparisons] = useState<ResultPage<AdminComparisonItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [backtest, setBacktest] = useState<{ owner: AdminOwner; backtest: BacktestDetail } | null>(null);
  const [comparison, setComparison] = useState<{ owner: AdminOwner; comparison: SavedComparisonDetail } | null>(null);
  const [criterion, setCriterion] = useState<RankingMetric>("sharpe");
  const [detailError, setDetailError] = useState("");
  const [toDelete, setToDelete] = useState<{ id: number; label: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // utilisateurs ayant des resultats (filtre), relus apres une suppression
  useEffect(() => {
    analysisAdminApi.users().then(setUsers).catch(() => setUsers([]));
  }, [reload]);

  // une autre liste ou d'autres filtres : on repart de la premiere page
  useEffect(() => setPage(0), [view, userId, symbol, type]);

  useEffect(() => {
    if (openId != null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const filters = {
      userId: userId === ALL ? undefined : Number(userId),
      symbol: symbol === ALL ? undefined : symbol,
      type: type === ALL ? undefined : (type as StrategyType),
      page, size: PAGE_SIZE,
    };
    const request = view === "backtests"
      ? analysisAdminApi.backtests(filters).then((p) => { if (!cancelled) setBacktests(p); })
      : analysisAdminApi.comparisons(filters).then((p) => { if (!cancelled) setComparisons(p); });
    request.catch((e) => { if (!cancelled) setError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [view, userId, symbol, type, page, reload, openId]);

  // detail en lecture seule
  useEffect(() => {
    if (openId == null) return;
    let cancelled = false;
    setBacktest(null);
    setComparison(null);
    setDetailError("");
    const request = view === "backtests"
      ? analysisAdminApi.backtest(openId).then((d) => { if (!cancelled) setBacktest(d); })
      : analysisAdminApi.comparison(openId).then((d) => {
        if (cancelled) return;
        setComparison(d);
        setCriterion(rankingFromApi(d.comparison.rankBy));
      });
    request.catch((e) => { if (!cancelled) setDetailError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [view, openId]);

  // en ouvrant un element (ou en revenant a la liste) depuis un ecran defile, on repart du haut
  useEffect(() => {
    const top = topRef.current;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start" });
  }, [openId, backtest, comparison]);

  const open = (id: number | null) => onNavigate(id == null ? { view } : { view, id: String(id) });
  const kind = view === "backtests" ? "Backtest" : "Comparaison";

  const confirmDelete = toDelete && (
    <ConfirmDialog title={`Supprimer ce${view === "backtests" ? " backtest" : "tte comparaison"} ?`} confirmLabel="Supprimer"
      description={<>« {toDelete.label} » sera supprimé{view === "backtests" ? "" : "e"} pour son propriétaire.
        {view === "backtests" ? " Le résumé de sa stratégie revient au backtest précédent." : " Les stratégies ne sont pas touchées."} Cette action est définitive.</>}
      onConfirm={async () => {
        await (view === "backtests" ? analysisAdminApi.deleteBacktest(toDelete.id) : analysisAdminApi.deleteComparison(toDelete.id))
          .catch(ignoreNotFound);
        if (openId === toDelete.id) open(null);
        setReload((n) => n + 1);
      }}
      onClose={() => setToDelete(null)} />
  );

  // ─── Detail en lecture seule ───
  if (openId != null) {
    const deleteButton = (id: number, label: string) => (
      <Button variant="outline" size="sm" className={`text-red-600 hover:text-red-700 dark:text-red-400 ${OUTLINE_DARK}`}
        onClick={() => setToDelete({ id, label })}>
        <Trash2 />Supprimer
      </Button>
    );
    return (
      <div ref={topRef} className="space-y-4 scroll-mt-4">
        <Button variant="ghost" size="sm" onClick={() => open(null)}><ArrowLeft />Retour aux résultats</Button>
        {detailError && <ErrorBanner message={detailError} />}
        {!detailError && !backtest && !comparison && (
          <CardShell className="p-5 space-y-3"><Skeleton className="h-5 w-72" /><Skeleton className="h-72 w-full" /></CardShell>
        )}
        {backtest && (
          <>
            <OwnerBanner owner={backtest.owner} kind="Backtest" />
            <BacktestResult detail={backtest.backtest}
              actions={deleteButton(backtest.backtest.id, `${backtest.backtest.strategyName} · ${backtest.backtest.symbol}`)} />
          </>
        )}
        {comparison && (
          <>
            <OwnerBanner owner={comparison.owner} kind="Comparaison" />
            <ComparisonResult result={comparison.comparison.result} criterion={criterion} onCriterionChange={setCriterion}
              saved={{ name: comparison.comparison.name, createdAt: comparison.comparison.createdAt }}
              statuses={comparison.comparison.strategyStatus}
              actions={deleteButton(comparison.comparison.id, comparison.comparison.name)} />
          </>
        )}
        {confirmDelete}
      </div>
    );
  }

  // ─── Liste ───
  const current = view === "backtests" ? backtests : comparisons;
  const total = current?.total ?? 0;
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = Math.min(total, (page + 1) * PAGE_SIZE);
  const select = (label: string, value: string, onChange: (v: string) => void, options: { value: string; label: string }[]) => (
    <div className="w-full sm:w-52">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={`w-full ${FIELD_DARK}`} aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div ref={topRef} className="scroll-mt-4">
      <CardShell className="overflow-hidden">
        <div className="space-y-3 px-5 py-4 border-b border-border/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Résultats de tous les utilisateurs</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Du plus récent au plus ancien. Ouvrez une ligne pour la voir en lecture seule.</p>
            </div>
            <div role="group" aria-label="Type de résultat" className="flex w-full gap-0.5 rounded-lg border border-border p-0.5 sm:w-fit">
              {(["backtests", "comparisons"] as ResultsView[]).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => onNavigate({ view: v })}
                  className={`flex-1 sm:flex-none px-3.5 h-8 rounded-md text-[13px] font-medium transition-colors ${view === v ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted/50"}`}>
                  {v === "backtests" ? "Backtests" : "Comparaisons"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {select("Utilisateur", userId, setUserId, [{ value: ALL, label: "Tous les utilisateurs" },
              ...users.map((u) => ({ value: String(u.owner.id), label: `${u.owner.name} (${u.backtests + u.comparisons})` }))])}
            {select("Actif", symbol, setSymbol, [{ value: ALL, label: "Tous les actifs" },
              ...assets.map((a) => ({ value: a.symbol, label: a.symbol }))])}
            {select("Type de stratégie", type, setType, [{ value: ALL, label: "Tous les types" },
              ...STRATEGY_TYPES.map((t) => ({ value: t, label: typeShort[t] }))])}
          </div>
        </div>

        {error && <div className="p-4"><ErrorBanner message={error} onRetry={() => setReload((n) => n + 1)} /></div>}
        {current == null && !error && <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
        {current != null && current.items.length === 0 && !error && (
          <EmptyState icon={<Inbox className="w-6 h-6" />} title={view === "backtests" ? "Aucun backtest" : "Aucune comparaison"}
            text="Aucun résultat enregistré ne correspond à ces filtres." />
        )}

        {current != null && current.items.length > 0 && (
          <div className={`overflow-x-auto transition-opacity ${loading ? "opacity-60" : ""}`}>
            {view === "backtests" ? (
              <table className="w-full min-w-[1040px] text-[12px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-5 py-3">Lancé le</th>
                    <th className="text-left px-2.5 py-3 min-w-[160px]">Utilisateur</th>
                    <th className="text-left px-2.5 py-3 min-w-[140px]">Stratégie</th>
                    <th className="text-left px-2.5 py-3">Actif</th>
                    <th className="text-left px-2.5 py-3">Période</th>
                    <th className="text-right px-2.5 py-3">Rendement</th>
                    <th className="text-right px-2.5 py-3">Sharpe</th>
                    <th className="text-right px-2.5 py-3" title="Drawdown maximum">Drawdown</th>
                    <th className="text-right px-2.5 py-3">Trades</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(backtests?.items ?? []).map((b) => (
                    <tr key={b.id} onClick={() => open(b.id)} className="hover:bg-muted/10 transition-colors cursor-pointer">
                      <td className="px-5 py-3 text-[11px] text-muted-foreground whitespace-nowrap" style={MONO}>{dateTime(b.createdAt)}</td>
                      <td className="px-2.5 py-3 max-w-[170px]"><OwnerCell owner={b.owner} /></td>
                      <td className="px-2.5 py-3 max-w-[180px]">
                        <div className="truncate font-medium text-foreground" title={b.strategyName}>{b.strategyName}</div>
                        <div className="text-[11px] text-muted-foreground">{typeShort[b.strategyType] ?? b.strategyType}</div>
                      </td>
                      <td className="px-2.5 py-3 font-medium text-foreground whitespace-nowrap">{b.symbol}</td>
                      <td className="px-2.5 py-3 text-[11px] text-muted-foreground whitespace-nowrap" style={MONO}>{b.from} → {b.to}</td>
                      <td className="px-2.5 py-3 text-right whitespace-nowrap" style={MONO}>
                        <div className={`font-medium ${gainClass(b.totalReturn)}`}>{pctSigned(b.totalReturn)}</div>
                        <div className="text-[10px] text-muted-foreground">B&amp;H {pctSigned(b.buyHoldReturn)}</div>
                      </td>
                      <td className="px-2.5 py-3 text-right text-foreground" style={MONO}>{num(b.sharpe)}</td>
                      <td className="px-2.5 py-3 text-right text-red-600 dark:text-red-400 whitespace-nowrap" style={MONO}>{pctSigned(b.maxDrawdown)}</td>
                      <td className="px-2.5 py-3 text-right text-muted-foreground" style={MONO}>{b.tradeCount ?? DASH}</td>
                      <td className="pl-1 pr-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" title="Ouvrir" aria-label={`Ouvrir le backtest ${b.strategyName} de ${b.owner.name}`}
                            onClick={(e) => { e.stopPropagation(); open(b.id); }}><Eye /></Button>
                          <Button variant="ghost" size="icon" className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            title="Supprimer" aria-label={`Supprimer le backtest ${b.strategyName} de ${b.owner.name}`}
                            onClick={(e) => { e.stopPropagation(); setToDelete({ id: b.id, label: `${b.strategyName} · ${b.symbol}` }); }}><Trash2 /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[980px] text-[12px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-5 py-3">Enregistrée le</th>
                    <th className="text-left px-2.5 py-3 min-w-[160px]">Utilisateur</th>
                    <th className="text-left px-2.5 py-3 min-w-[160px]">Nom</th>
                    <th className="text-left px-2.5 py-3">Actif</th>
                    <th className="text-left px-2.5 py-3">Période</th>
                    <th className="text-left px-2.5 py-3 min-w-[180px]">Stratégies</th>
                    <th className="text-right px-2.5 py-3 whitespace-nowrap">Buy &amp; hold</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(comparisons?.items ?? []).map((c) => (
                    <tr key={c.id} onClick={() => open(c.id)} className="hover:bg-muted/10 transition-colors cursor-pointer align-top">
                      <td className="px-5 py-3 text-[11px] text-muted-foreground whitespace-nowrap" style={MONO}>{dateTime(c.createdAt)}</td>
                      <td className="px-2.5 py-3 max-w-[170px]"><OwnerCell owner={c.owner} /></td>
                      <td className="px-2.5 py-3 max-w-[200px]"><div className="line-clamp-2 wrap-anywhere font-medium text-foreground" title={c.name}>{c.name}</div></td>
                      <td className="px-2.5 py-3 font-medium text-foreground whitespace-nowrap">{c.symbol}</td>
                      <td className="px-2.5 py-3 text-[11px] text-muted-foreground whitespace-nowrap" style={MONO}>{c.from} → {c.to}</td>
                      <td className="px-2.5 py-3 max-w-[220px]">
                        <ul className="space-y-0.5">
                          {c.strategies.map((s, i) => (
                            <li key={`${s.strategyId}-${i}`} className="truncate text-foreground" title={`${s.name} · ${typeShort[s.type] ?? s.type}`}>
                              {s.name} <span className="text-[10px] text-muted-foreground">{typeShort[s.type] ?? s.type}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-2.5 py-3 text-right text-foreground whitespace-nowrap" style={MONO}>{pctSigned(c.buyHoldReturn)}</td>
                      <td className="pl-1 pr-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" title="Ouvrir" aria-label={`Ouvrir la comparaison ${c.name} de ${c.owner.name}`}
                            onClick={(e) => { e.stopPropagation(); open(c.id); }}><Eye /></Button>
                          <Button variant="ghost" size="icon" className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            title="Supprimer" aria-label={`Supprimer la comparaison ${c.name} de ${c.owner.name}`}
                            onClick={(e) => { e.stopPropagation(); setToDelete({ id: c.id, label: c.name }); }}><Trash2 /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {current != null && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-border/60 text-[12px] text-muted-foreground">
            <span style={MONO}>{first}–{last} sur {total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className={OUTLINE_DARK} disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Précédent</Button>
              <Button variant="outline" size="sm" className={OUTLINE_DARK} disabled={last >= total || loading} onClick={() => setPage(page + 1)}>Suivant</Button>
            </div>
          </div>
        )}
      </CardShell>
      {confirmDelete}
    </div>
  );
}
