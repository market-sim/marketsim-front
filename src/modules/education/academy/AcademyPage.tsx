import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, Award, Compass, Gamepad2, Keyboard, Lock, Map as MapIcon, Maximize2, MessageCircle, Minimize2, RotateCcw, Star, Volume2, VolumeX, X } from "lucide-react";
import { academyApi, type AcademyAdvice } from "../../../api/endpoints";
import { useAuth } from "../../../auth/AuthContext";
import { MAIN_STATIONS, STATIONS, TOTAL_XP, rankFor, type Station } from "./lessons";
import World3D, { START, type PlayerState, type StationStatus } from "./World3D";
import MiniMap from "./MiniMap";
import LessonModal, { xpFor } from "./LessonModal";
import MentorChat from "./MentorChat";
import { academyAudio, loadSound, type SoundSettings } from "./audio";

interface Progress {
  done: Record<string, { xp: number; mistakes: number; at: string; challenge?: boolean | null }>;
  tutorialDone: boolean;
  /** la decouverte de la salle secrete a deja ete annoncee */
  secretSeen?: boolean;
}

const EMPTY: Progress = { done: {}, tutorialDone: false };

function load(key: string): Progress {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Progress;
    return { done: p.done ?? {}, tutorialDone: !!p.tutorialDone, secretSeen: !!p.secretSeen };
  } catch {
    return EMPTY;
  }
}

function save(key: string, p: Progress) {
  try {
    localStorage.setItem(key, JSON.stringify(p));
  } catch {
    /* stockage indisponible : la progression reste en memoire */
  }
}

const TUTORIAL = [
  { title: "Bienvenue à l'Académie !", text: "Je suis Max, ton mentor. Sur cette île, chaque bâtiment t'apprend une notion de trading. Termine-les tous pour obtenir ton diplôme. Monte le son 🎵 : l'île a sa propre musique !" },
  { title: "Se déplacer", text: "Utilise Z Q S D (ou W A S D, ou les flèches). Tu peux aussi cliquer sur le sol pour y marcher. Glisse avec la souris pour tourner la caméra, molette pour zoomer." },
  { title: "La mini-map", text: "En haut à droite : la flèche bleue, c'est toi. Le point doré qui clignote, c'est ta prochaine mission. Clique sur la carte pour t'y rendre. Appuie sur M pour la grande carte." },
  { title: "Max, ton mentor IA", text: "Appuie sur T (ou le bouton orange) pour me poser n'importe quelle question. Je regarde aussi tes vraies parties du Jeu de trading : les bâtiments que tu dois revoir clignotent en rouge, et certains défis cachent même une zone secrète…" },
  { title: "Ta première mission", text: "Suis le losange doré jusqu'à la Place du Marché. Quand tu es devant, appuie sur E (ou clique sur « Entrer ») pour commencer la leçon." },
];

type Toast = { title: string; text: string } | null;

