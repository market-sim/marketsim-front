import type { Visual } from "./lessons";

const G = "#22C55E";
const R = "#EF4444";
const B = "#3B82F6";
const T = "#64748B";

/** Petites illustrations des fiches (SVG simples, lisibles en clair et en sombre). */
export default function LessonVisual({ kind }: { kind: Visual }) {
  const box = "w-full h-40 rounded-xl bg-slate-900/90 p-3";
  switch (kind) {
    case "price": {
      const pts = [60, 58, 63, 61, 67, 64, 70, 74, 71, 78, 82];
      return (
        <svg viewBox="0 0 220 100" className={box}>
          <polyline fill="none" stroke={G} strokeWidth="3" points={pts.map((p, i) => `${10 + i * 20},${100 - p}`).join(" ")} />
          <circle cx="30" cy="42" r="5" fill={B} />
          <text x="18" y="62" fill="#fff" fontSize="9">achat 100 $</text>
          <circle cx="210" cy="18" r="5" fill={G} />
          <text x="150" y="14" fill="#fff" fontSize="9">vente 110 $</text>
          <text x="90" y="92" fill={G} fontSize="11" fontWeight="700">+10 $ (+10 %)</text>
        </svg>
      );
    }
    case "candles": {
      const c = [
        [70, 55, 75, 50], [55, 62, 66, 52], [62, 48, 64, 45], [48, 58, 60, 44], [58, 40, 61, 37], [40, 46, 49, 36], [46, 30, 48, 27],
      ];
      return (
        <svg viewBox="0 0 220 100" className={box}>
          <line x1="0" y1="66" x2="220" y2="66" stroke={T} strokeDasharray="4 4" />
          <text x="150" y="80" fill={T} fontSize="9">support</text>
          {c.map(([o, cl, lo, hi], i) => {
            const up = cl < o;
            const x = 20 + i * 28;
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={hi} y2={lo + 10} stroke={up ? G : R} strokeWidth="2" />
                <rect x={x - 7} y={Math.min(o, cl)} width="14" height={Math.max(3, Math.abs(o - cl))} fill={up ? G : R} rx="2" />
              </g>
            );
          })}
          <text x="10" y="96" fill="#fff" fontSize="9">verte = clôture &gt; ouverture · rouge = clôture &lt; ouverture</text>
        </svg>
      );
    }
    case "orders":
      return (
        <svg viewBox="0 0 220 100" className={box}>
          <rect x="15" y="20" width="85" height="60" rx="10" fill={G} opacity=".9" />
          <text x="57" y="48" fill="#fff" fontSize="14" fontWeight="700" textAnchor="middle">ACHETER</text>
          <text x="57" y="66" fill="#fff" fontSize="9" textAnchor="middle">je parie sur la hausse</text>
          <rect x="120" y="20" width="85" height="60" rx="10" fill={R} opacity=".9" />
          <text x="162" y="48" fill="#fff" fontSize="14" fontWeight="700" textAnchor="middle">VENDRE</text>
          <text x="162" y="66" fill="#fff" fontSize="9" textAnchor="middle">je ferme et j'encaisse</text>
        </svg>
      );
    case "stoploss": {
      const pts = [40, 44, 41, 48, 52, 47, 58, 66, 74];
      return (
        <svg viewBox="0 0 220 100" className={box}>
          <line x1="0" y1="40" x2="220" y2="40" stroke={B} strokeDasharray="4 4" />
          <text x="150" y="36" fill={B} fontSize="9">entrée 100 $</text>
          <line x1="0" y1="62" x2="220" y2="62" stroke={R} strokeWidth="2" />
          <text x="150" y="58" fill={R} fontSize="9" fontWeight="700">stop 95 $</text>
          <polyline fill="none" stroke="#fff" strokeWidth="2.5" points={pts.map((p, i) => `${10 + i * 15},${p}`).join(" ")} />
          <circle cx="115" cy="62" r="5" fill={R} />
          <polyline fill="none" stroke={T} strokeDasharray="3 3" strokeWidth="2" points="130,66 160,80 200,92" />
          <text x="10" y="94" fill="#fff" fontSize="9">vendu à 95 $ : la perte s'arrête là</text>
        </svg>
      );
    }
    case "sizing":
      return (
        <svg viewBox="0 0 220 100" className={box}>
          {Array.from({ length: 50 }).map((_, i) => (
            <rect key={i} x={12 + (i % 10) * 20} y={10 + Math.floor(i / 10) * 14} width="16" height="10" rx="2" fill={i === 0 ? R : "#334155"} />
          ))}
          <text x="10" y="94" fill="#fff" fontSize="9">1 000 $ = 50 cases de 20 $ · tu n'en risques qu'1 par trade</text>
        </svg>
      );
    case "indicators": {
      const price = [50, 46, 52, 44, 40, 45, 36, 32, 38, 28, 24];
      const ma = [52, 50, 49, 47, 45, 44, 41, 38, 36, 33, 30];
      return (
        <svg viewBox="0 0 220 100" className={box}>
          <polyline fill="none" stroke="#fff" strokeWidth="2" points={price.map((p, i) => `${10 + i * 20},${p + 10}`).join(" ")} />
          <polyline fill="none" stroke="#A855F7" strokeWidth="3" points={ma.map((p, i) => `${10 + i * 20},${p + 10}`).join(" ")} />
          <text x="10" y="94" fill="#A855F7" fontSize="9" fontWeight="700">moyenne mobile</text>
          <text x="110" y="94" fill="#fff" fontSize="9">prix au-dessus = haussier</text>
        </svg>
      );
    }
    case "emotions":
      return (
        <svg viewBox="0 0 220 100" className={box}>
          <polyline fill="none" stroke={G} strokeWidth="2.5" points="10,80 50,70 80,50 110,20" />
          <polyline fill="none" stroke={R} strokeWidth="2.5" points="110,20 140,45 170,60 210,75" />
          <circle cx="110" cy="20" r="6" fill="#F59E0B" />
          <text x="118" y="16" fill="#F59E0B" fontSize="9" fontWeight="700">achat FOMO au sommet</text>
          <text x="10" y="96" fill="#fff" fontSize="9">acheter par peur de rater = acheter souvent trop tard</text>
        </svg>
      );
    case "diversify":
      return (
        <svg viewBox="0 0 220 100" className={box}>
          <rect x="15" y="15" width="80" height="55" rx="6" fill={R} />
          <text x="55" y="45" fill="#fff" fontSize="10" textAnchor="middle" fontWeight="700">1 action</text>
          <text x="55" y="86" fill={R} fontSize="10" textAnchor="middle" fontWeight="700">−40 %</text>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={120 + (i % 3) * 30} y={15 + Math.floor(i / 3) * 30} width="26" height="26" rx="4" fill={i === 0 ? R : [G, B, "#F59E0B", "#14B8A6"][i - 1]} />
          ))}
          <text x="162" y="86" fill={G} fontSize="10" textAnchor="middle" fontWeight="700">−8 % seulement</text>
        </svg>
      );
    case "crash": {
      const pts = [30, 28, 32, 30, 34, 70, 82, 78, 74, 70, 66];
      return (
        <svg viewBox="0 0 220 100" className={box}>
          <polyline fill="none" stroke={R} strokeWidth="3" points={pts.map((p, i) => `${10 + i * 20},${p}`).join(" ")} />
          <text x="95" y="20" fill={R} fontSize="12" fontWeight="700">KRACH −25 %</text>
          <text x="10" y="96" fill="#fff" fontSize="9">−50 % demande +100 % pour revenir au départ</text>
        </svg>
      );
    }
  }
}
