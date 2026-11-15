import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, FlaskConical, Play } from "lucide-react";
import { backtestsApi, type Asset, type BacktestDetail, type Strategy } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Input } from "../../../app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../app/components/ui/select";
import { Skeleton } from "../../../app/components/ui/skeleton";
import { buildBacktestRequest, DEFAULT_BACKTEST_FORM, type BacktestField, type BacktestFormValues } from "../backtestForm";
import { isNotFound } from "../errors";
import { todayIso } from "../format";
import { paramsSummary, typeRule, typeShort } from "../strategyRules";
import BacktestResult from "./BacktestResult";
import { EmptyState, ErrorBanner, Field, FIELD_DARK, OUTLINE_DARK } from "./Feedback";

interface Props {
  strategies: Strategy[];
  strategiesLoading: boolean;
  assets: Asset[];
  /** saisie gardee par la page : elle survit au changement d'onglet */
  values: BacktestFormValues;
  onValuesChange: (v: BacktestFormValues) => void;
  /** dernier backtest lance dans cette session */
  result: BacktestDetail | null;
  onResult: (detail: BacktestDetail) => void;
  /** le back ne trouve plus la strategie choisie (404) : la liste des strategies est a recharger */
  onStrategyGone: () => void;
  onGoToStrategies: () => void;
  onOpenHistory: () => void;
}

