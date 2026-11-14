/**
 * Contenu pedagogique de l'Academie : une station (batiment) par notion de trading.
 * Chaque station = quelques fiches courtes + un mini-quiz. Reussir le quiz debloque la station suivante.
 */

export type Visual = "price" | "candles" | "orders" | "stoploss" | "sizing" | "indicators" | "emotions" | "diversify" | "crash";

export interface Slide {
  title: string;
  text: string;
  /** une phrase a retenir, affichee en encadre */
  tip?: string;
  visual?: Visual;
}

export interface Question {
  q: string;
  options: string[];
  correct: number;
  explain: string;
}

/** Defi interactif apres le quiz : on apprend en faisant. */
export type Challenge = "support" | "stoploss" | "crash" | "sizing";

export interface Station {
  id: string;
  /** nom du lieu dans le monde */
  place: string;
  /** notion enseignee */
  topic: string;
  color: string;
  /** position dans le monde (x, z) ; la mini-map utilise les memes coordonnees */
  x: number;
  z: number;
  /** forme du batiment */
  shape: "market" | "tower" | "bank" | "fortress" | "observatory" | "temple" | "harbor" | "volcano" | "vault";
  xp: number;
  challenge?: Challenge;
  /** station cachee, hors du parcours principal (debloquee en battant l'agent IA) */
  secret?: boolean;
  /** phrase du mentor quand on s'approche */
  greeting: string;
  slides: Slide[];
  quiz: Question[];
}

