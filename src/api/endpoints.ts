// Tous les appels vers le backend, regroupes par module.
// Chaque membre du groupe ajoute ici les fonctions de SON module.
import { API_URL, api } from "./client";

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
  /** e-mail confirme par le lien d'inscription (les anciens comptes le sont d'office) */
  emailConfirmed?: boolean;
  totpEnabled?: boolean | null;
  deleted?: boolean | null;
  /** chemin de la photo de profil (/api/public/avatars/...), null si aucune */
  avatarUrl?: string | null;
}
/** Si la double authentification est active : token/user vides, twoFactorRequired + challenge. */
export interface AuthResponse { token: string | null; user: User | null; twoFactorRequired?: boolean; challenge?: string | null }

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface UserProfileResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  token?: string | null;
}

/** Jeton Google reCAPTCHA envoye dans l'en-tete X-Captcha-Token (connexion, inscription, mot de passe oublie). */
const captchaHeader = (token?: string | null) => (token ? { headers: { "X-Captcha-Token": token } } : undefined);

export const authApi = {
  login: (email: string, password: string, captcha?: string | null) =>
    api.post<AuthResponse>("/auth/login", { email, password }, captchaHeader(captcha)).then((r) => r.data),
  register: (data: { firstName: string; lastName: string; email: string; password: string }, captcha?: string | null) =>
    api.post<AuthResponse>("/auth/register", data, captchaHeader(captcha)).then((r) => r.data),
  captchaConfig: () => api.get<{ enabled: boolean; siteKey: string | null }>("/auth/captcha-config").then((r) => r.data),
  me: () => api.get<User>("/users/me").then((r) => r.data),
  updateProfile: (data: UpdateProfileRequest) =>
    api.patch<UserProfileResponse>("/users/me", data).then((r) => r.data),
  registrationStatus: () =>
    api.get<{ registrationEnabled: boolean }>("/auth/registration-status").then((r) => r.data),
  mySecurityScore: () => api.get<SecurityScore>("/users/me/security-score").then((r) => r.data),
  myLevel: () => api.get<UserLevelAssessment>("/users/me/level").then((r) => r.data),
  loginTwoFactor: (challenge: string, code: string) =>
    api.post<AuthResponse>("/auth/login/2fa", { challenge, code }).then((r) => r.data),
  forgotPassword: (email: string, captcha?: string | null) =>
    api.post<Message>("/auth/forgot-password", { email }, captchaHeader(captcha)).then((r) => r.data),
  resetPassword: (token: string, newPassword: string) =>
    api.post<Message>("/auth/reset-password", { token, newPassword }).then((r) => r.data),
  verifyEmail: (token: string) => api.post<Message>("/auth/verify-email", { token }).then((r) => r.data),
};

export interface Message { message: string }
export interface SessionView {
  id: string; device: string | null; ipAddress: string | null; createdAt: string; lastSeenAt: string;
  expiresAt: string; current: boolean;
}
export interface AccountStatus { emailConfirmed: boolean; twoFactorEnabled: boolean; activeSessions: number }

/** Securite du compte connecte (module 1). */
export const accountApi = {
  status: () => api.get<AccountStatus>("/account/status").then((r) => r.data),
  /** le jeton est passe explicitement : il est retire du stockage juste apres l'appel */
  logout: (token: string) =>
    api.post<Message>("/account/logout", null, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data),
  sessions: () => api.get<SessionView[]>("/account/sessions").then((r) => r.data),
  revokeSession: (id: string) => api.delete<Message>(`/account/sessions/${id}`).then((r) => r.data),
  revokeOthers: () => api.post<Message>("/account/sessions/revoke-others").then((r) => r.data),
  resendVerification: () => api.post<Message>("/account/resend-verification").then((r) => r.data),
  setupTwoFactor: () => api.post<{ secret: string; otpauthUri: string }>("/account/2fa/setup").then((r) => r.data),
  enableTwoFactor: (code: string) => api.post<Message>("/account/2fa/enable", { code }).then((r) => r.data),
  disableTwoFactor: (password: string, code: string) =>
    api.post<Message>("/account/2fa/disable", { password, code }).then((r) => r.data),
  exportData: () => api.get<Record<string, unknown>>("/account/export").then((r) => r.data),
  deleteAccount: (password: string) => api.post<Message>("/account/delete", { password }).then((r) => r.data),
};

export interface TemporaryPassword { userId: number; email: string; temporaryPassword: string | null; message: string }
export interface MailView {
  id: number; recipient: string; subject: string; body: string; actionUrl: string | null; kind: string; createdAt: string;
  /** LOCAL (pas de SMTP), PENDING, SENT ou FAILED */
  status?: "LOCAL" | "PENDING" | "SENT" | "FAILED"; error?: string | null;
}
export interface MailStatus { smtpConfigured: boolean; host: string | null; port: number; security: string; from: string }

export interface GlobalUserSettings {
  registrationEnabled: boolean;
  maxFailedLoginAttempts: number;
  lockDurationMinutes: number;
  version: number;
  updatedAt: string;
}

