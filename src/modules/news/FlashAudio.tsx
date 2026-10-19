import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RefreshCw } from "lucide-react";
import { newsApi, type FlashItem, type NewsFlash, type NewsTopic } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { speak, ttsSupported } from "../agent/speech";
import Waveform from "../coach/Waveform";

const BLUE = "#0C80EF";
const TOPICS: { id: NewsTopic; label: string }[] = [
  { id: "WORLD", label: "Monde" },
  { id: "STOCKS", label: "Actions" },
  { id: "CRYPTO", label: "Crypto" },
  { id: "FOREX", label: "Devises" },
  { id: "COMMODITIES", label: "Matières" },
  { id: "RATES", label: "Taux" },
];
const SENTIMENT = {
  POSITIVE: { text: "▲ Haussier", cls: "bg-emerald-500/15 text-emerald-300" },
  NEGATIVE: { text: "▼ Baissier", cls: "bg-red-500/15 text-red-300" },
  NEUTRAL: { text: "● Neutre", cls: "bg-slate-500/20 text-slate-300" },
} as const;
const ROTATE_MS = 9000;
const REFRESH_MS = 10 * 60 * 1000;

const ago = (minutes: number | null) =>
  minutes == null ? "" : minutes < 1 ? "à l'instant" : minutes < 60 ? `il y a ${minutes} min` : minutes < 1440 ? `il y a ${Math.floor(minutes / 60)} h` : `il y a ${Math.floor(minutes / 1440)} j`;

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
};

/**
 * Mode « flash audio » : les titres du trading dans le monde defilent, et un bouton les lit a voix haute
 * un par un (voix du navigateur). La forme d'onde blanche s'anime pendant la lecture.
 */
