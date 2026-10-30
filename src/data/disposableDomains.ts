// Domini di email temporanee / usa e getta, rifiutati in registrazione.
// Controllo di cortesia lato app: quello vero è il trigger del database (tabella blocked_email_domains),
// che ha la stessa lista e non si può aggirare dal client. Nessuna lista è completa: per questo ci sono anche
// la verifica del dominio (MX) e, soprattutto, il link di conferma inviato via email.
export const DISPOSABLE_DOMAINS: string[] = [
  '10minutemail.com', '10minutemail.net', '10minutemail.org', '1secmail.com', '1secmail.net', '1secmail.org',
  '20minutemail.com', '33mail.com', 'anonbox.net', 'anonymbox.com', 'armyspy.com', 'burnermail.io',
  'cuvox.de', 'dayrep.com', 'discard.email', 'discardmail.com', 'disposable.com', 'dispostable.com',
  'dropmail.me', 'einrot.com', 'emailfake.com', 'emailondeck.com', 'emailtemporanea.com', 'emailtemporanea.net',
  'fakeinbox.com', 'fakemail.net', 'fakemailgenerator.com', 'fleckens.hu', 'getairmail.com', 'getnada.com',
  'gettempmail.com', 'grr.la', 'guerrillamail.biz', 'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamailblock.com', 'gustr.com', 'harakirimail.com', 'inboxbear.com', 'inboxkitten.com',
  'jetable.org', 'jourrapide.com', 'mail.tm', 'mailcatch.com', 'maildrop.cc', 'mailforspam.com',
  'mailinator.com', 'mailinator.net', 'mailinator2.com', 'mailnesia.com', 'mailnull.com', 'mailsac.com',
  'mailtemp.info', 'mintemail.com', 'moakt.com', 'mohmal.com', 'mt2015.com', 'mytemp.email',
  'mytrashmail.com', 'nada.email', 'nowmymail.com', 'sharklasers.com', 'spam4.me', 'spambog.com',
  'spambox.us', 'spamgourmet.com', 'spamex.com', 'superrito.com', 'teleworm.us', 'temp-mail.io',
  'temp-mail.org', 'tempail.com', 'tempe-mail.com', 'tempinbox.com', 'tempmail.com', 'tempmail.dev',
  'tempmail.net', 'tempmail.plus', 'tempmailaddress.com', 'tempmailo.com', 'tempr.email', 'throwawaymail.com',
  'tmail.ws', 'tmailor.com', 'tmpmail.net', 'tmpmail.org', 'trash-mail.com', 'trashmail.com',
  'trashmail.de', 'trashmail.net', 'trbvm.com', 'wegwerfmail.de', 'wegwerfmail.net', 'yopmail.com',
  'yopmail.fr', 'yopmail.net', 'zetmail.com',
];

const SET = new Set(DISPOSABLE_DOMAINS);

/** true se il dominio (o un suo dominio padre, es. "x.mailinator.com") è nella lista. */
export const isDisposableDomain = (domain: string): boolean => {
  const parts = domain.toLowerCase().split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (SET.has(parts.slice(i).join('.'))) return true;
  }
  return false;
};
