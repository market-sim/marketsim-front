import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, Link2, Lock, RefreshCw, ShieldAlert, ShieldCheck, XCircle,
} from "lucide-react";
import {
  ledgerApi, type AgentConfig, type LedgerBlock, type LedgerChainReport, type LedgerProof, type LedgerRecord,
  type LedgerRecordDetail, type LedgerSummary, type LedgerType,
} from "../../../api/endpoints";
import { errorMessage } from "../../../api/client";
import { CardShell, DISPLAY, MONO } from "../../../shared/ui";
import { shortHash } from "../format";
import { verifyInBrowser, type BrowserVerification } from "../ledgerCrypto";

const TYPE_LABEL: Record<LedgerType, string> = {
  DECISION: "Décision", MONTE_CARLO: "Monte Carlo", TOURNAMENT: "Tournoi", TRAINING: "Entraînement RL",
  WALK_FORWARD: "Walk-forward", AUTOPILOT_HALT: "Arrêt automatique", COACH_ADVICE: "Conseil du coach",
};
const TYPE_STYLE: Record<LedgerType, string> = {
  DECISION: "bg-blue-50 text-blue-700", MONTE_CARLO: "bg-violet-50 text-violet-700", TOURNAMENT: "bg-amber-50 text-amber-700",
  TRAINING: "bg-emerald-50 text-emerald-700", WALK_FORWARD: "bg-cyan-50 text-cyan-700", AUTOPILOT_HALT: "bg-red-50 text-red-700",
  COACH_ADVICE: "bg-sky-50 text-sky-700",
};
const time = (ms: number) => new Date(ms).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      {ok === null ? <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-px" />
        : ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-px" />
        : <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-px" />}
      <div className="min-w-0">
        <p className={ok === false ? "font-semibold text-red-600" : "font-medium text-foreground"}>{label}</p>
        {detail && <p className="text-[11px] text-muted-foreground break-all" style={MONO}>{detail}</p>}
      </div>
    </div>
  );
}

