import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router";
import { ArrowDownWideNarrow, Download, KeyRound, LogOut, Pencil, Search, Trash2, UserPlus } from "lucide-react";
import EditBalanceDialog from "./EditBalanceDialog";
import { adminApi, type AdminTraderScore, type Role, type SecurityScore, type SessionView, type TemporaryPassword, type TraderLevel, type User, type UserLevelAssessment } from "../../api/endpoints";
import TraderLevels from "../auth/TraderLevels";
import ConfirmDialog, { type ConfirmRequest } from "../../shared/ConfirmDialog";
import { inputClass } from "../auth/AuthLayout";

/** Champs compacts de la barre de filtres (sans la largeur pleine de inputClass). */
const filterClass = "bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground outline-none focus:border-blue-400";
import { LEVEL_COLOR, LEVEL_LABEL, money } from "../../progression/ProgressionContext";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { CardShell, DISPLAY } from "../../shared/ui";

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
  const scoreRequestRef = useRef<AbortController | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  const [scores, setScores] = useState<Record<number, AdminTraderScore>>({});
  const [sortByScore, setSortByScore] = useState(false);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [editBalance, setEditBalance] = useState<{ user: User; current: number | null } | null>(null);
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setQuery(q);
  }, [searchParams]);
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "disabled" | "unconfirmed">("");
  const [levelFilter, setLevelFilter] = useState<"" | TraderLevel>("");
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [temp, setTemp] = useState<TemporaryPassword | null>(null);
  const [notice, setNotice] = useState("");
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const PAGE = 10;

  const load = () => {
    adminApi.users().then(setUsers).catch((e) => setError(errorMessage(e)));
    adminApi.traderScores()
      .then((rows) => setScores(Object.fromEntries(rows.map((r) => [r.userId, r]))))
      .catch(() => setScores({}));
  };
  const q = query.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (u.deleted) return false;
    if (q && !`${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter === "active" && !u.enabled) return false;
    if (statusFilter === "disabled" && u.enabled) return false;
    if (statusFilter === "unconfirmed" && u.emailConfirmed !== false) return false;
    if (levelFilter && (u.role === "ADMIN" || (scores[u.id]?.level ?? u.level) !== levelFilter)) return false;
    return true;
  });
  const sorted = sortByScore
    ? [...filtered].sort((a, b) => (a.role === "ADMIN" ? 1 : 0) - (b.role === "ADMIN" ? 1 : 0)
      || (scores[b.id]?.skillScore ?? -1) - (scores[a.id]?.skillScore ?? -1)
      || (scores[b.id]?.balance ?? 0) - (scores[a.id]?.balance ?? 0))
    : filtered;
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = sorted.slice(current * PAGE, current * PAGE + PAGE);

  /** Export CSV de la liste filtree (separateur « ; » pour Excel en francais). */
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Prénom", "Nom", "Email", "Rôle", "Statut", "E-mail confirmé", "Niveau", "Portefeuille ($)", "Score trading", "Parties", "Trades", "Créé le"];
    const lines = sorted.map((u) => {
      const ts = u.role === "ADMIN" ? undefined : scores[u.id];
      return [u.firstName, u.lastName, u.email, u.role, u.enabled ? "Actif" : "Désactivé", u.emailConfirmed === false ? "non" : "oui",
        u.role === "ADMIN" ? "" : (ts?.level ?? u.level), ts ? ts.balance.toFixed(2).replace(".", ",") : "", ts?.skillScore ?? "",
        ts?.games ?? "", ts?.trades ?? "", u.createdAt ? new Date(u.createdAt).toLocaleDateString("fr-FR") : ""].map(esc).join(";");
    });
    const blob = new Blob(["\uFEFF" + [header.map(esc).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `marketsim-utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Boites de confirmation (module 1, branche module1-ui-upgrade) au lieu de window.confirm
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);

  const resetPassword = (u: User) => {
    setConfirmReq({
      title: `Mot de passe provisoire pour ${u.firstName} ${u.lastName} ?`,
      description: <p>Un mot de passe provisoire sera généré pour <b>{u.email}</b> et <b>toutes ses sessions seront déconnectées</b>.</p>,
      confirmLabel: "Générer",
      tone: "danger",
      onConfirm: async () => {
        setError("");
        try {
          setTemp(await adminApi.resetUserPassword(u.id));
        } catch (e) {
          setError(errorMessage(e));
        }
      },
    });
  };

  const revokeSessions = async (u: User) => {
    setError("");
    try {
      setNotice((await adminApi.revokeUserSessions(u.id)).message);
      if (selectedIdRef.current === u.id) setSessions(await adminApi.userSessions(u.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  };
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
    setSessions(null);
    adminApi.userSessions(u.id).then((rows) => { if (selectedIdRef.current === u.id) setSessions(rows); }).catch(() => setSessions([]));
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
      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
      {editBalance && (
        <EditBalanceDialog user={editBalance.user} current={editBalance.current} onClose={() => setEditBalance(null)}
          onSaved={(msg) => { setEditBalance(null); setError(""); setNotice(msg); load(); }} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Comptes utilisateurs</h3>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setCreating((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700">
            <UserPlus className="w-3.5 h-3.5" />Créer un compte
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/40">
            <Download className="w-3.5 h-3.5" />Exporter CSV
          </button>
          <button onClick={() => setSortByScore((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${sortByScore ? "border-blue-600 bg-blue-600 text-white" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
            <ArrowDownWideNarrow className="w-3.5 h-3.5" />Classement par score
          </button>
          <span className="text-[11px] text-muted-foreground">{filtered.length} / {users.filter((u) => !u.deleted).length} comptes</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Rechercher un nom ou un e-mail"
            className={`${filterClass} w-full pl-8`} />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as "" | Role); setPage(0); }} className={filterClass}>
          <option value="">Tous les rôles</option><option value="USER">USER</option><option value="ADMIN">ADMIN</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0); }} className={filterClass}>
          <option value="">Tous les statuts</option><option value="active">Actifs</option><option value="disabled">Désactivés</option><option value="unconfirmed">E-mail non confirmé</option>
        </select>
        <select value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value as "" | TraderLevel); setPage(0); }} className={filterClass}>
          <option value="">Tous les niveaux</option>
          {(["DEBUTANT", "INTERMEDIAIRE", "AVANCE", "EXPERT"] as TraderLevel[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
        </select>
      </div>
      {creating && <CreateUserForm onDone={(r) => { setCreating(false); setTemp(r); load(); }} onCancel={() => setCreating(false)} />}
      {temp && (
        <div className="mx-5 my-3 rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-4 py-3 text-[12.5px] text-foreground">
          <p>{temp.message}</p>
          {temp.temporaryPassword && (
            <p className="mt-1">Compte <b>{temp.email}</b> · mot de passe provisoire :{" "}
              <code className="rounded bg-background px-2 py-0.5 text-[13px] font-semibold">{temp.temporaryPassword}</code></p>
          )}
          <button onClick={() => setTemp(null)} className="mt-1 text-[11px] text-muted-foreground hover:text-foreground">Masquer</button>
        </div>
      )}
      {notice && <p className="px-5 py-2 text-xs text-emerald-600">{notice}</p>}
      {error && <p className="px-5 py-3 text-xs text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground bg-muted/20">
              <th className="text-left px-5 py-3">Utilisateur</th>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Rôle</th>
              <th className="text-left px-5 py-3">Niveau</th>
              <th className="text-right px-5 py-3">Portefeuille</th>
              <th className="text-left px-5 py-3">Score trading</th>
              <th className="text-right px-5 py-3">Parties</th>
              <th className="text-right px-5 py-3">Statut</th>
              <th className="px-5 py-3" />
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((u) => {
              const isSelf = u.id === currentUser?.id;
              const isAdminRow = u.role === "ADMIN";
              const ts = isAdminRow ? undefined : scores[u.id];
              return (
              <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-5 py-3.5 text-sm font-medium text-foreground">{u.firstName} {u.lastName}</td>
                <td className="px-5 py-3.5 text-[12px] text-muted-foreground">
                  {u.email}
                  {u.emailConfirmed === false && <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-600">non confirmé</span>}
                  {u.totpEnabled && <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-600">2FA</span>}
                </td>
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
                <td className="px-5 py-3.5 text-[12px]">
                  {isAdminRow
                    ? <span className="text-muted-foreground">—</span>
                    : ts
                    ? <span className="font-semibold" style={{ color: LEVEL_COLOR[ts.level] }}>{LEVEL_LABEL[ts.level]}</span>
                    : <span className="text-muted-foreground">{LEVEL_LABEL[u.level as TraderLevel] ?? u.level}</span>}
                </td>
                <td className="px-5 py-3.5 text-right text-[12px] font-semibold tabular-nums">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {ts
                      ? <span className={ts.bankrupt ? "text-red-500" : ts.balance >= 100_000 ? "text-emerald-600" : "text-red-500"}>{money(ts.balance)}{ts.bankrupt ? " · vide" : ""}</span>
                      : <span className="text-muted-foreground font-normal">—</span>}
                    {!isAdminRow && !u.deleted && (
                      <button onClick={() => setEditBalance({ user: u, current: ts ? ts.balance : null })}
                        title="Modifier le montant du portefeuille" aria-label={`Modifier le portefeuille de ${u.firstName}`}
                        className="p-1 rounded-md text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {ts ? (
                    <div className="flex items-center gap-2 min-w-[140px]" title={`Réussite ${Math.round(ts.winRate * 100)} % · discipline stop ${Math.round(ts.discipline * 100)} %`}>
                      <div className="h-1.5 w-20 rounded-full bg-muted">
                        <div className="h-1.5 rounded-full" style={{ width: `${ts.skillScore}%`, background: LEVEL_COLOR[ts.level] }} />
                      </div>
                      <span className="text-[12px] font-semibold text-foreground tabular-nums">{ts.skillScore}/100</span>
                    </div>
                  ) : <span className="text-[11px] text-muted-foreground">{isAdminRow ? "administrateur, ne joue pas" : "n'a pas encore joué"}</span>}
                </td>
                <td className="px-5 py-3.5 text-right text-[12px] text-muted-foreground tabular-nums">
                  {ts ? `${ts.games} · ${ts.trades} trades${ts.restarts ? ` · ${ts.restarts} redémarrage${ts.restarts > 1 ? "s" : ""}` : ""}` : "—"}
                </td>
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
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <button onClick={() => resetPassword(u)} title="Mot de passe provisoire" className="text-muted-foreground hover:text-blue-600 mr-3">
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => revokeSessions(u)} title="Déconnecter toutes ses sessions" className="text-muted-foreground hover:text-amber-600 mr-3">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                  {u.role !== "ADMIN" && !isSelf && (
                    <button onClick={() => remove(u)} className="text-muted-foreground hover:text-red-600">
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
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/60 text-[12px]">
          <button disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40">Précédent</button>
          <span className="text-muted-foreground">Page {current + 1} / {pages}</span>
          <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40">Suivant</button>
        </div>
      )}

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
          {!levelLoading && level && level.userId === selected.id && <TraderLevels level={level} admin />}
          {sessions && (
            <p className="text-[12px] text-foreground">
              Sessions actives : {sessions.length}
              {sessions.length > 0 && <> ({sessions.map((x) => x.device ?? "appareil inconnu").join(", ")})</>}
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
    </CardShell>
  );
}

/** Creation d'un compte par l'administrateur (mot de passe provisoire genere si le champ reste vide). */
function CreateUserForm({ onDone, onCancel }: { onDone: (r: TemporaryPassword) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "USER" as Role, password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError("");
      try {
        onDone(await adminApi.createUser({ ...form, password: form.password || undefined }));
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    }} className="mx-5 my-3 grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
      <input required placeholder="Prénom" value={form.firstName} onChange={set("firstName")} className={`${inputClass} py-1.5 text-[12px]`} />
      <input required placeholder="Nom" value={form.lastName} onChange={set("lastName")} className={`${inputClass} py-1.5 text-[12px]`} />
      <input required type="email" placeholder="Email" value={form.email} onChange={set("email")} className={`${inputClass} py-1.5 text-[12px] sm:col-span-2`} />
      <select value={form.role} onChange={set("role")} className={`${inputClass} py-1.5 text-[12px]`}>
        <option value="USER">USER</option><option value="ADMIN">ADMIN</option>
      </select>
      <input type="password" minLength={8} title="8 caractères minimum, avec au moins une lettre et un chiffre" placeholder="Mot de passe (vide = provisoire)" value={form.password} onChange={set("password")} className={`${inputClass} py-1.5 text-[12px]`} />
      <div className="sm:col-span-6 flex items-center gap-3">
        <button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {busy ? "Création..." : "Créer le compte"}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground">Annuler</button>
        <span className="text-[11px] text-muted-foreground">Le compte est créé avec l'e-mail déjà confirmé ; un e-mail de bienvenue part dans la boîte d'envoi.</span>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </form>
  );
}
