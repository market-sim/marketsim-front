import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Ce que l'utilisateur regarde : une page peut le dire au coach pour qu'il analyse le bon actif avec le bon agent. */
export interface CoachFocus {
  symbol?: string;
  agentId?: number;
}

interface CoachState {
  focus: CoachFocus;
  setFocus: (f: CoachFocus) => void;
}

const CoachContext = createContext<CoachState>({ focus: {}, setFocus: () => {} });

export function CoachProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<CoachFocus>({});
  return <CoachContext.Provider value={{ focus, setFocus }}>{children}</CoachContext.Provider>;
}

export const useCoach = () => useContext(CoachContext);

/**
 * A appeler depuis une page : « l'utilisateur regarde cet actif (et cet agent) ».
 * Exemple : {@code useCoachFocus("AAPL", agent?.id)}. Le focus est retire quand la page se ferme.
 */
export function useCoachFocus(symbol?: string, agentId?: number) {
  const { setFocus } = useCoach();
  useEffect(() => {
    setFocus({ symbol, agentId });
    return () => setFocus({});
  }, [symbol, agentId, setFocus]);
}
