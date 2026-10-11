// Voix de l'assistant : synthese vocale et reconnaissance vocale du navigateur (Web Speech API, gratuit).

/** Texte nettoye pour la lecture a voix haute (pas de markdown, pas de liens). */
export function toSpeakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>|]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

function frenchVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "fr-FR" && /natural|neural|online|google/i.test(v.name)) ??
    voices.find((v) => v.lang === "fr-FR") ??
    voices.find((v) => v.lang.startsWith("fr"))
  );
}

/**
 * Lit un texte a voix haute, phrase par phrase (Chrome coupe les longues lectures).
 * @returns une fonction pour arreter la lecture
 */
export function speak(text: string, onStart?: () => void, onEnd?: () => void): () => void {
  if (!ttsSupported()) {
    onEnd?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const sentences = toSpeakable(text).match(/[^.!?…]+[.!?…]*/g) ?? [];
  const voice = frenchVoice();
  let cancelled = false;

  sentences.forEach((sentence, i) => {
    const u = new SpeechSynthesisUtterance(sentence.trim());
    u.lang = "fr-FR";
    if (voice) u.voice = voice;
    u.rate = 1.05;
    if (i === 0) u.onstart = () => onStart?.();
    if (i === sentences.length - 1) u.onend = () => { if (!cancelled) onEnd?.(); };
    synth.speak(u);
  });
  if (sentences.length === 0) onEnd?.();

  return () => {
    cancelled = true;
    synth.cancel();
    onEnd?.();
  };
}

// ----- Reconnaissance vocale (Chrome / Edge) -----

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

export function createRecognition(): RecognitionLike | null {
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "fr-FR";
  r.interimResults = true;
  r.continuous = false;
  return r;
}

export const sttSupported = () =>
  typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
