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

/** Bougie journaliere : ouverture = cloture de la veille ; haut / bas simules par pont brownien. */
export interface Candle { open: number; high: number; low: number; close: number }

export interface ReplayDay {
  day: number; price: number; open: number; high: number; low: number; action: AgentAction; confidence: number;
  /** 0 rien · 1 achat · 2 vente · 3 stop-loss · 4 take-profit */
  event: number; agentPosition: number; agentEquity: number; benchmarkEquity: number;
  /** conseil du coach pour ce jour et ses raisons (phrase pedagogique) */
  why: string;
}

export interface ReplayResult {
  symbol: string; model: PriceModel; seed: number; horizonDays: number; capital: number;
  positionFraction: number; costRate: number;
  /** distance du stop-loss de l'agent (fraction du prix d'entree) ; le take-profit est a 2 fois cette distance */
  stopPct: number; crashDay: number | null; context: number[]; contextCandles: Candle[];
  days: ReplayDay[]; agentReturn: number; benchmarkReturn: number; agentMaxDrawdown: number; agentTrades: number;
}

export interface TickerQuote {
  symbol: string; name: string; category: "INDEX" | "STOCK" | "FOREX" | "COMMODITY" | "CRYPTO";
  price: number; change: number; changePct: number; currency: string;
}

export const tickerApi = {
  get: () => api.get<{ quotes: TickerQuote[]; updatedAt: string; stale: boolean }>("/agents/ticker").then((r) => r.data),
};

// --- Pilote automatique ---
export type AutopilotStatus = "RUNNING" | "PAUSED" | "STOPPED";
export type AutopilotEventType = "STARTED" | "BUY" | "SELL" | "STOP_LOSS" | "TAKE_PROFIT" | "PAUSED" | "RESUMED" | "STOPPED"
  | "LOSS_LIMIT" | "ORDER_LIMIT" | "ANOMALY_WARNING" | "KILL_SWITCH" | "ERROR";
export interface AutopilotEvent {
  id: number; at: string; step: number; type: AutopilotEventType; symbol: string | null; price: number | null;
  quantity: number | null; equity: number | null; message: string | null; decisionId: number | null;
}
export interface AutopilotPosition {
  symbol: string; price: number; bear: boolean; units: number; entryPrice: number; value: number; pnlPct: number;
  stopLoss: number | null; takeProfit: number | null; recentPrices: number[];
}
export interface AutopilotView {
  sessionId: number; status: AutopilotStatus; stopReason: string | null; intervalSeconds: number; maxOrdersPerDay: number;
  maxLossPct: number; killSwitch: boolean; capital: number; equity: number; returnPct: number; benchmarkReturnPct: number;
  maxDrawdown: number; step: number; trades: number; winRate: number; ordersToday: number; consecutiveAlerts: number;
  startedAt: string; nextRunAt: string | null; positions: AutopilotPosition[]; equityCurve: number[]; benchmarkCurve: number[];
  events: AutopilotEvent[];
}
export interface AutopilotStart { intervalSeconds: number; maxOrdersPerDay: number; maxLossPct: number; killSwitch: boolean; capital: number }

export const autopilotApi = {
  get: (agentId: number) => api.get<AutopilotView | "">(`/agents/${agentId}/autopilot`).then((r) => (r.status === 204 || !r.data ? null : (r.data as AutopilotView))),
  start: (agentId: number, req: AutopilotStart) => api.post<AutopilotView>(`/agents/${agentId}/autopilot/start`, req).then((r) => r.data),
  pause: (agentId: number) => api.post<AutopilotView>(`/agents/${agentId}/autopilot/pause`).then((r) => r.data),
  resume: (agentId: number) => api.post<AutopilotView>(`/agents/${agentId}/autopilot/resume`).then((r) => r.data),
  stop: (agentId: number) => api.post<AutopilotView>(`/agents/${agentId}/autopilot/stop`).then((r) => r.data),
  step: (agentId: number) => api.post<AutopilotView>(`/agents/${agentId}/autopilot/step`).then((r) => r.data),
};

// --- Analyse de capture d'ecran (Claude vision) ---
export interface ChartAnalysis {
  isChart: boolean; asset: string; timeframe: string; trend: "HAUSSIERE" | "BAISSIERE" | "LATERALE" | "INDETERMINEE";
  signal: "ACHAT" | "ATTENDRE" | "VENTE"; confidence: number; supports: string[]; resistances: string[]; patterns: string[];
  indicators: string[]; reasons: string[]; risks: string[]; stopLoss: string; takeProfit: string; agentView: string; summary: string;
  /** comment le profil de risque choisi change le conseil (vide si aucun profil) */
  riskAdvice?: string;
}

/** Style de trading choisi avant l'analyse : fixe la prudence du conseil et la part du capital risquee par trade. */
export type RiskProfile = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
export interface ChartRisk { riskProfile: RiskProfile; riskPercent: number; accountBalance: number }

