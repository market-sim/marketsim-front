import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { authApi } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import AuthLayout, { inputClass, labelClass } from "./AuthLayout";
import PasswordStrength, { passwordProblem } from "../../auth/PasswordStrength";

/** Module 1 : choix du nouveau mot de passe depuis le lien recu par e-mail. */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const weak = passwordProblem(password);
    if (weak) {
      setError(`Mot de passe : ${weak.toLowerCase()}.`);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setDone((await authApi.resetPassword(token, password)).message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Le lien ne fonctionne qu'une fois, pendant 30 minutes">
      {!token ? (
        <p className="text-xs text-red-600">Lien incomplet : ouvre le lien exact reçu par e-mail.</p>
      ) : done ? (
        <div className="flex gap-2 rounded-lg bg-emerald-500/10 px-3 py-3 text-[12.5px] text-foreground">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>{done}</span>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelClass}>Nouveau mot de passe</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <PasswordStrength password={password} />
          </div>
          <div>
            <label className={labelClass}>Confirmer</label>
            <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button disabled={busy} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
            {busy ? "Enregistrement..." : "Changer le mot de passe"}
          </button>
        </form>
      )}
      <p className="text-xs text-muted-foreground mt-4 text-center">
        <Link to="/login" className="text-blue-600 font-medium">Aller à la connexion</Link>
      </p>
    </AuthLayout>
  );
}
