import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../app/components/ui/dialog";
import { DISPLAY } from "./ui";

export interface ConfirmRequest {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** danger = bouton rouge (action destructive ou irreversible). */
  tone?: "danger" | "primary";
  onConfirm: () => Promise<void> | void;
}

/** Boite de confirmation reutilisable (remplace window.confirm). Passer null pour la fermer. */
export default function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!request) return null;
  const run = async () => {
    setBusy(true);
    try {
      await request.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };
  const btn = "px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60";
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={DISPLAY}>{request.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground space-y-2">{request.description}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button onClick={onClose} disabled={busy} className={`${btn} border border-border text-foreground hover:bg-muted/50`}>Annuler</button>
          <button onClick={run} disabled={busy}
            className={`${btn} text-white ${request.tone === "danger" ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"}`}>
            {busy ? "…" : request.confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
