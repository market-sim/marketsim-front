import { useRef, useState, type ReactNode } from "react";
import { errorMessage } from "../../../api/client";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../app/components/ui/alert-dialog";
import { Button } from "../../../app/components/ui/button";
import { OUTLINE_DARK, useReturnFocus } from "./Feedback";

interface Props {
  title: string;
  description: ReactNode;
  /** texte du bouton de confirmation, ex. « Supprimer » */
  confirmLabel: string;
  /** action a lancer ; la fenetre se ferme si elle reussit, sinon l'erreur du back s'affiche */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Confirmation avant une suppression definitive. A monter seulement quand elle doit s'afficher. */
export default function ConfirmDialog({ title, description, confirmLabel, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const returnFocus = useReturnFocus();
  /** vrai une fois l'action reussie : l'element supprime, et le bouton qui a ouvert la fenetre, vont disparaitre */
  const done = useRef(false);

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      done.current = true;
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <AlertDialogContent onCloseAutoFocus={(event) => returnFocus(event, done.current)}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel className={OUTLINE_DARK} disabled={busy}>Annuler</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={confirm}>{busy ? "Suppression…" : confirmLabel}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
