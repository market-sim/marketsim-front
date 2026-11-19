import { useEffect, useState } from "react";
import { Check, FlaskConical, Info, ListChecks, Pencil, RefreshCw, Save, Trash2 } from "lucide-react";
import { indicatorConfigsApi, type IndicatorConfig, type Strategy } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { Button } from "../../../app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../app/components/ui/select";
import { ignoreNotFound, isNotFound } from "../errors";
import {
  CONFIG_DESCRIPTION_MAX, CONFIG_NAME_MAX, configNameError, configRequest, matchesConfig, STRATEGY_SOURCE,
  strategyParamsFromPeriods,
} from "../indicatorConfigs";
import type { Periods, Visibility } from "../technical";
import ConfirmDialog from "./ConfirmDialog";
import { ErrorBanner, Field, FIELD_DARK, OUTLINE_DARK } from "./Feedback";
import NameDialog from "./NameDialog";
import StrategyFormDialog, { type StrategyPreset } from "./StrategyFormDialog";

interface Props {
  /** reglages appliques (ceux des courbes affichees) */
  periods: Periods;
  show: Visibility;
  /** des periodes ont ete saisies mais pas encore appliquees */
  draftDirty: boolean;
  /** configuration choisie (gardee par la page : elle survit au changement d'onglet) */
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  /** applique les periodes et les indicateurs affiches d'une configuration */
  onApply: (config: IndicatorConfig) => void;
  onStrategyCreated: (strategy: Strategy) => void;
  onBacktestStrategy: (strategy: Strategy) => void;
}

const NONE = "none";
const byName = (a: IndicatorConfig, b: IndicatorConfig) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" });

/**
 * Configurations d'indicateurs (GET/POST/PUT/DELETE /api/analysis/indicator-configs) : choisir et appliquer,
 * enregistrer sous un nouveau nom, mettre a jour, renommer, supprimer, et creer une strategie a partir des
 * reglages affiches.
 */
