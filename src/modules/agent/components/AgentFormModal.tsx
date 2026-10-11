import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { AgentConfig, AgentStrategy, Asset } from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { DISPLAY } from "../../../shared/ui";
import { inputClass, labelClass, strategyLabel } from "../format";

interface Props {
  initial?: AgentConfig;
  assets: Asset[];
  onSave: (agent: AgentConfig) => Promise<void>;
  onClose: () => void;
}

const EMPTY: AgentConfig = {
  name: "",
  strategy: "MOMENTUM",
  riskLevel: 50,
  allowedAssets: "AAPL",
  maxPositionSize: 10000,
};

/** Creation / modification d'un agent (CRUD module 6). */
export default function AgentFormModal({ initial, assets, onSave, onClose }: Props) {
  const [form, setForm] = useState<AgentConfig>(initial ?? EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = form.allowedAssets.split(",").map((s) => s.trim()).filter(Boolean);

  const toggleAsset = (symbol: string) => {
    const next = selected.includes(symbol) ? selected.filter((s) => s !== symbol) : [...selected, symbol];
    setForm({ ...form, allowedAssets: next.join(",") });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) {
      setError("Choisissez au moins un actif");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground" style={DISPLAY}>{initial ? "Modifier l'agent" : "Nouvel agent IA"}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <label className={labelClass}>Nom</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Agent Alpha-7" />
        </div>

        <div>
          <label className={labelClass}>Stratégie (cerveau)</label>
          <select value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value as AgentStrategy })} className={inputClass}>
            {(Object.keys(strategyLabel) as AgentStrategy[]).map((s) => <option key={s} value={s}>{strategyLabel[s]}</option>)}
          </select>
          {form.strategy === "Q_LEARNING" && (
            <p className="text-[11px] text-violet-600 mt-1">L'agent devra être entraîné (onglet « Entraînement RL ») avant de décider.</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass}>Appétit pour le risque</label>
            <span className="text-xs font-semibold text-foreground">{form.riskLevel} / 100</span>
          </div>
          <input type="range" min={0} max={100} value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: Number(e.target.value) })} className="w-full accent-blue-600" />
          <div className="flex justify-between text-[10px] text-muted-foreground"><span>Prudent</span><span>Agressif</span></div>
        </div>

        <div>
          <label className={labelClass}>Actifs autorisés</label>
          <div className="flex flex-wrap gap-2">
            {assets.map((a) => (
              <button type="button" key={a.symbol} onClick={() => toggleAsset(a.symbol)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${selected.includes(a.symbol) ? "bg-blue-600 border-blue-600 text-white" : "border-border text-muted-foreground hover:border-blue-300"}`}>
                {a.symbol}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Capital max par position ($)</label>
          <input type="number" min={100} step={100} value={form.maxPositionSize} onChange={(e) => setForm({ ...form, maxPositionSize: Number(e.target.value) })} className={inputClass} />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted/40">Annuler</button>
          <button disabled={busy} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
            {busy ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
