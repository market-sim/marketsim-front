import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { TOKEN_KEY } from "../api/client";
import { accountApi, authApi, passkeyApi, type AuthResponse, type UpdateProfileRequest, type User } from "../api/endpoints";
import { getPasskeyAssertion } from "./webauthn";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** renvoie le jeton d'etape 2 si la double authentification est active, sinon null (connecte) */
  login: (email: string, password: string, captcha?: string | null) => Promise<string | null>;
  loginTwoFactor: (challenge: string, code: string) => Promise<void>;
  /** connexion sans mot de passe : Face ID, empreinte, Windows Hello */
  loginWithPasskey: () => Promise<void>;
  /** met a jour la photo dans l'etat local apres un envoi ou une suppression */
  setAvatar: (url: string | null) => void;
  register: (data: { firstName: string; lastName: string; email: string; password: string }, captcha?: string | null) => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  setLevel: (level: string) => void;
  /** recharge l'utilisateur depuis le serveur (apres confirmation d'e-mail, double authentification...) */
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** Garde l'utilisateur connecte en memoire et le token JWT dans le localStorage. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Au chargement : si un token existe, on recupere l'utilisateur
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const accept = (res: AuthResponse) => {
    if (!res.token || !res.user) throw new Error("Réponse de connexion incomplète");
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
  };

  const login = async (email: string, password: string, captcha?: string | null) => {
    const res = await authApi.login(email, password, captcha);
    if (res.twoFactorRequired && res.challenge) return res.challenge;
    accept(res);
    return null;
  };

  const loginTwoFactor = async (challenge: string, code: string) => {
    accept(await authApi.loginTwoFactor(challenge, code));
  };

  const loginWithPasskey = async () => {
    const options = await passkeyApi.loginOptions();
    const assertion = await getPasskeyAssertion(options);
    accept(await passkeyApi.login(assertion));
  };

  const setAvatar = useCallback((url: string | null) => {
    setUser((current) => current ? { ...current, avatarUrl: url } : current);
  }, []);

  const register = async (data: { firstName: string; lastName: string; email: string; password: string }, captcha?: string | null) => {
    accept(await authApi.register(data, captcha));
  };

  const updateProfile = async (data: UpdateProfileRequest) => {
    const profile = await authApi.updateProfile(data);
    if (profile.token) localStorage.setItem(TOKEN_KEY, profile.token);
    setUser((current) => current ? {
      ...current,
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
    } : current);
  };

  const setLevel = useCallback((level: string) => {
    setUser((current) => current ? { ...current, level } : current);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    setUser(await authApi.me());
  }, []);

  const logout = () => {
    // deconnexion cote serveur : la session est revoquee, le jeton ne marche plus nulle part
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) accountApi.logout(token).catch(() => { /* deja expire */ });
    localStorage.removeItem(TOKEN_KEY);
    try {
      sessionStorage.clear();
    } catch {
      // stockage indisponible
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginTwoFactor, loginWithPasskey, setAvatar, register, updateProfile, setLevel, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit etre utilise dans <AuthProvider>");
  return ctx;
}