export interface UpdateGlobalUserSettingsRequest {
  registrationEnabled: boolean;
  maxFailedLoginAttempts: number;
  lockDurationMinutes: number;
  version: number;
}

export type ActivityAction =
  | "REGISTER"
  | "LOGIN"
  | "PROFILE_UPDATE"
  | "ADMIN_SET_ENABLED"
  | "ADMIN_DELETE_USER"
  | "ADMIN_SET_ROLE"
  | "SETTINGS_UPDATE"
  | "LOGOUT"
  | "SESSION_REVOKE"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET"
  | "EMAIL_VERIFY"
  | "TWO_FACTOR_ENABLE"
  | "TWO_FACTOR_DISABLE"
  | "TWO_FACTOR_LOGIN"
  | "ACCOUNT_EXPORT"
  | "ACCOUNT_DELETE"
  | "ADMIN_CREATE_USER"
  | "ADMIN_RESET_PASSWORD"
  | "ADMIN_REVOKE_SESSIONS"
  | "PASSKEY_REGISTER"
  | "PASSKEY_LOGIN"
  | "PASSKEY_DELETE"
  | "AVATAR_UPDATE"
  | "PREFERENCES_UPDATE"
  | "ADMIN_SET_BALANCE";

export type ActivityOutcome = "SUCCESS" | "FAILURE";

export interface ActivityLog {
  id: number;
  occurredAt: string;
  actorId: number | null;
  targetUserId: number | null;
  action: ActivityAction;
  outcome: ActivityOutcome;
  reasonCode: string;
  correlationId?: string | null;
}

export interface ActivityFieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface ActivityLogDetail extends ActivityLog {
  detailsAvailable: boolean;
  passwordChanged: boolean;
  changes: ActivityFieldChange[];
}

