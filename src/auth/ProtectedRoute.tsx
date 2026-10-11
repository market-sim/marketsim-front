import { Navigate, Outlet } from "react-router";
import { useAuth } from "./AuthContext";

/** Laisse passer seulement les utilisateurs connectes (et admins si adminOnly). */
export default function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chargement...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "ADMIN") return <Navigate to="/" replace />;
  return <Outlet />;
}