/** Detail d'un enregistrement : contenu fige + verification cryptographique refaite dans le navigateur. */
function RecordDetailCard({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [detail, setDetail] = useState<LedgerRecordDetail | null>(null);
  const [proof, setProof] = useState<LedgerProof | null>(null);
  const [check, setCheck] = useState<BrowserVerification | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([ledgerApi.record(id), ledgerApi.proof(id)]);
      setDetail(d);
      setProof(p);
      setCheck(await verifyInBrowser(p));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    setNote("");
    load();
  }, [load]);

  const act = async (kind: "tamper" | "restore") => {
    setBusy(true);
    try {
      const r = kind === "tamper" ? await ledgerApi.tamper(id) : await ledgerApi.restore(id);
      setNote(kind === "tamper" ? `Contenu modifié directement en base (${r.change}).` : "Contenu d'origine restauré.");
      await load();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pretty = useMemo(() => {
    if (!detail) return "";
    try {
      return JSON.stringify(JSON.parse(detail.payload), null, 2);
    } catch {
      return detail.payload;
    }
  }, [detail]);

  if (error) return <CardShell className="p-5 text-xs text-red-600">{error}</CardShell>;
  if (!detail || !proof || !check) return <CardShell className="p-5 text-sm text-muted-foreground">Chargement…</CardShell>;

  const r = detail.record;
  const intact = check.contentMatches;

  return (
    <CardShell className={`p-5 ${intact ? "" : "border-red-300 ring-1 ring-red-200"}`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLE[r.type]}`}>{TYPE_LABEL[r.type]}</span>
        <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Enregistrement #{r.id}</h3>
        <span className="text-[11px] text-muted-foreground">{time(r.createdAtMs)}</span>
      </div>
      <p className="text-[12px] text-foreground mb-3">{r.title}</p>

      {!intact && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700 flex gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-px" />
          <span><b>Falsification détectée.</b> Le contenu affiché n'a plus la même empreinte que celle scellée dans la chaîne.</span>
        </div>
      )}
      {note && <p className="mb-3 text-[11px] text-slate-600 bg-slate-50 rounded px-2 py-1">{note}</p>}

      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">Contenu figé (JSON canonique)</p>
      <pre className="text-[11px] bg-slate-950 text-slate-100 rounded-lg p-3 max-h-56 overflow-auto leading-relaxed" style={MONO}>{pretty}</pre>

      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-4 mb-2 flex items-center gap-1.5">
        <Lock className="w-3 h-3" />Vérification refaite dans votre navigateur (SHA-256, WebCrypto)
      </p>
      <div className="space-y-2.5">
        <Check ok={check.contentMatches} label="1. SHA-256(contenu) = empreinte enregistrée"
          detail={check.contentMatches ? shortHash(check.computedLeafHash) : `calculé ${shortHash(check.computedLeafHash)} ≠ scellé ${shortHash(proof.leafHash)}`} />
        {proof.sealed ? (
          <>
            <Check ok={check.rootMatches} label={`2. Chemin de Merkle (${proof.path.length} étape${proof.path.length > 1 ? "s" : ""}, feuille ${proof.leafIndex! + 1}/${proof.leafCount}) → racine du bloc`}
              detail={`racine ${shortHash(proof.merkleRoot!)}`} />
            {check.trace.length > 0 && (
              <div className="ml-6 border-l-2 border-slate-200 pl-3 space-y-1">
                {check.trace.map((s, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground" style={MONO}>
                    H(0x01 ‖ {s.siblingOnLeft ? `${shortHash(s.siblingHash)} ‖ ·` : `· ‖ ${shortHash(s.siblingHash)}`}) = {shortHash(s.result)}
                  </p>
                ))}
              </div>
            )}
            <Check ok={check.blockMatches} label={`3. SHA-256(bloc ${proof.blockHeight}) = hash du bloc`} detail={shortHash(proof.blockHash!)} />
            <Check ok={null} label="4. Sceau HMAC du bloc" detail="vérifiable uniquement par le serveur (secret) — voir « Vérifier la chaîne »" />
          </>
        ) : (
          <Check ok={null} label="Pas encore scellé dans un bloc" detail="scellage automatique toutes les 15 s (ou bouton « Sceller maintenant »)" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-border/50">
        {intact ? (
          <button onClick={() => act("tamper")} disabled={busy}
            title="Démo : modifie directement le contenu en base de données, comme le ferait un attaquant"
            className="flex items-center gap-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[12px] font-medium px-3 py-1.5 disabled:opacity-60">
            <AlertTriangle className="w-3.5 h-3.5" />Simuler une attaque sur la base
          </button>
        ) : (
          <button onClick={() => act("restore")} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[12px] font-medium px-3 py-1.5 disabled:opacity-60">
            <ShieldCheck className="w-3.5 h-3.5" />Restaurer le contenu d'origine
          </button>
        )}
      </div>
    </CardShell>
  );
}

/** Registre d'audit : chaque decision / simulation de l'IA est figee (SHA-256), scellee en bloc (Merkle + hash chaine). */
export default function AuditPanel({ agent, focusRecordId, onFocusConsumed }: {
  agent: AgentConfig; focusRecordId?: number | null; onFocusConsumed?: () => void;
}) {
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [report, setReport] = useState<LedgerChainReport | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [type, setType] = useState("");
  const [onlyThisAgent, setOnlyThisAgent] = useState(true);
  const [busy, setBusy] = useState<"" | "seal" | "verify">("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [s, b, r] = await Promise.all([
        ledgerApi.summary(), ledgerApi.blocks(8),
        ledgerApi.records({ type: type || undefined, agentId: onlyThisAgent ? agent.id : undefined, limit: 60 }),
      ]);
      setSummary(s);
      setBlocks([...b].reverse());
      setRecords(r);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [type, onlyThisAgent, agent.id]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 8000);   // les enregistrements en attente passent en "scelle" tout seuls
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (focusRecordId != null) {
      setSelected(focusRecordId);
      setOnlyThisAgent(false);
      onFocusConsumed?.();
    }
  }, [focusRecordId, onFocusConsumed]);

  const seal = async () => {
    setBusy("seal");
    try {
      await ledgerApi.seal();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };

  const verify = async () => {
    setBusy("verify");
    try {
      setReport(await ledgerApi.verify());
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };

  const brokenBlocks = new Set((report?.issues ?? []).map((i) => i.blockHeight).filter((h): h is number => h != null));
  const types = Object.keys(summary?.byType ?? {}) as LedgerType[];

  return (
    <div className="space-y-4">
      <CardShell className="p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-[240px] flex-1">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Registre d'audit des décisions de l'IA</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 max-w-3xl">
              Chaque décision, simulation, entraînement, tournoi et backtest est <b>figé</b> (SHA-256), puis <b>scellé par lots</b> dans un bloc lié
              au précédent (arbre de Merkle + hash chaîné + sceau HMAC). Modifier un seul chiffre après coup casse la chaîne, et chaque
              enregistrement peut être prouvé sans faire confiance au serveur.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button onClick={seal} disabled={busy !== ""}
              className="flex items-center gap-1.5 rounded-lg border border-border text-[12px] font-medium px-3 py-2 hover:bg-muted/40 disabled:opacity-60">
              <Lock className="w-3.5 h-3.5" />{busy === "seal" ? "Scellage…" : "Sceller maintenant"}
            </button>
            <button onClick={verify} disabled={busy !== ""}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold px-3 py-2 disabled:opacity-60">
              <ShieldCheck className="w-3.5 h-3.5" />{busy === "verify" ? "Vérification…" : "Vérifier la chaîne"}
            </button>
          </div>
        </div>

        {report && (
          <div className={`mt-4 rounded-lg border px-4 py-3 text-[12px] ${report.valid ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-900"}`}>
            {report.valid ? (
              <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />
                <span><b>Chaîne intègre.</b> {report.blocks} blocs, {report.sealedRecords} enregistrements scellés revérifiés (liens, hashs, sceaux, racines de Merkle).</span></p>
            ) : (
              <div>
                <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="w-4 h-4 shrink-0" />Chaîne corrompue : {report.issues.length} anomalie{report.issues.length > 1 ? "s" : ""} détectée{report.issues.length > 1 ? "s" : ""}</p>
                <ul className="mt-1.5 space-y-0.5 list-disc pl-6">
                  {report.issues.slice(0, 6).map((i, k) => (
                    <li key={k}>
                      {i.message}{" "}
                      {i.recordId != null && <button className="underline font-medium" onClick={() => setSelected(i.recordId!)}>voir #{i.recordId}</button>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {[
              ["Blocs", String(summary.blocks)],
              ["Enregistrements", `${summary.myRecords}`],
              ["En attente de scellage", String(summary.pendingRecords)],
              ["Tête de chaîne", shortHash(summary.headHash)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5" style={MONO}>{v}</p>
              </div>
            ))}
          </div>
        )}
      </CardShell>

      {/* Chaine de blocs */}
      {blocks.length > 0 && (
        <CardShell className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3" style={DISPLAY}>Chaîne de blocs</h3>
          <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
            {blocks.map((b, i) => (
              <div key={b.height} className="flex items-center gap-1 shrink-0">
                {i > 0 && <ArrowRight className="w-4 h-4 text-slate-300" />}
                <div className={`w-44 rounded-lg border px-3 py-2 ${brokenBlocks.has(b.height) ? "border-red-400 bg-red-50" : "border-border bg-white"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-foreground">{b.height === 0 ? "Genèse" : `Bloc #${b.height}`}</span>
                    <span className="text-[10px] text-muted-foreground">{b.recordCount} enreg.</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1" style={MONO} title={b.blockHash}>hash {shortHash(b.blockHash)}</p>
                  <p className="text-[10px] text-muted-foreground" style={MONO} title={b.previousHash}>← {shortHash(b.previousHash)}</p>
                  <p className="text-[10px] text-muted-foreground" style={MONO} title={b.merkleRoot}>racine {shortHash(b.merkleRoot)}</p>
                  {b.anchorRef && <p className="text-[10px] text-emerald-700 mt-0.5">ancré : {b.anchorRef}</p>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Limite assumée : le registre est local. Un administrateur qui possède la base <i>et</i> le secret de scellage pourrait tout réécrire ;
            publier régulièrement le hash de tête sur une blockchain publique (ancrage externe) ferme cette limite.
          </p>
        </CardShell>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <CardShell className="overflow-hidden xl:col-span-3">
          <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground" style={DISPLAY}>Enregistrements</h3>
            <select value={type} onChange={(e) => setType(e.target.value)} className="ml-auto bg-muted/30 border border-border rounded-lg px-2 py-1 text-[12px]">
              <option value="">Tous les types</option>
              {types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <input type="checkbox" checked={onlyThisAgent} onChange={(e) => setOnlyThisAgent(e.target.checked)} />Cet agent
            </label>
            <button onClick={refresh} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/50" title="Actualiser"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
          {records.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Aucun enregistrement : lancez une décision, une simulation Monte Carlo ou un backtest walk-forward pour alimenter le registre.
            </p>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-[12px]">
                <tbody className="divide-y divide-border/40">
                  {records.map((r) => (
                    <tr key={r.id} onClick={() => setSelected(r.id)}
                      className={`cursor-pointer hover:bg-muted/20 ${selected === r.id ? "bg-blue-50/60" : ""} ${!r.intact ? "bg-red-50/60" : ""}`}>
                      <td className="pl-5 pr-2 py-2.5 text-muted-foreground" style={MONO}>#{r.id}</td>
                      <td className="px-2 py-2.5"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${TYPE_STYLE[r.type]}`}>{TYPE_LABEL[r.type]}</span></td>
                      <td className="px-2 py-2.5 text-foreground">
                        <span className="line-clamp-1">{r.title}</span>
                        <span className="text-[10px] text-muted-foreground">{time(r.createdAtMs)}</span>
                      </td>
                      <td className="pl-2 pr-5 py-2.5 text-right whitespace-nowrap">
                        {!r.intact ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600"><XCircle className="w-3.5 h-3.5" />MODIFIÉ</span>
                        ) : r.sealed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />bloc #{r.blockHeight}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Clock className="w-3.5 h-3.5" />en attente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardShell>

        <div className="xl:col-span-2">
          {selected != null ? (
            <RecordDetailCard id={selected} onChanged={refresh} />
          ) : (
            <CardShell className="p-8 text-center text-sm text-muted-foreground">
              Sélectionnez un enregistrement pour voir son contenu figé et vérifier sa preuve cryptographique.
            </CardShell>
          )}
        </div>
      </div>
    </div>
  );
}
