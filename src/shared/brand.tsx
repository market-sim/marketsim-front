import logoFull from "../assets/logo.png";
import logoMark from "../assets/logo-mark.png";

/** Identite visuelle de MarketSim AI (couleurs lues dans le logo). */
export const BRAND = {
  gold: "#D2B883",
  cyan: "#5BD5DE",
  navy: "#041634",
};

/** Logo complet (elephant, bougies, nom) et repere seul, sur fond transparent : prevus pour les fonds sombres. */
export { logoFull, logoMark };

/** Le nom « MarketSim AI » avec les deux couleurs du logo : « Market » en or, « Sim AI » en cyan. */
export function BrandName({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span className={className} style={style}>
      <span style={{ color: BRAND.gold }}>Market</span>
      <span style={{ color: BRAND.cyan }}>Sim AI</span>
    </span>
  );
}
