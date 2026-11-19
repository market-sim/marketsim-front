import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, GitCompare, Info, Play, Save } from "lucide-react";
import { backtestsApi, comparisonsApi, type Asset, type Strategy } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Checkbox } from "../../../app/components/ui/checkbox";
import { Input } from "../../../app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../app/components/ui/select";
import { Skeleton } from "../../../app/components/ui/skeleton";
import {
  buildComparisonRequest, changesSinceDisplay, COMPARISON_NAME_MAX, comparisonNameError, DEFAULT_COMPARISON_FORM,
  defaultComparisonName, MAX_COMPARED, MIN_COMPARED, RANKING_TO_API, rankingLabel,
  type ComparisonErrors, type ComparisonFormValues, type ComparisonRun,
} from "../comparison";
import { isNotFound } from "../errors";
import { todayIso } from "../format";
import { paramsSummary, typeShort } from "../strategyRules";
import ComparisonResult from "./ComparisonResult";
import { EmptyState, ErrorBanner, Field, FIELD_DARK, OUTLINE_DARK } from "./Feedback";
import NameDialog from "./NameDialog";

type SettingField = Exclude<keyof ComparisonFormValues, "strategyIds">;

interface Props {
  strategies: Strategy[];
  strategiesLoading: boolean;
  strategiesError: string;
  assets: Asset[];
  assetsLoading: boolean;
  assetsError: string;
  /** saisie gardee par la page : elle survit au changement d'onglet */
  values: ComparisonFormValues;
  onValuesChange: (values: ComparisonFormValues) => void;
  /** derniere comparaison lancee dans cette session, avec la demande qui l'a produite */
  run: ComparisonRun | null;
  onRunChange: (run: ComparisonRun) => void;
  onGoToStrategies: () => void;
  onReloadStrategies: () => void;
  /** ouvre une comparaison enregistree dans l'onglet Historique */
  onOpenSaved: (id: number) => void;
}

/**
 * Onglet « Comparaison » : 2 a 5 strategies rejouees sur le meme actif, la meme periode et les memes reglages
 * (POST /api/analysis/backtests/compare). Le resultat est calcule a la demande ; « Enregistrer cette comparaison »
 * le fait recalculer par le serveur et l'ajoute a l'historique (POST /api/analysis/comparisons).
 */
