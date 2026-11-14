import { useState } from "react";
import { MailWarning } from "lucide-react";
import { accountApi } from "../api/endpoints";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

/** Rappel tant que l'adresse e-mail n'est pas confirmee (module 1). */
export default function EmailBanner() {
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  if (!user || user.emailConfirmed !== false) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[12px] text-foreground">
      <MailWarning className="w-4 h-4 text-amber-500 shrink-0" />
      <span>Confirme ton adresse e-mail : ouvre le lien envoyé à <b>{user.email}</b>.</span>
      <button onClick={() => accountApi.resendVerification().then((r) => setMsg(r.message)).catch((e) => setMsg(errorMessage(e)))}
        className="ml-auto rounded-md border border-amber-400/60 px-2 py-0.5 text-[11px] font-medium hover:bg-amber-400/20">
        Renvoyer
      </button>
      {msg && <span className="w-full text-[11px] text-muted-foreground">{msg}</span>}
    </div>
  );
}
