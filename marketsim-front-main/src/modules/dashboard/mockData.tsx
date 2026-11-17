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

export const portfolioData = [
  { date: "Sep 12", value: 118200, benchmark: 115000 },
  { date: "Sep 15", value: 119800, benchmark: 115800 },
  { date: "Sep 18", value: 117400, benchmark: 116200 },
  { date: "Sep 21", value: 121300, benchmark: 116900 },
  { date: "Sep 24", value: 123100, benchmark: 117200 },
  { date: "Sep 27", value: 122400, benchmark: 117800 },
  { date: "Sep 30", value: 124800, benchmark: 118100 },
  { date: "Oct 03", value: 123200, benchmark: 118400 },
  { date: "Oct 06", value: 125480, benchmark: 118900 },
];

export const marketAssets: {
  symbol: string; name: string; price: number; change: number; volume: string; signal: Signal;
}[] = [
  { symbol: "AAPL",   name: "Apple Inc.",         price: 192.45,  change: 1.24,  volume: "52.3M",   signal: "BUY"  },
  { symbol: "TSLA",   name: "Tesla Inc.",          price: 248.30,  change: -0.82, volume: "89.1M",   signal: "HOLD" },
  { symbol: "EUR/USD",name: "Euro / US Dollar",    price: 1.0842,  change: 0.31,  volume: "3.2B",    signal: "BUY"  },
  { symbol: "BTC/USD",name: "Bitcoin",             price: 67240,   change: 2.14,  volume: "24.7B",   signal: "BUY"  },
  { symbol: "GOLD",   name: "Gold Spot",           price: 2341.60, change: 0.54,  volume: "182K oz", signal: "HOLD" },
  { symbol: "WTI",    name: "Crude Oil WTI",       price: 78.90,   change: -1.12, volume: "421K",    signal: "SELL" },
];

export const aiInsights: { asset: string; message: string; type: string; sentiment: Sentiment }[] = [
  { asset: "AAPL",    message: "Upward trend expected over 48h. Confidence: 78%",           type: "Prediction", sentiment: "bullish" },
  { asset: "BTC/USD", message: "High volatility detected. Recommend reducing exposure",      type: "Risk",       sentiment: "caution" },
  { asset: "EUR/USD", message: "Positive ECB news flow. Sentiment score: +0.64",            type: "Sentiment",  sentiment: "bullish" },
  { asset: "TSLA",    message: "AI agent placed HOLD — momentum insufficient for entry",    type: "Agent",      sentiment: "neutral" },
];
