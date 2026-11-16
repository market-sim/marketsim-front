import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Check, RotateCcw, Star, Trophy, Wallet } from "lucide-react";
import { progressionApi } from "../api/endpoints";
import { errorMessage } from "../api/client";
import { DISPLAY, MONO } from "../shared/ui";
import { LEVEL_COLOR, LEVEL_LABEL, money, useProgression } from "./ProgressionContext";

const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Badge du header : niveau + portefeuille ; un clic ouvre le detail (conditions du niveau suivant, difficulte). */
export default function LevelBadge() {
  const { progression: p, update } = useProgression();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!p) return null;
  const color = LEVEL_COLOR[p.level];
  const gain = p.balance / p.startBalance - 1;

  const restart = async (force: boolean) => {
    if (force && !window.confirm("Recommencer à 100 000 $ au niveau Débutant ? Ton portefeuille actuel sera remis à zéro.")) return;
    setBusy(true);
    setError("");
    try {
      update(await progressionApi.restart(force));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/60 ${p.bankrupt ? "border-red-400 animate-pulse" : "border-border/60"}`}
        title="Ton niveau de trader et ton portefeuille">
        <span className="flex items-center gap-1 font-semibold" style={{ color }}>
          <Trophy className="w-3.5 h-3.5" />{LEVEL_LABEL[p.level]}
        </span>
        <span className="h-4 w-px bg-border" />
        <span className={`flex items-center gap-1 font-semibold ${p.bankrupt ? "text-red-500" : "text-foreground"}`} style={MONO}>
          <Wallet className="w-3.5 h-3.5 text-muted-foreground" />{money(p.balance)}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] rounded-xl border border-border bg-card p-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5" style={{ color }} />
            <div>
              <p className="text-sm font-semibold text-foreground" style={DISPLAY}>Niveau {LEVEL_LABEL[p.level]}</p>
              <p className="text-[11px] text-muted-foreground">
                Difficulté : {p.difficulty.label}{" "}
                {Array.from({ length: 4 }, (_, i) => (
                  <Star key={i} className={`inline w-3 h-3 -mt-0.5 ${i < p.difficulty.stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                ))}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-lg bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Portefeuille</p>
              <p className={`text-base font-semibold ${gain >= 0 ? "text-emerald-500" : "text-red-500"}`} style={MONO}>{money(p.balance)}</p>
              <p className="text-[10px] text-muted-foreground">{gain >= 0 ? "+" : ""}{pct(gain)} depuis {money(p.startBalance)}</p>
            </div>
            <div className="rounded-lg bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Compétence</p>
              <p className="text-base font-semibold text-foreground" style={MONO}>{p.skillScore} / 100</p>
              <p className="text-[10px] text-muted-foreground">{p.games} parties · {p.trades} trades</p>
            </div>
          </div>
          {p.trades > 0 && (
            <p className="text-[10.5px] text-muted-foreground mt-2" style={MONO}>
              Réussite {pct(p.winRate)} · gains/pertes {p.profitFactor.toFixed(1)} · discipline stop {pct(p.discipline)} · baisse moy. {pct(p.avgMaxDrawdown)}
            </p>
          )}

          {p.bankrupt ? (
            <div className="mt-3 rounded-lg bg-red-500/10 p-3">
              <p className="text-[12px] font-semibold text-red-500">Portefeuille vide</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Tu ne peux plus jouer avec ce solde. Recommence avec 100 000 $ au niveau Débutant : tu gardes ce que tu as appris.</p>
              <button onClick={() => restart(false)} disabled={busy}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60">
                <RotateCcw className="w-3.5 h-3.5" />Recommencer avec 100 000 $
              </button>
            </div>
          ) : p.nextLevel ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-foreground mb-1.5">Pour passer {LEVEL_LABEL[p.nextLevel]}</p>
              <div className="space-y-1.5">
                {p.nextGoals.map((g) => (
                  <div key={g.key}>
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className={`flex items-center gap-1 ${g.done ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {g.done && <Check className="w-3 h-3" />}{g.label}
                      </span>
                      <span className="text-foreground" style={MONO}>
                        {g.key === "balance" ? money(g.current) : g.current} / {g.key === "balance" ? money(g.target) : g.target}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted mt-0.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (g.current / Math.max(1e-9, g.target)) * 100)}%`, background: g.done ? "#22C55E" : color }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Si tu perds de l'argent par rapport à 100 000 $, tu restes Débutant.</p>
            </div>
          ) : (
            <p className="mt-3 text-[11.5px] text-amber-500 font-semibold">Niveau maximum atteint. Garde-le : une mauvaise série te fait redescendre.</p>
          )}

          <p className="text-[10.5px] text-muted-foreground mt-3 border-t border-border/60 pt-2">{p.difficulty.summary}</p>
          {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => { setOpen(false); navigate("/agent?play=1"); }}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
              Jouer une partie
            </button>
            {!p.bankrupt && (
              <button onClick={() => restart(true)} disabled={busy} className="text-[11px] text-muted-foreground hover:text-foreground">Recommencer à zéro</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
