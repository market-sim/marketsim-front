import { useRef, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { DISPLAY } from "../../../shared/ui";
import { Label } from "../../../app/components/ui/label";

/*
 * Theme sombre : la variable --input du theme est transparente, donc les composants de app/components/ui
 * (champ, liste deroulante, interrupteur, bouton « outline ») perdent leur fond ou leur bordure.
 * Ces classes leur redonnent les couleurs prevues par theme.css, sans modifier les composants partages.
 */
export const FIELD_DARK = "dark:bg-input-background";
export const SWITCH_DARK = "dark:data-[state=unchecked]:bg-switch-background";
export const OUTLINE_DARK = "dark:border-border";

/**
 * Navigation au clavier : les fenetres du module sont ouvertes par un bouton de la page (sans DialogTrigger),
 * donc a la fermeture Radix ne sait pas a qui rendre le focus et le laisse sur la page entiere.
 * Ce hook retient l'element qui avait le focus a l'ouverture et le lui rend a la fermeture.
 * Si ce bouton n'existe plus (ligne supprimee), le focus va sur le panneau de l'onglet affiche : il est toujours la,
 * et la touche Tab repart alors du debut de l'onglet au lieu du debut de la page.
 * A passer au contenu de la fenetre : <DialogContent onCloseAutoFocus={returnFocus}>.
 */
export function useReturnFocus() {
  // lus au premier rendu : a ce moment le focus est encore sur le bouton qui ouvre la fenetre
  const opener = useRef(document.activeElement as HTMLElement | null);
  const panel = useRef(opener.current?.closest<HTMLElement>('[role="tabpanel"]') ?? null);
  /** openerGone : a passer a vrai quand on sait que le bouton va disparaitre (sa ligne vient d'etre supprimee). */
  return (event: Event, openerGone = false) => {
    event.preventDefault();
    if (!openerGone && opener.current?.isConnected) opener.current.focus();
    // preventScroll : le panneau est plus haut que l'ecran, on ne veut pas que la page saute
    else panel.current?.focus({ preventScroll: true });
  };
}

/** Message d'erreur (le plus souvent celui renvoye par le back), avec un bouton pour reessayer. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">Réessayer</button>
      )}
    </div>
  );
}

/** Etat vide d'une liste ou d'un ecran : une icone, une phrase, une action. */
export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4 text-blue-600">{icon}</div>
      <h3 className="text-base font-semibold text-foreground" style={DISPLAY}>{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{text}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Champ de formulaire : libelle, controle, puis l'erreur ou une aide. */
export function Field({ label, htmlFor, hint, error, className = "", children }: {
  label: string; htmlFor?: string; hint?: string; error?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-red-600 mt-1">{error}</p> : hint ? <p className="text-[11px] text-muted-foreground mt-1">{hint}</p> : null}
    </div>
  );
}
