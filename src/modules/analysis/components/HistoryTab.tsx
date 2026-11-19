import { useEffect, useState } from "react";
import { ArrowLeft, History, Trash2 } from "lucide-react";
import {
  backtestsApi, comparisonsApi, type BacktestDetail, type BacktestSummary, type SavedComparisonDetail, type Strategy,
} from "../../../api/endpoints";
import { sameParams } from "../comparison";
import DataCheckNotice from "./DataCheckNotice";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../app/components/ui/select";
import { Skeleton } from "../../../app/components/ui/skeleton";
import { ignoreNotFound } from "../errors";
import { DASH, dateTime, gainClass, num, pctPlain, pctSigned, ptsSigned } from "../format";
import { typeShort } from "../strategyRules";
import BacktestResult from "./BacktestResult";
import ConfirmDialog from "./ConfirmDialog";
import { EmptyState, ErrorBanner, FIELD_DARK, OUTLINE_DARK } from "./Feedback";
import SavedComparisons from "./SavedComparisons";

export type HistorySection = "backtests" | "comparaisons";

const SECTIONS: { id: HistorySection; label: string }[] = [
  { id: "backtests", label: "Backtests" },
  { id: "comparaisons", label: "Comparaisons" },
];

interface HistoryProps extends Props {
  /** section affichee (lue dans l'URL) */
  section: HistorySection;
  onSection: (section: HistorySection) => void;
  /** comparaison ouverte en detail (lue dans l'URL), ou null */
  openComparisonId: number | null;
  onOpenComparison: (id: number | null) => void;
  onGoToComparison: () => void;
  /** « Relancer avec les memes reglages » d'une comparaison enregistree */
  onRerunComparison: (detail: SavedComparisonDetail) => void;
}

/**
 * Onglet « Historique » : deux sections, les backtests enregistres et les comparaisons enregistrees.
 * Le nombre d'elements de chaque section est affiche sur son bouton.
 */
