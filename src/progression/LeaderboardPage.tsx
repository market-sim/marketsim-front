import { useEffect, useState } from "react";
import { Award, Crown, Medal } from "lucide-react";
import { leaderboardApi, type LeaderboardEntry } from "../api/endpoints";
import { errorMessage } from "../api/client";
import { CardShell, DISPLAY, MONO } from "../shared/ui";
import { LEVEL_COLOR, LEVEL_LABEL, money } from "./ProgressionContext";

const BADGE_STYLE: Record<string, string> = {
  FIRST_GAME: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  DISCIPLINED: "bg-blue-500/15 text-blue-600",
  BEAT_AGENT: "bg-violet-500/15 text-violet-600",
  DOUBLED: "bg-emerald-500/15 text-emerald-600",
  COMEBACK: "bg-orange-500/15 text-orange-600",
  EXPERT: "bg-amber-500/20 text-amber-600",
};

/** Classement public des traders : rang, niveau, score de competence, portefeuille et badges (sans e-mail). */
export default function LeaderboardPage() {
  const [data, setData] = useState<{ traders: number; me: LeaderboardEntry | null; top: LeaderboardEntry[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { leaderboardApi.get(50).then(setData).catch((e) => setError(errorMessage(e))); }, []);

  if (error) return <CardShell className="p-6 text-sm text-red-600">{error}</CardShell>;
  if (!data) return <CardShell className="p-6 text-sm text-muted-foreground">Chargement…</CardShell>;

  const podium = data.top.slice(0, 3);
  const meOutside = data.me && !data.top.some((e) => e.me) ? data.me : null;

  return (
    <div className="space-y-4">
      {data.traders === 0 ? (
        <CardShell className="p-6 text-sm text-muted-foreground">Personne n'a encore joué : sois le premier du classement !</CardShell>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {podium.map((e, i) => {
            const Icon = i === 0 ? Crown : i === 1 ? Medal : Award;
            const color = i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : "#C2410C";
            return (
              <CardShell key={e.rank} className={`p-5 ${e.me ? "ring-2 ring-blue-500" : ""}`}>
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" style={{ color }} />
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{e.rank}{e.rank === 1 ? "er" : "e"}</span>
                  {e.me && <span className="ml-auto rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-600">toi</span>}
                </div>
                <p className="text-lg font-semibold text-foreground mt-2" style={DISPLAY}>{e.displayName}</p>
                <p className="text-[12px] font-semibold" style={{ color: LEVEL_COLOR[e.level] }}>{LEVEL_LABEL[e.level]}</p>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Score</p>
                    <p className="text-xl font-semibold text-foreground" style={MONO}>{e.skillScore}</p>
                  </div>
                  <p className={`text-sm font-semibold ${e.balance >= 100_000 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{money(e.balance)}</p>
                </div>
              </CardShell>
            );
          })}
        </div>
      )}

      {data.traders > 0 && (
        <CardShell className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Classement des traders</h3>
            <span className="text-[11px] text-muted-foreground">
              {data.traders} trader(s) · trié par score de compétence, puis niveau, puis portefeuille
              {data.me && <> · <b className="text-foreground">tu es {data.me.rank}{data.me.rank === 1 ? "er" : "e"}</b></>}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="text-left px-5 py-3 w-12">#</th><th className="text-left px-5 py-3">Trader</th>
                  <th className="text-left px-5 py-3">Niveau</th><th className="text-left px-5 py-3">Score</th>
                  <th className="text-right px-5 py-3">Portefeuille</th><th className="text-right px-5 py-3">Parties</th>
                  <th className="text-right px-5 py-3">Réussite</th><th className="text-left px-5 py-3">Badges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[...data.top, ...(meOutside ? [meOutside] : [])].map((e) => (
                  <tr key={`${e.rank}-${e.displayName}`} className={e.me ? "bg-blue-500/10" : "hover:bg-muted/10"}>
                    <td className="px-5 py-3 font-semibold text-muted-foreground" style={MONO}>{e.rank}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{e.displayName}{e.me && <span className="ml-1.5 text-[10px] text-blue-600 font-semibold">(toi)</span>}</td>
                    <td className="px-5 py-3 font-semibold" style={{ color: LEVEL_COLOR[e.level] }}>{LEVEL_LABEL[e.level]}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted"><div className="h-1.5 rounded-full" style={{ width: `${e.skillScore}%`, background: LEVEL_COLOR[e.level] }} /></div>
                        <span className="font-semibold text-foreground" style={MONO}>{e.skillScore}</span>
                      </div>
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${e.balance >= 100_000 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{money(e.balance)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground" style={MONO}>{e.games} · {e.trades} trades</td>
                    <td className="px-5 py-3 text-right text-muted-foreground" style={MONO}>{Math.round(e.winRate * 100)} %</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {e.badges.map((b) => (
                          <span key={b.id} title={b.description} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_STYLE[b.id] ?? "bg-muted text-muted-foreground"}`}>{b.label}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardShell>
      )}
      <p className="text-[11px] text-muted-foreground">Seuls le prénom et l'initiale du nom sont affichés. Passe la souris sur un badge pour voir comment le gagner.</p>
    </div>
  );
}
