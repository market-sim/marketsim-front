import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { FlaskConical, GitCompare, History, Landmark, LineChart, ListChecks, ShieldCheck } from "lucide-react";
import {
  assetsApi, defaultsApi, strategiesApi, type Asset, type BacktestDetail, type BacktestSettings,
  type SavedComparisonDetail, type Strategy,
} from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../app/components/ui/tabs";
import { useCoachFocus } from "../coach/coachFocus";
import {
  applyDefaults, DEFAULT_BACKTEST_FORM, SETTINGS_KEYS, settingsFields, type BacktestFormValues, type SettingsFields,
} from "./backtestForm";
import AdminTab, { type AdminSection } from "./components/admin/AdminTab";
import BacktestTab from "./components/BacktestTab";
import ComparisonTab from "./components/ComparisonTab";
import FundamentalsTab from "./components/FundamentalsTab";
import HistoryTab, { type HistorySection } from "./components/HistoryTab";
import StrategiesTab from "./components/StrategiesTab";
import TechnicalTab from "./components/TechnicalTab";
import { DEFAULT_TECH, type TechSettings } from "./technical";
import { DEFAULT_COMPARISON_FORM, type ComparisonFormValues, type ComparisonRun } from "./comparison";

type TabId = "technique" | "fondamentale" | "strategies" | "backtest" | "historique" | "comparaison" | "admin";

/** adminOnly : onglet absent pour un utilisateur ordinaire (et ?tab=admin le ramene a l'analyse technique). */
const TABS: { id: TabId; label: string; Icon: typeof LineChart; adminOnly?: boolean }[] = [
  { id: "technique", label: "Analyse technique", Icon: LineChart },
  { id: "fondamentale", label: "Analyse fondamentale", Icon: Landmark },
  { id: "strategies", label: "Stratégies", Icon: ListChecks },
  { id: "backtest", label: "Backtest", Icon: FlaskConical },
  { id: "historique", label: "Historique", Icon: History },
  { id: "comparaison", label: "Comparaison", Icon: GitCompare },
  { id: "admin", label: "Administration", Icon: ShieldCheck, adminOnly: true },
];

const ADMIN_SECTIONS: AdminSection[] = ["defaults", "results", "stats", "cache"];

/** Meme apparence que les onglets du module Agent : pastille bleue sur l'onglet actif. */
const TAB_CLASS =
  "flex-none h-auto gap-1.5 rounded-lg border-0 px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted/50 "
  + "data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:hover:bg-blue-600 "
  + "dark:text-muted-foreground dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white";

/**
 * Module 3 : Analyse financiere & Backtesting.
 * Une seule route (/analysis) : l'onglet affiche est dans l'URL (?tab=...), ainsi que, dans l'historique, la section
 * (&section=comparaisons), le backtest ouvert (&id=...) ou la comparaison ouverte (&comparison=...), et dans
 * l'administration (ADMIN seulement) la section (&section=defaults|results|stats|cache), la liste (&view=) et
 * l'element ouvert (&id=).
 * La page garde ce qui doit survivre a un changement d'onglet : reglages, saisie et dernier resultat.
 */
