import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { errorMessage } from "../../api/client";
import AuthLayout, { inputClass, labelClass } from "./AuthLayout";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Connexion" subtitle="Accédez à votre portefeuille virtuel">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Mot de passe</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {error.toLowerCase().includes("verrouill") && (
          <p className="text-[11px] text-amber-700">Réessayez après la fin du verrouillage temporaire.</p>
        )}
        <button disabled={busy} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors">
          {busy ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Pas de compte ? <Link to="/register" className="text-blue-600 font-medium">S'inscrire</Link>
      </p>
    </AuthLayout>
  );
}