export default function FlashAudio() {
  const [topic, setTopic] = useState<NewsTopic>(() => (TOPICS.some((t) => t.id === store.get("marketsim:news:topic", "")) ? (store.get("marketsim:news:topic", "") as NewsTopic) : "WORLD"));
  const [flash, setFlash] = useState<NewsFlash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [reading, setReading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const energyRef = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  const readingRef = useRef(false);
  const itemsRef = useRef<FlashItem[]>([]);
  const labelRef = useRef("Monde");

  const items = flash?.items ?? [];
  itemsRef.current = items;
  labelRef.current = flash?.label ?? "Monde";
  const current = items[Math.min(index, Math.max(0, items.length - 1))];

  const endReading = useCallback(() => {
    readingRef.current = false;
    setReading(false);
    setSpeaking(false);
  }, []);

  const stopReading = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    endReading();
  }, [endReading]);

  const load = useCallback(async (t: NewsTopic, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const f = await newsApi.flash(t, 8);
      setFlash(f);
      setError("");
      setIndex(0);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    stopReading();
    load(topic);
    store.set("marketsim:news:topic", topic);
    const timer = setInterval(() => load(topic, true), REFRESH_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  useEffect(() => () => { stopRef.current?.(); }, []);

  // defilement automatique des titres (jamais pendant la lecture vocale)
  useEffect(() => {
    if (reading || items.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [reading, items.length, index]);

  /** Lit les titres a partir de i, l'un apres l'autre ; s'arrete si une autre voix prend la parole. */
  const readFrom = useCallback((i: number) => {
    const list = itemsRef.current;
    if (i >= list.length) {
      endReading();
      return;
    }
    readingRef.current = true;
    setReading(true);
    setIndex(i);
    const it = list[i];
    const intro = i === 0 ? `Flash trading ${labelRef.current.toLowerCase()}. À la une : ` : "Ensuite : ";
    const text = `${intro}${it.title}.${it.source ? ` Source : ${it.source}.` : ""}`;
    stopRef.current = speak(text, () => setSpeaking(true), (cancelled) => {
      setSpeaking(false);
      if (cancelled || !readingRef.current) {
        if (cancelled) endReading();
        return;
      }
      readFrom(i + 1);
    }, () => { energyRef.current = 1; });
  }, [endReading]);

  const toggleRead = () => {
    if (reading) stopReading();
    else readFrom(index);
  };

  const go = (delta: number) => {
    if (items.length === 0) return;
    const next = (index + delta + items.length) % items.length;
    if (reading) {
      stopReading();
      readFrom(next);
    } else {
      setIndex(next);
    }
  };

  const sentiment = current ? SENTIMENT[current.sentiment] : null;

  return (
    <>
      {/* Sous-en-tete : theme courant + actualisation */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10">
        <span className="text-[11px] font-semibold text-white truncate">Flash audio · {flash?.label ?? "Monde"}</span>
        <button onClick={() => { stopReading(); load(topic); }} disabled={loading} aria-label="Actualiser les actualités" title="Actualiser"
          className="ml-auto p-1 rounded-md text-slate-400 hover:bg-white/10 disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {/* Ecran */}
      <div className="px-3.5 py-3 min-h-[148px] flex flex-col" style={{ background: "linear-gradient(160deg,#0A1736 0%,#050B1A 70%)" }}>
        {loading && !current ? (
          <p className="m-auto text-[12px] text-slate-400 animate-pulse">Chargement du flash…</p>
        ) : error && !current ? (
          <div className="m-auto text-center">
            <p className="text-[12px] text-amber-300">Actualités indisponibles pour le moment.</p>
            <p className="text-[10px] text-slate-500 mt-1">{error}</p>
          </div>
        ) : !current ? (
          <p className="m-auto text-[12px] text-slate-400">Aucun titre pour ce thème.</p>
        ) : (
          <div key={`${topic}-${index}`} className="flex flex-col flex-1 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {sentiment && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sentiment.cls}`} title="Ton du titre repéré par mots-clés : indicatif">{sentiment.text}</span>}
              <span className="text-[10.5px] text-slate-400 truncate">{current.source}{current.minutesAgo != null ? ` · ${ago(current.minutesAgo)}` : ""}</span>
            </div>
            <a href={current.url} target="_blank" rel="noopener noreferrer" title="Lire l'article"
              className="text-[13.5px] font-semibold leading-snug text-white hover:text-sky-300 line-clamp-5">{current.title}</a>
            <div className="mt-auto pt-3 flex items-center gap-1">
              {items.map((_, i) => (
                <button key={i} onClick={() => go(i - index)} aria-label={`Titre ${i + 1}`}
                  className="h-1 rounded-full transition-all" style={{ width: i === index ? 18 : 6, background: i === index ? BLUE : "rgba(255,255,255,0.18)" }} />
              ))}
              <span className="ml-auto text-[10px] text-slate-500">{Math.min(index, items.length - 1) + 1}/{items.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Forme d'onde : s'anime pendant la lecture */}
      <div className="mx-3 mt-2 h-8 rounded-lg px-3 py-1 overflow-hidden"
        style={{ background: BLUE, boxShadow: speaking ? "0 0 18px rgba(12,128,239,0.7)" : "0 0 8px rgba(12,128,239,0.3)" }}>
        <Waveform mode={speaking ? "speaking" : "idle"} energyRef={energyRef} />
      </div>

      {/* Commandes */}
      <div className="flex items-center justify-center gap-2 px-3 py-2.5">
        <button onClick={() => go(-1)} disabled={items.length < 2} aria-label="Titre précédent" className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
        {ttsSupported() ? (
          <button onClick={toggleRead} disabled={items.length === 0} aria-label={reading ? "Arrêter la lecture" : "Écouter le flash"}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white whitespace-nowrap disabled:opacity-50" style={{ background: BLUE }}>
            {reading ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}{reading ? "Arrêter" : "Écouter le flash"}
          </button>
        ) : (
          <span className="text-[10.5px] text-amber-300">Voix non disponible dans ce navigateur</span>
        )}
        <button onClick={() => go(1)} disabled={items.length < 2} aria-label="Titre suivant" className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
      </div>

      {/* Themes */}
      <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5">
        {TOPICS.map((t) => (
          <button key={t.id} onClick={() => setTopic(t.id)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-medium border transition-colors ${topic === t.id ? "text-white border-transparent" : "border-white/10 text-slate-300 hover:bg-white/10"}`}
            style={topic === t.id ? { background: BLUE } : undefined}>{t.label}</button>
        ))}
      </div>

      <p className="px-3 pb-2.5 text-[9.5px] leading-snug text-slate-500">
        Google Actualités{flash ? ` · actualisé à ${new Date(flash.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}.
        Titres lus tels quels, sans vérification : ce n'est pas un conseil d'investissement.
      </p>
    </>
  );
}
