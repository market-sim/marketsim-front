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
export type AgentStrategy = "MOMENTUM" | "MEAN_REVERSION" | "Q_LEARNING";
export type AgentAction = "BUY" | "SELL" | "HOLD";
export type PriceModel = "GBM" | "JUMP_DIFFUSION" | "REGIME_SWITCHING";

export interface AgentConfig {
  id?: number;
  name: string;
  strategy: AgentStrategy;
  riskLevel: number;
  allowedAssets: string;
  maxPositionSize: number;
  active?: boolean;
  trained?: boolean;
  trainedEpisodes?: number | null;
  trainedOn?: string | null;
  trainedAt?: string | null;
  createdAt?: string;
}

export type AnomalyStatus = "NORMAL" | "WATCH" | "ALERT" | "INSUFFICIENT_DATA";
export interface Anomaly {
  type: "CONFIDENCE_DROP" | "OVERCONFIDENCE" | "ACTION_MIX" | "POSITION_SIZE" | "OUTLIER_DECISION" | "APPROVAL_DROP";
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string; message: string; metric: string; baseline: number; recent: number; score: number; pValue: number | null;
}
export interface AnomalyReport {
  agentId: number; agentName: string; status: AnomalyStatus; anomalyScore: number;
  baselineSource: "HISTORY" | "SIMULATED" | null; baselineSize: number; recentSize: number;
  anomalies: Anomaly[]; summary: string; generatedAt: string;
}

export interface Contribution { feature: string; label: string; value: number; contribution: number }

export interface AgentDecision {
  id: number;
  symbol: string;
  action: AgentAction;
  quantity: number;
  price: number;
  confidence: number;
  score: number;
  stopLoss: number | null;
  takeProfit: number | null;
  explanation: string;
  contributions: Contribution[];
  qValues: number[] | null;
  orderId: number | null;
  userRating: number | null;
  userComment: string | null;
  createdAt: string;
}

export interface MonteCarloRequest {
  symbol: string;
  paths: number;
  horizonDays: number;
  model: PriceModel;
  seed?: number | null;
  antithetic: boolean;
  mu?: number | null;
  sigma?: number | null;
  /** Scenario "et si ?" : krach en % (20 = -20 %) */
  crashPct?: number | null;
  crashDay?: number | null;
  volMultiplier?: number | null;
  volDays?: number | null;
}

export interface RiskSummary {
  meanReturn: number; medianReturn: number; stdReturn: number;
  var95: number; cvar95: number; var99: number; probProfit: number;
  meanMaxDrawdown: number; worstMaxDrawdown: number; meanSharpe: number;
}

export interface MonteCarloResult {
  runId: number; symbol: string; model: PriceModel; paths: number; horizonDays: number; seed: number;
  antithetic: boolean; mu: number; sigma: number; startPrice: number; elapsedMs: number;
  agent: RiskSummary; benchmark: RiskSummary;
  probBeatBenchmark: number; avgTrades: number; winRate: number; avgExposure: number;
  fan: { day: number; p5: number; p25: number; p50: number; p75: number; p95: number; benchmarkP50: number }[];
  histogram: { from: number; to: number; agent: number; benchmark: number }[];
  convergence: { paths: number; mean: number; lower: number; upper: number }[];
  samplePaths: number[][];
  crashPct: number | null; crashDay: number | null; volMultiplier: number | null; volDays: number | null;
}

export interface MonteCarloRun {
  id: number; symbol: string; strategy: AgentStrategy; model: PriceModel; paths: number; horizonDays: number;
  seed: number; antithetic: boolean; mu: number | null; sigma: number | null; meanReturn: number; var95: number; cvar95: number; probProfit: number;
  probBeatBenchmark: number; benchmarkMeanReturn: number; meanSharpe: number; meanMaxDrawdown: number;
  winRate: number; crashPct: number | null; crashDay: number | null; volMultiplier: number | null; volDays: number | null;
  elapsedMs: number; createdAt: string;
}

export interface PolicyState {
  state: number; description: string; trend: number; rsi: number; volatility: number; position: number;
  best: AgentAction; q: number[]; visits: number;
}

export interface TrainingResult {
  symbol: string; model: PriceModel; episodes: number; seed: number; elapsedMs: number;
  curve: { episode: number; avgReward: number; avgReturn: number; benchmarkReturn: number; epsilon: number }[];
  policy: PolicyState[];
  evaluation: {
    paths: number; meanReturn: number; benchmarkMeanReturn: number; probBeatBenchmark: number;
    meanSharpe: number; benchmarkMeanSharpe: number; meanMaxDrawdown: number; benchmarkMeanMaxDrawdown: number;
  };
}

export interface ReplayDay {
  day: number; price: number; action: AgentAction; confidence: number;
  /** 0 rien · 1 achat · 2 vente · 3 stop-loss · 4 take-profit */
  event: number; agentPosition: number; agentEquity: number; benchmarkEquity: number;
}

export interface ReplayResult {
  symbol: string; model: PriceModel; seed: number; horizonDays: number; capital: number;
  positionFraction: number; costRate: number; crashDay: number | null; context: number[];
  days: ReplayDay[]; agentReturn: number; benchmarkReturn: number; agentMaxDrawdown: number; agentTrades: number;
}

export interface TickerQuote {
  symbol: string; name: string; category: "INDEX" | "STOCK" | "FOREX" | "COMMODITY" | "CRYPTO";
  price: number; change: number; changePct: number; currency: string;
}

