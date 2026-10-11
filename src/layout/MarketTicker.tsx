import { useEffect, useState } from "react";
import { tickerApi, type TickerQuote } from "../api/endpoints";

const REFRESH_MS = 60_000;

function formatPrice(q: TickerQuote) {
  const digits = q.category === "FOREX" ? 4 : q.price >= 1000 ? 2 : 2;
  return q.price.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function Item({ q }: { q: TickerQuote }) {
  const up = q.changePct > 0.005;
  const down = q.changePct < -0.005;
  const color = up ? "text-emerald-400" : down ? "text-red-400" : "text-slate-400";
  return (
    <span className="inline-flex items-baseline gap-2 px-6 whitespace-nowrap" title={`${q.name} · ${q.currency}`}>
      <span className="text-[13px] font-bold text-white tracking-wide">{q.symbol}</span>
      <span className="text-[13px] text-white/90 tabular-nums">{formatPrice(q)}</span>
      <span className={`text-[12px] font-medium tabular-nums ${color}`}>
        {up ? "▲" : down ? "▼" : "▬"} ({q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2).replace(".", ",")}%)
      </span>
    </span>
  );
}

/**
 * Bandeau defilant des marches mondiaux (indices, actions, cryptos, devises, or, petrole).
 * Cours reels via le backend (Yahoo Finance / CoinGecko), rafraichis chaque minute ; pause au survol.
 */
export default function MarketTicker() {
  const [quotes, setQuotes] = useState<TickerQuote[]>([]);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => tickerApi.get()
      .then((t) => { if (alive) { setQuotes(t.quotes); setStale(t.stale); } })
      .catch(() => { if (alive) setStale(true); });
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (quotes.length === 0) {
    return <div className="h-9 shrink-0 bg-[#0A1530] border-b border-white/10" />;
  }

  // vitesse constante quel que soit le nombre de cotations
  const duration = Math.max(30, quotes.length * 4);

  return (
    <div className="ticker relative h-9 shrink-0 overflow-hidden bg-[#0A1530] border-b border-white/10 flex items-center">
      <style>{`
        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker-track { animation: ticker-scroll ${duration}s linear infinite; }
        .ticker:hover .ticker-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .ticker-track { animation: none; } }
      `}</style>
      <div className="ticker-track flex w-max">
        {/* contenu duplique : la boucle est continue */}
        {[0, 1].map((copy) => (
          <div key={copy} className="flex" aria-hidden={copy === 1}>
            {quotes.map((q) => <Item key={`${copy}-${q.symbol}`} q={q} />)}
          </div>
        ))}
      </div>
      <span className={`absolute right-0 top-0 bottom-0 flex items-center gap-1.5 pl-6 pr-3 text-[10px] font-medium bg-gradient-to-l from-[#0A1530] via-[#0A1530] to-transparent ${stale ? "text-amber-400" : "text-emerald-400"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${stale ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`} />
        {stale ? "Différé" : "Live"}
      </span>
    </div>
  );
}