/** Academie du trading : monde 3D a explorer, une lecon + un quiz par batiment. */
export default function AcademyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const storageKey = `marketsim.academy.v1.${user?.id ?? "invite"}`;
  const [progress, setProgress] = useState<Progress>(() => load(storageKey));
  const [near, setNear] = useState<string | null>(null);
  const [open, setOpen] = useState<Station | null>(null);
  const [tutorial, setTutorial] = useState<number | null>(() => (load(storageKey).tutorialDone ? null : 0));
  const [toast, setToast] = useState<Toast>(null);
  const [bigMap, setBigMap] = useState(false);
  const [help, setHelp] = useState(false);
  const [webglError, setWebglError] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [diploma, setDiploma] = useState(false);
  const [advice, setAdvice] = useState<AcademyAdvice | null>(null);
  const [mentor, setMentor] = useState(false);
  const [showReco, setShowReco] = useState(true);
  const [sound, setSound] = useState<SoundSettings>(() => loadSound());
  const [soundPanel, setSoundPanel] = useState(false);
  const [confetti, setConfetti] = useState(0);

  // le son demarre a la premiere interaction (regle des navigateurs) et s'arrete en quittant la page
  useEffect(() => {
    const unlock = () => academyAudio.start();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      academyAudio.stop();
    };
  }, []);
  useEffect(() => academyAudio.configure(sound), [sound]);
  const frameRef = useRef<HTMLDivElement>(null);
  const player = useRef<PlayerState>({ x: START.x, z: START.z, heading: Math.PI, cameraYaw: 0, target: null, moving: false }).current;

  useEffect(() => setProgress(load(storageKey)), [storageKey]);
  // le jeu occupe tout l'ecran visible des l'ouverture
  useEffect(() => {
    // deux fois : les bandeaux au-dessus (guide, e-mail) se chargent apres le premier affichage
    const ids = [300, 1200].map((ms) => window.setTimeout(() => frameRef.current?.scrollIntoView({ block: "start" }), ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);
  useEffect(() => save(storageKey, progress), [storageKey, progress]);

  // parcours personnalise : calcule par le serveur a partir des vraies parties du Jeu de trading
  useEffect(() => {
    academyApi.advice().then(setAdvice).catch(() => setAdvice(null));
  }, []);

  const statuses = useMemo(() => {
    const out: Record<string, StationStatus> = {};
    MAIN_STATIONS.forEach((s, i) => {
      out[s.id] = progress.done[s.id] ? "done" : i === 0 || progress.done[MAIN_STATIONS[i - 1].id] ? "open" : "locked";
    });
    STATIONS.filter((s) => s.secret).forEach((s) => {
      out[s.id] = progress.done[s.id] ? "done" : advice?.secretUnlocked ? "open" : "hidden";
    });
    return out;
  }, [progress, advice]);

  // carillon en arrivant devant un batiment
  useEffect(() => {
    if (near && statuses[near] !== "hidden") academyAudio.chime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  // annonce unique de la salle secrete
  useEffect(() => {
    if (advice?.secretUnlocked && !progress.secretSeen) {
      academyAudio.fanfare();
      setToast({ title: "Zone secrète débloquée !", text: `Tu as battu l'agent IA ${advice.beatAgent} fois : la Salle des Experts est apparue sur l'île (★ sur la mini-map).` });
      setProgress((p) => ({ ...p, secretSeen: true }));
    }
  }, [advice, progress.secretSeen]);

  const quest = MAIN_STATIONS.find((s) => statuses[s.id] === "open") ?? null;
  const xp = Object.values(progress.done).reduce((n, d) => n + d.xp, 0);
  const doneCount = MAIN_STATIONS.filter((s) => progress.done[s.id]).length;
  const graduated = doneCount === MAIN_STATIONS.length;
  const recos = (advice?.recommendations ?? []).filter((r) => statuses[r.stationId] && statuses[r.stationId] !== "hidden");
  const recommended = recos.filter((r) => r.priority !== "LOW" && statuses[r.stationId] !== "locked").map((r) => r.stationId);
  const nameOf = (id: string) => STATIONS.find((s) => s.id === id)?.place ?? id;
  const nearStation = STATIONS.find((s) => s.id === near) ?? null;
  const paused = !!open || bigMap || diploma || (tutorial !== null && tutorial < TUTORIAL.length);

  // distance jusqu'a la mission (rafraichie 4 fois par seconde)
  useEffect(() => {
    const id = window.setInterval(() => {
      setDistance(quest ? Math.round(Math.hypot(player.x - quest.x, player.z - quest.z)) : null);
    }, 250);
    return () => window.clearInterval(id);
  }, [quest, player]);

  const enter = useCallback(() => {
    const s = STATIONS.find((st) => st.id === near);
    if (!s || statuses[s.id] === "locked" || statuses[s.id] === "hidden") return;
    setOpen(s);
  }, [near, statuses]);

  // raccourcis : M = carte, H = aide
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (open) return;
      const k = e.key.toLowerCase();
      if (k === "m") setBigMap((v) => !v);
      if (k === "h") setHelp((v) => !v);
      if (k === "t") setMentor((v) => !v);
      if (k === "escape") {
        setBigMap(false);
        setHelp(false);
        setMentor(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen?.();
  }

  function finishTutorial() {
    setTutorial(null);
    setProgress((p) => ({ ...p, tutorialDone: true }));
  }

  function complete(station: Station, mistakes: number, challenge: boolean | null) {
    if (progress.done[station.id]) return; // revision : pas d'XP en plus
    const gained = xpFor(station, mistakes, challenge);
    academyAudio.success();
    setConfetti((n) => n + 1);
    const next = { ...progress, done: { ...progress.done, [station.id]: { xp: gained, mistakes, challenge, at: new Date().toISOString() } } };
    setProgress(next);
    if (station.secret) {
      setToast({ title: `+${gained} XP · ${station.place} terminée`, text: "Tu maîtrises les techniques de pro. Applique-les dans le Jeu de trading !" });
      return;
    }
    const idx = MAIN_STATIONS.findIndex((s) => s.id === station.id);
    const unlocked = MAIN_STATIONS[idx + 1];
    if (unlocked) {
      window.setTimeout(() => academyAudio.fanfare(), 900);
      setToast({ title: `+${gained} XP · ${station.place} terminé`, text: `Nouvelle zone débloquée : ${unlocked.place}. Suis le losange doré !` });
    }
  }

  function closeLesson() {
    const wasLast = open && open.id === MAIN_STATIONS[MAIN_STATIONS.length - 1].id && progress.done[open.id];
    setOpen(null);
    academyAudio.setMood("explore");
    if (wasLast && graduated) {
      setDiploma(true);
      academyAudio.fanfare();
    }
  }

  function goTo(id: string) {
    const s = STATIONS.find((st) => st.id === id);
    if (!s) return;
    const len = Math.hypot(s.x, s.z) || 1;
    player.target = { x: s.x - (s.x / len) * 6.2, z: s.z - (s.z / len) * 6.2 };
  }

  // ce que le mentor sait de la progression dans le jeu
  const mentorContext = [
    `Stations terminées : ${doneCount}/${MAIN_STATIONS.length}, XP ${xp}.`,
    ...STATIONS.filter((s) => progress.done[s.id]).map((s) => {
      const d = progress.done[s.id];
      return `- ${s.place} (${s.topic}) : ${d.mistakes} erreur(s) au quiz${d.challenge === undefined || d.challenge === null ? "" : d.challenge ? ", défi réussi du premier coup" : ", défi réussi après plusieurs essais"}.`;
    }),
    quest ? `Mission actuelle : ${quest.place} (${quest.topic}).` : "Parcours principal terminé.",
    near ? `L'élève se trouve devant : ${nameOf(near)}.` : "",
  ].filter(Boolean).join("\n");

  function reset() {
    if (!window.confirm("Recommencer l'Académie depuis le début ? Ton XP de l'Académie sera remise à zéro.")) return;
    setProgress(EMPTY);
    setTutorial(0);
    player.x = START.x;
    player.z = START.z;
    player.target = null;
  }

  const showTutorial = tutorial !== null && tutorial < TUTORIAL.length;

  return (
    <div
      ref={frameRef}
      className={`relative overflow-hidden select-none bg-sky-300 ${fullscreen ? "" : "rounded-2xl border border-border/60 shadow-sm"}`}
      style={{ height: fullscreen ? "100vh" : "calc(100vh - 130px)", minHeight: 540 }}
    >
      <style>{`
        @keyframes academyPop { from { transform: scale(.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes academyFade { from { transform: translateY(6px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes academyBounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
      `}</style>

      {!webglError && (
        <World3D
          stations={STATIONS}
          statuses={statuses}
          questId={quest?.id ?? null}
          recommended={recommended}
          player={player}
          paused={paused}
          onNear={setNear}
          onInteract={enter}
          onError={setWebglError}
          onStep={() => academyAudio.footstep()}
          onNpcTalk={() => academyAudio.pop()}
        />
      )}

      {webglError && (
        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-4 p-4 text-white">
          <p className="text-sm text-white/80 text-center max-w-md">{webglError} Clique sur une station débloquée pour ouvrir sa leçon.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-3xl w-full">
            {STATIONS.filter((s) => statuses[s.id] !== "hidden").map((s, i) => (
              <button
                key={s.id}
                disabled={statuses[s.id] === "locked"}
                onClick={() => setOpen(s)}
                className="rounded-xl p-3 text-left border border-white/10 disabled:opacity-40"
                style={{ background: `${s.color}33` }}
              >
                <p className="text-[11px] text-white/60">{i + 1}. {s.place}</p>
                <p className="text-sm font-semibold">{statuses[s.id] === "done" ? "✓ " : statuses[s.id] === "locked" ? "🔒 " : ""}{s.topic}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* HUD haut gauche : rang, XP, mission */}
      <div className="absolute top-3 left-3 z-10 w-[min(320px,calc(100%-220px))] min-w-[220px] space-y-2">
        <div className="rounded-xl bg-slate-900/80 backdrop-blur text-white px-3.5 py-2.5 shadow-lg">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-300" />
            <p className="text-sm font-bold flex-1">{rankFor(graduated ? TOTAL_XP : Math.min(xp, TOTAL_XP - 1))}</p>
            <span className="text-[11px] text-white/70">{doneCount}/{MAIN_STATIONS.length} stations</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/15 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-700" style={{ width: `${Math.min(100, (xp / TOTAL_XP) * 100)}%` }} />
          </div>
          <p className="text-[10px] text-white/60 mt-1">{xp} / {TOTAL_XP} XP</p>
        </div>
        <div className="rounded-xl bg-slate-900/80 backdrop-blur text-white px-3.5 py-2.5 shadow-lg">
          <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1"><Star className="w-3 h-3" /> Mission</p>
          {quest ? (
            <>
              <p className="text-sm font-semibold mt-0.5">Va à « {quest.place} »</p>
              <p className="text-[11px] text-white/70">{quest.topic}{distance !== null ? ` · ${distance} m` : ""}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold mt-0.5">Académie terminée !</p>
              <button onClick={() => navigate("/agent?play=1")} className="mt-1.5 text-[12px] font-semibold text-amber-300 hover:underline">
                Passe à la pratique dans le jeu de trading →
              </button>
            </>
          )}
        </div>
        {recos.length > 0 && (
          <div className="rounded-xl bg-slate-900/80 backdrop-blur text-white px-3.5 py-2.5 shadow-lg border border-red-400/30">
            <button onClick={() => setShowReco((v) => !v)} className="w-full text-left text-[10px] uppercase tracking-wider text-red-300 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Conseillé pour toi
              <span className="ml-auto normal-case tracking-normal text-white/50 font-normal">{advice?.games ? `d'après tes ${advice.games} partie${advice.games > 1 ? "s" : ""}` : "aucune partie jouée"}</span>
            </button>
            {showReco && (
              <div className="mt-1.5 space-y-1.5">
                {recos.slice(0, 3).map((r) => (
                  <button key={r.stationId} onClick={() => goTo(r.stationId)} className="block w-full text-left rounded-lg hover:bg-white/10 px-1.5 py-1 -mx-1.5" title="Clique pour y aller">
                    <p className="text-[12px] font-semibold">
                      {nameOf(r.stationId)}
                      {statuses[r.stationId] === "locked" && <span className="text-white/45 font-normal"> · se débloquera plus tard</span>}
                    </p>
                    <p className="text-[11px] text-white/65 leading-snug">{r.reasons[0]}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* HUD haut droite : mini-map et boutons */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <div className="rounded-full p-1 bg-slate-900/80 shadow-lg ring-2 ring-white/30">
          <MiniMap stations={STATIONS} statuses={statuses} questId={quest?.id ?? null} recommended={recommended} player={player} size={170} />
        </div>
        <div className="flex gap-1.5">
          <HudButton label="Parler à Max (T)" onClick={() => setMentor((v) => !v)} highlight><MessageCircle className="w-4 h-4" /></HudButton>
          <HudButton label="Carte (M)" onClick={() => setBigMap(true)}><MapIcon className="w-4 h-4" /></HudButton>
          <HudButton label="Son et musique" onClick={() => { academyAudio.start(); setSoundPanel((v) => !v); }}>
            {sound.music || sound.sfx || sound.ambience ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </HudButton>
          <HudButton label="Commandes (H)" onClick={() => setHelp((v) => !v)}><Keyboard className="w-4 h-4" /></HudButton>
          <HudButton label={fullscreen ? "Quitter le plein écran" : "Plein écran"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </HudButton>
          <HudButton label="Recommencer" onClick={reset}><RotateCcw className="w-4 h-4" /></HudButton>
        </div>
      </div>

      {soundPanel && (
        <div className="absolute top-[230px] right-3 z-20 w-64 rounded-xl bg-slate-900/95 text-white p-3.5 text-[12px] space-y-2.5 shadow-lg" style={{ animation: "academyFade .2s" }}>
          <p className="font-bold text-sm flex items-center gap-1.5"><Volume2 className="w-4 h-4" /> Son et musique</p>
          {([["music", "Musique"], ["ambience", "Ambiance (vagues, oiseaux)"], ["sfx", "Effets (pas, quiz, récompenses)"]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-2 cursor-pointer text-[12px] font-normal leading-snug">
              <span>{label}</span>
              <input type="checkbox" checked={sound[k]} onChange={(e) => setSound({ ...sound, [k]: e.target.checked })} className="accent-amber-400 w-4 h-4" />
            </label>
          ))}
          <label className="block text-[12px] font-normal">
            <span className="text-white/70">Volume</span>
            <input type="range" min={0} max={1} step={0.05} value={sound.volume} onChange={(e) => setSound({ ...sound, volume: Number(e.target.value) })} className="w-full accent-amber-400" />
          </label>
          <p className="text-[10px] text-white/45">Musique générée en direct par le navigateur : chaque partie est un peu différente.</p>
        </div>
      )}

      {confetti > 0 && <Confetti key={confetti} />}

      {help && (
        <div className="absolute top-[230px] right-3 z-10 w-64 rounded-xl bg-slate-900/90 text-white p-3.5 text-[12px] space-y-1.5 shadow-lg" style={{ animation: "academyFade .2s" }}>
          <p className="font-bold text-sm mb-1 flex items-center gap-1.5"><Gamepad2 className="w-4 h-4" /> Commandes</p>
          <p><Kbd>Z Q S D</Kbd> / <Kbd>W A S D</Kbd> / flèches : marcher</p>
          <p><Kbd>Clic</Kbd> sur le sol ou la mini-map : y aller</p>
          <p><Kbd>Glisser</Kbd> : tourner la caméra · <Kbd>Molette</Kbd> : zoom</p>
          <p><Kbd>E</Kbd> ou <Kbd>Entrée</Kbd> : entrer dans un bâtiment</p>
          <p><Kbd>T</Kbd> : parler à Max, le mentor IA</p>
          <p><Kbd>M</Kbd> : grande carte · <Kbd>Échap</Kbd> : fermer</p>
        </div>
      )}

      {/* pop-up de proximite */}
      {nearStation && !open && !showTutorial && statuses[nearStation.id] !== "hidden" && (
        <div className={`absolute bottom-5 z-20 w-[min(460px,calc(100%-24px))] ${mentor ? "left-3" : "left-1/2 -translate-x-1/2"}`} style={{ animation: "academyPop .2s ease-out" }}>
          <div className="rounded-2xl bg-slate-900/90 backdrop-blur text-white shadow-2xl border border-white/10 overflow-hidden">
            <div className="h-1" style={{ background: nearStation.color }} />
            <div className="p-4 flex gap-3">
              <Mentor />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/60">{nearStation.place}</p>
                <p className="text-sm font-bold">{nearStation.topic}</p>
                {statuses[nearStation.id] === "locked" ? (
                  <p className="text-[12px] text-white/80 mt-1 flex items-start gap-1.5">
                    <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-300" />
                    Cette zone est verrouillée. Termine d'abord « {MAIN_STATIONS[MAIN_STATIONS.findIndex((s) => s.id === nearStation.id) - 1]?.place} ».
                  </p>
                ) : (
                  <>
                    <p className="text-[12px] text-white/80 mt-1">{statuses[nearStation.id] === "done" ? "Tu as déjà réussi cette station. Tu peux la réviser quand tu veux." : nearStation.greeting}</p>
                    {recommended.includes(nearStation.id) && (
                      <p className="text-[12px] text-red-200 mt-1.5 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{recos.find((r) => r.stationId === nearStation.id)?.reasons[0]}</p>
                    )}
                    <div className="mt-2.5 flex gap-2">
                      <button onClick={enter} className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-1.5">
                        {statuses[nearStation.id] === "done" ? "Réviser" : "Entrer"} <span className="ml-1 text-[10px] bg-white/20 rounded px-1.5 py-0.5">E</span>
                      </button>
                      <button onClick={() => setMentor(true)} className="text-sm font-medium border border-white/20 hover:border-amber-300 rounded-lg px-3 py-1.5">Demander à Max</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* tutoriel du mentor */}
      {showTutorial && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[min(500px,calc(100%-24px))]" style={{ animation: "academyPop .25s ease-out" }}>
          <div className="rounded-2xl bg-slate-900/92 backdrop-blur text-white shadow-2xl border border-amber-300/30 p-4 flex gap-3">
            <Mentor />
            <div className="flex-1">
              <p className="text-[11px] text-amber-300 font-semibold">Max · ton mentor — {tutorial! + 1}/{TUTORIAL.length}</p>
              <p className="text-sm font-bold">{TUTORIAL[tutorial!].title}</p>
              <p className="text-[13px] text-white/85 mt-1 leading-relaxed">{TUTORIAL[tutorial!].text}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => (tutorial! < TUTORIAL.length - 1 ? setTutorial(tutorial! + 1) : finishTutorial())}
                  className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-1.5"
                >
                  {tutorial! < TUTORIAL.length - 1 ? "Suivant" : "C'est parti !"}
                </button>
                {tutorial! < TUTORIAL.length - 1 && (
                  <button onClick={finishTutorial} className="text-[12px] text-white/60 hover:text-white">Passer le tutoriel</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* notification de recompense */}
      {toast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[min(420px,calc(100%-24px))]" style={{ animation: "academyPop .3s ease-out" }}>
          <div className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 shadow-2xl px-4 py-3 flex gap-3 items-start">
            <Star className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-extrabold">{toast.title}</p>
              <p className="text-[12px] font-medium">{toast.text}</p>
            </div>
            <button onClick={() => setToast(null)} aria-label="Fermer"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* grande carte */}
      {bigMap && (
        <div className="absolute inset-0 z-30 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBigMap(false)}>
          <div className="rounded-2xl bg-slate-900 p-4 shadow-2xl text-white" onClick={(e) => e.stopPropagation()} style={{ animation: "academyPop .2s" }}>
            <div className="flex items-center mb-3 gap-2">
              <Compass className="w-4 h-4 text-amber-300" />
              <p className="font-bold text-sm flex-1">Carte de l'Académie</p>
              <span className="text-[11px] text-white/60 mr-2">Clique sur un lieu pour t'y rendre</span>
              <button onClick={() => setBigMap(false)} aria-label="Fermer"><X className="w-4 h-4" /></button>
            </div>
            <MiniMap
              stations={STATIONS}
              statuses={statuses}
              questId={quest?.id ?? null}
              player={player}
              size={Math.min(520, typeof window !== "undefined" ? window.innerHeight - 220 : 520)}
              big
            />
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/70">
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" /> terminé</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block" /> mission actuelle</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" /> verrouillé</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> toi</span>
            </div>
          </div>
        </div>
      )}

      {mentor && !open && (
        <MentorChat context={mentorContext} nearTopic={nearStation && statuses[nearStation.id] !== "hidden" ? nearStation.topic : null} onClose={() => setMentor(false)} />
      )}

      {open && (
        <LessonModal
          key={open.id}
          station={open}
          alreadyDone={!!progress.done[open.id]}
          onClose={closeLesson}
          onComplete={(m, c) => complete(open, m, c)}
        />
      )}

      {diploma && (
        <div className="absolute inset-0 z-40 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-gradient-to-b from-amber-50 to-white text-slate-900 p-6 text-center shadow-2xl border-4 border-amber-400" style={{ animation: "academyPop .35s" }}>
            <Award className="w-14 h-14 mx-auto text-amber-500" />
            <p className="text-[11px] uppercase tracking-[.2em] text-amber-700 font-bold mt-2">Diplôme</p>
            <h3 className="text-2xl font-extrabold mt-1">Académie du trading</h3>
            <p className="text-sm mt-2">
              Félicitations {user?.firstName ?? ""} ! Tu as terminé les {MAIN_STATIONS.length} stations avec {xp} XP sur {TOTAL_XP}.
            </p>
            <p className="text-[13px] text-slate-600 mt-2">
              Maintenant, applique tout ça dans le jeu : bats l'agent IA, garde tes stop-loss et fais grandir tes 100 000 $ pour monter de niveau.
            </p>
            <div className="mt-5 flex gap-2 justify-center">
              <button onClick={() => navigate("/agent?play=1")} className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2">Jouer maintenant</button>
              <button onClick={() => setDiploma(false)} className="text-sm font-semibold border border-slate-300 rounded-lg px-4 py-2">Rester sur l'île</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HudButton({ label, onClick, children, highlight }: { label: string; onClick: () => void; children: React.ReactNode; highlight?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`w-9 h-9 rounded-lg ${highlight ? "bg-amber-500 hover:bg-amber-400 text-slate-900" : "bg-slate-900/80 hover:bg-slate-800 text-white"} flex items-center justify-center shadow-lg`}>
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-block rounded bg-white/15 border border-white/20 px-1.5 py-[1px] text-[10px] font-semibold">{children}</kbd>;
}

/** Avatar du mentor. */
function Mentor() {
  return (
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center shrink-0 shadow-inner" style={{ animation: "academyBounce 2s ease-in-out infinite" }}>
      <span className="text-xl" role="img" aria-label="mentor">🧑‍🏫</span>
    </div>
  );
}

const CONFETTI_COLORS = ["#FACC15", "#22C55E", "#3B82F6", "#EF4444", "#A855F7", "#F97316"];

/** Pluie de confettis quand une station est reussie. */
function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({
      left: (i * 37) % 100,
      delay: ((i * 13) % 20) / 40,
      dur: 1.6 + ((i * 7) % 10) / 10,
      size: 6 + (i % 4) * 2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      drift: ((i * 53) % 120) - 60,
      spin: 360 + ((i * 97) % 540),
    })),
    [],
  );
  return (
    <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
      <style>{`@keyframes academyConfetti { 0% { transform: translate(0,-20px) rotate(0); opacity: 1 } 100% { transform: translate(var(--dx), 110vh) rotate(var(--spin)); opacity: .9 } }`}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute", top: 0, left: `${p.left}%`, width: p.size, height: p.size * 0.6, background: p.color, borderRadius: 2,
            animation: `academyConfetti ${p.dur}s ${p.delay}s ease-in forwards`,
            ["--dx" as string]: `${p.drift}px`, ["--spin" as string]: `${p.spin}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
