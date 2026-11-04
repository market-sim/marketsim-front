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
import { blockchainTx, certificates } from "./mockData";

export default function BlockchainPage() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Block Height",       value: "18,842,310", sub: "Hyperledger Fabric"  },
          { label: "Transactions (24h)", value: "1,284",       sub: "Network activity"   },
          { label: "Smart Contracts",    value: "47",           sub: "Active contracts"   },
          { label: "NFT Certificates",   value: "3",            sub: "Issued to you"      },
        ].map(({ label, value, sub }) => (
          <CardShell key={label} className="p-5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
            <p className="text-xl font-semibold text-foreground" style={MONO}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
          </CardShell>
        ))}
      </div>

      <CardShell className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
          <LinkIcon className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>On-Chain Transaction Log</h3>
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <RefreshCw className="w-3 h-3" /><span>Hyperledger Fabric</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
                <th className="text-left px-5 py-3">Tx Hash</th>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">Asset / Data</th>
                <th className="text-left px-5 py-3">User</th>
                <th className="text-right px-5 py-3">Block</th>
                <th className="text-right px-5 py-3">Time</th>
                <th className="text-right px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {blockchainTx.map((tx, i) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer" style={MONO}>{tx.hash}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${tx.type === "Trade" ? "bg-blue-50 text-blue-700" : tx.type === "Backtest" ? "bg-violet-50 text-violet-700" : tx.type === "Certificate" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600"}`}>{tx.type}</span>
                  </td>
                  <td className="px-5 py-3.5 text-[12px] text-foreground">{tx.asset}</td>
                  <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{tx.user}</td>
                  <td className="px-5 py-3.5 text-right text-[11px] text-muted-foreground" style={MONO}>{tx.block.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right text-[11px] text-muted-foreground">{tx.time}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                      <CheckCircle className="w-3 h-3" />{tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardShell>

      <div>
        <SectionHeader title="My NFT Certificates" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {certificates.map((cert) => (
            <CardShell key={cert.tokenId} className="p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #1D4ED8, #7C3AED)" }}>
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{cert.title}</p>
                  <p className="text-[10px] text-muted-foreground">{cert.date}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border/40">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cert.type === "Completion" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{cert.type}</span>
                <span className="text-[11px] text-muted-foreground" style={MONO}>{cert.tokenId}</span>
              </div>
            </CardShell>
          ))}
        </div>
      </div>
    </div>
  );
}