export default function ComparisonTab({
  strategies, strategiesLoading, strategiesError, assets, assetsLoading, assetsError,
  values, onValuesChange, run, onRunChange, onGoToStrategies, onReloadStrategies, onOpenSaved,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const result = run?.result ?? null;
  const [advanced, setAdvanced] = useState(
    values.slippagePct !== DEFAULT_COMPARISON_FORM.slippagePct || values.positionPct !== DEFAULT_COMPARISON_FORM.positionPct,
  );
  const resultRef = useRef<HTMLDivElement>(null);
  /** vrai juste apres un lancement reussi : le nouveau resultat doit etre amene a l'ecran */
  const scrollToResult = useRef(false);

  useEffect(() => {
    if (!scrollToResult.current) return;
    scrollToResult.current = false;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  /** seules les strategies qui ont un type peuvent etre testees */
  const testable = strategies.filter((s) => s.type && s.id != null);
  /**
   * Une strategie supprimee entre-temps (onglet Strategies, autre fenetre) ne compte plus comme choisie :
   * elle n'est plus affichee, l'utilisateur ne pourrait donc pas la decocher.
   */
  const selectedIds = values.strategyIds.filter((id) => testable.some((s) => String(s.id) === id));
  const checkedValues = { ...values, strategyIds: selectedIds };
  // erreurs recalculees a chaque saisie, affichees seulement apres le premier envoi
  const { errors } = buildComparisonRequest(checkedValues);
  const shownError = (field: keyof ComparisonErrors) => (submitted ? errors[field] : undefined);
  const set = (field: SettingField) => (value: string) => onValuesChange({ ...values, [field]: value });

  const toggleStrategy = (id: string, checked: boolean) => onValuesChange({
    ...values,
    strategyIds: checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id),
  });

  const launch = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { request } = buildComparisonRequest(checkedValues);
    if (!request) return;
    setBusy(true);
    setError("");
    try {
      const comparison = await backtestsApi.compare(request);
      scrollToResult.current = true;
      // nouveau resultat : pas encore enregistre ; le critere de classement choisi est garde
      onRunChange({ request, result: comparison, criterion: run?.criterion ?? "sharpe", saved: null, changes: [] });
    } catch (err) {
      setError(errorMessage(err));
      // strategie supprimee entre-temps : la liste est rechargee, elle disparait alors de la selection
      if (isNotFound(err)) onReloadStrategies();
    } finally {
      setBusy(false);
    }
  };

  if ((strategiesLoading && strategies.length === 0) || (assetsLoading && assets.length === 0)) {
    return <CardShell className="p-5 space-y-3"><Skeleton className="h-5 w-56" /><Skeleton className="h-24 w-full" /></CardShell>;
  }
  if (strategies.length === 0 && strategiesError) {
    return <CardShell className="p-4"><ErrorBanner message={strategiesError} onRetry={onReloadStrategies} /></CardShell>;
  }
  if (testable.length < MIN_COMPARED) {
    return (
      <CardShell>
        <EmptyState icon={<GitCompare className="w-6 h-6" />} title="Pas assez de stratégies à comparer"
          text={testable.length === 0 && strategies.length === 0
            ? "Une comparaison rejoue au moins deux stratégies sur le même historique. Commencez par en créer deux."
            : `Une comparaison demande au moins deux stratégies avec un type ; vous en avez ${testable.length}. `
              + "Créez-en une autre, ou modifiez une ancienne stratégie pour choisir sa règle."}
          action={<Button size="sm" onClick={onGoToStrategies}>Aller aux stratégies</Button>} />
      </CardShell>
    );
  }

  /** Champ numerique (saisie en texte, validee a l'envoi). */
  const numberField = (field: SettingField, label: string, options: { hint?: string; placeholder?: string; step?: string } = {}) => (
    <Field label={label} htmlFor={`cmp-${field}`} error={shownError(field)} hint={options.hint}>
      <Input id={`cmp-${field}`} className={FIELD_DARK} type="number" inputMode="decimal" min="0" step={options.step ?? "any"} style={MONO}
        placeholder={options.placeholder} value={values[field]} aria-invalid={!!shownError(field)}
        onChange={(e) => set(field)(e.target.value)} />
    </Field>
  );
  const dateField = (field: "from" | "to" | "splitDate", label: string, hint: string) => (
    <Field label={label} htmlFor={`cmp-${field}`} error={shownError(field)} hint={hint}>
      <Input id={`cmp-${field}`} className={FIELD_DARK} type="date" max={todayIso()} value={values[field]} aria-invalid={!!shownError(field)}
        onChange={(e) => set(field)(e.target.value)} />
    </Field>
  );

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <GitCompare className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Comparer des stratégies</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 max-w-3xl">
              Les stratégies choisies sont rejouées sur le même actif, la même période et avec les mêmes réglages, puis
              comparées entre elles et au buy &amp; hold. Signal à la clôture du jour J, ordre exécuté à la clôture du jour J+1.
            </p>
          </div>
        </div>

        {strategiesError && <div className="mb-4"><ErrorBanner message={strategiesError} onRetry={onReloadStrategies} /></div>}
        {assetsError && <div className="mb-4"><ErrorBanner message={assetsError} /></div>}

        <form onSubmit={launch} noValidate className="space-y-4">
          <fieldset>
            <legend className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              Stratégies à comparer · {selectedIds.length} / {MAX_COMPARED}
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {strategies.map((s) => {
                const id = String(s.id);
                const eligible = !!s.type && s.id != null;
                const checked = eligible && selectedIds.includes(id);
                const full = !checked && selectedIds.length >= MAX_COMPARED;
                const disabled = !eligible || full;
                return (
                  <label key={s.id ?? s.name} htmlFor={`cmp-strategy-${id}`}
                    title={!eligible ? "Choisissez d'abord un type pour cette stratégie (onglet Stratégies)" : full ? `${MAX_COMPARED} stratégies au plus` : undefined}
                    className={`flex min-w-0 items-start gap-2.5 rounded-lg border p-3 transition-colors ${checked ? "border-blue-200 bg-blue-50/60" : "border-border/60"} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/20"}`}>
                    <Checkbox id={`cmp-strategy-${id}`} className="mt-0.5" checked={checked} disabled={disabled} aria-label={`Comparer ${s.name}`}
                      onCheckedChange={(v) => toggleStrategy(id, v === true)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground" title={s.name}>{s.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground" style={MONO}>
                        {s.type ? `${typeShort[s.type]} · ${paramsSummary(s.type, s.params)}` : "Type à définir"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {shownError("strategyIds")
              ? <p role="alert" className="text-[11px] text-red-600 mt-1.5">{shownError("strategyIds")}</p>
              : <p className="text-[11px] text-muted-foreground mt-1.5">Entre {MIN_COMPARED} et {MAX_COMPARED} stratégies ayant un type.</p>}
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-4">
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

          <Button type="submit" disabled={busy}><Play />{busy ? "Comparaison en cours…" : "Lancer la comparaison"}</Button>
        </form>
      </CardShell>

      <div ref={resultRef} className={`scroll-mt-4 transition-opacity ${busy ? "opacity-50" : ""}`}>
        {run && result ? (
          <div className="space-y-4">
            {run.saved && (
              <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                <Check className="w-4 h-4 mt-0.5 shrink-0" />
                {/* l'icone reste a gauche ; sur un telephone, le lien passe sous le texte au lieu de l'ecraser */}
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-[1_1_12rem] wrap-anywhere">Comparaison enregistrée dans l'historique sous le nom « {run.saved.name} ».</span>
                  <button type="button" onClick={() => onOpenSaved(run.saved!.id)} className="min-w-0 text-left font-semibold underline underline-offset-2">
                    Ouvrir dans l'historique
                  </button>
                </div>
              </div>
            )}
            {run.changes.length > 0 && (
              <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p>Le serveur a recalculé la comparaison avant de l'enregistrer, et les données ont changé depuis l'affichage :</p>
                  <ul className="mt-1 list-disc pl-4">{run.changes.map((c) => <li key={c}>{c}</li>)}</ul>
                  <p className="mt-1">Les résultats affichés ci-dessous sont ceux qui ont été enregistrés.</p>
                </div>
              </div>
            )}
            <ComparisonResult result={result} criterion={run.criterion} saved={run.saved}
              onCriterionChange={(criterion) => onRunChange({ ...run, criterion })}
              actions={run.saved ? (
                <Button variant="outline" size="sm" className={OUTLINE_DARK} disabled><Check />Enregistrée</Button>
              ) : (
                <Button size="sm" onClick={() => setSaving(true)}><Save />Enregistrer cette comparaison</Button>
              )} />
          </div>
        ) : (
          <CardShell className="p-8 text-center text-sm text-muted-foreground">
            Le résultat s'affichera ici : courbes superposées, classement, métriques côte à côte et export CSV.
          </CardShell>
        )}
      </div>

      {saving && run && (
        <NameDialog title="Enregistrer cette comparaison" confirmLabel="Enregistrer"
          description={<>
            Le serveur relance la comparaison avec les mêmes stratégies, le même actif et les mêmes réglages, puis l'ajoute
            à l'onglet Historique, classée selon le critère « {rankingLabel(run.criterion)} ».
          </>}
          initialName={defaultComparisonName(run.result)} nameMax={COMPARISON_NAME_MAX} validateName={comparisonNameError}
          onSubmit={async (name) => {
            try {
              const saved = await comparisonsApi.save({ name, rankBy: RANKING_TO_API[run.criterion], request: run.request });
              onRunChange({
                ...run,
                result: saved.result,
                saved: { id: saved.id, name: saved.name, createdAt: saved.createdAt },
                changes: changesSinceDisplay(run.result, saved.result),
              });
            } catch (err) {
              // strategie supprimee entre-temps : la liste est rechargee (le message reste dans la fenetre)
              if (isNotFound(err)) onReloadStrategies();
              throw err;
            }
          }}
          onClose={() => setSaving(false)} />
      )}
    </div>
  );
}
