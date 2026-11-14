/**
 * Passkeys (WebAuthn) cote navigateur : Face ID, Touch ID, empreinte Android, Windows Hello ou cle de securite.
 * Le serveur envoie les options en base64url ; on les convertit en octets pour navigator.credentials, puis on
 * renvoie la reponse de l'appareil en base64url. La cle privee ne quitte jamais l'appareil.
 */

export function b64urlToBytes(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function bytesToB64url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Le navigateur sait-il utiliser les passkeys ? */
export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

/** Les passkeys exigent un vrai nom de domaine : « localhost » marche, une adresse IP (127.0.0.1) non. */
export function passkeyHostProblem(): string | null {
  const h = location.hostname;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) {
    return `Les passkeys ne marchent pas avec une adresse IP. Ouvre http://localhost:${location.port || "5173"}`;
  }
  if (location.protocol !== "https:" && h !== "localhost") return "Les passkeys exigent HTTPS (ou localhost).";
  return null;
}

/** Un capteur de l'appareil (visage, empreinte, Windows Hello) est-il disponible ? */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return passkeysSupported() && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Nom propose par defaut pour la passkey, d'apres l'appareil. */
export function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone (Face ID / Touch ID)";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Téléphone Android";
  if (/Mac OS X/.test(ua)) return "Mac (Touch ID)";
  if (/Windows/.test(ua)) return "PC Windows Hello";
  return "Mon appareil";
}

/** Message clair a partir d'une erreur du navigateur. */
export function passkeyError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError") return "Opération annulée ou délai dépassé.";
  if (name === "InvalidStateError") return "Cet appareil a déjà une passkey pour ce compte.";
  if (name === "SecurityError") return passkeyHostProblem() ?? "Le navigateur a refusé l'opération pour une raison de sécurité.";
  if (name === "NotSupportedError") return "Ton appareil ne prend pas en charge ce type de passkey.";
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (status === 404) {
    return "Le serveur tourne encore avec une ancienne version (sans passkeys). Ferme les fenêtres du backend et relance Lancer-MarketSim.bat.";
  }
  const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return msg ?? (e as Error)?.message ?? "Erreur inattendue";
}

type Json = Record<string, unknown>;

/** Cree une passkey a partir des options du serveur. */
export async function createPasskey(options: Json) {
  const user = options.user as Json;
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: b64urlToBytes(options.challenge as string),
    user: { ...(user as unknown as PublicKeyCredentialUserEntity), id: b64urlToBytes(user.id as string) },
    excludeCredentials: ((options.excludeCredentials as Json[]) ?? []).map((c) => ({
      type: "public-key" as const,
      id: b64urlToBytes(c.id as string),
    })),
  };
  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Aucune passkey créée");
  const res = cred.response as AuthenticatorAttestationResponse;
  return {
    id: cred.id,
    clientDataJSON: bytesToB64url(res.clientDataJSON),
    attestationObject: bytesToB64url(res.attestationObject),
    transports: typeof res.getTransports === "function" ? res.getTransports() : [],
  };
}

/** Signe le defi de connexion avec une passkey de l'appareil (l'utilisateur choisit son compte). */
export async function getPasskeyAssertion(options: Json) {
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: b64urlToBytes(options.challenge as string),
    rpId: options.rpId as string,
    timeout: options.timeout as number,
    userVerification: "required",
    allowCredentials: [],
  };
  const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Aucune passkey choisie");
  const res = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    clientDataJSON: bytesToB64url(res.clientDataJSON),
    authenticatorData: bytesToB64url(res.authenticatorData),
    signature: bytesToB64url(res.signature),
    userHandle: res.userHandle ? bytesToB64url(res.userHandle) : null,
  };
}
