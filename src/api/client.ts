import axios from "axios";

/** URL du backend Spring Boot (modifiable via le fichier .env). */
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8081/api";

export const TOKEN_KEY = "marketsim_token";

/** Instance axios partagee : ajoute automatiquement le token JWT a chaque requete. */
export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Token expire / invalide : on deconnecte et on renvoie vers /login
    if (error.response?.status === 401 && !location.pathname.startsWith("/login")) {
      localStorage.removeItem(TOKEN_KEY);
      location.href = "/login";
    }
    return Promise.reject(error);
  },
);

/** Message d'erreur lisible a partir d'une erreur axios. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Backend injoignable (Spring Boot est-il lance ?)";
    return error.response.data?.message ?? `Erreur ${error.response.status}`;
  }
  return "Erreur inattendue";
}
