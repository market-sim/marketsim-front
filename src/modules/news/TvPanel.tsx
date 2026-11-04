import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Play, X } from "lucide-react";
import { newsApi, type FlashItem, type TvChannel } from "../../api/endpoints";
import { errorMessage } from "../../api/client";

const BLUE = "#0C80EF";
const CHANNEL_REFRESH_MS = 5 * 60 * 1000;
const HEADLINES_REFRESH_MS = 10 * 60 * 1000;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

/** Noms courts pour les pastilles (l'arabe garde son nom complet cote lecteur). */
const SHORT: Record<string, string> = { BLOOMBERG: "Bloomberg", YAHOO: "Yahoo Finance", ASHARQ: "الشرق بلومبرغ", ALARABIYA: "العربية Business" };

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
};

/**
 * Adresse du lecteur YouTube officiel (domaine sans cookies). L'identifiant vient du serveur mais on le revalide ici :
 * il est place tel quel dans l'adresse du cadre.
 */
export function embedUrl(c: TvChannel | undefined): string | null {
  if (!c) return null;
  // demarrage en sourdine : c'est le seul autoplay que les navigateurs acceptent toujours (sinon ecran noir)
  const common = `autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  if (c.videoId && VIDEO_ID.test(c.videoId)) return `https://www.youtube-nocookie.com/embed/${c.videoId}?${common}`;
  if (CHANNEL_ID.test(c.channelId)) return `https://www.youtube-nocookie.com/embed/live_stream?channel=${c.channelId}&${common}`;
  return null;
}

/** Bandeau defilant type chaine d'info : les titres du trading dans le monde, en boucle. */
function Ticker({ items }: { items: FlashItem[] }) {
  if (items.length === 0) return null;
  const text = items.map((i) => `${i.title}${i.source ? ` — ${i.source}` : ""}`).join("   ●   ");
  const seconds = Math.max(40, Math.round(text.length * 0.17));
  return (
    <div className="flex items-stretch h-7 overflow-hidden border-t border-white/10 bg-[#070D1F]">
      <span className="shrink-0 flex items-center bg-red-600 px-2 text-[10px] font-bold tracking-wider text-white">TRADING</span>
      <div className="relative flex-1 overflow-hidden flex items-center">
        <div className="mstick whitespace-nowrap text-[11px] text-slate-100" style={{ animationDuration: `${seconds}s` }}>
          <span>{text}</span><span className="px-6 text-red-400">●</span><span>{text}</span><span className="px-6 text-red-400">●</span>
        </div>
      </div>
      <style>{`
        .mstick { display: inline-block; animation: mstick-scroll linear infinite; will-change: transform; }
        .mstick:hover { animation-play-state: paused; }
        @keyframes mstick-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .mstick { animation: none; } }
      `}</style>
    </div>
  );
}

/** Zone video 16:9 : affiche d'abord une affiche (le lecteur YouTube ne se charge qu'au clic), puis le direct. */
function Screen({ channel, playing, onPlay, large }: { channel: TvChannel | undefined; playing: boolean; onPlay: () => void; large?: boolean }) {
  const src = embedUrl(channel);
  const frame = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState<boolean | null>(null);

  // Protocole postMessage du lecteur YouTube : on ecoute son etat (sourdine ou non) et on tente d'activer le son,
  // ce que Chrome autorise apres un clic de l'utilisateur sur la page. Si le son reste coupe, une indication l'explique.
  useEffect(() => {
    if (!playing) return;
    setMuted(null);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== "string") return;
      try {
        const d = JSON.parse(e.data);
        if (d.event === "infoDelivery" && typeof d.info?.muted === "boolean") setMuted(d.info.muted);
      } catch { /* message sans rapport */ }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playing, channel?.id]);

  const onLoad = () => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    const send = (msg: object) => w.postMessage(JSON.stringify(msg), "https://www.youtube-nocookie.com");
    send({ event: "listening", id: 1, channel: "widget" });
    setTimeout(() => send({ event: "command", func: "unMute", args: [] }), 1500);
  };

  return (
    <div className="relative w-full aspect-video bg-black">
      {playing && src && channel ? (
        <iframe ref={frame} onLoad={onLoad} key={channel.id} src={src} title={`${channel.name} en direct`} className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox" />
      ) : (
        <button onClick={onPlay} disabled={!src || channel?.live === false} aria-label="Lancer la télévision en direct"
          className="group absolute inset-0 flex flex-col items-center justify-center gap-2 text-center disabled:cursor-not-allowed"
          style={{ background: "radial-gradient(ellipse at 50% 35%, #0F2A5C 0%, #060D22 70%)" }}>
          <span className={`rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 group-disabled:opacity-40 ${large ? "w-16 h-16" : "w-11 h-11"}`}
            style={{ background: BLUE, boxShadow: "0 0 28px rgba(12,128,239,0.6)" }}>
            <Play className={`text-white ${large ? "w-7 h-7" : "w-5 h-5"}`} style={{ marginLeft: 2 }} />
          </span>
          <span className={`font-semibold text-white ${large ? "text-base" : "text-[12px]"}`} dir="auto">{channel ? channel.name : "Chaînes en direct"}</span>
          <span className={`text-slate-400 px-3 leading-snug ${large ? "text-[12px]" : "text-[10px]"}`}>
            {channel?.live === false ? "Cette chaîne n'émet pas en direct pour le moment." : "Info boursière en direct · le lecteur YouTube ne se charge qu'au clic"}
          </span>
        </button>
      )}
      {playing && muted === true && (
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-[10px] leading-tight text-white">
          🔇 Son coupé : clique sur le haut-parleur de la vidéo
        </span>
      )}
    </div>
  );
}

