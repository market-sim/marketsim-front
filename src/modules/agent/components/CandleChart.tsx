import { useEffect, useRef } from "react";
import type { AgentAction, ReplayResult } from "../../../api/endpoints";

export interface HumanTrade {
  day: number;
  side: "BUY" | "SELL";
  price: number;
  /** part des liquidites engagee a l'achat (defaut : tout) */
  fraction?: number;
}

interface Props {
  replay: ReplayResult;
  /** jour courant du replay (les bougies s'arretent ici) */
  t: number;
  trades: HumanTrade[];
  agentName: string;
  playing: boolean;
  /** jours par seconde : sert a faire « grandir » la bougie du jour pendant son tour */
  speed: number;
  /** nombre de bougies visibles */
  visible: number;
  height?: number;
  /** position du JOUEUR (mode debutant) : prix d'entree moyen ; le stop suggere reprend la regle de l'agent */
  mine?: { entry: number } | null;
}

interface Bar { day: number; o: number; h: number; l: number; c: number }

// Palette type plateforme de trading : fond bleu nuit, bougies vertes / rouges, marqueurs IA en bleu ciel et violet.
const COLORS = {
  bg1: "#0D1838", bg2: "#081026", grid: "rgba(148,163,184,0.10)", axis: "#7C8BA8", text: "#E2E8F0",
  up: "#34C27C", down: "#EF5B43", sky: "#38BDF8", violet: "#A78BFA", amber: "#FBBF24", stop: "#F87171", tp: "#4ADE80",
};
const ACTION_COLOR: Record<AgentAction, string> = { BUY: COLORS.up, HOLD: "#94A3B8", SELL: COLORS.down };
const EVENT_LABEL: Record<number, string> = { 1: "IA ACHÈTE", 2: "IA VEND", 3: "STOP-LOSS", 4: "TAKE-PROFIT" };
const MONO = "10px 'JetBrains Mono', ui-monospace, monospace";

const R_AXIS = 70;     // marge droite : axe des prix
const T_HEAD = 34;     // bandeau du haut : prix OHLC + pensee de l'IA
const B_AXIS = 46;     // marge basse : axe du temps + ligne des signaux de l'IA

const fmtPx = (v: number) => (v < 10 ? v.toFixed(4) : v < 1000 ? v.toFixed(2) : v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }));

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}

/** Pastille arrondie avec texte (etiquettes de prix et bulles de l'IA). */
function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, fg = "#fff", align: "left" | "right" | "center" = "left") {
  ctx.font = `600 ${MONO}`;
  const w = ctx.measureText(text).width + 12;
  const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(left, y - 9, w, 18, 5);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, left + 6, y + 0.5);
  return { left, width: w };
}

function triangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, up: boolean, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (up) { ctx.moveTo(x, y - size); ctx.lineTo(x - size, y + size * 0.7); ctx.lineTo(x + size, y + size * 0.7); }
  else { ctx.moveTo(x, y + size); ctx.lineTo(x - size, y - size * 0.7); ctx.lineTo(x + size, y - size * 0.7); }
  ctx.closePath();
  ctx.fill();
}

/**
 * Graphique en bougies du replay : il se dessine en direct (la bougie du jour grandit pendant son tour), defile avec le
 * temps, et l'IA y montre ce qu'elle pense et ce qu'elle fait : signal du jour, achats / ventes / stop-loss / take-profit,
 * ligne d'entree avec stop et objectif tant qu'elle est investie.
 */
