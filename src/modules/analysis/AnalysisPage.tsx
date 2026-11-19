import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { FlaskConical, GitCompare, History, Landmark, LineChart, ListChecks } from "lucide-react";
import { assetsApi, strategiesApi, type Asset, type BacktestDetail, type Strategy } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../app/components/ui/tabs";
import { useCoachFocus } from "../coach/coachFocus";
import { DEFAULT_BACKTEST_FORM, type BacktestFormValues } from "./backtestForm";
import BacktestTab from "./components/BacktestTab";
import ComparisonTab from "./components/ComparisonTab";
import FundamentalsTab from "./components/FundamentalsTab";
import HistoryTab, { type HistorySection } from "./components/HistoryTab";
import StrategiesTab from "./components/StrategiesTab";
import TechnicalTab from "./components/TechnicalTab";
import { DEFAULT_TECH, type TechSettings } from "./technical";
import { DEFAULT_COMPARISON_FORM, type ComparisonFormValues, type ComparisonRun } from "./comparison";

type TabId = "technique" | "fondamentale" | "strategies" | "backtest" | "historique" | "comparaison";

const TABS: { id: TabId; label: string; Icon: typeof LineChart }[] = [
  { id: "technique", label: "Analyse technique", Icon: LineChart },
  { id: "fondamentale", label: "Analyse fondamentale", Icon: Landmark },
  { id: "strategies", label: "Stratégies", Icon: ListChecks },
  { id: "backtest", label: "Backtest", Icon: FlaskConical },
  { id: "historique", label: "Historique", Icon: History },
  { id: "comparaison", label: "Comparaison", Icon: GitCompare },
];

/** Meme apparence que les onglets du module Agent : pastille bleue sur l'onglet actif. */
const TAB_CLASS =
  "flex-none h-auto gap-1.5 rounded-lg border-0 px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted/50 "
  + "data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:hover:bg-blue-600 "
  + "dark:text-muted-foreground dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white";

/**
 * Module 3 : Analyse financiere & Backtesting.
 * Une seule route (/analysis) : l'onglet affiche est dans l'URL (?tab=...), ainsi que, dans l'historique, la section
 * (&section=comparaisons), le backtest ouvert (&id=...) ou la comparaison ouverte (&comparison=...).
 * La page garde ce qui doit survivre a un changement d'onglet : reglages, saisie et dernier resultat.
 */
