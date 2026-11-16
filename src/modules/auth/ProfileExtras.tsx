import { useEffect, useRef, useState } from "react";
import PromptDialog, { type PromptRequest } from "../../shared/PromptDialog";
import { Camera, Check, Copy, ExternalLink, Globe, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { profileApi, type Language, type Preferences, type PreferencesUpdate, type ThemePref, type TraderCard } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import UserAvatar from "../../auth/UserAvatar";
import { useI18n } from "../../i18n/I18nContext";
import { useTheme } from "../../theme/ThemeContext";
import { CardShell, DISPLAY } from "../../shared/ui";
import TraderCardView, { publicCardUrl } from "./TraderCardView";

/** Recadre l'image au centre en carre 512 px (JPEG) avant l'envoi : rapide a envoyer, le serveur finit le travail. */
function cropToSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas indisponible"));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    img.src = url;
  });
}

const LANGS: { id: Language; label: string; flag: string }[] = [
  { id: "fr", label: "Français", flag: "🇫🇷" },
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "ar", label: "العربية", flag: "🇹🇳" },
];

/** Photo de profil, preferences enregistrees sur le serveur et carte de trader publique. */
export default function ProfileExtras() {
  const { user, setAvatar } = useAuth();
  const { t, setLang, prefs, setPrefs } = useI18n();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prefMsg, setPrefMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [card, setCard] = useState<TraderCard | null>(null);
  const [bio, setBio] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    profileApi.myCard().then(setCard).catch(() => setCard(null));
  }, [prefs?.publicProfile, prefs?.publicId, prefs?.bio, user?.avatarUrl]);
  useEffect(() => setBio(prefs?.bio ?? ""), [prefs?.bio]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoMsg(null);
    if (file.size > 15 * 1024 * 1024) return setPhotoMsg({ ok: false, text: "Image trop lourde" });
    setPhotoBusy(true);
    try {
      const data = await cropToSquare(file);
      const res = await profileApi.uploadAvatar(data);
      setAvatar(res.avatarUrl);
      setPhotoMsg({ ok: true, text: t("profile.photoSaved") });
    } catch (e) {
      setPhotoMsg({ ok: false, text: e instanceof Error && !("response" in e) ? e.message : errorMessage(e) });
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await profileApi.deleteAvatar();
      setAvatar(null);
    } catch (e) {
      setPhotoMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(update: PreferencesUpdate) {
    setPrefMsg(null);
    try {
      const p: Preferences = await profileApi.updatePreferences(update);
      setPrefs(p);
      setPrefMsg({ ok: true, text: t("profile.saved") });
    } catch (e) {
      setPrefMsg({ ok: false, text: errorMessage(e) });
    }
  }

  async function newLink() {
    try {
      setPrefs(await profileApi.newPublicLink());
    } catch (e) {
      setPrefMsg({ ok: false, text: errorMessage(e) });
    }
  }

  const [linkDialog, setLinkDialog] = useState<PromptRequest | null>(null);
  async function copy() {
    if (!prefs) return;
    try {
      await navigator.clipboard.writeText(publicCardUrl(prefs.publicId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // presse-papiers refuse (HTTP, permission) : on montre le lien a copier a la main
      setLinkDialog({ title: t("profile.copyLink"), label: t("profile.copyLink"), initialValue: publicCardUrl(prefs.publicId), readOnly: true });
    }
  }

  const toggle = (key: keyof PreferencesUpdate, label: string) => (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
      <span className="text-[13px] text-foreground">{label}</span>
      <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={!!prefs?.[key as keyof Preferences]}
        onChange={(e) => save({ [key]: e.target.checked } as PreferencesUpdate)} />
    </label>
  );

  return (
    <div className="space-y-4">
      <PromptDialog request={linkDialog} onClose={() => setLinkDialog(null)} />
      {/* photo */}
      <CardShell className="p-6">
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>{t("profile.photo")}</h3>
        <div className="flex items-center gap-4 mt-3">
          <div className="relative">
            <UserAvatar firstName={user?.firstName} lastName={user?.lastName} avatarUrl={user?.avatarUrl} size={80} />
            {photoBusy && <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white animate-spin" /></div>}
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">{t("profile.photoHint")}</p>
            <div className="flex gap-2 mt-2.5">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                <Camera className="w-3.5 h-3.5" /> {t("profile.choosePhoto")}
              </button>
              {user?.avatarUrl && (
                <button type="button" onClick={removePhoto} disabled={photoBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted/50">
                  <Trash2 className="w-3.5 h-3.5" /> {t("profile.removePhoto")}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
              onChange={(e) => pickPhoto(e.target.files?.[0])} aria-label={t("profile.choosePhoto")} />
            {photoMsg && <p className={`text-xs mt-2 ${photoMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{photoMsg.text}</p>}
          </div>
        </div>
      </CardShell>

      {/* preferences */}
      <CardShell className="p-6">
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>{t("profile.prefs")}</h3>
        <p className="text-[11px] text-muted-foreground mt-1">{t("profile.prefsHint")}</p>
        {!prefs ? (
          <p className="text-xs text-muted-foreground mt-3">…</p>
        ) : (
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t("profile.language")}</p>
              <div className="flex gap-1.5">
                {LANGS.map((l) => (
                  <button key={l.id} type="button" onClick={() => setLang(l.id)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-[13px] ${prefs.language === l.id ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15 font-semibold" : "border-border hover:bg-muted/40"}`}>
                    {l.flag} {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t("profile.theme")}</p>
              <div className="flex gap-1.5">
                {(["light", "dark", "system"] as ThemePref[]).map((th) => (
                  <button key={th} type="button" onClick={() => setTheme(th)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-[13px] ${theme === th ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15 font-semibold" : "border-border hover:bg-muted/40"}`}>
                    {t(`profile.theme.${th}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{t("profile.notifications")}</p>
              {toggle("inAppSecurity", t("profile.inAppSecurity"))}
              {toggle("inAppProgress", t("profile.inAppProgress"))}
              {toggle("emailSecurity", t("profile.emailSecurity"))}
              {toggle("emailProgress", t("profile.emailProgress"))}
            </div>
            {prefMsg && <p className={`text-xs ${prefMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{prefMsg.text}</p>}
          </div>
        )}
      </CardShell>

      {/* carte de trader */}
      <CardShell className="p-6">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5" style={DISPLAY}><Globe className="w-4 h-4" /> {t("profile.card")}</h3>
        <p className="text-[11px] text-muted-foreground mt-1">{t("profile.cardHint")}</p>
        {prefs && (
          <div className="mt-3 space-y-3">
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <span>
                <span className="block text-[13px] font-medium text-foreground">{t("profile.public")}</span>
                <span className="block text-[11px] text-muted-foreground">{t("profile.publicHint")}</span>
              </span>
              <input type="checkbox" className="w-4 h-4 mt-1 accent-blue-600" checked={prefs.publicProfile}
                onChange={(e) => save({ publicProfile: e.target.checked })} />
            </label>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("profile.bio")}</label>
              <div className="flex gap-2 mt-1">
                <input value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} placeholder={t("profile.bioPlaceholder")}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
                <button type="button" onClick={() => save({ bio })} disabled={bio === (prefs.bio ?? "")}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40">{t("profile.save")}</button>
              </div>
            </div>
            {prefs.publicProfile && (
              <div className="flex flex-wrap gap-2">
                <code className="flex-1 min-w-0 truncate rounded-lg bg-muted/60 px-3 py-2 text-[12px]">{publicCardUrl(prefs.publicId)}</code>
                <button type="button" onClick={copy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted/50">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? t("profile.copied") : t("profile.copyLink")}
                </button>
                <a href={publicCardUrl(prefs.publicId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted/50">
                  <ExternalLink className="w-3.5 h-3.5" /> {t("profile.open")}
                </a>
                <button type="button" onClick={newLink} title={t("profile.newLink")} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted/50">
                  <RefreshCw className="w-3.5 h-3.5" /> {t("profile.newLink")}
                </button>
              </div>
            )}
            {card && <div className="flex justify-center pt-1"><TraderCardView card={card} /></div>}
          </div>
        )}
      </CardShell>
    </div>
  );
}
