import { useState } from "react";
import { backendUrl } from "../api/endpoints";

/** Photo de profil ronde, ou les initiales si aucune photo (ou si l'image ne charge pas). */
export default function UserAvatar({ firstName, lastName, avatarUrl, size = 32, className = "" }: {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = backendUrl(avatarUrl);
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.36) };
  if (src && !broken) {
    return <img src={src} alt="" onError={() => setBroken(true)} style={style} className={`rounded-full object-cover shrink-0 ${className}`} />;
  }
  return (
    <div style={style} className={`rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}
