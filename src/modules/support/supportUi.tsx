import { useEffect, useRef, useState } from "react";
import { Banknote, Bug, CircleHelp, Loader2, Send, ShieldQuestion, type LucideIcon } from "lucide-react";
import type { SupportCategory, SupportMessage, SupportStatus, SupportThread } from "../../api/endpoints";

export const CATEGORY: Record<SupportCategory, { label: string; Icon: LucideIcon; cls: string }> = {
  FUNDS: { label: "Demande de fonds", Icon: Banknote, cls: "bg-emerald-500/10 text-emerald-600" },
  TECHNICAL: { label: "Problème technique", Icon: Bug, cls: "bg-red-500/10 text-red-600" },
  ACCOUNT: { label: "Compte & sécurité", Icon: ShieldQuestion, cls: "bg-blue-500/10 text-blue-600" },
  OTHER: { label: "Autre question", Icon: CircleHelp, cls: "bg-slate-500/10 text-slate-500" },
};

export const STATUS: Record<SupportStatus, { label: string; cls: string }> = {
  OPEN: { label: "En attente du support", cls: "bg-amber-500/15 text-amber-600" },
  ANSWERED: { label: "Répondu", cls: "bg-blue-500/15 text-blue-600" },
  CLOSED: { label: "Résolu", cls: "bg-emerald-500/15 text-emerald-600" },
};

export const money = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

export const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

/** Bulles de la conversation + zone de reponse (Entree = envoyer, Maj+Entree = retour a la ligne). */
export function ThreadView({ thread, onSend, placeholder, header }: {
  thread: SupportThread;
  onSend: (text: string) => Promise<void>;
  placeholder: string;
  header?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length, thread.ticket.id]);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSend(t);
      setText("");
    } catch (e) {
      setError((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {header}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {thread.messages.map((m: SupportMessage) => m.system ? (
          <p key={m.id} className="mx-auto max-w-[85%] text-center text-[12px] rounded-full bg-muted px-3 py-1.5 text-muted-foreground">{m.body} · {when(m.createdAt)}</p>
        ) : (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${m.mine ? "bg-blue-600 text-white rounded-br-sm" : m.fromAdmin ? "bg-violet-500/10 border border-violet-500/20 rounded-bl-sm" : "bg-muted rounded-bl-sm"}`}>
              <p className={`text-[10.5px] font-semibold mb-0.5 ${m.mine ? "text-white/75" : m.fromAdmin ? "text-violet-600" : "text-muted-foreground"}`}>{m.authorName}</p>
              <p className="text-[13.5px] whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
              <p className={`text-[10px] mt-1 text-end ${m.mine ? "text-white/60" : "text-muted-foreground"}`}>{when(m.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="border-t border-border p-3">
        {error && <p className="text-[12px] text-red-600 mb-1.5">{error}</p>}
        <div className="flex gap-2 items-end">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13.5px] focus:outline-none focus:border-blue-500" />
          <button onClick={send} disabled={busy || !text.trim()} aria-label="Envoyer"
            className="h-10 w-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10.5px] text-muted-foreground mt-1">Entrée pour envoyer · Maj + Entrée pour aller à la ligne</p>
      </div>
    </div>
  );
}
