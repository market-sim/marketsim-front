import { useEffect, useState, type FormEvent } from "react";
import { adminApi, type GlobalUserSettings } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY } from "../../shared/ui";
import { inputClass, labelClass } from "../auth/AuthLayout";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<GlobalUserSettings | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [maxFailedLoginAttempts, setMaxFailedLoginAttempts] = useState(5);
  const [lockDurationMinutes, setLockDurationMinutes] = useState(15);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = (s: GlobalUserSettings) => {
    setSettings(s);
    setRegistrationEnabled(s.registrationEnabled);
    setMaxFailedLoginAttempts(s.maxFailedLoginAttempts);
    setLockDurationMinutes(s.lockDurationMinutes);
  };

  const load = () =>
    adminApi.getUserSettings()
      .then(apply)
      .catch((e) => setError(errorMessage(e)));

  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setError("");
    setSuccess("");

    if (maxFailedLoginAttempts < 3 || maxFailedLoginAttempts > 10) {
      setError("Le seuil d'échecs doit être entre 3 et 10.");
      return;
    }
    if (lockDurationMinutes < 1 || lockDurationMinutes > 60) {
      setError("La durée de verrouillage doit être entre 1 et 60 minutes.");
      return;
    }

    setBusy(true);
    try {
      const updated = await adminApi.updateUserSettings({
        registrationEnabled,
        maxFailedLoginAttempts,
        lockDurationMinutes,
        version: settings.version,
      });
      apply(updated);
      setSuccess("Paramètres enregistrés.");
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      if (msg.toLowerCase().includes("rechargez") || msg.toLowerCase().includes("ailleurs")) {
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell className="max-w-lg p-6">
      <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Paramètres utilisateurs</h3>
      <p className="text-[11px] text-muted-foreground mt-1 mb-5">
        Inscriptions, seuil d'échecs de connexion et durée de verrouillage temporaire.
      </p>
      {!settings && !error && <p className="text-xs text-muted-foreground">Chargement...</p>}
      {settings && (
        <form onSubmit={submit} className="space-y-4">
          <label className="flex items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={registrationEnabled}
              onChange={(e) => setRegistrationEnabled(e.target.checked)}
              className="rounded border-border"
            />
            Autoriser les nouvelles inscriptions
          </label>
          <div>
            <label className={labelClass}>Échecs de connexion max (3–10)</label>
            <input
              type="number"
              min={3}
              max={10}
              value={maxFailedLoginAttempts}
              onChange={(e) => setMaxFailedLoginAttempts(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Durée de verrouillage (1–60 min)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={lockDurationMinutes}
              onChange={(e) => setLockDurationMinutes(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Version {settings.version} · mis à jour {new Date(settings.updatedAt).toLocaleString()}
          </p>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="text-xs text-emerald-700 dark:text-emerald-400">{success}</p>}
          <button
            disabled={busy}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {busy ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
      )}
      {!settings && error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </CardShell>
  );
}
