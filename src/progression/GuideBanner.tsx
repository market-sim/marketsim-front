import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { BookOpen, ChevronDown, ChevronUp, X } from "lucide-react";
import { LEVEL_LABEL, money, useProgression } from "./ProgressionContext";

interface PageGuide { title: string; steps: string[]; tip: string }

/** Guide detaille par page (niveau Debutant) ; le niveau Intermediaire ne voit que l'astuce ; au-dela, rien. */
const GUIDES: Record<string, PageGuide> = {
  "/": {
    title: "Bienvenue ! Par où commencer",
    steps: [
      "Tu as un portefeuille de 1 000 $ virtuels (en haut à droite). Il monte ou descend selon tes parties.",
      "Va dans « Agent IA », ouvre l'onglet « Replay vs Agent » puis le Jeu de trading.",
      "Joue une partie : le coach te conseille à chaque étape, le guide t'explique quoi faire.",
      "Ton niveau monte si ton argent grandit ET si tu trades bien. Clique sur ton niveau pour voir ce qu'il te manque.",
    ],
    tip: "Clique sur ton niveau en haut à droite pour voir les conditions du niveau suivant.",
  },
  "/agent": {
    title: "L'agent IA et le jeu de trading",
    steps: [
      "Choisis un agent à gauche (ou crée-en un) : c'est lui qui sert de coach.",
      "Onglet « Replay vs Agent » : clique sur le Jeu de trading pour jouer avec ton portefeuille.",
      "Commence avec des achats de 25 % : tu limites la perte si le marché baisse.",
      "Respecte le stop-loss conseillé : couper une perte tôt fait monter ton score de discipline.",
    ],
    tip: "Le score de discipline compte dans ton niveau : coupe tes pertes avant 1,5 fois le stop.",
  },
  "/trading": {
    title: "Passer un ordre",
    steps: [
      "Un ordre d'ACHAT parie que le prix va monter, une VENTE qu'il va baisser.",
      "Ajoute toujours un stop-loss (prix où tu coupes la perte) et un take-profit (prix où tu prends ton gain).",
      "Ne mets jamais tout ton argent sur un seul actif : répartis le risque.",
    ],
    tip: "Un stop-loss sur chaque ordre : c'est la première règle des traders qui durent.",
  },
  "/market": {
    title: "Lire le marché",
    steps: [
      "Regarde la tendance : une suite de plus hauts de plus en plus hauts = marché haussier.",
      "Les actualités font bouger les prix : lis-les avant de décider.",
      "Un actif très volatil peut faire gagner vite, mais aussi perdre vite.",
    ],
    tip: "Compare la volatilité des actifs avant d'en choisir un.",
  },
  "/education": {
    title: "Apprendre",
    steps: [
      "Suis les cours dans l'ordre : chacun prépare le suivant.",
      "Après un cours, applique-le tout de suite dans une partie du Jeu de trading.",
    ],
    tip: "Un cours puis une partie : c'est la façon la plus rapide de progresser.",
  },
};

const KEY = "marketsim:guide:hidden";
const readHidden = (): string[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
};

export default function GuideBanner() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { progression: p } = useProgression();
  const [hidden, setHidden] = useState<string[]>(readHidden);
  const [collapsed, setCollapsed] = useState(false);

  const guide = GUIDES[pathname];
  if (!p || !guide || p.difficulty.guide === "NONE" || hidden.includes(`${p.level}:${pathname}`)) return null;

  const hide = () => {
    const next = [...hidden, `${p.level}:${pathname}`];
    setHidden(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
  };

  if (p.difficulty.guide === "TIPS") {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[12px] text-foreground">
        <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
        <span><b>Astuce · </b>{guide.tip}</span>
        <button onClick={hide} aria-label="Masquer l'astuce" className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
        <p className="text-[13px] font-semibold text-foreground">Guide · {guide.title}</p>
        <span className="text-[11px] text-muted-foreground">niveau {LEVEL_LABEL[p.level]} · {money(p.balance)}</span>
        <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Afficher le guide" : "Réduire le guide"}
          className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        <button onClick={hide} aria-label="Masquer le guide" className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      {!collapsed && (
        <>
          <ol className="mt-2 space-y-1.5">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-foreground">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {pathname !== "/agent" && (
            <button onClick={() => navigate("/agent?play=1")} className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
              Jouer une partie
            </button>
          )}
          <p className="text-[10.5px] text-muted-foreground mt-2">Ce guide disparaît quand tu passes Avancé : l'application devient plus difficile avec ton niveau.</p>
        </>
      )}
    </div>
  );
}
