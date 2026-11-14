import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ArrowLeft, Banknote, CheckCircle2, Inbox, Loader2, RotateCcw, Search, XCircle } from "lucide-react";
import { supportApi, type SupportCategory, type SupportStatus, type SupportThread, type SupportTicket } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import UserAvatar from "../../auth/UserAvatar";
import { CardShell, DISPLAY } from "../../shared/ui";
import { CATEGORY, STATUS, ThreadView, money, when } from "./supportUi";

const TABS: { id: "OPEN" | "ANSWERED" | "CLOSED" | "ALL"; label: string }[] = [
  { id: "OPEN", label: "À traiter" },
  { id: "ANSWERED", label: "Répondues" },
  { id: "CLOSED", label: "Résolues" },
  { id: "ALL", label: "Toutes" },
];

/** Boite de reception de l'administration : toutes les conversations des traders, reponses et demandes de fonds. */
export default function AdminMessagesPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("OPEN");
  const [category, setCategory] = useState<"ALL" | SupportCategory>("ALL");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<SupportTicket[]>([]);
  const [all, setAll] = useState<SupportTicket[]>([]);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [error, setError] = useState("");
  const selected = Number(params.get("t")) || null;

  const loadList = useCallback(() => {
    supportApi.all(tab, category).then(setList).catch((e) => setError(errorMessage(e)));
    supportApi.all("ALL", "ALL").then(setAll).catch(() => {});
  }, [tab, category]);
  const loadThread = useCallback((id: number) => supportApi.open(id).then(setThread).catch((e) => setError(errorMessage(e))), []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    if (selected) loadThread(selected).then(() => loadList());
    else setThread(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useEffect(() => {
    const id = window.setInterval(() => {
      loadList();
      if (selected) supportApi.open(selected).then(setThread).catch(() => {});
    }, 10_000);
    return () => window.clearInterval(id);
  }, [selected, loadList]);

  const counts = useMemo(() => ({
    OPEN: all.filter((t) => t.status === "OPEN").length,
    ANSWERED: all.filter((t) => t.status === "ANSWERED").length,
    CLOSED: all.filter((t) => t.status === "CLOSED").length,
    ALL: all.length,
  }), [all]);

  const q = query.trim().toLowerCase();
  const shown = q ? list.filter((t) => `${t.subject} ${t.userName} ${t.userEmail}`.toLowerCase().includes(q)) : list;

  const update = (t: SupportThread) => {
    setThread(t);
    loadList();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 h-[calc(100vh-170px)] min-h-[520px]">
      <CardShell className={`flex flex-col min-h-0 overflow-hidden ${selected ? "hidden lg:flex" : "flex"}`}>
        <div className="px-4 pt-3.5 pb-2 border-b border-border space-y-2.5">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground flex-1" style={DISPLAY}>Messagerie des traders</h3>
            {counts.OPEN > 0 && <span className="rounded-full bg-amber-500/15 text-amber-600 text-[11px] font-semibold px-2 py-0.5">{counts.OPEN} à traiter</span>}
          </div>
          <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
            {TABS.map((tb) => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={`flex-1 rounded-md px-2 py-1 text-[11.5px] ${tab === tb.id ? "bg-card shadow-sm font-semibold text-foreground" : "text-muted-foreground"}`}>
                {tb.label} <span className="opacity-60">{counts[tb.id]}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, e-mail, sujet…" className="flex-1 bg-transparent py-1.5 text-[12.5px] outline-none" />
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}
              className="rounded-lg border border-border bg-background px-2 text-[12px]">
              <option value="ALL">Tous les types</option>
              {(Object.keys(CATEGORY) as SupportCategory[]).map((c) => <option key={c} value={c}>{CATEGORY[c].label}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="px-4 py-2 text-[12px] text-red-600">{error}</p>}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {shown.length === 0 && <p className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">Aucune conversation ici.</p>}
          {shown.map((t) => {
            const c = CATEGORY[t.category];
            const [first, ...rest] = (t.userName ?? "?").split(" ");
            return (
              <button key={t.id} onClick={() => setParams({ t: String(t.id) })}
                className={`w-full text-start px-4 py-3 hover:bg-muted/40 ${selected === t.id ? "bg-blue-500/10" : ""}`}>
                <div className="flex items-center gap-2.5">
                  <UserAvatar firstName={first} lastName={rest.join(" ")} avatarUrl={t.userAvatarUrl} size={30} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12.5px] truncate ${t.unread ? "font-bold" : "font-medium"} text-foreground`}>{t.userName}</p>
                    <p className="text-[12px] text-foreground/80 truncate">{t.subject}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-[10.5px] text-muted-foreground">{when(t.lastMessageAt)}</p>
                    {t.unread && <span className="inline-block mt-1 w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 ps-10">
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${c.cls}`}>{c.label}</span>
                  {t.requestedAmount !== null && (
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${t.requestStatus === "PENDING" ? "bg-amber-500/15 text-amber-600" : t.requestStatus === "APPROVED" ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                      {money(t.requestedAmount)}
                    </span>
                  )}
                  <span className="ms-auto text-[10.5px] text-muted-foreground truncate max-w-[45%]">{t.lastFromAdmin ? "Toi : " : ""}{t.lastMessage}</span>
                </div>
              </button>
            );
          })}
        </div>
      </CardShell>

      <CardShell className={`flex flex-col min-h-0 overflow-hidden ${selected ? "flex" : "hidden lg:flex"}`}>
        {thread ? (
          <ThreadView
            thread={thread}
            placeholder="Réponse au trader…"
            onSend={async (text) => update(await supportApi.reply(thread.ticket.id, text))}
            header={<AdminHeader ticket={thread.ticket} onBack={() => setParams({})} onUpdate={update} />}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Inbox className="w-10 h-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">Choisis une conversation</p>
            <p className="text-[12px] text-muted-foreground mt-1">Les demandes « À traiter » attendent une réponse.</p>
          </div>
        )}
      </CardShell>
    </div>
  );
}

function AdminHeader({ ticket, onBack, onUpdate }: { ticket: SupportTicket; onBack: () => void; onUpdate: (t: SupportThread) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "approve" | "reject" | "status">("");
  const [error, setError] = useState("");
  const [first, ...rest] = (ticket.userName ?? "?").split(" ");

  async function run(kind: "approve" | "reject" | "status", fn: () => Promise<SupportThread>) {
    setBusy(kind);
    setError("");
    try {
      onUpdate(await fn());
      setNote("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  }

  const next: SupportStatus = ticket.status === "CLOSED" ? "OPEN" : "CLOSED";
  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-3 px-5 py-3.5">
        <button onClick={onBack} className="lg:hidden p-1 rounded hover:bg-muted" aria-label="Retour"><ArrowLeft className="w-4 h-4 rtl:rotate-180" /></button>
        <UserAvatar firstName={first} lastName={rest.join(" ")} avatarUrl={ticket.userAvatarUrl} size={38} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
          <p className="text-[11.5px] text-muted-foreground truncate">{ticket.userName} · {ticket.userEmail} · {CATEGORY[ticket.category].label}</p>
        </div>
        <span className={`text-[10.5px] font-semibold rounded-full px-2.5 py-1 ${STATUS[ticket.status].cls}`}>{STATUS[ticket.status].label}</span>
        <button onClick={() => run("status", () => supportApi.setStatus(ticket.id, next))} disabled={!!busy}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] hover:bg-muted/50 disabled:opacity-50">
          {next === "CLOSED" ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Marquer résolu</> : <><RotateCcw className="w-3.5 h-3.5" /> Rouvrir</>}
        </button>
      </div>

      {ticket.category === "FUNDS" && ticket.requestedAmount !== null && (
        <div className={`mx-5 mb-3 rounded-xl border px-4 py-3 ${ticket.requestStatus === "PENDING" ? "border-amber-400/40 bg-amber-500/5" : "border-border bg-muted/30"}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground"><Banknote className="w-4 h-4 text-emerald-600" /> Demande de {money(ticket.requestedAmount)}</span>
            {ticket.userBalance !== null && (
              <span className="text-[12px] text-muted-foreground">
                solde actuel {money(ticket.userBalance)}
                {ticket.requestStatus === "PENDING" && <> → <b className="text-foreground">{money(ticket.userBalance + ticket.requestedAmount)}</b> si acceptée</>}
              </span>
            )}
            {ticket.requestStatus !== "PENDING" && (
              <span className={`ms-auto text-[11px] font-semibold rounded-full px-2 py-0.5 ${ticket.requestStatus === "APPROVED" ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                {ticket.requestStatus === "APPROVED" ? "Acceptée" : "Refusée"}
              </span>
            )}
          </div>
          {ticket.requestStatus === "PENDING" && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Mot pour le trader (facultatif)"
                className="flex-1 min-w-[180px] rounded-lg border border-border bg-background px-3 py-1.5 text-[12.5px]" />
              <button onClick={() => run("approve", () => supportApi.decide(ticket.id, true, note))} disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
                {busy === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Accepter et créditer
              </button>
              <button onClick={() => run("reject", () => supportApi.decide(ticket.id, false, note))} disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/50 text-red-600 hover:bg-red-500/10 px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">
                {busy === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Refuser
              </button>
            </div>
          )}
          {error && <p className="text-[12px] text-red-600 mt-1.5">{error}</p>}
        </div>
      )}
      {error && ticket.category !== "FUNDS" && <p className="px-5 pb-2 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
