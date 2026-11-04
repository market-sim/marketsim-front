import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "./ThemeContext";

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
  { value: "system", label: "Comme le système", Icon: Monitor },
];

/** Selecteur clair / sombre / systeme. */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Thème de l'interface" className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5 border border-border/60">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button key={value} type="button" role="radio" aria-checked={active} title={label} onClick={() => setTheme(value)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5" />
            {!compact && <span className="hidden lg:inline">{label === "Comme le système" ? "Auto" : label}</span>}
          </button>
        );
      })}
    </div>
  );
}
