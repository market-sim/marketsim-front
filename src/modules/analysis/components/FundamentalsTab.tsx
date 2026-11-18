import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink, Landmark, RefreshCw, TriangleAlert } from "lucide-react";
import {
  fundamentalsApi, type FundamentalRatioView, type FundamentalsDetail, type FundamentalsOverview,
} from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { useAuth } from "../../../auth/AuthContext";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../app/components/ui/select";
import { Skeleton } from "../../../app/components/ui/skeleton";
import { dateTime, money } from "../format";
import {
  COMPARED_RATIOS, frDate, itemValue, LEVEL_CLASS, LEVEL_LABEL, levelText, NOT_AVAILABLE, ratioValue, SHORT_LABEL,
  STATUS_CLASS, STATUS_LABEL,
} from "../fundamentals";
import { EmptyState, ErrorBanner, Field, FIELD_DARK, OUTLINE_DARK } from "./Feedback";

interface Props {
  /** action choisie, gardee par la page : elle survit au changement d'onglet */
  symbol: string;
  onSymbolChange: (symbol: string) => void;
}

/** Avertissement (cache ancien, source non configuree) : ambre, avec une icone, jamais la couleur seule. */
function Warning({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
      <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="flex-1">{children}</span>
    </div>
  );
}

/** Information de la source : libelle, valeur, precision. */
function Fact({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 p-3 min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">{label}</dt>
      <dd className="text-sm font-semibold text-foreground wrap-anywhere" style={MONO}>{value}</dd>
      {sub && <dd className="text-[11px] text-muted-foreground mt-0.5">{sub}</dd>}
    </div>
  );
}

