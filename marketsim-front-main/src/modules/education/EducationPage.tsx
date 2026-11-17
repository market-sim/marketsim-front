import { useEffect, useState } from "react";
import { coursesApi, type Course } from "../../api/endpoints";
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
import { leaderboard } from "./mockData";

const levelLabel = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" } as const;
const levelIcon = { BEGINNER: TrendingUp, INTERMEDIATE: BarChart2, ADVANCED: Bot } as const;

export default function EducationPage() {
  // Module 4 : cours venant du backend (GET /api/education/courses)
  const [apiCourses, setApiCourses] = useState<Course[]>([]);
  useEffect(() => { coursesApi.list().then(setApiCourses).catch(() => setApiCourses([])); }, []);
  // TODO module 4 : la progression viendra d'une entite "Progression" (0 pour l'instant)
  const courses = apiCourses.map((c) => ({
    title: c.title,
    level: levelLabel[c.level],
    lessons: c.lessons ?? 0,
    progress: 0,
    duration: `${Math.floor((c.durationMinutes ?? 0) / 60)}h ${String((c.durationMinutes ?? 0) % 60).padStart(2, "0")}m`,
    Icon: levelIcon[c.level],
  }));
  return (
    <div className="space-y-5">
      {/* AI Rec Banner */}
      <div className="rounded-xl p-5 text-white" style={{ background: "linear-gradient(135deg, #1D4ED8, #0F2E7A)" }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1">AI Learning Recommendation</p>
            <p className="text-[13px] text-blue-100 leading-relaxed">Based on your Level 4 profile and 64.3% win rate, focus on <span className="font-semibold text-white">Risk Management</span> next. Optimizing position sizing could reduce your max drawdown by an estimated 15%.</p>
          </div>
          <button className="shrink-0 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1.5 text-xs font-medium">Start now →</button>
        </div>
      </div>

      {/* Courses */}
      <div>
        <SectionHeader title="My Courses" action={<button className="text-[11px] text-blue-600 font-medium hover:text-blue-800">View all</button>} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {courses.map(({ title, level, lessons, progress, duration, Icon }) => (
            <CardShell key={title} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                {progress === 100 && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                {progress === 0 && <span className="text-[10px] text-muted-foreground">Not started</span>}
              </div>
              <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${level === "Beginner" ? "bg-emerald-50 text-emerald-700" : level === "Intermediate" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{level}</span>
                <span className="text-[10px] text-muted-foreground">{lessons} lessons · {duration}</span>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{progress}% complete</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div className={`h-1.5 rounded-full transition-all ${progress === 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${progress}%` }} />
                </div>
              </div>
              {progress > 0 && progress < 100 && (
                <button className="mt-3 w-full flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-medium rounded-lg py-1.5 transition-colors">
                  <Play className="w-3 h-3" />Continue
                </button>
              )}
            </CardShell>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <CardShell className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Leaderboard</h3>
          </div>
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div key={entry.rank} className={`flex items-center gap-3 rounded-lg p-2.5 transition-colors ${entry.isMe ? "bg-blue-50 border border-blue-100" : "hover:bg-muted/20"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${entry.rank === 1 ? "bg-amber-400 text-white" : entry.rank === 2 ? "bg-slate-300 text-white" : entry.rank === 3 ? "bg-amber-600/80 text-white" : "bg-muted text-muted-foreground"}`}>{entry.rank}</span>
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">{entry.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${entry.isMe ? "text-blue-700" : "text-foreground"}`}>{entry.name}{entry.isMe ? " (You)" : ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-foreground" style={MONO}>{entry.score.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{entry.winRate} WR</p>
                </div>
              </div>
            ))}
          </div>
        </CardShell>

        {/* Daily Quiz */}
        <CardShell className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Daily Quiz</h3>
            <span className="text-[10px] bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded-full">+50 pts</span>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-1">Question 2 / 5</p>
            <p className="text-sm text-foreground leading-relaxed">An RSI reading of 72 at a key resistance level typically suggests what about the asset?</p>
          </div>
          <div className="space-y-2">
            {[
              "The asset is oversold and likely to reverse upward",
              "The asset is overbought and may face selling pressure",
              "The RSI indicates an immediate strong buy signal",
              "No actionable conclusion can be drawn from this reading",
            ].map((opt, i) => (
              <button key={i} className="w-full text-left text-[12px] text-foreground rounded-lg border border-border/60 px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                {String.fromCharCode(65 + i)}. {opt}
              </button>
            ))}
          </div>
        </CardShell>
      </div>
    </div>
  );
}