export interface AssistantMessage { role: "user" | "assistant"; content: string }
export interface AssistantReply {
  reply: string; sources: { title: string; url: string }[]; online: boolean; webSearchUsed: boolean;
  model: string; notice: string | null;
}

export const assistantApi = {
  status: () => api.get<{ online: boolean; model: string; reason: string | null }>("/agents/assistant/status").then((r) => r.data),
  chat: (messages: AssistantMessage[], webSearch: boolean) =>
    api.post<AssistantReply>("/agents/assistant/chat", { messages, webSearch }).then((r) => r.data),
  chart: (imageBase64: string, mediaType: string, question: string, agentId?: number, risk?: ChartRisk) =>
    api.post<{ analysis: ChartAnalysis; model: string }>("/agents/assistant/chart", { imageBase64, mediaType, question, agentId, ...risk }).then((r) => r.data),
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
  replay: (id: number, req: { symbol: string; days: number; model: PriceModel; seed?: number | null; crashPct?: number | null; capital?: number | null }) =>
    api.post<ReplayResult>(`/agents/${id}/replay`, req).then((r) => r.data),
  // IA : tournoi entre agents + tests statistiques
  tournament: (req: TournamentRequest) => api.post<TournamentResult>("/agents/tournaments", req).then((r) => r.data),
  tournaments: () => api.get<TournamentRun[]>("/agents/tournaments").then((r) => r.data),
};

// --- Donnees de marche reelles + backtest walk-forward ---
export interface PricePoint { date: string; close: number }
export interface SeriesInfo {
  symbol: string; source: "YAHOO" | "CSV"; points: number; from: string; to: string;
  firstClose: number; lastClose: number; dataHash: string; prices: PricePoint[];
}
export interface WalkForwardRequest { symbol: string; trainDays: number; testDays: number; episodes: number; seed?: number | null }
export interface WalkForwardWindow {
  index: number; trainFrom: string; trainTo: string; testFrom: string; testTo: string;
  agentReturn: number; benchmarkReturn: number; excess: number; inSampleReturn: number; inSampleBenchmark: number;
  maxDrawdown: number; trades: number; exposure: number;
}
export interface WalkForwardPerformance { totalReturn: number; annualizedReturn: number; sharpe: number; maxDrawdown: number }
export interface WalkForwardTest {
  windows: number; meanExcess: number; ciLow: number; ciHigh: number; tStat: number; pValue: number;
  pBootstrap: number; pSign: number; winRate: number; cohenD: number;
}
export interface WalkForwardResult {
  symbol: string; source: "YAHOO" | "CSV"; dataHash: string; dataFrom: string; dataTo: string; bars: number;
  strategy: AgentStrategy; riskLevel: number; trainDays: number; testDays: number; episodes: number; seed: number; elapsedMs: number;
  windows: WalkForwardWindow[]; agent: WalkForwardPerformance; benchmark: WalkForwardPerformance;
  test: WalkForwardTest | null; overfitGap: number; curve: { date: string; agent: number; benchmark: number }[];
  prices: PricePoint[]; verdict: string; auditRecordId: number | null;
}

export const marketDataApi = {
  series: (symbol: string) => api.get<SeriesInfo>("/market-data/series", { params: { symbol } }).then((r) => r.data),
  refresh: (symbol: string) => api.post<SeriesInfo>("/market-data/refresh", null, { params: { symbol } }).then((r) => r.data),
  importCsv: (symbol: string, csv: string) => api.post<SeriesInfo>("/market-data/import", { symbol, csv }).then((r) => r.data),
};

export const walkForwardApi = {
  run: (agentId: number, req: WalkForwardRequest) =>
    api.post<WalkForwardResult>(`/agents/${agentId}/walkforward`, req).then((r) => r.data),
};

// --- Registre d'audit des decisions de l'IA (hash chaines + arbre de Merkle) ---
export type LedgerType = "DECISION" | "MONTE_CARLO" | "TOURNAMENT" | "TRAINING" | "WALK_FORWARD" | "AUTOPILOT_HALT" | "COACH_ADVICE";
export interface LedgerRecord {
  id: number; type: LedgerType; refId: number | null; agentId: number | null; title: string | null; createdAtMs: number;
  leafHash: string; blockHeight: number | null; leafIndex: number | null; sealed: boolean; intact: boolean;
}
export interface LedgerRecordDetail { record: LedgerRecord; payload: string; leafInput: string }
export interface LedgerBlock {
  height: number; previousHash: string; merkleRoot: string; recordCount: number; sealedAtMs: number;
  blockHash: string; seal: string; anchorRef: string | null;
}
export interface MerkleStep { hash: string; left: boolean }
export interface LedgerProof {
  recordId: number; type: LedgerType; sealed: boolean; intact: boolean; leafInput: string; leafHash: string;
  leafIndex: number | null; leafCount: number | null; path: MerkleStep[]; merkleRoot: string | null;
  blockHeight: number | null; blockHash: string | null; previousHash: string | null; blockInput: string | null;
  sealedAtMs: number | null; proofValid: boolean;
}
export interface LedgerSummary {
  blocks: number; headHeight: number; headHash: string; lastSealedAtMs: number | null; totalRecords: number;
  myRecords: number; pendingRecords: number; byType: Record<string, number>; sealInterval: string;
}
export interface LedgerIssue { type: string; blockHeight: number | null; recordId: number | null; message: string }
export interface LedgerChainReport {
  valid: boolean; blocks: number; sealedRecords: number; pendingRecords: number; headHash: string;
  issues: LedgerIssue[]; checkedAtMs: number;
}

