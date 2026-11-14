import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award, Bot, Gamepad2, Medal, ShieldAlert, Swords, Target, Trophy, Users, Wallet } from "lucide-react";
import {
  adminApi, agentsApi, leaderboardApi, progressionApi,
  type AdminStats, type AgentDecision, type GameHistoryItem, type LeaderboardEntry,
} from "../../api/endpoints";
import { useAuth } from "../../auth/AuthContext";
import { LEVEL_COLOR, LEVEL_LABEL, money, useProgression } from "../../progression/ProgressionContext";
import { CardShell, DISPLAY, MONO } from "../../shared/ui";

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")} %`;

function Kpi({ label, value, sub, positive, Icon, color }: { label: string; value: string; sub: string; positive?: boolean; Icon: typeof Wallet; color?: string }) {
  return (
    <CardShell className="p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
      </div>
      <p className="text-2xl font-semibold" style={{ ...MONO, color: color ?? undefined }}>{value}</p>
      <p className={`text-[11px] mt-1.5 ${positive === undefined ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-red-500"}`}>{sub}</p>
    </CardShell>
  );
}

/** Haut du tableau de bord avec les VRAIES donnees : portefeuille, niveau, parties et decisions de l'agent. */
export default function DashboardTop() {
  const isAdmin = useAuth().user?.role === "ADMIN";
  return isAdmin ? <AdminTop /> : <TraderTop />;
}