export default function AnalysisPage() {
  const [search, setSearch] = useSearchParams();
  const tab: TabId = TABS.find((t) => t.id === search.get("tab"))?.id ?? "technique";
  /** identifiant strictement positif lu dans l'URL, sinon null */
  const idFrom = (name: string) => {
    const value = Number(search.get(name));
    return Number.isInteger(value) && value > 0 ? value : null;
  };
  const historySection: HistorySection = search.get("section") === "comparaisons" ? "comparaisons" : "backtests";
  const openId = tab === "historique" && historySection === "backtests" ? idFrom("id") : null;
  const openComparisonId = tab === "historique" && historySection === "comparaisons" ? idFrom("comparison") : null;

  /** change d'onglet ; extra : autres parametres de l'URL (section, id, comparison) */
  const go = (next: TabId, extra: Record<string, string> = {}) =>
    setSearch(next === "technique" && Object.keys(extra).length === 0 ? {} : { tab: next, ...extra });
  const openSavedComparison = (id: number | null) =>
    go("historique", id != null ? { section: "comparaisons", comparison: String(id) } : { section: "comparaisons" });

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState("");
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(true);
  const [strategiesError, setStrategiesError] = useState("");

  const [tech, setTech] = useState<TechSettings>(DEFAULT_TECH);
  /** configuration d'indicateurs choisie dans l'analyse technique (null : reglages libres) */
  const [techConfigId, setTechConfigId] = useState<number | null>(null);
  const [form, setForm] = useState<BacktestFormValues>(DEFAULT_BACKTEST_FORM);
  const [result, setResult] = useState<BacktestDetail | null>(null);
  const [comparisonForm, setComparisonForm] = useState<ComparisonFormValues>(DEFAULT_COMPARISON_FORM);
  const [comparison, setComparison] = useState<ComparisonRun | null>(null);
  /** action affichee dans l'analyse fondamentale (vide : la premiere de la liste) */
  const [fundamentalSymbol, setFundamentalSymbol] = useState("");

  const loadStrategies = useCallback(async () => {
    setStrategiesLoading(true);
    setStrategiesError("");
    try {
      setStrategies(await strategiesApi.list());
    } catch (e) {
      setStrategiesError(errorMessage(e));
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategies();
    assetsApi.list()
      .then((list) => {
        setAssets(list);
        // premier actif de la liste par defaut, dans les deux formulaires
        const first = list[0]?.symbol ?? "";
        setTech((t) => (t.symbol ? t : { ...t, symbol: first }));
        setForm((f) => (f.symbol ? f : { ...f, symbol: first }));
        setComparisonForm((f) => (f.symbol ? f : { ...f, symbol: first }));
      })
      .catch((e) => setAssetsError(errorMessage(e)))
      .finally(() => setAssetsLoading(false));
  }, [loadStrategies]);

  // le coach (present sur tous les ecrans) analyse l'actif affiche dans l'analyse technique
  useCoachFocus(tech.symbol || undefined);

  const backtestStrategy = (s: Strategy) => {
    setForm((f) => ({ ...f, strategyId: String(s.id) }));
    go("backtest");
  };

  return (
    <Tabs value={tab} onValueChange={(v) => go(v as TabId)} className="gap-5">
      <TabsList className="h-auto w-full max-w-full flex-wrap justify-start gap-1 rounded-xl border border-border/60 bg-white p-1 dark:bg-card sm:w-fit">
        {TABS.map(({ id, label, Icon }) => (
          <TabsTrigger key={id} value={id} className={TAB_CLASS}><Icon className="w-3.5 h-3.5" />{label}</TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="technique">
        <TechnicalTab assets={assets} assetsLoading={assetsLoading} assetsError={assetsError} settings={tech} onChange={setTech}
          configId={techConfigId} onConfigIdChange={setTechConfigId}
          onStrategyCreated={() => loadStrategies()} onBacktestStrategy={backtestStrategy} />
      </TabsContent>

      <TabsContent value="fondamentale">
        <FundamentalsTab symbol={fundamentalSymbol} onSymbolChange={setFundamentalSymbol} />
      </TabsContent>

      <TabsContent value="strategies">
        <StrategiesTab strategies={strategies} loading={strategiesLoading} error={strategiesError}
          onReload={loadStrategies} onBacktest={backtestStrategy} />
      </TabsContent>

      <TabsContent value="backtest">
        <BacktestTab strategies={strategies} strategiesLoading={strategiesLoading} assets={assets}
          values={form} onValuesChange={setForm} result={result}
          onResult={(detail) => { setResult(detail); loadStrategies(); }} onStrategyGone={loadStrategies}
          onGoToStrategies={() => go("strategies")} onOpenHistory={() => go("historique")} />
      </TabsContent>

      <TabsContent value="historique">
        <HistoryTab strategies={strategies} openId={openId} onOpen={(id) => go("historique", id != null ? { id: String(id) } : {})}
          onDeleted={(id) => { if (result?.id === id) setResult(null); loadStrategies(); }}
          onGoToBacktest={() => go("backtest")}
          section={historySection} onSection={(s) => go("historique", s === "comparaisons" ? { section: s } : {})}
          openComparisonId={openComparisonId} onOpenComparison={openSavedComparison}
          onGoToComparison={() => go("comparaison")} />
      </TabsContent>

      <TabsContent value="comparaison">
        <ComparisonTab strategies={strategies} strategiesLoading={strategiesLoading} strategiesError={strategiesError}
          assets={assets} assetsLoading={assetsLoading} assetsError={assetsError}
          values={comparisonForm} onValuesChange={setComparisonForm} run={comparison}
          onRunChange={setComparison} onGoToStrategies={() => go("strategies")} onReloadStrategies={loadStrategies}
          onOpenSaved={openSavedComparison} />
      </TabsContent>
    </Tabs>
  );
}
