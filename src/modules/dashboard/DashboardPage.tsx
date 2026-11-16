import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { assetsApi, portfolioApi, type Asset, type Portfolio } from "../../api/endpoints";
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
import { quotePrice } from "../market/LiveQuotes";
import { useAuth } from "../../auth/AuthContext";

export default function DashboardPage() {
  const navigate = useNavigate();
  // Module 5 : cotations venant du backend (GET /api/market/assets)
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => {
    const load = () => assetsApi.list().then(setAssets).catch(() => setAssets([]));
    load();
    const id = window.setInterval(load, 5000);   // prix du moteur de prix (module 5)
    return () => window.clearInterval(id);
  }, []);
  // Module 2 : portefeuille virtuel reel (GET /api/trading/portfolio)
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  // (pas pour l'admin : il n'a ni portefeuille ni score)
  const isAdmin = useAuth().user?.role === "ADMIN";
  useEffect(() => { if (!isAdmin) portfolioApi.get().then(setPortfolio).catch(() => setPortfolio(null)); }, [isAdmin]);
  const inProfit = portfolio?.positions.filter((p) => p.unrealizedPnl > 0).length ?? 0;

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

      {/* Module 2 : portefeuille de trading reel (GET /api/trading/portfolio) */}
      {portfolio && (
        <button type="button" onClick={() => navigate("/trading")} className="block w-full text-start">
        <CardShell className="p-4 hover:shadow-sm transition-shadow">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Compte de trading</p>
                <p className="text-lg font-semibold text-foreground" style={MONO}>{fmt(portfolio.equity)}</p>
              </div>
            </div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest">Rendement</p>
              <p className={`text-sm font-semibold ${portfolio.totalReturnPct >= 0 ? "text-emerald-600" : "text-red-500"}`} style={MONO}>{portfolio.totalReturnPct >= 0 ? "+" : ""}{portfolio.totalReturnPct} %</p></div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest">Liquidités</p>
              <p className="text-sm font-semibold text-foreground" style={MONO}>{fmt(portfolio.cash)}</p></div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest">Positions ouvertes</p>
              <p className="text-sm font-semibold text-foreground">{portfolio.openPositions} <span className="text-[11px] font-normal text-muted-foreground">· {inProfit} en gain · {portfolio.pendingOrders} en attente</span></p></div>
            <span className="ms-auto inline-flex items-center gap-1 text-[12px] font-medium text-blue-600">Ouvrir le trading <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" /></span>
          </div>
        </CardShell>
        </button>
      )}

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
                <th className="text-right px-5 py-3">Variation du jour</th>
                <th className="text-right px-5 py-3">Type</th>
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
                  <td className="px-5 py-3.5 text-right"><span className="text-sm font-medium text-foreground" style={MONO}>{quotePrice(asset)}</span></td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${asset.changePct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {asset.changePct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {pct(asset.changePct)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right"><span className="text-[11px] text-muted-foreground" style={MONO}>{asset.type}</span></td>
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
            <p className="text-sm font-semibold text-white">Registre d&apos;audit</p>
            <p className="text-[11px] text-blue-200 mt-1 leading-snug">Décisions de l&apos;IA figées, chaînées et vérifiables (preuves de Merkle)</p>
            <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between">
              <span className="text-[10px] font-medium text-blue-300">Chaîne HMAC · pas encore de blockchain publique</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/60 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
