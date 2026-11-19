import { useEffect, useState } from "react";
import { Database, RefreshCw, Trash2 } from "lucide-react";
import { analysisAdminApi, fundamentalsApi, type FundamentalsCacheEntry } from "../../../../api/endpoints";
import { errorMessage } from "../../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../../shared/ui";
import { Button } from "../../../../app/components/ui/button";
import { Skeleton } from "../../../../app/components/ui/skeleton";
import { ignoreNotFound } from "../../errors";
import { DASH, dateTime } from "../../format";
import ConfirmDialog from "../ConfirmDialog";
import { EmptyState, ErrorBanner, OUTLINE_DARK } from "../Feedback";

/**
 * Cache de l'analyse fondamentale (GET /api/analysis/admin/fundamentals) : societes telechargees depuis la SEC,
 * rafraichissement force (POST /api/analysis/fundamentals/{symbol}/refresh) et suppression d'une entree
 * (DELETE /api/analysis/admin/fundamentals/{symbol}).
 */
export default function AdminFundamentalsCache() {
  const [entries, setEntries] = useState<FundamentalsCacheEntry[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError("");
    analysisAdminApi.fundamentalsCache()
      .then((list) => { if (!cancelled) setEntries(list); })
      .catch((e) => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [reload]);

  const refresh = async (symbol: string) => {
    setRefreshing(symbol);
    setMessage(null);
    try {
      await fundamentalsApi.refresh(symbol);
      setMessage({ text: `${symbol} retéléchargé depuis la SEC.`, error: false });
      setReload((n) => n + 1);
    } catch (e) {
      // ex. source injoignable ou User-Agent SEC non configure : l'ancien cache reste en place
      setMessage({ text: `${symbol} : ${errorMessage(e)}`, error: true });
    } finally {
      setRefreshing(null);
    }
  };

  if (error) return <ErrorBanner message={error} onRetry={() => setReload((n) => n + 1)} />;
  if (!entries) return <CardShell className="p-5 space-y-3"><Skeleton className="h-5 w-56" /><Skeleton className="h-40 w-full" /></CardShell>;

  return (
    <>
      <CardShell className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Cache de l'analyse fondamentale</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-3xl">
            Données des rapports 10-K de la SEC, partagées par tous les utilisateurs et retéléchargées au-delà de 30 jours.
            Supprimer une entrée la fait retélécharger à la prochaine consultation de l'action.
          </p>
        </div>
        {message && (
          <p role={message.error ? "alert" : "status"}
            className={`px-5 pt-3 text-[12px] ${message.error ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-300"}`}>
            {message.text}
          </p>
        )}
        {entries.length === 0 ? (
          <EmptyState icon={<Database className="w-6 h-6" />} title="Cache vide"
            text="Aucune société n'a encore été téléchargée : elles le seront à la première ouverture de l'onglet Analyse fondamentale." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[12px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-3">Action</th>
                  <th className="text-left px-3 py-3">Société (SEC)</th>
                  <th className="text-left px-3 py-3">CIK</th>
                  <th className="text-left px-3 py-3">Téléchargée le</th>
                  <th className="text-right px-3 py-3">Ancienneté</th>
                  <th className="text-right px-3 py-3">Taille</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {entries.map((e) => (
                  <tr key={e.symbol}>
                    <td className="px-5 py-3 font-semibold text-foreground">{e.symbol}</td>
                    <td className="px-3 py-3 max-w-[220px] truncate text-foreground" title={e.companyName ?? undefined}>{e.companyName ?? DASH}</td>
                    <td className="px-3 py-3 text-muted-foreground" style={MONO}>{e.cik ?? DASH}</td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap" style={MONO}>{dateTime(e.downloadedAt)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span style={MONO} className="text-foreground">{e.ageDays} j</span>
                      {e.stale && (
                        <span className="ml-2 rounded px-1.5 py-px text-[10px] font-medium ring-1 ring-inset bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800">
                          à rafraîchir
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground" style={MONO}>{e.sizeKb} Ko</td>
                    <td className="pl-1 pr-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" className={OUTLINE_DARK} disabled={refreshing != null} onClick={() => refresh(e.symbol)}>
                          <RefreshCw className={refreshing === e.symbol ? "animate-spin" : ""} />
                          {refreshing === e.symbol ? "Téléchargement…" : "Rafraîchir"}
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          title="Supprimer" aria-label={`Supprimer ${e.symbol} du cache`} disabled={refreshing != null}
                          onClick={() => setToDelete(e.symbol)}><Trash2 /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>
      {toDelete && (
        <ConfirmDialog title="Supprimer cette entrée du cache ?" confirmLabel="Supprimer"
          description={<>Les données fondamentales de {toDelete} seront supprimées du cache. Elles seront retéléchargées depuis la SEC
            à la prochaine consultation de l'action (si la SEC répond).</>}
          onConfirm={async () => {
            await analysisAdminApi.deleteFundamentals(toDelete).catch(ignoreNotFound);
            setMessage({ text: `${toDelete} supprimé du cache.`, error: false });
            setReload((n) => n + 1);
          }}
          onClose={() => setToDelete(null)} />
      )}
    </>
  );
}
