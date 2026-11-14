import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, Swords, Trophy, User, Wallet } from "lucide-react";
import { progressionApi, type GameHistoryItem } from "../api/endpoints";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CardShell, DISPLAY, MONO } from "../shared/ui";
import { LEVEL_COLOR, LEVEL_LABEL, money, useProgression } from "./ProgressionContext";

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")} %`;

/** Module 6 : progression du trader dans le temps — portefeuille, niveau, et comparaison avec l'agent IA. */
export default function ProgressionPage() {
  const { user } = useAuth();
  const { progression: p } = useProgression();
  const navigate = useNavigate();
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "ADMIN") return;
    progressionApi.history().then((h) => setHistory([...h].reverse())).catch((e) => setError(errorMessage(e)));
  }, [user?.role, p?.games]);

  const counted = useMemo(() => history.filter((g) => g.counted), [history]);
  const curve = useMemo(() => {
    const out = [{ n: 0, balance: p?.startBalance ?? 1000 }];
    counted.forEach((g, i) => out.push({ n: i + 1, balance: g.endBalance }));
    return out;
  }, [counted, p?.startBalance]);
  const duel = useMemo(() => counted.filter((g) => g.agentReturn != null).map((g, i) => ({
    n: `#${i + 1}`, toi: +(g.playerReturn * 100).toFixed(2), agent: +((g.agentReturn ?? 0) * 100).toFixed(2),
    marche: +((g.benchmarkReturn ?? 0) * 100).toFixed(2),
  })), [counted]);

  if (user?.role === "ADMIN") {
    return <CardShell className="p-6 text-sm text-muted-foreground">L'administrateur n'a ni portefeuille ni niveau : cette page est réservée aux traders.</CardShell>;
  }
  if (!p) return <CardShell className="p-6 text-sm text-muted-foreground">Chargement…</CardShell>;

  const beatAgent = duel.filter((d) => d.toi > d.agent).length;
  const beatMarket = duel.filter((d) => d.toi > d.marche).length;
  const last5 = duel.slice(-5);
  const trend = last5.length >= 2 ? last5.reduce((a, d) => a + (d.toi - d.agent), 0) / last5.length : null;

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CardShell className="p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Trophy className="w-3 h-3" />Niveau</p>
          <p className="text-xl font-semibold mt-1" style={{ color: LEVEL_COLOR[p.level], ...DISPLAY }}>{LEVEL_LABEL[p.level]}</p>
          <p className="text-[11px] text-muted-foreground">meilleur : {p.bestLevel ? LEVEL_LABEL[p.bestLevel] : "—"} · difficulté {p.difficulty.label}</p>
        </CardShell>
        <CardShell className="p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3" />Portefeuille</p>
          <p className={`text-xl font-semibold mt-1 ${p.balance >= p.startBalance ? "text-emerald-500" : "text-red-500"}`} style={MONO}>{money(p.balance)}</p>
          <p className="text-[11px] text-muted-foreground">record {money(p.peakBalance)} · {p.restarts} redémarrage(s)</p>
        </CardShell>
        <CardShell className="p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />Compétence</p>
          <p className="text-xl font-semibold mt-1 text-foreground" style={MONO}>{p.skillScore} / 100</p>
          <p className="text-[11px] text-muted-foreground" style={MONO}>réussite {Math.round(p.winRate * 100)} % · discipline {Math.round(p.discipline * 100)} %</p>
        </CardShell>
        <CardShell className="p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Swords className="w-3 h-3" />Toi contre l'agent</p>
          <p className="text-xl font-semibold mt-1 text-foreground" style={MONO}>{beatAgent} / {duel.length}</p>
          <p className="text-[11px] text-muted-foreground">parties où tu bats l'agent · marché battu {beatMarket} fois</p>
        </CardShell>
      </div>

      {counted.length === 0 ? (
        <CardShell className="p-6 flex flex-wrap items-center gap-4">
          <p className="text-sm text-muted-foreground flex-1">Aucune partie pour l'instant : joue ta première partie pour voir ta courbe de progression et te comparer à l'agent.</p>
          <button onClick={() => navigate("/agent?play=1")} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Jouer une partie</button>
        </CardShell>
      ) : (
        <>
          <CardShell className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1" style={DISPLAY}>Ton portefeuille partie après partie</h3>
            <p className="text-[11.5px] text-muted-foreground mb-3">Sous la ligne des 1 000 $, tu restes Débutant.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curve} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                  <XAxis dataKey="n" tick={{ fontSize: 11 }} label={{ value: "parties", position: "insideBottomRight", offset: -2, fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => `${Math.round(v)} $`} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(n) => n === 0 ? "Départ" : `Après la partie ${n}`} />
                  <ReferenceLine y={p.startBalance} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="balance" name="Portefeuille" stroke={LEVEL_COLOR[p.level]} strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardShell>

          {duel.length > 0 && (
            <CardShell className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Toi, l'agent et le marché sur les mêmes parties</h3>
              </div>
              <p className="text-[11.5px] text-muted-foreground mb-3">
                Rendement de chaque partie (en %).{" "}
                {trend != null && (trend >= 0
                  ? <b className="text-emerald-600">Sur tes 5 dernières parties, tu fais en moyenne {trend.toFixed(1).replace(".", ",")} points de mieux que l'agent.</b>
                  : <b className="text-amber-600">Sur tes 5 dernières parties, l'agent fait en moyenne {Math.abs(trend).toFixed(1).replace(".", ",")} points de mieux que toi.</b>)}
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={duel} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                    <XAxis dataKey="n" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={44} tickFormatter={(v) => `${v} %`} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2).replace(".", ",")} %`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    <Bar dataKey="toi" name="Toi" fill="#2563eb" />
                    <Bar dataKey="agent" name="Agent IA" fill="#a855f7" />
                    <Bar dataKey="marche" name="Acheter et garder" fill="#94a3b8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardShell>
          )}

          <CardShell className="overflow-hidden">
            <div className="px-5 py-3 border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Historique des parties</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Actif</th>
                    <th className="text-right px-4 py-2">Portefeuille</th><th className="text-right px-4 py-2">Toi</th>
                    <th className="text-right px-4 py-2">Agent</th><th className="text-right px-4 py-2">Trades</th><th className="text-left px-4 py-2">Niveau</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {[...history].reverse().map((g) => (
                    <tr key={g.id} className={g.counted ? "" : "opacity-60"}>
                      <td className="px-4 py-2 text-muted-foreground">{new Date(g.playedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="px-4 py-2 text-foreground">{g.symbol} · {g.days} j{!g.counted && " · entraînement"}</td>
                      <td className="px-4 py-2 text-right" style={MONO}>{money(g.startBalance)} → {money(g.endBalance)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${g.playerReturn >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{pct(g.playerReturn)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground" style={MONO}>{g.agentReturn != null ? pct(g.agentReturn) : "—"}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground" style={MONO}>{g.wins}/{g.trades}</td>
                      <td className="px-4 py-2">
                        {g.levelBefore !== g.levelAfter
                          ? <span>{LEVEL_LABEL[g.levelBefore]} → <b style={{ color: LEVEL_COLOR[g.levelAfter] }}>{LEVEL_LABEL[g.levelAfter]}</b></span>
                          : <span className="text-muted-foreground">{LEVEL_LABEL[g.levelAfter]}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardShell>
        </>
      )}
    </div>
  );
}
