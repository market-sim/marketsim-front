import axios from "axios";

/**
 * Vrai si le back a repondu 404 : l'element vise n'existe plus (supprime entre-temps, depuis un autre onglet par exemple).
 * L'ecran doit alors se remettre a jour au lieu de garder une ligne perimee.
 */
export const isNotFound = (error: unknown): boolean => axios.isAxiosError(error) && error.response?.status === 404;

/** Vrai si le back a repondu 409 : conflit, par exemple un nom deja utilise par une autre configuration. */
export const isConflict = (error: unknown): boolean => axios.isAxiosError(error) && error.response?.status === 409;

/**
 * Pour une suppression : un 404 veut dire « deja supprime ailleurs ». Le but est atteint, on continue comme apres
 * un succes ; toute autre erreur est relancee. S'utilise ainsi : await api.remove(id).catch(ignoreNotFound).
 */
export const ignoreNotFound = (error: unknown): void => {
  if (!isNotFound(error)) throw error;
};
