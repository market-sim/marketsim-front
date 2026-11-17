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

export const blockchainTx = [
  { hash: "0x3f7a...c8d2", type: "Trade",       asset: "AAPL × 10",           user: "Ahmed Khalil",  block: 18842310, time: "2 min ago",  status: "Confirmed" },
  { hash: "0x9b2e...41fa", type: "Backtest",     asset: "Strategy Alpha",       user: "Sofia Chen",    block: 18842305, time: "8 min ago",  status: "Confirmed" },
  { hash: "0xd41c...77ee", type: "Certificate",  asset: "Level 4 Badge",        user: "Ahmed Khalil",  block: 18842298, time: "22 min ago", status: "Confirmed" },
  { hash: "0x5f8a...b3c1", type: "Trade",        asset: "BTC/USD × 0.5",        user: "Marcus Dupont", block: 18842290, time: "35 min ago", status: "Confirmed" },
  { hash: "0x1e9d...f02a", type: "XAI Audit",    asset: "Agent Decision #142",  user: "System",        block: 18842281, time: "1h ago",      status: "Confirmed" },
];

export const certificates = [
  { title: "Trading Foundations",  date: "Oct 1, 2026",  tokenId: "#4821", type: "Completion"  },
  { title: "Risk Management Pro",  date: "Sep 15, 2026", tokenId: "#4190", type: "Completion"  },
  { title: "Backtest Champion",    date: "Aug 30, 2026", tokenId: "#3847", type: "Achievement" },
];
