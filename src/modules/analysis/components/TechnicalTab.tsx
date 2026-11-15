import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LineChart } from "lucide-react";
import { indicatorsApi, type Asset, type IndicatorSeries } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO, SignalBadge, type Signal } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Input } from "../../../app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../app/components/ui/select";
import { Skeleton } from "../../../app/components/ui/skeleton";
import { Switch } from "../../../app/components/ui/switch";
import { useChartColors, type ChartColors } from "../chartTheme";
import { gainClass, macdDigits, num, pctSigned, price, todayIso } from "../format";
import { readSignals, signalWord } from "../signals";
import {
  indicatorQuery, periodDraft, rangeBounds, RANGES, toChartRows, validatePeriods,
  type IndicatorId, type PeriodDraft, type PeriodErrors, type PeriodKey, type Periods, type TechSettings,
} from "../technical";
import { EmptyState, ErrorBanner, Field, FIELD_DARK, SWITCH_DARK } from "./Feedback";
import { MacdChart, PriceChart, RsiChart } from "./TechnicalCharts";

interface Props {
  assets: Asset[];
  assetsLoading: boolean;
  assetsError: string;
  /** reglages gardes par la page : ils survivent au changement d'onglet */
  settings: TechSettings;
  onChange: (s: TechSettings) => void;
}

/** Les indicateurs reglables : ou ils s'affichent, leur couleur et leurs periodes. */
const INDICATORS: { id: IndicatorId; label: string; place: string; color?: keyof ChartColors; fields: { key: PeriodKey; label: string; step?: string }[] }[] = [
  { id: "smaFast", label: "SMA courte", place: "sur le prix", color: "blue", fields: [{ key: "smaFast", label: "Période" }] },
  { id: "smaSlow", label: "SMA longue", place: "sur le prix", color: "amber", fields: [{ key: "smaSlow", label: "Période" }] },
  { id: "ema", label: "EMA", place: "sur le prix", color: "violet", fields: [{ key: "ema", label: "Période" }] },
  { id: "bollinger", label: "Bandes de Bollinger", place: "sur le prix", color: "neutral", fields: [{ key: "bbPeriod", label: "Période" }, { key: "bbK", label: "k", step: "0.1" }] },
  { id: "rsi", label: "RSI", place: "panneau", fields: [{ key: "rsi", label: "Période" }] },
  { id: "macd", label: "MACD", place: "panneau", fields: [{ key: "macdFast", label: "Rapide" }, { key: "macdSlow", label: "Lente" }, { key: "macdSignal", label: "Signal" }] },
];

const SIGNAL_DOT: Record<Signal, string> = { BUY: "bg-emerald-500", SELL: "bg-red-500", HOLD: "bg-amber-400" };
const sourceLabel = (source: string) => (source === "YAHOO" ? "Yahoo Finance" : source === "CSV" ? "CSV importé" : source);
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Trait de couleur qui sert de cle de legende a cote du nom d'une courbe. */
function LineKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="w-3.5 h-0.5 rounded-full" style={{ background: color }} />{label}
    </span>
  );
}

