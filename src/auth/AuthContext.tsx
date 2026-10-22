import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { TOKEN_KEY } from "../api/client";
import { authApi, type UpdateProfileRequest, type User } from "../api/endpoints";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { firstName: string; lastName: string; email: string; password: string }) => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
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

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
  };

  const register = async (data: { firstName: string; lastName: string; email: string; password: string }) => {
    const res = await authApi.register(data);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
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

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    try {
      sessionStorage.clear();
    } catch {
      // stockage indisponible
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit etre utilise dans <AuthProvider>");
  return ctx;
}
