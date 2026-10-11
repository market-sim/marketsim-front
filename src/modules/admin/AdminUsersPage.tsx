import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { adminApi, type User } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY } from "../../shared/ui";

/** Module 1 : back-office admin — gestion des comptes utilisateurs. */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");

  const load = () => adminApi.users().then(setUsers).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const toggle = async (u: User) => {
    await adminApi.setEnabled(u.id, !u.enabled);
    load();
  };

  const remove = async (u: User) => {
    if (!confirm(`Supprimer ${u.email} ?`)) return;
    await adminApi.deleteUser(u.id);
    load();
  };

  return (
    <CardShell className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Comptes utilisateurs</h3>
        <span className="text-[11px] text-muted-foreground">{users.length} comptes</span>
      </div>
      {error && <p className="px-5 py-3 text-xs text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
              <th className="text-left px-5 py-3">Utilisateur</th>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Rôle</th>
              <th className="text-left px-5 py-3">Niveau</th>
              <th className="text-right px-5 py-3">Statut</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-5 py-3.5 text-sm font-medium text-foreground">{u.firstName} {u.lastName}</td>
                <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{u.email}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${u.role === "ADMIN" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{u.role}</span>
                </td>
                <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{u.level}</td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => toggle(u)} className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${u.enabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {u.enabled ? "Actif" : "Désactivé"}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {u.role !== "ADMIN" && (
                    <button onClick={() => remove(u)} className="text-muted-foreground hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}
