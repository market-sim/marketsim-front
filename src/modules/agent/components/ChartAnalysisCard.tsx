import { AlertTriangle, ArrowDownRight, ArrowUpRight, Bot, Minus, ShieldCheck, Target, TrendingDown, TrendingUp } from "lucide-react";
import type { ChartAnalysis, ChartRisk } from "../../../api/endpoints";
import { MONO } from "../../../shared/ui";
import { maxLoss, profileLabel } from "../riskProfile";
import { eur } from "../schoolLogic";

const SIGNAL = {
  ACHAT: { label: "ACHAT", tone: "bg-emerald-500", Icon: ArrowUpRight },
  ATTENDRE: { label: "ATTENDRE", tone: "bg-amber-500", Icon: Minus },
  VENTE: { label: "VENTE", tone: "bg-red-500", Icon: ArrowDownRight },
} as const;

const TREND = {
  HAUSSIERE: { label: "Haussière", Icon: TrendingUp, tone: "text-emerald-600" },
  BAISSIERE: { label: "Baissière", Icon: TrendingDown, tone: "text-red-500" },
  LATERALE: { label: "Latérale", Icon: Minus, tone: "text-amber-600" },
  INDETERMINEE: { label: "Indéterminée", Icon: Minus, tone: "text-muted-foreground" },
} as const;

function Chips({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((x) => <span key={x} className={`text-[11px] px-2 py-0.5 rounded-full ${tone}`}>{x}</span>)}
      </div>
    </div>
  );
}

/** Fiche d'analyse technique d'une capture d'ecran (sortie structuree de Claude vision). */
export default function ChartAnalysisCard({ a, risk }: { a: ChartAnalysis; risk?: ChartRisk }) {
  if (!a.isChart) {
    return <p className="text-[13px]">{a.summary || "Cette image ne ressemble pas à un graphique de marché."}</p>;
  }
  const s = SIGNAL[a.signal];
  const t = TREND[a.trend];
  return (
    <div className="space-y-3 min-w-[260px]">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1 text-white text-sm font-bold px-3 py-1.5 rounded-lg ${s.tone}`}>
          <s.Icon className="w-4 h-4" />{s.label}
        </span>
        <div>
          <p className="text-[13px] font-semibold text-foreground">{a.asset || "Actif non identifié"}{a.timeframe ? ` · ${a.timeframe}` : ""}</p>
          <p className={`text-[11px] flex items-center gap-1 ${t.tone}`}><t.Icon className="w-3 h-3" />Tendance {t.label.toLowerCase()}</p>
        </div>
        <div className="ml-auto w-28">
          <div className="flex justify-between text-[10px] text-muted-foreground"><span>Confiance</span><span className="font-semibold text-foreground" style={MONO}>{a.confidence} %</span></div>
          <div className="h-1.5 bg-slate-100 rounded-full mt-0.5"><div className={`h-1.5 rounded-full ${s.tone}`} style={{ width: `${Math.max(0, Math.min(100, a.confidence))}%` }} /></div>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed">{a.summary}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Chips title="Supports" items={a.supports} tone="bg-emerald-50 text-emerald-700" />
        <Chips title="Résistances" items={a.resistances} tone="bg-red-50 text-red-700" />
        <Chips title="Figures" items={a.patterns} tone="bg-violet-50 text-violet-700" />
        <Chips title="Indicateurs" items={a.indicators} tone="bg-blue-50 text-blue-700" />
      </div>

      {(a.stopLoss || a.takeProfit) && (
        <div className="flex flex-wrap gap-3 text-[12px]" style={MONO}>
          {a.stopLoss && <span className="text-red-500">Stop {a.stopLoss}</span>}
          {a.takeProfit && <span className="text-emerald-600 inline-flex items-center gap-1"><Target className="w-3 h-3" />Objectif {a.takeProfit}</span>}
        </div>
      )}

      {a.reasons.length > 0 && (
        <ul className="text-[12px] space-y-0.5">
          {a.reasons.map((r) => <li key={r} className="pl-3 relative"><span className="absolute left-0">•</span>{r}</li>)}
        </ul>
      )}

      {a.risks.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5">
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Risques</p>
          <ul className="text-[11px] text-amber-800 space-y-0.5">{a.risks.map((r) => <li key={r}>• {r}</li>)}</ul>
        </div>
      )}

      {risk && (
        <div className="rounded-lg bg-violet-50 border border-violet-100 p-2.5">
          <p className="text-[10px] font-semibold text-violet-700 uppercase tracking-wide mb-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />Votre profil : {profileLabel(risk.riskProfile)}
          </p>
          <p className="text-[12px] text-violet-900">
            Risque maximum sur ce trade : <b style={MONO}>{eur(maxLoss(risk))}</b> ({String(risk.riskPercent).replace(".", ",")} % de {eur(risk.accountBalance)} virtuels).
          </p>
          {a.riskAdvice && <p className="text-[12px] text-violet-800 mt-1">{a.riskAdvice}</p>}
        </div>
      )}

      {a.agentView && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 flex gap-2">
          <Bot className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-[12px] text-blue-800">{a.agentView}</p>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">Lecture technique pédagogique sur simulateur, pas un conseil d'investissement pour de l'argent réel.</p>
    </div>
  );
}
