import { useEffect, useState } from "react";
import { scenariosApi, type StressScenario } from "../../api/endpoints";
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
import { bankResults } from "./mockData";

export default function StressPage() {
  // Module 7 : scenarios venant du backend (GET /api/stress/scenarios)
  const [scenarios, setScenarios] = useState<StressScenario[]>([]);
  useEffect(() => { scenariosApi.list().then(setScenarios).catch(() => setScenarios([])); }, []);
  const [selected, setSelected] = useState(0);
  const scenario = scenarios[selected];
  const severityColor: Record<string, string> = {
    EXTREME: "text-red-600", SEVERE: "text-orange-600", HIGH: "text-amber-600", MODERATE: "text-blue-600",
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionHeader title="Select Stress Scenario" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {scenarios.map((sc, i) => (
            <button key={sc.id} onClick={() => setSelected(i)} className={`rounded-xl p-4 text-left border transition-all ${selected === i ? "border-blue-500 bg-blue-50" : "border-border/60 bg-white hover:border-blue-200 hover:shadow-sm"}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${severityColor[sc.severity]}`}>{sc.severity}</div>
              <p className="text-xs font-semibold text-foreground leading-snug">{sc.name}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">GDP: {sc.gdpShock}% · Credit: {sc.creditShock}%</p>
            </button>
          ))}
        </div>
      </div>

      {scenario && <CardShell className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className={`w-5 h-5 ${severityColor[scenario.severity]}`} />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Scenario: {scenario.name}</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "GDP Shock",            value: `${scenario.gdpShock}%`,                                     negative: scenario.gdpShock < 0 },
            { label: "Interest Rate Shock",  value: `${scenario.rateShock > 0 ? "+" : ""}${scenario.rateShock}%`, negative: false               },
            { label: "Credit Contraction",   value: `${scenario.creditShock}%`,                                   negative: true                 },
          ].map(({ label, value, negative }) => (
            <div key={label} className="bg-muted/30 rounded-lg p-4 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold ${negative ? "text-red-600" : "text-blue-700"}`} style={MONO}>{value}</p>
            </div>
          ))}
        </div>
      </CardShell>}

      <CardShell className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Bank Resilience Results</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">AI Model: XGBoost + SHAP Explanations</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
              <th className="text-left px-5 py-3">Bank</th>
              <th className="text-right px-5 py-3">Tier 1 (%)</th>
              <th className="text-right px-5 py-3">LCR (%)</th>
              <th className="text-right px-5 py-3">NSFR (%)</th>
              <th className="text-right px-5 py-3">P&amp;L Impact</th>
              <th className="text-right px-5 py-3">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {bankResults.map((bank) => (
              <tr key={bank.name} className="hover:bg-muted/10 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-blue-700" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{bank.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right text-sm text-foreground" style={MONO}>{bank.tier1}%</td>
                <td className="px-5 py-3.5 text-right text-sm text-foreground" style={MONO}>{bank.lcr}%</td>
                <td className="px-5 py-3.5 text-right text-sm text-foreground" style={MONO}>{bank.nsfr}%</td>
                <td className="px-5 py-3.5 text-right text-sm font-medium text-red-500" style={MONO}>{bank.impact}%</td>
                <td className="px-5 py-3.5 text-right">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${bank.status === "Pass" ? "bg-emerald-50 text-emerald-700" : bank.status === "Warn" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{bank.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardShell>
    </div>
  );
}
