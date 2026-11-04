import { useEffect, useState } from "react";
import { RefreshCw, Newspaper, TrendingUp, AlertTriangle } from "lucide-react";
import {
  fmt,
  pct,
  priceDisplay,
  MONO,
  DISPLAY,
  SectionHeader,
  CardShell,
} from "../../shared/ui";
import { assetsApi, type Asset } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { predictions, newsItems } from "./mockData";

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

/** Module 5 — Marché, Prédiction & Sentiment
 *  Asset list : branchée sur GET /api/market/assets (données réelles).
 *  Prédictions & actualités : mockData (tickets suivants).
 */
export default function MarketPage() {
  const [assets, setAssets]   = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    assetsApi
      .list()
      .then((list) => {
        setAssets(list);
        setLoading(false);
      })
      .catch((e) => {
        setError(errorMessage(e));
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">

      {/* ── SECTION 1 : Live Market Quotes ─────────────────────────────── */}
      <div>
        <SectionHeader
          title="Live Market Quotes"
          action={
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          }
        />

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={load} className="ml-auto text-[11px] underline underline-offset-2">
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
                  return (
                    <CardShell
                      key={asset.id}
                      className="p-4 hover:shadow-sm transition-shadow"
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-blue-700 leading-none">
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
                        <span className="text-base font-semibold text-foreground" style={MONO}>
                          {priceDisplay(Number(asset.price))}
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
                    </CardShell>
                  );
                })}
              </div>
            )}

            {/* Source notice */}
            <p className="text-[10px] text-muted-foreground mt-2 text-right">
              Source: base de données locale (données de démonstration) · {assets.length} actifs
            </p>
          </>
        )}
      </div>

      {/* ── SECTION 2 : AI Price Predictions (mockData — ticket M5-02) ── */}
      <div>
        <SectionHeader
          title="AI Price Predictions"
          action={
            <span className="text-[11px] text-muted-foreground">
              Models: LSTM · Prophet · Ensemble — <em>demo data</em>
            </span>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {predictions.map((pred) => (
            <CardShell key={pred.asset} className="p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-blue-700">
                      {pred.asset.replace("/", "").slice(0, 2)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{pred.asset}</span>
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
                        pred.confidence >= 70
                          ? "bg-emerald-500"
                          : pred.confidence >= 55
                          ? "bg-amber-400"
                          : "bg-slate-400"
                      }`}
                      style={{ width: `${pred.confidence}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground shrink-0">
                    {pred.confidence}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">
                  Target:{" "}
                  <span className="font-medium text-foreground" style={MONO}>
                    {pred.target >= 1000
                      ? `$${pred.target.toLocaleString()}`
                      : `$${pred.target}`}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Horizon: <span className="font-medium text-foreground">{pred.horizon}</span>
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Model: <span className="font-medium">{pred.model}</span>
              </p>
            </CardShell>
          ))}
        </div>
      </div>

      {/* ── SECTION 3 : News Sentiment (mockData — ticket M5-03) ─────── */}
      <CardShell className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
          <Newspaper className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>
            News Sentiment Analysis
          </h3>
          <span className="ml-auto text-[10px] text-muted-foreground italic">demo data</span>
        </div>
        <div className="divide-y divide-border/40">
          {newsItems.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-4 px-5 py-4 hover:bg-muted/10 transition-colors"
            >
              <div className="shrink-0">
                <div
                  className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded ${
                    item.sentiment >= 0.5
                      ? "bg-emerald-100 text-emerald-700"
                      : item.sentiment >= 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {item.sentiment >= 0 ? "+" : ""}
                  {item.sentiment.toFixed(2)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{item.headline}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-medium text-blue-600">{item.source}</span>
                  <span className="text-[10px] text-muted-foreground">→ {item.asset}</span>
                  <span className="text-[10px] text-muted-foreground">{item.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardShell>

    </div>
  );
}
