import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { assetsApi, type Asset } from "../../api/endpoints";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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
import { fmt, pct, priceDisplay, MONO, DISPLAY, SignalBadge, SectionHeader, CardShell } from "../../shared/ui";
import type { Signal, Sentiment, Direction, BankStatus } from "../../shared/ui";
import DashboardTop from "./DashboardTop";

export default function DashboardPage() {
  const navigate = useNavigate();
  // Module 5 : cotations venant du backend (GET /api/market/assets)
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => { assetsApi.list().then(setAssets).catch(() => setAssets([])); }, []);

  const dashModules = [
    { id: 2, navId: "trading",    title: "Trading & Risk",      Icon: TrendingUp,   description: "Order execution, portfolio & Stop-loss AI",         iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { id: 3, navId: "analysis",   title: "Financial Analysis",  Icon: BarChart2,    description: "Technical indicators, backtesting & strategies",      iconBg: "bg-violet-50",  iconColor: "text-violet-600"  },
    { id: 4, navId: "education",  title: "Education",           Icon: GraduationCap,description: "Courses, quizzes & AI-personalized content",           iconBg: "bg-amber-50",   iconColor: "text-amber-600"   },
    { id: 5, navId: "market",     title: "Market & Prediction", Icon: Radio,        description: "Real-time data, LSTM forecasting & NLP sentiment",    iconBg: "bg-cyan-50",    iconColor: "text-cyan-600"    },
    { id: 6, navId: "agent",      title: "AI Trading Agent",    Icon: Bot,          description: "Autonomous RL agent with XAI decision explanations",  iconBg: "bg-rose-50",    iconColor: "text-rose-600"    },
    { id: 7, navId: "stress",     title: "Stress Testing",      Icon: Activity,     description: "Bank resilience, actuarial modeling & SHAP/LIME",     iconBg: "bg-orange-50",  iconColor: "text-orange-600"  },
  ];

  return (
    <div className="space-y-5">
      {/* Haut du tableau de bord : vraies donnees (portefeuille, niveau, parties, decisions de l'IA) */}
      <DashboardTop />

      {/* Market Table */}
      <CardShell className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Live Market Overview</h3>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><RefreshCw className="w-3 h-3" /><span>Auto-refreshing · 5s</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                <th className="text-left px-5 py-3">Asset</th>
                <th className="text-right px-5 py-3">Price</th>
                <th className="text-right px-5 py-3">24h Change</th>
                <th className="text-right px-5 py-3">Type</th>
                <th className="text-right px-5 py-3">AI Signal</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {assets.map((asset) => (
                <tr key={asset.symbol} className="hover:bg-muted/10 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-blue-700">{asset.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{asset.symbol}</div>
                        <div className="text-[11px] text-muted-foreground">{asset.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right"><span className="text-sm font-medium text-foreground" style={MONO}>{priceDisplay(Number(asset.price))}</span></td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${asset.changePct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {asset.changePct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {pct(asset.changePct)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right"><span className="text-[11px] text-muted-foreground" style={MONO}>{asset.type}</span></td>
                  <td className="px-5 py-3.5 text-right"><SignalBadge signal={asset.changePct >= 0 ? "BUY" : "SELL"} />  {/* TODO IA module 5 : vrai signal */}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="text-[11px] text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-800" onClick={() => navigate("/trading")}>Trade →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardShell>

      {/* Module Cards */}
      <div>
        <SectionHeader title="Platform Modules" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {dashModules.map(({ id, navId, title, Icon, description, iconBg, iconColor }) => (
            <div key={id} onClick={() => navigate(`/${navId}`)} className="bg-white rounded-xl p-4 border border-border/60 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{description}</p>
              <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground">Module {id}</span>
                <ChevronRight className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
          <div onClick={() => navigate("/blockchain")} className="rounded-xl p-4 cursor-pointer group hover:shadow-lg transition-shadow" style={{ background: "linear-gradient(135deg, #1D4ED8, #0F2E7A)" }}>
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center mb-3">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-semibold text-white">Blockchain Layer</p>
            <p className="text-[11px] text-blue-200 mt-1 leading-snug">Immutable trade records, NFT certificates &amp; XAI audit trail</p>
            <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between">
              <span className="text-[10px] font-medium text-blue-300">Hyperledger Fabric</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/60 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
