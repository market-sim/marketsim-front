import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { authApi } from "../api/endpoints";

declare global {
  interface Window {
    grecaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      reset: (id?: number) => void;
      ready: (cb: () => void) => void;
    };
    __marketsimRecaptchaLoad?: () => void;
  }
}

export interface RecaptchaHandle {
  /** a appeler apres chaque envoi : un jeton reCAPTCHA ne sert qu'une fois */
  reset: () => void;
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.grecaptcha?.render) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      window.__marketsimRecaptchaLoad = () => resolve();
      const s = document.createElement("script");
      s.src = "https://www.google.com/recaptcha/api.js?onload=__marketsimRecaptchaLoad&render=explicit&hl=fr";
      s.async = true;
      s.defer = true;
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("reCAPTCHA indisponible"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

type Config = { enabled: boolean; siteKey: string | null };
let cachedConfig: Config | null = null;

/**
 * Lit la configuration aupres du serveur ; tant que le backend demarre (injoignable), on reessaie toutes les
 * 3 secondes au lieu de conclure qu'il n'y a pas de reCAPTCHA.
 */
async function loadConfig(isCancelled: () => boolean, onWaiting: () => void): Promise<Config | null> {
  if (cachedConfig) return cachedConfig;
  for (;;) {
    try {
      cachedConfig = await authApi.captchaConfig();
      return cachedConfig;
    } catch {
      if (isCancelled()) return null;
      onWaiting();
      await new Promise((r) => setTimeout(r, 3000));
      if (isCancelled()) return null;
    }
  }
}

/**
 * Case Google reCAPTCHA v2 « Je ne suis pas un robot » (module 1). onToken recoit le jeton a envoyer au serveur ;
 * onChange(null) quand il expire. Si le serveur n'a pas de cle, rien n'est affiche et onReady(false) est appele.
 */
const Recaptcha = forwardRef<RecaptchaHandle, { onToken: (token: string | null) => void; onReady?: (enabled: boolean) => void }>(
  // onReady n'est appele qu'une fois le serveur joint : avant, le bouton du formulaire reste desactive
  function Recaptcha({ onToken, onReady }, ref) {
    const box = useRef<HTMLDivElement>(null);
    const widget = useRef<number | null>(null);
    const [error, setError] = useState("");
    const [waiting, setWaiting] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const cb = useRef(onToken);
    cb.current = onToken;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widget.current != null) window.grecaptcha?.reset(widget.current);
        cb.current(null);
      },
    }));

    useEffect(() => {
      let cancelled = false;
      loadConfig(() => cancelled, () => setWaiting(true)).then(async (cfg) => {
        if (cancelled || !cfg) return;
        setWaiting(false);
        setEnabled(cfg.enabled && !!cfg.siteKey);
        onReady?.(cfg.enabled);
        if (!cfg.enabled || !cfg.siteKey) return;
        await new Promise((r) => setTimeout(r, 0)); // laisse React afficher le cadre avant d'y dessiner la case
        try {
          await loadScript();
        } catch {
          if (!cancelled) setError("La case anti-robot n'a pas pu être chargée (connexion à Google impossible).");
          return;
        }
        if (cancelled || !box.current || widget.current != null) return;
        const dark = document.documentElement.classList.contains("dark");
        widget.current = window.grecaptcha!.render(box.current, {
          sitekey: cfg.siteKey,
          theme: dark ? "dark" : "light",
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      });
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div>
        {waiting && (
          <p className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-[12px] text-foreground">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            Démarrage du serveur… la page continue dès qu'il répond (1 à 2 minutes après un lancement).
          </p>
        )}
        {!waiting && enabled && (
          <div className="rounded-xl border border-border/70 bg-muted/30 px-3 pt-2.5 pb-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />Vérification de sécurité
            </p>
            {/* la case de Google (iframe) : on la centre et on lui laisse sa taille d'origine (304 x 78) */}
            <div className="flex justify-center overflow-hidden rounded-[3px]">
              <div ref={box} className="min-h-[78px]" />
            </div>
          </div>
        )}
        {error && <p className="text-[11px] text-amber-600 mt-1">{error}</p>}
      </div>
    );
  },
);

export default Recaptcha;
