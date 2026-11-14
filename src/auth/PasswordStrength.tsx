/** Regle du mot de passe (identique au serveur) : 8 caracteres minimum, au moins une lettre et un chiffre. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "8 caractères minimum";
  if (!/\p{L}/u.test(pw)) return "Ajoute au moins une lettre";
  if (!/\d/.test(pw)) return "Ajoute au moins un chiffre";
  return null;
}

/** Score 0 a 4 : longueur, minuscules + majuscules, chiffres, symboles. */
function score(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^\p{L}\d]/u.test(pw)) s++;
  return passwordProblem(pw) ? Math.min(s, 1) : Math.max(s, 2);
}

const LEVELS = [
  { label: "Trop faible", color: "#EF4444" },
  { label: "Faible", color: "#F97316" },
  { label: "Correct", color: "#EAB308" },
  { label: "Bon", color: "#22C55E" },
  { label: "Excellent", color: "#16A34A" },
];

/** Barre de force affichee sous le champ « mot de passe », avec ce qu'il manque pour respecter la regle. */
export default function PasswordStrength({ password }: { password: string }) {
  if (!password) {
    return <p className="mt-1 text-[10.5px] text-muted-foreground">8 caractères minimum, avec au moins une lettre et un chiffre.</p>;
  }
  const s = score(password);
  const problem = passwordProblem(password);
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i < Math.max(1, s) ? LEVELS[s].color : "#94a3b833" }} />
        ))}
      </div>
      <p className="mt-1 text-[10.5px]" style={{ color: LEVELS[s].color }}>
        {LEVELS[s].label}{problem ? ` · ${problem}` : s < 4 ? " · plus long, avec majuscules et symboles, c'est encore mieux" : ""}
      </p>
    </div>
  );
}
