import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Radio } from "lucide-react";
import { assetsApi, marketTicksApi, type Asset, type PriceTick } from "../../api/endpoints";
import { CardShell, DISPLAY, MONO } from "../../shared/ui";

const REFRESH_MS = 3000;
const HISTORY_MS = 60_000;

/** Prix affiche avec les memes decimales que le bandeau et le formulaire d'ordre. */
export const quotePrice = (a: Pick<Asset, "price" | "type">) =>
  a.price.toLocaleString("fr-FR", { minimumFractionDigits: a.type === "FOREX" ? 4 : 2, maximumFractionDigits: a.type === "FOREX" ? 4 : 2 });

/**
 * Module 5 : cotations en direct des actifs tradables. Ce sont les prix du moteur de prix (ancres sur les cours
 * reels Yahoo / CoinGecko quand ils sont disponibles), les memes que dans le bandeau et le module Trading.
 */
export default function LiveQuotes() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [history, setHistory] = useState<Record<string, PriceTick[]>>({});
  const [updated, setUpdated] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => assetsApi.list()
      .then((a) => { if (alive) { setAssets(a); setUpdated(new Date()); setError(false); } })
      .catch(() => { if (alive) setError(true); });
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const symbols = assets.map((a) => a.symbol).join(",");
  useEffect(() => {
    if (!symbols) return;
    let alive = true;
    const load = () => Promise.all(symbols.split(",").map((s) => marketTicksApi.list(s, 6).then((t) => [s, t] as const).catch(() => [s, []] as const)))
      .then((rows) => { if (alive) setHistory(Object.fromEntries(rows)); });
    load();
    const id = window.setInterval(load, HISTORY_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [symbols]);

  return (
    <CardShell className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
        <Radio className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-foreground flex-1" style={DISPLAY}>Cotations en direct</h3>
        <span className="text-[11px] text-muted-foreground">
          {error ? "serveur injoignable" : updated ? `mis à jour ${updated.toLocaleTimeString("fr-FR")}` : "chargement…"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40">
              <th className="text-start font-medium px-5 py-2.5">Actif</th>
              <th className="text-end font-medium px-5 py-2.5">Prix</th>
              <th className="text-end font-medium px-5 py-2.5">Depuis l'ouverture</th>
              <th className="text-end font-medium px-5 py-2.5 hidden md:table-cell">6 dernières heures</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {assets.map((a) => {
              const h = history[a.symbol] ?? [];
              const up = a.changePct >= 0;
              return (
                <tr key={a.symbol} className="hover:bg-muted/10">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-foreground">{a.symbol}</p>
                    <p className="text-[11px] text-muted-foreground">{a.name}</p>
                  </td>
                  <td className="px-5 py-3 text-end font-semibold text-foreground tabular-nums" style={MONO} data-testid={`quote-${a.symbol}`}>{quotePrice(a)}</td>
                  <td className={`px-5 py-3 text-end font-medium tabular-nums ${up ? "text-emerald-600" : "text-red-500"}`}>
                    {up ? "+" : ""}{a.changePct.toFixed(2).replace(".", ",")} %
                  </td>
                  <td className="px-5 py-2 hidden md:table-cell">
                    {h.length > 1 ? (
                      <div className="ms-auto w-32 h-8">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={h}>
                            <YAxis hide domain={["dataMin", "dataMax"]} />
                            <Line type="monotone" dataKey="price" stroke={up ? "#10B981" : "#EF4444"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-end text-[11px] text-muted-foreground">historique en cours…</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-2.5 text-[11px] text-muted-foreground border-t border-border/40">
        Prix du simulateur : ancrés sur les cours réels (Yahoo Finance, CoinGecko) quand ils sont disponibles, sinon simulés par une marche aléatoire. Ce sont les prix utilisés pour vos ordres.
      </p>
    </CardShell>
  );
}
