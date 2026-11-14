import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { progressionApi, type Progression, type TraderLevel } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";

/** Libelles et couleurs des niveaux (partages par le badge, le guide et le jeu). */
export const LEVEL_LABEL: Record<TraderLevel, string> = {
  DEBUTANT: "Débutant",
  INTERMEDIAIRE: "Intermédiaire",
  AVANCE: "Avancé",
  EXPERT: "Expert",
};
export const LEVEL_COLOR: Record<TraderLevel, string> = {
  DEBUTANT: "#22C55E",
  INTERMEDIAIRE: "#0EA5E9",
  AVANCE: "#A855F7",
  EXPERT: "#F59E0B",
};

export const money = (v: number) =>
  `${v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $`;

interface ProgressionState {
  progression: Progression | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  /** remplace l'etat apres une partie ou un redemarrage (evite un aller-retour reseau) */
  update: (p: Progression) => void;
}

const Ctx = createContext<ProgressionState | null>(null);

/** Charge le portefeuille et le niveau du trader connecte, et garde le niveau du profil synchronise. */
export function ProgressionProvider({ children }: { children: ReactNode }) {
  const { user, setLevel } = useAuth();
  const [progression, setProgression] = useState<Progression | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = useCallback((p: Progression) => {
    setProgression(p);
    setLevel(p.level);
  }, [setLevel]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      update(await progressionApi.me());
    } catch {
      setError("Progression indisponible");
    } finally {
      setLoading(false);
    }
  }, [update]);

  const userId = user?.id;
  // l'administrateur gere la plateforme : pas de portefeuille, pas de niveau, pas de score
  const isAdmin = user?.role === "ADMIN";
  useEffect(() => {
    if (userId == null || isAdmin) {
      setProgression(null);
      return;
    }
    void refresh();
  }, [userId, isAdmin, refresh]);

  return <Ctx.Provider value={{ progression, loading, error, refresh, update }}>{children}</Ctx.Provider>;
}

export function useProgression() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProgression doit etre utilise dans <ProgressionProvider>");
  return ctx;
}
