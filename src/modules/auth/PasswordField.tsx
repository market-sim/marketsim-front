import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass, labelClass } from "./AuthLayout";
import { passwordStrength } from "./userLogic";

/** Champ mot de passe avec bouton afficher / masquer et, en option, une jauge de robustesse. */
export default function PasswordField({ label, value, onChange, autoComplete, showStrength = false, required = false, invalid = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  showStrength?: boolean;
  required?: boolean;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(value);
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <input type={visible ? "text" : "password"} autoComplete={autoComplete} required={required} value={value}
          onChange={(e) => onChange(e.target.value)} className={`${inputClass} pr-10 ${invalid ? "border-red-400" : ""}`} />
        <button type="button" onClick={() => setVisible((v) => !v)} tabIndex={-1}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-1 rounded-full ${i <= Math.max(1, strength.score) ? strength.color : "bg-muted"}`} />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground w-16 text-right">{strength.label}</span>
        </div>
      )}
    </div>
  );
}
