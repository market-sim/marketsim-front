import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api/client";

/** Version de l'API attendue par ce frontend (doit egaler VersionController.API_LEVEL cote serveur). */
export const EXPECTED_API_LEVEL = 8;

/**
 * Bandeau affiche quand le serveur qui tourne est plus ancien que le frontend (les nouvelles pages
 * renverraient sinon « No static resource ... »). Il suffit de relancer Lancer-MarketSim.bat.
 */
export default function ServerVersionBanner() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () =>
      api.get<{ apiLevel: number }>("/public/version")
        .then((r) => alive && setOutdated(r.data.apiLevel < EXPECTED_API_LEVEL))
        .catch((e) => alive && setOutdated(e?.response?.status === 404));
    check();
    const id = window.setInterval(check, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!outdated) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-[13px] text-red-700 dark:text-red-300">
      <RefreshCw className="w-4 h-4 mt-0.5 shrink-0" />
      <p>
        <b>Le serveur n'est pas à jour</b> : certaines pages (messagerie, recherche, passkeys…) ne marcheront pas.
        Ferme les fenêtres noires « MarketSim Backend » et « Frontend » (et le backend d'IntelliJ s'il tourne), puis relance <b>Lancer-MarketSim.bat</b>.
      </p>
    </div>
  );
}
