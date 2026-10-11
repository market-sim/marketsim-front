import { useState } from "react";
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
import { agentDecisions } from "./mockData";

export default function AgentPage() {
  const [running, setRunning] = useState(true);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent Config */}
        <CardShell className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Agent Alpha-7</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-emerald-500" : "bg-slate-400"}`} />
                <span className="text-[11px] text-muted-foreground">{running ? "Running" : "Paused"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-0">
            {[
              { label: "Strategy",      value: "Reinforcement Learning (PPO)" },
              { label: "Risk Level",    value: "Medium (35 / 100)"            },
              { label: "Assets",        value: "AAPL, TSLA, BTC, GOLD"       },
              { label: "Max Position",  value: "$10,000 per trade"            },
              { label: "Frequency",     value: "Intraday · 15min candles"    },
              { label: "Total Decisions",value: "1,842 since deploy"         },
              { label: "Agent Win Rate",value: "71.3%"                       },
              { label: "Cumulative",    value: "+$14,240 (virtual)"          },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between py-2 border-b border-border/40 last:border-0 text-[12px]">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="font-medium text-foreground text-right ml-3">{value}</span>
              </div>
            ))}
          </div>

          <button onClick={() => setRunning(!running)} className={`w-full mt-4 py-2 rounded-lg text-sm font-semibold transition-colors ${running ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
            {running ? "Pause Agent" : "Resume Agent"}
          </button>
        </CardShell>

        {/* Decision Feed */}
        <CardShell className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Recent Decisions &amp; XAI Explanations</h3>
            <span className="text-[10px] font-medium bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">SHAP / LIME</span>
          </div>
          <div className="divide-y divide-border/40">
            {agentDecisions.map((dec, i) => (
              <div key={i} className="px-5 py-4 hover:bg-muted/10 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-blue-700">{dec.asset.slice(0, 2)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{dec.asset}</span>
                        <SignalBadge signal={dec.action} />
                        {dec.qty > 0 && <span className="text-[11px] text-muted-foreground">× {dec.qty}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{dec.timestamp}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-600" style={MONO}>{dec.reward}</p>
                    <p className="text-[11px] text-muted-foreground">Conf: {Math.round(dec.confidence * 100)}%</p>
                  </div>
                </div>
                <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">XAI Explanation</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{dec.reason}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-200 rounded-full">
                      <div className="h-1 bg-blue-500 rounded-full" style={{ width: `${dec.confidence * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">Confidence</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardShell>
      </div>
    </div>
  );
}