function Channels({ channels, selected, onSelect }: { channels: TvChannel[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
      {channels.map((c) => (
        <button key={c.id} onClick={() => onSelect(c.id)} title={`${c.name}${c.live ? " · en direct" : " · hors antenne"}`} dir="auto"
          className={`shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium border transition-colors ${selected === c.id ? "text-white border-transparent" : "border-white/10 text-slate-300 hover:bg-white/10"} ${c.live ? "" : "opacity-50"}`}
          style={selected === c.id ? { background: BLUE } : undefined}>
          <span className={`w-1.5 h-1.5 rounded-full ${c.live ? "bg-red-500 animate-pulse" : "bg-slate-500"}`} />
          {SHORT[c.id] ?? c.name}
          <span className="text-[8.5px] opacity-70">{c.language}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Mode « television » : chaines d'information boursiere en direct (Bloomberg, Yahoo Finance, Asharq Bloomberg, Al-Arabiya Business)
 * dans le lecteur YouTube officiel, avec le bandeau defilant des titres du trading dans le monde, comme sur une chaine d'info.
 * Bouton « Agrandir » = mode cinema.
 */
export default function TvPanel() {
  const [channels, setChannels] = useState<TvChannel[]>([]);
  const [headlines, setHeadlines] = useState<FlashItem[]>([]);
  const [selected, setSelected] = useState(() => store.get("marketsim:news:tv", "BLOOMBERG"));
  const [playing, setPlaying] = useState(false);
  const [cinema, setCinema] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadChannels = useCallback(async () => {
    try {
      setChannels(await newsApi.tv());
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
    const timer = setInterval(loadChannels, CHANNEL_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadChannels]);

  useEffect(() => {
    const load = () => newsApi.flash("WORLD", 10).then((f) => setHeadlines(f.items)).catch(() => { /* le bandeau reste vide */ });
    load();
    const timer = setInterval(load, HEADLINES_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { store.set("marketsim:news:tv", selected); }, [selected]);

  // Echap ferme le mode cinema
  useEffect(() => {
    if (!cinema) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCinema(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cinema]);

  const channel = channels.find((c) => c.id === selected) ?? channels.find((c) => c.live) ?? channels[0];
  const select = (id: string) => { setSelected(id); setPlaying(true); };

  if (loading && channels.length === 0) {
    return <div className="aspect-video flex items-center justify-center text-[12px] text-slate-400 animate-pulse">Recherche des chaînes en direct…</div>;
  }
  if (error && channels.length === 0) {
    return (
      <div className="aspect-video flex flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-[12px] text-amber-300">Télévision indisponible pour le moment.</p>
        <p className="text-[10px] text-slate-500">{error}</p>
        <button onClick={() => { setLoading(true); loadChannels(); }} className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10">Réessayer</button>
      </div>
    );
  }

  return (
    <>
      {cinema ? (
        <button onClick={() => setCinema(false)} className="aspect-video w-full flex flex-col items-center justify-center gap-1 text-[11px] text-slate-400 hover:bg-white/5"
          style={{ background: "#060D22" }}>
          <Maximize2 className="w-5 h-5 text-slate-500" />Lecture en mode cinéma (cliquer pour revenir)
        </button>
      ) : (
        <Screen channel={channel} playing={playing} onPlay={() => setPlaying(true)} />
      )}
      <Ticker items={headlines} />
      <Channels channels={channels} selected={channel?.id ?? selected} onSelect={select} />
      <div className="flex items-center gap-2 px-3 pb-2">
        <button onClick={() => { setPlaying(true); setCinema(true); }} disabled={!channel || channel.live === false}
          className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10 disabled:opacity-40">
          <Maximize2 className="w-3 h-3" />Agrandir
        </button>
        {channel && (
          <a href={channel.watchUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10.5px] text-slate-400 hover:text-sky-300">
            <ExternalLink className="w-3 h-3" />Ouvrir sur YouTube
          </a>
        )}
      </div>
      <p className="px-3 pb-2.5 text-[9.5px] leading-snug text-slate-500">
        Diffusions en direct des chaînes via le lecteur YouTube officiel (sons et images de leurs éditeurs). Chaînes d'info boursière en anglais et en arabe :
        aucune chaîne boursière française n'émet en direct sur YouTube en ce moment. Ce n'est pas un conseil d'investissement.
      </p>

      {/* Mode cinema */}
      {cinema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Télévision en direct" onClick={() => setCinema(false)}>
          <div className="w-[min(960px,100%)] rounded-xl overflow-hidden border border-white/10 shadow-2xl" style={{ background: "#050B1A" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span>
              <span className="text-[10px] font-bold tracking-widest text-red-400">LIVE</span>
              <span className="text-[12px] font-semibold text-white truncate" dir="auto">{channel?.name}</span>
              <button onClick={() => setCinema(false)} aria-label="Fermer" className="ml-auto p-1.5 rounded-md text-slate-300 hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <Screen channel={channel} playing={playing} onPlay={() => setPlaying(true)} large />
            <Ticker items={headlines} />
            <Channels channels={channels} selected={channel?.id ?? selected} onSelect={select} />
          </div>
        </div>
      )}
    </>
  );
}
