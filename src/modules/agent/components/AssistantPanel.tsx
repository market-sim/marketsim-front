import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ExternalLink, Globe, Mic, MicOff, Send, Sparkles, Square, Volume2, VolumeX } from "lucide-react";
import { assistantApi, type AssistantMessage, type AssistantReply } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY } from "../../../shared/ui";
import { createRecognition, speak, sttSupported, ttsSupported } from "../speech";

interface Turn extends AssistantMessage {
  meta?: Pick<AssistantReply, "sources" | "online" | "webSearchUsed" | "notice">;
}

const BRIEFING =
  "Fais-moi le briefing complet : d'abord ce qui est nouveau dans mes agents (décisions, simulations, tournoi), " +
  "ensuite les actualités importantes de la bourse et du trading aujourd'hui, et enfin ce qui change en ce moment " +
  "dans le monde du trading. Termine par un conseil pédagogique pour la suite.";

const QUICK = [
  { label: "🎙️ Briefing du jour", prompt: BRIEFING },
  { label: "Quoi de neuf dans mes agents ?", prompt: "Qu'est-ce qui est nouveau dans mes agents ? Résume-moi leurs dernières décisions et résultats." },
  { label: "Actualités de la bourse", prompt: "Quelles sont les actualités importantes de la bourse et des marchés aujourd'hui ?" },
  { label: "Ce qui change dans le trading", prompt: "Qu'est-ce qui change en ce moment dans le monde du trading (technologie, IA, régulation, crypto) ?" },
  { label: "Explique-moi la VaR", prompt: "Explique-moi simplement la VaR et la CVaR, avec l'exemple de mon dernier Monte Carlo." },
];

