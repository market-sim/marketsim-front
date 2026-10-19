import { logoMark } from "../shared/brand";
import { Navigate, Outlet } from "react-router";
import { useAuth } from "./AuthContext";

/** Laisse passer seulement les utilisateurs connectes (et admins si adminOnly). */
export default function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground" style={{ background: "#041634" }}>
        <img src={logoMark} alt="" className="w-20 h-auto animate-pulse" />
        <span className="text-white/60">Chargement...</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return <Outlet />;
}