function TraderTop() {
  const navigate = useNavigate();
  const { progression: p } = useProgression();
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [decisions, setDecisions] = useState<{ agent: string; items: AgentDecision[] } | null>(null);
  const [rank, setRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    progressionApi.history().then((h) => setHistory([...h].reverse())).catch(() => setHistory([]));
    leaderboardApi.get(3).then((b) => setRank(b.me)).catch(() => setRank(null));
    agentsApi.list().then(async (agents) => {
      if (agents.length === 0) return setDecisions({ agent: "", items: [] });
      const items = await agentsApi.decisions(agents[0].id!).catch(() => [] as AgentDecision[]);
      setDecisions({ agent: agents[0].name, items: items.slice(0, 4) });
    }).catch(() => setDecisions({ agent: "", items: [] }));
  }, [p?.games]);

  const counted = useMemo(() => history.filter((g) => g.counted), [history]);
  // ta courbe et celle qu'aurait eue l'agent sur les memes parties, a partir de 1 000 $
  const curve = useMemo(() => {
    const out = [{ n: "Départ", toi: p?.startBalance ?? 1000, agent: p?.startBalance ?? 1000 }];
    let agent = p?.startBalance ?? 1000;
    counted.forEach((g, i) => {
      agent *= 1 + (g.agentReturn ?? 0);
      out.push({ n: `#${i + 1}`, toi: g.endBalance, agent: Math.round(agent * 100) / 100 });
    });
    return out;
  }, [counted, p?.startBalance]);

  if (!p) return null;
  const gain = p.balance / p.startBalance - 1;
  const duels = counted.filter((g) => g.agentReturn != null);
  const beat = duels.filter((g) => g.playerReturn > (g.agentReturn ?? 0)).length;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Portefeuille" value={money(p.balance)} sub={`${pct(gain)} depuis ${money(p.startBalance)}`} positive={gain >= 0} Icon={Wallet} />
        <Kpi label="Niveau" value={LEVEL_LABEL[p.level]} color={LEVEL_COLOR[p.level]}
          sub={p.nextLevel ? `score ${p.skillScore}/100 · prochain : ${LEVEL_LABEL[p.nextLevel]}` : `score ${p.skillScore}/100 · niveau max`} Icon={Trophy} />
        <Kpi label="Taux de réussite" value={p.trades ? `${Math.round(p.winRate * 100)} %` : "—"}
          sub={`${p.games} partie(s) · ${p.trades} trade(s) · discipline ${Math.round(p.discipline * 100)} %`} Icon={Target} />
        <Kpi label="Toi contre l'agent" value={duels.length ? `${beat} / ${duels.length}` : "—"}
          sub={rank ? `classement : ${rank.rank}${rank.rank === 1 ? "er" : "e"}` : "parties où tu bats l'IA"} Icon={Swords} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CardShell className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Ton portefeuille</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">partie après partie, comparé à l'agent sur les mêmes marchés</p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-muted-foreground">Toi</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400" /><span className="text-muted-foreground">Agent IA</span></span>
            </div>
          </div>
          {counted.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-[12.5px] text-muted-foreground max-w-sm">Joue ta première partie pour voir ici l'évolution de ton portefeuille de 1 000 $.</p>
              <button onClick={() => navigate("/agent?play=1")} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                <Gamepad2 className="w-4 h-4" />Jouer une partie
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={curve} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradWallet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                <XAxis dataKey="n" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)} $`} width={60} domain={["auto", "auto"]} />
                <Tooltip formatter={(v: number, name) => [money(v), name === "toi" ? "Toi" : "Agent IA"]} />
                <ReferenceLine y={p.startBalance} stroke="#f59e0b" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="agent" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="toi" stroke="#2563EB" strokeWidth={2} fill="url(#gradWallet)" dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardShell>

        <CardShell className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Dernières décisions de l'IA</h3>
            {decisions?.agent && <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">{decisions.agent}</span>}
          </div>
          {!decisions ? (
            <p className="text-[12px] text-muted-foreground">Chargement…</p>
          ) : decisions.items.length === 0 ? (
            <div className="space-y-3">
              <p className="text-[12px] text-muted-foreground">
                {decisions.agent ? `${decisions.agent} n'a encore pris aucune décision.` : "Tu n'as pas encore d'agent IA."}
              </p>
              <button onClick={() => navigate("/agent")} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40">
                <Bot className="w-3.5 h-3.5" />{decisions.agent ? "Lancer une analyse" : "Créer mon agent"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {decisions.items.map((d) => {
                const tone = d.action === "BUY" ? "bg-emerald-500/10 border-emerald-500" : d.action === "SELL" ? "bg-red-500/10 border-red-500" : "bg-muted/30 border-slate-400";
                return (
                  <div key={d.id} className={`rounded-lg p-3 border-l-2 ${tone}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">{d.symbol}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {d.action === "BUY" ? "Achat" : d.action === "SELL" ? "Vente" : "Attente"} · {Math.round(d.confidence * 100)} %
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{d.explanation}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardShell>
      </div>
    </>
  );
}

/** Pour l'administrateur : chiffres de la plateforme (pas de portefeuille personnel). */
function AdminTop() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [board, setBoard] = useState<{ traders: number; top: LeaderboardEntry[] } | null>(null);
  useEffect(() => {
    adminApi.stats(7).then(setStats).catch(() => setStats(null));
    leaderboardApi.get(5).then(setBoard).catch(() => setBoard(null));
  }, []);
  const levels = stats?.users.byLevel ?? {};
  const totalLevels = Object.values(levels).reduce((a, b) => a + b, 0) || 1;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Comptes" value={stats ? String(stats.users.total) : "—"} sub={stats ? `${stats.users.enabled} actifs · +${stats.users.newInWindow} cette semaine` : ""} Icon={Users} />
        <Kpi label="Connexions (7 j)" value={stats ? String(stats.logins.success) : "—"} sub={stats ? `${stats.logins.failure} échec(s) · ${stats.users.lockedNow} verrouillé(s)` : ""} Icon={Award} />
        <Kpi label="Traders classés" value={board ? String(board.traders) : "—"} sub="ont joué au moins une partie" Icon={Medal} />
        <Kpi label="Anomalies de connexion" value={stats ? String(stats.anomalies.assessed) : "—"} sub="analysées sur 7 jours" Icon={ShieldAlert} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CardShell className="lg:col-span-2 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1" style={DISPLAY}>Comptes par niveau</h3>
          <p className="text-[11px] text-muted-foreground mb-3">tous les comptes ; ceux qui n'ont jamais joué restent Débutant</p>
          <div className="space-y-2.5">
            {(["DEBUTANT", "INTERMEDIAIRE", "AVANCE", "EXPERT"] as const).map((l) => (
              <div key={l} className="flex items-center gap-3">
                <span className="w-28 text-[12px] font-semibold" style={{ color: LEVEL_COLOR[l] }}>{LEVEL_LABEL[l]}</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted">
                  <div className="h-2.5 rounded-full" style={{ width: `${((levels[l] ?? 0) / totalLevels) * 100}%`, background: LEVEL_COLOR[l] }} />
                </div>
                <span className="w-8 text-right text-[12px] text-foreground" style={MONO}>{levels[l] ?? 0}</span>
              </div>
            ))}
          </div>
        </CardShell>
        <CardShell className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Top 5 traders</h3>
            <button onClick={() => navigate("/leaderboard")} className="text-[11px] text-blue-600 hover:underline">Voir tout</button>
          </div>
          {!board || board.top.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Aucun trader classé pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {board.top.map((e) => (
                <div key={e.rank} className="flex items-center gap-2 text-[12px]">
                  <span className="w-5 text-muted-foreground" style={MONO}>{e.rank}</span>
                  <span className="flex-1 font-medium text-foreground">{e.displayName}</span>
                  <span className="font-semibold" style={{ color: LEVEL_COLOR[e.level] }}>{LEVEL_LABEL[e.level]}</span>
                  <span className="w-10 text-right text-foreground" style={MONO}>{e.skillScore}</span>
                </div>
              ))}
            </div>
          )}
        </CardShell>
      </div>
    </>
  );
}
