import { useCallback, useEffect, useState } from "react";
import PromptDialog, { type PromptRequest } from "../../shared/PromptDialog";
import ConfirmDialog, { type ConfirmRequest } from "../../shared/ConfirmDialog";
import { Fingerprint, Loader2, Pencil, Plus, ScanFace, Trash2 } from "lucide-react";
import { passkeyApi, type Passkey } from "../../api/endpoints";
import { useI18n } from "../../i18n/I18nContext";
import { CardShell, DISPLAY } from "../../shared/ui";
import {
  createPasskey, guessDeviceName, passkeyError, passkeyHostProblem, passkeysSupported, platformAuthenticatorAvailable,
} from "../../auth/webauthn";

/** Gestion des passkeys : ajouter cet appareil (Face ID, empreinte, Windows Hello), renommer, supprimer. */
export default function PasskeysCard() {
  const { t, lang } = useI18n();
  const [list, setList] = useState<Passkey[]>([]);
  const [name, setName] = useState(guessDeviceName());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sensor, setSensor] = useState<boolean | null>(null);
  const supported = passkeysSupported();
  const hostProblem = passkeyHostProblem();

  const load = useCallback(() => passkeyApi.list().then(setList).catch(() => setList([])), []);
  useEffect(() => {
    load();
    platformAuthenticatorAvailable().then(setSensor);
  }, [load]);

  const when = (iso: string) => new Date(iso).toLocaleDateString(lang === "ar" ? "ar-TN" : lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", year: "numeric" });

  async function add() {
    setMsg(null);
    setBusy(true);
    try {
      const options = await passkeyApi.registrationOptions();
      const cred = await createPasskey(options);
      await passkeyApi.register({ ...cred, name });
      setMsg({ ok: true, text: t("pk.added") });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: passkeyError(e) });
    } finally {
      setBusy(false);
    }
  }

  const [renaming, setRenaming] = useState<PromptRequest | null>(null);
  function rename(p: Passkey) {
    setRenaming({
      title: t("pk.name"), label: t("pk.name"), initialValue: p.name, maxLength: 60,
      onSubmit: async (n) => {
        if (n === p.name) return;
        await passkeyApi.rename(p.id, n).catch((e) => { throw new Error(passkeyError(e)); });
        await load();
      },
    });
  }

  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  function remove(p: Passkey) {
    setConfirmReq({
      title: t("pk.confirmDelete", { name: p.name }),
      description: <p>{p.name}</p>,
      confirmLabel: "Supprimer",
      tone: "danger",
      onConfirm: async () => {
        await passkeyApi.remove(p.id).catch((e) => setMsg({ ok: false, text: passkeyError(e) }));
        await load();
      },
    });
  }

  return (
    <CardShell className="p-5">
      <PromptDialog request={renaming} onClose={() => setRenaming(null)} />
      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
      <div className="flex items-center gap-2 mb-1">
        <ScanFace className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>{t("pk.title")}</h3>
      </div>
      <p className="text-[11.5px] text-muted-foreground mb-3">{t("pk.hint")}</p>

      {!supported || hostProblem ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-300">{hostProblem ?? t("pk.unsupported")}</p>
      ) : (
        <>
          {sensor === false && <p className="text-[11.5px] text-amber-700 dark:text-amber-300 mb-2">{t("pk.noSensor")}</p>}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[200px]">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t("pk.name")}</span>
              <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
            </label>
            <button onClick={add} disabled={busy || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} {t("pk.add")}
            </button>
          </div>
        </>
      )}
      {msg && <p className={`mt-2 text-[12.5px] ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg.text}</p>}

      <div className="mt-3 divide-y divide-border/50">
        {list.length === 0 && <p className="text-[12px] text-muted-foreground py-2">{t("pk.none")}</p>}
        {list.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Fingerprint className="w-4 h-4 text-emerald-600" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground truncate">
                {p.name}
                {p.backedUp && <span className="ms-2 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600">{t("pk.synced")}</span>}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("pk.created", { date: when(p.createdAt) })} · {p.lastUsedAt ? t("pk.lastUsed", { date: when(p.lastUsedAt) }) : t("pk.never")}
              </p>
            </div>
            <button onClick={() => rename(p)} title={t("pk.rename")} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => remove(p)} title={t("pk.delete")} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </CardShell>
  );
}