export default function AnalysisPage() {
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();
  // meme facon que le reste du front de connaitre le role (ProtectedRoute, FundamentalsTab) ; le back reste
  // l'arbitre : ses routes d'administration repondent 403 a un utilisateur ordinaire
  const isAdmin = user?.role === "ADMIN";
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const tab: TabId = visibleTabs.find((t) => t.id === search.get("tab"))?.id ?? "technique";
  const adminSection: AdminSection = ADMIN_SECTIONS.find((s) => s === search.get("section")) ?? "defaults";
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

  // Parametres par defaut de l'administrateur : ils preremplissent les formulaires Backtest et Comparaison.
  // On garde ceux deja appliques pour ne remplacer, a chaque changement, que les champs non modifies.
  const appliedDefaults = useRef<SettingsFields>(
    Object.fromEntries(SETTINGS_KEYS.map((k) => [k, DEFAULT_BACKTEST_FORM[k]])) as SettingsFields);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const applyAdminDefaults = useCallback((d: BacktestSettings) => {
    const next = settingsFields(d);
    const previous = appliedDefaults.current;
    setForm((f) => applyDefaults(f, previous, next));
    setComparisonForm((f) => applyDefaults(f, previous, next));
    appliedDefaults.current = next;
    setDefaultsLoaded(true);
  }, []);

  useEffect(() => {
    // sans reponse, les formulaires gardent les valeurs d'origine (les memes que le back sans modification)
    defaultsApi.get().then(applyAdminDefaults).catch(() => undefined);
  }, [applyAdminDefaults]);

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

  // « Relancer avec les memes reglages » (historique) : formulaire rempli avec la periode exacte et les reglages
  // enregistres, puis lancement automatique dans l'onglet correspondant
  const [backtestAutoRun, setBacktestAutoRun] = useState(false);
  const [comparisonAutoRun, setComparisonAutoRun] = useState(false);
  const rerunBacktest = (d: BacktestDetail) => {
    setForm({
      ...DEFAULT_BACKTEST_FORM, strategyId: String(d.strategyId), symbol: d.symbol, from: d.from, to: d.to,
      splitDate: d.splitDate ?? "", ...settingsFields(d.settings),
    });
    setBacktestAutoRun(true);
    go("backtest");
  };
  const rerunComparison = (d: SavedComparisonDetail) => {
    const r = d.result;
    setComparisonForm({
      ...DEFAULT_COMPARISON_FORM, strategyIds: r.strategies.map((s) => String(s.strategyId)), symbol: r.symbol,
      from: r.from, to: r.to, splitDate: r.splitDate ?? "", ...settingsFields(r.settings),
    });
    setComparisonAutoRun(true);
    go("comparaison");
  };

  return (
    <Tabs value={tab} onValueChange={(v) => go(v as TabId)} className="gap-5">
      <TabsList className="h-auto w-full max-w-full flex-wrap justify-start gap-1 rounded-xl border border-border/60 bg-white p-1 dark:bg-card sm:w-fit">
        {visibleTabs.map(({ id, label, Icon }) => (
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
          onGoToStrategies={() => go("strategies")} onOpenHistory={() => go("historique")}
          autoRun={backtestAutoRun} onAutoRunStarted={() => setBacktestAutoRun(false)} adminDefaults={defaultsLoaded} />
      </TabsContent>

      <TabsContent value="historique">
        <HistoryTab strategies={strategies} openId={openId} onOpen={(id) => go("historique", id != null ? { id: String(id) } : {})}
          onDeleted={(id) => { if (result?.id === id) setResult(null); loadStrategies(); }}
          onGoToBacktest={() => go("backtest")} onRerunBacktest={rerunBacktest} onRerunComparison={rerunComparison}
          section={historySection} onSection={(s) => go("historique", s === "comparaisons" ? { section: s } : {})}
          openComparisonId={openComparisonId} onOpenComparison={openSavedComparison}
          onGoToComparison={() => go("comparaison")} />
      </TabsContent>

      <TabsContent value="comparaison">
        <ComparisonTab strategies={strategies} strategiesLoading={strategiesLoading} strategiesError={strategiesError}
          assets={assets} assetsLoading={assetsLoading} assetsError={assetsError}
          values={comparisonForm} onValuesChange={setComparisonForm} run={comparison}
          onRunChange={setComparison} onGoToStrategies={() => go("strategies")} onReloadStrategies={loadStrategies}
          onOpenSaved={openSavedComparison}
          autoRun={comparisonAutoRun} onAutoRunStarted={() => setComparisonAutoRun(false)} adminDefaults={defaultsLoaded} />
      </TabsContent>

      {/* monte seulement pour un ADMIN : un utilisateur ordinaire n'en recoit ni l'onglet ni le contenu */}
      {isAdmin && (
        <TabsContent value="admin">
          <AdminTab assets={assets} section={adminSection}
            onSection={(s) => go("admin", s === "defaults" ? {} : { section: s })}
            view={search.get("view") === "comparisons" ? "comparisons" : "backtests"} openId={tab === "admin" ? idFrom("id") : null}
            onNavigate={(params) => go("admin", { section: adminSection, ...params })}
            onDefaultsChanged={applyAdminDefaults} />
        </TabsContent>
      )}
    </Tabs>
  );
}
