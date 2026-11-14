import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  GraduationCap,
  Radio,
  Bot,
  Activity,
  Shield,
  Lock,
  Settings,
  ScrollText,
  ShieldAlert,
  PieChart,
  KeyRound,
  Trophy,
  Mail,
  Medal,
  MessagesSquare,
} from "lucide-react";

// Menu lateral : une entree par module (path = route React).
export const navItems = [
  { path: "/",           label: "Dashboard",             Icon: LayoutDashboard },
  { path: "/trading",    label: "Trading & Risk",         Icon: TrendingUp      },
  { path: "/analysis",   label: "Financial Analysis",     Icon: BarChart2       },
  { path: "/education",  label: "Education",              Icon: GraduationCap   },
  { path: "/market",     label: "Market & Prediction",    Icon: Radio           },
  { path: "/agent",      label: "AI Trading Agent",       Icon: Bot             },
  { path: "/stress",     label: "Stress Testing",         Icon: Activity        },
  { path: "/blockchain", label: "Blockchain Layer",       Icon: Shield          },
];

/** Pour les traders (pas l'admin) : portefeuille, niveau et comparaison avec l'agent. */
export const progressionNavItem = { path: "/progression", label: "Ma progression", Icon: Trophy };
/** Pour tout le monde : sessions, double authentification, donnees personnelles. */
/** Pour tout le monde : classement public des traders. */
export const leaderboardNavItem = { path: "/leaderboard", label: "Classement", Icon: Medal };
export const securityNavItem = { path: "/security", label: "Sécurité", Icon: KeyRound };

/** Messagerie de support : le trader ecrit a l'administration, l'admin repond depuis sa boite de reception. */
export const messagesNavItem = { path: "/messages", label: "Messagerie", Icon: MessagesSquare };
export const adminMessagesNavItem = { path: "/admin/messages", label: "Messagerie", Icon: MessagesSquare };

export const adminNavItem = { path: "/admin", label: "Admin Panel", Icon: Lock };
export const adminOutboxNavItem = { path: "/admin/outbox", label: "Boîte d'envoi", Icon: Mail };
export const adminStatsNavItem = { path: "/admin/stats", label: "Statistiques", Icon: PieChart };
export const adminSettingsNavItem = { path: "/admin/settings", label: "Paramètres", Icon: Settings };
export const adminActivityNavItem = { path: "/admin/activity", label: "Activité", Icon: ScrollText };
export const adminLoginAnomaliesNavItem = {
  path: "/admin/login-anomalies",
  label: "Anomalies login",
  Icon: ShieldAlert,
};

export const pageTitles: Record<string, { title: string; sub: string }> = {
  "/":           { title: "Dashboard",             sub: "Virtual Portfolio Overview"                    },
  "/trading":    { title: "Trading & Risk",         sub: "Order Execution · Position Management"         },
  "/analysis":   { title: "Financial Analysis",     sub: "Strategies · Backtesting · Indicators"         },
  "/education":  { title: "Formation & pédagogie", sub: "Académie 3D · Cours · Quiz"                     },
  "/market":     { title: "Market & Prediction",    sub: "AI Forecasts · Sentiment Analysis"             },
  "/agent":      { title: "AI Trading Agent",       sub: "Autonomous RL Agent · XAI Explanations"        },
  "/stress":     { title: "Stress Testing",         sub: "Scenario Simulation · Bank Resilience"         },
  "/blockchain": { title: "Blockchain Layer",       sub: "Immutable Records · Certificates · Audit Trail" },
  "/admin":          { title: "Administration",         sub: "Comptes utilisateurs · Module 1"               },
  "/admin/stats":    { title: "Statistiques",           sub: "Supervision · Comptes · Connexions · Module 1" },
  "/admin/settings": { title: "Paramètres",             sub: "Inscription · Verrouillage · Module 1"         },
  "/admin/activity": { title: "Journal d'activité",    sub: "Connexions · Profil · Admin · Module 1"       },
  "/admin/login-anomalies": {
    title: "Anomalies de connexion",
    sub: "Risque IA consultatif · Module 1",
  },
  "/profile":        { title: "Profil",                 sub: "Photo · Préférences · Carte de trader · Mot de passe" },
  "/security":       { title: "Sécurité du compte",     sub: "Passkeys · Sessions · Double authentification · Données · Module 1" },
  "/leaderboard":    { title: "Classement",             sub: "Top traders · Niveaux · Badges · Module 6" },
  "/progression":    { title: "Ma progression",         sub: "Portefeuille · Niveau · Toi contre l'agent · Module 6" },
  "/messages":       { title: "Messagerie",             sub: "Contacter l'administration · Demandes de fonds · Problèmes" },
  "/admin/messages": { title: "Messagerie",             sub: "Demandes des traders · Réponses · Fonds · Module 1" },
  "/notifications":  { title: "Notifications",          sub: "Sécurité · Progression · Infos · Module 1" },
  "/admin/outbox":   { title: "Boîte d'envoi",          sub: "E-mails de la plateforme · SMTP (Mailtrap, Gmail…) · Module 1" },
};