/** Pastille du repere (bas, moyen, eleve). */
function LevelPill({ r, small = false }: { r: FundamentalRatioView; small?: boolean }) {
  if (r.level == null || r.value == null) return null;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full font-semibold ${small ? "text-[10px] px-1.5 py-px" : "text-[11px] px-2.5 py-0.5"} ${LEVEL_CLASS[r.level]}`}>
      {LEVEL_LABEL[r.level]}
    </span>
  );
}

/** Carte d'un ratio : valeur, repere, explication pour debutant, formule. */
function RatioCard({ r }: { r: FundamentalRatioView }) {
  const available = r.value != null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{r.label}</h4>
        <LevelPill r={r} />
      </div>
      <p className={available ? "text-xl font-semibold text-foreground" : "text-base italic text-muted-foreground"} style={MONO}>
        {ratioValue(r)}
      </p>
      {available
        ? <p className="text-[11px] text-muted-foreground">{levelText(r)}</p>
        : <p className="text-[11px] text-amber-700">{r.unavailableReason}</p>}
      <p className="text-[12px] leading-relaxed text-foreground/80 mt-1">{r.explanation}</p>
      <p className="mt-auto pt-1 text-[11px] text-muted-foreground" style={MONO}>{r.formula}</p>
    </div>
  );
}

/**
 * Onglet « Analyse fondamentale » : ratios d'une action calcules a partir de ses rapports annuels 10-K (SEC EDGAR)
 * et du dernier cours, tableau des trois derniers exercices, et comparaison des actions de la plateforme.
 */
export default function FundamentalsTab({ symbol, onSymbolChange }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [overview, setOverview] = useState<FundamentalsOverview | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [detail, setDetail] = useState<FundamentalsDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  /** incremente pour relancer le chargement du detail (bouton « Reessayer ») */
  const [retry, setRetry] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  /** action du tableau comparatif en cours de telechargement, et erreurs par action */
  const [rowLoading, setRowLoading] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const autoLoaded = useRef(new Set<string>());

  /** Etat de toutes les actions (cache seulement : aucun appel a la SEC). */
  const loadOverview = useCallback(async () => {
    try {
      setOverview(await fundamentalsApi.overview());
      setOverviewError("");
    } catch (e) {
      setOverviewError(errorMessage(e));
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const stocks = overview?.stocks ?? [];
  /** action affichee : celle choisie si elle existe encore, sinon la premiere */
  const selected = stocks.find((s) => s.symbol === symbol)?.symbol ?? stocks[0]?.symbol ?? "";

  // detail de l'action affichee : le back telecharge depuis la SEC si son cache est absent ou trop ancien
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    setRefreshError("");
    fundamentalsApi.get(selected)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        loadOverview();     // l'etat de l'action a pu changer (telechargement)
      })
      .catch((e) => { if (!cancelled) setDetailError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selected, retry, loadOverview]);

  // tableau comparatif : les actions jamais telechargees sont chargees une par une, apres l'action affichee
  useEffect(() => {
    if (!overview || overview.configurationProblem || detailLoading || rowLoading) return;
    const next = overview.stocks.find((s) => s.status === "MISSING" && s.symbol !== selected && !autoLoaded.current.has(s.symbol));
    if (!next) return;
    autoLoaded.current.add(next.symbol);
    setRowLoading(next.symbol);
    fundamentalsApi.get(next.symbol)
      .then(() => loadOverview())
      .catch((e) => setRowErrors((m) => ({ ...m, [next.symbol]: errorMessage(e) })))
      .finally(() => setRowLoading(null));
  }, [overview, selected, detailLoading, rowLoading, loadOverview]);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError("");
    try {
      setDetail(await fundamentalsApi.refresh(selected));
      setDetailError("");
      await loadOverview();
    } catch (e) {
      setRefreshError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  };

  // ─── Chargement, erreur, aucune action ───
  if (!overview) {
    return overviewError
      ? <CardShell className="p-4"><ErrorBanner message={overviewError} onRetry={loadOverview} /></CardShell>
      : <CardShell className="p-5 space-y-3"><Skeleton className="h-5 w-64" /><Skeleton className="h-24 w-full" /></CardShell>;
  }
  if (stocks.length === 0) {
    return (
      <CardShell>
        <EmptyState icon={<Landmark className="w-6 h-6" />} title="Aucune action sur la plateforme"
          text="L'analyse fondamentale ne concerne que les actifs de type action : un administrateur peut en ajouter dans la liste des actifs." />
      </CardShell>
    );
  }

  const shown = detail?.symbol === selected ? detail : null;
  const latest = shown?.years[0];
  // Repere des cartes : celui de la vue d'ensemble, rechargee a chaque action telechargee. Le detail garde le repere
  // du moment ou il a ete charge (ex. 2 actions en cache) : sans cela, cartes et tableau comparatif se contrediraient.
  const summary = stocks.find((s) => s.symbol === selected);
  const ratios = (shown?.ratios ?? []).map((r) => {
    const current = summary?.fiscalYear === latest?.fiscalYear ? summary?.ratios.find((x) => x.ratio === r.ratio) : undefined;
    return current ? { ...r, level: current.level, compared: current.compared } : r;
  });

  return (
    <div className="space-y-4">
      {/* ── Choix de l'action ── */}
      <CardShell className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Analyse fondamentale</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 max-w-3xl">
              Ratios calculés à partir des rapports annuels 10-K déposés à la SEC (gendarme de la bourse américaine), dont les
              comptes sont audités, et du dernier cours connu. Seules les actions de la plateforme sont concernées.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Action" className="w-full sm:w-80">
            <Select value={selected} onValueChange={onSymbolChange}>
              <SelectTrigger className={FIELD_DARK} aria-label="Action"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stocks.map((s) => <SelectItem key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {isAdmin && (
            <Button variant="outline" size="sm" className={`h-9 ${OUTLINE_DARK}`} onClick={refresh}
              disabled={refreshing || detailLoading || !selected}
              title="Retélécharge les données de cette action depuis la SEC, même si le cache est récent (réservé à l'administrateur)">
              <RefreshCw className={refreshing ? "animate-spin" : ""} />{refreshing ? "Téléchargement…" : "Rafraîchir depuis la SEC"}
            </Button>
          )}
        </div>

        {overview.configurationProblem && <Warning>{overview.configurationProblem}</Warning>}
        {refreshError && <ErrorBanner message={refreshError} />}
      </CardShell>

      {/* ── Detail de l'action ── */}
      {detailError && !shown && (overview.configurationProblem ? (
        // la source n'est pas configuree : l'avertissement ci-dessus explique deja pourquoi, inutile de le repeter
        <CardShell>
          <EmptyState icon={<Landmark className="w-6 h-6" />} title={`Pas encore de données pour ${selected}`}
            text="Les rapports annuels de cette action n'ont jamais été téléchargés, et le serveur ne peut pas interroger la SEC tant que sa configuration n'est pas complétée (voir l'avertissement ci-dessus)." />
        </CardShell>
      ) : (
        <ErrorBanner message={detailError} onRetry={() => setRetry((n) => n + 1)} />
      ))}
      {!shown && !detailError && (
        <CardShell className="p-5 space-y-3">
          <Skeleton className="h-5 w-72" />
          <p className="text-[12px] text-muted-foreground">Lecture des rapports annuels de {selected} (premier téléchargement depuis la SEC : quelques secondes)…</p>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardShell>
      )}

      {shown && latest && (
        <div className={`space-y-4 transition-opacity ${detailLoading || refreshing ? "opacity-60" : ""}`}>
          {/* ── Source et exercice ── */}
          <CardShell className="p-5 space-y-4">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>{shown.companyName} · {shown.symbol}</h3>
                <p className="text-[11px] text-muted-foreground mt-1" style={MONO}>CIK {shown.cik}</p>
              </div>
              <span className={`ml-auto text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_CLASS[shown.status]}`}>
                {shown.status === "FRESH" ? "Données à jour" : "Données anciennes"}
              </span>
            </div>
            {shown.warning && <Warning>{shown.warning}</Warning>}
            <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <Fact label="Source" value="SEC EDGAR"
                sub={latest.reportUrl
                  ? <a href={latest.reportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                      Rapport 10-K sur sec.gov<ExternalLink className="w-3 h-3" />
                    </a>
                  : "Rapports annuels 10-K"} />
              <Fact label="Exercice" value={latest.fiscalYear}
                sub={`du ${frDate(latest.start)} au ${frDate(latest.end)} · 10-K déposé le ${frDate(latest.filed)}`} />
              <Fact label="Téléchargé le" value={dateTime(shown.downloadedAt)}
                sub={shown.ageDays === 0 ? "Aujourd'hui · rafraîchi après 30 jours" : `Il y a ${shown.ageDays} j · rafraîchi après 30 jours`} />
              <Fact label="Cours utilisé" value={shown.price == null ? NOT_AVAILABLE : money(shown.price)}
                sub={shown.priceDate ? `Clôture du ${frDate(shown.priceDate)}` : "Les ratios liés au cours ne sont pas calculés"} />
            </dl>
          </CardShell>

          {/* ── Ratios ── */}
          <CardShell className="p-5">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Ratios de l'exercice {latest.fiscalYear}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4 max-w-4xl">
              Repère : position de l'action parmi les actions analysées (premier tiers : bas, dernier tiers : élevé). Il est neutre :
              un PER élevé veut dire « plus cher que les autres », pas « meilleur ». Comparer des sociétés de secteurs différents a ses limites.
            </p>
            <div className="@container">
              <div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-3">
                {ratios.map((r) => <RatioCard key={r.ratio} r={r} />)}
              </div>
            </div>
          </CardShell>

          {/* ── Donnees des 10-K ── */}
          <CardShell className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Données des rapports annuels</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Montants en dollars US (M = million, Md = milliard). Sous chaque valeur, le libellé XBRL d'où elle vient : les sociétés
                n'emploient pas toutes les mêmes.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th scope="col" className="text-left px-5 py-3">Donnée</th>
                    {shown.years.map((y) => (
                      <th key={y.end} scope="col" className="text-right px-4 py-3 align-top">
                        Exercice {y.fiscalYear}
                        <div className="font-normal normal-case tracking-normal mt-0.5" style={MONO}>clos le {frDate(y.end)}</div>
                        {y.reportUrl && (
                          <a href={y.reportUrl} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 font-normal normal-case tracking-normal text-blue-600 hover:underline mt-0.5">
                            10-K<ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {latest.items.map((item, row) => (
                    <tr key={item.item} className="hover:bg-muted/10 transition-colors">
                      <th scope="row" className="px-5 py-2.5 text-left font-normal text-muted-foreground whitespace-nowrap">{item.label}</th>
                      {shown.years.map((y) => {
                        const v = y.items[row];
                        return (
                          <td key={y.end} className="px-4 py-2.5 text-right align-top">
                            <div className={v.value == null ? "italic text-muted-foreground" : "font-medium text-foreground"} style={MONO}>{itemValue(v)}</div>
                            {v.concept && (
                              <div className="text-[10px] text-muted-foreground mt-0.5 ml-auto max-w-[240px] truncate" style={MONO} title={v.concept}>{v.concept}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardShell>
        </div>
      )}

      {/* ── Comparaison des actions ── */}
      <CardShell className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Comparaison des actions</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Dernier exercice de chaque action et dernier cours connu. Sous chaque valeur, son repère parmi les actions analysées.
            Cliquez sur une action pour l'analyser.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-[12px]">
            <thead>
              <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                <th scope="col" className="text-left px-5 py-3">Action</th>
                <th scope="col" className="text-left px-3 py-3">Données</th>
                {COMPARED_RATIOS.map((key) => (
                  <th key={key} scope="col" className="text-right px-3 py-3 whitespace-nowrap">{SHORT_LABEL[key]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {stocks.map((s) => {
                const active = s.symbol === selected;
                return (
                  <tr key={s.symbol} onClick={() => onSymbolChange(s.symbol)}
                    className={`cursor-pointer transition-colors ${active ? "bg-blue-50/60" : "hover:bg-muted/10"}`}>
                    <td className="px-5 py-3">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onSymbolChange(s.symbol); }}
                        aria-current={active ? "true" : undefined}
                        className="text-left text-sm font-semibold text-foreground hover:text-blue-600">{s.symbol}</button>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[180px]" title={s.name}>{s.name}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {rowLoading === s.symbol ? (
                        <span className="text-[11px] text-muted-foreground">Téléchargement…</span>
                      ) : (
                        <>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                          {s.fiscalYear != null && <div className="text-[10px] text-muted-foreground mt-1" style={MONO}>Ex. {s.fiscalYear} · {frDate(s.fiscalYearEnd)}</div>}
                          {rowErrors[s.symbol] && s.status === "MISSING" && (
                            <div className="text-[10px] text-red-600 mt-1 max-w-[200px] truncate" title={rowErrors[s.symbol]}>{rowErrors[s.symbol]}</div>
                          )}
                        </>
                      )}
                    </td>
                    {COMPARED_RATIOS.map((key) => {
                      const r = s.ratios.find((x) => x.ratio === key);
                      return (
                        <td key={key} className="px-3 py-3 text-right whitespace-nowrap" title={r?.value == null ? r?.unavailableReason ?? undefined : r.label}>
                          <div className={r?.value == null ? "text-muted-foreground" : "text-foreground"} style={MONO}>
                            {r ? (r.value == null ? "—" : ratioValue(r)) : ""}
                          </div>
                          {r && <div className="mt-1"><LevelPill r={r} small /></div>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardShell>

      {/* ── Comment lire ── */}
      <CardShell className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2" style={DISPLAY}>Comment lire cette analyse</h3>
        <ul className="space-y-1.5 text-[12px] text-muted-foreground list-disc pl-4">
          <li>Les chiffres viennent des rapports annuels 10-K, lus dans leurs données XBRL publiées par la SEC. Les rapports trimestriels ne sont pas utilisés.</li>
          <li>Les ratios associent les comptes du dernier exercice, parfois vieux de plusieurs mois, au dernier cours connu.</li>
          <li>Une donnée introuvable est affichée « non disponible », jamais remplacée par 0. Un ratio sans sens économique (PER d'une entreprise en perte, capitaux propres négatifs) n'est pas calculé.</li>
          <li>La dette comprend les emprunts et obligations (part à moins d'un an incluse) et les billets de trésorerie, sans les contrats de location.</li>
          <li>Les données sont gardées 30 jours. Si la SEC ne répond pas, les dernières données connues sont utilisées et signalées.</li>
          <li>Seules les sociétés cotées aux États-Unis qui déposent un 10-K sont couvertes ; les montants sont en dollars.</li>
        </ul>
      </CardShell>
    </div>
  );
}
