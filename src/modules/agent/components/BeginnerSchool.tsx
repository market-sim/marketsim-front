import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Flag, GraduationCap, Lightbulb, Play, RotateCcw, SkipForward, User, Volume2, Bot, Trophy, Wallet } from "lucide-react";
import { agentsApi, progressionApi, type AgentConfig, type ReplayResult, type SettleGameResponse } from "../../../api/endpoints";
import { LEVEL_COLOR, LEVEL_LABEL, useProgression } from "../../../progression/ProgressionContext";
import { useAuth } from "../../../auth/AuthContext";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import coachImage from "../../../assets/coach.jpg";
import { inputClass, labelClass } from "../format";
import { simulateHuman } from "../replayUtils";
import { speak, ttsSupported } from "../speech";
import { adviceLabel, buildDebrief, expectedChoice, usd as eur, type Choice, type Decision } from "../schoolLogic";
import CandleChart, { type HumanTrade } from "./CandleChart";

const START_CAPITAL = 100_000;   // capital de depart unique (le meme que le trading)
const ZOOMS = [20, 40, 80];
const FRACTIONS = [0.25, 0.5, 1];
const STEPS = [1, 3, 5];
const DURATIONS = [63, 126];
const TONE = {
  buy: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40",
  hold: "bg-sky-500/15 text-sky-300 ring-sky-400/40",
  sell: "bg-red-500/15 text-red-300 ring-red-400/40",
} as const;

