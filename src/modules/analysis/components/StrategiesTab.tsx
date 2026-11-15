import { useState } from "react";
import { FlaskConical, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { strategiesApi, type Strategy } from "../../../api/endpoints";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Skeleton } from "../../../app/components/ui/skeleton";
import { ignoreNotFound } from "../errors";
import { DASH, num } from "../format";
import { paramsSummary, typeShort } from "../strategyRules";
import ConfirmDialog from "./ConfirmDialog";
import { EmptyState, ErrorBanner } from "./Feedback";
import StrategyFormDialog from "./StrategyFormDialog";

interface Props {
  strategies: Strategy[];
  loading: boolean;
  error: string;
  /** recharge la liste depuis le back */
  onReload: () => void;
  /** ouvre l'onglet Backtest avec cette strategie */
  onBacktest: (s: Strategy) => void;
}

/** Les champs winRate et maxDrawdown d'une strategie sont deja en pourcentage (resume du dernier backtest). */
const percent = (v: number | null | undefined) => (v == null ? DASH : `${v.toFixed(1)} %`);

/** Onglet « Strategies » : liste, creation, modification, suppression (CRUD /api/analysis/strategies). */
export default function StrategiesTab({ strategies, loading, error, onReload, onBacktest }: Props) {
  const [form, setForm] = useState<{ strategy?: Strategy } | null>(null);
  const [toDelete, setToDelete] = useState<Strategy | null>(null);

  const newButton = (
    <Button size="sm" onClick={() => setForm({})}><Plus />Nouvelle stratégie</Button>
  );

  return (
    <>
      <CardShell className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Mes stratégies</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Les quatre dernières colonnes résument le dernier backtest de chaque stratégie.</p>
          </div>
          {strategies.length > 0 && newButton}
        </div>

        {error && <div className="p-4"><ErrorBanner message={error} onRetry={onReload} /></div>}

        {loading && strategies.length === 0 && !error && (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}

        {!loading && !error && strategies.length === 0 && (
          <EmptyState icon={<FlaskConical className="w-6 h-6" />} title="Aucune stratégie"
            text="Créez une stratégie à règles (croisement de moyennes, RSI, MACD, Bollinger ou buy & hold), puis testez-la sur l'historique réel."
            action={newButton} />
        )}

        {strategies.length > 0 && (
          <div className={`overflow-x-auto transition-opacity ${loading ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-3">Stratégie</th>
                  <th className="text-left px-4 py-3">Type et paramètres</th>
                  <th className="text-right px-4 py-3">Sharpe</th>
                  <th className="text-right px-4 py-3">Trades gagnants</th>
                  <th className="text-right px-4 py-3">Drawdown max</th>
                  <th className="text-right px-4 py-3">Trades</th>
                  <th className="text-center px-4 py-3">Statut</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {strategies.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3.5 max-w-[220px]">
                      <div className="text-sm font-medium text-foreground truncate">{s.name}</div>
                      {s.description && <div className="text-[11px] text-muted-foreground mt-0.5 truncate" title={s.description}>{s.description}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      {s.type ? (
                        <>
                          <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">{typeShort[s.type]}</span>
                          <div className="text-[11px] text-muted-foreground mt-1 whitespace-nowrap" style={MONO}>{paramsSummary(s.type, s.params)}</div>
                        </>
                      ) : (
                        <>
                          <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Type à définir</span>
                          <div className="text-[11px] text-muted-foreground mt-1">{s.indicators || "Modifiez-la pour choisir un type"}</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-medium text-foreground" style={MONO}>{num(s.sharpe)}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-foreground" style={MONO}>{percent(s.winRate)}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-red-500" style={MONO}>{percent(s.maxDrawdown)}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-muted-foreground" style={MONO}>{s.trades ?? DASH}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-block whitespace-nowrap text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${s.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {s.status === "ACTIVE" ? "Active" : "En pause"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" disabled={!s.type} onClick={() => onBacktest(s)}
                          title={s.type ? "Lancer un backtest de cette stratégie" : "Choisissez d'abord un type (Modifier)"}>
                          <Play />Backtester
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setForm({ strategy: s })}
                          title="Modifier" aria-label={`Modifier ${s.name}`}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setToDelete(s)}
                          title="Supprimer" aria-label={`Supprimer ${s.name}`}>
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

      {form && (
        <StrategyFormDialog initial={form.strategy} onClose={() => setForm(null)}
          onSaved={() => { setForm(null); onReload(); }} onGone={onReload} />
      )}

      {toDelete && (
        <ConfirmDialog title={`Supprimer « ${toDelete.name} » ?`} confirmLabel="Supprimer"
          description="La stratégie et tous ses backtests enregistrés seront supprimés. Cette action est définitive."
          onConfirm={async () => { await strategiesApi.remove(toDelete.id!).catch(ignoreNotFound); onReload(); }}
          onClose={() => setToDelete(null)} />
      )}
    </>
  );
}
