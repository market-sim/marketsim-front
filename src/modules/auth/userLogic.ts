// Logique pure du module 1 (profil, mots de passe, liste admin) : testee par scripts/test-logic.cjs.
import type { Role, SecurityRiskBand, TraderLevel, User } from "../../api/endpoints";

// ===================== Niveau de trader =====================

export const LEVELS: TraderLevel[] = ["DEBUTANT", "INTERMEDIAIRE", "AVANCE", "EXPERT"];
export const LEVEL_LABELS: Record<string, string> = {
  DEBUTANT: "Débutant", INTERMEDIAIRE: "Intermédiaire", AVANCE: "Avancé", EXPERT: "Expert",
};

/** Seuils du modele serveur (UserLevelModel.levelForScore) : 0-24, 25-49, 50-74, 75-100. */
export function levelProgress(score: number | null | undefined) {
  const s = Math.max(0, Math.min(100, Number(score ?? 0)));
  const index = Math.min(3, Math.floor(s / 25));
  const floor = index * 25;
  const isMax = index === 3;
  const pctInLevel = isMax ? Math.min(100, ((s - 75) / 25) * 100) : ((s - floor) / 25) * 100;
  return {
    level: LEVELS[index],
    next: isMax ? null : LEVELS[index + 1],
    pointsToNext: isMax ? 0 : floor + 25 - s,
    pctInLevel: Math.round(pctInLevel),
    index,
  };
}

/** Codes explicatifs du modele (UserLevelModel.explain) en phrases. */
export const REASON_TEXT: Record<string, string> = {
  ENGAGED_LOGINS: "Connexions régulières",
  PROFILE_MAINTAINED: "Profil tenu à jour",
  TRADING_ACTIVITY: "Activité de trading soutenue",
  RISK_CONTROLS_USED: "Utilisation des stop-loss / take-profit",
  DIVERSIFIED_SYMBOLS: "Portefeuille diversifié",
  LIMITED_ACTIVITY: "Activité de trading encore limitée",
  LEARNED_PROFILE: "Profil appris par le modèle",
  INSUFFICIENT_ACTIVITY: "Pas encore assez d'activité pour évaluer",
};

export const reasonText = (code: string) => REASON_TEXT[code] ?? code;

export interface ActivityFacts {
  logins: number;
  orders: number;
  protectedOrders: number;
  symbols: number;
}

/** done : objectif chiffre deja atteint (le modele le prendra en compte au prochain calcul). */
export interface LevelTip { code: string; text: string; current: number; target: number; unit: string; done: boolean }

/**
 * Conseils pour progresser : un par critere du modele pas encore rempli, avec l'objectif chiffre
 * (memes seuils que UserLevelModel.explain : 12 connexions, 5 ordres, 40 % d'ordres proteges, 2 actifs, 1 mise a jour).
 */
export function levelTips(reasonCodes: string[], f: ActivityFacts): LevelTip[] {
  const has = (c: string) => reasonCodes.includes(c);
  const tips: Omit<LevelTip, "done">[] = [];
  if (!has("TRADING_ACTIVITY")) {
    tips.push({ code: "TRADING_ACTIVITY", text: "Passez davantage d'ordres sur la page Trading", current: f.orders, target: 5, unit: "ordres" });
  }
  if (!has("RISK_CONTROLS_USED")) {
    const target = Math.max(1, Math.ceil(Math.max(f.orders, 1) * 0.4));
    tips.push({ code: "RISK_CONTROLS_USED", text: "Ajoutez un stop-loss ou un take-profit à vos ordres", current: f.protectedOrders, target, unit: "ordres protégés" });
  }
  if (!has("DIVERSIFIED_SYMBOLS")) {
    tips.push({ code: "DIVERSIFIED_SYMBOLS", text: "Diversifiez : tradez au moins deux actifs différents", current: f.symbols, target: 2, unit: "actifs" });
  }
  if (!has("ENGAGED_LOGINS")) {
    tips.push({ code: "ENGAGED_LOGINS", text: "Revenez régulièrement sur la plateforme", current: f.logins, target: 12, unit: "connexions" });
  }
  if (!has("PROFILE_MAINTAINED")) {
    tips.push({ code: "PROFILE_MAINTAINED", text: "Complétez ou mettez à jour votre profil", current: 0, target: 1, unit: "mise à jour" });
  }
  // le nombre de mises a jour du profil n'est pas expose : ce conseil n'est jamais marque comme atteint
  return tips.map((t) => ({ ...t, done: t.code !== "PROFILE_MAINTAINED" && t.current >= t.target }));
}

/** Faits d'activite calcules a partir des ordres (memes definitions que UserLevelFeatureExtractor). */
export function activityFacts(orders: { symbol: string; stopLoss?: number | null; takeProfit?: number | null }[], logins: number): ActivityFacts {
  return {
    logins,
    orders: orders.length,
    protectedOrders: orders.filter((o) => o.stopLoss != null || o.takeProfit != null).length,
    symbols: new Set(orders.map((o) => o.symbol)).size,
  };
}

// ===================== Score de securite =====================

/** Score de connexion : plus il est HAUT, plus le risque est eleve (SecurityScoreCalculator.band : < 40, < 70). */
export function securityStyle(band: SecurityRiskBand | null | undefined) {
  switch (band) {
    case "LOW": return { label: "Risque faible", text: "text-emerald-600", bar: "bg-emerald-500" };
    case "MEDIUM": return { label: "Risque modéré", text: "text-amber-600", bar: "bg-amber-500" };
    case "HIGH": return { label: "Risque élevé", text: "text-red-600", bar: "bg-red-500" };
    default: return { label: "—", text: "text-muted-foreground", bar: "bg-muted-foreground/40" };
  }
}

// ===================== Mot de passe =====================

/** Robustesse indicative 0-4 (longueur, majuscules, chiffres, symboles). Le serveur n'exige que 6 caracteres. */
export function passwordStrength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = pw.length < 6 ? 0 : Math.min(4, s);
  const labels = ["Trop court", "Faible", "Moyen", "Bon", "Excellent"];
  const colors = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];
  return { score, label: labels[score], color: colors[score] };
}

/** Erreur de saisie du nouveau mot de passe, ou null. */
export function passwordError(pw: string, confirm: string): string | null {
  if (pw.length < 6) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (pw !== confirm) return "Les deux mots de passe ne correspondent pas.";
  return null;
}

// ===================== Liste admin des utilisateurs =====================

export interface UserFilter { q: string; role: "" | Role; status: "" | "ENABLED" | "DISABLED"; level: string }
export type UserSort = "name" | "email" | "createdAt" | "level";

export function filterUsers(users: User[], f: UserFilter, sort: UserSort = "name", desc = false): User[] {
  const q = f.q.trim().toLowerCase();
  const rows = users.filter((u) => {
    if (q && !`${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)) return false;
    if (f.role && u.role !== f.role) return false;
    if (f.status === "ENABLED" && !u.enabled) return false;
    if (f.status === "DISABLED" && u.enabled) return false;
    if (f.level && u.level !== f.level) return false;
    return true;
  });
  const key = (u: User): string | number => {
    switch (sort) {
      case "email": return u.email.toLowerCase();
      case "createdAt": return u.createdAt ?? "";
      case "level": return LEVELS.indexOf(u.level as TraderLevel);
      default: return `${u.lastName} ${u.firstName}`.toLowerCase();
    }
  };
  rows.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    const c = ka < kb ? -1 : ka > kb ? 1 : 0;
    return desc ? -c : c;
  });
  return rows;
}
