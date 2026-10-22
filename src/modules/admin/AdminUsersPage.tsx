import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Trash2 } from "lucide-react";
import { adminApi, type SecurityScore, type User } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { CardShell, DISPLAY } from "../../shared/ui";

/** Module 1 : back-office admin — gestion des comptes utilisateurs. */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [score, setScore] = useState<SecurityScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [scoreMissing, setScoreMissing] = useState(false);
  const scoreRequestRef = useRef<AbortController | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  const load = () => adminApi.users().then(setUsers).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const toggle = async (u: User) => {
    await adminApi.setEnabled(u.id, !u.enabled);
    load();
  };

  const closeDetails = () => {
    scoreRequestRef.current?.abort();
    scoreRequestRef.current = null;
    selectedIdRef.current = null;
    setSelected(null);
    setScore(null);
    setScoreError("");
    setScoreMissing(false);
    setScoreLoading(false);
  };

  const remove = async (u: User) => {
    if (!confirm(`Supprimer ${u.email} ?`)) return;
    await adminApi.deleteUser(u.id);
    if (selectedIdRef.current === u.id) closeDetails();
    load();
  };

  const openDetails = (u: User) => {
    scoreRequestRef.current?.abort();
    const controller = new AbortController();
    scoreRequestRef.current = controller;
    selectedIdRef.current = u.id;
    setSelected(u);
    setScore(null);
    setScoreError("");
    setScoreMissing(false);
    setScoreLoading(true);
    adminApi.userSecurityScore(u.id, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || selectedIdRef.current !== u.id || data.userId !== u.id) return;
        setScore(data);
      })
      .catch((e) => {
        if (controller.signal.aborted || selectedIdRef.current !== u.id) return;
        if (axios.isCancel(e)) return;
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          setScoreMissing(true);
        } else {
          setScoreError(errorMessage(e));
        }
      })
      .finally(() => {
        if (controller.signal.aborted || selectedIdRef.current !== u.id) return;
        setScoreLoading(false);
      });
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
                  <button onClick={() => openDetails(u)} className="text-[11px] font-medium text-blue-600 hover:underline">
                    Détails
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

      {selected && (
        <div className="border-t border-border/60 px-5 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground" style={DISPLAY}>
              Score de {selected.firstName} {selected.lastName}
            </h4>
            <button onClick={closeDetails} className="text-xs text-muted-foreground hover:text-foreground">Fermer</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Consultatif. Ne modifie ni le rôle, ni l&apos;activation, ni le verrouillage.</p>
          {scoreLoading && <p className="text-xs text-muted-foreground">Chargement du score...</p>}
          {!scoreLoading && scoreMissing && (
            <p className="text-xs text-muted-foreground">Aucun score pour cet utilisateur.</p>
          )}
          {!scoreLoading && scoreError && <p className="text-xs text-red-600 dark:text-red-400">{scoreError}</p>}
          {!scoreLoading && !scoreMissing && !scoreError && !score && (
            <p className="text-xs text-muted-foreground">Aucun score disponible.</p>
          )}
          {!scoreLoading && score && score.userId === selected.id && (
            <p className="text-[12px] text-foreground">
              {score.insufficientEvidence
                ? `Preuves insuffisantes (${score.assessmentCount} évaluation(s) qualifiée(s)). Pas de score inventé.`
                : `Score ${score.score ?? "—"} · bande ${score.riskBand ?? "—"} · ${score.assessmentCount} évaluations`}
            </p>
          )}
        </div>
      )}
    </CardShell>
  );
}
