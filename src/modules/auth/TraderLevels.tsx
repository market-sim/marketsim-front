import { Link } from "react-router";
import { Bot, Gamepad2 } from "lucide-react";
import type { TraderLevel, UserLevelAssessment } from "../../api/endpoints";
import { LEVEL_COLOR, LEVEL_LABEL } from "../../progression/ProgressionContext";

function LevelBox({ title, Icon, level, score, detail, active }: {
  title: string; Icon: typeof Bot; level?: TraderLevel | null; score?: number | null; detail: React.ReactNode; active: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${active ? "border-blue-500/50 bg-blue-500/5" : "border-border"}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {title}
        {active && <span className="ms-auto rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white normal-case tracking-normal">affiché</span>}
      </div>
      <p className="mt-1.5 text-[15px] font-semibold" style={{ color: level ? LEVEL_COLOR[level] : undefined }}>
        {level ? LEVEL_LABEL[level] ?? level : "—"}
        {score != null && <span className="ms-1.5 text-[12px] font-normal text-muted-foreground">score {score}/100</span>}
      </p>
      <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{detail}</div>
    </div>
  );
}

/**
 * Les deux niveaux du module 1, cote a cote : niveau d'activite (modele IA) et niveau de trading (jeu), avec la
 * regle qui choisit le niveau affiche. Utilise par le profil et par la fiche admin d'un utilisateur.
 */
export default function TraderLevels({ level, admin = false }: { level: UserLevelAssessment; admin?: boolean }) {
  const source = level.levelSource ?? (level.reasonCodes.includes("TRADING_PROGRESSION") ? "TRADING" : "ACTIVITY");
  // anciennes reponses (serveur pas a jour) : pas de niveaux separes
  const activityLevel = level.activityLevel !== undefined ? level.activityLevel : source === "ACTIVITY" ? level.level : null;
  const activityScore = level.activityScore !== undefined ? level.activityScore : source === "ACTIVITY" ? level.score : null;
  const reasons = level.reasonCodes.filter((r) => r !== "TRADING_PROGRESSION");
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <LevelBox title="Activité · modèle IA" Icon={Bot} level={activityLevel} score={activityScore} active={source === "ACTIVITY"}
          detail={activityLevel
            ? <>{reasons.join(", ") || "—"}{level.modelVersion ? ` · ${level.modelVersion}` : ""}</>
            : <>Activité insuffisante ({level.successfulLoginCount} connexion{level.successfulLoginCount > 1 ? "s" : ""} réussie{level.successfulLoginCount > 1 ? "s" : ""}) : aucun niveau n&apos;est inventé.</>} />
        <LevelBox title="Trading · jeu" Icon={Gamepad2} level={level.tradingLevel ?? (source === "TRADING" ? level.level : null)}
          score={level.tradingScore ?? (source === "TRADING" ? level.score : null)} active={source === "TRADING"}
          detail={(level.tradingLevel ?? (source === "TRADING" ? level.level : null))
            ? <>Portefeuille du jeu et façon de trader.{!admin && <> <Link to="/progression" className="text-blue-600 font-medium">Voir ma progression</Link></>}</>
            : <>Pas encore de partie jouée.</>} />
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        <b className="text-foreground">Règle :</b> {level.displayRule ?? "le niveau de trading s'affiche dès qu'un profil de trader existe, sinon le niveau d'activité."}
      </p>
    </div>
  );
}