/** Rendu leger : paragraphes, puces et **gras**. */
function RichText({ text }: { text: string }) {
  const inline = (line: string): ReactNode[] =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>);
  return (
    <div className="space-y-1.5">
      {text.split(/\n+/).map((line, i) => {
        const bullet = /^\s*([-•*]|\d+\.)\s+/.test(line);
        return bullet
          ? <p key={i} className="pl-3 relative"><span className="absolute left-0">•</span>{inline(line.replace(/^\s*([-•*]|\d+\.)\s+/, ""))}</p>
          : <p key={i}>{inline(line.replace(/^#+\s*/, ""))}</p>;
      })}
    </div>
  );
}

export default function AssistantPanel() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{ online: boolean; model: string; reason: string | null } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [webOn, setWebOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const stopSpeech = useRef<() => void>(() => {});
  const recognition = useRef<ReturnType<typeof createRecognition>>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    assistantApi.status().then(setStatus).catch(() => setStatus(null));
    // certaines voix ne sont disponibles qu'apres cet evenement
    if (ttsSupported()) window.speechSynthesis.onvoiceschanged = () => {};
    return () => {
      stopSpeech.current();
      recognition.current?.stop();
    };
  }, []);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [turns, busy]);

  const say = (text: string) => {
    stopSpeech.current();
    stopSpeech.current = speak(text, () => setSpeaking(true), () => setSpeaking(false));
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    stopSpeech.current();
    const history: Turn[] = [...turns, { role: "user", content }];
    setTurns(history);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const r = await assistantApi.chat(history.map(({ role, content: c }) => ({ role, content: c })), webOn);
      setTurns([...history, { role: "assistant", content: r.reply, meta: r }]);
      if (voiceOn) say(r.reply);
    } catch (e) {
      setError(errorMessage(e));
      setTurns(turns); // on retire la question non traitee
      setInput(content);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const toggleMic = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const r = createRecognition();
    if (!r) return;
    stopSpeech.current();
    recognition.current = r;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Micro refusé par le navigateur" : `Micro : ${e.error}`);
    r.onend = () => {
      setListening(false);
      if (finalText.trim()) send(finalText);
    };
    setListening(true);
    r.start();
  };

  return (
    <CardShell className="overflow-hidden">
      {/* En-tete */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border/60" style={{ background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)" }}>
        <div className="relative">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white ${speaking ? "animate-pulse" : ""}`} style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
            <Sparkles className="w-5 h-5" />
          </div>
          {speaking && <span className="absolute inset-0 rounded-full border-2 border-violet-400 animate-ping" />}
        </div>
        <div className="flex-1 min-w-[180px]">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Atlas — votre assistant de trading</h3>
          <p className="text-[11px] text-muted-foreground">
            {speaking ? "Atlas parle…" : listening ? "Je vous écoute…" : "Briefings, explications de vos agents et actualités des marchés, à voix haute."}
          </p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${status?.online ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}
          title={status?.reason ?? ""}>
          {status == null ? "…" : status.online ? `IA en ligne · ${status.model}` : "Mode local · actualités Google News"}
        </span>
        <button onClick={() => setWebOn(!webOn)} title="Recherche web pour les actualités"
          className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border ${webOn ? "border-blue-300 bg-white text-blue-700" : "border-border text-muted-foreground"}`}>
          <Globe className="w-3.5 h-3.5" />Actualités {webOn ? "on" : "off"}
        </button>
        {ttsSupported() && (
          <button onClick={() => { if (voiceOn) stopSpeech.current(); setVoiceOn(!voiceOn); }} title="Lecture vocale automatique"
            className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border ${voiceOn ? "border-violet-300 bg-white text-violet-700" : "border-border text-muted-foreground"}`}>
            {voiceOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}Voix {voiceOn ? "on" : "off"}
          </button>
        )}
        {speaking && (
          <button onClick={() => stopSpeech.current()} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-slate-900 text-white">
            <Square className="w-3 h-3" />Stop
          </button>
        )}
      </div>

      {status && !status.online && (
        <div className="px-5 py-2 bg-blue-50/60 border-b border-blue-100 text-[11px] text-blue-800">
          Mode local : Atlas lit les actualités en direct (Google News), fait vos briefings et explique vos agents et les notions de finance.
          Pour une conversation totalement libre avec l'IA Claude, ajoutez la variable d'environnement <b>ANTHROPIC_API_KEY</b>.
        </div>
      )}

      {/* Conversation */}
      <div className="h-[460px] overflow-y-auto px-5 py-4 space-y-4 bg-slate-50/40">
        {turns.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-3" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
              <Sparkles className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-foreground">Bonjour ! Je suis Atlas.</p>
            <p className="text-[12px] text-muted-foreground max-w-md mt-1">
              Demandez-moi un briefing, ce qui a changé dans vos agents, ou les dernières nouvelles de la bourse.
              {sttSupported() && " Vous pouvez aussi me parler avec le micro 🎤."}
            </p>
            <button onClick={() => send(BRIEFING)} disabled={busy}
              className="mt-4 flex items-center gap-2 text-white text-sm font-semibold rounded-xl px-5 py-2.5 disabled:opacity-60" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
              🎙️ Lancer le briefing du jour
            </button>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start gap-2.5"}`}>
            {t.role === "assistant" && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            )}
            <div className={`max-w-[80%] text-[13px] leading-relaxed rounded-2xl px-4 py-2.5 ${t.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-white border border-border/60 text-slate-700 rounded-tl-sm"}`}>
              {t.role === "user" ? <p className="whitespace-pre-wrap">{t.content}</p> : <RichText text={t.content} />}
              {t.meta && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                  {t.meta.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {t.meta.sources.slice(0, 6).map((s) => (
                        <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full max-w-[220px]">
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{s.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {ttsSupported() && (
                      <button onClick={() => say(t.content)} className="inline-flex items-center gap-1 hover:text-violet-700">
                        <Volume2 className="w-3 h-3" />Écouter
                      </button>
                    )}
                    {t.meta.webSearchUsed && <span>🌐 actualités consultées</span>}
                    {!t.meta.online && <span>mode local</span>}
                    {t.meta.notice && <span className="text-amber-600">{t.meta.notice}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <span className="flex gap-1">
                {[0, 1, 2].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />)}
              </span>
              <span className="text-[11px] text-muted-foreground">{webOn ? "Atlas lit l'actualité et analyse vos agents…" : "Atlas réfléchit…"}</span>
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {/* Saisie */}
      <div className="px-5 py-3 border-t border-border/60 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q.label} onClick={() => send(q.prompt)} disabled={busy}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-blue-300 hover:text-blue-700 disabled:opacity-50">
              {q.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2">
          {sttSupported() && (
            <button type="button" onClick={toggleMic} disabled={busy} title={listening ? "Arrêter l'écoute" : "Parler à Atlas"}
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 ${listening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
            placeholder={listening ? "Parlez, je vous écoute…" : "Posez une question à Atlas…"}
            className="flex-1 bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-blue-400" />
          <button disabled={busy || !input.trim()} className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </form>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-[10px] text-muted-foreground">Outil pédagogique : les réponses ne sont pas des conseils d'investissement. Les données de vos agents sont simulées.</p>
      </div>
    </CardShell>
  );
}
