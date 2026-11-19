import { useState, type FormEvent, type ReactNode } from "react";
import { errorMessage } from "../../../api/client";
import { Button } from "../../../app/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../app/components/ui/dialog";
import { Input } from "../../../app/components/ui/input";
import { Textarea } from "../../../app/components/ui/textarea";
import { isConflict } from "../errors";
import { Field, FIELD_DARK, OUTLINE_DARK, useReturnFocus } from "./Feedback";

interface Props {
  title: string;
  description?: ReactNode;
  /** texte du bouton, ex. « Enregistrer » ou « Renommer » */
  confirmLabel: string;
  initialName: string;
  nameMax: number;
  /** message d'erreur du nom, ou "" s'il est valide (memes regles que le back) */
  validateName: (name: string) => string;
  /** champ « Description » facultatif (configurations d'indicateurs) */
  descriptionField?: { initial: string; max: number };
  /** enregistre ; la fenetre se ferme si l'appel reussit, sinon l'erreur du back s'affiche */
  onSubmit: (name: string, description: string) => Promise<void>;
  onClose: () => void;
}

/** Fenetre de saisie d'un nom (enregistrer, renommer). A monter seulement quand elle doit s'afficher. */
export default function NameDialog({
  title, description, confirmLabel, initialName, nameMax, validateName, descriptionField, onSubmit, onClose,
}: Props) {
  const [name, setName] = useState(initialName);
  const [text, setText] = useState(descriptionField?.initial ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  /** erreur du back : un nom deja pris (409) va sous le champ Nom, le reste en bas de la fenetre */
  const [serverError, setServerError] = useState<{ message: string; onName: boolean } | null>(null);
  const returnFocus = useReturnFocus();

  const nameError = validateName(name);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (nameError) return;
    setBusy(true);
    setServerError(null);
    try {
      await onSubmit(name.trim(), text.trim());
      onClose();
    } catch (err) {
      const conflict = isConflict(err);
      // sous le champ Nom, le prefixe « name : » du message du back est inutile
      const stripped = errorMessage(err).replace(/^name\s*:\s*/, "");
      const message = conflict ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : errorMessage(err);
      setServerError({ message, onName: conflict });
      setBusy(false);
    }
  };

  const shownNameError = (submitted ? nameError : "") || (serverError?.onName ? serverError.message : "");

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent onCloseAutoFocus={returnFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Nom" htmlFor="name-dialog-name" error={shownNameError || undefined}
            hint={`${name.trim().length} / ${nameMax} caractères`}>
            <Input id="name-dialog-name" className={FIELD_DARK} value={name} maxLength={nameMax} autoFocus
              aria-invalid={!!shownNameError}
              onChange={(e) => { setName(e.target.value); if (serverError?.onName) setServerError(null); }} />
          </Field>
          {descriptionField && (
            <Field label="Description (facultatif)" htmlFor="name-dialog-description">
              <Textarea id="name-dialog-description" className={FIELD_DARK} value={text} maxLength={descriptionField.max} rows={2}
                onChange={(e) => setText(e.target.value)} />
            </Field>
          )}
          {serverError && !serverError.onName && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{serverError.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className={OUTLINE_DARK} disabled={busy} onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={busy}>{busy ? "Enregistrement…" : confirmLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
