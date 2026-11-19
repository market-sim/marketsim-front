import { ShieldCheck } from "lucide-react";
import type { Asset, BacktestSettings } from "../../../../api/endpoints";
import { CardShell, DISPLAY } from "../../../../shared/ui";
import AdminDefaults from "./AdminDefaults";
import AdminFundamentalsCache from "./AdminFundamentalsCache";
import AdminResults, { type ResultsView } from "./AdminResults";
import AdminStatistics from "./AdminStatistics";

export type AdminSection = "defaults" | "results" | "stats" | "cache";

const SECTIONS: { id: AdminSection; label: string }[] = [
  { id: "defaults", label: "Paramètres par défaut" },
  { id: "results", label: "Résultats" },
  { id: "stats", label: "Statistiques" },
  { id: "cache", label: "Cache fondamental" },
];

interface Props {
  assets: Asset[];
  /** section affichee (lue dans l'URL) */
  section: AdminSection;
  onSection: (section: AdminSection) => void;
  /** Resultats : liste affichee et element ouvert (lus dans l'URL) */
  view: ResultsView;
  openId: number | null;
  /** change les parametres de l'URL dans la section en cours (view, id) */
  onNavigate: (params: Record<string, string>) => void;
  /** les parametres par defaut ont change : les formulaires Backtest et Comparaison sont a mettre a jour */
  onDefaultsChanged: (d: BacktestSettings) => void;
}

/**
 * Onglet « Administration » du module 3, monte seulement pour un ADMIN. Toutes ses donnees viennent de
 * /api/analysis/admin/**, routes qui repondent 403 a un utilisateur ordinaire : masquer l'onglet n'est qu'un
 * confort, la protection est cote back.
 */
export default function AdminTab({ assets, section, onSection, view, openId, onNavigate, onDefaultsChanged }: Props) {
  // l'element ouvert masque le selecteur, comme dans l'historique
  const inDetail = section === "results" && openId != null;
  return (
    <div className="space-y-4">
      {!inDetail && (
        <CardShell className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 dark:bg-blue-950/40">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Administration du module</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5 max-w-3xl">
                Paramètres des simulations, résultats et statistiques de tous les utilisateurs, cache de l'analyse fondamentale.
                Réservé aux administrateurs.
              </p>
            </div>
          </div>
          <div role="group" aria-label="Section de l'administration"
            className="grid grid-cols-2 gap-0.5 rounded-lg border border-border p-0.5 sm:flex sm:w-fit sm:flex-wrap">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" aria-pressed={section === s.id} onClick={() => onSection(s.id)}
                className={`px-2 py-1 min-h-8 rounded-md text-[13px] font-medium leading-tight sm:px-3 sm:whitespace-nowrap transition-colors ${section === s.id ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted/50"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </CardShell>
      )}

      {section === "defaults" && <AdminDefaults onDefaultsChanged={onDefaultsChanged} />}
      {section === "results" && <AdminResults assets={assets} view={view} openId={openId} onNavigate={onNavigate} />}
      {section === "stats" && <AdminStatistics />}
      {section === "cache" && <AdminFundamentalsCache />}
    </div>
  );
}
