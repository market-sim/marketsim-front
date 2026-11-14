import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { profileApi, type TraderCard } from "../../api/endpoints";
import { useI18n } from "../../i18n/I18nContext";
import TraderCardView from "./TraderCardView";

/** Page publique d'une carte de trader (lien partage), visible sans compte. */
export default function PublicTraderPage() {
  const { publicId = "" } = useParams();
  const { t } = useI18n();
  const [card, setCard] = useState<TraderCard | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    profileApi.publicCard(publicId)
      .then((c) => { setCard(c); setState("ok"); })
      .catch(() => setState("missing"));
  }, [publicId]);

  useEffect(() => {
    if (card) document.title = `${card.displayName} · MarketSim AI`;
  }, [card]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4" style={{ background: "radial-gradient(circle at 50% 0%, #1E3A8A 0%, #0B1530 60%)" }}>
      {state === "loading" && <Loader2 className="w-8 h-8 text-white/60 animate-spin" />}
      {state === "missing" && <p className="text-white/80 text-center max-w-sm">{t("card.notFound")}</p>}
      {state === "ok" && card && <TraderCardView card={card} />}
      <Link to="/register" className="text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-xl px-5 py-2.5">
        {t("card.join")}
      </Link>
    </div>
  );
}
