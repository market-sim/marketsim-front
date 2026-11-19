import { useEffect, useState, type FormEvent } from "react";
import { Check, RotateCcw, Save } from "lucide-react";
import {
  analysisAdminApi, type BacktestSettings, type SimulationDefaultsChange, type SimulationDefaultsRequest,
  type SimulationDefaultsView,
} from "../../../../api/endpoints";
import { errorMessage } from "../../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../../shared/ui";
import { Button } from "../../../../app/components/ui/button";
import { Input } from "../../../../app/components/ui/input";
import { Skeleton } from "../../../../app/components/ui/skeleton";
import {
  buildBacktestRequest, DEFAULT_BACKTEST_FORM, settingsFields, type BacktestField, type SettingsFields,
} from "../../backtestForm";
import { dateTime, money, pctPlain } from "../../format";
import { ErrorBanner, Field, FIELD_DARK, OUTLINE_DARK } from "../Feedback";

/** Nom de chaque parametre, dans le formulaire et dans le journal. */
const LABELS: Record<keyof SimulationDefaultsRequest, string> = {
  initialCapital: "Capital initial",
  feeRate: "Frais par ordre",
  slippage: "Glissement de prix",
  stopLoss: "Stop-loss",
  takeProfit: "Take-profit",
  positionFraction: "Part du capital engagée",
  riskFreeRate: "Taux sans risque",
};

/** Valeur d'un parametre : montant pour le capital, pourcentage pour un taux, « Aucun » pour un stop-loss desactive. */
function valueText(field: keyof SimulationDefaultsRequest, value: number | string | null | undefined): string {
  if (value == null || value === "aucun") return "Aucun";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return field === "initialCapital" ? money(n) : pctPlain(n, 2);
}

/** Resume d'un jeu de parametres sur une ligne. */
const summary = (s: BacktestSettings) => [
  `capital ${money(s.initialCapital)}`, `frais ${pctPlain(s.feeRate, 2)}`, `glissement ${pctPlain(s.slippage, 2)}`,
  `stop-loss ${s.stopLoss == null ? "aucun" : pctPlain(s.stopLoss, 2)}`,
  `take-profit ${s.takeProfit == null ? "aucun" : pctPlain(s.takeProfit, 2)}`,
  `part engagée ${pctPlain(s.positionFraction, 0)}`, `taux sans risque ${pctPlain(s.riskFreeRate ?? 0, 2)}`,
].join(" · ");

/** Les champs du formulaire, dans l'ordre d'affichage. */
const FIELDS: { key: keyof SettingsFields; label: string; hint?: string; placeholder?: string; step?: string }[] = [
  { key: "capital", label: "Capital initial ($)", step: "100" },
  { key: "feePct", label: "Frais par ordre (%)", hint: "0,1 % à l'origine" },
  { key: "slippagePct", label: "Glissement de prix (%)" },
  { key: "positionPct", label: "Part du capital engagée (%)" },
  { key: "stopLossPct", label: "Stop-loss (%)", placeholder: "Aucun", hint: "Vide : aucun" },
  { key: "takeProfitPct", label: "Take-profit (%)", placeholder: "Aucun", hint: "Vide : aucun" },
  { key: "riskFreePct", label: "Taux sans risque (% par an)", hint: "Pour Sharpe et Sortino" },
];

interface Props {
  onDefaultsChanged: (d: BacktestSettings) => void;
}

/**
 * Parametres par defaut des simulations (GET/PUT /api/analysis/admin/defaults) et journal des modifications.
 * Memes controles que le formulaire de backtest (le back reste l'arbitre, avec les memes regles).
 */
