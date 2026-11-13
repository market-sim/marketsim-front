import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { CheckCircle2, Circle, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  authApi, ordersApi, portfolioApi, type Portfolio, type SecurityScore, type TradeOrder, type UserLevelAssessment,
} from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY, MONO, fmt } from "../../shared/ui";
import { inputClass, labelClass } from "./AuthLayout";
import PasswordField from "./PasswordField";
import {
  LEVELS, LEVEL_LABELS, activityFacts, levelProgress, levelTips, passwordError, reasonText, securityStyle,
} from "./userLogic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfilePage() {
  const { user, updateProfile, setLevel } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<SecurityScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [scoreError, setScoreError] = useState("");
  const [level, setLevelAssessment] = useState<UserLevelAssessment | null>(null);
  const [levelLoading, setLevelLoading] = useState(true);
  const [levelError, setLevelError] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<TradeOrder[]>([]);

  useEffect(() => {
    let cancelled = false;
    setScoreLoading(true);
    setScoreError("");
    authApi.mySecurityScore()
      .then((data) => { if (!cancelled) setScore(data); })
      .catch((err) => { if (!cancelled) setScoreError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setScoreLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLevelLoading(true);
    setLevelError("");
    authApi.myLevel()
      .then((data) => {
        if (cancelled) return;
        setLevelAssessment(data);
        if (data.level) setLevel(data.level);
      })
      .catch((err) => { if (!cancelled) setLevelError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLevelLoading(false); });
    return () => { cancelled = true; };
  }, [setLevel]);

  // Module 2 : resume du compte de trading (facultatif : la page reste utilisable si le trading est indisponible)
  useEffect(() => {
    let cancelled = false;
    portfolioApi.get().then((p) => { if (!cancelled) setPortfolio(p); }).catch(() => {});
    ordersApi.list().then((o) => { if (!cancelled) setOrders(o); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const changingPassword = currentPassword !== "" || newPassword !== "" || confirmPassword !== "";
  const newPasswordProblem = changingPassword && newPassword ? passwordError(newPassword, confirmPassword) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!firstName.trim() || !lastName.trim()) { setError("Le prénom et le nom ne peuvent pas être vides."); return; }
    if (!EMAIL_PATTERN.test(email.trim())) { setError("Email invalide."); return; }
    if (changingPassword) {
      if (currentPassword === "" || newPassword === "") { setError("Le mot de passe actuel et le nouveau mot de passe sont requis."); return; }
      const problem = passwordError(newPassword, confirmPassword);
      if (problem) { setError(problem); return; }
    }
    setBusy(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        ...(changingPassword ? { currentPassword, newPassword } : {}),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(changingPassword ? "Profil et mot de passe mis à jour." : "Profil mis à jour.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // ----- niveau -----
  const progress = levelProgress(level?.insufficientEvidence ? 0 : level?.score);
  const shownLevel = level?.insufficientEvidence ? "DEBUTANT" : level?.level ?? progress.level;
  const facts = activityFacts(orders, level?.successfulLoginCount ?? 0);
  const tips = level ? levelTips(level.insufficientEvidence ? [] : level.reasonCodes, facts) : [];
  const sec = securityStyle(score?.insufficientEvidence ? null : score?.riskBand);
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 items-start">
      <div className="space-y-4">
        {/* Carte du trader */}
        <CardShell className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg font-semibold shrink-0" style={DISPLAY}>{initials || "?"}</div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground truncate" style={DISPLAY}>{user?.firstName} {user?.lastName}</h3>
              <p className="text-[12px] text-muted-foreground truncate">{user?.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${user?.role === "ADMIN" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{user?.role}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{LEVEL_LABELS[shownLevel] ?? shownLevel}</span>
                <span className="text-[10px] text-muted-foreground px-1 py-0.5">Membre depuis le {memberSince}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <Kpi icon={<Wallet className="w-3.5 h-3.5" />} label="Equity" value={portfolio ? fmt(portfolio.equity) : "—"} />
            <Kpi icon={<TrendingUp className="w-3.5 h-3.5" />} label="Rendement" value={portfolio ? `${portfolio.totalReturnPct >= 0 ? "+" : ""}${portfolio.totalReturnPct}%` : "—"}
              tone={portfolio ? (portfolio.totalReturnPct >= 0 ? "text-emerald-600" : "text-red-500") : undefined} />
            <Kpi label="Ordres passés" value={String(orders.length)} sub={`${facts.protectedOrders} avec SL/TP`} />
            <Kpi label="Positions ouvertes" value={portfolio ? String(portfolio.openPositions) : "—"} sub={portfolio ? `${portfolio.pendingOrders} en attente` : ""} />
          </div>
          <Link to="/trading" className="inline-block mt-4 text-[12px] font-semibold text-blue-600 hover:underline">Aller à la salle de marché →</Link>
        </CardShell>

        {/* Niveau de trader */}
        <CardShell className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Niveau de trader</h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Calculé par un modèle à partir de votre activité et de vos ordres. Il ne change ni le rôle ni l&apos;accès au compte.
              </p>
            </div>
            {level && !level.insufficientEvidence && level.score != null && (
              <span className="text-2xl font-semibold text-foreground shrink-0" style={MONO}>{level.score}<span className="text-xs text-muted-foreground">/100</span></span>
            )}
          </div>
          {levelLoading && <p className="text-xs text-muted-foreground mt-3">Chargement du niveau...</p>}
          {!levelLoading && levelError && <p className="text-xs text-red-600 dark:text-red-400 mt-3">{levelError}</p>}
          {!levelLoading && level && (
            <>
              {/* Echelle des 4 niveaux */}
              <div className="grid grid-cols-4 gap-1.5 mt-4">
                {LEVELS.map((l, i) => {
                  const reached = i < progress.index || (i === progress.index && !level.insufficientEvidence);
                  const current = l === shownLevel;
                  return (
                    <div key={l}>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-2 bg-blue-500 rounded-full" style={{ width: i < progress.index ? "100%" : current ? `${level.insufficientEvidence ? 0 : progress.pctInLevel}%` : "0%" }} />
                      </div>
                      <p className={`text-[10px] mt-1 ${current ? "font-semibold text-foreground" : reached ? "text-muted-foreground" : "text-muted-foreground/60"}`}>{LEVEL_LABELS[l]}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-[12px] text-foreground mt-3">
                {level.insufficientEvidence
                  ? `Activité insuffisante (${level.successfulLoginCount} connexion${level.successfulLoginCount > 1 ? "s" : ""} réussie${level.successfulLoginCount > 1 ? "s" : ""}, il en faut 3). Le compte reste Débutant — aucun niveau n'est inventé.`
                  : progress.next
                    ? `Encore ${progress.pointsToNext} point${progress.pointsToNext > 1 ? "s" : ""} pour atteindre le niveau ${LEVEL_LABELS[progress.next]}.`
                    : "Niveau maximal atteint."}
              </p>
              {!level.insufficientEvidence && level.reasonCodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {level.reasonCodes.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" /> {reasonText(c)}
                    </span>
                  ))}
                </div>
              )}
              {tips.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">Pour progresser</p>
                  <ul className="space-y-2">
                    {tips.map((t) => (
                      <li key={t.code} className="flex items-center gap-2 text-[12px]">
                        {t.done ? <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> : <Circle className="w-3 h-3 text-muted-foreground shrink-0" />}
                        <span className={`flex-1 ${t.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground"}`}>{t.text}</span>
                        {t.code !== "PROFILE_MAINTAINED" && (
                          <span className="text-[11px] text-muted-foreground shrink-0" style={MONO}>{Math.min(t.current, t.target)} / {t.target} {t.unit}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {level.modelVersion && <p className="text-[10px] text-muted-foreground mt-3">Modèle {level.modelVersion}</p>}
            </>
          )}
        </CardShell>

        {/* Score de securite */}
        <CardShell className="p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Score de sécurité des connexions</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 mb-3">
            Indicatif, calculé à partir des évaluations d&apos;anomalies de vos connexions (plus il est bas, mieux c&apos;est). Il ne bloque pas le compte.
          </p>
          {scoreLoading && <p className="text-xs text-muted-foreground">Chargement du score...</p>}
          {!scoreLoading && scoreError && <p className="text-xs text-red-600 dark:text-red-400">{scoreError}</p>}
          {!scoreLoading && !scoreError && !score && <p className="text-xs text-muted-foreground">Aucun score disponible.</p>}
          {!scoreLoading && score && (score.insufficientEvidence ? (
            <p className="text-[12px] text-foreground">
              Preuves insuffisantes ({score.assessmentCount} évaluation{score.assessmentCount > 1 ? "s" : ""} qualifiée{score.assessmentCount > 1 ? "s" : ""}). Au moins 3 connexions évaluées sont nécessaires — aucun score n&apos;est inventé.
            </p>
          ) : (
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">{score.assessmentCount} connexion(s) évaluée(s)</span>
                <span className={`font-medium ${sec.text}`}>{sec.label} ({score.score ?? "—"} / 100)</span>
              </div>
              <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-500/25 via-amber-500/25 to-red-500/25">
                <div className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white ${sec.bar}`}
                  style={{ left: `calc(${Math.min(100, Math.max(0, score.score ?? 0))}% - 6px)` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>0 · faible</span><span>40</span><span>70</span><span>100 · élevé</span></div>
            </div>
          ))}
        </CardShell>
      </div>

      {/* Formulaire */}
      <CardShell className="p-6">
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Mon profil</h3>
        <p className="text-[11px] text-muted-foreground mt-1 mb-5">
          Modifiez votre nom, votre email ou votre mot de passe. Le rôle n&apos;est pas modifiable ici.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Prénom</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nom</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div className="pt-2 space-y-3">
            <p className="text-[11px] text-muted-foreground">Changer le mot de passe (optionnel)</p>
            <PasswordField label="Mot de passe actuel" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
            <PasswordField label="Nouveau mot de passe (6+ caractères)" autoComplete="new-password" value={newPassword} onChange={setNewPassword} showStrength />
            <PasswordField label="Confirmer le nouveau mot de passe" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword}
              invalid={!!confirmPassword && confirmPassword !== newPassword} />
            {newPasswordProblem && confirmPassword && <p className="text-[11px] text-amber-600">{newPasswordProblem}</p>}
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="text-xs text-emerald-700 dark:text-emerald-400">{success}</p>}
          <button disabled={busy} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {busy ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
      </CardShell>
    </div>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon?: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-base font-semibold mt-1 ${tone ?? "text-foreground"}`} style={MONO}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
