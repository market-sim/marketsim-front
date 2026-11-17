<p align="center"><img src="src/assets/logo.png" alt="MarketSim AI" width="220" /></p>

# MarketSim AI — Frontend (React)

Interface du simulateur de salle de marché **MarketSim AI** (Esprit — PIF 2026-2027).
Le backend Spring Boot est dans un autre repo : `marketsim-backend`.

## Stack

React 18 · TypeScript · Vite · Tailwind CSS 4 · React Router · Axios · Recharts · lucide-react
(template Figma « Simple Professional App Design »)

## Lancer le projet

Prérequis : **Node.js 18+** et le **backend lancé** sur `http://localhost:8081`.

```bash
npm install
```

```bash
npm run dev
```

Ouvrir **http://localhost:5173** → se connecter avec `admin@marketsim.tn` / `admin123`
ou créer un compte via « S'inscrire ».

> L'URL du backend se change dans un fichier `.env` (copier `.env.example`).

## Organisation du code (un dossier = un module)

```
src/
├── api/
│   ├── client.ts        axios + ajout automatique du token JWT
│   └── endpoints.ts     toutes les fonctions d'appel API, rangées par module
├── auth/                AuthContext (utilisateur connecté), ProtectedRoute
├── layout/              AppLayout (sidebar + header), navConfig (menu)
├── shared/ui.tsx        petits composants communs (CardShell, SignalBadge...)
├── modules/coach/       Coach de trading flottant, présent sur tous les écrans (voix, forme d'onde, analyse de la courbe)
├── modules/news/        « Trading TV » : chaînes d'info boursière en direct (vidéo) + flash audio des actualités
├── modules/
│   ├── auth/            Module 1 — Login / Register
│   ├── admin/           Module 1 — Back-office (comptes)
│   ├── dashboard/
│   ├── trading/         Module 2  ✅ branché sur l'API
│   ├── analysis/        Module 3  ✅ stratégies branchées sur l'API
│   ├── education/       Module 4  ✅ cours branchés sur l'API
│   ├── market/          Module 5  (mockData pour l'instant)
│   ├── agent/           Module 6  ✅ branché sur l'API (assistant, pilote auto, XAI, Monte Carlo, RL, données réelles, tournoi, replay, audit)
│   ├── stress/          Module 7  ✅ scénarios branchés sur l'API
│   └── blockchain/      Volet Blockchain (mockData)
├── app/App.tsx          les routes
└── app/components/ui/   composants shadcn/ui prêts à l'emploi (Dialog, Table, Tabs, Select...)
```

Le Replay de l'agent (`modules/agent/components/ReplayPanel.tsx`) trace un graphique en bougies (`CandleChart.tsx`) et propose un **mode débutant** à 1 000 € virtuels avec le coach IA (`BeginnerSchool.tsx`, logique pure dans `schoolLogic.ts`, testée par `npm run test:logic`).

Chaque module a un fichier `mockData.tsx` : ce sont les données fictives du template.
**Le travail de chacun = remplacer les mockData de son module par des appels API**, exemple :

```tsx
import { agentsApi, type AgentConfig } from "../../api/endpoints";

const [agents, setAgents] = useState<AgentConfig[]>([]);
useEffect(() => { agentsApi.list().then(setAgents); }, []);
```

Ajouter une page : créer le composant dans `modules/<module>/`, l'ajouter dans `app/App.tsx` (route)
et dans `layout/navConfig.tsx` (menu).

## Travailler à plusieurs avec Git

1. `git pull` sur `main` avant de commencer.
2. Une branche par module : `module4-education`, `module6-agent`...
3. Chacun modifie surtout **son** dossier `modules/<module>/` et **sa** section de `api/endpoints.ts`.
4. *Push* puis **Pull Request** vers `main`.
5. Ne jamais commit `node_modules/` ni `.env` (déjà dans `.gitignore`).
