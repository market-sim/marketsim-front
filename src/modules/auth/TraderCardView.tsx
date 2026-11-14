import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Award, Medal, ShieldCheck, Target, Trophy } from "lucide-react";
import type { TraderCard } from "../../api/endpoints";
import { LEVEL_COLOR, LEVEL_LABEL } from "../../progression/ProgressionContext";
import UserAvatar from "../../auth/UserAvatar";
import { BrandName, logoMark } from "../../shared/brand";
import { useI18n } from "../../i18n/I18nContext";

export function publicCardUrl(publicId: string) {
  return `${location.origin}/t/${publicId}`;
}

/** Carte de trader facon carte de jeu : photo, niveau, score, statistiques, badges et QR code du lien public. */
export default function TraderCardView({ card, showQr = true }: { card: TraderCard; showQr?: boolean }) {
  const { t } = useI18n();
  const [qr, setQr] = useState<string | null>(null);
  const color = LEVEL_COLOR[card.level] ?? "#22C55E";
  const [first, ...rest] = card.displayName.split(" ");

  useEffect(() => {
    if (!showQr || !card.isPublic) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(publicCardUrl(card.publicId), { margin: 1, width: 160, color: { dark: "#0D1B3E", light: "#FFFFFF" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [card.publicId, card.isPublic, showQr]);

  const stats = [
    { label: t("card.games"), value: String(card.games), Icon: Target },
    { label: t("card.winRate"), value: `${Math.round(card.winRate * 100)} %`, Icon: Trophy },
    { label: t("card.discipline"), value: `${Math.round(card.discipline * 100)} %`, Icon: ShieldCheck },
    { label: t("card.rank"), value: card.rank ? `#${card.rank}/${card.traders}` : "—", Icon: Medal },
  ];

  return (
    <div className="relative w-full max-w-[420px] rounded-3xl overflow-hidden text-white shadow-2xl"
      style={{ background: `radial-gradient(120% 90% at 0% 0%, ${color}55 0%, transparent 55%), linear-gradient(160deg, #0D1B3E 0%, #13265A 60%, #0B1530 100%)` }}>
      <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full opacity-20" style={{ background: color, filter: "blur(40px)" }} />
      <div className="relative p-6">
        <div className="flex items-center gap-2 mb-5">
          <img src={logoMark} alt="" className="w-7 h-7 object-contain" />
          <BrandName className="text-xs font-semibold tracking-wide" />
          <span className="ms-auto text-[10px] uppercase tracking-[.2em] text-white/50">Trader card</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="p-1 rounded-full" style={{ background: `conic-gradient(${color} ${card.skillScore * 3.6}deg, rgba(255,255,255,.15) 0deg)` }}>
            <UserAvatar firstName={first} lastName={rest.join(" ")} avatarUrl={card.avatarUrl} size={84} className="ring-4 ring-[#0D1B3E]" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold truncate">{card.displayName}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${color}33`, color }}>
              <Award className="w-3.5 h-3.5" /> {LEVEL_LABEL[card.level]}
            </span>
            <p className="text-[11px] text-white/55 mt-1.5">{t("card.skill")} : <b className="text-white">{card.skillScore}/100</b></p>
          </div>
        </div>

        {card.bio && <p className="mt-4 text-[13px] text-white/80 italic leading-snug">« {card.bio} »</p>}

        <div className="grid grid-cols-4 gap-2 mt-5">
          {stats.map(({ label, value, Icon }) => (
            <div key={label} className="rounded-xl bg-white/[.07] border border-white/10 px-2 py-2.5 text-center">
              <Icon className="w-3.5 h-3.5 mx-auto text-white/50" />
              <p className="text-sm font-bold mt-1">{value}</p>
              <p className="text-[9.5px] text-white/50 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-[10px] uppercase tracking-wider text-white/45 mt-5 mb-2">{t("card.badges")}</p>
        {card.badges.length === 0 ? (
          <p className="text-[12px] text-white/55">{t("card.noBadge")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {card.badges.map((b) => (
              <span key={b.id} title={b.description} className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-amber-400/15 text-amber-200 border border-amber-300/25">
                🏅 {b.label}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 mt-5">
          <div className="flex-1 text-[10.5px] text-white/45">
            {card.memberSince && <p>{t("card.since", { date: card.memberSince })}</p>}
            {card.bestLevel && card.bestLevel !== card.level && <p>{t("card.best")} : {LEVEL_LABEL[card.bestLevel]}</p>}
          </div>
          {qr && (
            <div className="text-center">
              <img src={qr} alt="QR code" className="w-[72px] h-[72px] rounded-lg" />
              <p className="text-[8.5px] text-white/40 mt-1 w-[72px] leading-tight">{t("card.scan")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