export default function IndicatorConfigBar({
  periods, show, draftDirty, selectedId, onSelect, onApply, onStrategyCreated, onBacktestStrategy,
}: Props) {
  const [configs, setConfigs] = useState<IndicatorConfig[] | null>(null);
  const [listError, setListError] = useState("");
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState<Strategy | null>(null);
  const [updating, setUpdating] = useState(false);
  const [dialog, setDialog] = useState<"saveAs" | "rename" | "delete" | "strategy" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setListError("");
    indicatorConfigsApi.list()
      .then((list) => { if (!cancelled) setConfigs([...list].sort(byName)); })
      .catch((e) => { if (!cancelled) setListError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [reload]);

  const selected = configs?.find((c) => c.id === selectedId) ?? null;
  // configuration supprimee ailleurs (autre fenetre) : elle n'est plus choisie
  useEffect(() => {
    if (configs && selectedId != null && !selected) onSelect(null);
  }, [configs, selectedId, selected, onSelect]);

  const modified = selected != null && !matchesConfig(selected, periods, show);

  const say = (message: string) => { setNotice(message); setError(""); setCreated(null); };
  const replace = (config: IndicatorConfig) =>
    setConfigs((list) => [...(list ?? []).filter((c) => c.id !== config.id), config].sort(byName));
  /** la configuration n'existe plus cote back : on la retire de la liste */
  const gone = (id: number) => {
    setConfigs((list) => list?.filter((c) => c.id !== id) ?? list);
    onSelect(null);
  };

  const choose = (value: string) => {
    setNotice("");
    setError("");
    setCreated(null);
    if (value === NONE) { onSelect(null); return; }
    const config = configs?.find((c) => String(c.id) === value);
    if (!config) return;
    onSelect(config.id);
    onApply(config);
  };

  const update = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      const saved = await indicatorConfigsApi.update(selected.id,
        configRequest(selected.name, selected.description ?? "", periods, show));
      replace(saved);
      say(`« ${saved.name} » mise à jour avec les réglages affichés.`);
    } catch (e) {
      setNotice("");
      setError(errorMessage(e));
      if (isNotFound(e)) gone(selected.id);
    } finally {
      setUpdating(false);
    }
  };

  const strategyPreset = (config: IndicatorConfig): StrategyPreset => ({
    name: config.name,
    description: `Créée à partir de la configuration d'indicateurs « ${config.name} ».`,
    type: "SMA_CROSS",
    paramsFor: (type) => strategyParamsFromPeriods(type, periods),
    sourceNote: (type) => STRATEGY_SOURCE[type],
    intro: modified
      ? <>Paramètres repris des réglages affichés, modifiés depuis « {config.name} ». Choisissez la règle : les paramètres suivent le type choisi.</>
      : <>Paramètres repris de la configuration « {config.name} ». Choisissez la règle : les paramètres suivent le type choisi.</>,
  });

  return (
    <div className="space-y-3 border-b border-border/60 pb-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <Field label="Configuration" className="w-full sm:w-64">
          <Select value={selected ? String(selected.id) : NONE} onValueChange={choose} disabled={configs == null}>
            <SelectTrigger className={FIELD_DARK} aria-label="Configuration d'indicateurs">
              <SelectValue placeholder={configs == null ? "Chargement…" : "Aucune"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Aucune (réglages libres)</SelectItem>
              {configs?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          {selected && (
            <Button size="sm" disabled={!modified || updating} onClick={update}
              title={modified ? `Remplace les réglages de « ${selected.name} » par ceux affichés` : "Les réglages affichés sont déjà ceux de la configuration"}>
              <RefreshCw />{updating ? "Mise à jour…" : "Mettre à jour"}
            </Button>
          )}
          {/* sur un telephone, « Enregistrer sous… » passe en dernier : les deux icones tiennent a cote de « Mettre a jour » */}
          <Button variant="outline" size="sm" className={`max-sm:order-last ${OUTLINE_DARK}`} disabled={configs == null} onClick={() => setDialog("saveAs")}>
            <Save />Enregistrer sous…
          </Button>
          {selected && (
            <div className="flex gap-2">
              <Button variant="outline" size="icon" className={`size-8 ${OUTLINE_DARK}`} title="Renommer"
                aria-label={`Renommer la configuration ${selected.name}`} onClick={() => setDialog("rename")}>
                <Pencil />
              </Button>
              <Button variant="outline" size="icon" className={`size-8 text-red-600 hover:text-red-700 dark:text-red-400 ${OUTLINE_DARK}`}
                title="Supprimer" aria-label={`Supprimer la configuration ${selected.name}`} onClick={() => setDialog("delete")}>
                <Trash2 />
              </Button>
            </div>
          )}
        </div>
        {selected && (
          // libelle sur deux lignes si la place manque, plutot que tronque
          <Button variant="outline" size="sm" className={`lg:ml-auto max-w-full h-auto min-h-8 py-1.5 whitespace-normal text-left ${OUTLINE_DARK}`}
            onClick={() => setDialog("strategy")}>
            <ListChecks />Créer une stratégie à partir de cette configuration
          </Button>
        )}
      </div>

      {listError && <ErrorBanner message={listError} onRetry={() => setReload((n) => n + 1)} />}
      {error && <ErrorBanner message={error} />}

      {selected && modified && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <Info className="w-4 h-4 mt-px shrink-0" />
          {/* l'icone reste a gauche du texte ; le lien passe sous le texte quand la place manque */}
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-1">
            <span className="min-w-0 flex-[1_1_12rem] wrap-anywhere">
              Modifiée : les réglages affichés ne correspondent plus à « {selected.name} ».
              « Mettre à jour » les enregistre dans la configuration.
            </span>
            <button type="button" className="min-w-0 text-left font-semibold underline underline-offset-2" onClick={() => { onApply(selected); setNotice(""); }}>
              Revenir à la configuration
            </button>
          </div>
        </div>
      )}
      {selected && !modified && !notice && !created && (
        <p className="text-[11px] text-muted-foreground wrap-anywhere">
          Réglages de « {selected.name} » appliqués.{selected.description ? ` ${selected.description}` : ""}
        </p>
      )}
      {!selected && configs != null && !notice && (
        <p className="text-[11px] text-muted-foreground">
          {configs.length === 0
            ? "Enregistrez les réglages ci-dessous (périodes et indicateurs affichés) pour les retrouver plus tard, sur n'importe quel actif."
            : "Choisissez une configuration pour appliquer ses périodes et ses indicateurs affichés à l'actif choisi."}
        </p>
      )}
      {notice && (
        <p role="status" className="flex items-start gap-1.5 text-[12px] text-emerald-700 dark:text-emerald-300 wrap-anywhere">
          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />{notice}
        </p>
      )}
      {created && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <Check className="w-4 h-4 mt-1.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="min-w-0 flex-[1_1_12rem] wrap-anywhere">Stratégie « {created.name} » créée : elle est dans l'onglet Stratégies.</span>
            <Button size="sm" variant="outline" className={OUTLINE_DARK} onClick={() => onBacktestStrategy(created)}>
              <FlaskConical />La backtester
            </Button>
          </div>
        </div>
      )}
      {draftDirty && (
        <p className="text-[11px] text-muted-foreground">
          Des périodes saisies ne sont pas encore appliquées : la configuration compare et enregistre les réglages appliqués, ceux des courbes.
        </p>
      )}

      {dialog === "saveAs" && configs && (
        <NameDialog title="Enregistrer la configuration" confirmLabel="Enregistrer"
          description="Les périodes et les indicateurs affichés sont enregistrés sous ce nom. L'actif et la période ne le sont pas : la configuration s'applique à n'importe quel actif."
          initialName="" nameMax={CONFIG_NAME_MAX} validateName={(n) => configNameError(n, configs)}
          descriptionField={{ initial: "", max: CONFIG_DESCRIPTION_MAX }}
          onSubmit={async (name, description) => {
            const saved = await indicatorConfigsApi.create(configRequest(name, description, periods, show));
            replace(saved);
            onSelect(saved.id);
            say(`Configuration « ${saved.name} » enregistrée.`);
          }}
          onClose={() => setDialog(null)} />
      )}

      {dialog === "rename" && selected && configs && (
        <NameDialog title="Renommer la configuration" confirmLabel="Renommer"
          description="Seuls le nom et la description changent : les réglages enregistrés restent les mêmes."
          initialName={selected.name} nameMax={CONFIG_NAME_MAX} validateName={(n) => configNameError(n, configs, selected.id)}
          descriptionField={{ initial: selected.description ?? "", max: CONFIG_DESCRIPTION_MAX }}
          onSubmit={async (name, description) => {
            try {
              // les reglages enregistres de la configuration, pas ceux affiches
              const saved = await indicatorConfigsApi.update(selected.id, configRequest(name, description, selected.periods, selected.show));
              replace(saved);
              say(`Configuration renommée « ${saved.name} ».`);
            } catch (e) {
              if (isNotFound(e)) gone(selected.id);
              throw e;
            }
          }}
          onClose={() => setDialog(null)} />
      )}

      {dialog === "delete" && selected && (
        <ConfirmDialog title="Supprimer cette configuration ?" confirmLabel="Supprimer"
          description={<>La configuration « {selected.name} » sera supprimée. Les réglages affichés et les stratégies déjà créées ne changent pas. Cette action est définitive.</>}
          onConfirm={async () => {
            const name = selected.name;
            await indicatorConfigsApi.remove(selected.id).catch(ignoreNotFound);
            gone(selected.id);
            say(`Configuration « ${name} » supprimée.`);
          }}
          onClose={() => setDialog(null)} />
      )}

      {dialog === "strategy" && selected && (
        <StrategyFormDialog preset={strategyPreset(selected)}
          onSaved={(strategy) => {
            setDialog(null);
            setNotice("");
            setError("");
            setCreated(strategy);
            onStrategyCreated(strategy);
          }}
          onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
