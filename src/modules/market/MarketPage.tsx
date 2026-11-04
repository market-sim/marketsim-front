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
import { predictions, newsItems } from "./mockData";

export default function MarketPage() {
  return (
    <div className="space-y-5">
      <div>
        <SectionHeader
          title="AI Price Predictions"
          action={<span className="text-[11px] text-muted-foreground">Models: LSTM · Prophet · Ensemble</span>}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {predictions.map((pred) => (
            <CardShell key={pred.asset} className="p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-blue-700">{pred.asset.slice(0, 2)}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{pred.asset}</span>
                </div>
                <span className={`text-[12px] font-bold ${pred.direction === "UP" ? "text-emerald-600" : pred.direction === "DOWN" ? "text-red-500" : "text-amber-600"}`}>
                  {pred.direction === "UP" ? "▲" : pred.direction === "DOWN" ? "▼" : "━"} {pred.direction}
                </span>
              </div>
              <div className="mb-3">
                <p className="text-[10px] text-muted-foreground mb-1">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full">
                    <div className={`h-1.5 rounded-full ${pred.confidence >= 70 ? "bg-emerald-500" : pred.confidence >= 55 ? "bg-amber-400" : "bg-slate-400"}`} style={{ width: `${pred.confidence}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground shrink-0">{pred.confidence}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">Target: <span className="font-medium text-foreground" style={MONO}>{pred.target >= 1000 ? `$${pred.target.toLocaleString()}` : `$${pred.target}`}</span></span>
                <span className="text-muted-foreground">Horizon: <span className="font-medium text-foreground">{pred.horizon}</span></span>
              </div>
              <p className="text-[10px] text-muted-foreground">Model: <span className="font-medium">{pred.model}</span></p>
            </CardShell>
          ))}
        </div>
      </div>

      <CardShell className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
          <Newspaper className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>News Sentiment Analysis</h3>
        </div>
        <div className="divide-y divide-border/40">
          {newsItems.map((item, i) => (
            <div key={i} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/10 transition-colors">
              <div className="shrink-0">
                <div className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded ${item.sentiment >= 0.5 ? "bg-emerald-100 text-emerald-700" : item.sentiment >= 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                  {item.sentiment >= 0 ? "+" : ""}{item.sentiment.toFixed(2)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{item.headline}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-medium text-blue-600">{item.source}</span>
                  <span className="text-[10px] text-muted-foreground">→ {item.asset}</span>
                  <span className="text-[10px] text-muted-foreground">{item.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardShell>
    </div>
  );
}
