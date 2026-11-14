import { useEffect, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { academyApi, type AssistantMessage } from "../../../api/endpoints";
import { academyAudio } from "./audio";

interface Props {
  /** resume de la progression envoye au mentor avec chaque question */
  context: string;
  /** station devant laquelle se trouve le joueur, pour les suggestions */
  nearTopic: string | null;
  onClose: () => void;
}

/** Discussion avec Max, le mentor IA de l'Academie (meme moteur que l'assistant du module 6). */
export default function MentorChat({ context, nearTopic, onClose }: Props) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: "assistant", content: "Salut ! Pose-moi n'importe quelle question sur le trading, ou demande-moi « qu'est-ce que je dois réviser ? » : je regarde tes vraies parties pour te répondre." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const suggestions = [
    "Qu'est-ce que je dois réviser ?",
    nearTopic ? `Explique-moi « ${nearTopic} » avec un exemple` : "C'est quoi un stop-loss ?",
    "Pourquoi l'agent IA me bat ?",
  ];

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: AssistantMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      // le premier message d'accueil est local : on ne l'envoie pas
      const res = await academyApi.mentor(next.slice(1).slice(-12), context);
      setOffline(!res.online);
      setMessages([...next, { role: "assistant", content: res.reply }]);
      academyAudio.pop();
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      const status = err.response?.status;
      const content =
        status === 404
          ? "Le serveur tourne encore avec une ancienne version qui ne me connaît pas. Ferme les fenêtres « MarketSim Backend » et « Frontend », puis relance Lancer-MarketSim.bat : je serai là !"
          : !err.response
            ? "Je n'arrive pas à joindre le serveur. Vérifie que le backend est lancé (Lancer-MarketSim.bat), puis réessaie."
            : err.response.data?.message ?? "Petit souci de mon côté, réessaie dans un instant.";
      setMessages([...next, { role: "assistant", content }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute right-3 bottom-[92px] top-[250px] z-20 w-[min(380px,calc(100%-24px))] flex flex-col rounded-2xl bg-slate-900/95 backdrop-blur text-white shadow-2xl border border-white/10" style={{ animation: "academyPop .2s ease-out" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center">🧑‍🏫</span>
        <div className="flex-1">
          <p className="text-sm font-bold">Max · mentor IA</p>
          <p className="text-[10px] text-white/55">{offline ? "Mode hors-ligne : réponses de l'application" : "Répond selon ta progression et tes parties"}</p>
        </div>
        <button onClick={onClose} aria-label="Fermer" className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"><X className="w-4 h-4" /></button>
      </div>
      <div ref={list} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[85%] whitespace-pre-line text-[13px] leading-relaxed rounded-2xl px-3 py-2 ${m.role === "user" ? "bg-blue-600 rounded-br-sm" : "bg-white/10 rounded-bl-sm"}`}>{m.content}</p>
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-[12px] text-white/60"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Max réfléchit…</p>
        )}
      </div>
      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy} className="text-[11px] rounded-full border border-white/15 hover:border-amber-300 hover:text-amber-200 px-2.5 py-1 disabled:opacity-40">
            {s}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 p-3 border-t border-white/10"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          ref={field}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Écris ta question…"
          maxLength={600}
          className="flex-1 rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-[13px] placeholder:text-white/40 focus:outline-none focus:border-amber-300"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Envoyer" className="w-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 flex items-center justify-center disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