export const STATIONS: Station[] = [
  {
    id: "market",
    place: "Place du Marché",
    topic: "Qu'est-ce que la bourse ?",
    color: "#22C55E",
    x: 0, z: 18,
    shape: "market",
    xp: 100,
    greeting: "Bienvenue ! Ici tu découvres ce qu'est un marché et pourquoi un prix bouge.",
    slides: [
      {
        title: "Une action, c'est un petit morceau d'entreprise",
        text: "Quand tu achètes une action Apple, tu possèdes une toute petite part d'Apple. Si l'entreprise vaut plus cher demain, ton action aussi.",
        tip: "Action = part d'entreprise. Son prix change chaque seconde.",
        visual: "price",
      },
      {
        title: "Le prix vient de l'offre et de la demande",
        text: "Plus de gens veulent acheter que vendre ? Le prix monte. Plus de vendeurs que d'acheteurs ? Il baisse. Une bonne nouvelle attire les acheteurs, une mauvaise fait fuir.",
        tip: "Beaucoup d'acheteurs → prix ↑ · Beaucoup de vendeurs → prix ↓",
      },
      {
        title: "Gagner ou perdre",
        text: "Tu gagnes si tu vends plus cher que ton prix d'achat. Exemple : achat à 100 $, vente à 110 $ → +10 $ (+10 %). Vente à 90 $ → −10 $. Dans MarketSim, tout est virtuel : tu peux apprendre sans risquer ton vrai argent.",
        tip: "Gain = prix de vente − prix d'achat (moins les frais).",
      },
    ],
    quiz: [
      {
        q: "Tu achètes une action à 50 $ et tu la revends à 60 $. Quel est ton gain (sans frais) ?",
        options: ["+5 $", "+10 $", "+60 $", "−10 $"],
        correct: 1,
        explain: "60 − 50 = 10 $, soit +20 % sur ta mise de 50 $.",
      },
      {
        q: "Une entreprise annonce de très mauvais résultats. Que se passe-t-il le plus souvent ?",
        options: ["Plus d'acheteurs, le prix monte", "Plus de vendeurs, le prix baisse", "Le prix ne bouge pas", "La bourse ferme"],
        correct: 1,
        explain: "Les investisseurs veulent vendre : la demande baisse, le prix descend.",
      },
    ],
  },
  {
    id: "candles",
    place: "Tour des Bougies",
    topic: "Lire un graphique",
    color: "#0EA5E9",
    x: 16, z: 8,
    shape: "tower",
    xp: 120,
    challenge: "support",
    greeting: "Les traders lisent les prix avec des bougies. Je t'apprends à les déchiffrer.",
    slides: [
      {
        title: "Une bougie = une période",
        text: "Chaque bougie résume une période (un jour par exemple) avec 4 prix : ouverture, plus haut, plus bas, clôture. Verte : le prix a fini plus haut qu'à l'ouverture. Rouge : plus bas.",
        tip: "Verte = hausse sur la période · Rouge = baisse.",
        visual: "candles",
      },
      {
        title: "La tendance",
        text: "Des sommets et des creux de plus en plus hauts = tendance haussière. De plus en plus bas = tendance baissière. Trader dans le sens de la tendance est plus simple pour débuter.",
        tip: "« The trend is your friend » : suis la tendance.",
      },
      {
        title: "Supports et résistances",
        text: "Un support est un niveau où le prix a souvent rebondi vers le haut (les acheteurs reviennent). Une résistance est un plafond où il a souvent été repoussé. Quand un niveau casse, il change souvent de rôle.",
        tip: "Support = plancher · Résistance = plafond.",
      },
    ],
    quiz: [
      {
        q: "Une bougie rouge signifie que…",
        options: ["Le prix de clôture est sous le prix d'ouverture", "Le volume était faible", "Le prix a atteint un record", "Il faut acheter"],
        correct: 0,
        explain: "Rouge = la période se termine plus bas qu'elle n'a commencé.",
      },
      {
        q: "Le prix rebondit trois fois sur 95 $. Ce niveau est…",
        options: ["Une résistance", "Un support", "Un stop-loss", "Une moyenne mobile"],
        correct: 1,
        explain: "Un plancher où les acheteurs reviennent s'appelle un support.",
      },
    ],
  },
  {
    id: "orders",
    place: "Banque des Ordres",
    topic: "Passer un ordre",
    color: "#6366F1",
    x: 22, z: -10,
    shape: "bank",
    xp: 120,
    greeting: "Avant de trader, il faut savoir passer un ordre correctement. Suis-moi au guichet.",
    slides: [
      {
        title: "Acheter et vendre",
        text: "Acheter (« long ») : tu paries que le prix va monter. Vendre ta position ferme le trade et encaisse le résultat. Dans le jeu, chaque décision Acheter / Vendre / Attendre compte.",
        visual: "orders",
      },
      {
        title: "Ordre au marché ou ordre limite",
        text: "Ordre au marché : exécuté tout de suite au prix actuel. Ordre limite : exécuté seulement si le prix atteint le niveau que tu as choisi. Le limite te protège d'un mauvais prix, mais peut ne jamais s'exécuter.",
        tip: "Marché = rapide · Limite = prix maîtrisé.",
      },
      {
        title: "Les frais",
        text: "Chaque ordre coûte des frais. Faire trop de trades mange tes gains. Dans MarketSim, les frais augmentent avec ton niveau : 0,05 % en Débutant, jusqu'à 0,3 % en Expert.",
        tip: "Moins de trades, mais de meilleurs trades.",
      },
    ],
    quiz: [
      {
        q: "Tu veux acheter seulement si le prix descend à 48 $. Quel ordre utiliser ?",
        options: ["Ordre au marché", "Ordre limite à 48 $", "Vendre tout", "Aucun ordre"],
        correct: 1,
        explain: "L'ordre limite attend que le prix atteigne 48 $ avant de s'exécuter.",
      },
      {
        q: "Pourquoi faire 50 trades par jour est souvent une mauvaise idée pour un débutant ?",
        options: ["C'est interdit", "Les frais s'accumulent et les décisions sont précipitées", "Le prix ne bouge pas", "Ça bloque le compte"],
        correct: 1,
        explain: "Chaque trade coûte des frais et le surtrading mène à des décisions émotionnelles.",
      },
    ],
  },
  {
    id: "risk",
    place: "Forteresse du Risque",
    topic: "Stop-loss et taille de position",
    color: "#EF4444",
    x: 8, z: -24,
    shape: "fortress",
    xp: 150,
    challenge: "stoploss",
    greeting: "C'est la leçon la plus importante : protéger ton capital. Les pros perdent souvent… mais petit.",
    slides: [
      {
        title: "Le stop-loss",
        text: "Un stop-loss vend automatiquement si le prix descend à un niveau fixé à l'avance. Exemple : achat à 100 $, stop à 95 $ → ta perte maximale est de 5 $ par action. Sans stop, une petite perte peut devenir énorme.",
        tip: "Décide de ta sortie AVANT d'entrer.",
        visual: "stoploss",
      },
      {
        title: "Ne risque que 1 à 2 % par trade",
        text: "Avec 1 000 $, risquer 2 % = accepter de perdre au maximum 20 $ sur un trade. Même avec 10 pertes d'affilée, il te reste plus de 800 $ pour continuer.",
        tip: "Risque par trade = 1 à 2 % du portefeuille.",
        visual: "sizing",
      },
      {
        title: "Le ratio risque / rendement",
        text: "Si tu risques 10 $ pour viser 20 $, ton ratio est 1:2. Avec un ratio de 1:2, tu peux te tromper une fois sur deux et quand même gagner de l'argent.",
        tip: "Vise des gains au moins 2× plus grands que ton risque.",
      },
    ],
    quiz: [
      {
        q: "Tu as 1 000 $ et tu suis la règle des 2 %. Combien acceptes-tu de perdre au maximum sur un trade ?",
        options: ["2 $", "20 $", "200 $", "Tout"],
        correct: 1,
        explain: "2 % de 1 000 $ = 20 $.",
      },
      {
        q: "Achat à 100 $, stop-loss à 92 $. Quelle perte maximale par action ?",
        options: ["2 $", "8 $", "92 $", "Aucune"],
        correct: 1,
        explain: "100 − 92 = 8 $ par action si le stop est touché.",
      },
      {
        q: "Avec un ratio risque/rendement de 1:3, que se passe-t-il si tu gagnes 1 trade sur 3 ?",
        options: ["Tu perds de l'argent", "Tu gagnes quand même de l'argent (avant frais)", "Tu es ruiné", "Impossible à savoir"],
        correct: 1,
        explain: "1 gain de 3 fois le risque − 2 pertes de 1 fois le risque = +1 fois le risque. Tu gagnes en ayant tort 2 fois sur 3 !",
      },
    ],
  },
  {
    id: "indicators",
    place: "Observatoire",
    topic: "Les indicateurs",
    color: "#A855F7",
    x: -14, z: -20,
    shape: "observatory",
    xp: 150,
    greeting: "Depuis l'observatoire, on regarde le marché avec des instruments : les indicateurs.",
    slides: [
      {
        title: "La moyenne mobile",
        text: "La moyenne mobile 20 jours fait la moyenne des 20 derniers prix de clôture. Elle lisse le bruit. Prix au-dessus de la moyenne → plutôt haussier. En dessous → plutôt baissier.",
        visual: "indicators",
      },
      {
        title: "Le RSI",
        text: "Le RSI va de 0 à 100. Au-dessus de 70, l'actif est souvent « suracheté » (il a beaucoup monté, une pause est possible). Sous 30, « survendu ». Ce n'est pas un signal magique : confirme toujours avec la tendance.",
        tip: "RSI > 70 = suracheté · RSI < 30 = survendu.",
      },
      {
        title: "Un indicateur ne prédit pas l'avenir",
        text: "Les indicateurs décrivent le passé. Ils aident à décider, mais aucun ne gagne à tous les coups. L'agent IA de MarketSim les combine et t'explique son raisonnement : compare-le avec le tien.",
      },
    ],
    quiz: [
      {
        q: "Le RSI d'une action est à 78 juste sous une résistance. Que suggère-t-il ?",
        options: ["Elle est survendue, rebond probable", "Elle est surachetée, risque de pause ou de repli", "Achat garanti", "Rien du tout"],
        correct: 1,
        explain: "Au-dessus de 70, l'actif est suracheté ; sous une résistance, le risque de repli augmente.",
      },
      {
        q: "Le prix passe sous sa moyenne mobile 50 jours. C'est plutôt un signe…",
        options: ["Haussier", "Baissier", "Neutre, ça n'a aucun sens", "De krach certain"],
        correct: 1,
        explain: "Passer sous sa moyenne indique un affaiblissement de la tendance.",
      },
    ],
  },
  {
    id: "psychology",
    place: "Temple du Mental",
    topic: "Psychologie du trader",
    color: "#F59E0B",
    x: -24, z: -2,
    shape: "temple",
    xp: 130,
    greeting: "Ton pire ennemi en trading… c'est souvent toi-même. Entre, on va parler émotions.",
    slides: [
      {
        title: "La peur de rater (FOMO)",
        text: "Un actif s'envole et tu achètes en panique pour « ne pas rater le train ». Résultat : tu achètes souvent au plus haut. Si tu n'avais pas prévu ce trade, laisse-le passer.",
        visual: "emotions",
      },
      {
        title: "Le trading de vengeance",
        text: "Après une perte, on veut « se refaire » tout de suite avec un trade plus gros. C'est la meilleure façon de transformer une petite perte en grosse perte. Après 2 pertes d'affilée, fais une pause.",
        tip: "Une perte n'est pas une dette à rembourser au marché.",
      },
      {
        title: "Le plan et le journal",
        text: "Avant chaque trade : pourquoi j'entre, où je sors si j'ai tort (stop), où je sors si j'ai raison (objectif). Après : note ce qui s'est passé. Ta discipline compte dans ton score de compétence MarketSim.",
        tip: "Pas de plan = pas de trade.",
      },
    ],
    quiz: [
      {
        q: "Tu viens de perdre 3 trades de suite. Que faire ?",
        options: ["Doubler la mise pour te refaire", "Faire une pause et relire ton plan", "Supprimer ton stop-loss", "Acheter ce qui monte le plus"],
        correct: 1,
        explain: "La pause casse l'émotion ; doubler la mise est du trading de vengeance.",
      },
      {
        q: "Qu'est-ce que le FOMO ?",
        options: ["Un indicateur technique", "La peur de rater une opportunité qui pousse à acheter trop tard", "Un type d'ordre", "Une stratégie gagnante"],
        correct: 1,
        explain: "FOMO = Fear Of Missing Out, la peur de rater le mouvement.",
      },
    ],
  },
  {
    id: "diversify",
    place: "Port des Actifs",
    topic: "Diversifier son portefeuille",
    color: "#14B8A6",
    x: -16, z: 14,
    shape: "harbor",
    xp: 130,
    greeting: "Au port, les navires transportent des actifs différents. Ne mets jamais toute ta cargaison sur un seul bateau !",
    slides: [
      {
        title: "Ne pas mettre tous ses œufs dans le même panier",
        text: "Si tout ton argent est sur une seule action et qu'elle chute de 40 %, ton portefeuille chute de 40 %. Réparti sur 5 actifs différents, la même chute ne coûte que 8 %.",
        visual: "diversify",
        tip: "Diversifier = réduire l'impact d'une mauvaise surprise.",
      },
      {
        title: "La corrélation",
        text: "Deux actions tech montent et baissent souvent ensemble (forte corrélation). Les mélanger diversifie peu. Combine des secteurs différents : tech, santé, énergie, or…",
      },
      {
        title: "Dans MarketSim",
        text: "L'onglet « Multi-actifs » de l'Agent IA te montre un portefeuille réparti et sa performance. Compare un portefeuille diversifié avec un « tout sur une action ».",
      },
    ],
    quiz: [
      {
        q: "1 000 $ répartis à parts égales sur 4 actions. L'une perd 50 %, les autres ne bougent pas. Ta perte ?",
        options: ["−500 $", "−125 $", "−50 $", "0 $"],
        correct: 1,
        explain: "250 $ par action ; la moitié de 250 $ = 125 $, soit −12,5 % du total.",
      },
      {
        q: "Quel portefeuille est le mieux diversifié ?",
        options: ["Apple + Microsoft + Google", "Apple + une entreprise de santé + une d'énergie + de l'or", "100 % Tesla", "Deux fois Apple"],
        correct: 1,
        explain: "Des secteurs différents réagissent différemment aux mêmes nouvelles.",
      },
    ],
  },
  {
    id: "crash",
    place: "Volcan du Krach",
    topic: "Survivre à un krach",
    color: "#F97316",
    x: -4, z: 0,
    shape: "volcano",
    xp: 200,
    challenge: "crash",
    greeting: "Dernière épreuve : le volcan. Un krach arrive toujours un jour. Montre-moi que tu sauras rester calme.",
    slides: [
      {
        title: "Un krach, c'est quoi ?",
        text: "Une chute brutale et rapide de tout le marché, souvent −20 % ou plus en quelques jours. Dans le jeu MarketSim, un krach surprise peut arriver — il est imposé à partir du niveau Avancé.",
        visual: "crash",
      },
      {
        title: "Le drawdown",
        text: "Le drawdown est la baisse entre ton plus haut et ton plus bas. Perdre 50 % demande ensuite +100 % pour revenir au départ ! C'est pour ça que limiter les pertes est plus important que chercher les gros gains.",
        tip: "−50 % demande +100 % pour revenir à zéro.",
      },
      {
        title: "Ton plan anti-krach",
        text: "1) Stop-loss toujours en place. 2) Ne pas tout investir : garde du cash. 3) Ne pas vendre en panique sans raison ni acheter « la chute » d'un coup. 4) Respecter ta taille de position. Maintenant, passe à la pratique dans le jeu de trading !",
        tip: "Tu as terminé l'Académie quand tu sais survivre au pire.",
      },
    ],
    quiz: [
      {
        q: "Ton portefeuille passe de 1 000 $ à 500 $. Quel gain te faut-il pour revenir à 1 000 $ ?",
        options: ["+50 %", "+100 %", "+25 %", "+500 %"],
        correct: 1,
        explain: "500 $ × 2 = 1 000 $ : il faut doubler, soit +100 %.",
      },
      {
        q: "Le marché chute de 15 % en deux jours. Quelle réaction est la plus saine ?",
        options: ["Tout vendre en panique", "Suivre son plan : stops en place, taille de position respectée", "Emprunter pour tout acheter", "Désactiver ses stops"],
        correct: 1,
        explain: "Le plan préparé à froid protège des décisions émotionnelles.",
      },
      {
        q: "Pourquoi garder une partie en cash ?",
        options: ["Ça rapporte beaucoup", "Pour limiter la perte et pouvoir saisir des occasions après la chute", "C'est obligatoire", "Pour payer moins de frais"],
        correct: 1,
        explain: "Le cash ne chute pas pendant le krach et te laisse des munitions.",
      },
    ],
  },
  {
    id: "experts",
    place: "Salle des Experts",
    topic: "Techniques de pro",
    color: "#EAB308",
    x: 24, z: 24,
    shape: "vault",
    xp: 250,
    challenge: "sizing",
    secret: true,
    greeting: "Tu as battu l'agent IA plusieurs fois : la Salle des Experts s'ouvre pour toi. Ici, on parle comme des pros.",
    slides: [
      {
        title: "L'espérance d'une stratégie",
        text: "Espérance = (taux de réussite × gain moyen) − (taux d'échec × perte moyenne). Avec 40 % de réussite, un gain moyen de 60 $ et une perte moyenne de 25 $ : 0,4 × 60 − 0,6 × 25 = +9 $ par trade. Une stratégie gagnante n'a pas besoin de gagner souvent.",
        tip: "Ce qui compte : espérance > 0, répétée sur beaucoup de trades.",
      },
      {
        title: "Taille de position selon la volatilité",
        text: "Une action qui bouge de 5 % par jour est plus risquée qu'une qui bouge de 1 %. Les pros ajustent la quantité : nombre d'actions = risque accepté ÷ distance au stop. Risque 20 $, stop à 4 $ sous l'entrée → 5 actions. Stop à 1 $ → 20 actions.",
        tip: "Quantité = risque en $ ÷ (prix d'entrée − stop).",
      },
      {
        title: "Le piège du sur-apprentissage",
        text: "Une stratégie réglée parfaitement sur le passé (backtest) échoue souvent sur des données nouvelles : elle a appris le bruit. Teste toujours sur une période que tu n'as pas utilisée pour la régler — c'est ce que fait la simulation Monte Carlo de l'agent IA.",
      },
    ],
    quiz: [
      {
        q: "Réussite 50 %, gain moyen 30 $, perte moyenne 40 $. L'espérance par trade est…",
        options: ["+5 $", "−5 $", "+35 $", "0 $"],
        correct: 1,
        explain: "0,5 × 30 − 0,5 × 40 = 15 − 20 = −5 $ : perdante malgré une réussite d'un trade sur deux.",
      },
      {
        q: "Tu acceptes de risquer 30 $. Entrée 50 $, stop à 47 $. Combien d'actions acheter ?",
        options: ["3", "10", "30", "47"],
        correct: 1,
        explain: "30 $ ÷ (50 − 47) = 30 ÷ 3 = 10 actions.",
      },
    ],
  },
];

/** Ordre de deblocage = ordre du tableau. */
export function stationIndex(id: string) {
  return STATIONS.findIndex((s) => s.id === id);
}

/** Parcours principal (le diplome) : les stations non secretes. */
export const MAIN_STATIONS = STATIONS.filter((s) => !s.secret);

/** Bonus de XP d'un defi reussi (moitie si plusieurs essais). */
export const CHALLENGE_XP = 50;

export const TOTAL_XP = MAIN_STATIONS.reduce((n, s) => n + s.xp + (s.challenge ? CHALLENGE_XP : 0), 0);

/** Rangs du joueur dans l'Academie, selon l'XP gagnee. */
export function rankFor(xp: number) {
  if (xp >= TOTAL_XP) return "Diplômé de l'Académie";
  if (xp >= 800) return "Stratège";
  if (xp >= 350) return "Apprenti trader";
  if (xp >= 100) return "Explorateur";
  return "Nouvel arrivant";
}
