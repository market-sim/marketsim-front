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

export const predictions: {
  asset: string; direction: Direction; confidence: number; target: number; horizon: string; model: string;
}[] = [
  { asset: "AAPL",    direction: "UP",   confidence: 78, target: 198.00, horizon: "48h", model: "LSTM"     },
  { asset: "BTC/USD", direction: "UP",   confidence: 65, target: 71000,  horizon: "7d",  model: "Prophet"  },
  { asset: "EUR/USD", direction: "FLAT", confidence: 55, target: 1.0900, horizon: "24h", model: "LSTM"     },
  { asset: "GOLD",    direction: "UP",   confidence: 72, target: 2380,   horizon: "3d",  model: "Ensemble" },
  { asset: "TSLA",    direction: "DOWN", confidence: 61, target: 235.00, horizon: "48h", model: "LSTM"     },
  { asset: "WTI",     direction: "DOWN", confidence: 58, target: 75.50,  horizon: "5d",  model: "Prophet"  },
];

export const newsItems = [
  { source: "Reuters",        headline: "Fed signals pause in rate hikes as inflation cools",              sentiment: 0.68,  asset: "EUR/USD", time: "2h ago" },
  { source: "Bloomberg",      headline: "Apple beats earnings expectations, raises full-year guidance",     sentiment: 0.82,  asset: "AAPL",    time: "4h ago" },
  { source: "CNBC",           headline: "Oil inventories rise unexpectedly, prices under pressure",         sentiment: -0.45, asset: "WTI",     time: "5h ago" },
  { source: "Financial Times",headline: "Bitcoin ETF inflows hit record on institutional demand surge",     sentiment: 0.71,  asset: "BTC/USD", time: "6h ago" },
];
