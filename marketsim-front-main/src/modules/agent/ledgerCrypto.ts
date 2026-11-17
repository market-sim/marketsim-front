import type { LedgerProof } from "../../api/endpoints";

/**
 * Verification d'une preuve d'audit DANS LE NAVIGATEUR (WebCrypto), sans rien demander au serveur :
 * meme algorithme que le backend (LedgerCrypto.java).
 *   feuille = SHA-256(contenu) ; noeud feuille = H(0x00 || feuille) ; noeud interne = H(0x01 || gauche || droite)
 *   bloc    = SHA-256("BLOCK1|hauteur|hash precedent|racine|nombre|date")
 */

const encoder = new TextEncoder();

const toHex = (bytes: ArrayBuffer | Uint8Array): string =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data as BufferSource));
}

export async function sha256Text(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

export interface MerkleTraceStep {
  siblingHash: string;
  siblingOnLeft: boolean;
  result: string;
}

export interface BrowserVerification {
  /** SHA-256 recalcule du contenu actuel. */
  computedLeafHash: string;
  /** Le contenu actuel correspond a l'empreinte enregistree. */
  contentMatches: boolean;
  trace: MerkleTraceStep[];
  computedRoot: string | null;
  /** Le chemin de Merkle, parti du contenu actuel, mene bien a la racine du bloc. */
  rootMatches: boolean | null;
  computedBlockHash: string | null;
  /** Le hash du bloc recalcule correspond a celui enregistre. */
  blockMatches: boolean | null;
}

export async function verifyInBrowser(proof: LedgerProof): Promise<BrowserVerification> {
  const computedLeafHash = await sha256Text(proof.leafInput);
  const contentMatches = computedLeafHash === proof.leafHash;
  if (!proof.sealed || !proof.merkleRoot || !proof.blockInput) {
    return { computedLeafHash, contentMatches, trace: [], computedRoot: null, rootMatches: null, computedBlockHash: null, blockMatches: null };
  }

  // on part du contenu ACTUEL : s'il a ete modifie, le chemin n'atteindra jamais la racine scellee
  let current = await sha256Bytes(concat(new Uint8Array([0x00]), fromHex(computedLeafHash)));
  const trace: MerkleTraceStep[] = [];
  for (const step of proof.path) {
    const sibling = fromHex(step.hash);
    current = await sha256Bytes(step.left
      ? concat(new Uint8Array([0x01]), sibling, current)
      : concat(new Uint8Array([0x01]), current, sibling));
    trace.push({ siblingHash: step.hash, siblingOnLeft: step.left, result: toHex(current) });
  }
  const computedRoot = toHex(current);
  const computedBlockHash = await sha256Text(proof.blockInput);
  return {
    computedLeafHash, contentMatches, trace, computedRoot,
    rootMatches: computedRoot === proof.merkleRoot,
    computedBlockHash, blockMatches: computedBlockHash === proof.blockHash,
  };
}