export default function CandleChart(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const tickAt = useRef(performance.now());
  const scale = useRef<{ min: number; max: number } | null>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(true);

  useEffect(() => {
    tickAt.current = performance.now();
    dirty.current = true;
  }, [props.t, props.visible, props.trades, props.replay, props.playing, props.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const observer = new ResizeObserver(() => { dirty.current = true; });
    observer.observe(canvas);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const { replay, t, trades, agentName, playing, speed, visible } = propsRef.current;
      const live = playing && t < replay.horizonDays;
      if (!live && !dirty.current && !mouse.current) return;     // rien ne bouge : on ne redessine pas

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ---- fond ----
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, COLORS.bg1);
      bg.addColorStop(1, COLORS.bg2);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const L = 10;
      const plotW = W - L - R_AXIS;
      const plotH = H - T_HEAD - B_AXIS;
      const ctxLen = replay.contextCandles.length;
      const firstShown = t - visible + 1;
      const slots = visible + 3;                  // 3 cases vides a droite : la bougie du jour ne colle pas a l'axe
      const slotW = plotW / slots;
      const xOf = (i: number) => L + (i - firstShown + 0.5) * slotW;

      // ---- bougies : historique + jours rejoues ; celle du jour grandit pendant son tour ----
      const p = live ? Math.min(1, (now - tickAt.current) / (1000 / speed)) : 1;
      const grow = 1 - Math.pow(1 - p, 2);
      const bars: Bar[] = [];
      for (let i = Math.max(-ctxLen, firstShown); i <= t; i++) {
        if (i < 0) {
          const c = replay.contextCandles[ctxLen + i];
          bars.push({ day: i, o: c.open, h: c.high, l: c.low, c: c.close });
        } else {
          const d = replay.days[i];
          if (i === t && grow < 1) {
            const reach = Math.min(1, grow * 1.4);
            const c = d.open + (d.price - d.open) * grow;
            bars.push({ day: i, o: d.open, c, h: Math.max(d.open, c, d.open + (d.high - d.open) * reach), l: Math.min(d.open, c, d.open - (d.open - d.low) * reach) });
          } else {
            bars.push({ day: i, o: d.open, h: d.high, l: d.low, c: d.price });
          }
        }
      }
      const today = t >= 0 ? replay.days[t] : null;
      const live1 = bars[bars.length - 1];

      // ---- position ouverte de l'agent : prix d'entree, stop-loss, objectif ----
      let entry: { day: number; price: number } | null = null;
      if (today && today.agentPosition === 1) {
        for (let i = t; i >= 0; i--) {
          if (replay.days[i].event === 1) { entry = { day: i, price: replay.days[i].price }; break; }
          if (replay.days[i].event >= 2) break;
        }
      }
      const stopPx = entry ? entry.price * (1 - replay.stopPct) : null;
      const tpPx = entry ? entry.price * (1 + 2 * replay.stopPct) : null;
      const myEntry = propsRef.current.mine?.entry ?? null;
      const myStop = myEntry != null ? myEntry * (1 - replay.stopPct) : null;

      // ---- echelle des prix : s'ajuste en douceur, lignes de l'IA comprises ----
      let lo = Math.min(...bars.map((b) => b.l));
      let hi = Math.max(...bars.map((b) => b.h));
      if (entry && stopPx != null && tpPx != null) { lo = Math.min(lo, stopPx); hi = Math.max(hi, tpPx); }
      if (myEntry != null && myStop != null) { lo = Math.min(lo, myStop); hi = Math.max(hi, myEntry); }
      const pad = (hi - lo || hi * 0.01) * 0.12;
      const target = { min: lo - pad, max: hi + pad };
      const cur = scale.current ?? target;
      cur.min += (target.min - cur.min) * 0.2;
      cur.max += (target.max - cur.max) * 0.2;
      scale.current = cur;
      const converged = Math.abs(cur.min - target.min) + Math.abs(cur.max - target.max) < (target.max - target.min) * 1e-3;
      dirty.current = !converged;
      const yOf = (v: number) => T_HEAD + ((cur.max - v) / (cur.max - cur.min)) * plotH;

      // ---- grille et axe des prix ----
      const step = niceStep((cur.max - cur.min) / 6);
      ctx.font = MONO;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      for (let v = Math.ceil(cur.min / step) * step; v <= cur.max; v += step) {
        const y = yOf(v);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + plotW, y); ctx.stroke();
        ctx.fillStyle = COLORS.axis;
        ctx.fillText(fmtPx(v), L + plotW + 8, y);
      }
      // grille verticale et axe du temps (un repere tous les 10 jours)
      ctx.textAlign = "center";
      for (let i = firstShown; i <= t + 3; i++) {
        if (i % 10 !== 0) continue;
        const x = xOf(i);
        if (x < L || x > L + plotW) continue;
        ctx.strokeStyle = i === 0 ? "rgba(148,163,184,0.35)" : COLORS.grid;
        ctx.beginPath(); ctx.moveTo(x, T_HEAD); ctx.lineTo(x, T_HEAD + plotH); ctx.stroke();
        ctx.fillStyle = i === 0 ? COLORS.text : COLORS.axis;
        ctx.fillText(i === 0 ? "DÉBUT" : `J${i}`, x, T_HEAD + plotH + 13);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(L, T_HEAD, plotW, plotH);
      ctx.clip();

      // krach : ligne verticale rouge
      if (replay.crashDay != null && t >= replay.crashDay) {
        const x = xOf(replay.crashDay);
        ctx.strokeStyle = COLORS.down;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x, T_HEAD); ctx.lineTo(x, T_HEAD + plotH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.down;
        ctx.textAlign = "left";
        ctx.fillText("KRACH !", x + 4, T_HEAD + 10);
      }

      // bande gain / perte de l'agent depuis son entree + lignes entree, stop, objectif
      if (entry && stopPx != null && tpPx != null) {
        const x0 = xOf(entry.day);
        const yE = yOf(entry.price);
        const yC = yOf(live1.c);
        ctx.fillStyle = live1.c >= entry.price ? "rgba(52,194,124,0.10)" : "rgba(239,91,67,0.10)";
        ctx.fillRect(x0, Math.min(yE, yC), L + plotW - x0, Math.abs(yC - yE));
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1;
        for (const [px, color] of [[entry.price, COLORS.sky], [stopPx, COLORS.stop], [tpPx, COLORS.tp]] as const) {
          ctx.strokeStyle = color;
          ctx.beginPath(); ctx.moveTo(x0, yOf(px)); ctx.lineTo(L + plotW, yOf(px)); ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // position du joueur : bande de gain / perte, ligne d'entree et stop suggere
      if (myEntry != null && myStop != null) {
        const yMine = yOf(myEntry);
        const yNow = yOf(live1.c);
        ctx.fillStyle = live1.c >= myEntry ? "rgba(251,191,36,0.10)" : "rgba(239,91,67,0.12)";
        ctx.fillRect(L, Math.min(yMine, yNow), plotW, Math.abs(yNow - yMine));
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1;
        for (const [px, color] of [[myEntry, COLORS.amber], [myStop, COLORS.stop]] as const) {
          ctx.strokeStyle = color;
          ctx.beginPath(); ctx.moveTo(L, yOf(px)); ctx.lineTo(L + plotW, yOf(px)); ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // bougies
      const bodyW = Math.max(2, slotW * 0.62);
      for (const b of bars) {
        const x = xOf(b.day);
        const color = b.c >= b.o ? COLORS.up : COLORS.down;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(1, Math.min(2, slotW * 0.1));
        ctx.beginPath(); ctx.moveTo(x, yOf(b.h)); ctx.lineTo(x, yOf(b.l)); ctx.stroke();
        const top = yOf(Math.max(b.o, b.c));
        ctx.fillRect(x - bodyW / 2, top, bodyW, Math.max(1.5, yOf(Math.min(b.o, b.c)) - top));
      }

      // marqueurs de l'IA (jours deja joues) ; etiquette seulement pour les 3 derniers
      const events = replay.days.slice(0, t + 1).filter((d) => d.event > 0 && xOf(d.day) >= L && xOf(d.day) <= L + plotW);
      events.forEach((d, k) => {
        const bar = bars.find((b) => b.day === d.day);
        if (!bar) return;
        const x = xOf(d.day);
        const buy = d.event === 1;
        const color = buy ? COLORS.sky : d.event === 2 ? COLORS.violet : d.event === 3 ? COLORS.stop : COLORS.tp;
        const y = buy ? yOf(bar.l) + 12 : yOf(bar.h) - 12;
        triangle(ctx, x, y, 5.5, buy, color);
        if (k >= events.length - 3) {
          pill(ctx, EVENT_LABEL[d.event], x, y + (buy ? 17 : -17), color, "#06101F", "center");
        }
      });

      // transactions du joueur
      trades.filter((x) => x.day <= t).forEach((tr, k, arr) => {
        const x = xOf(tr.day);
        const y = yOf(tr.price);
        ctx.fillStyle = COLORS.amber;
        ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1F1500";
        ctx.font = `700 9px ${MONO.slice(5)}`;
        ctx.textAlign = "center";
        ctx.fillText(tr.side === "BUY" ? "B" : "S", x, y + 0.5);
        if (k === arr.length - 1) pill(ctx, tr.side === "BUY" ? "VOUS ACHETEZ" : "VOUS VENDEZ", x, y - 17, COLORS.amber, "#1F1500", "center");
      });

      // pulsation sur la bougie du jour
      if (live) {
        const x = xOf(t);
        const y = yOf(live1.c);
        const pulse = (now % 900) / 900;
        ctx.strokeStyle = `rgba(226,232,240,${0.5 * (1 - pulse)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 4 + pulse * 10, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();

      // ---- etiquettes sur l'axe des prix : entree / stop / objectif / dernier prix ----
      const upNow = live1.c >= live1.o;
      if (myEntry != null && myStop != null) {
        pill(ctx, `TON ENTRÉE ${fmtPx(myEntry)}`, L + plotW + 4, yOf(myEntry), COLORS.amber, "#1F1500");
        pill(ctx, `STOP SUGGÉRÉ ${fmtPx(myStop)}`, L + plotW + 4, yOf(myStop), COLORS.stop, "#1A0505");
      }
      if (entry && stopPx != null && tpPx != null) {
        pill(ctx, `ENTRÉE ${fmtPx(entry.price)}`, L + plotW + 4, yOf(entry.price), COLORS.sky, "#06101F");
        pill(ctx, `SL ${fmtPx(stopPx)}`, L + plotW + 4, yOf(stopPx), COLORS.stop, "#1A0505");
        pill(ctx, `TP ${fmtPx(tpPx)}`, L + plotW + 4, yOf(tpPx), COLORS.tp, "#04170A");
      }
      const yLast = yOf(live1.c);
      ctx.strokeStyle = upNow ? COLORS.up : COLORS.down;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(xOf(t), yLast); ctx.lineTo(L + plotW, yLast); ctx.stroke();
      ctx.setLineDash([]);
      pill(ctx, fmtPx(live1.c), L + plotW + 4, yLast, upNow ? COLORS.up : COLORS.down, "#04110A");

      // ---- ligne des signaux de l'IA, sous l'axe du temps ----
      const laneY = H - 11;
      ctx.fillStyle = "rgba(148,163,184,0.06)";
      ctx.fillRect(L, laneY - 8, plotW, 16);
      ctx.fillStyle = COLORS.axis;
      ctx.font = `600 9px ${MONO.slice(5)}`;
      ctx.textAlign = "left";
      ctx.fillText("SIGNAL IA", L + plotW + 8, laneY);
      for (let i = Math.max(0, firstShown); i <= t; i++) {
        const d = replay.days[i];
        const x = xOf(i);
        ctx.globalAlpha = d.action === "HOLD" ? 0.35 : 0.35 + 0.65 * d.confidence;
        ctx.fillStyle = ACTION_COLOR[d.action];
        if (d.action === "HOLD") { ctx.beginPath(); ctx.arc(x, laneY, 1.8, 0, Math.PI * 2); ctx.fill(); }
        else triangle(ctx, x, laneY, Math.min(4.5, slotW * 0.35 + 1.5), d.action === "BUY", ACTION_COLOR[d.action]);
        ctx.globalAlpha = 1;
      }

      // ---- bandeau du haut : prix OHLC (survole ou dernier) + pensee de l'IA ----
      let hover: Bar | null = null;
      const m = mouse.current;
      if (m && m.x >= L && m.x <= L + plotW && m.y >= T_HEAD && m.y <= T_HEAD + plotH) {
        const idx = Math.round((m.x - L) / slotW - 0.5 + firstShown);
        hover = bars.find((b) => b.day === idx) ?? null;
        ctx.strokeStyle = "rgba(226,232,240,0.35)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(m.x, T_HEAD); ctx.lineTo(m.x, T_HEAD + plotH); ctx.moveTo(L, m.y); ctx.lineTo(L + plotW, m.y); ctx.stroke();
        ctx.setLineDash([]);
        const price = cur.max - ((m.y - T_HEAD) / plotH) * (cur.max - cur.min);
        pill(ctx, fmtPx(price), L + plotW + 4, m.y, "#334155");
      }
      const shown = hover ?? live1;
      ctx.font = `600 ${MONO}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.text;
      const label = `${replay.symbol}  ·  ${shown.day >= 0 ? `J${shown.day}` : `J${shown.day} (historique)`}`;
      ctx.fillText(label, L, 12);
      const w = ctx.measureText(label).width;
      const ohlc: [string, number][] = [["O", shown.o], ["H", shown.h], ["L", shown.l], ["C", shown.c]];
      let x = L + w + 14;
      ctx.font = MONO;
      for (const [k, v] of ohlc) {
        ctx.fillStyle = COLORS.axis;
        ctx.fillText(k, x, 12);
        x += 10;
        ctx.fillStyle = shown.c >= shown.o ? COLORS.up : COLORS.down;
        ctx.fillText(fmtPx(v), x, 12);
        x += ctx.measureText(fmtPx(v)).width + 12;
      }
      if (today) {
        const think = `${agentName} · ${today.action === "BUY" ? "ACHÈTE" : today.action === "SELL" ? "VEND" : "ATTEND"} · ${Math.round(today.confidence * 100)} %`;
        const col = ACTION_COLOR[today.action];
        ctx.font = `600 ${MONO}`;
        const tw = ctx.measureText(think).width + 30;
        const bx = L + plotW - tw;
        ctx.fillStyle = "rgba(8,16,38,0.9)";
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, 3, tw, 20, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(bx + 11, 13, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = "left";
        ctx.fillText(think, bx + 21, 13.5);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: COLORS.bg2 }}>
      <canvas ref={canvasRef} className="block w-full cursor-crosshair" style={{ height: props.height ?? 360 }}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }; dirty.current = true; }}
        onMouseLeave={() => { mouse.current = null; dirty.current = true; }}
        aria-label="Graphique en bougies du marché simulé avec les décisions de l'agent" role="img" />
    </div>
  );
}
