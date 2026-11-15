import { useState, type FormEvent } from "react";
import { ChevronDown, GitCompare, Play } from "lucide-react";
import { backtestsApi, type Asset, type BacktestComparison, type Strategy } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Checkbox } from "../../../app/components/ui/checkbox";
import { Input } from "../../../app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../app/components/ui/select";
import { Skeleton } from "../../../app/components/ui/skeleton";
import {
  buildComparisonRequest, type ComparisonErrors, type ComparisonFormValues,
} from "../comparison";
import { isNotFound } from "../errors";
import { todayIso } from "../format";
import { paramsSummary, typeShort } from "../strategyRules";
import { EmptyState, ErrorBanner, Field, FIELD_DARK } from "./Feedback";
import ComparisonResult from "./ComparisonResult";

interface Props {
  strategies: Strategy[];
  strategiesLoading: boolean;
  strategiesError: string;
  assets: Asset[];
  assetsLoading: boolean;
  assetsError: string;
  values: ComparisonFormValues;
  onValuesChange: (values: ComparisonFormValues) => void;
  result: BacktestComparison | null;
  onResult: (result: BacktestComparison) => void;
  onGoToStrategies: () => void;
  onReloadStrategies: () => void;
}

/** Comparaison simultanee de deux a cinq strategies sur un actif et des reglages partages. */
export default function ComparisonTab({
  strategies, strategiesLoading, strategiesError, assets, assetsLoading, assetsError,
  values, onValuesChange, result, onResult, onGoToStrategies, onReloadStrategies,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(values.slippagePct !== "0" || values.positionPct !== "100");
  const [errors, setErrors] = useState<ComparisonErrors>({});
  const [error, setError] = useState("");

  const testable = strategies.filter((strategy) => strategy.type && strategy.id != null);
  const shownError = (field: keyof ComparisonErrors) => submitted ? errors[field] : undefined;
  const set = (field: keyof Omit<ComparisonFormValues, "strategyIds">) => (value: string) =>
    onValuesChange({ ...values, [field]: value });
  const toggleStrategy = (strategyId: number, checked: boolean) => {
    const id = String(strategyId);
    const strategyIds = checked
      ? [...values.strategyIds, id]
      : values.strategyIds.filter((selected) => selected !== id);
    onValuesChange({ ...values, strategyIds });
    if (submitted) {
      const { errors: next } = buildComparisonRequest({ ...values, strategyIds });
      setErrors(next);
    }
  };

  const run = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const built = buildComparisonRequest(values);
    setErrors(built.errors);
    if (!built.request) return;
    setBusy(true);
    setError("");
    try {
      onResult(await backtestsApi.compare(built.request));
    } catch (err) {
      setError(errorMessage(err));
      if (isNotFound(err)) onReloadStrategies();
    } finally {
      setBusy(false);
    }
  };

  if ((strategiesLoading && strategies.length === 0) || (assetsLoading && assets.length === 0)) {
    return <CardShell className="space-y-3 p-5"><Skeleton className="h-5 w-56" /><Skeleton className="h-24 w-full" /></CardShell>;
  }
  if (strategiesError || assetsError) {
    return (
      <div className="space-y-3">
        {strategiesError && <ErrorBanner message={strategiesError} onRetry={onReloadStrategies} />}
        {assetsError && <ErrorBanner message={assetsError} />}
      </div>
    );
  }
  if (testable.length === 0 || assets.length === 0) {
    const noStrategies = testable.length === 0;
    return (
      <CardShell>
        <EmptyState icon={<GitCompare className="h-6 w-6" />}
          title={noStrategies ? "Aucune stratégie à comparer" : "Aucun actif disponible"}
          text={noStrategies
            ? strategies.length === 0
              ? "Créez au moins deux stratégies à règles pour comparer leurs résultats."
              : "Les stratégies sans type ne peuvent pas être comparées. Modifiez-en ou créez-en avec une règle."
            : "La liste des actifs est vide : aucun cours ne peut être simulé pour l'instant."}
          action={noStrategies ? <Button size="sm" onClick={onGoToStrategies}>Aller aux stratégies</Button> : undefined} />
      </CardShell>
    );
  }

  const numberField = (
    field: keyof Omit<ComparisonFormValues, "strategyIds">,
    label: string,
    options: { hint?: string; placeholder?: string; step?: string } = {},
  ) => (
    <Field label={label} htmlFor={`compare-${field}`} error={shownError(field)}>
      <Input id={`compare-${field}`} className={FIELD_DARK} type="number" inputMode="decimal" min="0"
        step={options.step ?? "any"} style={MONO} placeholder={options.placeholder} value={values[field]}
        aria-invalid={!!shownError(field)} onChange={(event) => set(field)(event.target.value)} />
      {options.hint && !shownError(field) && <p className="mt-1 text-[11px] text-muted-foreground">{options.hint}</p>}
    </Field>
  );
  const dateField = (field: "from" | "to" | "splitDate", label: string, hint: string) => (
    <Field label={label} htmlFor={`compare-${field}`} error={shownError(field)} hint={hint}>
      <Input id={`compare-${field}`} className={FIELD_DARK} type="date" max={todayIso()} value={values[field]}
        aria-invalid={!!shownError(field)} onChange={(event) => set(field)(event.target.value)} />
    </Field>
  );

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <GitCompare className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground" style={DISPLAY}>Comparer des stratégies</h2>
            <p className="mt-0.5 max-w-3xl text-[12px] text-muted-foreground">
              Les stratégies sont rejouées sur les mêmes clôtures historiques et avec des réglages identiques.
              Le signal est pris à la clôture de J et exécuté à la clôture de J+1.
            </p>
          </div>
        </div>

        <form onSubmit={run} noValidate className="space-y-4">
          <fieldset>
            <legend className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Stratégies · 2 à 5
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {strategies.map((strategy) => {
                const eligible = !!strategy.type && strategy.id != null;
                const checked = strategy.id != null && values.strategyIds.includes(String(strategy.id));
                const limitReached = values.strategyIds.length >= 5 && !checked;
                return (
                  <label key={strategy.id ?? strategy.name}
                    className={`flex min-w-0 items-start gap-2.5 rounded-lg border border-border/60 p-3 transition-colors ${
                      !eligible || limitReached ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/20"
                    }`}>
                    <Checkbox checked={checked} disabled={!eligible || limitReached}
                      aria-label={`Comparer ${strategy.name}`}
                      onCheckedChange={(value) => strategy.id != null && toggleStrategy(strategy.id, value === true)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground" title={strategy.name}>{strategy.name}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {strategy.type ? typeShort[strategy.type] : "Type à définir"}
                        {strategy.type && ` · ${paramsSummary(strategy.type, strategy.params)}`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {shownError("strategyIds") && <p role="alert" className="mt-1 text-[11px] text-red-600">{shownError("strategyIds")}</p>}
          </fieldset>

          <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Actif" className="sm:col-span-2" error={shownError("symbol")}>
              <Select value={values.symbol} onValueChange={set("symbol")}>
                <SelectTrigger className={FIELD_DARK} aria-label="Actif" aria-invalid={!!shownError("symbol")}>
                  <SelectValue placeholder="Choisir un actif" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => <SelectItem key={asset.symbol} value={asset.symbol}>{asset.symbol} — {asset.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {dateField("from", "Début de la période", "Vide : début de l'historique")}
            {dateField("to", "Fin de la période", "Vide : dernière séance")}
            {numberField("capital", "Capital initial ($)", { step: "100" })}
            {numberField("feePct", "Frais par ordre (%)", { hint: "0,1 % par défaut" })}
            {numberField("stopLossPct", "Stop-loss (%)", { placeholder: "Aucun" })}
            {numberField("takeProfitPct", "Take-profit (%)", { placeholder: "Aucun" })}
            <div className="sm:col-span-2">
              {dateField("splitDate", "Date de coupure entraînement / test", "Facultatif : métriques séparées avant et après")}
            </div>
          </div>

          <div>
            <button type="button" onClick={() => setAdvanced((open) => !open)} aria-expanded={advanced}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advanced ? "rotate-180" : ""}`} />
              Options avancées
            </button>
            {advanced && (
              <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                {numberField("slippagePct", "Glissement de prix (%)", { hint: "Achat plus cher, vente moins chère" })}
                {numberField("positionPct", "Part du capital engagée (%)", { hint: "Part investie à chaque achat" })}
              </div>
            )}
          </div>

          {error && <ErrorBanner message={error} />}
          <Button type="submit" disabled={busy}><Play />{busy ? "Comparaison en cours…" : "Lancer la comparaison"}</Button>
        </form>
      </CardShell>

      <div className={`transition-opacity ${busy ? "opacity-50" : ""}`}>
        {result ? (
          <ComparisonResult result={result} />
        ) : (
          <CardShell className="p-8 text-center text-sm text-muted-foreground">
            Choisissez au moins deux stratégies pour afficher leurs métriques et leurs courbes comparées.
          </CardShell>
        )}
      </div>
    </div>
  );
}
