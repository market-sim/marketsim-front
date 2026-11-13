import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowDown, ArrowUp, Search, Trash2 } from "lucide-react";
import { adminApi, type SecurityScore, type User, type UserLevelAssessment } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { CardShell, DISPLAY } from "../../shared/ui";
import ConfirmDialog, { type ConfirmRequest } from "../../shared/ConfirmDialog";
import { LEVELS, LEVEL_LABELS, filterUsers, reasonText, type UserFilter, type UserSort } from "../auth/userLogic";

/** Module 1 : back-office admin — gestion des comptes utilisateurs. */
export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [score, setScore] = useState<SecurityScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [scoreMissing, setScoreMissing] = useState(false);
  const [level, setLevel] = useState<UserLevelAssessment | null>(null);
  const [levelLoading, setLevelLoading] = useState(false);
  const [levelError, setLevelError] = useState("");
  const [levelMissing, setLevelMissing] = useState(false);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [filter, setFilter] = useState<UserFilter>({ q: "", role: "", status: "", level: "" });
  const [sort, setSort] = useState<UserSort>("name");
  const [desc, setDesc] = useState(false);
  const scoreRequestRef = useRef<AbortController | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  const load = () => adminApi.users().then(setUsers).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const changeRole = (u: User) => {
    const next = u.role === "ADMIN" ? "USER" : "ADMIN";
    setConfirmReq({
      title: `Passer ${u.firstName} ${u.lastName} en ${next} ?`,
      description: next === "ADMIN"
        ? <><p><b>{u.email}</b> aura accès au back-office : gestion des comptes, paramètres, journaux et anomalies.</p><p>Vous pourrez revenir en arrière à tout moment.</p></>
        : <p><b>{u.email}</b> perdra l&apos;accès au back-office et redeviendra un utilisateur standard.</p>,
      confirmLabel: `Passer en ${next}`,
      tone: next === "ADMIN" ? "primary" : "danger",
      onConfirm: async () => {
        setError("");
        try {
          await adminApi.setRole(u.id, next);
        } catch (e) {
          setError(errorMessage(e));
        }
        load();
      },
    });
  };

  const applyToggle = async (u: User) => {
    setError("");
    try {
      await adminApi.setEnabled(u.id, !u.enabled);
    } catch (e) {
      setError(errorMessage(e));
    }
    load();
  };

  const toggle = (u: User) => {
    if (!u.enabled) { applyToggle(u); return; }       // reactivation : sans risque, pas de confirmation
    setConfirmReq({
      title: `Désactiver le compte de ${u.firstName} ${u.lastName} ?`,
      description: <p><b>{u.email}</b> ne pourra plus se connecter tant que le compte n&apos;est pas réactivé. Ses données sont conservées.</p>,
      confirmLabel: "Désactiver",
      tone: "danger",
      onConfirm: () => applyToggle(u),
    });
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
    setLevel(null);
    setLevelError("");
    setLevelMissing(false);
    setLevelLoading(false);
  };

  const remove = (u: User) => {
    setConfirmReq({
      title: `Supprimer définitivement ${u.firstName} ${u.lastName} ?`,
      description: <>
        <p>Le compte <b>{u.email}</b> sera supprimé. <b>Cette action est irréversible.</b></p>
        <p>Pour simplement bloquer l&apos;accès, préférez « Désactiver ».</p>
      </>,
      confirmLabel: "Supprimer définitivement",
      tone: "danger",
      onConfirm: async () => {
        setError("");
        try {
          await adminApi.deleteUser(u.id);
          if (selectedIdRef.current === u.id) closeDetails();
        } catch (e) {
          setError(errorMessage(e));
        }
        load();
      },
    });
  };

  const shown = useMemo(() => filterUsers(users, filter, sort, desc), [users, filter, sort, desc]);
  const sortBy = (key: UserSort) => {
    if (sort === key) setDesc((d) => !d);
    else { setSort(key); setDesc(false); }
  };
  const SortHead = ({ k, label }: { k: UserSort; label: string }) => (
    <button onClick={() => sortBy(k)} className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest hover:text-foreground">
      {label}
      {sort === k && (desc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
    </button>
  );

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
    setLevel(null);
    setLevelError("");
    setLevelMissing(false);
    setLevelLoading(true);
    adminApi.userLevel(u.id, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || selectedIdRef.current !== u.id || data.userId !== u.id) return;
        setLevel(data);
        const shownLevel = data.level ?? (data.insufficientEvidence ? "DEBUTANT" : null);
        if (shownLevel) {
          setUsers((rows) => rows.map((row) => row.id === data.userId ? { ...row, level: shownLevel } : row));
          setSelected((current) => current && current.id === data.userId ? { ...current, level: shownLevel } : current);
        }
      })
      .catch((e) => {
        if (controller.signal.aborted || selectedIdRef.current !== u.id) return;
        if (axios.isCancel(e)) return;
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          setLevelMissing(true);
        } else {
          setLevelError(errorMessage(e));
        }
      })
      .finally(() => {
        if (controller.signal.aborted || selectedIdRef.current !== u.id) return;
        setLevelLoading(false);
      });
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
        <span className="text-[11px] text-muted-foreground">{shown.length} / {users.length} comptes</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border/40">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} placeholder="Rechercher un nom ou un email…"
            className={`${filterClass} w-full pl-8`} />
        </div>
        <select value={filter.role} onChange={(e) => setFilter((f) => ({ ...f, role: e.target.value as UserFilter["role"] }))} className={filterClass} aria-label="Rôle">
          <option value="">Tous les rôles</option><option value="USER">USER</option><option value="ADMIN">ADMIN</option>
        </select>
        <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as UserFilter["status"] }))} className={filterClass} aria-label="Statut">
          <option value="">Tous les statuts</option><option value="ENABLED">Actifs</option><option value="DISABLED">Désactivés</option>
        </select>
        <select value={filter.level} onChange={(e) => setFilter((f) => ({ ...f, level: e.target.value }))} className={filterClass} aria-label="Niveau">
          <option value="">Tous les niveaux</option>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </select>
        {(filter.q || filter.role || filter.status || filter.level) && (
          <button onClick={() => setFilter({ q: "", role: "", status: "", level: "" })} className="text-[11px] font-semibold text-blue-600 hover:underline">Réinitialiser</button>
        )}
      </div>
      {error && <p className="px-5 py-3 text-xs text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
              <th className="text-left px-5 py-3"><SortHead k="name" label="Utilisateur" /></th>
              <th className="text-left px-5 py-3"><SortHead k="email" label="Email" /></th>
              <th className="text-left px-5 py-3">Rôle</th>
              <th className="text-left px-5 py-3"><SortHead k="level" label="Niveau" /></th>
              <th className="text-left px-5 py-3"><SortHead k="createdAt" label="Inscrit le" /></th>
              <th className="text-right px-5 py-3">Statut</th>
              <th className="px-5 py-3" />
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {shown.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-6 text-center text-xs text-muted-foreground">Aucun compte ne correspond aux filtres.</td></tr>
            )}
            {shown.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
              <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-5 py-3.5 text-sm font-medium text-foreground">{u.firstName} {u.lastName}</td>
                <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{u.email}</td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => changeRole(u)}
                    disabled={isSelf}
                    title={isSelf ? "Vous ne pouvez pas modifier votre propre rôle" : `Passer en ${u.role === "ADMIN" ? "USER" : "ADMIN"}`}
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full disabled:opacity-60 disabled:cursor-not-allowed ${u.role === "ADMIN" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}
                  >
                    {u.role}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{LEVEL_LABELS[u.level] ?? u.level}</td>
                <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("fr-FR") : "—"}</td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => toggle(u)}
                    disabled={isSelf}
                    title={isSelf ? "Vous ne pouvez pas désactiver votre propre compte" : undefined}
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full disabled:opacity-60 disabled:cursor-not-allowed ${u.enabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                  >
                    {u.enabled ? "Actif" : "Désactivé"}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => openDetails(u)} className="text-[11px] font-medium text-blue-600 hover:underline">
                    Détails
                  </button>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {u.role !== "ADMIN" && !isSelf && (
                    <button onClick={() => remove(u)} title="Supprimer le compte" className="text-muted-foreground hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
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
          <p className="text-[11px] text-muted-foreground">Le niveau et le score de connexion ne modifient ni le rôle, ni l&apos;activation, ni le verrouillage.</p>
          {levelLoading && <p className="text-xs text-muted-foreground">Chargement du niveau...</p>}
          {!levelLoading && levelMissing && (
            <p className="text-xs text-muted-foreground">Aucun niveau pour cet utilisateur.</p>
          )}
          {!levelLoading && levelError && <p className="text-xs text-red-600 dark:text-red-400">{levelError}</p>}
          {!levelLoading && level && level.userId === selected.id && (
            <p className="text-[12px] text-foreground">
              {level.insufficientEvidence
                ? `Niveau : activité insuffisante (${level.successfulLoginCount} connexion(s) réussie(s)). Reste Débutant.`
                : `Niveau ${LEVEL_LABELS[level.level ?? ""] ?? level.level ?? "—"} · score ${level.score ?? "—"}/100 · ${level.reasonCodes.map(reasonText).join(", ") || "—"}`}
            </p>
          )}
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
      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
    </CardShell>
  );
}

const filterClass = "bg-muted/30 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-blue-400";
