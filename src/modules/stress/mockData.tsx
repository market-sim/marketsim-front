// Donnees fictives du template (a remplacer progressivement par les appels API).
import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  GraduationCap,
  Radio,
  Bot,
  Activity,
  Shield,
  Bell,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Menu,
  Settings,
  ChevronRight,
  User,
  RefreshCw,
  Layers,
  Lock,
  Award,
  Target,
  Wallet,
  Zap,
  Trophy,
  Play,
  CheckCircle,
  Brain,
  Building2,
  AlertTriangle,
  Link as LinkIcon,
  Plus,
  FlaskConical,
  Newspaper,
} from "lucide-react";
import type { Signal, Sentiment, Direction, BankStatus } from "../../shared/ui";

export const bankResults: {
  name: string; tier1: number; lcr: number; nsfr: number; impact: number; status: BankStatus;
}[] = [
  { name: "Banque Nationale",    tier1: 12.4, lcr: 118, nsfr: 108, impact: -3.2, status: "Pass" },
  { name: "Crédit Populaire",    tier1: 9.8,  lcr: 102, nsfr: 95,  impact: -5.8, status: "Warn" },
  { name: "Société Financière",  tier1: 7.2,  lcr: 88,  nsfr: 82,  impact: -9.1, status: "Fail" },
  { name: "Banque Islamique",    tier1: 14.1, lcr: 135, nsfr: 122, impact: -2.4, status: "Pass" },
];
