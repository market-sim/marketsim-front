import { useState, type FormEvent, type ReactNode } from "react";
import { strategiesApi, type Strategy, type StrategyParams, type StrategyType } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { MONO } from "../../../shared/ui";
import { Button } from "../../../app/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../app/components/ui/dialog";
import { Input } from "../../../app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../app/components/ui/select";
import { Switch } from "../../../app/components/ui/switch";
import { Textarea } from "../../../app/components/ui/textarea";
import { isNotFound } from "../errors";
import {
  draftFor, paramFields, STRATEGY_TYPES, typeLabel, typeRule, validateParams, type ParamDraft, type ParamErrors,
} from "../strategyRules";
import { Field, FIELD_DARK, OUTLINE_DARK, SWITCH_DARK, useReturnFocus } from "./Feedback";

/** Creation preremplie, par exemple a partir d'une configuration d'indicateurs (onglet Analyse technique). */
export interface StrategyPreset {
  name: string;
  description: string;
  /** type choisi a l'ouverture */
  type: StrategyType;
  /** parametres proposes pour un type (ils changent avec le type choisi) ; null = valeurs par defaut du type */
  paramsFor: (type: StrategyType) => StrategyParams | null;
  /** d'ou viennent les parametres du type choisi, affiche sous les champs */
  sourceNote: (type: StrategyType) => string;
  /** phrase d'introduction de la fenetre */
  intro: ReactNode;
}

interface Props {
  /** strategie a modifier ; absent = creation */
  initial?: Strategy;
  /** creation preremplie (ignore si `initial` est fourni) */
  preset?: StrategyPreset;
  onSaved: (saved: Strategy) => void;
  /** la strategie a modifier n'existe plus cote back (404) : la liste derriere la fenetre est a recharger */
  onGone?: () => void;
  onClose: () => void;
}

const NAME_MAX = 80;

/** Creation / modification d'une strategie. A monter seulement quand le formulaire doit s'afficher. */
export default function StrategyFormDialog({ initial, preset: presetProp, onSaved, onGone, onClose }: Props) {
  const preset = initial ? undefined : presetProp;
  const [name, setName] = useState(initial?.name ?? preset?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? preset?.description ?? "");
  const [type, setType] = useState<StrategyType | "">(initial?.type ?? preset?.type ?? "");
  const [draft, setDraft] = useState<ParamDraft>(() => (
    initial?.type ? draftFor(initial.type, initial.params) : preset ? draftFor(preset.type, preset.paramsFor(preset.type)) : {}
  ));
  const [active, setActive] = useState(initial?.status !== "PAUSED");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const returnFocus = useReturnFocus();

  // les erreurs ne s'affichent qu'apres une premiere tentative d'enregistrement, puis se mettent a jour a la saisie
  const nameError = name.trim() === "" ? "Le nom est obligatoire" : "";
  const typeError = type === "" ? "Choisissez un type de stratégie" : "";
  const checked = type === "" ? { params: {}, errors: {} as ParamErrors } : validateParams(type, draft);
  const invalid = !!nameError || !!typeError || Object.keys(checked.errors).length > 0;

  /** Changer de type remet les parametres par defaut de ce type (ou ceux proposes par le preremplissage). */
  const chooseType = (next: StrategyType) => {
    setType(next);
    setDraft(draftFor(next, next === initial?.type ? initial.params : preset ? preset.paramsFor(next) : null));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (invalid || type === "") return;
    setBusy(true);
    setServerError("");
    const payload: Strategy = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      params: checked.params,
      status: active ? "ACTIVE" : "PAUSED",
    };
    try {
      onSaved(initial?.id != null ? await strategiesApi.update(initial.id, payload) : await strategiesApi.create(payload));
    } catch (err) {
      setServerError(errorMessage(err));
      setBusy(false);
      // supprimee entre-temps : le message reste dans la fenetre, et sa ligne disparait de la liste
      if (isNotFound(err)) onGone?.();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" onCloseAutoFocus={returnFocus}>
        <DialogHeader>
          <DialogTitle>{initial ? "Modifier la stratégie" : "Nouvelle stratégie"}</DialogTitle>
          <DialogDescription>
            {preset?.intro ?? "Le type fixe la règle d'achat et de vente ; ses paramètres se règlent ci-dessous."}
            {initial ? " Les backtests déjà enregistrés gardent les paramètres avec lesquels ils ont été lancés." : ""}
          </DialogDescription>
        </DialogHeader>

        {/* min-w-0 : sans lui, le libelle du type (sans retour a la ligne) elargit la fenetre au-dela de l'ecran d'un telephone */}
        <form onSubmit={submit} noValidate className="space-y-4 min-w-0">
          <Field label="Nom" htmlFor="strategy-name" error={submitted ? nameError : undefined}>
            <Input id="strategy-name" className={FIELD_DARK} value={name} maxLength={NAME_MAX} autoFocus placeholder="Croisement 20 / 50 sur AAPL"
              aria-invalid={submitted && !!nameError} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Description (facultatif)" htmlFor="strategy-description">
            <Textarea id="strategy-description" className={FIELD_DARK} value={description} maxLength={255} rows={2}
              placeholder="À quoi sert cette stratégie, sur quel type de marché…" onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <Field label="Type de stratégie" error={submitted ? typeError : undefined} hint={type ? typeRule[type] : undefined}>
            <Select value={type} onValueChange={(v) => chooseType(v as StrategyType)}>
              <SelectTrigger className={`w-full ${FIELD_DARK}`} aria-label="Type de stratégie" aria-invalid={submitted && !!typeError}>
                <SelectValue placeholder="Choisir un type" />
              </SelectTrigger>
              <SelectContent>
                {STRATEGY_TYPES.map((t) => <SelectItem key={t} value={t}>{typeLabel[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {type !== "" && paramFields[type].length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {paramFields[type].map((f) => (
                <Field key={f.key} label={f.label} htmlFor={`param-${f.key}`} error={submitted ? checked.errors[f.key] : undefined}>
                  <Input id={`param-${f.key}`} className={FIELD_DARK} type="number" inputMode="decimal" step={f.period ? "1" : "any"} style={MONO}
                    value={draft[f.key] ?? ""} aria-invalid={submitted && !!checked.errors[f.key]}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                </Field>
              ))}
            </div>
          )}
          {preset && type !== "" && (
            <p className="-mt-1 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-foreground/80">{preset.sourceNote(type)}</p>
          )}

          <div className="flex items-center gap-3">
            <Switch id="strategy-active" className={SWITCH_DARK} checked={active} onCheckedChange={setActive} />
            <label htmlFor="strategy-active" className="text-sm text-foreground">
              {active ? "Stratégie active" : "Stratégie en pause"}
            </label>
          </div>

          {serverError && <p role="alert" className="text-xs text-red-600">{serverError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" className={OUTLINE_DARK} disabled={busy} onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