/** Onglet « Analyse technique » : prix + indicateurs (GET /api/analysis/indicators) et resume des signaux. */
export default function TechnicalTab({ assets, assetsLoading, assetsError, settings, onChange }: Props) {
  const c = useChartColors();
  /** derniere reponse recue, avec les reglages qui l'ont produite (les courbes restent coherentes pendant un rechargement) */
  const [loaded, setLoaded] = useState<{ series: IndicatorSeries; periods: Periods; symbol: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState<PeriodDraft>(() => periodDraft(settings.periods));
  const [draftErrors, setDraftErrors] = useState<PeriodErrors>({});

  const bounds = rangeBounds(settings);
  const dateError = bounds.from && bounds.to && bounds.from >= bounds.to ? "La date de début doit précéder la date de fin" : "";
  const query = useMemo(() => indicatorQuery(settings), [settings.range, settings.from, settings.to, settings.periods]);

  useEffect(() => {
    if (!settings.symbol || dateError) {
      setLoading(false);       // l'appel en cours a ete annule : rien ne charge plus
      return;
    }
    let cancelled = false;     // ignore la reponse d'un appel remplace par un plus recent
    setLoading(true);
    setError("");
    indicatorsApi.get(settings.symbol, query)
      .then((series) => { if (!cancelled) setLoaded({ series, periods: settings.periods, symbol: settings.symbol }); })
      .catch((e) => { if (!cancelled) setError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [settings.symbol, query, dateError, retry]);

  // apres une erreur, on ne laisse pas a l'ecran des courbes qui ne correspondent plus aux reglages demandes
  const shown = error ? null : loaded;
  const rows = useMemo(() => (shown ? toChartRows(shown.series, shown.periods) : []), [shown]);
  const signals = useMemo(() => (shown ? readSignals(rows, shown.periods, settings.show) : []), [rows, shown, settings.show]);

  const applyPeriods = (e: FormEvent) => {
    e.preventDefault();
    const { periods, errors } = validatePeriods(draft);
    setDraftErrors(errors);
    if (!periods) return;
    setDraft(periodDraft(periods));
    onChange({ ...settings, periods });
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(periodDraft(settings.periods));
  const hasDraftError = Object.keys(draftErrors).length > 0;

  if (assetsError) return <ErrorBanner message={assetsError} />;
  if (!assetsLoading && assets.length === 0) {
    return (
      <CardShell>
        <EmptyState icon={<LineChart className="w-6 h-6" />} title="Aucun actif disponible"
          text="La liste des actifs est vide : aucun cours ne peut être affiché pour l'instant." />
      </CardShell>
    );
  }

  const asset = assets.find((a) => a.symbol === settings.symbol);
  const last = rows[rows.length - 1];
  const change = rows.length > 1 ? last.close / rows[0].close - 1 : null;
  const p = shown?.periods ?? settings.periods;
  const count = (s: Signal) => signals.filter((x) => x.signal === s).length;

  return (
    <div className="space-y-4">
      {/* ── Reglages : actif, periode, indicateurs ── */}
      <CardShell className="p-5 space-y-4">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <Field label="Actif" className="w-60">
            <Select value={settings.symbol} onValueChange={(symbol) => onChange({ ...settings, symbol })}>
              <SelectTrigger className={FIELD_DARK} aria-label="Actif"><SelectValue placeholder={assetsLoading ? "Chargement…" : "Choisir un actif"} /></SelectTrigger>
              <SelectContent>
                {assets.map((a) => <SelectItem key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div>
            <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Période</span>
            <div className="flex flex-wrap gap-0.5 rounded-lg border border-border p-0.5">
              {RANGES.map((r) => (
                <button key={r.id} type="button" aria-pressed={settings.range === r.id}
                  onClick={() => onChange({ ...settings, range: r.id })}
                  className={`px-2.5 h-8 rounded-md text-[12px] font-medium transition-colors ${settings.range === r.id ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted/50"}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Du" htmlFor="tech-from" className="w-40" error={dateError || undefined}>
            <Input id="tech-from" className={FIELD_DARK} type="date" max={todayIso()} value={bounds.from ?? ""} aria-invalid={!!dateError}
              onChange={(e) => onChange({ ...settings, range: "CUSTOM", from: e.target.value, to: bounds.to ?? "" })} />
          </Field>
          <Field label="Au" htmlFor="tech-to" className="w-40" hint={bounds.to ? undefined : "Dernière séance"}>
            <Input id="tech-to" className={FIELD_DARK} type="date" max={todayIso()} value={bounds.to ?? ""}
              onChange={(e) => onChange({ ...settings, range: "CUSTOM", from: bounds.from ?? "", to: e.target.value })} />
          </Field>
        </div>

        <form onSubmit={applyPeriods} noValidate>
          <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Indicateurs</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {INDICATORS.map((ind) => (
              <div key={ind.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <Switch id={`show-${ind.id}`} className={SWITCH_DARK} checked={settings.show[ind.id]}
                    onCheckedChange={(on) => onChange({ ...settings, show: { ...settings.show, [ind.id]: on } })} />
                  {ind.color && <span className="w-3.5 h-0.5 rounded-full" style={{ background: c[ind.color] }} />}
                  <label htmlFor={`show-${ind.id}`} className="text-[13px] font-medium text-foreground">{ind.label}</label>
                  <span className="ml-auto text-[10px] text-muted-foreground">{ind.place}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  {ind.fields.map((f) => (
                    <label key={f.key} className="flex-1 min-w-0">
                      <span className="block text-[10px] text-muted-foreground mb-0.5">{f.label}</span>
                      {/* nom complet pour les lecteurs d'ecran : plusieurs champs s'appellent « Période » */}
                      <Input type="number" inputMode="decimal" min={f.key === "bbK" ? 0.1 : 2} step={f.step ?? "1"} value={draft[f.key]}
                        aria-label={`${ind.label} : ${lowerFirst(f.label)}`}
                        aria-invalid={!!draftErrors[f.key]} className={`h-8 px-2 ${FIELD_DARK}`} style={MONO}
                        onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                    </label>
                  ))}
                </div>
                {/* erreur de saisie sous le champ concerne ; le nom du champ est rappele quand le bloc en a plusieurs */}
                {ind.fields.filter((f) => draftErrors[f.key]).map((f) => (
                  <p key={f.key} role="alert" className="mt-1.5 text-[11px] text-red-600">
                    {ind.fields.length > 1 ? `${f.label} : ${lowerFirst(draftErrors[f.key]!)}` : draftErrors[f.key]}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Button type="submit" size="sm" disabled={!dirty}>Appliquer les périodes</Button>
            {hasDraftError
              ? <span className="text-[12px] text-red-600">Corrigez les champs en rouge pour appliquer les périodes.</span>
              : <span className="text-[11px] text-muted-foreground">Les interrupteurs affichent ou masquent une courbe ; les périodes s'appliquent avec le bouton.</span>}
          </div>
        </form>
      </CardShell>

      {error && <ErrorBanner message={error} onRetry={() => setRetry((n) => n + 1)} />}

      {/* ── Graphiques ── */}
      {!shown && !error && (
        <CardShell className="p-5 space-y-3">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardShell>
      )}
      {shown && (
        <>
          <CardShell className="p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>
                {shown.symbol}{asset && shown.symbol === asset.symbol ? ` · ${asset.name}` : ""}
              </h3>
              {last && <span className="text-lg font-semibold text-foreground" style={MONO}>{price(last.close)}</span>}
              {change != null && <span className={`text-[12px] font-medium ${gainClass(change)}`} style={MONO}>{pctSigned(change)} sur la période</span>}
              {last && (
                <span className="ml-auto text-[11px] text-muted-foreground" style={MONO}>
                  {rows.length} séances · {rows[0].date} → {last.date} · {sourceLabel(shown.series.source)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 mb-1">
              <LineKey color={c.ink} label="Clôture" />
              {settings.show.smaFast && <LineKey color={c.blue} label={`SMA ${p.smaFast}`} />}
              {settings.show.smaSlow && <LineKey color={c.amber} label={`SMA ${p.smaSlow}`} />}
              {settings.show.ema && <LineKey color={c.violet} label={`EMA ${p.ema}`} />}
              {settings.show.bollinger && <LineKey color={c.neutral} label={`Bollinger ${p.bbPeriod}, k = ${p.bbK}`} />}
            </div>

            <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
              <div className="h-80"><PriceChart rows={rows} periods={p} show={settings.show} /></div>
              {settings.show.rsi && (
                <div className="mt-4 pt-3 border-t border-border/60">
                  <h4 className="text-[12px] font-semibold text-foreground mb-1" style={DISPLAY}>RSI {p.rsi}</h4>
                  <div className="h-36"><RsiChart rows={rows} periods={p} /></div>
                </div>
              )}
              {settings.show.macd && (
                <div className="mt-4 pt-3 border-t border-border/60">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1">
                    <h4 className="text-[12px] font-semibold text-foreground" style={DISPLAY}>MACD {p.macdFast} / {p.macdSlow} / {p.macdSignal}</h4>
                    <LineKey color={c.blue} label="MACD" />
                    <LineKey color={c.amber} label="Ligne de signal" />
                    <span className="text-[11px] text-muted-foreground">Barres : écart entre les deux</span>
                  </div>
                  <div className="h-40"><MacdChart rows={rows} /></div>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Clôtures journalières ajustées. L'historique ne contient que la clôture : pas de bougies ni d'indicateurs de volume.
            </p>
          </CardShell>

          {/* ── Resume des signaux ── */}
          <CardShell className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-border/60">
              <div>
                <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Résumé des signaux</h3>
                {last && <p className="text-[11px] text-muted-foreground mt-0.5">Lecture à la clôture du {last.date} ({price(last.close)})</p>}
              </div>
              {signals.length > 0 && (
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                  {(["BUY", "SELL", "HOLD"] as Signal[]).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${SIGNAL_DOT[s]}`} />
                      <b className="text-foreground" style={MONO}>{count(s)}</b> {signalWord[s].toLowerCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {signals.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-muted-foreground">Aucun indicateur affiché. Activez-en un pour lire son signal.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                      <th className="text-left px-5 py-3">Indicateur</th>
                      <th className="text-right px-4 py-3">Valeur</th>
                      <th className="text-center px-4 py-3">Signal</th>
                      <th className="text-left px-5 py-3">Lecture</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {signals.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-foreground whitespace-nowrap">{s.indicator}</td>
                        <td className="px-4 py-3 text-right text-sm text-foreground whitespace-nowrap" style={MONO}>{s.value}</td>
                        <td className="px-4 py-3 text-center"><SignalBadge signal={s.signal} /></td>
                        <td className="px-5 py-3 text-[12px] text-muted-foreground">
                          <b className="text-foreground">{signalWord[s.signal]}.</b> {s.reading}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="px-5 py-3 border-t border-border/60 text-[11px] text-muted-foreground">
              Ces signaux décrivent l'état de chaque indicateur à la dernière séance ; ce ne sont pas des conseils d'investissement.
              Pour mesurer ce qu'une règle aurait donné dans le passé, créez une stratégie et lancez un backtest.
            </p>
          </CardShell>

          {/* ── Valeurs exactes des dernieres seances ── */}
          <CardShell className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Dernières séances</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-[12px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-5 py-2.5">Date</th>
                    <th className="text-right px-3 py-2.5">Clôture</th>
                    <th className="text-right px-3 py-2.5">SMA {p.smaFast}</th>
                    <th className="text-right px-3 py-2.5">SMA {p.smaSlow}</th>
                    <th className="text-right px-3 py-2.5">EMA {p.ema}</th>
                    <th className="text-right px-3 py-2.5">Bande basse</th>
                    <th className="text-right px-3 py-2.5">Bande haute</th>
                    <th className="text-right px-3 py-2.5">RSI</th>
                    <th className="text-right px-3 py-2.5">MACD</th>
                    <th className="text-right px-5 py-2.5">Signal MACD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rows.slice(-10).reverse().map((r) => (
                    <tr key={r.date} className="hover:bg-muted/10 transition-colors" style={MONO}>
                      <td className="px-5 py-2 text-foreground">{r.date}</td>
                      <td className="px-3 py-2 text-right text-foreground">{price(r.close)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{price(r.smaFast)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{price(r.smaSlow)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{price(r.ema)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{price(r.bbLower)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{price(r.bbUpper)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{num(r.rsi, 1)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{num(r.macd, macdDigits(r.close))}</td>
                      <td className="px-5 py-2 text-right text-muted-foreground">{num(r.macdSignal, macdDigits(r.close))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardShell>
        </>
      )}
    </div>
  );
}