export const ledgerApi = {
  summary: () => api.get<LedgerSummary>("/ledger/summary").then((r) => r.data),
  records: (params: { type?: string; agentId?: number; limit?: number } = {}) =>
    api.get<LedgerRecord[]>("/ledger/records", { params }).then((r) => r.data),
  record: (id: number) => api.get<LedgerRecordDetail>(`/ledger/records/${id}`).then((r) => r.data),
  proof: (id: number) => api.get<LedgerProof>(`/ledger/records/${id}/proof`).then((r) => r.data),
  blocks: (limit = 12) => api.get<LedgerBlock[]>("/ledger/blocks", { params: { limit } }).then((r) => r.data),
  verify: () => api.get<LedgerChainReport>("/ledger/verify").then((r) => r.data),
  seal: () => api.post<LedgerBlock | { message: string }>("/ledger/seal").then((r) => r.data),
  tamper: (id: number) => api.post<{ recordId: number; tampered: boolean; change: string }>(`/ledger/demo/tamper/${id}`).then((r) => r.data),
  restore: (id: number) => api.post<{ recordId: number; tampered: boolean; change: string }>(`/ledger/demo/restore/${id}`).then((r) => r.data),
};

// --- Coach de trading (present sur tous les ecrans) ---
export interface CoachIndicators {
  rsi14: number; sma20: number; sma50: number; sma200: number; volatilityAnnual: number; volatilityNormal: number;
  momentum20: number; trend: "HAUSSIERE" | "BAISSIERE" | "MIXTE";
}
export interface CoachLevels { support: number; resistance: number | null; stop: number; target: number }
export interface CoachReason { label: string; contribution: number; text: string }
export interface CoachRule { action: AgentAction; title: string; condition: string; level: number | null; active: boolean }
export interface CoachTrackRecord {
  windows: number; from: string; to: string; strategyReturn: number; benchmarkReturn: number; strategySharpe: number;
  benchmarkSharpe: number; strategyMaxDrawdown: number; benchmarkMaxDrawdown: number; meanExcess: number; pValue: number; text: string;
}
export interface CoachChartPoint { date: string; close: number; sma20: number; sma50: number }
export interface CoachAnalysis {
  symbol: string; name: string; source: string; asOf: string; price: number; change1d: number; change5d: number; change20d: number;
  action: AgentAction; confidence: number; score: number; indicators: CoachIndicators; levels: CoachLevels;
  reasons: CoachReason[]; plan: CoachRule[]; trackRecord: CoachTrackRecord | null; chart: CoachChartPoint[];
  headline: string; speech: string; disclaimer: string; dataHash: string; riskLevel: number; auditRecordId: number | null;
}

export const coachApi = {
  analysis: (symbol: string, agentId?: number | null) =>
    api.get<CoachAnalysis>("/coach/analysis", { params: { symbol, agentId: agentId ?? undefined } }).then((r) => r.data),
  chat: (messages: AssistantMessage[], ctx: { symbol?: string; page?: string; agentId?: number | null }) =>
    api.post<AssistantReply>("/coach/chat", { messages, symbol: ctx.symbol, page: ctx.page, agentId: ctx.agentId ?? undefined }).then((r) => r.data),
};

// --- Flash d'actualites du trading dans le monde ---
export type NewsTopic = "WORLD" | "STOCKS" | "CRYPTO" | "FOREX" | "COMMODITIES" | "RATES";
export interface FlashItem {
  title: string; source: string; url: string; publishedAt: string | null; minutesAgo: number | null;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
}
export interface NewsFlash { topic: NewsTopic; label: string; items: FlashItem[]; generatedAt: string }

/** Chaine d'information boursiere en direct : `videoId` = diffusion en cours verifiee, nul si non reperee. */
export interface TvChannel {
  id: string; name: string; language: "EN" | "AR" | "FR"; channelId: string; videoId: string | null; live: boolean; watchUrl: string;
}

export const newsApi = {
  flash: (topic: NewsTopic = "WORLD", limit = 8) => api.get<NewsFlash>("/news/flash", { params: { topic, limit } }).then((r) => r.data),
  tv: () => api.get<TvChannel[]>("/news/tv").then((r) => r.data),
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
