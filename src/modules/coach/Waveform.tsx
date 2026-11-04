import { useEffect, useRef, type MutableRefObject } from "react";

export type WaveMode = "idle" | "speaking" | "listening";

const BARS = 27;

/**
 * Forme d'onde blanche dessinee dans le rectangle bleu du coach.
 *
 * Honnetete : la synthese vocale du navigateur ne donne pas acces a l'audio, on ne peut donc pas faire une vraie
 * analyse de frequences. L'animation est une enveloppe de parole (rythme syllabique + respirations) qui s'active
 * pendant que le coach parle, avec des pics supplementaires a chaque mot quand la voix emet ses evenements de frontiere.
 *
 * @param energyRef incrementee a 1 par le parent a chaque mot prononce ; decroit toute seule
 */
export default function Waveform({ mode, energyRef }: { mode: WaveMode; energyRef: MutableRefObject<number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const levels = new Float32Array(BARS);
    const seeds = Array.from({ length: BARS }, (_, i) => ({ f1: 2.1 + ((i * 0.37) % 2.3), f2: 5 + ((i * 0.91) % 4), ph: i * 1.7 }));
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const frame = (now: number) => {
      const t = now / 1000;
      const m = modeRef.current;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      energyRef.current *= 0.9;
      const syllable = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 4.3 + Math.sin(t * 1.3) * 2);
      const breath = 0.55 + 0.45 * Math.sin(t * 2 * Math.PI * 0.55 + 1);
      const level = m === "speaking"
        ? Math.min(1, 0.32 + 0.5 * syllable * breath + 0.45 * energyRef.current)
        : m === "listening" ? 0.2 + 0.1 * Math.sin(t * 2.4)
        : 0.05;

      const gap = w / BARS;
      const barW = Math.max(2, gap * 0.52);
      for (let i = 0; i < BARS; i++) {
        const centre = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        const shape = 0.3 + 0.7 * Math.pow(centre, 0.8);
        const s = seeds[i];
        const noise = 0.5 + 0.5 * Math.sin(t * s.f1 * 2 + s.ph) * (0.6 + 0.4 * Math.sin(t * s.f2 + s.ph * 0.5));
        const target = reduceMotion ? level * shape * 0.6 : level * shape * (0.3 + 0.7 * noise);
        levels[i] += (target - levels[i]) * 0.35;
        const bh = Math.max(2, levels[i] * h * 0.94);
        const x = gap * i + (gap - barW) / 2;
        ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.min(1, levels[i] * 1.6)})`;
        if (m === "speaking") {
          ctx.shadowColor = "rgba(255,255,255,0.55)";
          ctx.shadowBlur = 6;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.roundRect(x, (h - bh) / 2, barW, bh, barW / 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [energyRef]);

  return <canvas ref={canvasRef} className="w-full h-full block" aria-hidden="true" />;
}
