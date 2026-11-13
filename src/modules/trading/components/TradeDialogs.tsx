import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../app/components/ui/dialog";
import { fmt, MONO, DISPLAY } from "../../../shared/ui";
import type { TradeOrder, UpdateOrderRequest } from "../../../api/endpoints";
import { buildProtectionUpdate, distancePct, estimateClose, formatDistance, signed } from "../tradingLogic";

const inputClass = "w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400";
const labelClass = "text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1";
const btn = "px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60";

/** Modification du stop-loss / take-profit d'un ticket OPEN ou PENDING (PUT partiel). */
export function EditProtectionDialog({ order, onClose, onSave }: {
  order: TradeOrder | null;
  onClose: () => void;
  onSave: (id: number, req: UpdateOrderRequest) => Promise<string | null>;
}) {
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSl(order?.stopLoss != null ? String(Number(order.stopLoss)) : "");
    setTp(order?.takeProfit != null ? String(Number(order.takeProfit)) : "");
    setError("");
  }, [order]);

  if (!order) return null;
  const isLong = order.side === "BUY";
  const entry = Number(order.status === "PENDING" ? order.limitPrice : order.executedPrice ?? order.price);
  const reference = order.currentPrice != null ? Number(order.currentPrice) : entry;

  const save = async () => {
    const { request, error: e } = buildProtectionUpdate(order, sl, tp);
    if (!request) { setError(e ?? "Saisie invalide"); return; }
    setBusy(true);
    const serverError = await onSave(order.id, request);
    setBusy(false);
    if (serverError) setError(serverError); else onClose();
  };

  const hint = (raw: string) => {
    const v = Number(raw.replace(",", "."));
    return raw.trim() && Number.isFinite(v) ? formatDistance(distancePct(v, reference)) : "";
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={DISPLAY}>Protections — {order.symbol} #{order.id}</DialogTitle>
          <DialogDescription>
            {isLong ? "LONG" : "SHORT"} {Number(order.quantity)} · entrée {fmt(entry)}
            {order.currentPrice != null && <> · cours {fmt(Number(order.currentPrice))}</>}.
            {" "}{isLong ? "Stop-loss sous l'entrée, take-profit au-dessus." : "Stop-loss au-dessus de l'entrée, take-profit en dessous."}
            {" "}Laissez un champ vide pour supprimer le niveau.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Stop-Loss</label>
            <input type="number" step="any" value={sl} onChange={(e) => setSl(e.target.value)} className={inputClass} autoFocus />
            <p className="text-[10px] text-muted-foreground mt-1" style={MONO}>{hint(sl)}</p>
          </div>
          <div>
            <label className={labelClass}>Take-Profit</label>
            <input type="number" step="any" value={tp} onChange={(e) => setTp(e.target.value)} className={inputClass} />
            <p className="text-[10px] text-muted-foreground mt-1" style={MONO}>{hint(tp)}</p>
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <DialogFooter>
          <button onClick={onClose} className={`${btn} border border-border text-foreground hover:bg-muted/50`}>Annuler</button>
          <button onClick={save} disabled={busy} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>Enregistrer</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirmation avant cloture, avec estimation du P&L et des frais au cours actuel. */
export function CloseConfirmDialog({ order, onClose, onConfirm }: {
  order: TradeOrder | null;
  onClose: () => void;
  onConfirm: (id: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!order) return null;
  const est = estimateClose(order);
  const confirm = async () => {
    setBusy(true);
    await onConfirm(order.id);
    setBusy(false);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={DISPLAY}>Clôturer {order.symbol} #{order.id} ?</DialogTitle>
          <DialogDescription>
            La position {order.side === "BUY" ? "LONG" : "SHORT"} de {Number(order.quantity)} sera clôturée au prix du marché
            fixé par le serveur au moment de l'exécution. Estimation au cours actuel :
          </DialogDescription>
        </DialogHeader>
        {est ? (
          <div className="grid grid-cols-3 gap-3 text-sm" style={MONO}>
            <div><span className="text-[11px] text-muted-foreground block">P&L brut</span>
              <span className={est.pnl >= 0 ? "text-emerald-600" : "text-red-500"}>{signed(est.pnl, fmt)}</span></div>
            <div><span className="text-[11px] text-muted-foreground block">Frais de clôture</span>{fmt(est.closeFee)}</div>
            <div><span className="text-[11px] text-muted-foreground block">Net</span>
              <span className={est.net >= 0 ? "text-emerald-600" : "text-red-500"}>{signed(est.net, fmt)}</span></div>
          </div>
        ) : <p className="text-xs text-muted-foreground">Cours indisponible : clôture au prix serveur.</p>}
        <DialogFooter>
          <button onClick={onClose} className={`${btn} border border-border text-foreground hover:bg-muted/50`}>Garder la position</button>
          <button onClick={confirm} disabled={busy} className={`${btn} bg-red-500 text-white hover:bg-red-600`}>Clôturer</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
