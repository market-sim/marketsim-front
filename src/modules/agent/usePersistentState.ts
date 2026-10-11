import { useEffect, useState } from "react";

/**
 * Comme useState, mais la valeur survit au changement d'onglet et au rafraichissement de la page
 * (sessionStorage, propre a l'onglet du navigateur). Quand la cle change (autre agent), la valeur
 * correspondant a la nouvelle cle est rechargee.
 */
export function usePersistentState<T>(key: string, initial: T): [T, (value: T) => void] {
  const read = (k: string): T => {
    try {
      const raw = sessionStorage.getItem(k);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  };

  const [state, setState] = useState<{ key: string; value: T }>(() => ({ key, value: read(key) }));

  // nouvelle cle (ex : un autre agent selectionne) : on recharge sa valeur
  useEffect(() => {
    if (state.key !== key) setState({ key, value: read(key) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = (value: T) => {
    setState({ key, value });
    try {
      if (value == null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // stockage plein ou indisponible : la valeur reste au moins en memoire
    }
  };

  return [state.key === key ? state.value : read(key), set];
}
