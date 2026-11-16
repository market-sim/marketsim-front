import { useEffect, useRef, useState, type FormEvent } from "react";
import Recaptcha, { type RecaptchaHandle } from "../../auth/Recaptcha";
import PasswordStrength, { passwordProblem } from "../../auth/PasswordStrength";
import { Link, Navigate, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { authApi } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import AuthLayout, { inputClass, labelClass } from "./AuthLayout";
import PasswordField from "./PasswordField";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  // null = serveur pas encore joint (il demarre) : bouton desactive
  const [captchaOn, setCaptchaOn] = useState<boolean | null>(null);
  const captchaRef = useRef<RecaptchaHandle>(null);

  useEffect(() => {
    if (user) return;
    authApi.registrationStatus()
      .then((s) => setRegistrationEnabled(s.registrationEnabled))
      .catch(() => setRegistrationEnabled(true));
  }, [user]);

  if (user) return <Navigate to="/" replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // politique de main (8 caracteres, une lettre, un chiffre : identique au backend), puis confirmation
    const weak = passwordProblem(form.password);
    if (weak) {
      setError(`Mot de passe : ${weak.toLowerCase()}.`);
      return;
    }
    if (form.password !== confirmPassword) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setBusy(true);
    setError("");
    try {
      await register(form, captcha);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
      captchaRef.current?.reset();
    } finally {
      setBusy(false);
    }
  };

  const closed = registrationEnabled === false;

  return (
    <AuthLayout title="Inscription" subtitle="100 000 $ virtuels offerts pour commencer">
      {closed ? (
        <div className="space-y-3">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Les inscriptions sont temporairement désactivées par l'administrateur. Les comptes existants peuvent toujours se connecter.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            <Link to="/login" className="text-blue-600 font-medium">Se connecter</Link>
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Prénom</label>
                <input required value={form.firstName} onChange={set("firstName")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Nom</label>
                <input required value={form.lastName} onChange={set("lastName")} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" required value={form.email} onChange={set("email")} className={inputClass} />
            </div>
            <div>
              <PasswordField label="Mot de passe (8+ caractères, une lettre et un chiffre)" autoComplete="new-password" required
                value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} />
              <PasswordStrength password={form.password} />
            </div>
            <PasswordField label="Confirmer le mot de passe" autoComplete="new-password" required
              value={confirmPassword} onChange={setConfirmPassword} invalid={!!confirmPassword && confirmPassword !== form.password} />
            {confirmPassword && confirmPassword !== form.password && (
              <p className="-mt-2 text-[11px] text-red-600">Les deux mots de passe ne correspondent pas.</p>
            )}
            <Recaptcha ref={captchaRef} onToken={setCaptcha} onReady={setCaptchaOn} />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button disabled={busy || registrationEnabled === null || captchaOn === null || (captchaOn && !captcha)} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {busy ? "Création..." : "Créer mon compte"}
            </button>
          </form>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Déjà inscrit ? <Link to="/login" className="text-blue-600 font-medium">Se connecter</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
