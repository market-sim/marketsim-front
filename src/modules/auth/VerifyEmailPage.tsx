import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { authApi } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import AuthLayout from "./AuthLayout";

/** Module 1 : confirmation de l'adresse e-mail depuis le lien recu a l'inscription. */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (!token) {
      setState({ ok: false, text: "Lien incomplet : ouvre le lien exact reçu par e-mail." });
      return;
    }
    authApi.verifyEmail(token)
      .then((r) => {
        setState({ ok: true, text: r.message });
        refreshUser().catch(() => { /* non connecte */ });
      })
      .catch((e) => setState({ ok: false, text: errorMessage(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthLayout title="Confirmation de l'e-mail" subtitle="MarketSim AI">
      {!state ? (
        <p className="text-sm text-muted-foreground">Vérification en cours...</p>
      ) : (
        <div className={`flex gap-2 rounded-lg px-3 py-3 text-[12.5px] text-foreground ${state.ok ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
          {state.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
          <span>{state.text}</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-4 text-center">
        <Link to={user ? "/" : "/login"} className="text-blue-600 font-medium">{user ? "Retour à l'application" : "Aller à la connexion"}</Link>
      </p>
    </AuthLayout>
  );
}
