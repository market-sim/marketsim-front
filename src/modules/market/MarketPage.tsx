import { useEffect, useState, useMemo } from "react";
import {
  RefreshCw,
  Newspaper,
  AlertTriangle,
  TrendingUp,
  Database,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  pct,
  priceDisplay,
  MONO,
  DISPLAY,
  SectionHeader,
  CardShell,
} from "../../shared/ui";
import {
  assetsApi,
  marketNewsApi,
  marketSentimentApi,
  predictionsApi,
  marketHistoryApi,
  type Asset,
  type MarketNews,
  type ModelSentimentResult,
  type MarketSentimentSummary,
  type MarketSentimentHistory,
  type MarketPrediction,
  type MarketHistoryDto,
  type MarketHistoryPeriod,
  type SentimentLabel,
} from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { quotePrice } from "./LiveQuotes";

// ─── Type badges ────────────────────────────────────────────────────────────
const TYPE_STYLE: Record<Asset["type"], string> = {
  STOCK:     "bg-blue-50 text-blue-700",
  BOND:      "bg-violet-50 text-violet-700",
  COMMODITY: "bg-amber-50 text-amber-700",
  FOREX:     "bg-cyan-50 text-cyan-700",
  CRYPTO:    "bg-orange-50 text-orange-700",
};

const TYPE_LABEL: Record<Asset["type"], string> = {
  STOCK:     "Stock",
  BOND:      "Bond",
  COMMODITY: "Commodity",
  FOREX:     "Forex",
  CRYPTO:    "Crypto",
};

const PERIODS: { key: MarketHistoryPeriod; label: string }[] = [
  { key: "1M",  label: "1M" },
  { key: "3M",  label: "3M" },
  { key: "6M",  label: "6M" },
  { key: "1Y",  label: "1A" },
  { key: "ALL", label: "Max" },
];

const shortHash = (h?: string | null) =>
  h && h.length >= 10 ? `${h.slice(0, 6)}…${h.slice(-4)}` : (h ?? "—");

/** Module 5 — Marché, Prédiction & Sentiment
 *  - Asset list      : branchée sur GET /api/market/assets (données réelles).
 *  - Historical data : branchée sur GET /api/market/history (données historiques réelles Yahoo / CSV).
 *  - Predictions     : branchée sur GET /api/market/predictions (modèle interne).
 *  - News & Sentiment: branchée sur GET /api/market/news (actualités + NLP).
 */
