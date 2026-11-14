import { useRef, useState, type FormEvent } from "react";
import Recaptcha, { type RecaptchaHandle } from "../../auth/Recaptcha";
import { Link } from "react-router";
import { MailCheck } from "lucide-react";
import { authApi } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import AuthLayout, { inputClass, labelClass } from "./AuthLayout";

/** Module 1 : demande d'un lien de reinitialisation du mot de passe. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  // null = serveur pas encore joint (il demarre) : bouton desactive
  const [captchaOn, setCaptchaOn] = useState<boolean | null>(null);
  const captchaRef = useRef<RecaptchaHandle>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setSent((await authApi.forgotPassword(email, captcha)).message);
    } catch (err) {
      setError(errorMessage(err));
      captchaRef.current?.reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Reçois un lien pour en choisir un nouveau">
      {sent ? (
        <div className="space-y-3">
          <div className="flex gap-2 rounded-lg bg-emerald-500/10 px-3 py-3 text-[12.5px] text-foreground">
            <MailCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{sent}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            En local, sans serveur e-mail, le message arrive dans la « Boîte d'envoi » de l'administrateur et dans la console du backend.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelClass}>Email du compte</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <Recaptcha ref={captchaRef} onToken={setCaptcha} onReady={setCaptchaOn} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button disabled={busy || captchaOn === null || (captchaOn && !captcha)} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
            {busy ? "Envoi..." : "Envoyer le lien"}
          </button>
        </form>
      )}
      <p className="text-xs text-muted-foreground mt-4 text-center">
        <Link to="/login" className="text-blue-600 font-medium">Retour à la connexion</Link>
      </p>
    </AuthLayout>
  );
}