const pct = (v: number, digits = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(digits).replace(".", ",")} %`;
const CHOICE_LABEL: Record<Choice, string> = { BUY: "ACHETER", HOLD: "GARDER", SELL: "VENDRE" };

/** Guide detaille du niveau Debutant : ce qu'il faut regarder et faire a cette etape precise. */
function beginnerTip(o: { invested: boolean; latent: number | null; stopPct: number; advice: string | null; decisions: number }): string {
  if (o.decisions === 0) {
    return "Étape 1 · Regarde le graphique : chaque bougie est un jour. Lis le conseil du coach à droite, puis choisis un montant (25 % pour commencer prudemment) et clique sur un des trois gros boutons.";
  }
  if (o.invested && o.latent != null && o.latent <= -o.stopPct) {
    return `Attention : ta position perd ${Math.abs(o.latent * 100).toFixed(1).replace(".", ",")} %, plus que le stop conseillé (${(o.stopPct * 100).toFixed(1).replace(".", ",")} %). Un bon trader coupe ses pertes tôt : envisage de VENDRE. La discipline compte dans ton niveau.`;
  }
  if (o.invested && o.latent != null && o.latent >= 2 * o.stopPct) {
    return "Tu es en gain. Tu peux GARDER si la tendance continue, ou VENDRE une fois l'objectif atteint pour sécuriser ton gain : un gain non vendu peut disparaître.";
  }
  if (o.invested) {
    return "Tu es investi : ton argent monte et baisse avec le prix. Surveille le prix par rapport à ton prix d'entrée (en bas à droite) et suis le conseil du coach.";
  }
  return `Tu n'es pas investi : ton argent ne bouge pas. Le coach dit « ${o.advice ?? "ATTENDRE"} ». Attendre est aussi une décision : n'achète que si tu as une raison.`;
}

interface Feedback { from: number; to: number; choice: Choice; followed: boolean; coach: string; market: number; mine: number }

/**
 * Mode debutant : tu pars avec 100 000 $ virtuels (portefeuille unique) sur un marche simule ; le coach IA te conseille acheter / garder / vendre
 * a chaque etape en expliquant pourquoi ; tu decides, le marche avance, tu gagnes ou tu perds. A la fin, un bilan montre
 * ce qui a marche, ce qui a coute cher, et ce que le coach aurait fait.
 */
export default function BeginnerSchool({ agent, onExit }: { agent: AgentConfig; onExit: () => void }) {
  const symbols = agent.allowedAssets.split(",").map((s) => s.trim()).filter(Boolean);
  const { progression, update } = useProgression();
  // l'administrateur peut essayer le jeu, mais sans portefeuille ni score : ses parties ne comptent pas
  const isAdmin = useAuth().user?.role === "ADMIN";
  const diff = progression?.difficulty ?? null;
  const level = progression?.level ?? "DEBUTANT";
  const wallet = progression?.balance ?? START_CAPITAL;
  const coachMode = diff?.coach ?? "ALWAYS";
  const durations = DURATIONS.filter((d) => d >= (diff?.minDays ?? 0));
  const steps = STEPS.filter((n) => n <= (diff?.maxStepDays ?? 5));
  const [config, setConfig] = useState({ symbol: symbols[0] ?? "AAPL", days: 126, crash: true });
  const [crashUsed, setCrashUsed] = useState<number | null>(null);
  const [result, setResult] = useState<SettleGameResponse | null>(null);
  const [settling, setSettling] = useState(false);
  const [replay, setReplay] = useState<ReplayResult | null>(null);
  const [t, setT] = useState(0);
  const [trades, setTrades] = useState<HumanTrade[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [fraction, setFraction] = useState(0.5);
  const [step, setStep] = useState(1);
  const [zoom, setZoom] = useState(40);
  const [last, setLast] = useState<Feedback | null>(null);
  const [anim, setAnim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stopVoice = useRef<(() => void) | null>(null);
  const saved = useRef(false);

  const finished = replay != null && t >= replay.horizonDays;
  const sim = useMemo(() => (replay ? simulateHuman(replay, trades, t) : null), [replay, trades, t]);
  const today = replay ? replay.days[Math.min(t, replay.horizonDays)] : null;
  const advice = today && sim ? adviceLabel(today.action, sim.invested) : null;
  const debrief = useMemo(() => (replay && finished ? buildDebrief(replay, trades, decisions, replay.horizonDays) : null), [replay, finished, trades, decisions]);

  useEffect(() => () => { stopVoice.current?.(); }, []);

  const start = async (seed: number | null) => {
    if (progression?.bankrupt) {
      setError("Ton portefeuille est vide : recommence avec 100 000 $ (bouton du niveau, en haut à droite).");
      return;
    }
    setBusy(true);
    setError("");
    stopVoice.current?.();
    const crashPct = diff?.crashForced ? diff.crashPct : config.crash ? 20 : null;
    const days = Math.max(config.days, diff?.minDays ?? 0);
    try {
      const r = await agentsApi.replay(agent.id!, {
        symbol: config.symbol, days, model: "REGIME_SWITCHING", seed, crashPct, capital: wallet,
      });
      // les frais dependent du niveau : plus on monte, plus chaque ordre coute cher
      setReplay(diff ? { ...r, costRate: diff.feeRate } : r);
      setCrashUsed(crashPct);
      setResult(null);
      setStep(1);
      setT(0);
      setTrades([]);
      setDecisions([]);
      setLast(null);
      saved.current = false;
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const decide = useCallback((choice: Choice) => {
    if (!replay || !sim || finished) return;
    const day = replay.days[t];
    let order: HumanTrade | null = null;
    if (choice === "BUY") {
      if (sim.cash < 1) return;
      order = { day: t, side: "BUY", price: day.price, fraction };
    } else if (choice === "SELL") {
      if (!sim.invested) return;
      order = { day: t, side: "SELL", price: day.price };
    }
    const nextTrades = order ? [...trades, order] : trades;
    const next = Math.min(replay.horizonDays, t + step);
    const before = simulateHuman(replay, nextTrades, t);
    const after = simulateHuman(replay, nextTrades, next);
    const followed = choice === expectedChoice(day.action, sim.invested);
    stopVoice.current?.();
    setTrades(nextTrades);
    setDecisions((d) => [...d, { day: t, choice, fraction: choice === "BUY" ? fraction : 1, coach: day.action, invested: sim.invested, followed, price: day.price }]);
    setLast({
      from: t, to: next, choice, followed, coach: adviceLabel(day.action, sim.invested).label,
      market: replay.days[next].price / day.price - 1, mine: after.equity[next] / before.equity[t] - 1,
    });
    setT(next);
    setAnim(true);
    setTimeout(() => setAnim(false), 800);
  }, [replay, sim, finished, t, trades, fraction, step]);

  // raccourcis : B acheter, H garder, S vendre
  const decideRef = useRef(decide);
  decideRef.current = decide;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "b") decideRef.current("BUY");
      else if (k === "h" || k === " ") { e.preventDefault(); decideRef.current("HOLD"); }
      else if (k === "s") decideRef.current("SELL");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Envoie la partie au serveur, qui la rejoue et met a jour le portefeuille et le niveau (une seule fois). */
  const settle = useCallback(async (orders: HumanTrade[]) => {
    if (!replay || saved.current) return;
    saved.current = true;
    if (isAdmin) return;
    setSettling(true);
    try {
      const res = await progressionApi.settle({
        agentId: agent.id!, symbol: replay.symbol, days: replay.horizonDays, model: replay.model, seed: replay.seed,
        crashPct: crashUsed, orders: orders.map((o) => ({ day: o.day, side: o.side, fraction: o.fraction })),
      });
      setResult(res);
      update(res.progression);
    } catch (e) {
      saved.current = false;
      setError(errorMessage(e));
    } finally {
      setSettling(false);
    }
  }, [replay, agent.id, crashUsed, update, isAdmin]);

  useEffect(() => {
    if (debrief) void settle(trades);
  }, [debrief, settle, trades]);

  /** Abandonner = vendre tout au cours du jour : la partie compte quand meme (on ne peut pas effacer une perte). */
  const abandon = () => {
    stopVoice.current?.();
    if (replay && decisions.length > 0 && !saved.current) {
      const cashOut: HumanTrade[] = sim?.invested ? [...trades, { day: t, side: "SELL", price: replay.days[t].price }] : trades;
      void settle(cashOut);
    }
    setReplay(null);
  };

  const listen = () => {
    if (!today || !advice || !ttsSupported()) return;
    stopVoice.current?.();
    stopVoice.current = speak(`Le coach conseille : ${advice.label}. ${today.why}`);
  };

  // =============================== Ecran de depart ===============================
  if (!replay) {
    return (
      <CardShell className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-semibold text-foreground" style={DISPLAY}>Jeu de trading · niveau {LEVEL_LABEL[level]}</h3>
          {diff && <span className="text-[11px] rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: LEVEL_COLOR[level] }}>Difficulté {diff.label}</span>}
          <button onClick={onExit} className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="w-3.5 h-3.5" />Mode libre</button>
        </div>
        {result && <ResultCard result={result} />}
        {isAdmin && (
          <p className="mb-4 rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-[12px] text-foreground">
            Mode démo administrateur : tu peux essayer le jeu, mais l'administrateur n'a ni portefeuille, ni niveau, ni score. Les parties ne comptent pas.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 mb-4 rounded-lg border border-border/60 px-4 py-3">
          <Wallet className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ton portefeuille</p>
            <p className={`text-lg font-semibold ${wallet >= START_CAPITAL ? "text-emerald-500" : "text-red-500"}`} style={MONO}>{eur(wallet)}</p>
          </div>
          <p className="text-[11.5px] text-muted-foreground max-w-xl ml-2">
            Chaque partie se joue avec <b className="text-foreground">tout ton portefeuille</b> : ce que tu gagnes ou perds y reste. Ton niveau monte si ton argent
            grandit <b>et</b> si tu trades bien (réussite, gains plus grands que les pertes, stop-loss respecté). Si tu perds de l'argent, tu restes Débutant.
          </p>
        </div>
        {diff && <p className="text-[12px] text-muted-foreground mb-4">Niveau {LEVEL_LABEL[level]} : {diff.summary}</p>}
        <p className="text-[12.5px] text-muted-foreground mb-5 max-w-3xl">
          {coachMode === "HIDDEN"
            ? <>Pas de coach à ce niveau : <b>tu décides seul</b> d'acheter, garder ou vendre.</>
            : <>Le coach IA te dit {coachMode === "AFTER_DECISION" ? <b>après chaque décision</b> : <b>à chaque étape</b>} s'il fallait acheter, garder ou vendre et pourquoi ; c'est toi qui décides.</>}
          {" "}L'argent est virtuel : tu apprends sans risquer ton vrai argent.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            ["1", `Tu joues avec ${eur(wallet)}`, "Ton portefeuille, en argent virtuel."],
            ["2", coachMode === "HIDDEN" ? "Tu analyses seul" : "Le coach te conseille", coachMode === "HIDDEN" ? "Bougies, tendance, krach possible." : "Acheter, garder ou vendre, avec ses raisons."],
            ["3", "Tu décides", "Le marché avance d'un jour après ton choix."],
            ["4", "Ton bilan et ton niveau", "Le portefeuille et le niveau se mettent à jour."],
          ].map(([n, title, text]) => (
            <div key={n} className="rounded-lg border border-border/60 p-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center mb-2">{n}</div>
              <p className="text-[12px] font-semibold text-foreground">{title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{text}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className={labelClass}>Actif</label>
            <select value={config.symbol} onChange={(e) => setConfig({ ...config, symbol: e.target.value })} className={inputClass}>
              {symbols.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Durée</label>
            <select value={Math.max(config.days, diff?.minDays ?? 0)} onChange={(e) => setConfig({ ...config, days: Number(e.target.value) })} className={inputClass}>
              {durations.map((d) => <option key={d} value={d}>{d === 63 ? "3 mois (63 jours)" : "6 mois (126 jours)"}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground pb-2" title="Un krach arrive à un moment que tu ne connais pas : c'est la leçon sur le risque">
            <input type="checkbox" checked={diff?.crashForced ? true : config.crash} disabled={diff?.crashForced}
              onChange={(e) => setConfig({ ...config, crash: e.target.checked })} className="accent-red-500" />
            Krach surprise (−{diff?.crashForced ? diff.crashPct : 20} %){diff?.crashForced ? " · imposé à ce niveau" : ""}
          </label>
          <button onClick={() => start(null)} disabled={busy || progression?.bankrupt} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">
            <Play className="w-4 h-4" />{busy ? "Préparation..." : progression?.bankrupt ? "Portefeuille vide" : `Jouer avec ${eur(wallet)}`}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        {progression && progression.games > 0 && (
          <p className="text-[11px] text-muted-foreground mt-4" style={MONO}>
            Parties jouées : {progression.games} · trades : {progression.trades} · réussite : {Math.round(progression.winRate * 100)} % · compétence : {progression.skillScore}/100
          </p>
        )}
        {progression?.bankrupt && (
          <p className="text-[12px] text-red-500 mt-3">Ton portefeuille est vide. Clique sur ton niveau en haut à droite puis « Recommencer avec 100 000 $ ».</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-3 max-w-3xl">
          Ici l'argent est virtuel et le marché simulé : un résultat de simulation ne prédit pas un résultat réel. Méfie-toi des publicités qui promettent des gains faciles
          (bonus de dépôt, « investir » en un clic) : le risque de perdre est bien réel, et tu vas le constater toi-même ici, même avec un coach.
        </p>
      </CardShell>
    );
  }

  // =============================== Partie en cours / bilan ===============================
  const s = sim!;
  const d = today!;
  const equity = s.equity[Math.min(t, replay.horizonDays)];
  const positionValue = s.units * d.price;
  const latent = s.avgEntry != null ? d.price / s.avgEntry - 1 : null;
  const followedCount = decisions.filter((x) => x.followed).length;
  const buyDisabled = finished || s.cash < 1;
  const rows = [
    { name: "Toi", Icon: User, value: equity, color: "text-amber-500" },
    { name: `IA · ${agent.name}`, Icon: Bot, value: d.agentEquity, color: "text-sky-500" },
    { name: "Buy & Hold", Icon: Flag, value: d.benchmarkEquity, color: "text-slate-400" },
  ].sort((a, b) => b.value - a.value);
  const recommended: Choice | null = advice && !finished && coachMode === "ALWAYS" ? expectedChoice(d.action, s.invested) : null;
  const showCoachNow = coachMode === "ALWAYS" || coachMode === "ALWAYS_NO_HIGHLIGHT";

  const bigButton = (choice: Choice, cls: string, disabled: boolean, label: string) => (
    <button onClick={() => decide(choice)} disabled={disabled}
      className={`relative rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-30 ${cls} ${recommended === choice ? "ring-2 ring-offset-2 ring-offset-transparent ring-white/70" : ""}`}>
      {label}
      {recommended === choice && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-white text-[9px] font-bold text-slate-900 px-2 py-0.5 whitespace-nowrap">★ CONSEILLÉ</span>}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Tuiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <CardShell className="p-3.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Ton portefeuille</p>
          <p className={`text-xl font-semibold mt-1 ${equity >= replay.capital ? "text-emerald-500" : "text-red-500"}`} style={MONO}>{eur(equity)}</p>
          <p className="text-[11px] text-muted-foreground">{pct(equity / replay.capital - 1)} depuis le départ ({eur(replay.capital)})</p>
        </CardShell>
        <CardShell className="p-3.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Liquidités</p>
          <p className="text-xl font-semibold mt-1 text-foreground" style={MONO}>{eur(s.cash)}</p>
          <p className="text-[11px] text-muted-foreground">disponibles pour acheter</p>
        </CardShell>
        <CardShell className="p-3.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Investi</p>
          <p className="text-xl font-semibold mt-1 text-foreground" style={MONO}>{eur(positionValue)}</p>
          <p className={`text-[11px] ${latent == null ? "text-muted-foreground" : latent >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {latent == null ? "aucune position" : `${pct(latent)} depuis ton achat`}
          </p>
        </CardShell>
        <CardShell className="p-3.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Jour</p>
          <p className="text-xl font-semibold mt-1 text-foreground" style={MONO}>{Math.min(t, replay.horizonDays)} / {replay.horizonDays}</p>
          <div className="h-1.5 bg-muted rounded-full mt-1.5"><div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${(Math.min(t, replay.horizonDays) / replay.horizonDays) * 100}%` }} /></div>
        </CardShell>
        {coachMode === "HIDDEN" ? (
          <CardShell className="p-3.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Niveau</p>
            <p className="text-xl font-semibold mt-1" style={{ color: LEVEL_COLOR[level], ...DISPLAY }}>{LEVEL_LABEL[level]}</p>
            <p className="text-[11px] text-muted-foreground">frais {((diff?.feeRate ?? 0) * 100).toFixed(2).replace(".", ",")} % par ordre</p>
          </CardShell>
        ) : (
          <CardShell className="p-3.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Conseils suivis</p>
            <p className="text-xl font-semibold mt-1 text-foreground" style={MONO}>{followedCount} / {decisions.length}</p>
            <p className="text-[11px] text-muted-foreground">décisions conformes au coach</p>
          </CardShell>
        )}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-4 gap-4 items-start">
        <div className="2xl:col-span-3 space-y-4 min-w-0">
          <CardShell className="p-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>{replay.symbol} · le marché jour après jour</h3>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Zoom</span>
                <div className="flex gap-1 bg-muted/40 rounded-lg p-0.5">
                  {ZOOMS.map((z) => (
                    <button key={z} onClick={() => setZoom(z)} className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${zoom === z ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>{z}</button>
                  ))}
                </div>
              </div>
            </div>
            <CandleChart replay={replay} t={t} trades={trades} agentName={`Coach ${agent.name}`} playing={anim} speed={1.4} visible={zoom} height={360}
              mine={s.avgEntry != null && diff?.showStopHint !== false ? { entry: s.avgEntry } : null} hideAgent={!showCoachNow} />
            <p className="text-[10.5px] text-muted-foreground mt-2">
              Chaque bougie = un jour (vert = le prix a monté, rouge = baissé). Les ordres que tu passes apparaissent en <b style={{ color: "#FBBF24" }}>jaune</b>, tes gains et pertes en bande colorée.
            </p>
          </CardShell>

          {!finished ? (
            <CardShell className="p-5">
              {diff?.guide === "DETAILED" && (
                <p className="mb-4 flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-foreground">
                  <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span><b>Guide · </b>{beginnerTip({ invested: s.invested, latent, stopPct: replay.stopPct, advice: advice?.label ?? null, decisions: decisions.length })}</span>
                </p>
              )}
              {diff?.guide === "TIPS" && decisions.length === 0 && (
                <p className="mb-4 text-[11.5px] text-muted-foreground"><Lightbulb className="inline w-3.5 h-3.5 text-amber-500 -mt-0.5" /> Astuce : coupe une perte avant qu'elle dépasse 1,5 fois le stop ({(replay.stopPct * 150).toFixed(1).replace(".", ",")} %), ta discipline compte dans ton niveau.</p>
              )}
              <div className="grid grid-cols-3 gap-3">
                {bigButton("BUY", "bg-emerald-500 hover:bg-emerald-600", buyDisabled, "ACHETER (B)")}
                {bigButton("HOLD", "bg-sky-600 hover:bg-sky-700", false, s.invested ? "GARDER (H)" : "ATTENDRE (H)")}
                {bigButton("SELL", "bg-red-500 hover:bg-red-600", !s.invested, "VENDRE (S)")}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5">Montant d'un achat :
                  {FRACTIONS.map((f) => (
                    <button key={f} onClick={() => setFraction(f)} className={`px-2 py-0.5 rounded-md border text-[11px] ${fraction === f ? "bg-blue-600 border-blue-600 text-white" : "border-border hover:bg-muted/40"}`}>{f * 100} %</button>
                  ))}
                  <span style={MONO}>= {eur(s.cash * fraction)}</span>
                </span>
                <span className="flex items-center gap-1.5">Avancer de :
                  {steps.map((n) => (
                    <button key={n} onClick={() => setStep(n)} className={`px-2 py-0.5 rounded-md border text-[11px] ${step === n ? "bg-blue-600 border-blue-600 text-white" : "border-border hover:bg-muted/40"}`}>{n} jour{n > 1 ? "s" : ""}</button>
                  ))}
                </span>
                {diff?.allowSkipToEnd !== false && (
                  <button onClick={() => setT(replay.horizonDays)} className="ml-auto flex items-center gap-1.5 text-[11px] hover:text-foreground" title="Garde ta position jusqu'à la fin et passe au bilan">
                    <SkipForward className="w-3.5 h-3.5" />Passer au bilan
                  </button>
                )}
              </div>
              {last && (
                <p className="mt-3 rounded-lg bg-muted/30 px-3 py-2 text-[12px] text-foreground">
                  Jour {last.from} → {last.to} : marché <b className={last.market >= 0 ? "text-emerald-500" : "text-red-500"}>{pct(last.market)}</b>, ton portefeuille{" "}
                  <b className={last.mine >= 0 ? "text-emerald-500" : "text-red-500"}>{pct(last.mine)}</b>.{" "}
                  {coachMode === "HIDDEN" ? null : last.followed ? <span className="text-emerald-500">✓ Tu as suivi le coach.</span> : <span className="text-amber-500">≠ Le coach conseillait : {last.coach}.</span>}
                </p>
              )}
            </CardShell>
          ) : debrief && (
            <div className="rounded-xl p-5 text-white" style={{ background: "linear-gradient(135deg, #0F2E7A, #0B1530)" }}>
              <div className="flex items-center gap-2 mb-1"><GraduationCap className="w-5 h-5 text-sky-300" /><p className="text-sm font-semibold">Ton bilan</p></div>
              <p className={`text-xl font-semibold ${debrief.pnl >= 0 ? "text-emerald-300" : "text-red-300"}`} style={DISPLAY}>{debrief.headline}</p>
              {settling && <p className="text-[12px] text-blue-200 mt-2">Mise à jour de ton portefeuille et de ton niveau…</p>}
              {result && <div className="mt-3"><ResultCard result={result} dark /></div>}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4">
                {[
                  ["Buy & Hold", `${eur(debrief.benchFinal)} (${pct(debrief.benchPct)})`],
                  [`Coach · ${agent.name}`, `${eur(debrief.agentFinal)} (${pct(debrief.agentPct)})`],
                  ["Tes trades", debrief.trips.length ? `${debrief.trips.length} · ${debrief.winRate != null ? Math.round(debrief.winRate * 100) : 0} % gagnants` : "aucun"],
                  ["Frais payés", eur(debrief.fees)],
                  ["Temps investi", `${Math.round(debrief.investedPct * 100)} %`],
                  ["Pire baisse", pct(debrief.maxDD)],
                  ["Conseils suivis", `${debrief.followed} / ${debrief.decisions}`],
                  ["Ordres passés", String(debrief.orders)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/10 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-blue-200/80">{k}</p>
                    <p className="text-[12.5px] font-semibold mt-0.5" style={MONO}>{v}</p>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold mt-5 mb-2"><Lightbulb className="w-4 h-4 text-amber-300" />Ce que tu peux retenir de cette partie</p>
              <ul className="space-y-2">
                {debrief.lessons.map((l, i) => <li key={i} className="text-[12.5px] leading-relaxed text-blue-50 rounded-lg bg-white/5 px-3 py-2">{l}</li>)}
              </ul>
              <p className="text-[11px] text-blue-200/80 mt-4">
                Une seule partie dépend beaucoup de la chance, et l'argent est virtuel : rejoue sur d'autres marchés avant d'en tirer une conclusion.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => start(replay.seed)} disabled={busy || settling || progression?.bankrupt} title="Entraînement : un marché déjà joué ne change plus ton portefeuille"
                  className="bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-lg px-3 py-1.5 text-xs font-medium">Rejouer le même marché (entraînement)</button>
                <button onClick={() => start(null)} disabled={busy || settling || progression?.bankrupt} className="bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-lg px-3 py-1.5 text-xs font-medium">Nouveau marché</button>
                <button onClick={() => setReplay(null)} className="bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-xs font-medium">Changer les réglages</button>
                <button onClick={onExit} className="bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-xs font-medium">Mode libre</button>
              </div>
              {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
            </div>
          )}
        </div>

        {/* Colonne de droite : coach, classement, journal */}
        <div className="space-y-4">
          <CardShell className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="block w-11 h-11 rounded-full shrink-0 bg-no-repeat"
                style={{ backgroundImage: `url(${coachImage})`, backgroundSize: "300%", backgroundPosition: "50% 20%", boxShadow: "0 0 0 2px #0C80EF" }} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground" style={DISPLAY}>Coach IA</p>
                <p className="text-[10.5px] text-muted-foreground truncate">{agent.name} · regarde les mêmes bougies que toi</p>
              </div>
              {ttsSupported() && !finished && showCoachNow && (
                <button onClick={listen} aria-label="Écouter le conseil" title="Écouter le conseil" className="ml-auto p-1.5 rounded-md text-muted-foreground hover:bg-muted/50"><Volume2 className="w-4 h-4" /></button>
              )}
            </div>
            {finished ? (
              <p className="text-[12px] text-muted-foreground">La partie est terminée : lis ton bilan à gauche.</p>
            ) : !showCoachNow ? (
              <p className="text-[12px] text-muted-foreground">
                {coachMode === "HIDDEN"
                  ? `Niveau ${LEVEL_LABEL[level]} : pas de coach. Analyse les bougies et décide seul.`
                  : `Niveau ${LEVEL_LABEL[level]} : le coach ne parle qu'après ta décision. Tu verras sous les boutons s'il était d'accord avec toi.`}
              </p>
            ) : (
              <>
                {advice && (
                  <div className="flex items-center gap-2.5">
                    <span className={`px-3 py-1.5 rounded-lg text-[12px] font-bold tracking-wide ring-1 ${TONE[advice.tone]}`}>{advice.label}</span>
                    <span className="text-[11px] text-muted-foreground">confiance du modèle {Math.round(d.confidence * 100)} %</span>
                  </div>
                )}
                <p className="text-[12.5px] leading-snug text-foreground mt-3">{d.why}</p>
                {diff?.showStopHint !== false && s.avgEntry != null && latent != null && (
                  <p className="text-[11px] text-muted-foreground mt-3 rounded-lg bg-muted/30 px-2.5 py-2">
                    Ton prix d'entrée : <b className="text-foreground" style={MONO}>{s.avgEntry.toFixed(2)}</b> · stop conseillé à <b className="text-foreground" style={MONO}>{(s.avgEntry * (1 - replay.stopPct)).toFixed(2)}</b> ({pct(-replay.stopPct)}) :
                    si le prix passe dessous, le coach coupe la perte.
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-3">Le coach ne voit pas le futur et peut se tromper : c'est un conseil, pas un ordre.</p>
              </>
            )}
          </CardShell>

          <CardShell className="p-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{finished ? "Résultat final" : "Classement en direct"}</p>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={r.name} className={`flex items-center gap-2 rounded-lg p-2 ${i === 0 ? "bg-amber-50 border border-amber-100" : "bg-muted/20"}`}>
                  <span className="text-sm w-5">{["🥇", "🥈", "🥉"][i]}</span>
                  <r.Icon className={`w-3.5 h-3.5 ${r.color}`} />
                  <span className="text-[12px] font-medium text-foreground flex-1 truncate">{r.name}</span>
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-foreground" style={MONO}>{eur(r.value)}</p>
                    <p className={`text-[9.5px] ${r.value >= replay.capital ? "text-emerald-600" : "text-red-500"}`}>{pct(r.value / replay.capital - 1)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardShell>

          <CardShell className="p-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Ton journal</p>
            {decisions.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Tes décisions apparaîtront ici avec ce que le coach conseillait.</p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {[...decisions].reverse().slice(0, 12).map((x, i) => (
                  <div key={`${x.day}-${i}`} className="flex items-center gap-2 text-[11px]">
                    <span className="text-muted-foreground w-9 shrink-0" style={MONO}>J{x.day}</span>
                    <span className={`font-semibold w-[72px] shrink-0 ${x.choice === "BUY" ? "text-emerald-500" : x.choice === "SELL" ? "text-red-500" : "text-sky-500"}`}>
                      {CHOICE_LABEL[x.choice]}{x.choice === "BUY" ? ` ${Math.round(x.fraction * 100)} %` : ""}
                    </span>
                    <span className={x.followed ? "text-emerald-500" : "text-amber-500"}>{x.followed ? "✓ coach" : "≠ coach"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardShell>

          {!finished && (
            <button onClick={abandon} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              title="Ta position est vendue au cours du jour et la partie compte quand même">
              <RotateCcw className="w-3.5 h-3.5" />Abandonner (vendre tout maintenant)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Resultat d'une partie renvoye par le serveur : portefeuille avant/apres et changement de niveau. */
function ResultCard({ result, dark = false }: { result: SettleGameResponse; dark?: boolean }) {
  const pos = result.pnl >= 0;
  const box = dark ? "bg-white/10 text-white" : "bg-muted/30 text-foreground border border-border/60";
  return (
    <div className={`rounded-lg px-4 py-3 mb-4 ${box}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          <Wallet className="w-4 h-4" />
          {eur(result.startBalance)} → <span className={pos ? "text-emerald-400" : "text-red-400"}>{eur(result.endBalance)}</span>
        </span>
        <span className={`text-[12px] font-semibold ${pos ? "text-emerald-400" : "text-red-400"}`} style={MONO}>
          {pos ? "+" : "−"}{eur(Math.abs(result.pnl))}
        </span>
        <span className="flex items-center gap-1.5 text-[12px]">
          <Trophy className="w-4 h-4" style={{ color: LEVEL_COLOR[result.levelAfter] }} />
          {result.levelUp || result.levelDown
            ? <>{LEVEL_LABEL[result.levelBefore]} → <b style={{ color: LEVEL_COLOR[result.levelAfter] }}>{LEVEL_LABEL[result.levelAfter]}</b></>
            : <>Niveau {LEVEL_LABEL[result.levelAfter]}</>}
        </span>
      </div>
      <p className={`text-[12px] mt-1.5 ${result.levelUp ? "text-emerald-400 font-semibold" : result.levelDown ? "text-amber-400 font-semibold" : dark ? "text-blue-100" : "text-muted-foreground"}`}>
        {result.levelUp && "🎉 "}{result.message}
      </p>
    </div>
  );
}
