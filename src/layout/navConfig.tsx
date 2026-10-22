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

export const adminNavItem = { path: "/admin", label: "Admin Panel", Icon: Lock };
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
  "/education":  { title: "Education",              sub: "Courses · Quizzes · Leaderboard"               },
  "/market":     { title: "Market & Prediction",    sub: "AI Forecasts · Sentiment Analysis"             },
  "/agent":      { title: "AI Trading Agent",       sub: "Autonomous RL Agent · XAI Explanations"        },
  "/stress":     { title: "Stress Testing",         sub: "Scenario Simulation · Bank Resilience"         },
  "/blockchain": { title: "Blockchain Layer",       sub: "Immutable Records · Certificates · Audit Trail" },
  "/admin":          { title: "Administration",         sub: "Comptes utilisateurs · Module 1"               },
  "/admin/settings": { title: "Paramètres",             sub: "Inscription · Verrouillage · Module 1"         },
  "/admin/activity": { title: "Journal d'activité",    sub: "Connexions · Profil · Admin · Module 1"       },
  "/admin/login-anomalies": {
    title: "Anomalies de connexion",
    sub: "Risque IA consultatif · Module 1",
  },
  "/profile":        { title: "Profil",                 sub: "Nom · Email · Mot de passe"                    },
};
