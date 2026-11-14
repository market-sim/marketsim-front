import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ArrowLeft, Inbox, MessageSquarePlus, X } from "lucide-react";
import { supportApi, type SupportCategory, type SupportThread, type SupportTicket } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY } from "../../shared/ui";
import { CATEGORY, STATUS, ThreadView, money, when } from "./supportUi";

/** Messagerie du trader : ses conversations avec le support (demande de fonds, probleme, question). */
export default function MessagesPage() {
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState<SupportTicket[]>([]);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const selected = Number(params.get("t")) || null;

  const loadList = useCallback(() => supportApi.mine().then(setList).catch((e) => setError(errorMessage(e))), []);
  const loadThread = useCallback((id: number) => supportApi.open(id).then((t) => { setThread(t); loadList(); }).catch((e) => setError(errorMessage(e))), [loadList]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    if (selected) loadThread(selected);
    else setThread(null);
  }, [selected, loadThread]);
  // nouvelles reponses sans recharger la page
  useEffect(() => {
    const id = window.setInterval(() => {
      loadList();
      if (selected) supportApi.open(selected).then(setThread).catch(() => {});
    }, 10_000);
    return () => window.clearInterval(id);
  }, [selected, loadList]);

  const select = (id: number | null) => {
    setCreating(false);
    setParams(id ? { t: String(id) } : {});
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-170px)] min-h-[520px]">
      {/* liste */}
      <CardShell className={`flex flex-col min-h-0 overflow-hidden ${selected || creating ? "hidden lg:flex" : "flex"}`}>
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
          <Inbox className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-foreground flex-1" style={DISPLAY}>Mes conversations</h3>
          <button onClick={() => { setCreating(true); setParams({}); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-[12px] font-semibold text-white">
            <MessageSquarePlus className="w-3.5 h-3.5" /> Nouvelle demande
          </button>
        </div>
        {error && <p className="px-4 py-2 text-[12px] text-red-600">{error}</p>}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {list.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-foreground font-medium">Aucune conversation</p>
              <p className="text-[12px] text-muted-foreground mt-1">Besoin de plus de capital, un bug, une question ? Écris au support.</p>
            </div>
          )}
          {list.map((t) => {
            const c = CATEGORY[t.category];
            return (
              <button key={t.id} onClick={() => select(t.id)}
                className={`w-full text-start px-4 py-3 hover:bg-muted/40 ${selected === t.id ? "bg-blue-500/10" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${c.cls}`}><c.Icon className="w-3.5 h-3.5" /></span>
                  <span className={`flex-1 truncate text-[13px] ${t.unread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{t.subject}</span>
                  {t.unread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                </div>
                <p className="text-[11.5px] text-muted-foreground truncate mt-1 ps-9">{t.lastFromAdmin ? "Support : " : "Toi : "}{t.lastMessage}</p>
                <div className="flex items-center gap-2 mt-1.5 ps-9">
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</span>
                  {t.requestedAmount !== null && <span className="text-[10.5px] text-muted-foreground">{money(t.requestedAmount)}</span>}
                  <span className="ms-auto text-[10.5px] text-muted-foreground">{when(t.lastMessageAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </CardShell>

      {/* conversation ou formulaire */}
      <CardShell className={`flex flex-col min-h-0 overflow-hidden ${selected || creating ? "flex" : "hidden lg:flex"}`}>
        {creating ? (
          <NewRequest onCancel={() => setCreating(false)} onCreated={(t) => { setCreating(false); loadList(); setThread(t); setParams({ t: String(t.ticket.id) }); }} />
        ) : thread ? (
          <ThreadView
            thread={thread}
            placeholder={thread.ticket.status === "CLOSED" ? "Écris pour rouvrir la conversation…" : "Ton message…"}
            onSend={async (text) => { setThread(await supportApi.reply(thread.ticket.id, text)); loadList(); }}
            header={<TicketHeader ticket={thread.ticket} onBack={() => select(null)} />}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Inbox className="w-10 h-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">Choisis une conversation</p>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-xs">ou clique « Nouvelle demande » pour demander du capital, signaler un problème ou poser une question à l'administration.</p>
          </div>
        )}
      </CardShell>
    </div>
  );
}

function TicketHeader({ ticket, onBack }: { ticket: SupportTicket; onBack: () => void }) {
  const c = CATEGORY[ticket.category];
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
      <button onClick={onBack} className="lg:hidden p-1 rounded hover:bg-muted" aria-label="Retour"><ArrowLeft className="w-4 h-4 rtl:rotate-180" /></button>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.cls}`}><c.Icon className="w-4 h-4" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
        <p className="text-[11.5px] text-muted-foreground">
          {c.label}{ticket.requestedAmount !== null && ` · ${money(ticket.requestedAmount)}`}
          {ticket.requestStatus === "PENDING" && " · en cours d'examen"}
          {ticket.requestStatus === "APPROVED" && " · acceptée ✅"}
          {ticket.requestStatus === "REJECTED" && " · refusée"}
        </p>
      </div>
      <span className={`text-[10.5px] font-semibold rounded-full px-2.5 py-1 ${STATUS[ticket.status].cls}`}>{STATUS[ticket.status].label}</span>
    </div>
  );
}

function NewRequest({ onCancel, onCreated }: { onCancel: () => void; onCreated: (t: SupportThread) => void }) {
  const [category, setCategory] = useState<SupportCategory>("FUNDS");
  const [subject, setSubject] = useState("Demande d'augmentation de mon capital");
  const [amount, setAmount] = useState("500");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = (c: SupportCategory) => {
    setCategory(c);
    if (c === "FUNDS") setSubject("Demande d'augmentation de mon capital");
    else if (subject === "Demande d'augmentation de mon capital") setSubject("");
  };

  async function submit() {
    setBusy(true);
    setError("");
    try {
      onCreated(await supportApi.create({ subject, category, body, amount: category === "FUNDS" ? Number(amount.replace(",", ".")) : null }));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="flex items-center">
        <h3 className="text-sm font-semibold text-foreground flex-1" style={DISPLAY}>Nouvelle demande au support</h3>
        <button onClick={onCancel} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Annuler"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(CATEGORY) as SupportCategory[]).map((c) => {
          const m = CATEGORY[c];
          return (
            <button key={c} type="button" onClick={() => pick(c)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-[13px] ${category === c ? "border-blue-500 bg-blue-500/10 font-semibold" : "border-border hover:bg-muted/40"}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${m.cls}`}><m.Icon className="w-3.5 h-3.5" /></span>{m.label}
            </button>
          );
        })}
      </div>
      {category === "FUNDS" && (
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Montant demandé ($)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-lg font-semibold tabular-nums" />
          <span className="block text-[11px] text-muted-foreground mt-1">L'administration peut accepter ou refuser. Si elle accepte, le montant est ajouté à ton portefeuille du jeu.</span>
        </label>
      )}
      <label className="block">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Sujet</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120}
          placeholder={category === "TECHNICAL" ? "Ex. : le jeu de trading ne se charge pas" : "Ton sujet"}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px]" />
      </label>
      <label className="block">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Message</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={2000}
          placeholder={category === "FUNDS" ? "Explique pourquoi tu as besoin de ce capital (ex. : tester une stratégie, recommencer après une mauvaise série…)" : "Décris ta demande le plus précisément possible"}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] resize-y" />
        <span className="block text-end text-[10.5px] text-muted-foreground">{body.length}/2000</span>
      </label>
      {error && <p className="text-[12.5px] text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-[13px] hover:bg-muted/50">Annuler</button>
        <button onClick={submit} disabled={busy || subject.trim().length < 3 || !body.trim()}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {busy ? "Envoi…" : "Envoyer au support"}
        </button>
      </div>
    </div>
  );
}
