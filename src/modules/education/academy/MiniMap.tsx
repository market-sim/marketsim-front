import { useEffect, useRef } from "react";
import type { Station } from "./lessons";
import { ISLAND_RADIUS, START, type PlayerState, type StationStatus } from "./World3D";

interface Props {
  stations: Station[];
  statuses: Record<string, StationStatus>;
  questId: string | null;
  recommended?: string[];
  player: PlayerState;
  size: number;
  /** grande carte : affiche aussi le nom des lieux */
  big?: boolean;
}

const EXTENT = ISLAND_RADIUS + 5;

/** Mini-map facon jeu video : ile, chemins, stations, position et direction du joueur. Clic = y aller. */
export default function MiniMap({ stations, statuses, questId, recommended = [], player, size, big = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ stations, statuses, questId, recommended });
  live.current = { stations, statuses, questId, recommended };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = size / (EXTENT * 2);
    const toPx = (x: number, z: number) => [size / 2 + x * scale, size / 2 + z * scale] as const;
    let raf = 0;
    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      const { stations: st, statuses: stat, questId: q, recommended: reco } = live.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      // mer
      ctx.fillStyle = "#0C4A6E";
      ctx.fillRect(0, 0, size, size);
      // ile
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, (ISLAND_RADIUS + 2.5) * scale, 0, Math.PI * 2);
      ctx.fillStyle = "#FDE68A";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, ISLAND_RADIUS * scale, 0, Math.PI * 2);
      ctx.fillStyle = "#22C55E";
      ctx.fill();
      // chemins
      ctx.strokeStyle = "rgba(254,243,199,.9)";
      ctx.lineWidth = big ? 4 : 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(...toPx(START.x, START.z));
      st.filter((s) => !s.secret).forEach((s) => ctx.lineTo(...toPx(s.x, s.z)));
      ctx.stroke();
      // stations
      st.forEach((s, i) => {
        const [px, py] = toPx(s.x, s.z);
        const status = stat[s.id] ?? "locked";
        if (status === "hidden") return;
        if (reco.includes(s.id)) {
          const pulse = 1 + 0.4 * Math.abs(Math.sin(time / 180));
          ctx.beginPath();
          ctx.arc(px, py, (big ? 11 : 6.5) * 1.5 * pulse, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(239,68,68,.9)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        const r = big ? 11 : 6.5;
        if (s.id === q) {
          const pulse = 1 + 0.35 * Math.sin(time / 250);
          ctx.beginPath();
          ctx.arc(px, py, r * 1.6 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(250,204,21,.35)";
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = status === "locked" ? "#64748B" : status === "done" ? "#16A34A" : s.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${big ? 11 : 8}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(status === "done" ? "✓" : status === "locked" ? "•" : s.secret ? "★" : String(i + 1), px, py + 0.5);
        if (big) {
          ctx.font = "600 12px Inter, sans-serif";
          const label = s.place;
          const w = ctx.measureText(label).width + 12;
          ctx.fillStyle = "rgba(15,23,42,.8)";
          ctx.fillRect(px - w / 2, py + r + 4, w, 18);
          ctx.fillStyle = status === "locked" ? "#CBD5E1" : "#fff";
          ctx.fillText(label, px, py + r + 13);
        }
      });
      // champ de vision de la camera
      const [ppx, ppy] = toPx(player.x, player.z);
      const fx = -Math.sin(player.cameraYaw);
      const fz = -Math.cos(player.cameraYaw);
      const ang = Math.atan2(fz, fx);
      ctx.beginPath();
      ctx.moveTo(ppx, ppy);
      ctx.arc(ppx, ppy, big ? 60 : 34, ang - 0.45, ang + 0.45);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,.18)";
      ctx.fill();
      // destination
      if (player.target) {
        const [tx, ty] = toPx(player.target.x, player.target.z);
        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ppx, ppy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // joueur : fleche orientee
      ctx.save();
      ctx.translate(ppx, ppy);
      // cap 0 = vers +z (bas de la carte) ; la fleche est dessinee vers le haut
      ctx.rotate(Math.PI - player.heading);
      const a = big ? 11 : 7;
      ctx.beginPath();
      ctx.moveTo(0, -a);
      ctx.lineTo(a * 0.7, a * 0.7);
      ctx.lineTo(0, a * 0.35);
      ctx.lineTo(-a * 0.7, a * 0.7);
      ctx.closePath();
      ctx.fillStyle = "#3B82F6";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      // nord
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.font = "700 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", size / 2, 9);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [player, size, big]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = size / (EXTENT * 2);
    const x = (e.clientX - rect.left - size / 2) / scale;
    const z = (e.clientY - rect.top - size / 2) / scale;
    // clic pres d'une station : on vise son entree
    const s = stations.find((st) => statuses[st.id] !== "hidden" && Math.hypot(st.x - x, st.z - z) < 4);
    if (s) {
      const len = Math.hypot(s.x, s.z) || 1;
      player.target = { x: s.x - (s.x / len) * 6.2, z: s.z - (s.z / len) * 6.2 };
      return;
    }
    const r = Math.hypot(x, z);
    if (r < ISLAND_RADIUS - 1) player.target = { x, z };
  };

  return (
    <canvas
      ref={ref}
      onClick={onClick}
      title="Clique sur la carte pour t'y rendre"
      style={{ width: size, height: size, borderRadius: big ? 16 : "50%", cursor: "crosshair", display: "block" }}
    />
  );
}
