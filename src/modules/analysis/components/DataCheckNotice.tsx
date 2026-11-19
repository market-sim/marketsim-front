import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, RotateCcw } from "lucide-react";
import type { DataCheck } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { Button } from "../../../app/components/ui/button";
import { deSymbol } from "../format";
import { OUTLINE_DARK } from "./Feedback";

interface Props {
  /** identifiant de l'enregistrement : la verification est relancee quand il change */
  recordId: number;
  symbol: string;
  /** appel de verification (GET .../data-check) */
  load: () => Promise<DataCheck>;
  /** relance avec les memes reglages ; absent = bouton non propose */
  onRerun?: () => void;
  /** raison pour laquelle la relance est impossible (ex. une strategie a ete supprimee) */
  rerunBlockedReason?: string;
  /** precision affichee sous le bouton (ex. une strategie a ete modifiee depuis) */
  rerunNote?: string;
}

const frDate = (iso: string | null | undefined) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR") : "");

/**
 * Verification des cours d'un backtest ou d'une comparaison enregistres : on compare l'empreinte des seances de
 * la periode enregistree a celle des cours actuels sur la meme periode. Seul un ecart affiche une alerte.
 */
export default function DataCheckNotice({ recordId, symbol, load, onRerun, rerunBlockedReason, rerunNote }: Props) {
  const [check, setCheck] = useState<DataCheck | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCheck(null);
    setError("");
    load()
      .then((c) => { if (!cancelled) setCheck(c); })
      .catch((e) => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, retry]);

  const quiet = "flex items-start gap-2 text-[12px] text-muted-foreground";

  if (error) {
    return (
      <p className={quiet} role="status">
        <Info className="w-4 h-4 shrink-0 mt-px" />
        <span>Vérification des cours impossible pour le moment ({error}).{" "}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setRetry((n) => n + 1)}>Réessayer</button>
        </span>
      </p>
    );
  }
  if (!check) {
    return (
      <p className={quiet} role="status">
        <Loader2 className="w-4 h-4 shrink-0 mt-px animate-spin" />Vérification des cours de la période…
      </p>
    );
  }

  switch (check.status) {
    case "SAME":
      return (
        <p className={quiet} role="status">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-px text-emerald-600 dark:text-emerald-400" />
          Cours {deSymbol(symbol)} inchangés sur la période depuis l'enregistrement : relancer donnerait le même résultat.
        </p>
      );
    case "UNVERIFIABLE":
      return (
        <p className={quiet} role="status">
          <Info className="w-4 h-4 shrink-0 mt-px" />
          Cours non vérifiables : cet enregistrement date d'avant l'empreinte par période (19/11/2026).
        </p>
      );
    case "UNAVAILABLE":
      return (
        <p className={quiet} role="status">
          <Info className="w-4 h-4 shrink-0 mt-px" />
          <span>Les cours actuels {deSymbol(symbol)} n'ont pas pu être chargés : vérification impossible pour le moment.{" "}
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setRetry((n) => n + 1)}>Réessayer</button>
          </span>
        </p>
      );
    case "NOT_COVERED":
      return (
        <p className={quiet} role="status">
          <Info className="w-4 h-4 shrink-0 mt-px" />
          L'historique disponible {deSymbol(symbol)} va aujourd'hui du {frDate(check.currentFirst)} au {frDate(check.currentLast)} (la source
          garde 10 ans) : il ne couvre plus toute la période enregistrée, la vérification n'est pas possible.
        </p>
      );
    case "CHANGED":
      return (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1 space-y-2">
            <p>
              Les cours {deSymbol(symbol)} du {frDate(check.from)} au {frDate(check.to)} ont été ajustés depuis l'enregistrement
              (dividendes, divisions d'actions ou correction de la source). Les résultats ci-dessous restent ceux calculés
              ce jour-là ; relancer donnerait un résultat un peu différent.
            </p>
            {onRerun && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {/* libelle sur deux lignes sur un telephone, plutot qu'un bouton qui deborde du bandeau */}
                <Button size="sm" variant="outline" className={`max-w-full h-auto min-h-8 py-1.5 whitespace-normal text-left ${OUTLINE_DARK}`}
                  disabled={!!rerunBlockedReason} onClick={onRerun}>
                  <RotateCcw />Relancer avec les mêmes réglages
                </Button>
                {(rerunBlockedReason || rerunNote) && <span className="text-[12px]">{rerunBlockedReason ?? rerunNote}</span>}
              </div>
            )}
          </div>
        </div>
      );
  }
}
