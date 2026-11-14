import { useRef, useState, type FormEvent } from "react";
import Recaptcha, { type RecaptchaHandle } from "../../auth/Recaptcha";
import { Link, Navigate, useNavigate } from "react-router";
import { Loader2, ScanFace, ShieldCheck } from "lucide-react";
import { passkeyError, passkeyHostProblem, passkeysSupported } from "../../auth/webauthn";
import { useI18n } from "../../i18n/I18nContext";
import { useAuth } from "../../auth/AuthContext";
import { errorMessage } from "../../api/client";
import AuthLayout, { inputClass, labelClass } from "./AuthLayout";

export default function LoginPage() {
  const { user, login, loginTwoFactor, loginWithPasskey } = useAuth();
  const { t } = useI18n();
  const [pkBusy, setPkBusy] = useState(false);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  // null = serveur pas encore joint (il demarre) : bouton desactive
  const [captchaOn, setCaptchaOn] = useState<boolean | null>(null);
  const captchaRef = useRef<RecaptchaHandle>(null);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await login(email, password, captcha);
      if (next) setChallenge(next);
      else navigate("/");
    } catch (err) {
      setError(errorMessage(err));
      captchaRef.current?.reset(); // un jeton ne sert qu'une fois
    } finally {
      setBusy(false);
    }
  };

  const passkey = async () => {
    setPkBusy(true);
    setError("");
    try {
      await loginWithPasskey();
      navigate("/");
    } catch (err) {
      setError(passkeyError(err));
    } finally {
      setPkBusy(false);
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      await loginTwoFactor(challenge, code);
      navigate("/");
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      if (msg.toLowerCase().includes("expir")) setChallenge(null);
    } finally {
      setBusy(false);
    }
  };

  if (challenge) {
    return (
      <AuthLayout title="Double authentification" subtitle="Saisis le code à 6 chiffres de ton application d'authentification">
        <form onSubmit={submitCode} className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-[12px] text-foreground">
            <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
            Mot de passe correct. Ouvre Google Authenticator (ou équivalent) et recopie le code MarketSim AI.
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={7} required value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              className={`${inputClass} text-center text-lg tracking-[0.4em]`} placeholder="123456" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button disabled={busy || code.replace(/\s/g, "").length !== 6}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {busy ? "Vérification..." : "Valider"}
          </button>
        </form>
        <button onClick={() => { setChallenge(null); setCode(""); setError(""); }}
          className="w-full text-xs text-muted-foreground mt-4 text-center hover:text-foreground">
          Retour à la connexion
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Connexion" subtitle="Accédez à votre portefeuille virtuel">
      {passkeysSupported() && !passkeyHostProblem() && (
        <>
          <button type="button" onClick={passkey} disabled={pkBusy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-60 transition-colors">
            {pkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />} {t("login.passkey")}
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-1.5">{t("login.passkeyHint")}</p>
          <div className="flex items-center gap-3 my-4 text-[11px] text-muted-foreground">
            <span className="flex-1 h-px bg-border" />{t("login.or")}<span className="flex-1 h-px bg-border" />
          </div>
        </>
      )}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass}>Mot de passe</label>
            <Link to="/forgot-password" className="text-[11px] text-blue-600 font-medium mb-1">Mot de passe oublié ?</Link>
          </div>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        <Recaptcha ref={captchaRef} onToken={setCaptcha} onReady={setCaptchaOn} />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {error.toLowerCase().includes("verrouill") && (
          <p className="text-[11px] text-amber-700">Réessayez après la fin du verrouillage temporaire, ou réinitialisez votre mot de passe.</p>
        )}
        <button disabled={busy || captchaOn === null || (captchaOn && !captcha)} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors">
          {busy ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Pas de compte ? <Link to="/register" className="text-blue-600 font-medium">S'inscrire</Link>
      </p>
    </AuthLayout>
  );
}
