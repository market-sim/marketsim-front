import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { ChevronDown, ChevronUp, LineChart, Mic, MicOff, Minus, Send, ShieldCheck, Square, Volume2, VolumeX } from "lucide-react";
import {
  assetsApi, assistantApi, coachApi, type AgentAction, type Asset, type CoachAnalysis,
} from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { pageTitles } from "../../layout/navConfig";
import { createRecognition, speak, sttSupported, ttsSupported } from "../agent/speech";
import coachImage from "../../assets/coach.jpg";
import CoachChart, { fmtPx } from "./CoachChart";
import { useCoach } from "./coachFocus";
import Waveform, { type WaveMode } from "./Waveform";

// Position du rectangle bleu dans l'image (mesuree : x 33,7-66,2 % ; y 88,1-96,1 %) : c'est la que sort la forme d'onde.
const PILL = { left: "33.7%", top: "88.1%", width: "32.5%", height: "8%" } as const;
const BLUE = "#0C80EF";

const ACTION: Record<AgentAction, { label: string; verb: string; cls: string; dot: string }> = {
  BUY: { label: "BUY", verb: "Acheter", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40", dot: "bg-emerald-400" },
  HOLD: { label: "HOLD", verb: "Garder", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/40", dot: "bg-amber-400" },
  SELL: { label: "SELL", verb: "Vendre", cls: "bg-red-500/15 text-red-300 ring-red-400/40", dot: "bg-red-400" },
};
const TREND: Record<string, string> = { HAUSSIERE: "haussière", BAISSIERE: "baissière", MIXTE: "mixte" };

const PAGE_CHIPS: Record<string, string[]> = {
  "/": ["Que dois-je surveiller aujourd'hui ?"],
  "/trading": ["Où placer mon stop-loss ?"],
  "/analysis": ["Quels indicateurs regarder ?"],
  "/education": ["Explique-moi le RSI"],
  "/market": ["Quelles sont les actualités du marché ?"],
  "/agent": ["Cette stratégie est-elle fiable ?"],
  "/stress": ["Que se passe-t-il si le marché chute de 20 % ?"],
  "/blockchain": ["Explique le registre d'audit"],
};
const CORE_CHIPS = ["Que dois-je faire maintenant ?", "Analyse la courbe avec moi", "Pourquoi ce signal ?"];

interface Msg {
  id: number;
  role: "user" | "coach";
  text: string;
  sources?: { title: string; url: string }[];
  /** texte lu a voix haute quand il differe de ce qui est affiche (fiche d'analyse) */
  speech?: string;
  kind?: "analysis";
}

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
};

/** Coach de trading : toujours present a droite de l'ecran, parle, analyse la courbe et dit quand acheter, garder, vendre. */
export default function CoachDock() {
  const { pathname } = useLocation();
  const { focus } = useCoach();
  const pageTitle = pageTitles[pathname]?.title ?? "MarketSim AI";

  const [open, setOpen] = useState(() => store.get("marketsim:coach:open", "0") === "1");
  const [voiceOn, setVoiceOn] = useState(() => store.get("marketsim:coach:voice", "1") === "1");
  const [hero, setHero] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [symbol, setSymbol] = useState(() => store.get("marketsim:coach:symbol", ""));
  const [analysis, setAnalysis] = useState<CoachAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [note, setNote] = useState("");

  const energyRef = useRef(0);
  const stopSpeechRef = useRef<(() => void) | null>(null);
  const recRef = useRef<ReturnType<typeof createRecognition>>(null);
  const idRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(text: string) => void>(() => {});

  const mode: WaveMode = speaking ? "speaking" : listening ? "listening" : "idle";

  // ----- Donnees de l'interface -----
  useEffect(() => {
    if (!open || assets.length > 0) return;
    assetsApi.list().then((list) => {
      setAssets(list);
      setSymbol((cur) => (list.some((a) => a.symbol === cur) ? cur : list[0]?.symbol ?? ""));
    }).catch(() => setAssets([]));
    assistantApi.status().then((s) => setOnline(s.online)).catch(() => setOnline(null));
  }, [open, assets.length]);

  // une page peut indiquer l'actif regarde (ex : la page de l'agent)
  useEffect(() => {
    if (focus.symbol) setSymbol(focus.symbol);
  }, [focus.symbol]);

  useEffect(() => { store.set("marketsim:coach:open", open ? "1" : "0"); }, [open]);
  useEffect(() => { store.set("marketsim:coach:voice", voiceOn ? "1" : "0"); }, [voiceOn]);
  useEffect(() => { if (symbol) store.set("marketsim:coach:symbol", symbol); }, [symbol]);
  // une nouvelle analyse montre sa fiche depuis le haut ; un message de conversation descend en bas
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [analysis]);
  useEffect(() => {
    if (messages[messages.length - 1]?.kind === "analysis") return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);
  useEffect(() => () => { stopSpeechRef.current?.(); recRef.current?.stop(); }, []);

  // ----- Voix -----
  const stopTalking = useCallback(() => {
    stopSpeechRef.current?.();
    stopSpeechRef.current = null;
    setSpeaking(false);
  }, []);

  const say = useCallback((text: string) => {
    if (!voiceOn || !ttsSupported()) return;
    stopSpeechRef.current?.();
    stopSpeechRef.current = speak(text, () => setSpeaking(true), () => setSpeaking(false), () => { energyRef.current = 1; });
  }, [voiceOn]);

  const toggleVoice = () => {
    if (voiceOn) stopTalking();
    setVoiceOn(!voiceOn);
  };

  const addMsg = useCallback((role: Msg["role"], text: string, extra?: Pick<Msg, "sources" | "speech" | "kind">) => {
    setMessages((m) => [...m, { id: idRef.current++, role, text, ...extra }]);
  }, []);

  // salutation parlee a la premiere ouverture de la session (le clic d'ouverture autorise la synthese vocale)
  const greet = useCallback(() => {
    let done = false;
    try { done = sessionStorage.getItem("marketsim:coach:greeted") === "1"; sessionStorage.setItem("marketsim:coach:greeted", "1"); } catch { /* ignore */ }
    if (done) return;
    const hello = "Salut, je suis ton coach. Choisis un actif et appuie sur Analyser : je lis la vraie courbe avec toi, et je te dis quand acheter, garder ou vendre.";
    addMsg("coach", hello);
    say(hello);
  }, [addMsg, say]);

  const openDock = () => {
    setOpen(true);
    if (messages.length === 0) greet();
  };

  // ----- Analyse de la courbe -----
  const analyze = async () => {
    if (!symbol || analyzing) return;
    stopTalking();
    setAnalyzing(true);
    setNote("");
    try {
      const a = await coachApi.analysis(symbol, focus.agentId);
      setAnalysis(a);
      setHero(false);
      addMsg("coach", `${a.headline}
Tout le détail (niveaux, plan, raisons) est dans la fiche au-dessus.`, { speech: a.speech, kind: "analysis" });
      say(a.speech);
    } catch (e) {
      const text = errorMessage(e);
      addMsg("coach", `Je n'ai pas pu analyser ${symbol} : ${text}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // ----- Conversation -----
  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    stopTalking();
    setInput("");
    setHero(false);
    addMsg("user", text);
    setBusy(true);
    try {
      const history = [...messages, { id: 0, role: "user" as const, text }].slice(-12)
        .map((m) => ({ role: m.role === "coach" ? ("assistant" as const) : ("user" as const), content: m.text }));
      const reply = await coachApi.chat(history, { symbol: symbol || undefined, page: pageTitle, agentId: focus.agentId });
      setOnline(reply.online);
      addMsg("coach", reply.reply, { sources: reply.sources });
      say(reply.reply);
    } catch (e) {
      addMsg("coach", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [busy, messages, symbol, pageTitle, focus.agentId, stopTalking, addMsg, say]);
  sendRef.current = send;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  // ----- Micro -----
  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = createRecognition();
    if (!rec) {
      setNote("La reconnaissance vocale n'est pas disponible dans ce navigateur (utilise Chrome ou Edge) : écris ta question.");
      return;
    }
    stopTalking();
    setNote("");
    let finalText = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(text);
      if (e.results[e.results.length - 1].isFinal) finalText = text;
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) sendRef.current(finalText);
    };
    rec.onerror = (e) => {
      setListening(false);
      setNote(e.error === "not-allowed" ? "Micro refusé : autorise-le dans le navigateur, ou écris ta question."
        : e.error === "no-speech" ? "Je n'ai rien entendu, réessaie." : "Le micro n'est pas disponible pour le moment.");
    };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  const chips = useMemo(() => [...CORE_CHIPS, ...(PAGE_CHIPS[pathname] ?? [])], [pathname]);
  const shown = analysis && analysis.symbol === symbol ? analysis : null;
  const act = shown ? ACTION[shown.action] : null;

  // =============================== Bouton ferme ===============================
  if (!open) {
    return (
      <button onClick={openDock} aria-label="Ouvrir le coach de trading" title="Coach de trading"
        className="fixed bottom-5 right-5 z-40 group">
        <span className={`absolute inset-0 rounded-full ${speaking ? "animate-ping" : "group-hover:animate-ping"} opacity-40`} style={{ background: BLUE }} />
        <span className="relative block w-16 h-16 rounded-full ring-2 shadow-xl shadow-blue-900/50 bg-no-repeat transition-transform group-hover:scale-105"
          style={{ backgroundImage: `url(${coachImage})`, backgroundSize: "300%", backgroundPosition: "50% 20%", boxShadow: `0 0 0 2px ${BLUE}, 0 8px 28px rgba(12,128,239,0.45)` }} />
        {act && <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full ring-2 ring-[#050B1A] ${act.dot}`} title={`Dernier signal : ${act.label}`} />}
      </button>
    );
  }

  // =============================== Panneau ouvert ===============================
  return (
    <aside role="complementary" aria-label="Coach de trading"
      className="fixed bottom-4 right-4 z-40 w-[min(410px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-2xl text-slate-200"
      style={{ background: "#050B1A", boxShadow: "0 24px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(12,128,239,0.18)" }}>
      {/* En-tete */}
      <div className="flex items-center gap-2 px-3.5 h-11 shrink-0 border-b border-white/10">
        <span className={`w-2 h-2 rounded-full ${online === false ? "bg-amber-400" : "bg-emerald-400"} ${speaking ? "animate-pulse" : ""}`} />
        <span className="text-[13px] font-semibold text-white">Coach MarketSim</span>
        <span className="text-[10px] text-slate-400 truncate">
          {speaking ? "parle…" : listening ? "t'écoute…" : online === false ? "mode local" : online ? "Claude en ligne" : ""}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {speaking && (
            <button onClick={stopTalking} aria-label="Arrêter la voix" title="Arrêter la voix" className="p-1.5 rounded-md text-slate-300 hover:bg-white/10"><Square className="w-3.5 h-3.5" /></button>
          )}
          <button onClick={toggleVoice} aria-label={voiceOn ? "Couper la voix" : "Activer la voix"} title={voiceOn ? "Voix activée" : "Voix coupée"}
            className="p-1.5 rounded-md text-slate-300 hover:bg-white/10">{voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}</button>
          <button onClick={() => setHero(!hero)} aria-label={hero ? "Réduire l'image" : "Agrandir l'image"} className="p-1.5 rounded-md text-slate-300 hover:bg-white/10">
            {hero ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={() => { stopTalking(); setOpen(false); }} aria-label="Réduire le coach" title="Réduire" className="p-1.5 rounded-md text-slate-300 hover:bg-white/10"><Minus className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Visage + forme d'onde dans le rectangle bleu */}
      {hero ? (
        <div className="relative shrink-0 bg-black">
          <img src={coachImage} alt="Coach de trading" className="block w-full h-auto select-none" draggable={false} />
          <div className="absolute overflow-hidden rounded-[14%/32%]" style={{ ...PILL, padding: "0.7% 3%" }}>
            <Waveform mode={mode} energyRef={energyRef} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3.5 py-2.5 shrink-0 border-b border-white/10">
          <span className="block w-12 h-12 rounded-full shrink-0 bg-no-repeat"
            style={{ backgroundImage: `url(${coachImage})`, backgroundSize: "300%", backgroundPosition: "50% 20%", boxShadow: `0 0 0 2px ${BLUE}${speaking ? ", 0 0 18px rgba(12,128,239,0.8)" : ""}` }} />
          <div className="h-10 flex-1 rounded-xl px-3 py-1.5 overflow-hidden" style={{ background: BLUE, boxShadow: speaking ? "0 0 22px rgba(12,128,239,0.75)" : "0 0 10px rgba(12,128,239,0.35)" }}>
            <Waveform mode={mode} energyRef={energyRef} />
          </div>
        </div>
      )}

      {/* Contexte : ecran regarde + actif a analyser */}
      <div className="flex items-center gap-2 px-3.5 py-2 shrink-0 border-b border-white/10 bg-white/[0.02]">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">Écran</span>
        <span className="text-[11px] text-slate-300 truncate">{pageTitle}</span>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} aria-label="Actif à analyser"
          className="ml-auto bg-white/5 border border-white/10 rounded-md px-1.5 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-400 max-w-[110px]">
          {assets.map((a) => <option key={a.symbol} value={a.symbol} className="bg-slate-900">{a.symbol}</option>)}
        </select>
        <button onClick={analyze} disabled={!symbol || analyzing}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60" style={{ background: BLUE }}>
          <LineChart className="w-3.5 h-3.5" />{analyzing ? "Analyse…" : "Analyser"}
        </button>
      </div>

      {/* Zone defilante : analyse + conversation */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 space-y-3">
        {shown && act && (
          <div className="rounded-xl border border-white/10 bg-[#0A1530] p-3 space-y-3">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold tracking-wide ring-1 ${act.cls}`} title="Signal du coach">{act.label}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{shown.name} · {fmtPx(shown.price)}</p>
                <p className="text-[11px] text-slate-400">
                  {shown.change1d >= 0 ? "+" : ""}{(shown.change1d * 100).toFixed(1)} % (1 j) · {shown.change20d >= 0 ? "+" : ""}{(shown.change20d * 100).toFixed(1)} % (20 j) · tendance {TREND[shown.indicators.trend]} · RSI {shown.indicators.rsi14.toFixed(0)}
                </p>
              </div>
            </div>
            <div title="Indice du modèle, pas une probabilité calibrée">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Confiance du modèle</span><span>{(shown.confidence * 100).toFixed(0)} %</span></div>
              <div className="h-1 rounded-full bg-white/10"><div className="h-1 rounded-full" style={{ width: `${shown.confidence * 100}%`, background: BLUE }} /></div>
            </div>

            <CoachChart a={shown} />

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Plan : quand acheter, garder, vendre</p>
              {shown.plan.map((r) => {
                const s = ACTION[r.action];
                return (
                  <div key={r.title} className={`flex gap-2 rounded-lg px-2.5 py-2 text-[11.5px] leading-snug ${r.active ? `ring-1 ${s.cls}` : "bg-white/[0.03] text-slate-300"}`}>
                    <span className={`shrink-0 w-14 font-semibold ${r.active ? "" : "text-slate-400"}`}>{s.verb}</span>
                    <span className="min-w-0">{r.condition}{r.active && <b className="ml-1 text-[10px] uppercase tracking-wide">· maintenant</b>}</span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Pourquoi</p>
              <ul className="text-[11.5px] text-slate-300 space-y-0.5 list-disc pl-4">
                {shown.reasons.map((r, i) => <li key={i}>{r.text.charAt(0).toUpperCase() + r.text.slice(1)}</li>)}
              </ul>
            </div>

            {shown.trackRecord && (
              <p className="text-[11px] leading-snug rounded-lg bg-amber-500/10 text-amber-200/90 px-2.5 py-2">
                <b>Bilan réel de la stratégie.</b> {shown.trackRecord.text}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => { stopTalking(); say(shown.speech); }} disabled={!voiceOn}
                className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10 disabled:opacity-40">
                <Volume2 className="w-3 h-3" />Réécouter
              </button>
              {shown.auditRecordId != null && (
                <span className="flex items-center gap-1 text-[10px] text-sky-300" title="Ce conseil est figé dans le registre d'audit (onglet Audit blockchain de l'agent)">
                  <ShieldCheck className="w-3 h-3" />Certifié #{shown.auditRecordId}
                </span>
              )}
              <span className="ml-auto text-[9.5px] text-slate-500">cours réels {shown.asOf}</span>
            </div>
            <p className="text-[9.5px] text-slate-500 leading-snug">{shown.disclaimer}</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug ${m.role === "user" ? "text-white rounded-br-sm" : "bg-[#0F1D3F] text-slate-200 rounded-bl-sm"}`}
              style={m.role === "user" ? { background: BLUE } : undefined}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-white/10 space-y-0.5">
                  {m.sources.slice(0, 3).map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block text-[10.5px] text-sky-300 hover:underline truncate">↗ {s.title}</a>
                  ))}
                </div>
              )}
              {m.role === "coach" && voiceOn && ttsSupported() && (
                <button onClick={() => { stopTalking(); say(m.speech ?? m.text); }} className="mt-1 text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"><Volume2 className="w-3 h-3" />écouter</button>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-[11px] text-slate-400 animate-pulse">Le coach réfléchit…</p>}
        {messages.length === 0 && !shown && (
          <p className="text-[11.5px] text-slate-400 leading-snug">
            Choisis un actif puis appuie sur <b className="text-slate-200">Analyser</b>, ou pose-moi une question : je te dis quoi faire maintenant, et quand acheter, garder ou vendre.
          </p>
        )}
      </div>

      {/* Saisie */}
      <div className="shrink-0 border-t border-white/10 px-3.5 pt-2 pb-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {chips.slice(0, 4).map((c) => (
            <button key={c} onClick={() => send(c)} disabled={busy}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-slate-300 hover:bg-white/10 disabled:opacity-50">{c}</button>
          ))}
        </div>
        {note && <p className="text-[10.5px] text-amber-300">{note}</p>}
        <form onSubmit={onSubmit} className="flex items-center gap-1.5">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Je t'écoute…" : "Pose ta question au coach…"}
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[12.5px] text-white placeholder:text-slate-500 outline-none focus:border-blue-400" />
          {sttSupported() && (
            <button type="button" onClick={toggleMic} aria-label={listening ? "Arrêter le micro" : "Parler au coach"} title="Parler au coach"
              className={`p-2 rounded-lg border ${listening ? "border-red-400 bg-red-500/20 text-red-300 animate-pulse" : "border-white/10 text-slate-300 hover:bg-white/10"}`}>
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button type="submit" disabled={!input.trim() || busy} aria-label="Envoyer" className="p-2 rounded-lg text-white disabled:opacity-50" style={{ background: BLUE }}>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