export default function AdminDefaults({ onDefaultsChanged }: Props) {
  const [view, setView] = useState<SimulationDefaultsView | null>(null);
  const [history, setHistory] = useState<SimulationDefaultsChange[] | null>(null);
  const [values, setValues] = useState<SettingsFields | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    Promise.all([analysisAdminApi.defaults(), analysisAdminApi.defaultsHistory()])
      .then(([v, h]) => {
        if (cancelled) return;
        setView(v);
        setHistory(h);
        setValues(settingsFields(v.current));
      })
      .catch((e) => { if (!cancelled) setLoadError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [reload]);

  if (loadError) return <ErrorBanner message={loadError} onRetry={() => setReload((n) => n + 1)} />;
  if (!view || !values || !history) {
    return <CardShell className="p-5 space-y-3"><Skeleton className="h-5 w-64" /><Skeleton className="h-40 w-full" /></CardShell>;
  }

  // meme validation que le formulaire de backtest (strategie et actif fictifs : seuls les reglages sont controles)
  const checked = buildBacktestRequest({ ...DEFAULT_BACKTEST_FORM, strategyId: "1", symbol: "-", ...values });
  const shownError = (key: BacktestField) => (submitted ? checked.errors[key] : undefined);
  const saved = settingsFields(view.current);
  const dirty = (Object.keys(values) as (keyof SettingsFields)[]).some((k) => values[k] !== saved[k]);
  const original = settingsFields(view.original);
  const isOriginal = (Object.keys(values) as (keyof SettingsFields)[]).every((k) => values[k] === original[k]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setNotice("");
    const r = checked.request;
    if (!r) return;
    const req: SimulationDefaultsRequest = {
      initialCapital: r.initialCapital!, feeRate: r.feeRate!, slippage: r.slippage!,
      stopLoss: r.stopLoss ? r.stopLoss : null, takeProfit: r.takeProfit ? r.takeProfit : null,
      positionFraction: r.positionFraction!, riskFreeRate: r.riskFreeRate ?? 0,
    };
    setSaving(true);
    setError("");
    try {
      const next = await analysisAdminApi.updateDefaults(req);
      setView(next);
      setValues(settingsFields(next.current));
      setHistory(await analysisAdminApi.defaultsHistory());
      setSubmitted(false);
      setNotice("Paramètres enregistrés : ils s'appliquent aux prochains backtests et comparaisons de tous les utilisateurs.");
      onDefaultsChanged(next.current);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Paramètres par défaut des simulations</h3>
        <p className="text-[12px] text-muted-foreground mt-0.5 max-w-3xl">
          Utilisés par un backtest ou une comparaison quand l'utilisateur ne donne pas de valeur, et proposés dans les formulaires.
          Les résultats déjà enregistrés gardent les réglages avec lesquels ils ont été calculés.
        </p>
        <p className="text-[11px] text-muted-foreground mt-2">
          {view.updatedAt
            ? <>Dernière modification le {dateTime(view.updatedAt)} par <span className="text-foreground">{view.updatedBy}</span>.</>
            : "Valeurs d'origine : jamais modifiées."}
        </p>

        <form onSubmit={save} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-4">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`def-${f.key}`} error={shownError(f.key)} hint={f.hint}>
                <Input id={`def-${f.key}`} className={FIELD_DARK} type="number" inputMode="decimal" min="0" step={f.step ?? "any"}
                  style={MONO} placeholder={f.placeholder} value={values[f.key]} aria-invalid={!!shownError(f.key)}
                  onChange={(e) => { setValues({ ...values, [f.key]: e.target.value }); setNotice(""); }} />
              </Field>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Valeurs d'origine : {summary(view.original)}.</p>

          {error && <ErrorBanner message={error} />}
          {notice && (
            <p role="status" className="flex items-start gap-1.5 text-[12px] text-emerald-700 dark:text-emerald-300">
              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />{notice}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || !dirty}><Save />{saving ? "Enregistrement…" : "Enregistrer"}</Button>
            <Button type="button" variant="outline" className={OUTLINE_DARK} disabled={saving || !dirty}
              onClick={() => { setValues(saved); setSubmitted(false); setError(""); }}>
              Annuler les modifications
            </Button>
            <Button type="button" variant="outline" className={`max-w-full h-auto min-h-9 whitespace-normal text-left ${OUTLINE_DARK}`}
              disabled={saving || isOriginal}
              onClick={() => { setValues(original); setNotice(""); }}>
              <RotateCcw />Reprendre les valeurs d'origine
            </Button>
          </div>
        </form>
      </CardShell>

      <CardShell className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Journal des modifications</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Une ligne par paramètre modifié, la plus récente d'abord.</p>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-6 text-center text-[12px] text-muted-foreground">Aucune modification pour l'instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-3 py-3">Administrateur</th>
                  <th className="text-left px-3 py-3">Paramètre</th>
                  <th className="text-right px-3 py-3">Avant</th>
                  <th className="text-right px-5 py-3">Après</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {history.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-2.5 text-muted-foreground whitespace-nowrap" style={MONO}>{dateTime(c.changedAt)}</td>
                    <td className="px-3 py-2.5 text-foreground">{c.changedBy}</td>
                    <td className="px-3 py-2.5 text-foreground">{LABELS[c.field] ?? c.field}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap" style={MONO}>{valueText(c.field, c.oldValue)}</td>
                    <td className="px-5 py-2.5 text-right font-medium text-foreground whitespace-nowrap" style={MONO}>{valueText(c.field, c.newValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>
    </div>
  );
}
