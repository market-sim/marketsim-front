import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Flame, Play, RotateCcw, ShieldAlert, Target } from "lucide-react";
import type { Challenge } from "./lessons";
import { academyAudio } from "./audio";

interface Props {
  kind: Challenge;
  /** defi reussi ; firstTry = sans echec avant */
  onPassed: (firstTry: boolean) => void;
}

/** Defis interactifs des batiments : on manipule un vrai graphique au lieu de seulement lire. */
export default function ChallengeView({ kind, onPassed }: Props) {
  switch (kind) {
    case "support":
      return <SupportChallenge onPassed={onPassed} />;
    case "stoploss":
      return <StopLossChallenge onPassed={onPassed} />;
    case "crash":
      return <CrashBoss onPassed={onPassed} />;
    case "sizing":
      return <SizingChallenge onPassed={onPassed} />;
  }
}

type Done = { onPassed: (firstTry: boolean) => void };

const W = 520;
const H = 220;
const PAD = 8;

function scaleY(min: number, max: number) {
  return (p: number) => PAD + ((max - p) / (max - min)) * (H - PAD * 2);
}

function linePath(values: number[], n: number, y: (p: number) => number) {
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${(PAD + (i / (n - 1)) * (W - PAD * 2)).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
}

/** Interpole des points de passage, avec un petit bruit regulier. */
function waypoints(points: number[], steps: number, noise: number) {
  const out: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const idx = out.length;
      out.push(points[i] + (points[i + 1] - points[i]) * t + (k === 0 ? 0 : Math.sin(idx * 1.7) * noise));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function Result({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className={`mt-3 rounded-xl px-3 py-2.5 text-[13px] ${ok ? "bg-emerald-500/15 text-emerald-100" : "bg-red-500/15 text-red-100"}`}>
      <p className="font-semibold mb-0.5">{title}</p>
      <div>{children}</div>
    </div>
  );
}

// ─── Tour des Bougies : trouver le support puis la resistance ───────────────────────────────────

const SUPPORT = 95;
const RESISTANCE = 108;

function SupportChallenge({ onPassed }: Done) {
  const prices = useMemo(() => waypoints([101, 95.2, 103, 107.7, 100, 95.3, 104, 108.2, 99, 94.9, 102, 107.8, 104], 4, 0.6), []);
  const y = scaleY(88, 114);
  const [step, setStep] = useState<"support" | "resistance" | "done">("support");
  const [hover, setHover] = useState<number | null>(null);
  const [miss, setMiss] = useState<number | null>(null);
  const [errors, setErrors] = useState(0);
  const svg = useRef<SVGSVGElement>(null);

  const priceAt = (clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    const py = ((clientY - r.top) / r.height) * H;
    return 114 - ((py - PAD) / (H - PAD * 2)) * (114 - 88);
  };

  function click(e: React.MouseEvent) {
    if (step === "done") return;
    const p = priceAt(e.clientY);
    const target = step === "support" ? SUPPORT : RESISTANCE;
    if (Math.abs(p - target) <= 1.6) {
      setMiss(null);
      academyAudio.correct();
      if (step === "support") setStep("resistance");
      else {
        setStep("done");
        onPassed(errors === 0);
      }
    } else {
      setMiss(p);
      setErrors((n) => n + 1);
      academyAudio.wrong();
    }
  }

  return (
    <div>
      <p className="text-[11px] text-white/50 mb-1 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Défi pratique</p>
      <h3 className="text-base font-bold leading-snug">
        {step === "support" ? "Clique sur le niveau du SUPPORT (le plancher)" : step === "resistance" ? "Bien vu ! Maintenant clique sur la RÉSISTANCE (le plafond)" : "Support et résistance trouvés !"}
      </h3>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full mt-2 rounded-xl bg-slate-950 cursor-crosshair"
        onMouseMove={(e) => setHover(priceAt(e.clientY))}
        onMouseLeave={() => setHover(null)}
        onClick={click}
      >
        <path d={linePath(prices, prices.length, y)} fill="none" stroke="#38BDF8" strokeWidth="2.5" />
        {step !== "support" && <Level y={y(SUPPORT)} color="#22C55E" label={`support ${SUPPORT} $`} />}
        {step === "done" && <Level y={y(RESISTANCE)} color="#EF4444" label={`résistance ${RESISTANCE} $`} />}
        {miss !== null && <Level y={y(miss)} color="#F59E0B" label={`${miss.toFixed(1)} $ ✗`} dashed />}
        {hover !== null && step !== "done" && <Level y={y(hover)} color="#ffffff66" label={`${hover.toFixed(1)} $`} dashed />}
      </svg>
      {miss !== null && step !== "done" && (
        <Result ok={false} title="Pas ce niveau-là…">
          {step === "support"
            ? "Cherche le prix où la courbe a touché le bas et est repartie vers le haut plusieurs fois."
            : "Cherche le prix où la courbe a été repoussée vers le bas plusieurs fois."}
        </Result>
      )}
      {step === "done" && (
        <Result ok title="Parfait !">
          Le prix a rebondi 3 fois vers {SUPPORT} $ (les acheteurs reviennent) et a été repoussé 3 fois vers {RESISTANCE} $ (les vendeurs reviennent).
          Un bon réflexe : acheter près du support, avec un stop-loss juste en dessous.
        </Result>
      )}
    </div>
  );
}

function Level({ y, color, label, dashed }: { y: number; color: string; label: string; dashed?: boolean }) {
  return (
    <g>
      <line x1={0} x2={W} y1={y} y2={y} stroke={color} strokeWidth="2" strokeDasharray={dashed ? "6 5" : undefined} />
      <text x={W - 6} y={y - 5} fill={color} fontSize="12" fontWeight="700" textAnchor="end">{label}</text>
    </g>
  );
}

// ─── Forteresse du Risque : placer son stop-loss ─────────────────────────────────────────────

const SHARES = 4;
const ENTRY = 100;
const MAX_LOSS = 20;

function StopLossChallenge({ onPassed }: Done) {
  const path = useMemo(() => {
    const p: number[] = [];
    for (let i = 0; i < 14; i++) p.push(Math.max(97.6, 100 + 1.6 * Math.sin(i * 1.3) + 0.9 * Math.sin(i * 0.7)));
    const tail = waypoints([99, 94, 95.5, 86, 88, 74], 4, 0.5);
    return [...p, ...tail];
  }, []);
  const noiseLow = Math.min(...path.slice(0, 14));
  const y = scaleY(70, 104);
  const [stop, setStop] = useState(92);
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const [fails, setFails] = useState(0);
  const [passed, setPassed] = useState(false);

  const hit = path.findIndex((p) => p <= stop);
  const done = !running && shown >= path.length;
  const visible = path.slice(0, Math.max(1, shown));
  const stoppedAt = hit >= 0 && hit < shown ? hit : -1;
  const loss = (ENTRY - stop) * SHARES;

  useEffect(() => {
    if (!running) return;
    if (shown >= path.length || (hit >= 0 && shown > hit)) {
      setRunning(false);
      setShown(path.length);
      const ok = loss <= MAX_LOSS + 1e-9;
      if (ok) academyAudio.correct();
      else academyAudio.wrong();
      if (ok && !passed) {
        setPassed(true);
        onPassed(fails === 0);
      } else if (!ok) setFails((n) => n + 1);
      return;
    }
    const id = window.setTimeout(() => setShown((n) => n + 1), 160);
    return () => window.clearTimeout(id);
  }, [running, shown, path.length, hit, loss, passed, fails, onPassed]);

  const early = hit >= 0 && hit < 14;

  return (
    <div>
      <p className="text-[11px] text-white/50 mb-1 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Défi pratique</p>
      <h3 className="text-base font-bold leading-snug">Place ton stop-loss, puis lance le marché</h3>
      <p className="text-[12px] text-white/70 mt-1">
        Tu as 1 000 $ et tu achètes {SHARES} actions à {ENTRY} $. Règle des 2 % : tu ne dois pas perdre plus de {MAX_LOSS} $ sur ce trade.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2 rounded-xl bg-slate-950">
        <Level y={y(ENTRY)} color="#3B82F6" label={`entrée ${ENTRY} $`} dashed />
        <Level y={y(stop)} color="#EF4444" label={`stop ${stop.toFixed(1)} $`} />
        <path d={linePath(visible, path.length, y)} fill="none" stroke="#fff" strokeWidth="2.5" />
        {stoppedAt >= 0 && (
          <circle cx={PAD + (stoppedAt / (path.length - 1)) * (W - PAD * 2)} cy={y(stop)} r="7" fill="#EF4444" stroke="#fff" strokeWidth="2" />
        )}
      </svg>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={80}
          max={99.5}
          step={0.5}
          value={stop}
          disabled={running}
          onChange={(e) => { setStop(Number(e.target.value)); setShown(0); }}
          className="flex-1 accent-red-500"
          aria-label="Niveau du stop-loss"
        />
        <span className={`text-[12px] font-semibold w-44 text-right ${loss <= MAX_LOSS ? "text-emerald-300" : "text-red-300"}`}>
          perte max : {loss.toFixed(0)} $ ({((loss / 1000) * 100).toFixed(1)} %)
        </span>
      </div>
      <button
        onClick={() => { setShown(1); setRunning(true); }}
        disabled={running}
        className="mt-3 flex items-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-4 py-2"
      >
        {done ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />} {done ? "Rejouer" : "Lancer le marché"}
      </button>
      {done && loss > MAX_LOSS && (
        <Result ok={false} title={`Perte de ${loss.toFixed(0)} $ : c'est plus que ${MAX_LOSS} $`}>
          Ton stop est trop loin. Remonte-le pour que (100 − stop) × {SHARES} reste sous {MAX_LOSS} $, puis rejoue.
        </Result>
      )}
      {done && loss <= MAX_LOSS && early && (
        <Result ok title={`Réussi, perte limitée à ${loss.toFixed(0)} $… mais stop très serré`}>
          Tu as été sorti par le petit bruit normal du marché (il est descendu jusqu'à {noiseLow.toFixed(1)} $ sans raison particulière).
          Ici ça t'a protégé de la chute, mais souvent un stop trop serré te fait sortir juste avant une hausse.
          L'idéal : entre 95 $ et {noiseLow.toFixed(1)} $.
        </Result>
      )}
      {done && loss <= MAX_LOSS && !early && (
        <Result ok title={`Parfait : perte limitée à ${loss.toFixed(0)} $ au lieu de ${((ENTRY - path[path.length - 1]) * SHARES).toFixed(0)} $`}>
          Ton stop a laissé respirer le prix pendant les petites variations, puis il t'a sorti dès que la vraie chute a commencé.
          C'est exactement le rôle d'un stop-loss.
        </Result>
      )}
    </div>
  );
}

// ─── Volcan du Krach : mini-boss ─────────────────────────────────────────────────────────────

const TICKS = 100;
const TICK_MS = 250;
const START_SHARES = 10;
const FEE = 0.001;

function crashPrice(t: number) {
  if (t <= 10) return 100 + 0.15 * t;
  if (t <= 70) return 101.5 - 35.5 * Math.pow((t - 10) / 60, 0.9) + 2.2 * Math.sin(t * 0.9) * Math.min(1, (t - 10) / 6);
  return 66 + 12 * ((t - 70) / 30) + 1.5 * Math.sin(t * 0.8);
}

const HEADLINES: [number, string][] = [
  [0, "Marché calme. Ton plan : sortir si le portefeuille perd plus de 5 à 8 %."],
  [8, "Rumeurs de faillite d'une grande banque…"],
  [20, "Les indices perdent 8 % : panique sur les marchés"],
  [35, "Ventes massives, volatilité record"],
  [55, "Les banques centrales annoncent des mesures de soutien"],
  [72, "Premier rebond : les acheteurs reviennent"],
  [88, "Le marché reprend des couleurs"],
];

function CrashBoss({ onPassed }: Done) {
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [cash, setCash] = useState(0);
  const [shares, setShares] = useState(START_SHARES);
  const [fails, setFails] = useState(0);
  const [passed, setPassed] = useState(false);
  const [soldEarly, setSoldEarly] = useState(false);
  const prices = useMemo(() => Array.from({ length: TICKS + 1 }, (_, i) => crashPrice(i)), []);
  const price = prices[t];
  const value = cash + shares * price;
  const over = t >= TICKS;
  const y = scaleY(60, 106);

  useEffect(() => {
    if (!running) return;
    if (t === 12) academyAudio.rumble();
    if (t >= TICKS) {
      setRunning(false);
      if (value >= 900) {
        if (!passed) {
          setPassed(true);
          onPassed(fails === 0);
        }
      } else setFails((n) => n + 1);
      return;
    }
    const id = window.setTimeout(() => setT((n) => n + 1), TICK_MS);
    return () => window.clearTimeout(id);
  }, [running, t, value, passed, fails, onPassed]);

  function sell() {
    const q = Math.min(shares, START_SHARES / 4);
    if (q <= 0) return;
    academyAudio.coin();
    setShares((s) => s - q);
    setCash((c) => c + q * price * (1 - FEE));
    if (price >= 99 && shares - q <= 0) setSoldEarly(true);
  }
  function buy() {
    const q = Math.min(START_SHARES / 4, cash / (price * (1 + FEE)));
    if (q <= 0.0001) return;
    academyAudio.coin();
    setShares((s) => s + q);
    setCash((c) => c - q * price * (1 + FEE));
  }
  function restart() {
    setT(0);
    setCash(0);
    setShares(START_SHARES);
    setSoldEarly(false);
    setRunning(true);
  }

  const headline = [...HEADLINES].reverse().find(([at]) => t >= at)?.[1] ?? "";
  const dd = (value / 1000 - 1) * 100;
  const holdValue = START_SHARES * prices[TICKS];

  return (
    <div>
      <p className="text-[11px] text-white/50 mb-1 flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-400" /> Boss final</p>
      <h3 className="text-base font-bold leading-snug">Survis au krach : termine au-dessus de 900 $ (−10 %)</h3>
      <p className="text-[12px] text-white/70 mt-1">Tu as 1 000 $ investis (10 parts à 100 $). Vends pour mettre ton argent à l'abri, rachète quand la tempête se calme. Frais de 0,1 % par ordre.</p>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-white/60 mb-0.5">Ton capital : {value.toFixed(0)} $ ({dd >= 0 ? "+" : ""}{dd.toFixed(1)} %)</p>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full transition-all ${value >= 900 ? "bg-emerald-400" : "bg-red-500"}`} style={{ width: `${Math.min(100, (value / 1000) * 100)}%` }} />
          </div>
        </div>
        <div>
          <p className="text-white/60 mb-0.5">Krach : {Math.ceil(((TICKS - t) * TICK_MS) / 1000)} s restantes</p>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-orange-500 transition-all" style={{ width: `${((TICKS - t) / TICKS) * 100}%` }} />
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2 rounded-xl bg-slate-950">
        <Level y={y(100)} color="#3B82F6" label="100 $" dashed />
        <path d={linePath(prices.slice(0, t + 1), TICKS + 1, y)} fill="none" stroke={price < 95 ? "#EF4444" : "#fff"} strokeWidth="2.5" />
        <text x={10} y={20} fill="#FBBF24" fontSize="12" fontWeight="700">📰 {headline}</text>
        <text x={10} y={H - 10} fill="#fff" fontSize="12">prix {price.toFixed(1)} $ · {shares.toFixed(1)} parts · cash {cash.toFixed(0)} $</text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-2">
        {!running && !over && t === 0 && (
          <button onClick={() => setRunning(true)} className="flex items-center gap-1.5 text-sm font-semibold bg-orange-600 hover:bg-orange-500 rounded-lg px-4 py-2">
            <Play className="w-4 h-4" /> Affronter le krach
          </button>
        )}
        {running && (
          <>
            <button onClick={sell} disabled={shares <= 0} className="text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-lg px-4 py-2">Vendre 25 %</button>
            <button onClick={buy} disabled={cash <= 1} className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg px-4 py-2">Racheter 25 %</button>
          </>
        )}
        {over && (
          <button onClick={restart} className="flex items-center gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/20 rounded-lg px-4 py-2">
            <RotateCcw className="w-4 h-4" /> Rejouer
          </button>
        )}
      </div>

      {over && value >= 900 && (
        <Result ok title={`Krach vaincu ! Capital final : ${value.toFixed(0)} $`}>
          Sans rien faire, tu aurais fini à {holdValue.toFixed(0)} $ ({((holdValue / 1000 - 1) * 100).toFixed(0)} %).
          {soldEarly
            ? " Tu as tout vendu avant la moindre baisse : ici ça marche, mais dans la vraie vie on ne sait pas qu'un krach arrive. Ton plan doit dire QUAND sortir (par exemple à −5 %), pas sortir au hasard."
            : " Tu as réagi selon un plan au lieu de paniquer ou d'espérer : c'est ce qui sépare les traders qui durent des autres."}
        </Result>
      )}
      {over && value < 900 && (
        <Result ok={false} title={`Le krach a gagné : ${value.toFixed(0)} $ (${dd.toFixed(0)} %)`}>
          Indice : vends une partie dès que le portefeuille passe sous −5 % (prix vers 95 $), garde du cash pendant la chute,
          et rachète quand les nouvelles et le prix montrent un rebond.
        </Result>
      )}
    </div>
  );
}

// ─── Salle des Experts : taille de position ──────────────────────────────────────────────────

const SIZING = [
  { risk: 20, entry: 80, stop: 76 },
  { risk: 50, entry: 120, stop: 115 },
  { risk: 30, entry: 25, stop: 24 },
];

function SizingChallenge({ onPassed }: Done) {
  const [answers, setAnswers] = useState<string[]>(SIZING.map(() => ""));
  const [checked, setChecked] = useState(false);
  const [fails, setFails] = useState(0);
  const [passed, setPassed] = useState(false);
  const right = SIZING.map((s, i) => Number(answers[i]) === s.risk / (s.entry - s.stop));

  function check() {
    setChecked(true);
    if (right.every(Boolean)) {
      academyAudio.correct();
      if (!passed) {
        setPassed(true);
        onPassed(fails === 0);
      }
    } else {
      setFails((n) => n + 1);
      academyAudio.wrong();
    }
  }

  return (
    <div>
      <p className="text-[11px] text-white/50 mb-1 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Défi d'expert</p>
      <h3 className="text-base font-bold leading-snug">Combien d'actions acheter ?</h3>
      <p className="text-[12px] text-white/70 mt-1">Quantité = risque accepté ÷ (prix d'entrée − stop).</p>
      <div className="mt-3 space-y-2">
        {SIZING.map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2">
            <p className="flex-1 text-[13px]">Risque {s.risk} $ · entrée {s.entry} $ · stop {s.stop} $</p>
            <input
              inputMode="numeric"
              value={answers[i]}
              onChange={(e) => { const a = [...answers]; a[i] = e.target.value.replace(/[^0-9.]/g, ""); setAnswers(a); setChecked(false); }}
              className="w-20 rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-sm text-right"
              aria-label={`Quantité ${i + 1}`}
            />
            {checked && (right[i] ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <span className="text-red-300 text-xs w-4">✗</span>)}
          </div>
        ))}
      </div>
      <button onClick={check} className="mt-3 text-sm font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2">Vérifier</button>
      {checked && right.every(Boolean) && (
        <Result ok title="Calcul de pro !">Plus le stop est proche, plus tu peux acheter d'actions pour le même risque en dollars.</Result>
      )}
      {checked && !right.every(Boolean) && (
        <Result ok={false} title="Pas encore">Exemple : risque 20 $, entrée 80 $, stop 76 $ → 20 ÷ 4 = 5 actions.</Result>
      )}
    </div>
  );
}
