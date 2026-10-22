import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { authApi, type SecurityScore } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY } from "../../shared/ui";
import { inputClass, labelClass } from "./AuthLayout";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<SecurityScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [scoreError, setScoreError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setScoreLoading(true);
    setScoreError("");
    authApi.mySecurityScore()
      .then((data) => {
        if (!cancelled) setScore(data);
      })
      .catch((err) => {
        if (!cancelled) setScoreError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setScoreLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("Le prénom et le nom ne peuvent pas être vides.");
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Email invalide.");
      return;
    }
    const changingPassword = currentPassword !== "" || newPassword !== "";
    if (changingPassword && (currentPassword === "" || newPassword === "")) {
      setError("Le mot de passe actuel et le nouveau mot de passe sont requis.");
      return;
    }
    if (changingPassword && newPassword.length < 6) {
      setError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
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
      setSuccess("Profil mis à jour.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
    <CardShell className="p-6">
      <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Score de sécurité</h3>
      <p className="text-[11px] text-muted-foreground mt-1 mb-3">
        Indicatif, calculé seulement à partir des évaluations de connexion. Il ne bloque pas le compte.
      </p>
      {scoreLoading && <p className="text-xs text-muted-foreground">Chargement du score...</p>}
      {!scoreLoading && scoreError && <p className="text-xs text-red-600 dark:text-red-400">{scoreError}</p>}
      {!scoreLoading && !scoreError && !score && (
        <p className="text-xs text-muted-foreground">Aucun score disponible.</p>
      )}
      {!scoreLoading && score && (
        <div className="text-[12px] text-foreground space-y-1">
          {score.insufficientEvidence ? (
            <p>Preuves insuffisantes ({score.assessmentCount} évaluation{score.assessmentCount > 1 ? "s" : ""} qualifiée{score.assessmentCount > 1 ? "s" : ""}). Au moins 3 connexions évaluées sont nécessaires — aucun score n&apos;est inventé.</p>
          ) : (
            <p>Score {score.score ?? "—"} · bande {score.riskBand ?? "—"} · {score.assessmentCount} évaluations</p>
          )}
        </div>
      )}
    </CardShell>
    <CardShell className="p-6">
      <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Mon profil</h3>
      <p className="text-[11px] text-muted-foreground mt-1 mb-5">
        Modifiez votre nom, votre email ou votre mot de passe. Le rôle n'est pas modifiable ici.
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
        <div className="pt-2">
          <p className="text-[11px] text-muted-foreground mb-2">Changer le mot de passe (optionnel)</p>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Mot de passe actuel</label>
              <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nouveau mot de passe (6+ caractères)</label>
              <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
            </div>
          </div>
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
