import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { errorMessage } from "../../api/client";
import AuthLayout, { inputClass, labelClass } from "./AuthLayout";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Inscription" subtitle="100 000 $ virtuels offerts pour commencer">
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
          <label className={labelClass}>Mot de passe (6+ caractères)</label>
          <input type="password" required minLength={6} value={form.password} onChange={set("password")} className={inputClass} />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button disabled={busy} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors">
          {busy ? "Création..." : "Créer mon compte"}
        </button>
      </form>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Déjà inscrit ? <Link to="/login" className="text-blue-600 font-medium">Se connecter</Link>
      </p>
    </AuthLayout>
  );
}
