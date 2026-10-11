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

export const agentDecisions: {
  asset: string; action: Signal; qty: number; confidence: number; reason: string; timestamp: string; reward: string;
}[] = [
  { asset: "AAPL",    action: "BUY",  qty: 5, confidence: 0.78, reason: "RSI oversold (28) + positive news sentiment + upward MACD crossover", timestamp: "Today 14:32",     reward: "+$48.20" },
  { asset: "EUR/USD", action: "HOLD", qty: 0, confidence: 0.55, reason: "Mixed signals — awaiting ECB rate decision in 2h",                    timestamp: "Today 13:15",     reward: "—"       },
  { asset: "GOLD",    action: "BUY",  qty: 2, confidence: 0.72, reason: "Safe-haven demand rising, DXY weakening, upward momentum confirmed",  timestamp: "Today 11:48",     reward: "+$31.60" },
  { asset: "TSLA",    action: "SELL", qty: 3, confidence: 0.65, reason: "Overbought RSI (74), resistance at $255, negative price momentum",    timestamp: "Yesterday 16:02", reward: "+$22.50" },
];