export const tickerApi = {
  get: () => api.get<{ quotes: TickerQuote[]; updatedAt: string; stale: boolean }>("/agents/ticker").then((r) => r.data),
};

export interface AssistantMessage { role: "user" | "assistant"; content: string }
export interface AssistantReply {
  reply: string; sources: { title: string; url: string }[]; online: boolean; webSearchUsed: boolean;
  model: string; notice: string | null;
}

export const assistantApi = {
  status: () => api.get<{ online: boolean; model: string; reason: string | null }>("/agents/assistant/status").then((r) => r.data),
  chat: (messages: AssistantMessage[], webSearch: boolean) =>
    api.post<AssistantReply>("/agents/assistant/chat", { messages, webSearch }).then((r) => r.data),
};

export interface TournamentCompetitor {
  rank: number; agentId: number | null; name: string; strategy: AgentStrategy | null; riskLevel: number;
  meanReturn: number; medianReturn: number; stdReturn: number; var95: number; cvar95: number; probProfit: number;
  meanSharpe: number; meanMaxDrawdown: number; avgTrades: number;
  q05: number; q25: number; q50: number; q75: number; q95: number;
}

export interface PairwiseTest {
  a: number; b: number; nameA: string; nameB: string; meanDiff: number; ciLow: number; ciHigh: number;
  tStat: number; pValue: number; pHolm: number; pBootstrap: number; pSign: number; winRate: number;
  cohenD: number; varianceFactor: number; significant: boolean; verdict: string;
}

export interface TournamentResult {
  runId: number; symbol: string; model: PriceModel; paths: number; horizonDays: number; seed: number;
  antithetic: boolean; elapsedMs: number; bootstrapSamples: number;
  ranking: TournamentCompetitor[];
  medianEquity: { day: number; values: number[] }[];
  returnTests: PairwiseTest[];
  sharpeTests: PairwiseTest[];
  conclusion: string;
}

export interface TournamentRun {
  id: number; agentIds: string; ranking: string; winner: string; symbol: string; model: PriceModel;
  paths: number; horizonDays: number; seed: number; antithetic: boolean; conclusion: string; elapsedMs: number;
  createdAt: string;
}

export interface TournamentRequest {
  agentIds: number[]; symbol: string; paths: number; horizonDays: number; model: PriceModel;
  seed?: number | null; antithetic: boolean;
}

export const agentsApi = {
  list: () => api.get<AgentConfig[]>("/agents").then((r) => r.data),
  create: (a: AgentConfig) => api.post<AgentConfig>("/agents", a).then((r) => r.data),
  update: (id: number, a: AgentConfig) => api.put<AgentConfig>(`/agents/${id}`, a).then((r) => r.data),
  toggle: (id: number) => api.patch<AgentConfig>(`/agents/${id}/toggle`).then((r) => r.data),
  remove: (id: number) => api.delete(`/agents/${id}`),
  // IA : decisions expliquees (XAI)
  decide: (id: number, rounds = 1) => api.post<AgentDecision[]>(`/agents/${id}/decide`, null, { params: { rounds } }).then((r) => r.data),
  // Donnees de demonstration (soutenance)
  demo: () => api.post<{ agentIds: number[]; surveillanceAgentId: number; rlAgentId: number; surveillance: AnomalyReport;
    rlMonteCarlo: MonteCarloResult; tournament: TournamentResult }>("/agents/demo").then((r) => r.data),
  // IA : surveillance comportementale (detection d'anomalies)
  anomalies: (id: number) => api.get<AnomalyReport>(`/agents/${id}/anomalies`).then((r) => r.data),
  allAnomalies: () => api.get<AnomalyReport[]>("/agents/anomalies").then((r) => r.data),
  decisions: (id: number) => api.get<AgentDecision[]>(`/agents/${id}/decisions`).then((r) => r.data),
  rate: (decisionId: number, rating: number, comment?: string) =>
    api.patch<AgentDecision>(`/agents/decisions/${decisionId}/rating`, { rating, comment }).then((r) => r.data),
  // IA : simulation Monte Carlo
  monteCarlo: (id: number, req: MonteCarloRequest) =>
    api.post<MonteCarloResult>(`/agents/${id}/montecarlo`, req).then((r) => r.data),
  monteCarloRuns: (id: number) => api.get<MonteCarloRun[]>(`/agents/${id}/montecarlo/runs`).then((r) => r.data),
  // IA : apprentissage par renforcement
  train: (id: number, req: { symbol: string; episodes: number; model: PriceModel; seed?: number | null }) =>
    api.post<TrainingResult>(`/agents/${id}/train`, req).then((r) => r.data),
  policy: (id: number) => api.get<PolicyState[]>(`/agents/${id}/policy`).then((r) => r.data),
  // Demo : replay humain vs agent
  replay: (id: number, req: { symbol: string; days: number; model: PriceModel; seed?: number | null; crashPct?: number | null }) =>
    api.post<ReplayResult>(`/agents/${id}/replay`, req).then((r) => r.data),
  // IA : tournoi entre agents + tests statistiques
  tournament: (req: TournamentRequest) => api.post<TournamentResult>("/agents/tournaments", req).then((r) => r.data),
  tournaments: () => api.get<TournamentRun[]>("/agents/tournaments").then((r) => r.data),
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