/** Onglet « Backtest » : formulaire de lancement (POST /api/analysis/backtests) puis ecran de resultats. */
export default function BacktestTab({
  strategies, strategiesLoading, assets, values, onValuesChange, result, onResult, onStrategyGone, onGoToStrategies, onOpenHistory,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(
    values.slippagePct !== DEFAULT_BACKTEST_FORM.slippagePct || values.positionPct !== DEFAULT_BACKTEST_FORM.positionPct,
  );
  const resultRef = useRef<HTMLDivElement>(null);
  /** vrai juste apres un lancement reussi : le nouveau resultat doit etre amene a l'ecran */
  const scrollToResult = useRef(false);

  // le resultat s'affiche sous le formulaire : on y amene l'utilisateur une fois qu'il est dessine
  useEffect(() => {
    if (!scrollToResult.current) return;
    scrollToResult.current = false;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  /** seules les strategies qui ont un type peuvent etre testees */
  const testable = strategies.filter((s) => s.type);
  const selected = testable.find((s) => String(s.id) === values.strategyId);
  /** une strategie supprimee entre-temps ne compte plus comme choisie */
  const checkedValues = selected ? values : { ...values, strategyId: "" };
  const { errors } = buildBacktestRequest(checkedValues);
  const shownError = (field: BacktestField) => (submitted ? errors[field] : undefined);
  const set = (field: BacktestField) => (value: string) => onValuesChange({ ...values, [field]: value });

  const run = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { request } = buildBacktestRequest(checkedValues);
    if (!request) return;
    setBusy(true);
    setError("");
    try {
      const detail = await backtestsApi.run(request);
      scrollToResult.current = true;
      onResult(detail);
    } catch (err) {
      setError(errorMessage(err));
      // strategie supprimee entre-temps : elle doit aussi disparaitre de la liste de choix
      if (isNotFound(err)) onStrategyGone();
    } finally {
      setBusy(false);
    }
  };

  if (strategiesLoading && strategies.length === 0) {
    return <CardShell className="p-5 space-y-3"><Skeleton className="h-5 w-56" /><Skeleton className="h-24 w-full" /></CardShell>;
  }
  if (testable.length === 0) {
    return (
      <CardShell>
        <EmptyState icon={<FlaskConical className="w-6 h-6" />} title="Aucune stratégie à tester"
          text={strategies.length === 0
            ? "Un backtest rejoue une stratégie sur l'historique réel. Commencez par créer une stratégie."
            : "Vos stratégies n'ont pas encore de type. Modifiez-en une pour choisir sa règle d'achat et de vente."}
          action={<Button size="sm" onClick={onGoToStrategies}>Aller aux stratégies</Button>} />
      </CardShell>
    );
  }

  /** Champ numerique du formulaire (saisie en texte, validee a l'envoi). */
  const numberField = (field: BacktestField, label: string, options: { hint?: string; placeholder?: string; step?: string } = {}) => (
    <Field label={label} htmlFor={`bt-${field}`} error={shownError(field)} hint={options.hint}>
      <Input id={`bt-${field}`} className={FIELD_DARK} type="number" inputMode="decimal" min="0" step={options.step ?? "any"} style={MONO}
        placeholder={options.placeholder} value={values[field]} aria-invalid={!!shownError(field)}
        onChange={(e) => set(field)(e.target.value)} />
    </Field>
  );
  const dateField = (field: BacktestField, label: string, hint: string) => (
    <Field label={label} htmlFor={`bt-${field}`} error={shownError(field)} hint={hint}>
      <Input id={`bt-${field}`} className={FIELD_DARK} type="date" max={todayIso()} value={values[field]} aria-invalid={!!shownError(field)}
        onChange={(e) => set(field)(e.target.value)} />
    </Field>
  );

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Lancer un backtest</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 max-w-3xl">
              La stratégie est rejouée sur les cours réels de l'actif : signal à la clôture du jour J, ordre exécuté à la clôture du jour J+1.
              Le résultat est comparé au buy &amp; hold sur la même période, puis enregistré dans l'historique.
            </p>
          </div>
        </div>

        <form onSubmit={run} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-4">
            <Field label="Stratégie" className="sm:col-span-2" error={shownError("strategyId")}
              hint={selected?.type ? `${paramsSummary(selected.type, selected.params)} — ${typeRule[selected.type]}` : undefined}>
              <Select value={selected ? values.strategyId : ""} onValueChange={set("strategyId")}>
                <SelectTrigger className={FIELD_DARK} aria-label="Stratégie" aria-invalid={!!shownError("strategyId")}><SelectValue placeholder="Choisir une stratégie" /></SelectTrigger>
                <SelectContent>
                  {testable.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name} — {typeShort[s.type!]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Actif" className="sm:col-span-2" error={shownError("symbol")}>
              <Select value={values.symbol} onValueChange={set("symbol")}>
                <SelectTrigger className={FIELD_DARK} aria-label="Actif" aria-invalid={!!shownError("symbol")}><SelectValue placeholder="Choisir un actif" /></SelectTrigger>
                <SelectContent>
                  {assets.map((a) => <SelectItem key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            {dateField("from", "Début de la période", "Vide : début de l'historique (10 ans)")}
            {dateField("to", "Fin de la période", "Vide : dernière séance disponible")}
            {numberField("capital", "Capital initial ($)", { step: "100" })}
            {numberField("feePct", "Frais par ordre (%)", { hint: "0,1 % par défaut" })}

            {numberField("stopLossPct", "Stop-loss (%)", { placeholder: "Aucun", hint: "Vente si la perte atteint ce seuil" })}
            {numberField("takeProfitPct", "Take-profit (%)", { placeholder: "Aucun", hint: "Vente si le gain atteint ce seuil" })}
            <div className="sm:col-span-2">
              {dateField("splitDate", "Date de coupure entraînement / test", "Facultatif : les métriques sont aussi calculées avant et après cette date")}
            </div>
          </div>

          <div>
            <button type="button" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advanced ? "rotate-180" : ""}`} />Options avancées
            </button>
            {advanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-4 mt-3">
                {numberField("slippagePct", "Glissement de prix (%)", { hint: "Achat un peu plus cher, vente un peu moins cher" })}
                {numberField("positionPct", "Part du capital engagée (%)", { hint: "Part des liquidités investie à chaque achat" })}
              </div>
            )}
          </div>

          {error && <ErrorBanner message={error} />}

          <Button type="submit" disabled={busy}><Play />{busy ? "Calcul en cours…" : "Lancer le backtest"}</Button>
        </form>
      </CardShell>

      <div ref={resultRef} className={`scroll-mt-4 transition-opacity ${busy ? "opacity-50" : ""}`}>
        {result ? (
          <BacktestResult detail={result}
            actions={<Button variant="outline" size="sm" className={OUTLINE_DARK} onClick={onOpenHistory}>Voir l'historique</Button>} />
        ) : (
          <CardShell className="p-8 text-center text-sm text-muted-foreground">
            Le résultat s'affichera ici : métriques, courbes de capital et de drawdown, liste des trades.
          </CardShell>
        )}
      </div>
    </div>
  );
}
