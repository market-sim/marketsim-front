import { useEffect, useState } from "react";
import { ExternalLink, Mail, RefreshCw, Send } from "lucide-react";
import { adminApi, type MailStatus, type MailView } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY } from "../../shared/ui";

const KIND: Record<string, string> = {
  RESET: "Mot de passe oublié",
  VERIFY: "Confirmation d'e-mail",
  WELCOME: "Compte créé",
  ADMIN_RESET: "Réinitialisation admin",
  SECURITY: "Alerte de sécurité",
  PROGRESS: "Progression",
  TEST: "Test SMTP",
};

const STATUS: Record<string, { label: string; cls: string }> = {
  LOCAL: { label: "non envoyé (local)", cls: "bg-slate-500/10 text-slate-500" },
  PENDING: { label: "en cours…", cls: "bg-amber-500/15 text-amber-600" },
  SENT: { label: "envoyé ✓", cls: "bg-emerald-500/15 text-emerald-600" },
  FAILED: { label: "échec", cls: "bg-red-500/15 text-red-600" },
};

/**
 * Module 1 : e-mails generes par la plateforme. Sans serveur SMTP (projet en local), c'est ici que l'on
 * recupere les liens de reinitialisation et de confirmation pour la demonstration.
 */
export default function AdminOutboxPage() {
  const [mails, setMails] = useState<MailView[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [smtp, setSmtp] = useState<MailStatus | null>(null);
  const [notice, setNotice] = useState("");

  const load = () => adminApi.mailOutbox().then(setMails).catch((e) => setError(errorMessage(e)));
  useEffect(() => {
    load();
    adminApi.mailStatus().then(setSmtp).catch(() => setSmtp(null));
  }, []);

  const test = async () => {
    setNotice("");
    try {
      setNotice((await adminApi.mailTest()).message);
      load();
      window.setTimeout(load, 4000); // l'envoi se fait en arriere-plan
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <CardShell className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
        <Mail className="w-4 h-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Boîte d'envoi</h3>
        <span className="text-[11px] text-muted-foreground">
          50 derniers e-mails · {smtp?.smtpConfigured
            ? <>envoi réel via <b>{smtp.host}:{smtp.port}</b> ({smtp.security}), expéditeur {smtp.from}</>
            : <>aucun serveur SMTP configuré : rien ne part réellement (voir main-backend/config/application.properties.example)</>}
        </span>
        <button onClick={test} className="ms-auto flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-muted/40">
          <Send className="w-3.5 h-3.5" />M'envoyer un e-mail de test
        </button>
        <button onClick={load} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" />Actualiser
        </button>
      </div>
      {error && <p className="px-5 py-3 text-xs text-red-600">{error}</p>}
      {notice && <p className="px-5 py-3 text-xs text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {mails.length === 0 && !error && <p className="px-5 py-6 text-sm text-muted-foreground">Aucun e-mail pour l'instant.</p>}
      <div className="divide-y divide-border/40">
        {mails.map((m) => (
          <div key={m.id} className="px-5 py-3">
            <button onClick={() => setOpen(open === m.id ? null : m.id)} className="w-full flex flex-wrap items-center gap-3 text-left">
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600">{KIND[m.kind] ?? m.kind}</span>
              <span className="text-[13px] font-medium text-foreground">{m.subject}</span>
              <span className="text-[12px] text-muted-foreground">à {m.recipient}</span>
              {m.status && <span title={m.error ?? undefined} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[m.status]?.cls ?? ""}`}>{STATUS[m.status]?.label ?? m.status}</span>}
              <span className="ml-auto text-[11px] text-muted-foreground">{new Date(m.createdAt).toLocaleString("fr-FR")}</span>
            </button>
            {open === m.id && (
              <div className="mt-2 rounded-lg bg-muted/30 p-3">
                <pre className="whitespace-pre-wrap text-[12px] text-foreground font-sans">{m.body}</pre>
                {m.error && <p className="mt-2 text-[12px] text-red-600">Erreur SMTP : {m.error}</p>}
                {m.actionUrl && (
                  <a href={m.actionUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" />Ouvrir le lien
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  );
}
