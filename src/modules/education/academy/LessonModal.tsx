import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Lightbulb, Sparkles, X, XCircle } from "lucide-react";
import { CHALLENGE_XP, type Station } from "./lessons";
import LessonVisual from "./Visuals";
import ChallengeView from "./Challenges";
import { academyAudio } from "./audio";

interface Props {
  station: Station;
  alreadyDone: boolean;
  onClose: () => void;
  /** station terminee : erreurs au quiz et resultat du defi (null s'il n'y en a pas) */
  onComplete: (mistakes: number, challengeFirstTry: boolean | null) => void;
}

/** XP gagnee : -15 % par erreur, au moins la moitie. */
export function xpFor(station: Station, mistakes: number, challengeFirstTry: boolean | null = null) {
  const base = Math.max(Math.round(station.xp / 2), Math.round(station.xp * (1 - 0.15 * mistakes)));
  const bonus = challengeFirstTry === null ? 0 : challengeFirstTry ? CHALLENGE_XP : CHALLENGE_XP / 2;
  return base + bonus;
}

/** Pop-up de lecon facon jeu : fiches illustrees, puis mini-quiz avec explication de chaque reponse. */
export default function LessonModal({ station, alreadyDone, onClose, onComplete }: Props) {
  const [phase, setPhase] = useState<"slides" | "quiz" | "challenge" | "done">("slides");
  const [challengeOk, setChallengeOk] = useState<boolean | null>(null);
  const [slide, setSlide] = useState(0);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);

  const s = station;
  const q = s.quiz[qi];
  const correct = picked !== null && picked === q?.correct;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (phase === "slides" && e.key === "ArrowRight") next();
      if (phase === "slides" && e.key === "ArrowLeft") setSlide((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // son d'entree dans le batiment ; musique calme pendant la lecon, musique de boss pour le krach
  useEffect(() => {
    academyAudio.enter();
    academyAudio.setMood("lesson");
  }, []);
  useEffect(() => {
    academyAudio.setMood(phase === "challenge" && s.challenge === "crash" ? "boss" : "lesson");
  }, [phase, s.challenge]);

  function next() {
    academyAudio.pageTurn();
    if (slide < s.slides.length - 1) setSlide(slide + 1);
    else setPhase("quiz");
  }

  function pick(i: number) {
    if (correct) return;
    setPicked(i);
    if (i !== q.correct) {
      setMistakes((m) => m + 1);
      academyAudio.wrong();
    } else academyAudio.correct();
  }

  function nextQuestion() {
    if (qi < s.quiz.length - 1) {
      setQi(qi + 1);
      setPicked(null);
    } else if (s.challenge) {
      setPhase("challenge");
    } else {
      setPhase("done");
      onComplete(mistakes, null);
    }
  }

  function finishChallenge() {
    setPhase("done");
    onComplete(mistakes, challengeOk);
  }

  const steps = s.slides.length + s.quiz.length + (s.challenge ? 1 : 0);
  const stepNow = phase === "slides" ? slide : phase === "quiz" ? s.slides.length + qi : phase === "challenge" ? steps - 1 : steps;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-3" role="dialog" aria-modal="true" aria-label={s.place}>
      <div className={`w-full ${phase === "challenge" ? "max-w-2xl" : "max-w-xl"} rounded-2xl max-h-full overflow-y-auto shadow-2xl border border-white/10 bg-slate-900 text-white`} style={{ animation: "academyPop .25s ease-out" }}>
        <div className="px-5 py-3 flex items-center gap-3" style={{ background: `linear-gradient(90deg, ${s.color}, ${s.color}99)` }}>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-white/85 font-semibold">{s.place}</p>
            <p className="text-base font-bold truncate">{s.topic}</p>
          </div>
          <span className="text-[11px] font-bold bg-black/25 rounded-full px-2.5 py-1">+{s.xp + (s.challenge ? CHALLENGE_XP : 0)} XP</span>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-black/20 flex items-center justify-center" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-1 bg-white/10">
          <div className="h-1 bg-amber-400 transition-all" style={{ width: `${(stepNow / steps) * 100}%` }} />
        </div>

        <div className="p-5">
          {phase === "slides" && (
            <div key={slide} style={{ animation: "academyFade .25s ease-out" }}>
              <p className="text-[11px] text-white/50 mb-1">Fiche {slide + 1} / {s.slides.length}</p>
              <h3 className="text-lg font-bold mb-2">{s.slides[slide].title}</h3>
              {s.slides[slide].visual && <div className="mb-3"><LessonVisual kind={s.slides[slide].visual!} /></div>}
              <p className="text-sm leading-relaxed text-white/85">{s.slides[slide].text}</p>
              {s.slides[slide].tip && (
                <div className="mt-3 flex gap-2 items-start rounded-xl bg-amber-400/15 border border-amber-400/30 px-3 py-2.5">
                  <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <p className="text-[13px] font-medium text-amber-100">{s.slides[slide].tip}</p>
                </div>
              )}
              <div className="mt-5 flex items-center justify-between">
                <button onClick={() => setSlide(Math.max(0, slide - 1))} disabled={slide === 0} className="flex items-center gap-1 text-sm text-white/70 disabled:opacity-30 hover:text-white">
                  <ChevronLeft className="w-4 h-4" /> Précédent
                </button>
                <div className="flex gap-1.5">
                  {s.slides.map((_, i) => <span key={i} className={`w-2 h-2 rounded-full ${i === slide ? "bg-amber-400" : "bg-white/25"}`} />)}
                </div>
                <button onClick={next} className="flex items-center gap-1 text-sm font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2">
                  {slide < s.slides.length - 1 ? "Suivant" : "Passer au quiz"} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {phase === "quiz" && q && (
            <div key={qi} style={{ animation: "academyFade .25s ease-out" }}>
              <p className="text-[11px] text-white/50 mb-1">Question {qi + 1} / {s.quiz.length}</p>
              <h3 className="text-base font-bold mb-3 leading-snug">{q.q}</h3>
              <div className="space-y-2">
                {q.options.map((o, i) => {
                  const state = picked === null ? "idle" : i === q.correct && correct ? "good" : i === picked ? "bad" : "idle";
                  return (
                    <button
                      key={i}
                      onClick={() => pick(i)}
                      disabled={correct}
                      className={`w-full text-left text-sm rounded-xl border px-3.5 py-2.5 transition-colors flex items-center gap-2 ${
                        state === "good" ? "border-emerald-400 bg-emerald-500/20" : state === "bad" ? "border-red-400 bg-red-500/15" : "border-white/15 hover:border-blue-400 hover:bg-blue-500/10"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-md bg-white/10 text-[11px] font-bold flex items-center justify-center shrink-0">{String.fromCharCode(65 + i)}</span>
                      <span className="flex-1">{o}</span>
                      {state === "good" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {state === "bad" && <XCircle className="w-4 h-4 text-red-400" />}
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <div className={`mt-3 rounded-xl px-3 py-2.5 text-[13px] ${correct ? "bg-emerald-500/15 text-emerald-100" : "bg-red-500/15 text-red-100"}`}>
                  <p className="font-semibold mb-0.5">{correct ? "Bonne réponse !" : "Pas tout à fait… réessaie."}</p>
                  {correct ? <p>{q.explain}</p> : <p>Relis la question : un indice se trouve dans les fiches que tu viens de lire.</p>}
                </div>
              )}
              <div className="mt-4 flex justify-between items-center">
                <button onClick={() => { setPhase("slides"); setSlide(0); }} className="text-sm text-white/60 hover:text-white">Revoir les fiches</button>
                {correct && (
                  <button onClick={nextQuestion} className="flex items-center gap-1 text-sm font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2">
                    {qi < s.quiz.length - 1 ? "Question suivante" : "Terminer"} <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {phase === "challenge" && s.challenge && (
            <div style={{ animation: "academyFade .25s ease-out" }}>
              <ChallengeView kind={s.challenge} onPassed={(first) => setChallengeOk((v) => v ?? first)} />
              {challengeOk !== null && (
                <div className="mt-4 flex justify-end">
                  <button onClick={finishChallenge} className="flex items-center gap-1 text-sm font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2">
                    Terminer la station <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === "done" && (
            <div className="text-center py-3" style={{ animation: "academyPop .3s ease-out" }}>
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-400/20 flex items-center justify-center mb-3">
                <Sparkles className="w-8 h-8 text-amber-300" />
              </div>
              <h3 className="text-xl font-bold">Station réussie !</h3>
              <p className="text-sm text-white/75 mt-1">
                {mistakes === 0 ? "Sans aucune erreur, bravo !" : `${mistakes} erreur${mistakes > 1 ? "s" : ""} — tu as quand même compris l'essentiel.`}
              </p>
              {challengeOk !== null && (
                <p className="text-[13px] text-white/75 mt-1">
                  Défi pratique réussi {challengeOk ? "du premier coup : bonus complet !" : "après plusieurs essais : demi-bonus."}
                </p>
              )}
              <p className="text-2xl font-extrabold text-amber-300 mt-3">
                {alreadyDone ? "Révision terminée" : `+${xpFor(s, mistakes, challengeOk)} XP`}
              </p>
              <button onClick={onClose} className="mt-5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg px-5 py-2.5">
                Retourner sur la carte
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
