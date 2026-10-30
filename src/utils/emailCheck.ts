import { isDisposableDomain } from '../data/disposableDomains';

export type EmailCheck = { ok: true; email: string; domain: string } | { ok: false; message: string };

export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

// Sintassi pratica (non l'RFC completa): parte locale + @ + dominio con almeno un punto e TLD alfabetico.
const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

// Errori di battitura frequenti nei domini più comuni
const COMMON_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotnail.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'libero.con': 'libero.it',
  'libero.it.it': 'libero.it',
  'icloud.con': 'icloud.com',
  'iclod.com': 'icloud.com',
};

/** Controlli offline: sintassi, lunghezze, errori di battitura, domini di email temporanee. */
export const validateEmailSyntax = (raw: string): EmailCheck => {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, message: 'Inserisci il tuo indirizzo email.' };
  if (email.length > 254) return { ok: false, message: 'Indirizzo email troppo lungo.' };

  const at = email.lastIndexOf('@');
  const local = at > 0 ? email.slice(0, at) : '';
  const domain = at > 0 ? email.slice(at + 1) : '';

  if (!EMAIL_RE.test(email) || local.length > 64 || local.startsWith('.') || local.endsWith('.') || email.includes('..')) {
    return { ok: false, message: 'Questo non sembra un indirizzo email valido (es. nome@esempio.it).' };
  }
  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (!/^[a-z]{2,24}$/.test(tld) && !tld.startsWith('xn--')) {
    return { ok: false, message: 'Il dominio dell\'email non è valido.' };
  }

  const typo = COMMON_TYPOS[domain];
  if (typo) return { ok: false, message: `Intendevi @${typo}? Controlla l'indirizzo.` };

  if (isDisposableDomain(domain)) {
    return { ok: false, message: 'Gli indirizzi email temporanei non sono ammessi: usa la tua email vera.' };
  }
  return { ok: true, email, domain };
};

export type Deliverability = 'ok' | 'no-mail' | 'unknown';

interface DnsAnswer {
  type: number;
  data: string;
}
interface DnsResponse {
  Status: number;
  Answer?: DnsAnswer[];
}

const DNS_PROVIDERS = [
  (name: string, type: string) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  (name: string, type: string) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
];

const dnsQuery = async (url: string): Promise<DnsResponse> => {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), 4500);
  try {
    const res = await fetch(url, { headers: { accept: 'application/dns-json' }, signal: ctrl?.signal });
    if (!res.ok) throw new Error('DNS ' + res.status);
    return (await res.json()) as DnsResponse;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Controlla che il dominio possa davvero ricevere posta (record MX, in mancanza A/AAAA).
 * 'unknown' = non siamo riusciti a verificare (offline, DNS non raggiungibile): in quel caso non si blocca nulla,
 * perché la vera prova resta il link di conferma inviato all'indirizzo.
 */
export const checkEmailDeliverable = async (domain: string): Promise<Deliverability> => {
  for (const build of DNS_PROVIDERS) {
    try {
      const mx = await dnsQuery(build(domain, 'MX'));
      if (mx.Status === 3) return 'no-mail'; // dominio inesistente (NXDOMAIN)
      const mxRecords = (mx.Answer || []).filter((a) => a.type === 15);
      if (mxRecords.length > 0) {
        // "0 ." = MX nullo: il dominio dichiara di non ricevere posta
        const real = mxRecords.filter((a) => !/^0\s+\.?$/.test((a.data || '').trim()));
        return real.length > 0 ? 'ok' : 'no-mail';
      }
      // Nessun MX: la posta può comunque arrivare all'indirizzo A/AAAA del dominio
      const a = await dnsQuery(build(domain, 'A'));
      if ((a.Answer || []).some((x) => x.type === 1)) return 'ok';
      const aaaa = await dnsQuery(build(domain, 'AAAA'));
      if ((aaaa.Answer || []).some((x) => x.type === 28)) return 'ok';
      return 'no-mail';
    } catch (e) {
      // provider non raggiungibile: si prova il successivo
    }
  }
  return 'unknown';
};
