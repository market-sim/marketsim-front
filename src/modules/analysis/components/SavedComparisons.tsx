import { useEffect, useRef, useState } from "react";
import { ArrowLeft, GitCompare, Pencil, Trash2 } from "lucide-react";
import { comparisonsApi, type SavedComparisonDetail, type SavedComparisonSummary } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Skeleton } from "../../../app/components/ui/skeleton";
import { SERIES_DASH, useSeriesColors } from "../chartTheme";
import {
  bestSnapshot, COMPARISON_NAME_MAX, comparisonNameError, rankingFromApi, rankingLabel, type RankingMetric,
} from "../comparison";
import { ignoreNotFound, isNotFound } from "../errors";
import { dateTime, num, pctSigned } from "../format";
import { typeShort } from "../strategyRules";
import { SeriesSwatch } from "./ComparisonCharts";
import ComparisonResult, { StrategyStatusBadge } from "./ComparisonResult";
import ConfirmDialog from "./ConfirmDialog";
import DataCheckNotice from "./DataCheckNotice";
import { EmptyState, ErrorBanner, OUTLINE_DARK } from "./Feedback";
import NameDialog from "./NameDialog";

interface Props {
  /** comparaison ouverte en detail (lue dans l'URL), ou null pour la liste */
  openId: number | null;
  onOpen: (id: number | null) => void;
  /** une comparaison a ete renommee ou supprimee : le compteur de la section est a recharger */
  onChanged: () => void;
  onGoToComparison: () => void;
  /** « Relancer avec les memes reglages » (onglet Comparaison prerempli) */
  onRerun: (detail: SavedComparisonDetail) => void;
}

/** Libelle court du critere, pour la colonne « Meilleure ». */
const SHORT_CRITERION: Record<RankingMetric, string> = {
  sharpe: "Sharpe",
  annualizedReturn: "Rend. annuel",
  maxDrawdown: "Drawdown max",
};
const scoreText = (criterion: RankingMetric, score: number | null) => (criterion === "sharpe" ? num(score) : pctSigned(score));

/**
 * Section « Comparaisons » de l'onglet Historique (GET /api/analysis/comparisons) : liste, detail dans le meme
 * affichage que l'onglet Comparaison, renommage et suppression.
 */