export default function HistoryTab({
  section, onSection, openComparisonId, onOpenComparison, onGoToComparison, onRerunComparison, ...backtests
}: HistoryProps) {
  const [counts, setCounts] = useState<Record<HistorySection, number | null>>({ backtests: null, comparaisons: null });
  const [version, setVersion] = useState(0);
  const inDetail = backtests.openId != null || openComparisonId != null;
  const refreshCounts = () => setVersion((n) => n + 1);

  // compteurs, relus en revenant a une liste et apres un renommage ou une suppression
  useEffect(() => {
    if (inDetail) return;
    let cancelled = false;
    Promise.allSettled([backtestsApi.list(), comparisonsApi.list()]).then(([b, c]) => {
      if (cancelled) return;
      setCounts({
        backtests: b.status === "fulfilled" ? b.value.length : null,
        comparaisons: c.status === "fulfilled" ? c.value.length : null,
      });
    });
    return () => { cancelled = true; };
  }, [version, inDetail]);

  return (
    <div className="space-y-4">
      {!inDetail && (
        <div role="group" aria-label="Section de l'historique"
          className="flex w-full gap-0.5 rounded-lg border border-border bg-white p-0.5 dark:bg-card sm:w-fit">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" aria-pressed={section === s.id} onClick={() => onSection(s.id)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 h-8 rounded-md text-[13px] font-medium transition-colors ${section === s.id ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted/50"}`}>
              {s.label}
              {counts[s.id] != null && (
                <span className={`rounded-full px-1.5 text-[11px] ${section === s.id ? "bg-white/20" : "bg-muted text-foreground"}`} style={MONO}>
                  {counts[s.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {section === "comparaisons" ? (
        <SavedComparisons openId={openComparisonId} onOpen={onOpenComparison} onChanged={refreshCounts}
          onGoToComparison={onGoToComparison} onRerun={onRerunComparison} />
      ) : (
        <BacktestHistory {...backtests} onDeleted={(id) => { backtests.onDeleted(id); refreshCounts(); }} />
      )}
    </div>
  );
}

interface Props {
  strategies: Strategy[];
  /** backtest ouvert en detail (lu dans l'URL), ou null pour la liste */
  openId: number | null;
  onOpen: (id: number | null) => void;
  /** un backtest a ete supprime : le resume de sa strategie a change cote back */
  onDeleted: (id: number) => void;
  onGoToBacktest: () => void;
  /** « Relancer avec les memes reglages » d'un backtest enregistre */
  onRerunBacktest: (detail: BacktestDetail) => void;
}

const ALL = "all";

/** Section « Backtests » de l'historique : mes backtests passes (GET /api/analysis/backtests), detail et suppression. */
function BacktestHistory({ strategies, openId, onOpen, onDeleted, onGoToBacktest, onRerunBacktest }: Props) {
  const [filter, setFilter] = useState(ALL);
  const [list, setList] = useState<BacktestSummary[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [reload, setReload] = useState(0);
  const [detail, setDetail] = useState<BacktestDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [toDelete, setToDelete] = useState<{ id: number; label: string } | null>(null);

  // liste, rechargee quand le filtre change ou apres une suppression
  useEffect(() => {
    if (openId != null) return;
    let cancelled = false;
    setListLoading(true);
    setListError("");
    backtestsApi.list(filter === ALL ? undefined : Number(filter))
      .then((rows) => { if (!cancelled) setList(rows); })
      .catch((e) => { if (!cancelled) setListError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, [filter, reload, openId]);

  // detail du backtest ouvert
  useEffect(() => {
    if (openId == null) return;
    let cancelled = false;
    setDetail(null);
    setDetailError("");
    backtestsApi.get(openId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setDetailError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [openId, reload]);

  const confirmDelete = toDelete && (
    <ConfirmDialog title="Supprimer ce backtest ?" confirmLabel="Supprimer"
      description={<>Le backtest « {toDelete.label} » sera supprimé de l'historique. Le résumé affiché sur la stratégie reviendra au backtest précédent. Cette action est définitive.</>}
      onConfirm={async () => {
        await backtestsApi.remove(toDelete.id).catch(ignoreNotFound);
        onDeleted(toDelete.id);
        if (openId === toDelete.id) onOpen(null);
        else setReload((n) => n + 1);
      }}
      onClose={() => setToDelete(null)} />
  );

  // ─── Detail d'un backtest ───
  if (openId != null) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => onOpen(null)}><ArrowLeft />Retour à l'historique</Button>
        {detailError && <ErrorBanner message={detailError} onRetry={() => setReload((n) => n + 1)} />}
        {!detail && !detailError && (
          <CardShell className="p-5 space-y-3">
            <Skeleton className="h-5 w-72" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-72 w-full" />
          </CardShell>
        )}
        {detail && (() => {
          // la relance utilise la strategie telle qu'elle est aujourd'hui : on previent si elle a change
          const now = strategies.find((s) => s.id === detail.strategyId);
          const blocked = now && !now.type ? "La stratégie n'a plus de type : la relance n'est pas possible." : undefined;
          const note = now && now.type && (now.type !== detail.strategyType || !sameParams(now.params, detail.params))
            ? "La stratégie a été modifiée depuis : la relance utilisera ses paramètres actuels." : undefined;
          return (
            <DataCheckNotice recordId={detail.id} symbol={detail.symbol} load={() => backtestsApi.dataCheck(detail.id)}
              onRerun={() => onRerunBacktest(detail)} rerunBlockedReason={blocked} rerunNote={note} />
          );
        })()}
        {detail && (
          <BacktestResult detail={detail} actions={
            <Button variant="outline" size="sm" className={`text-red-500 hover:text-red-600 ${OUTLINE_DARK}`}
              onClick={() => setToDelete({ id: detail.id, label: `${detail.strategyName} · ${detail.symbol}` })}>
              <Trash2 />Supprimer
            </Button>
          } />
        )}
        {confirmDelete}
      </div>
    );
  }

  // ─── Liste ───
  const empty = list != null && list.length === 0;
  return (
    <>
      <CardShell className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Mes backtests</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Du plus récent au plus ancien. Cliquez sur une ligne pour revoir le résultat complet.</p>
          </div>
          <div className="w-64">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className={FIELD_DARK} aria-label="Filtrer par stratégie"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes les stratégies</SelectItem>
                {strategies.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {listError && <div className="p-4"><ErrorBanner message={listError} onRetry={() => setReload((n) => n + 1)} /></div>}

        {list == null && !listError && (
          <div className="p-5 space-y-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        )}

        {empty && !listError && (
          <EmptyState icon={<History className="w-6 h-6" />}
            title={filter === ALL ? "Aucun backtest enregistré" : "Aucun backtest pour cette stratégie"}
            text="Chaque backtest lancé est enregistré ici avec ses paramètres, ses métriques, ses courbes et ses trades."
            action={<Button size="sm" onClick={onGoToBacktest}>Lancer un backtest</Button>} />
        )}

        {list != null && list.length > 0 && (
          <div className={`overflow-x-auto transition-opacity ${listLoading ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[1000px] text-[12px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-3">Lancé le</th>
                  <th className="text-left px-2.5 py-3">Stratégie</th>
                  <th className="text-left px-2.5 py-3">Actif</th>
                  <th className="text-left px-2.5 py-3">Période</th>
                  <th className="text-right px-2.5 py-3">Rendement</th>
                  <th className="text-right px-2.5 py-3">Écart au B&amp;H</th>
                  <th className="text-right px-2.5 py-3">Sharpe</th>
                  <th className="text-right px-2.5 py-3">Drawdown max</th>
                  <th className="text-right px-2.5 py-3">Trades</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {list.map((b) => (
                  <tr key={b.id} onClick={() => onOpen(b.id)} className="hover:bg-muted/10 transition-colors cursor-pointer">
                    <td className="px-5 py-3 text-[11px] text-muted-foreground whitespace-nowrap" style={MONO}>{dateTime(b.createdAt)}</td>
                    <td className="px-2.5 py-3 max-w-[180px]">
                      <div className="text-sm font-medium text-foreground truncate" title={b.strategyName}>{b.strategyName}</div>
                      <div className="text-[11px] text-muted-foreground">{typeShort[b.strategyType] ?? b.strategyType}</div>
                    </td>
                    <td className="px-2.5 py-3 text-foreground font-medium whitespace-nowrap">{b.symbol}</td>
                    <td className="px-2.5 py-3 text-[11px] text-muted-foreground whitespace-nowrap" style={MONO}>
                      {b.from} → {b.to}
                      {b.splitDate && <div className="text-[10px]">coupure {b.splitDate}</div>}
                    </td>
                    {/* rendement de la strategie, et dessous celui du buy & hold sur la meme periode */}
                    <td className="px-2.5 py-3 text-right whitespace-nowrap" style={MONO}>
                      <div className={`font-medium ${gainClass(b.totalReturn)}`}>{pctSigned(b.totalReturn)}</div>
                      <div className="text-[10px] text-muted-foreground">B&amp;H {pctSigned(b.buyHoldReturn)}</div>
                    </td>
                    <td className={`px-2.5 py-3 text-right whitespace-nowrap ${gainClass(b.excessReturn)}`} style={MONO}>{ptsSigned(b.excessReturn)}</td>
                    <td className="px-2.5 py-3 text-right text-foreground" style={MONO}>{num(b.sharpe)}</td>
                    <td className="px-2.5 py-3 text-right text-red-500 whitespace-nowrap" style={MONO}>{pctSigned(b.maxDrawdown)}</td>
                    <td className="px-2.5 py-3 text-right text-muted-foreground whitespace-nowrap" style={MONO}>
                      {b.tradeCount ?? DASH}
                      {b.winRate != null && <div className="text-[10px]">{pctPlain(b.winRate, 0)} gagnants</div>}
                    </td>
                    <td className="pl-1 pr-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onOpen(b.id); }}>Ouvrir</Button>
                        <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Supprimer" aria-label={`Supprimer le backtest ${b.strategyName} sur ${b.symbol}`}
                          onClick={(e) => { e.stopPropagation(); setToDelete({ id: b.id, label: `${b.strategyName} · ${b.symbol}` }); }}>
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>
      {confirmDelete}
    </>
  );
}
