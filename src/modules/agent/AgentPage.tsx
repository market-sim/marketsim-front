import { useEffect, useState } from "react";
import { Bot, Brain, Dices, Gamepad2, GraduationCap, Pencil, Plus, Sparkles, Trash2, Trophy } from "lucide-react";
import { agentsApi, assetsApi, type AgentConfig, type Asset } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY } from "../../shared/ui";
import AgentFormModal from "./components/AgentFormModal";
import AssistantPanel from "./components/AssistantPanel";
import DecisionsPanel from "./components/DecisionsPanel";
import MonteCarloPanel from "./components/MonteCarloPanel";
import ReplayPanel from "./components/ReplayPanel";
import TournamentPanel from "./components/TournamentPanel";
import TrainingPanel from "./components/TrainingPanel";
import { personalities, personalityOf, strategyLabel, strategyShort } from "./format";

type Tab = "assistant" | "decisions" | "montecarlo" | "training" | "tournament" | "replay";

const TABS: { id: Tab; label: string; Icon: typeof Brain }[] = [
  { id: "assistant", label: "Assistant IA", Icon: Sparkles },
  { id: "decisions", label: "Décisions & XAI", Icon: Brain },
  { id: "montecarlo", label: "Monte Carlo", Icon: Dices },
  { id: "training", label: "Entraînement RL", Icon: GraduationCap },
  { id: "tournament", label: "Tournoi", Icon: Trophy },
  { id: "replay", label: "Replay vs Agent", Icon: Gamepad2 },
];

/** Module 6 : Agent de Trading Intelligent. */
export default function AgentPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("decisions");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const load = async (selectId?: number) => {
    try {
      const list = await agentsApi.list();
      setAgents(list);
      setSelectedId((cur) => selectId ?? (list.some((a) => a.id === cur) ? cur : list[0]?.id ?? null));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
    assetsApi.list().then(setAssets).catch(() => setAssets([]));
  }, []);

  const agent = agents.find((a) => a.id === selectedId) ?? null;

  const save = async (data: AgentConfig) => {
    const saved = modal === "edit" && agent ? await agentsApi.update(agent.id!, data) : await agentsApi.create(data);
    setModal(null);
    await load(saved.id);
  };

  const toggle = async () => {
    if (!agent) return;
    await agentsApi.toggle(agent.id!);
    load();
  };

  const remove = async () => {
    if (!agent || !confirm(`Supprimer l'agent « ${agent.name} » et tout son historique ?`)) return;
    await agentsApi.remove(agent.id!);
    load();
  };

  const modalEl = modal && (
    <AgentFormModal initial={modal === "edit" ? agent ?? undefined : undefined} assets={assets} onSave={save} onClose={() => setModal(null)} />
  );

  if (loaded && agents.length === 0) {
    return (
      <>
        <CardShell className="p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-base font-semibold text-foreground" style={DISPLAY}>Aucun agent de trading</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Créez un agent IA : il analyse le marché, explique chacune de ses décisions (XAI), se teste sur des milliers
            de scénarios Monte Carlo et peut apprendre par renforcement.
          </p>
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
          <button onClick={() => setModal("create")} className="mt-5 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2">
            <Plus className="w-4 h-4" />Créer mon premier agent
          </button>
        </CardShell>
        {modalEl}
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* Selection de l'agent */}
      <div className="flex flex-wrap items-center gap-2">
        {agents.map((a) => (
          <button key={a.id} onClick={() => setSelectedId(a.id!)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border transition-colors ${a.id === selectedId ? "bg-white border-blue-500 shadow-sm" : "bg-white/60 border-border/60 hover:border-blue-200"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${a.active ? "bg-emerald-500" : "bg-slate-300"}`} />
            <span className="font-medium text-foreground">{a.name}</span>
            <span className="text-[10px] text-muted-foreground">{strategyShort[a.strategy]}</span>
          </button>
        ))}
        <button onClick={() => setModal("create")} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50">
          <Plus className="w-4 h-4" />Nouvel agent
        </button>
      </div>

      {agent && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
          {/* Fiche de l'agent */}
          <CardShell className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate" style={DISPLAY}>{agent.name}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${agent.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                  <span className="text-[11px] text-muted-foreground">{agent.active ? "Actif · exécute ses ordres" : "En pause · simulation"}</span>
                </div>
              </div>
            </div>

            <div>
              {[
                { label: "Personnalité", value: `${personalities[personalityOf(agent.riskLevel)].emoji} ${personalities[personalityOf(agent.riskLevel)].label}` },
                { label: "Stratégie", value: strategyLabel[agent.strategy] },
                { label: "Actifs", value: agent.allowedAssets.split(",").join(", ") },
                { label: "Capital / position", value: `$${Number(agent.maxPositionSize).toLocaleString("en-US")}` },
                ...(agent.strategy === "Q_LEARNING"
                  ? [{ label: "Apprentissage", value: agent.trained ? `${agent.trainedEpisodes} épisodes (${agent.trainedOn})` : "Non entraîné" }]
                  : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between py-2 border-b border-border/40 text-[12px]">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="font-medium text-foreground text-right ml-3">{value}</span>
                </div>
              ))}
              <div className="py-2.5">
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-muted-foreground">Appétit pour le risque</span>
                  <span className="font-medium text-foreground">{agent.riskLevel} / 100</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div className={`h-1.5 rounded-full ${agent.riskLevel > 66 ? "bg-red-500" : agent.riskLevel > 33 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${agent.riskLevel}%` }} />
                </div>
              </div>
            </div>

            <button onClick={toggle} className={`w-full mt-3 py-2 rounded-lg text-sm font-semibold transition-colors ${agent.active ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
              {agent.active ? "Mettre en pause" : "Activer l'agent"}
            </button>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setModal("edit")} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium border border-border text-muted-foreground hover:bg-muted/40">
                <Pencil className="w-3 h-3" />Modifier
              </button>
              <button onClick={remove} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium border border-border text-red-500 hover:bg-red-50">
                <Trash2 className="w-3 h-3" />Supprimer
              </button>
            </div>
          </CardShell>

          {/* Laboratoire IA */}
          <div className="xl:col-span-3 space-y-4">
            <div className="flex flex-wrap gap-1 bg-white rounded-xl border border-border/60 p-1 w-fit">
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${tab === id ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted/50"}`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
            {tab === "assistant" && <AssistantPanel />}
            {tab === "decisions" && <DecisionsPanel agent={agent} />}
            {tab === "montecarlo" && <MonteCarloPanel agent={agent} />}
            {tab === "training" && <TrainingPanel agent={agent} onTrained={() => load()} />}
            {tab === "tournament" && <TournamentPanel agents={agents} assets={assets} />}
            {tab === "replay" && <ReplayPanel agent={agent} />}
          </div>
        </div>
      )}
      {modalEl}
    </div>
  );
}