export interface ActivityLogPage {
  content: ActivityLog[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ActivityLogQuery {
  actorId?: string;
  action?: ActivityAction | "";
  outcome?: ActivityOutcome | "";
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export type SecurityRiskBand = "LOW" | "MEDIUM" | "HIGH";

export interface SecurityScore {
  userId: number;
  score: number | null;
  riskBand: SecurityRiskBand | null;
  assessmentCount: number;
  insufficientEvidence: boolean;
  computedAt: string;
}

export type TraderLevel = "DEBUTANT" | "INTERMEDIAIRE" | "AVANCE" | "EXPERT";

export interface UserLevelAssessment {
  userId: number;
  level: TraderLevel | null;
  score: number | null;
  insufficientEvidence: boolean;
  successfulLoginCount: number;
  reasonCodes: string[];
  modelVersion: string | null;
  computedAt: string;
  /** Niveau d'activite du modele IA (module 1) et son score ; null si activite insuffisante. */
  activityLevel?: TraderLevel | null;
  activityScore?: number | null;
  /** Niveau du jeu de progression et son score de competence ; null sans profil de trader. */
  tradingLevel?: TraderLevel | null;
  tradingScore?: number | null;
  /** D'ou viennent level et score. */
  levelSource?: "TRADING" | "ACTIVITY";
  /** Regle qui choisit le niveau affiche. */
  displayRule?: string;
}

export interface AdminStats {
  windowDays: number;
  generatedAt: string;
  users: {
    total: number;
    enabled: number;
    disabled: number;
    lockedNow: number;
    newInWindow: number;
    byRole: Record<string, number>;
    byLevel: Record<string, number>;
  };
  logins: { success: number; failure: number; blockedWhileLocked: number };
  adminActions: { setEnabled: number; deleteUser: number; deleteRefused: number; settingsUpdates: number };
  anomalies: { assessed: number; insufficientHistory: number; byRiskLevel: Record<string, number> };
}

export const adminApi = {
  users: () => api.get<User[]>("/admin/users").then((r) => r.data),
  createUser: (data: { firstName: string; lastName: string; email: string; role: Role; password?: string }) =>
    api.post<TemporaryPassword>("/admin/users/create", data).then((r) => r.data),
  resetUserPassword: (id: number) => api.post<TemporaryPassword>(`/admin/users/${id}/reset-password`).then((r) => r.data),
  userSessions: (id: number) => api.get<SessionView[]>(`/admin/users/${id}/sessions`).then((r) => r.data),
  revokeUserSessions: (id: number) => api.post<Message>(`/admin/users/${id}/revoke-sessions`).then((r) => r.data),
  mailOutbox: () => api.get<MailView[]>("/admin/mail-outbox").then((r) => r.data),
  mailStatus: () => api.get<MailStatus>("/admin/mail-status").then((r) => r.data),
  mailTest: () => api.post<Message>("/admin/mail-test").then((r) => r.data),
  /** score de trading (portefeuille, niveau, competence) de chaque utilisateur qui a deja joue */
  traderScores: () => api.get<AdminTraderScore[]>("/admin/progression").then((r) => r.data),
  /** fixe le solde du portefeuille d'un trader (motif obligatoire, trace dans le journal) */
  setBalance: (userId: number, balance: number, reason: string) =>
    api.post<{ before: number; after: number; levelBefore: TraderLevel; levelAfter: TraderLevel }>(`/admin/progression/${userId}/balance`, { balance, reason }).then((r) => r.data),
  stats: (days: number, signal?: AbortSignal) =>
    api.get<AdminStats>("/admin/stats", { params: { days }, signal }).then((r) => r.data),
  userSecurityScore: (userId: number, signal?: AbortSignal) =>
    api.get<SecurityScore>(`/admin/users/${userId}/security-score`, { signal }).then((r) => r.data),
  userLevel: (userId: number, signal?: AbortSignal) =>
    api.get<UserLevelAssessment>(`/admin/users/${userId}/level`, { signal }).then((r) => r.data),
  setRole: (id: number, value: Role) =>
    api.patch<User>(`/admin/users/${id}/role`, null, { params: { value } }).then((r) => r.data),
  setEnabled: (id: number, value: boolean) =>
    api.patch<User>(`/admin/users/${id}/enabled`, null, { params: { value } }).then((r) => r.data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  getUserSettings: () => api.get<GlobalUserSettings>("/admin/settings/users").then((r) => r.data),
  updateUserSettings: (data: UpdateGlobalUserSettingsRequest) =>
    api.put<GlobalUserSettings>("/admin/settings/users", data).then((r) => r.data),
  activityLogs: (query: ActivityLogQuery = {}) => {
    const params: Record<string, string | number> = {
      page: query.page ?? 0,
      size: query.size ?? 20,
    };
    if (query.actorId) params.actorId = Number(query.actorId);
    if (query.action) params.action = query.action;
    if (query.outcome) params.outcome = query.outcome;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    return api.get<ActivityLogPage>("/admin/activity-logs", { params }).then((r) => r.data);
  },
  activityLogDetail: (id: number) =>
    api.get<ActivityLogDetail>(`/admin/activity-logs/${id}`).then((r) => r.data),
  loginAnomalies: (query: LoginAnomalyQuery = {}) => {
    const params: Record<string, string | number> = {
      page: query.page ?? 0,
      size: query.size ?? 20,
    };
    if (query.actorId) params.actorId = Number(query.actorId);
    if (query.activityLogId) params.activityLogId = Number(query.activityLogId);
    if (query.riskLevel) params.riskLevel = query.riskLevel;
    if (query.status) params.status = query.status;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    return api.get<LoginAnomalyPage>("/admin/login-anomalies", { params }).then((r) => r.data);
  },
  loginAnomalyDetail: (id: number) =>
    api.get<LoginAnomalyDetail>(`/admin/login-anomalies/${id}`).then((r) => r.data),
};

export type LoginAnomalyStatus = "ASSESSED" | "INSUFFICIENT_HISTORY" | "UNAVAILABLE";
export type LoginRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface LoginAnomaly {
  id: number;
  activityLogId: number;
  actorId: number | null;
  occurredAt: string;
  status: LoginAnomalyStatus;
  riskScore: number | null;
  riskLevel: LoginRiskLevel | null;
  reasonCodes: string[];
  modelVersion: string | null;
}

export interface LoginAnomalyDetail extends LoginAnomaly {
  featureSummary: Record<string, unknown>;
}

export interface LoginAnomalyPage {
  content: LoginAnomaly[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface LoginAnomalyQuery {
  actorId?: string;
  activityLogId?: string | number;
  riskLevel?: LoginRiskLevel | "";
  status?: LoginAnomalyStatus | "";
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

// ─── Module 2 : Trading & Gestion du Risque ──────────────────────────────────
export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "STOP";
/** PENDING : LIMIT/STOP en attente ; OPEN : position ; CLOSED / CANCELLED / REJECTED : terminaux. */
export type OrderStatus = "PENDING" | "OPEN" | "CLOSED" | "CANCELLED" | "REJECTED";
export type CloseReason = "MANUAL" | "STOP_LOSS" | "TAKE_PROFIT" | "AGENT";

/** Ticket renvoye par le serveur. `price` = prix de reference (execution, ou niveau si en attente). */
export interface TradeOrder {
  id: number;
  symbol: string;
  side: OrderSide;
  positionType: "LONG" | "SHORT";
  orderType: OrderType;
  quantity: number;
  price: number;
  limitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  status: OrderStatus;
  createdAt?: string;
  executedPrice?: number | null;
  executedAt?: string | null;
  closedAt?: string | null;
  closePrice?: number | null;
  closeReason?: CloseReason | null;
  realizedPnl?: number | null;
  fees?: number | null;
  rejectReason?: string | null;
  /** Rempli pour un ticket OPEN uniquement. */
  currentPrice?: number | null;
  unrealizedPnl?: number | null;
  /** Qui a passe l'ordre : l'utilisateur ou l'agent IA (module 6). */
  source?: "USER" | "AGENT";
}

/** Le client n'envoie jamais de prix d'execution : le serveur le lit lui-meme. */
export interface CreateOrderRequest {
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  /** Obligatoire pour LIMIT / STOP, interdit pour MARKET. */
  limitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

/** Mise a jour partielle : champ absent = inchange ; clear* = effacement explicite. */
export interface UpdateOrderRequest {
  stopLoss?: number | null;
  takeProfit?: number | null;
  clearStopLoss?: boolean;
  clearTakeProfit?: boolean;
}

export interface OrderFilters {
  status?: OrderStatus;
  symbol?: string;
  from?: string; // yyyy-MM-dd
  to?: string;
}

export const ordersApi = {
  list: (filters?: OrderFilters) => api.get<TradeOrder[]>("/trading/orders", { params: filters }).then((r) => r.data),
  get: (id: number) => api.get<TradeOrder>(`/trading/orders/${id}`).then((r) => r.data),
  create: (o: CreateOrderRequest) => api.post<TradeOrder>("/trading/orders", o).then((r) => r.data),
  update: (id: number, o: UpdateOrderRequest) => api.put<TradeOrder>(`/trading/orders/${id}`, o).then((r) => r.data),
  close: (id: number) => api.post<TradeOrder>(`/trading/orders/${id}/close`).then((r) => r.data),
  cancel: (id: number) => api.post<TradeOrder>(`/trading/orders/${id}/cancel`).then((r) => r.data),
};

export interface PortfolioPosition {
  symbol: string;
  netQuantity: number;
  longQuantity: number;
  shortQuantity: number;
  avgEntryPrice: number;
  marketPrice: number;
  marketValue: number;
  grossExposure: number;
  unrealizedPnl: number;
  weightPct: number;
  tickets: number;
}

export interface Portfolio {
  cash: number;
  equity: number;
  investedValue: number;
  grossExposure: number;
  netExposure: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalFees: number;
  totalReturnPct: number;
  initialCapital: number;
  openPositions: number;
  pendingOrders: number;
  positions: PortfolioPosition[];
}

export interface EquityPoint { at: string; equity: number; cash: number; event: string }

export const portfolioApi = {
  get: () => api.get<Portfolio>("/trading/portfolio").then((r) => r.data),
  history: () => api.get<EquityPoint[]>("/trading/portfolio/history").then((r) => r.data),
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";

export interface RiskCheck {
  name: string;
  passed: boolean;
  /** true : regle dure (echec = ordre refuse) ; false : avertissement. */
  blocking: boolean;
  value: number | null;
  limit: number | null;
  message: string;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  checks: RiskCheck[];
  metrics: {
    referencePrice: number;
    notional: number;
    fee: number;
    equity: number;
    orderPctOfEquity: number;
    concentrationAfterPct: number;
    grossExposureAfterPct: number;
    cashAfter: number;
    cashAfterPct: number;
    volatilityAnnualPct: number;
    volatilitySource: "REAL" | "MODEL";
    var95: number;
  };
  components: { concentration: number; orderSize: number; volatility: number; grossExposure: number; liquidity: number };
}

export interface RiskAssessRequest {
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  limitPrice?: number | null;
  stopLoss?: number | null;
}

export interface PortfolioRisk {
  equity: number;
  var95: number;
  var99: number;
  cvar95: number;
  var95Pct: number;
  varMethod: "HISTORICAL" | "PARAMETRIC" | "NONE";
  observations: number;
  grossExposure: number;
  netExposure: number;
  grossExposurePct: number;
  netExposurePct: number;
  hhi: number;
  diversificationScore: number;
  maxDrawdownPct: number | null;
  currentDrawdownPct: number | null;
  positions: number;
  assumptions: string;
}

/** Stop-loss / take-profit proposes selon la volatilite de l'actif (POST /trading/risk/suggest-protection). */
export interface ProtectionSuggestion {
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  sigmaDailyPct: number;
  sigmaAnnualPct: number;
  sigmaSource: "REAL" | "MODEL";
  sigmaMultiple: number;
  rewardRisk: number;
  maxLoss: number;
  expectedGain: number;
  explanation: string;
}

export const riskApi = {
  assess: (req: RiskAssessRequest) => api.post<RiskAssessment>("/trading/risk/assess", req).then((r) => r.data),
  suggestProtection: (req: Omit<RiskAssessRequest, "stopLoss">) =>
    api.post<ProtectionSuggestion>("/trading/risk/suggest-protection", req).then((r) => r.data),
  portfolio: () => api.get<PortfolioRisk>("/trading/risk/portfolio").then((r) => r.data),
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

/** Module 5 : flux de cotations enregistre par le moteur de prix (un point par minute et par actif). */
export interface PriceTick { at: string; price: number; anchored: boolean }
export const marketTicksApi = {
  list: (symbol: string, hours = 6) =>
    api.get<PriceTick[]>("/market/ticks", { params: { symbol, hours } }).then((r) => r.data),
};

export type SentimentLabel = "POSITIVE" | "NEUTRAL" | "NEGATIVE";
export type ModelSentimentStatus = "ANALYZED" | "UNAVAILABLE" | "INSUFFICIENT_DATA" | "UNSUPPORTED_LANGUAGE";

/** Actualité financière importée avec score de sentiment calculé côté serveur. */
export interface MarketNews {
  id: number;
  headline: string;
  source: string;
  url: string | null;
  symbol: string;
  publishedAt: string;   // ISO-8601 UTC
  sentimentScore: number; // −1.0 … +1.0, jamais null
  sentimentLabel: SentimentLabel;
  importedAt: string;    // ISO-8601 UTC
  /** Fournisseur d'origine : YAHOO_FINANCE, GOOGLE_NEWS, FINNHUB ou MANUAL (import de l'admin). */
  provider?: string;
  /** REAL (fournisseur reel), CACHED ou MANUAL. */
  dataStatus?: string;
}

/** Corps envoyé par l'admin pour importer un article (le sentiment est calculé côté serveur). */
export interface MarketNewsRequest {
  headline: string;
  source: string;
  url?: string | null;
  symbol: string;
  publishedAt: string; // ISO-8601 UTC
}

export interface ArticleModelSentiment {
  newsId: number;
  headline: string;
  sentimentLabel: SentimentLabel;
  positiveProbability: number;
  negativeProbability: number;
  neutralProbability: number;
  sentimentScore: number;
  modelName: string;
  modelVersion: string;
  analyzedAt: string;
  status: "ANALYZED";
  errorCode?: null;
}

export interface ModelSentimentResult {
  newsId: number;
  sentimentLabel: SentimentLabel | null;
  positiveProbability: number | null;
  negativeProbability: number | null;
  neutralProbability: number | null;
  sentimentScore: number | null;
  modelName: string | null;
  modelVersion: string | null;
  analyzedAt: string;
  status: ModelSentimentStatus;
  errorCode: string | null;
}

export interface MarketSentimentSummary {
  symbol: string;
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  analyzedArticleCount: number;
  positivePercentage: number;
  negativePercentage: number;
  neutralPercentage: number;
  overallSentiment: SentimentLabel | null;
  sentimentScore: number | null;
  modelName: string;
  modelVersion: string;
  status: ModelSentimentStatus;
  articles: ArticleModelSentiment[];
}

export interface MarketSentimentHistory {
  symbol: string;
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  status: ModelSentimentStatus;
  points: Array<{
    date: string;
    analyzedArticleCount: number;
    positivePercentage: number;
    negativePercentage: number;
    neutralPercentage: number;
    sentimentScore: number;
  }>;
}

export const marketNewsApi = {
  /** Toutes les actualités, ou filtrées par symbole si fourni. */
  list: (symbol?: string) =>
    api.get<MarketNews[]>("/market/news", { params: symbol ? { symbol } : {} }).then((r) => r.data),
  /** Importer un article (ADMIN). Le sentiment est calculé automatiquement. */
  create: (req: MarketNewsRequest) =>
    api.post<MarketNews>("/market/news", req).then((r) => r.data),
  /** Supprimer un article (ADMIN). */
  remove: (id: number) => api.delete(`/market/news/${id}`),
  analyze: (id: number) => api.post<ModelSentimentResult>(`/market/news/${id}/analyze`).then((r) => r.data),
};

export const marketSentimentApi = {
  summary: (symbol: string, days = 30) =>
    api.get<MarketSentimentSummary>("/market/sentiment", { params: { symbol, days } }).then((r) => r.data),
  history: (symbol: string, days = 30) =>
    api.get<MarketSentimentHistory>("/market/sentiment/history", { params: { symbol, days } }).then((r) => r.data),
};

export type PredictionDirection = "UP" | "DOWN" | "FLAT";
export type PredictionOutcome = "CORRECT" | "INCORRECT" | null;

export interface PredictionFanPoint { day: number; p10: number; p50: number; p90: number }

/** Prédiction de tendance générée par le modèle interne (linear-momentum-v1). */
export interface MarketPrediction {
  id: number;
  symbol: string;
  direction: PredictionDirection;
  confidence: number;       // 0.0–1.0, jamais null
  currentPrice: number;     // prix au moment de la génération
  targetPrice: number;      // prix cible projeté, toujours positif
  horizonDays: number;
  generatedAt: string;      // ISO-8601 UTC, jamais null
  dataAsOf: string;         // ISO-8601 UTC, jamais null (cutoff des données)
  modelVersion: string;     // jamais null
  modelName?: string | null;
  dataSource?: string | null;
  dataHash?: string | null;
  dataFrom?: string | null;
  dataTo?: string | null;
  dataPoints?: number | null;
  mae?: number | null;
  rmse?: number | null;
  mape?: number | null;
  evaluationPoints?: number | null;
  fanP10?: number | null;
  fanP90?: number | null;
  fanJson?: string | null;
  candidateMetricsJson?: string | null;
  sentimentScore?: number | null;
  sentimentContribution?: number | null;
  status?: "GENERATED" | "RESOLVED" | string | null;
  outcome: PredictionOutcome;
  resolvedAt: string | null;
}

export const predictionsApi = {
  /** Toutes les prédictions, ou filtrées par symbole si fourni. */
  list: (symbol?: string) =>
    api.get<MarketPrediction[]>("/market/predictions", { params: symbol ? { symbol } : {} }).then((r) => r.data),
  /** Récupère une prédiction par id. */
  get: (id: number) => api.get<MarketPrediction>(`/market/predictions/${id}`).then((r) => r.data),
  /** Modèles de prédiction disponibles. */
  models: () => api.get<Array<{ id: string; name: string; version: string; description: string; available: boolean }>>("/market/predictions/models").then((r) => r.data),
  /** Métriques d'évaluation d'une prédiction. */
  evaluation: (id: number) => api.get<{
    predictionId: number; modelName: string; modelVersion: string; evaluationPoints: number | null;
    mae: number | null; rmse: number | null; mape: number | null; status: string;
  }>(`/market/predictions/${id}/evaluation`).then((r) => r.data),
  /** Backtesting & calibration agrégés (optionnellement filtré par symbole). */
  backtest: (symbol?: string) => api.get<{
    total: number; resolved: number; pending: number;
    successRate: number | null; brierScore: number | null;
    byDirection: Record<string, { total: number; correct: number; rate: number }>;
    calibration: { from: number; to: number; count: number; avgConfidence: number; actualRate: number }[];
  }>(`/market/predictions/backtest`, { params: symbol ? { symbol } : {} }).then((r) => r.data),
  /** Génère et persiste une nouvelle prédiction (ADMIN). */
  generate: (symbol: string, horizon?: number) =>
    api.post<MarketPrediction>("/market/predictions/generate", null, { params: { symbol, ...(horizon ? { horizon } : {}) } }).then((r) => r.data),
};

export type MarketHistoryStatus = "REAL" | "CACHED" | "STALE" | "UNAVAILABLE";
export type MarketHistoryPeriod = "1M" | "3M" | "6M" | "1Y" | "ALL";

export interface MarketHistoryPoint {
  date: string;
  close: number;
}

export interface MarketHistoryDto {
  symbol: string;
  name: string | null;
  type: Asset["type"] | null;
  source: string | null;
  status: MarketHistoryStatus;
  lastUpdated: string | null;
  from: string | null;
  to: string | null;
  points: number;
  firstClose: number | null;
  lastClose: number | null;
  changePct: number | null;
  dataHash: string | null;
  period: MarketHistoryPeriod;
  prices: MarketHistoryPoint[];
  message: string | null;
}

export const marketHistoryApi = {
  /** Historique de cours réels d'un instrument, enrichi du statut de fraîcheur et filtré par période. */
  get: (symbol: string, period?: MarketHistoryPeriod) =>
    api.get<MarketHistoryDto>("/market/history", { params: { symbol, period } }).then((r) => r.data),
  /** Re-télécharge l'historique depuis le fournisseur distant (ADMIN). */
  refresh: (symbol: string) =>
    api.post<MarketHistoryDto>("/market/history/refresh", null, { params: { symbol } }).then((r) => r.data),
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

// ─── Progression : portefeuille unique (100 000 $, partage avec le trading), niveau du trader, difficulte de l'application ──
export type GuideMode = "DETAILED" | "TIPS" | "NONE";
export type CoachMode = "ALWAYS" | "ALWAYS_NO_HIGHLIGHT" | "AFTER_DECISION" | "HIDDEN";

export interface Difficulty {
  label: string;
  stars: number;
  guide: GuideMode;
  coach: CoachMode;
  /** frais par ordre (fraction du montant) */
  feeRate: number;
  crashForced: boolean;
  crashPct: number;
  minDays: number;
  maxStepDays: number;
  allowSkipToEnd: boolean;
  showStopHint: boolean;
  summary: string;
}

export interface ProgressionGoal { key: string; label: string; current: number; target: number; done: boolean }

export interface Progression {
  balance: number;
  startBalance: number;
  peakBalance: number;
  level: TraderLevel;
  bestLevel: TraderLevel | null;
  skillScore: number;
  games: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  discipline: number;
  avgMaxDrawdown: number;
  restarts: number;
  bankrupt: boolean;
  nextLevel: TraderLevel | null;
  nextGoals: ProgressionGoal[];
  difficulty: Difficulty;
  updatedAt: string | null;
}

export interface SettleGameRequest {
  agentId: number;
  symbol: string;
  days: number;
  model?: PriceModel;
  seed: number;
  crashPct: number | null;
  orders: { day: number; side: "BUY" | "SELL"; fraction?: number }[];
}

export interface SettleGameResponse {
  counted: boolean;
  startBalance: number;
  endBalance: number;
  pnl: number;
  trades: number;
  wins: number;
  maxDrawdown: number;
  fees: number;
  levelBefore: TraderLevel;
  levelAfter: TraderLevel;
  levelUp: boolean;
  levelDown: boolean;
  message: string;
  progression: Progression;
}

export interface GameHistoryItem {
  id: number; symbol: string; days: number; startBalance: number; endBalance: number;
  trades: number; wins: number; maxDrawdown: number; levelBefore: TraderLevel; levelAfter: TraderLevel; playedAt: string;
  /** rendement du joueur, de l'agent et de « acheter et garder » sur le meme marche */
  playerReturn: number; agentReturn: number | null; benchmarkReturn: number | null; counted: boolean;
}

// ─── Module 6 : portefeuille multi-actifs ──────────────────────────────────────
export interface PortfolioAsset {
  symbol: string; weight: number; source: "REEL" | "SIMULE"; agentReturn: number; benchmarkReturn: number;
  maxDrawdown: number; trades: number; wins: number;
}
export interface PortfolioResult {
  agentName: string; seed: number; days: number; capital: number; agentReturn: number; benchmarkReturn: number;
  maxDrawdown: number; benchmarkMaxDrawdown: number; sharpe: number; diversification: number; avgCorrelation: number;
  worstSingleDrawdown: number; assets: PortfolioAsset[]; equity: number[]; benchmark: number[]; verdict: string;
}
export const agentPortfolioApi = {
  run: (agentId: number, req: { days: number; seed?: number | null; weights?: Record<string, number>; capital: number; realData: boolean }) =>
    api.post<PortfolioResult>(`/agents/${agentId}/portfolio`, req).then((r) => r.data),
};

export const progressionApi = {
  me: () => api.get<Progression>("/progression/me").then((r) => r.data),
  history: () => api.get<GameHistoryItem[]>("/progression/history").then((r) => r.data),
  settle: (req: SettleGameRequest) => api.post<SettleGameResponse>("/progression/games", req).then((r) => r.data),
  restart: (force = false) => api.post<Progression>(`/progression/restart?force=${force}`).then((r) => r.data),
};

export interface AdminTraderScore {
  userId: number; level: TraderLevel; bestLevel: TraderLevel | null; balance: number; skillScore: number;
  games: number; trades: number; winRate: number; discipline: number; bankrupt: boolean; restarts: number;
  updatedAt: string | null;
}

// ─── Notifications (cloche) ─────────────────────────────────────────────────────
export type NotificationType = "LEVEL_UP" | "LEVEL_DOWN" | "LOW_BALANCE" | "BANKRUPT" | "NEW_DEVICE" | "PASSWORD_CHANGED" | "TWO_FACTOR" | "AUTOPILOT" | "INFO";
export interface NotificationView {
  id: number; type: NotificationType; title: string; message: string | null; link: string | null; createdAt: string; read: boolean;
}
export type NotificationFilter = "ALL" | "UNREAD" | "SECURITY" | "PROGRESS" | "INFO";
export const notificationsApi = {
  list: () => api.get<{ unread: number; items: NotificationView[] }>("/notifications").then((r) => r.data),
  history: (filter: NotificationFilter = "ALL") =>
    api.get<{ unread: number; items: NotificationView[] }>("/notifications/history", { params: { filter } }).then((r) => r.data),
  remove: (id: number) => api.delete(`/notifications/${id}`),
  removeRead: () => api.delete<{ deleted: number }>("/notifications/read").then((r) => r.data),
  read: (id: number) => api.post(`/notifications/${id}/read`),
  readAll: () => api.post("/notifications/read-all"),
};

// ─── Classement des traders ─────────────────────────────────────────────────────
export interface LeaderboardBadge { id: string; label: string; description: string }
export interface LeaderboardEntry {
  rank: number; displayName: string; me: boolean; level: TraderLevel; skillScore: number; balance: number;
  games: number; trades: number; winRate: number; badges: LeaderboardBadge[];
}
export const leaderboardApi = {
  get: (limit = 50) =>
    api.get<{ traders: number; me: LeaderboardEntry | null; top: LeaderboardEntry[] }>(`/progression/leaderboard?limit=${limit}`).then((r) => r.data),
};

// ─── Academie du trading : parcours personnalise et mentor IA ─────────────────────
export type AcademyPriority = "HIGH" | "MEDIUM" | "LOW";
export interface AcademyRecommendation { stationId: string; priority: AcademyPriority; reasons: string[] }
export interface AcademyAdvice {
  recommendations: AcademyRecommendation[]; games: number; beatAgent: number; gamesVsAgent: number;
  secretUnlocked: boolean; summary: string;
}
export const academyApi = {
  advice: () => api.get<AcademyAdvice>("/academy/advice").then((r) => r.data),
  mentor: (messages: AssistantMessage[], academyContext: string) =>
    api.post<AssistantReply>("/academy/mentor", { messages, academyContext }).then((r) => r.data),
};

// ─── Module 1 : profil enrichi (preferences, photo, carte de trader) et passkeys ─────────
export type Language = "fr" | "en" | "ar";
export type ThemePref = "light" | "dark" | "system";
export interface Preferences {
  userId: number; language: Language; theme: ThemePref;
  inAppProgress: boolean; inAppSecurity: boolean; emailSecurity: boolean; emailProgress: boolean;
  publicProfile: boolean; publicId: string; bio: string | null; updatedAt: string | null;
}
export type PreferencesUpdate = Partial<Omit<Preferences, "userId" | "publicId" | "updatedAt">>;

export interface CardBadge { id: string; label: string; description: string }
export interface TraderCard {
  publicId: string; isPublic: boolean; displayName: string; avatarUrl: string | null; level: TraderLevel;
  bestLevel: TraderLevel | null; skillScore: number; games: number; trades: number; winRate: number; discipline: number;
  rank: number | null; traders: number; badges: CardBadge[]; memberSince: string | null; bio: string | null;
}

/** Adresse complete d'une ressource du backend (photo de profil...). */
export function backendUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return API_URL.replace(/\/api\/?$/, "") + path;
}

export const profileApi = {
  preferences: () => api.get<Preferences>("/account/preferences").then((r) => r.data),
  updatePreferences: (p: PreferencesUpdate) => api.put<Preferences>("/account/preferences", p).then((r) => r.data),
  newPublicLink: () => api.post<Preferences>("/account/preferences/new-public-link").then((r) => r.data),
  uploadAvatar: (image: string) => api.put<{ avatarUrl: string }>("/account/avatar", { image }).then((r) => r.data),
  deleteAvatar: () => api.delete("/account/avatar"),
  myCard: () => api.get<TraderCard>("/account/card").then((r) => r.data),
  publicCard: (publicId: string) => api.get<TraderCard>(`/public/traders/${publicId}`).then((r) => r.data),
};

export interface Passkey {
  id: number; name: string; backedUp: boolean; transports: string | null; createdAt: string; lastUsedAt: string | null;
}
export const passkeyApi = {
  registrationOptions: () => api.post<Record<string, unknown>>("/account/passkeys/options").then((r) => r.data),
  register: (body: { id: string; clientDataJSON: string; attestationObject: string; transports: string[]; name: string }) =>
    api.post<Passkey>("/account/passkeys", body).then((r) => r.data),
  list: () => api.get<Passkey[]>("/account/passkeys").then((r) => r.data),
  rename: (id: number, name: string) => api.patch<Passkey>(`/account/passkeys/${id}`, { name }).then((r) => r.data),
  remove: (id: number) => api.delete(`/account/passkeys/${id}`),
  loginOptions: () => api.post<Record<string, unknown>>("/auth/passkey/options").then((r) => r.data),
  login: (body: { id: string; clientDataJSON: string; authenticatorData: string; signature: string; userHandle: string | null }) =>
    api.post<AuthResponse>("/auth/passkey/login", body).then((r) => r.data),
};

// ─── Recherche globale (barre du haut) ───────────────────────────────────────────
export type SearchHitType = "ASSET" | "AGENT" | "COURSE" | "TRADER" | "NOTIFICATION" | "USER";
export interface SearchHit { type: SearchHitType; title: string; subtitle: string | null; link: string; badge: string | null; score: number }
export const searchApi = {
  search: (q: string, signal?: AbortSignal) =>
    api.get<{ query: string; hits: SearchHit[] }>("/search", { params: { q }, signal }).then((r) => r.data),
};

// ─── Messagerie de support (trader <-> administration) ─────────────────────────────
export type SupportCategory = "FUNDS" | "TECHNICAL" | "ACCOUNT" | "OTHER";
export type SupportStatus = "OPEN" | "ANSWERED" | "CLOSED";
export interface SupportTicket {
  id: number; subject: string; category: SupportCategory; status: SupportStatus; requestedAmount: number | null;
  requestStatus: "PENDING" | "APPROVED" | "REJECTED" | null; createdAt: string; lastMessageAt: string; unread: boolean;
  lastMessage: string | null; lastFromAdmin: boolean;
  /** visibles par l'administration seulement */
  userId: number | null; userName: string | null; userEmail: string | null; userAvatarUrl: string | null; userBalance: number | null;
}
export interface SupportMessage { id: number; fromAdmin: boolean; system: boolean; mine: boolean; authorName: string; body: string; createdAt: string }
export interface SupportThread { ticket: SupportTicket; messages: SupportMessage[] }
export const supportApi = {
  mine: () => api.get<SupportTicket[]>("/support/tickets").then((r) => r.data),
  create: (body: { subject: string; category: SupportCategory; body: string; amount?: number | null }) =>
    api.post<SupportThread>("/support/tickets", body).then((r) => r.data),
  open: (id: number) => api.get<SupportThread>(`/support/tickets/${id}`).then((r) => r.data),
  reply: (id: number, body: string) => api.post<SupportThread>(`/support/tickets/${id}/messages`, { body }).then((r) => r.data),
  unread: () => api.get<{ count: number }>("/support/unread").then((r) => r.data.count),
  all: (status = "ALL", category = "ALL") =>
    api.get<SupportTicket[]>("/admin/support/tickets", { params: { status, category } }).then((r) => r.data),
  setStatus: (id: number, status: SupportStatus) => api.post<SupportThread>(`/admin/support/tickets/${id}/status`, { status }).then((r) => r.data),
  decide: (id: number, approve: boolean, note: string) =>
    api.post<SupportThread>(`/admin/support/tickets/${id}/decision`, { approve, note }).then((r) => r.data),
};
