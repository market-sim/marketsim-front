import { useEffect, useState } from "react";
import { strategiesApi, type Strategy } from "../../api/endpoints";
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
  Trash2,
} from "lucide-react";
import { fmt, pct, priceDisplay, MONO, DISPLAY, SignalBadge, SectionHeader, CardShell } from "../../shared/ui";
import type { Signal, Sentiment, Direction, BankStatus } from "../../shared/ui";
import { indicators } from "./mockData";

const num = (v: number | null | undefined, suffix = "") => (v == null ? "—" : `${v}${suffix}`);

export default function AnalysisPage() {
  // Module 3 : strategies de l'utilisateur (CRUD /api/analysis/strategies)
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const load = () => strategiesApi.list().then(setStrategies).catch(() => setStrategies([]));
  useEffect(() => { load(); }, []);

  // TODO module 3 : remplacer le prompt par un vrai formulaire (Dialog de components/ui)
  const createStrategy = async () => {
    const name = prompt("Nom de la stratégie ?");
    if (!name) return;
    await strategiesApi.create({ name, indicators: "RSI(14)", status: "ACTIVE" });
    load();
  };

  const deleteStrategy = async (id: number) => {
    await strategiesApi.remove(id);
    load();
  };
  return (
    <div className="space-y-5">
      <CardShell className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Saved Strategies</h3>
          <button onClick={createStrategy} className="flex items-center gap-1.5 text-[11px] text-blue-600 font-medium hover:text-blue-800">
            <Plus className="w-3.5 h-3.5" />New Strategy
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
              <th className="text-left px-5 py-3">Strategy</th>
              <th className="text-right px-5 py-3">Sharpe</th>
              <th className="text-right px-5 py-3">Win Rate</th>
              <th className="text-right px-5 py-3">Max DD</th>
              <th className="text-right px-5 py-3">Trades</th>
              <th className="text-right px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {strategies.map((s) => (
              <tr key={s.id} className="hover:bg-muted/10 transition-colors group">
                <td className="px-5 py-3.5 text-sm font-medium text-foreground">{s.name}</td>
                <td className="px-5 py-3.5 text-right text-sm text-foreground" style={MONO}>{num(s.sharpe)}</td>
                <td className="px-5 py-3.5 text-right text-sm font-medium text-emerald-600" style={MONO}>{num(s.winRate, "%")}</td>
                <td className="px-5 py-3.5 text-right text-sm text-red-500" style={MONO}>{num(s.maxDrawdown, "%")}</td>
                <td className="px-5 py-3.5 text-right text-sm text-muted-foreground" style={MONO}>{num(s.trades)}</td>
                <td className="px-5 py-3.5 text-right">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${s.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{s.status}</span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <FlaskConical className="w-3 h-3" />Backtest
                  </button>
                  <button onClick={() => deleteStrategy(s.id!)} className="ml-3 inline-flex items-center text-[11px] text-red-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardShell>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardShell className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Technical Indicators</h3>
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">AAPL · 1D</span>
          </div>
          <div className="space-y-1">
            {indicators.map((ind) => (
              <div key={ind.name} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                <div>
                  <p className="text-xs font-medium text-foreground" style={MONO}>{ind.name}</p>
                  <p className="text-[10px] text-muted-foreground">{ind.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-foreground" style={MONO}>{ind.value}</p>
                  <p className={`text-[10px] font-medium ${ind.signal.includes("Bull") || ind.signal.includes("Over") || ind.signal.includes("Cross") || ind.signal.includes("Support") ? "text-emerald-600" : "text-amber-600"}`}>{ind.signal}</p>
                </div>
              </div>
            ))}
          </div>
        </CardShell>

        <CardShell className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4" style={DISPLAY}>Last Backtest — Momentum Alpha</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Total Return",    value: "+34.8%", ok: true  },
              { label: "Sharpe Ratio",    value: "1.84",   ok: true  },
              { label: "Max Drawdown",    value: "-8.4%",  ok: false },
              { label: "Profit Factor",   value: "2.12",   ok: true  },
              { label: "Total Trades",    value: "142",    ok: true  },
              { label: "Avg Hold Time",   value: "3.2d",   ok: true  },
            ].map(({ label, value, ok }) => (
              <div key={label} className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                <p className={`text-sm font-semibold ${ok ? "text-foreground" : "text-red-500"}`} style={MONO}>{value}</p>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="text-[11px] font-medium text-blue-700 mb-1">AI Comparison Insight</p>
            <p className="text-[11px] text-blue-600 leading-relaxed">Momentum Alpha outperforms 78% of strategies in the same risk class. Consider running against Q1 2025 data for out-of-sample validation.</p>
          </div>
        </CardShell>
      </div>
    </div>
  );
}
