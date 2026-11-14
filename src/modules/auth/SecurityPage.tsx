import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, KeyRound, LogOut, MonitorSmartphone, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { accountApi, type AccountStatus, type SessionView } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { CardShell, DISPLAY, MONO } from "../../shared/ui";
import { inputClass, labelClass } from "./AuthLayout";
import PasskeysCard from "./PasskeysCard";

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** Module 1 : securite du compte — sessions actives, double authentification, donnees personnelles. */
export default function SecurityPage() {
  const { user, logout, refreshUser } = useAuth();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    accountApi.status().then(setStatus).catch((e) => setError(errorMessage(e)));
    accountApi.sessions().then(setSessions).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<{ message: string } | void>) => {
    setError("");
    setNotice("");
    try {
      const r = await fn();
      if (r && "message" in r) setNotice(r.message);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {notice && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[12.5px] text-foreground">{notice}</p>}
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-600 dark:text-red-400">{error}</p>}


      <CardShell className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <MonitorSmartphone className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Appareils connectés</h3>
          <span className="text-[11px] text-muted-foreground">{sessions.length} session(s) active(s)</span>
          {sessions.length > 1 && (
            <button onClick={() => run(() => accountApi.revokeOthers())} className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40">
              Déconnecter les autres appareils
            </button>
          )}
        </div>
        <p className="text-[11.5px] text-muted-foreground mb-3">Un appareil inconnu ? Déconnecte-le puis change ton mot de passe.</p>
        <div className="divide-y divide-border/50">
          {sessions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="flex-1 min-w-[220px]">
                <p className="text-[13px] font-medium text-foreground">
                  {s.device ?? "Appareil inconnu"}
                  {s.current && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">cet appareil</span>}
                </p>
                <p className="text-[11px] text-muted-foreground" style={MONO}>
                  {s.ipAddress ?? "—"} · connecté le {when(s.createdAt)} · vu le {when(s.lastSeenAt)}
                </p>
              </div>
              {s.current ? (
                <button onClick={logout} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
                  <LogOut className="w-3.5 h-3.5" />Se déconnecter
                </button>
              ) : (
                <button onClick={() => run(() => accountApi.revokeSession(s.id))} className="text-[12px] font-medium text-red-600 hover:underline">
                  Déconnecter
                </button>
              )}
            </div>
          ))}
        </div>
      </CardShell>

      <PasskeysCard />

      <TwoFactorCard enabled={!!status?.twoFactorEnabled} onChange={() => { load(); refreshUser().catch(() => {}); }} />

      <CardShell className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Mes données personnelles</h3>
        </div>
        <p className="text-[11.5px] text-muted-foreground mb-3">
          Télécharge tout ce que MarketSim AI sait de toi (profil, portefeuille, parties, agents, sessions, journal d'activité), ou supprime ton compte.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => run(async () => {
            const data = await accountApi.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `marketsim-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            return { message: "Export téléchargé." };
          })} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
            <Download className="w-3.5 h-3.5" />Télécharger mes données (JSON)
          </button>
        </div>
        <DeleteAccount onDeleted={logout} />
      </CardShell>
    </div>
  );
}

function TwoFactorCard({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () => act(async () => {
    const s = await accountApi.setupTwoFactor();
    // le QR code est dessine dans le navigateur : le secret n'est envoye a aucun service exterieur
    setSetup({ secret: s.secret, qr: await QRCode.toDataURL(s.otpauthUri, { margin: 1, width: 200 }) });
  });

  return (
    <CardShell className="p-5">
      <div className="flex items-center gap-2 mb-1">
        {enabled ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : <ShieldOff className="w-4 h-4 text-muted-foreground" />}
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Double authentification</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
          {enabled ? "activée" : "désactivée"}
        </span>
      </div>
      <p className="text-[11.5px] text-muted-foreground mb-3">
        À chaque connexion, un code à 6 chiffres de ton téléphone (Google Authenticator, Microsoft Authenticator, Authy) est demandé en plus du mot de passe.
      </p>
      {msg && <p className="text-[12px] text-emerald-600 mb-2">{msg}</p>}
      {error && <p className="text-[12px] text-red-600 mb-2">{error}</p>}

      {!enabled && !setup && (
        <button onClick={start} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          Activer la double authentification
        </button>
      )}

      {!enabled && setup && (
        <div className="flex flex-wrap gap-5 items-start">
          <img src={setup.qr} alt="QR code à scanner" className="w-[180px] h-[180px] rounded-lg border border-border bg-white p-1" />
          <div className="flex-1 min-w-[240px] space-y-2">
            <p className="text-[12px] text-foreground">1. Scanne ce QR code avec ton application d'authentification.</p>
            <p className="text-[11px] text-muted-foreground">Ou saisis la clé à la main : <span className="text-foreground break-all" style={MONO}>{setup.secret}</span></p>
            <p className="text-[12px] text-foreground">2. Saisis le code affiché pour confirmer :</p>
            <div className="flex gap-2">
              <input inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
                className={`${inputClass} w-36 text-center tracking-[0.3em]`} placeholder="123456" />
              <button disabled={busy || code.replace(/\s/g, "").length !== 6}
                onClick={() => act(async () => {
                  await accountApi.enableTwoFactor(code);
                  setSetup(null);
                  setCode("");
                  setMsg("Double authentification activée : elle sera demandée à ta prochaine connexion.");
                  onChange();
                })}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {enabled && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass}>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} w-48`} />
          </div>
          <div>
            <label className={labelClass}>Code actuel</label>
            <input inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              className={`${inputClass} w-32 text-center tracking-[0.3em]`} />
          </div>
          <button disabled={busy || !password || code.replace(/\s/g, "").length !== 6}
            onClick={() => act(async () => {
              await accountApi.disableTwoFactor(password, code);
              setPassword("");
              setCode("");
              setMsg("Double authentification désactivée.");
              onChange();
            })}
            className="rounded-lg border border-red-400 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-60">
            Désactiver
          </button>
        </div>
      )}
    </CardShell>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-red-600 hover:underline">
        <Trash2 className="w-3.5 h-3.5" />Supprimer mon compte
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-lg border border-red-400/50 bg-red-500/5 p-3 space-y-2">
      <p className="text-[12px] text-foreground">
        Ton nom, ton e-mail, ton mot de passe et ta double authentification seront effacés, et toutes tes sessions déconnectées.
        <b> C'est définitif.</b> Tes parties restent dans les statistiques, sous un compte anonyme.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className={labelClass}>Confirme avec ton mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} w-56`} />
        </div>
        <button disabled={busy || !password} onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await accountApi.deleteAccount(password);
            onDeleted();
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
          }
        }} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
          Supprimer définitivement
        </button>
        <button onClick={() => { setOpen(false); setPassword(""); }} className="px-2 py-2 text-xs text-muted-foreground">Annuler</button>
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
