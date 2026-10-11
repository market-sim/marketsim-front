// Tous les appels vers le backend, regroupes par module.
// Chaque membre du groupe ajoute ici les fonctions de SON module.
import { api } from "./client";

// ─── Module 1 : Utilisateurs & Administration ────────────────────────────────
export type Role = "USER" | "ADMIN";
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  level: string;
  virtualBalance: number;
  enabled: boolean;
  createdAt: string;
}
export interface AuthResponse { token: string; user: User }

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }).then((r) => r.data),
  register: (data: { firstName: string; lastName: string; email: string; password: string }) =>
    api.post<AuthResponse>("/auth/register", data).then((r) => r.data),
  me: () => api.get<User>("/users/me").then((r) => r.data),
};

export const adminApi = {
  users: () => api.get<User[]>("/admin/users").then((r) => r.data),
  setEnabled: (id: number, value: boolean) =>
    api.patch<User>(`/admin/users/${id}/enabled`, null, { params: { value } }).then((r) => r.data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
};

// ─── Module 2 : Trading & Gestion du Risque ──────────────────────────────────
export interface TradeOrder {
  id?: number;
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT" | "STOP";
  quantity: number;
  price: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  status?: "OPEN" | "CLOSED" | "CANCELLED";
  createdAt?: string;
}

export const ordersApi = {
  list: () => api.get<TradeOrder[]>("/trading/orders").then((r) => r.data),
  create: (o: TradeOrder) => api.post<TradeOrder>("/trading/orders", o).then((r) => r.data),
  update: (id: number, o: Partial<TradeOrder>) => api.put<TradeOrder>(`/trading/orders/${id}`, o).then((r) => r.data),
  remove: (id: number) => api.delete(`/trading/orders/${id}`),
};

// ─── Module 3 : Analyse Financiere & Backtesting ─────────────────────────────
export interface Strategy {
  id?: number;
  name: string;
  description?: string;
  indicators?: string;
  status?: "ACTIVE" | "PAUSED";
  sharpe?: number | null;
  winRate?: number | null;
  maxDrawdown?: number | null;
  trades?: number | null;
}

export const strategiesApi = {
  list: () => api.get<Strategy[]>("/analysis/strategies").then((r) => r.data),
  create: (s: Strategy) => api.post<Strategy>("/analysis/strategies", s).then((r) => r.data),
  update: (id: number, s: Strategy) => api.put<Strategy>(`/analysis/strategies/${id}`, s).then((r) => r.data),
  remove: (id: number) => api.delete(`/analysis/strategies/${id}`),
};

// ─── Module 4 : Formation & Pedagogie ────────────────────────────────────────
export interface Course {
  id?: number;
  title: string;
  description?: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  lessons?: number;
  durationMinutes?: number;
}

export const coursesApi = {
  list: () => api.get<Course[]>("/education/courses").then((r) => r.data),
  create: (c: Course) => api.post<Course>("/education/courses", c).then((r) => r.data),
  update: (id: number, c: Course) => api.put<Course>(`/education/courses/${id}`, c).then((r) => r.data),
  remove: (id: number) => api.delete(`/education/courses/${id}`),
};

// ─── Module 5 : Marche, Prediction & Sentiment ───────────────────────────────
export interface Asset {
  id?: number;
  symbol: string;
  name: string;
  type: "STOCK" | "BOND" | "COMMODITY" | "FOREX" | "CRYPTO";
  price: number;
  changePct: number;
}

export const assetsApi = {
  list: () => api.get<Asset[]>("/market/assets").then((r) => r.data),
  create: (a: Asset) => api.post<Asset>("/market/assets", a).then((r) => r.data),
  update: (id: number, a: Asset) => api.put<Asset>(`/market/assets/${id}`, a).then((r) => r.data),
  remove: (id: number) => api.delete(`/market/assets/${id}`),
};

// ─── Module 6 : Agent de Trading Intelligent ─────────────────────────────────
export interface AgentConfig {
  id?: number;
  name: string;
  strategy?: string;
  riskLevel?: number;
  allowedAssets?: string;
  maxPositionSize?: number;
  active?: boolean;
}

export const agentsApi = {
  list: () => api.get<AgentConfig[]>("/agents").then((r) => r.data),
  create: (a: AgentConfig) => api.post<AgentConfig>("/agents", a).then((r) => r.data),
  update: (id: number, a: AgentConfig) => api.put<AgentConfig>(`/agents/${id}`, a).then((r) => r.data),
  toggle: (id: number) => api.patch<AgentConfig>(`/agents/${id}/toggle`).then((r) => r.data),
  remove: (id: number) => api.delete(`/agents/${id}`),
};

// ─── Module 7 : Stress Testing Bancaire & Actuariat ──────────────────────────
export interface StressScenario {
  id?: number;
  name: string;
  description?: string;
  severity: "MODERATE" | "HIGH" | "SEVERE" | "EXTREME";
  gdpShock: number;
  rateShock: number;
  creditShock: number;
}

export const scenariosApi = {
  list: () => api.get<StressScenario[]>("/stress/scenarios").then((r) => r.data),
  create: (s: StressScenario) => api.post<StressScenario>("/stress/scenarios", s).then((r) => r.data),
  update: (id: number, s: StressScenario) => api.put<StressScenario>(`/stress/scenarios/${id}`, s).then((r) => r.data),
  remove: (id: number) => api.delete(`/stress/scenarios/${id}`),
};
