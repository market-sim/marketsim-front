import { useState } from "react";
import { Headphones, Tv } from "lucide-react";
import FlashAudio from "./FlashAudio";
import TvPanel from "./TvPanel";

type Mode = "TV" | "AUDIO";

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
};

/**
 * Petit ecran « Trading TV » de la page de l'agent : par defaut la television (chaines d'info boursiere en direct avec
 * bandeau defilant), ou le « flash audio » (titres lus a voix haute).
 */
export default function NewsScreen() {
  const [mode, setMode] = useState<Mode>(() => (store.get("marketsim:news:mode", "TV") === "AUDIO" ? "AUDIO" : "TV"));
  const choose = (m: Mode) => { setMode(m); store.set("marketsim:news:mode", m); };

  const tab = (m: Mode, label: string, Icon: typeof Tv) => (
    <button onClick={() => choose(m)} aria-pressed={mode === m}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors ${mode === m ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/10"}`}>
      <Icon className="w-3 h-3" />{label}
    </button>
  );

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 text-slate-200" style={{ background: "#050B1A", boxShadow: "0 0 0 1px rgba(12,128,239,0.15)" }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span>
        <span className="text-[10px] font-bold tracking-widest text-red-400">LIVE</span>
        <span className="text-[11px] font-semibold text-white truncate">Trading TV</span>
        <div className="ml-auto flex items-center gap-0.5">
          {tab("TV", "Vidéo", Tv)}
          {tab("AUDIO", "Audio", Headphones)}
        </div>
      </div>
      {mode === "TV" ? <TvPanel /> : <FlashAudio />}
    </div>
  );
}
