export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // limite del sistema di cifratura usato da Supabase (bcrypt)

// Stesso insieme di simboli accettato da Supabase quando si attivano i requisiti password sul progetto
const SYMBOLS = /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/;

export interface PasswordRule {
  id: 'len' | 'upper' | 'lower' | 'digit' | 'symbol' | 'email';
  label: string;
  ok: boolean;
}

/** Elenco dei requisiti con lo stato di ciascuno (per la lista in tempo reale mentre si digita). */
export const passwordRules = (pw: string, email?: string): PasswordRule[] => {
  const rules: PasswordRule[] = [
    { id: 'len', label: `Almeno ${PASSWORD_MIN} caratteri`, ok: pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX },
    { id: 'upper', label: 'Una lettera maiuscola (A-Z)', ok: /[A-Z]/.test(pw) },
    { id: 'lower', label: 'Una lettera minuscola (a-z)', ok: /[a-z]/.test(pw) },
    { id: 'digit', label: 'Un numero (0-9)', ok: /[0-9]/.test(pw) },
    { id: 'symbol', label: 'Un simbolo (! ? @ # $ % & * ...)', ok: SYMBOLS.test(pw) },
  ];
  const local = (email || '').split('@')[0].toLowerCase();
  if (local.length >= 4) {
    rules.push({ id: 'email', label: 'Non contiene il tuo indirizzo email', ok: !pw.toLowerCase().includes(local) });
  }
  return rules;
};

/** Restituisce un messaggio d'errore, oppure null se la password rispetta tutti i requisiti. */
export const validatePassword = (pw: string, email?: string): string | null => {
  if (pw.length > PASSWORD_MAX) return `La password può avere al massimo ${PASSWORD_MAX} caratteri.`;
  const failed = passwordRules(pw, email).filter((r) => !r.ok);
  if (failed.length === 0) return null;
  return 'La password deve avere: ' + failed.map((r) => r.label.charAt(0).toLowerCase() + r.label.slice(1)).join(', ') + '.';
};
