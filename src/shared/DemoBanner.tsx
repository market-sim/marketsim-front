import { FlaskConical } from "lucide-react";

/**
 * Bandeau tres visible pour les blocs qui affichent encore des donnees de demonstration (module pas encore branche
 * sur le backend). Rien de ce qui est sous ce bandeau ne doit etre pris pour une vraie donnee.
 */
export default function DemoBanner({ module, what, className = "" }: { module: string; what?: string; className?: string }) {
  return (
    <div role="note" data-testid="demo-banner"
      className={`flex items-start gap-2.5 rounded-lg border-2 border-dashed border-amber-500/70 bg-amber-500/10 px-3.5 py-2.5 text-[12.5px] text-amber-900 dark:text-amber-200 ${className}`}>
      <FlaskConical className="w-4 h-4 shrink-0 mt-0.5" />
      <p>
        <b>Module en cours de développement — données de démonstration.</b>{" "}
        {what ?? "Les valeurs ci-dessous sont fictives"} ({module}).
      </p>
    </div>
  );
}
