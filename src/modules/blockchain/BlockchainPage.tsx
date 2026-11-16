import { Info, ShieldCheck } from "lucide-react";
import { CardShell, DISPLAY } from "../../shared/ui";
import AuditPanel from "../agent/components/AuditPanel";

/**
 * Registre d'audit (chaine de hachage HMAC) : vrais blocs du backend ({@code /api/ledger}), verification de la chaine
 * et preuve de Merkle de chaque enregistrement. Ce n'est PAS encore une blockchain publique (voir la note).
 */
export default function BlockchainPage() {
  return (
    <div className="space-y-5">
      <CardShell className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground" style={DISPLAY}>Registre d&apos;audit (chaîne de hachage HMAC)</h2>
            <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
              Chaque décision et simulation de l&apos;IA est figée (SHA-256), regroupée en blocs (arbre de Merkle) et chaque bloc
              est scellé par un HMAC et chaîné au précédent. Toute modification après coup casse la vérification.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-800 dark:text-amber-200">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <b>Ce n&apos;est pas encore une blockchain publique.</b> Le registre est tenu par le serveur de MarketSim : il prouve
            l&apos;intégrité des enregistrements, mais l&apos;ancrage sur un réseau public (Ethereum Sepolia) ou un réseau
            permissionné (Hyperledger Fabric) prévu par le cahier du projet n&apos;est pas encore réalisé. Pas de certificats NFT pour l&apos;instant.
          </p>
        </div>
      </CardShell>

      <AuditPanel />
    </div>
  );
}