export default function SavedComparisons({ openId, onOpen, onChanged, onGoToComparison, onRerun }: Props) {
  const palette = useSeriesColors();
  const [list, setList] = useState<SavedComparisonSummary[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [reload, setReload] = useState(0);
  const [detail, setDetail] = useState<SavedComparisonDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [criterion, setCriterion] = useState<RankingMetric>("sharpe");
  const [toRename, setToRename] = useState<{ id: number; name: string } | null>(null);
  const [toDelete, setToDelete] = useState<{ id: number; name: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // en ouvrant une comparaison (ou en revenant a la liste) depuis un ecran defile, on repart du haut de la section ;
  // verifie aussi une fois le detail charge : avant, la page est courte et la position de defilement n'est pas encore connue
  useEffect(() => {
    const top = topRef.current;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start" });
  }, [openId, detail?.id]);

  // liste, rechargee apres un renommage ou une suppression
  useEffect(() => {
    if (openId != null) return;
    let cancelled = false;
    setListLoading(true);
    setListError("");
    comparisonsApi.list()
      .then((rows) => { if (!cancelled) setList(rows); })
      .catch((e) => { if (!cancelled) setListError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, [reload, openId]);

  // detail de la comparaison ouverte ; le classement repart du critere enregistre
  useEffect(() => {
    if (openId == null) return;
    let cancelled = false;
    setDetail(null);
    setDetailError("");
    comparisonsApi.get(openId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setCriterion(rankingFromApi(d.rankBy));
      })
      .catch((e) => { if (!cancelled) setDetailError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [openId, reload]);

  const renameDialog = toRename && (
    <NameDialog title="Renommer la comparaison" confirmLabel="Renommer" initialName={toRename.name}
      nameMax={COMPARISON_NAME_MAX} validateName={comparisonNameError}
      onSubmit={async (name) => {
        try {
          const updated = await comparisonsApi.rename(toRename.id, name);
          setList((rows) => rows?.map((r) => (r.id === updated.id ? updated : r)) ?? rows);
          setDetail((d) => (d && d.id === updated.id ? { ...d, name: updated.name } : d));
          onChanged();
        } catch (err) {
          // supprimee entre-temps (autre fenetre) : la liste est rechargee, le message reste dans la fenetre
          if (isNotFound(err)) setReload((n) => n + 1);
          throw err;
        }
      }}
      onClose={() => setToRename(null)} />
  );

  const confirmDelete = toDelete && (
    <ConfirmDialog title="Supprimer cette comparaison ?" confirmLabel="Supprimer"
      description={<>La comparaison « {toDelete.name} » sera supprimée de l'historique, avec ses courbes et ses métriques. Les stratégies ne sont pas touchées. Cette action est définitive.</>}
      onConfirm={async () => {
        await comparisonsApi.remove(toDelete.id).catch(ignoreNotFound);
        onChanged();
        if (openId === toDelete.id) onOpen(null);
        else setReload((n) => n + 1);
      }}
      onClose={() => setToDelete(null)} />
  );

  // ─── Detail d'une comparaison ───
  if (openId != null) {
    return (
      <div ref={topRef} className="space-y-4 scroll-mt-4">
        <Button variant="ghost" size="sm" onClick={() => onOpen(null)}><ArrowLeft />Retour aux comparaisons</Button>
        {detailError && <ErrorBanner message={detailError} onRetry={() => setReload((n) => n + 1)} />}
        {!detail && !detailError && (
          <CardShell className="p-5 space-y-3">
            <Skeleton className="h-5 w-72" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-72 w-full" />
          </CardShell>
        )}
        {detail && (() => {
          // la relance reprend les strategies telles qu'elles sont aujourd'hui
          const names = (status: string) => detail.result.strategies
            .filter((_, i) => detail.strategyStatus[i] === status).map((s) => `« ${s.strategyName} »`);
          const deleted = names("DELETED");
          const modified = names("MODIFIED");
          return (
            <DataCheckNotice recordId={detail.id} symbol={detail.result.symbol} load={() => comparisonsApi.dataCheck(detail.id)}
              onRerun={() => onRerun(detail)}
              rerunBlockedReason={deleted.length > 0
                ? `${deleted.join(", ")} ${deleted.length > 1 ? "ont été supprimées" : "a été supprimée"} : la relance avec les mêmes stratégies n'est plus possible.`
                : undefined}
              rerunNote={modified.length > 0
                ? `${modified.join(", ")} ${modified.length > 1 ? "ont été modifiées" : "a été modifiée"} depuis : la relance utilisera les paramètres actuels.`
                : undefined} />
          );
        })()}
        {detail && (
          <ComparisonResult result={detail.result} criterion={criterion} onCriterionChange={setCriterion}
            saved={{ name: detail.name, createdAt: detail.createdAt }} statuses={detail.strategyStatus}
            actions={<>
              <Button variant="outline" size="sm" className={OUTLINE_DARK} onClick={() => setToRename({ id: detail.id, name: detail.name })}>
                <Pencil />Renommer
              </Button>
              <Button variant="outline" size="sm" className={`text-red-600 hover:text-red-700 dark:text-red-400 ${OUTLINE_DARK}`}
                onClick={() => setToDelete({ id: detail.id, name: detail.name })}>
                <Trash2 />Supprimer
              </Button>
            </>} />
        )}
        {renameDialog}
        {confirmDelete}
      </div>
    );
  }

  // ─── Liste ───
  const empty = list != null && list.length === 0;
  return (
    <div ref={topRef} className="scroll-mt-4">
      <CardShell className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Mes comparaisons</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            De la plus récente à la plus ancienne. Chacune garde les résultats calculés le jour de son enregistrement, même si une stratégie change ensuite.
          </p>
        </div>

        {listError && <div className="p-4"><ErrorBanner message={listError} onRetry={() => setReload((n) => n + 1)} /></div>}

        {list == null && !listError && (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        )}

        {empty && !listError && (
          <EmptyState icon={<GitCompare className="w-6 h-6" />} title="Aucune comparaison enregistrée"
            text="Dans l'onglet Comparaison, lancez une comparaison puis « Enregistrer cette comparaison » : elle sera gardée ici avec ses courbes et ses métriques."
            action={<Button size="sm" onClick={onGoToComparison}>Comparer des stratégies</Button>} />
        )}

        {list != null && list.length > 0 && (
          <div className={`overflow-x-auto transition-opacity ${listLoading ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[1080px] text-[12px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-3">Enregistrée le</th>
                  {/* largeurs minimales : sans elles, les colonnes en nowrap ecrasent le nom a quelques lettres */}
                  <th className="text-left px-2.5 py-3 min-w-[160px]">Nom</th>
                  <th className="text-left px-2.5 py-3">Actif</th>
                  <th className="text-left px-2.5 py-3">Période</th>
                  <th className="text-left px-2.5 py-3 min-w-[200px]">Stratégies</th>
                  <th className="text-left px-2.5 py-3 min-w-[140px]">Meilleure</th>
                  <th className="text-right px-2.5 py-3 whitespace-nowrap">Buy &amp; hold</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {list.map((c) => {
                  const best = bestSnapshot(c);
                  return (
                    <tr key={c.id} onClick={() => onOpen(c.id)} className="hover:bg-muted/10 transition-colors cursor-pointer align-top">
                      <td className="px-5 py-3 text-[11px] text-muted-foreground whitespace-nowrap" style={MONO}>{dateTime(c.createdAt)}</td>
                      <td className="px-2.5 py-3 max-w-[220px]">
                        <div className="text-sm font-medium text-foreground line-clamp-2 wrap-anywhere" title={c.name}>{c.name}</div>
                      </td>
                      <td className="px-2.5 py-3 text-foreground font-medium whitespace-nowrap">{c.symbol}</td>
                      <td className="px-2.5 py-3 text-[11px] text-muted-foreground whitespace-nowrap" style={MONO}>
                        {c.from} → {c.to}
                        {c.splitDate && <div className="text-[10px]">coupure {c.splitDate}</div>}
                      </td>
                      <td className="px-2.5 py-3 max-w-[210px]">
                        <ul className="space-y-0.5">
                          {c.strategies.map((s, i) => (
                            <li key={`${s.strategyId}-${i}`} className="flex min-w-0 items-center gap-1.5">
                              <SeriesSwatch color={palette[i]} dash={SERIES_DASH[i]} />
                              <span className="truncate text-foreground" title={`${s.name} · ${typeShort[s.type] ?? s.type}`}>{s.name}</span>
                              <StrategyStatusBadge status={c.strategyStatus[i]} />
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-2.5 py-3 max-w-[160px]">
                        {best ? (
                          <>
                            <div className="truncate max-w-[150px] font-medium text-foreground" title={best.snapshot.name}>{best.snapshot.name}</div>
                            <div className="text-[11px] text-muted-foreground whitespace-nowrap" style={MONO}
                              title={`Critère enregistré : ${rankingLabel(best.criterion)}`}>
                              {SHORT_CRITERION[best.criterion]} {scoreText(best.criterion, best.score)}
                            </div>
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2.5 py-3 text-right whitespace-nowrap text-foreground" style={MONO}>{pctSigned(c.buyHoldReturn)}</td>
                      <td className="pl-1 pr-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onOpen(c.id); }}>Ouvrir</Button>
                          <Button variant="ghost" size="icon" className="size-8" title="Renommer" aria-label={`Renommer la comparaison ${c.name}`}
                            onClick={(e) => { e.stopPropagation(); setToRename({ id: c.id, name: c.name }); }}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            title="Supprimer" aria-label={`Supprimer la comparaison ${c.name}`}
                            onClick={(e) => { e.stopPropagation(); setToDelete({ id: c.id, name: c.name }); }}>
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>
      {renameDialog}
      {confirmDelete}
    </div>
  );
}