export default function MarketPage() {
  const { user } = useAuth();

  // Assets state
  const [assets, setAssets]       = useState<Asset[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Selected asset & real historical data state
  const [selectedSymbol, setSelectedSymbol]   = useState<string>("AAPL");
  const [selectedPeriod, setSelectedPeriod]   = useState<MarketHistoryPeriod>("1Y");
  const [history, setHistory]                 = useState<MarketHistoryDto | null>(null);
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [historyError, setHistoryError]       = useState<string | null>(null);

  // News state
  const [news, setNews]           = useState<MarketNews[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsFromDate, setNewsFromDate] = useState<string>("");
  const [newsToDate, setNewsToDate] = useState<string>("");
  const [sentimentSummary, setSentimentSummary] = useState<MarketSentimentSummary | null>(null);
  const [sentimentHistory, setSentimentHistory] = useState<MarketSentimentHistory | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState<string | null>(null);
  const [articleAnalyses, setArticleAnalyses] = useState<Record<number, ModelSentimentResult>>({});
  const [analyzingArticleIds, setAnalyzingArticleIds] = useState<number[]>([]);

  // Predictions state
  const [predictions, setPredictions] = useState<MarketPrediction[]>([]);
  const [predLoading, setPredLoading] = useState(true);
  const [predError, setPredError]   = useState<string | null>(null);
  const [generatingPred, setGeneratingPred] = useState(false);
  const [generatePredError, setGeneratePredError] = useState<string | null>(null);
  const [predHorizon, setPredHorizon] = useState<number>(5);
  const [predModels, setPredModels] = useState<Array<{ id: string; name: string; version: string; description: string; available: boolean }>>([]);
  const [backtest, setBacktest] = useState<{
    total: number; resolved: number; pending: number;
    successRate: number | null; brierScore: number | null;
    byDirection: Record<string, { total: number; correct: number; rate: number }>;
    calibration: { from: number; to: number; count: number; avgConfidence: number; actualRate: number }[];
  } | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  const loadAssets = () => {
    setLoading(true);
    setError(null);
    assetsApi
      .list()
      .then((list) => {
        setAssets(list);
        setLoading(false);
        if (list.length > 0 && !selectedSymbol) {
          setSelectedSymbol(list[0].symbol);
        }
      })
      .catch((e) => {
        setError(errorMessage(e));
        setLoading(false);
      });
  };

  const loadNews = (symbol: string = selectedSymbol) => {
    setNewsLoading(true);
    setNewsError(null);
    marketNewsApi
      .list(symbol)
      .then((list) => {
        setNews(list);
        setNewsLoading(false);
      })
      .catch((e) => {
        setNewsError(errorMessage(e));
        setNewsLoading(false);
      });
  };

  const loadSentiment = (symbol: string = selectedSymbol) => {
    if (!symbol) return;
    setSentimentLoading(true);
    setSentimentError(null);
    Promise.all([marketSentimentApi.summary(symbol), marketSentimentApi.history(symbol)])
      .then(([summary, history]) => {
        setSentimentSummary(summary);
        setSentimentHistory(history);
        setArticleAnalyses(Object.fromEntries(summary.articles.map((article) => [article.newsId, {
          ...article,
          status: "ANALYZED",
          errorCode: null,
        }])));
        setSentimentLoading(false);
      })
      .catch((e) => {
        setSentimentError(errorMessage(e));
        setSentimentLoading(false);
      });
  };

  const analyzeArticle = (newsId: number) => {
    setAnalyzingArticleIds((ids) => ids.includes(newsId) ? ids : [...ids, newsId]);
    marketNewsApi.analyze(newsId)
      .then((result) => {
        setArticleAnalyses((previous) => ({ ...previous, [newsId]: result }));
        if (result.status === "ANALYZED") loadSentiment(selectedSymbol);
      })
      .catch((e) => setSentimentError(errorMessage(e)))
      .finally(() => setAnalyzingArticleIds((ids) => ids.filter((id) => id !== newsId)));
  };

  const loadPredictions = () => {
    setPredLoading(true);
    setPredError(null);
    predictionsApi
      .list()
      .then((list) => {
        setPredictions(list);
        setPredLoading(false);
      })
      .catch((e) => {
        setPredError(errorMessage(e));
        setPredLoading(false);
      });
  };

  const loadPredModels = () => {
    predictionsApi.models().then(setPredModels).catch(() => setPredModels([]));
  };

  const loadBacktest = () => {
    setBacktestLoading(true);
    predictionsApi.backtest(selectedSymbol).then(setBacktest).catch(() => setBacktest(null)).finally(() => setBacktestLoading(false));
  };

  const handleGeneratePrediction = () => {
    if (!selectedSymbol) return;
    setGeneratingPred(true);
    setGeneratePredError(null);
    predictionsApi
      .generate(selectedSymbol, predHorizon)
      .then((p) => {
        setPredictions((prev) => [p, ...prev]);
        setGeneratingPred(false);
      })
      .catch((e) => {
        setGeneratePredError(errorMessage(e));
        setGeneratingPred(false);
      });
  };

  const loadHistory = (sym: string, per: MarketHistoryPeriod) => {
    if (!sym) return;
    setHistoryLoading(true);
    setHistoryError(null);
    marketHistoryApi
      .get(sym, per)
      .then((dto) => {
        setHistory(dto);
        setHistoryLoading(false);
      })
      .catch((e) => {
        setHistoryError(errorMessage(e));
        setHistoryLoading(false);
      });
  };

  const handleRefreshHistory = () => {
    if (!selectedSymbol) return;
    setHistoryRefreshing(true);
    marketHistoryApi
      .refresh(selectedSymbol)
      .then((dto) => {
        setHistory(dto);
        setHistoryRefreshing(false);
      })
      .catch((e) => {
        setHistoryError(errorMessage(e));
        setHistoryRefreshing(false);
      });
  };

  const load = (refreshNews = true) => {
    loadAssets();
    if (refreshNews) {
      loadNews(selectedSymbol);
      loadSentiment(selectedSymbol);
    }
    loadPredictions();
    if (selectedSymbol) {
      loadHistory(selectedSymbol, selectedPeriod);
    }
  };

  useEffect(() => {
    load(false);
    loadPredModels();
    loadBacktest();
  }, []);

  // Prix du moteur de prix (pas toutes les 3 s) relus chaque seconde, sans recharger le reste de la page :
  // la page Marche montre le meme prix que le formulaire d'ordre et le bandeau.
  useEffect(() => {
    const id = window.setInterval(() => { assetsApi.list().then(setAssets).catch(() => {}); }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (selectedSymbol) {
      loadNews(selectedSymbol);
      loadSentiment(selectedSymbol);
      loadBacktest();
    }
  }, [selectedSymbol]);

  useEffect(() => {
    if (selectedSymbol) {
      loadHistory(selectedSymbol, selectedPeriod);
    }
  }, [selectedSymbol, selectedPeriod]);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.symbol.toUpperCase() === selectedSymbol.toUpperCase()),
    [assets, selectedSymbol]
  );

  const filteredNews = useMemo(() => {
    return news.filter((item) => {
      const d = new Date(item.publishedAt);
      if (newsFromDate && d < new Date(newsFromDate)) return false;
      if (newsToDate) {
        const end = new Date(newsToDate);
        end.setDate(end.getDate() + 1);
        if (d >= end) return false;
      }
      return true;
    });
  }, [news, newsFromDate, newsToDate]);

  const isUp = (history?.changePct ?? 0) >= 0;

  return (
    <div className="space-y-6">

      {/* ── SECTION 1 : Live Market Quotes ─────────────────────────────── */}
      <div>
        <SectionHeader
          title="Live Market Quotes"
          action={
            <button
              onClick={() => load()}
              disabled={loading || newsLoading || predLoading || historyLoading}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3 h-3 ${(loading || newsLoading || predLoading || historyLoading) ? "animate-spin" : ""}`} />
              Refresh
            </button>
          }
        />

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => load()} className="ml-auto text-[11px] underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardShell key={i} className="p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-muted" />
                  <div className="h-3.5 w-20 rounded bg-muted" />
                </div>
                <div className="h-5 w-24 rounded bg-muted mb-2" />
                <div className="h-3 w-16 rounded bg-muted" />
              </CardShell>
            ))}
          </div>
        )}

        {/* Asset grid */}
        {!loading && !error && (
          <>
            {assets.length === 0 ? (
              <CardShell className="px-5 py-8 text-center text-sm text-muted-foreground">
                Aucun actif disponible. Connectez-vous en administrateur pour en ajouter.
              </CardShell>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {assets.map((asset) => {
                  const positive = (asset.changePct ?? 0) >= 0;
                  const isSelected = selectedSymbol.toUpperCase() === asset.symbol.toUpperCase();
                  return (
                    <button
                      type="button"
                      key={asset.id}
                      aria-pressed={isSelected}
                      className={`w-full text-left bg-white rounded-xl border border-border/60 p-4 transition-all cursor-pointer relative ${
                        isSelected
                          ? "ring-2 ring-blue-600 border-blue-400 shadow-sm bg-blue-50/20"
                          : "hover:shadow-sm hover:border-border"
                      }`}
                      onClick={() => setSelectedSymbol(asset.symbol)}
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"}`}>
                            <span className="text-[9px] font-bold leading-none">
                              {asset.symbol.replace("/", "").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-foreground truncate" style={MONO}>
                            {asset.symbol}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_STYLE[asset.type]}`}
                        >
                          {TYPE_LABEL[asset.type]}
                        </span>
                      </div>

                      {/* Name */}
                      <p className="text-[11px] text-muted-foreground truncate mb-2">
                        {asset.name}
                      </p>

                      {/* Price + change */}
                      <div className="flex items-end justify-between">
                        <span className="text-base font-semibold text-foreground" style={MONO} data-testid={`quote-${asset.symbol}`}>
                          {quotePrice(asset)}
                        </span>
                        <span
                          className={`text-[12px] font-bold ${
                            positive ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {positive ? "▲" : "▼"}{" "}
                          {pct(asset.changePct ?? 0)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground mt-2 text-right">
              Sélectionnez un actif pour afficher son cours historique réel · {assets.length} actifs enregistrés
            </p>
          </>
        )}
      </div>

      {/* ── SECTION 2 : Instrument Real Historical Prices & Chart ──────── */}
      <CardShell className="p-5 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-foreground" style={DISPLAY}>
                  {selectedSymbol}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {history?.name ?? selectedAsset?.name ?? "Historique réel de marché"}
                </span>
                {/* Source & Status Badges */}
                {history?.source && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    history.source === "YAHOO" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-violet-50 text-violet-700 border-violet-200"
                  }`}>
                    Source: {history.source === "YAHOO" ? "Yahoo Finance" : "Import CSV"}
                  </span>
                )}
                {history?.status && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    history.status === "REAL"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : history.status === "CACHED"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : history.status === "STALE"
                      ? "bg-amber-50 text-amber-700 border-amber-300"
                      : "bg-red-50 text-red-700 border-red-300"
                  }`}>
                    {history.status === "REAL" && "● Direct (Temps réel)"}
                    {history.status === "CACHED" && "● Cache vérifié"}
                    {history.status === "STALE" && "▲ Cache local (source injoignable)"}
                    {history.status === "UNAVAILABLE" && "✗ Indisponible"}
                  </span>
                )}
              </div>
              {history?.lastUpdated && (
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  Dernière mise à jour : {new Date(history.lastUpdated).toLocaleString("fr-FR")}
                  {history.dataHash && (
                    <span className="ml-2" style={MONO}>
                      SHA-256: {shortHash(history.dataHash)}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Controls: Periods & Refresh */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="flex items-center bg-muted/60 p-1 rounded-lg">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setSelectedPeriod(p.key)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                    selectedPeriod === p.key
                      ? "bg-white text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {user?.role === "ADMIN" && (
              <button
                onClick={handleRefreshHistory}
                disabled={historyRefreshing || historyLoading}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border border-border/80 px-2.5 py-1.5 rounded-lg hover:bg-muted/30 transition-colors disabled:opacity-50"
                title="Forcer l'actualisation depuis Yahoo Finance"
              >
                <RefreshCw className={`w-3 h-3 ${historyRefreshing ? "animate-spin" : ""}`} />
                Actualiser
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        {history && history.status !== "UNAVAILABLE" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 px-1 my-2 border-b border-border/40 text-xs">
            <div>
              <p className="text-[10px] text-muted-foreground">Dernière clôture</p>
              <p className="font-semibold text-foreground text-sm" style={MONO}>
                {history.lastClose != null ? priceDisplay(history.lastClose) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Variation sur la période ({history.period})</p>
              <p className={`font-bold text-sm flex items-center gap-1 ${isUp ? "text-emerald-600" : "text-red-500"}`}>
                {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {history.changePct != null ? pct(history.changePct) : "0.00%"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Période couverte</p>
              <p className="font-medium text-foreground text-[11px]" style={MONO}>
                {history.from} → {history.to}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Échantillons</p>
              <p className="font-medium text-foreground text-[11px]" style={MONO}>
                {history.points.toLocaleString("fr-FR")} points journaliers
              </p>
            </div>
          </div>
        )}

        {/* Historical error or unavailable banner */}
        {(historyError || history?.status === "UNAVAILABLE") && (
          <div className="my-4 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Historique réel indisponible</p>
              <p className="text-xs text-red-600 mt-0.5">
                {history?.message ?? historyError ?? "Impossible de charger les données historiques de cet instrument."}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2">
                Note de conformité : Conformément aux exigences du projet, aucun faux cours n'est généré lorsque le fournisseur distant est indisponible.
              </p>
            </div>
            <button
              onClick={() => loadHistory(selectedSymbol, selectedPeriod)}
              className="px-3 py-1 bg-white border border-red-200 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {historyLoading && !history && (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span>Chargement des données historiques de marché...</span>
          </div>
        )}

        {/* Price Chart */}
        {!historyLoading && history && history.prices.length > 0 && (
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history.prices} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isUp ? "#10B981" : "#EF4444"} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={isUp ? "#10B981" : "#EF4444"} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                  minTickGap={40}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v)}` : `$${v.toFixed(2)}`)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-lg border border-slate-700">
                          <p className="text-[10px] text-slate-400 font-mono">{data.date}</p>
                          <p className="text-sm font-bold font-mono mt-0.5">
                            {priceDisplay(data.close)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={isUp ? "#10B981" : "#EF4444"}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#priceGradient)"
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardShell>

      {/* ── SECTION 3 : AI Price Predictions (API réelle — M5-03) ────── */}
      <div>
        <SectionHeader
          title="AI Price Predictions"
          action={
            <div className="flex items-center gap-2 flex-wrap">
              {predModels.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Model: {predModels[0].version} · {predictions.length} prediction{predictions.length !== 1 ? "s" : ""}
                </span>
              )}
              {user?.role === "ADMIN" && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={predHorizon}
                    onChange={(e) => setPredHorizon(Number(e.target.value))}
                    className="text-[11px] border border-border/60 rounded px-1.5 py-1 bg-white"
                    title="Horizon de prédiction (jours)"
                  >
                    {[1, 3, 5, 7, 14, 30].map((d) => (
                      <option key={d} value={d}>{d}d</option>
                    ))}
                  </select>
                  <button
                    onClick={handleGeneratePrediction}
                    disabled={generatingPred || !selectedSymbol}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generatingPred ? "Generating…" : "Generate"}
                  </button>
                </div>
              )}
            </div>
          }
        />

        {/* Prediction error */}
        {predError && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{predError}</span>
            <button onClick={loadPredictions} className="ml-auto text-[11px] underline underline-offset-2">
              Retry
            </button>
          </div>
        )}
        {generatePredError && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{generatePredError}</span>
          </div>
        )}

        {/* Prediction loading skeleton */}
        {predLoading && !predError && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardShell key={i} className="p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-muted" />
                  <div className="h-3.5 w-20 rounded bg-muted" />
                </div>
                <div className="h-5 w-24 rounded bg-muted mb-2" />
                <div className="h-3 w-16 rounded bg-muted" />
              </CardShell>
            ))}
          </div>
        )}

        {/* Predictions grid */}
        {!predLoading && !predError && (
          <>
            {predictions.length === 0 ? (
              <CardShell className="px-5 py-8 text-center text-sm text-muted-foreground">
                Aucune prédiction disponible.
              </CardShell>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {predictions.map((pred) => {
                  const confPct = Math.round(pred.confidence * 100);
                  const fan = (() => { try { return pred.fanJson ? (JSON.parse(pred.fanJson) as { day: number; p10: number; p50: number; p90: number }[]) : null; } catch { return null; } })();
                  const relativeTime = (() => {
                    const diff = Math.round(
                      (Date.now() - new Date(pred.generatedAt).getTime()) / 60000
                    );
                    if (diff < 60) return `${diff}m ago`;
                    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
                    return `${Math.floor(diff / 1440)}d ago`;
                  })();
                  return (
                    <CardShell key={pred.id} className="p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-blue-700">
                              {pred.symbol.replace("/", "").slice(0, 2)}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-foreground" style={MONO}>
                            {pred.symbol}
                          </span>
                        </div>
                        <span
                          className={`text-[12px] font-bold ${
                            pred.direction === "UP"
                              ? "text-emerald-600"
                              : pred.direction === "DOWN"
                              ? "text-red-500"
                              : "text-amber-600"
                          }`}
                        >
                          {pred.direction === "UP" ? "▲" : pred.direction === "DOWN" ? "▼" : "━"}{" "}
                          {pred.direction}
                        </span>
                      </div>

                      <div className="mb-3">
                        <p className="text-[10px] text-muted-foreground mb-1">Confidence</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full">
                            <div
                              className={`h-1.5 rounded-full ${
                                confPct >= 70
                                  ? "bg-emerald-500"
                                  : confPct >= 55
                                  ? "bg-amber-400"
                                  : "bg-slate-400"
                              }`}
                              style={{ width: `${confPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-foreground shrink-0">
                            {confPct}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">
                          Current:{" "}
                          <span className="font-medium text-foreground" style={MONO}>
                            {pred.currentPrice >= 1000
                              ? `$${pred.currentPrice.toLocaleString()}`
                              : `$${pred.currentPrice}`}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          Target:{" "}
                          <span className="font-medium text-foreground" style={MONO}>
                            {pred.targetPrice >= 1000
                              ? `$${pred.targetPrice.toLocaleString()}`
                              : `$${pred.targetPrice}`}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Horizon: <span className="font-medium text-foreground">{pred.horizonDays}d</span></span>
                        <span>Generated: <span className="font-medium">{new Date(pred.generatedAt).toLocaleDateString()}</span></span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Model: <span className="font-medium">{pred.modelName ?? pred.modelVersion}</span></span>
                        <span>{pred.modelVersion}</span>
                      </div>
                      {pred.dataTo && (
                        <div className="text-[10px] text-muted-foreground mb-1">
                          Data cutoff: <span className="font-medium">{pred.dataTo}</span>
                          {pred.dataPoints ? ` · ${pred.dataPoints} pts` : ""}
                          {pred.dataSource ? ` · ${pred.dataSource}` : ""}
                        </div>
                      )}
                      {(pred.mae != null || pred.rmse != null || pred.mape != null) && (
                        <div className="text-[10px] text-muted-foreground mb-1 flex flex-wrap gap-x-2">
                          {pred.mae != null && <span>MAE {pred.mae.toFixed(4)}</span>}
                          {pred.rmse != null && <span>RMSE {pred.rmse.toFixed(4)}</span>}
                          {pred.mape != null && <span>MAPE {pred.mape.toFixed(2)}%</span>}
                        </div>
                      )}

                      {pred.candidateMetricsJson && (
                        <div className="text-[10px] text-muted-foreground mb-1">
                          Ensemble : {(() => { try { const c = JSON.parse(pred.candidateMetricsJson) as { name: string; mae: number }[]; return c.map((x) => `${x.name} (MAE ${x.mae.toFixed(2)})`).join(" · "); } catch { return ""; } })()}
                        </div>
                      )}
                      {pred.sentimentScore != null && (
                        <div className="text-[10px] text-muted-foreground mb-1">
                          Sentiment FinBERT : {pred.sentimentScore.toFixed(3)} · contribution XAI : {pred.sentimentContribution?.toFixed(4) ?? "0.0000"}
                        </div>
                      )}

                      {fan && fan.length > 0 && (
                         <div className="mt-2">
                           <p className="text-[10px] text-muted-foreground mb-1">Fan chart (p10–p90)</p>
                           <div className="h-20">
                             <ResponsiveContainer width="100%" height="100%">
                               <LineChart data={fan} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                 <XAxis dataKey="day" tick={{ fontSize: 8, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
                                 <YAxis tick={{ fontSize: 8, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} width={32} />
                                 <Tooltip contentStyle={{ fontSize: 10 }} />
                                 <Line type="monotone" dataKey="p90" stroke="#93c5fd" dot={false} strokeWidth={1} />
                                 <Line type="monotone" dataKey="p50" stroke="#2563eb" dot={false} strokeWidth={1.5} />
                                 <Line type="monotone" dataKey="p10" stroke="#93c5fd" dot={false} strokeWidth={1} />
                               </LineChart>
                             </ResponsiveContainer>
                           </div>
                           <div className="text-[10px] text-muted-foreground mt-1">
                             IC 90 % à l'horizon : {pred.fanP10?.toFixed(2)} – {pred.fanP90?.toFixed(2)}
                           </div>
                         </div>
                       )}

{/* Outcome badge */}
                      <div className="mt-2 pt-2 border-t border-border/40">
                        {pred.outcome === "CORRECT" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            ✓ Correct
                          </span>
                        )}
                        {pred.outcome === "INCORRECT" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                            ✗ Incorrect
                          </span>
                        )}
                        {pred.outcome === null && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                            Pending
                          </span>
                        )}
                      </div>
                    </CardShell>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── SECTION 3b : Backtesting & Calibration ─────────────────── */}
      <CardShell className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Backtesting & Calibration</h3>
          <button onClick={loadBacktest} disabled={backtestLoading} className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50">
            {backtestLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {backtestLoading && !backtest && (
          <div className="h-16 flex items-center justify-center text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        )}
        {backtest && (
          <div className="space-y-3 text-[11px]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border/50 p-3">
                <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                <p className="mt-1 text-lg font-bold text-foreground">{backtest.total}</p>
              </div>
              <div className="rounded-lg border border-border/50 p-3">
                <p className="text-[10px] uppercase text-muted-foreground">Resolved</p>
                <p className="mt-1 text-lg font-bold text-foreground">{backtest.resolved}</p>
              </div>
              <div className="rounded-lg border border-border/50 p-3">
                <p className="text-[10px] uppercase text-muted-foreground">Success rate</p>
                <p className="mt-1 text-lg font-bold text-foreground">{backtest.successRate == null ? "—" : `${(backtest.successRate * 100).toFixed(1)}%`}</p>
              </div>
              <div className="rounded-lg border border-border/50 p-3">
                <p className="text-[10px] uppercase text-muted-foreground">Brier score</p>
                <p className="mt-1 text-lg font-bold text-foreground">{backtest.brierScore == null ? "—" : backtest.brierScore.toFixed(4)}</p>
              </div>
            </div>
            {Object.keys(backtest.byDirection).length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">By direction</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(backtest.byDirection).map(([dir, st]) => (
                    <span key={dir} className="text-[10px] px-2 py-1 rounded bg-muted/40">
                      {dir}: {st.correct}/{st.total} ({(st.rate * 100).toFixed(0)}%)
                    </span>
                  ))}
                </div>
              </div>
            )}
            {backtest.calibration.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Calibration (confidence → actual)</p>
                <div className="space-y-1">
                  {backtest.calibration.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <span className="w-16 text-muted-foreground">{(b.from * 100).toFixed(0)}–{(b.to * 100).toFixed(0)}%</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full relative">
                        <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(100, b.actualRate * 100)}%` }} />
                      </div>
                      <span className="w-24 text-right text-muted-foreground">{b.count} pts · { (b.actualRate * 100).toFixed(0)}% (avg {(b.avgConfidence * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {backtest.resolved === 0 && (
              <p className="text-[10px] text-muted-foreground">Aucune prédiction résolue pour l'instant (l'horizon n'est pas encore écoulé).</p>
            )}
          </div>
        )}
      </CardShell>

      {/* ── SECTION 4 : News Sentiment Analysis (API réelle) ───────── */}
      <CardShell className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
          <Newspaper className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>
            News Sentiment Analysis
          </h3>
          <span className="ml-auto text-[10px] text-muted-foreground">
            FinBERT · {filteredNews.length}{filteredNews.length !== news.length ? ` / ${news.length}` : ""} articles
          </span>
          <div className="flex items-center gap-2 ml-3">
            <input type="date" value={newsFromDate} onChange={(e) => setNewsFromDate(e.target.value)} className="text-[10px] border border-border/60 rounded px-1.5 py-1 bg-white" title="Date de début" />
            <input type="date" value={newsToDate} onChange={(e) => setNewsToDate(e.target.value)} className="text-[10px] border border-border/60 rounded px-1.5 py-1 bg-white" title="Date de fin" />
            {(newsFromDate || newsToDate) && (
              <button onClick={() => { setNewsFromDate(""); setNewsToDate(""); }} className="text-[10px] text-muted-foreground hover:text-foreground underline">Reset</button>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-b border-border/40 space-y-4">
          {sentimentError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{sentimentError}</span>
              <button onClick={() => loadSentiment(selectedSymbol)} className="ml-auto underline">Retry</button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Overall · {selectedSymbol}</p>
              <p className="mt-1 text-sm font-bold text-foreground">
                {sentimentSummary?.overallSentiment ?? (sentimentLoading ? "Loading…" : "No analysis")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Score {sentimentSummary?.sentimentScore == null ? "—" : sentimentSummary.sentimentScore.toFixed(3)}
              </p>
            </div>
            {[
              { label: "Positive", value: sentimentSummary?.positivePercentage ?? 0, color: "text-emerald-600" },
              { label: "Negative", value: sentimentSummary?.negativePercentage ?? 0, color: "text-red-500" },
              { label: "Neutral", value: sentimentSummary?.neutralPercentage ?? 0, color: "text-amber-600" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-lg border border-border/50 p-3">
                <p className="text-[10px] uppercase text-muted-foreground">{metric.label}</p>
                <p className={`mt-1 text-lg font-bold ${metric.color}`}>{metric.value.toFixed(1)}%</p>
              </div>
            ))}
            <div className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Analyzed articles</p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {sentimentSummary?.analyzedArticleCount ?? 0}
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">/ {sentimentSummary?.periodDays ?? 30}d</span>
              </p>
            </div>
          </div>

          {sentimentSummary?.status === "INSUFFICIENT_DATA" && !sentimentLoading && (
            <p className="text-xs text-muted-foreground">
              Aucun article de {selectedSymbol} n’a encore une analyse FinBERT réussie sur les 30 derniers jours.
              Lance une analyse depuis une actualité ci-dessous.
            </p>
          )}

          {sentimentHistory?.points.length ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Daily sentiment score</span>
                <span className="text-[10px] text-muted-foreground">
                  FinBERT {sentimentSummary?.modelVersion?.slice(0, 12)} · {sentimentSummary?.periodDays ?? 30} days
                </span>
              </div>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sentimentHistory.points}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                    <YAxis domain={[-1, 1]} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(value: number) => [value.toFixed(3), "Score"]} />
                    <Area type="monotone" dataKey="sentimentScore" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.28} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          <p className="text-[10px] text-muted-foreground">
            FinBERT analyse le titre en anglais. Résultat informatif uniquement ; il ne constitue pas un conseil et ne déclenche aucun ordre.
          </p>
        </div>

        {/* News error */}
        {newsError && (
          <div className="flex items-center gap-2.5 px-5 py-3 text-red-700 text-sm bg-red-50 border-b border-red-100">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{newsError}</span>
            <button onClick={() => loadNews(selectedSymbol)} className="ml-auto text-[11px] underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {/* News loading skeleton */}
        {newsLoading && !newsError && (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4 animate-pulse">
                <div className="w-10 h-5 rounded bg-muted shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 rounded bg-muted w-3/4" />
                  <div className="h-3 rounded bg-muted w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* News list */}
        {!newsLoading && !newsError && (
          <div className="divide-y divide-border/40">
            {filteredNews.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                {news.length === 0 ? "Aucune actualité importée." : "Aucune actualité dans la période sélectionnée."}
              </p>
            ) : (
              filteredNews.map((item) => {
                const analysis = articleAnalyses[item.id];
                const isAnalyzed = analysis?.status === "ANALYZED" && analysis.sentimentLabel != null;
                const score = isAnalyzed ? analysis.sentimentScore : null;
                const label = isAnalyzed ? analysis.sentimentLabel : null;
                const badgeClass =
                  label === "POSITIVE"
                    ? "bg-emerald-100 text-emerald-700"
                    : label === "NEGATIVE"
                    ? "bg-red-100 text-red-600"
                    : "bg-amber-100 text-amber-700";

const relativeTime = (() => {
                  const diff = Math.round(
                    (Date.now() - new Date(item.publishedAt).getTime()) / 60000
                  );
                  if (diff < 60) return `${diff}m ago`;
                  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
                  return `${Math.floor(diff / 1440)}d ago`;
                })();

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-muted/10 transition-colors"
                  >
                    {/* Sentiment badge */}
                    <div className="shrink-0">
                      <div className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>
                        {score == null ? "—" : `${score >= 0 ? "+" : ""}${score.toFixed(2)}`}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-foreground leading-snug hover:underline"
                        >
                          {item.headline}
                        </a>
                      ) : (
                        <p className="text-sm text-foreground leading-snug">{item.headline}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[10px] font-medium text-blue-600">{item.source}</span>
                        {item.dataStatus === "MANUAL" && (
                          <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-amber-100 text-amber-800" title="Article saisi à la main (admin), pas importé d'un fournisseur réel">import manuel</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">→ {item.symbol}</span>
                        <span className="text-[10px] text-muted-foreground">{relativeTime}</span>
                        <span
                          className={`text-[10px] font-semibold ${
                            label === "POSITIVE"
                              ? "text-emerald-600"
                              : label === "NEGATIVE"
                              ? "text-red-500"
                              : label === "NEUTRAL"
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {label ?? (analysis?.status === "UNAVAILABLE"
                            ? "UNAVAILABLE"
                            : analysis?.status === "INSUFFICIENT_DATA"
                            ? "INSUFFICIENT DATA"
                            : analysis?.status === "UNSUPPORTED_LANGUAGE"
                            ? "ENGLISH ONLY"
                            : "NOT ANALYZED")}
                        </span>
                        <button
                          type="button"
                          onClick={() => analyzeArticle(item.id)}
                          disabled={analyzingArticleIds.includes(item.id)}
                          className="ml-auto rounded border border-border/60 px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
                        >
                          {analyzingArticleIds.includes(item.id) ? "Analyzing…" : isAnalyzed ? "Reanalyze" : "Analyze with FinBERT"}
                        </button>
                      </div>
                      {isAnalyzed && (
                        <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
                          <span>Positive {(analysis.positiveProbability! * 100).toFixed(1)}%</span>
                          <span>Negative {(analysis.negativeProbability! * 100).toFixed(1)}%</span>
                          <span>Neutral {(analysis.neutralProbability! * 100).toFixed(1)}%</span>
                          <span>Analyzed {new Date(analysis.analyzedAt).toLocaleString()}</span>
                          <span>Model {analysis.modelName} · {analysis.modelVersion}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardShell>

    </div>
  );
}
