import { MONO } from "../../../shared/ui";

/** Une serie a lister dans l'infobulle. */
export interface TooltipSeries {
  /** cle de la donnee (dataKey de la courbe) */
  key: string;
  label: string;
  color: string;
  format: (v: number) => string;
}

interface Props {
  active?: boolean;
  label?: string | number;
  /** lignes fournies par Recharts pour la seance survolee */
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>;
  series: TooltipSeries[];
}

/**
 * Infobulle commune aux graphiques du module : la date, puis une ligne par serie
 * (trait de la couleur de la courbe, nom, valeur). Les series sans valeur ce jour-la sont omises.
 */
export default function ChartTooltip({ active, label, payload, series }: Props) {
  if (!active || !payload?.length) return null;
  const values = new Map(payload.map((p) => [String(p.dataKey), p.value]));
  const rows = series.filter((s) => typeof values.get(s.key) === "number");
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] text-muted-foreground mb-1" style={MONO}>{label}</p>
      {rows.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-[11px] leading-5">
          <span className="w-3 h-0.5 rounded-full shrink-0" style={{ background: s.color }} />
          <span className="text-muted-foreground">{s.label}</span>
          <span className="ml-auto pl-4 font-semibold text-foreground" style={MONO}>{s.format(values.get(s.key) as number)}</span>
        </div>
      ))}
    </div>
  );
}
