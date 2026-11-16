import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../app/components/ui/dialog";
import { DISPLAY } from "./ui";

export interface PromptRequest {
  title: string;
  description?: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Lecture seule : affiche une valeur a copier (ex. un lien), avec un bouton « Copier ». */
  readOnly?: boolean;
  maxLength?: number;
  /** Valeur validee (jamais appelee en lecture seule). Une erreur levee est affichee dans la boite. */
  onSubmit?: (value: string) => Promise<void> | void;
}

/** Boite de saisie reutilisable (remplace window.prompt). Passer null pour la fermer. */
export default function PromptDialog({ request, onClose }: { request: PromptRequest | null; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) return;
    setValue(request.initialValue ?? "");
    setError("");
    setCopied(false);
    window.setTimeout(() => input.current?.select(), 50);
  }, [request]);

  if (!request) return null;

  const submit = async () => {
    if (request.readOnly) {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      } catch {
        input.current?.select();
        setError("Copie automatique impossible : le texte est sélectionné, fais Ctrl+C.");
      }
      return;
    }
    if (!value.trim()) { setError("Ce champ est obligatoire."); return; }
    setBusy(true);
    setError("");
    try {
      await request.onSubmit?.(value.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };
  const btn = "px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60";
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={DISPLAY}>{request.title}</DialogTitle>
          {request.description && <DialogDescription>{request.description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{request.label}</label>
          <input ref={input} value={value} readOnly={request.readOnly} maxLength={request.maxLength ?? 120}
            onChange={(e) => setValue(e.target.value)} placeholder={request.placeholder}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          {copied && <p className="text-[12px] text-emerald-600">Copié dans le presse-papiers ✓</p>}
        </form>
        <DialogFooter>
          <button onClick={onClose} disabled={busy} className={`${btn} border border-border text-foreground hover:bg-muted/50`}>
            {request.readOnly ? "Fermer" : "Annuler"}
          </button>
          <button onClick={() => void submit()} disabled={busy} className={`${btn} text-white bg-blue-600 hover:bg-blue-700`}>
            {busy ? "…" : request.readOnly ? "Copier" : request.confirmLabel ?? "Valider"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
