import { useEffect, useRef, useState } from "react";
import { Loader2, Wallet, X } from "lucide-react";
import { adminApi, type User } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { LEVEL_LABEL } from "../../progression/ProgressionContext";

const fmt = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

/** Fenetre de l'admin pour modifier le montant du portefeuille d'un trader (motif obligatoire). */
export default function EditBalanceDialog({ user, current, onClose, onSaved }: {
  user: User;
  /** solde actuel, null si le trader n'a jamais joue (portefeuille de depart 1 000 $) */
  current: number | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const start = current ?? 1000;
  const [amount, setAmount] = useState(start.toFixed(2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.select();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const value = Number(amount.replace(",", ".").replace(/\s/g, ""));
  const valid = Number.isFinite(value) && value >= 0 && value <= 1_000_000;
  const diff = valid ? value - start : 0;
  const quick: { label: string; v: (x: number) => number }[] = [
    { label: "+100", v: (x) => x + 100 },
    { label: "+500", v: (x) => x + 500 },
    { label: "−100", v: (x) => Math.max(0, x - 100) },
    { label: "×2", v: (x) => x * 2 },
    { label: "Départ (1 000 $)", v: () => 1000 },
  ];

  async function save() {
    if (!valid) return setError("Montant invalide : entre 0 et 1 000 000 $.");
    if (reason.trim().length < 3) return setError("Indique le motif (il apparaît dans le journal d'activité et chez le trader).");
    setBusy(true);
    setError("");
    try {
      const r = await adminApi.setBalance(user.id, value, reason.trim());
      onSaved(`Portefeuille de ${user.firstName} ${user.lastName} : ${fmt(r.before)} → ${fmt(r.after)}`
        + (r.levelBefore !== r.levelAfter ? ` · niveau ${LEVEL_LABEL[r.levelBefore]} → ${LEVEL_LABEL[r.levelAfter]}` : "")
        + ". Le trader a été prévenu.");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Modifier le portefeuille">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Wallet className="w-4 h-4 text-emerald-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Modifier le portefeuille</p>
            <p className="text-[11.5px] text-muted-foreground">{user.firstName} {user.lastName} · {user.email}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-muted-foreground">Solde actuel</span>
            <span className="font-semibold tabular-nums">{fmt(start)}{current === null && <span className="text-muted-foreground font-normal"> (n'a pas encore joué)</span>}</span>
          </div>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Nouveau montant ($)</span>
            <input ref={input} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              className={`w-full rounded-lg border bg-background px-3 py-2.5 text-lg font-semibold tabular-nums ${valid ? "border-border" : "border-red-500"}`} />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <button key={q.label} type="button" onClick={() => setAmount(q.v(valid ? value : start).toFixed(2))}
                className="rounded-full border border-border px-2.5 py-1 text-[11.5px] hover:bg-muted/60">{q.label}</button>
            ))}
          </div>
          {valid && diff !== 0 && (
            <p className={`text-[12.5px] font-medium ${diff > 0 ? "text-emerald-600" : "text-red-600"}`}>
              {diff > 0 ? "+" : ""}{fmt(diff)} par rapport au solde actuel
              {value < 1000 && " · sous 1 000 $, le trader redevient Débutant"}
              {value < 100 && " · sous 100 $, il devra recommencer"}
            </p>
          )}
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Motif (obligatoire)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200}
              placeholder="Ex. : bonus de démonstration, correction d'un bug, remise à zéro…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Le niveau est recalculé avec les règles du jeu (l'argent seul ne suffit pas pour monter). La modification est inscrite dans le journal d'activité et le trader reçoit une notification.
          </p>
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-[13px] hover:bg-muted/50">Annuler</button>
            <button onClick={save} disabled={busy || !valid || value === start}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
