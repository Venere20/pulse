-- Login con email e password: collegamento account <-> profilo e controlli lato server sulle email.
--
-- Cosa fa:
--   1. users.auth_user_id: collega ogni riga di public.users (i profili esistenti) a un account di login.
--      Gli ID dei profili NON cambiano, quindi incontri, spese, foto, Pulse restano tutti intatti.
--   2. blocked_email_domains + allowed_emails + trigger su auth.users: rifiuta le email temporanee
--      (e, se allowed_emails contiene righe, accetta SOLO quegli indirizzi). Non si aggira dal client.
--   3. Funzioni get_my_profile / list_unclaimed_profiles / claim_profile: il primo accesso collega l'account
--      a uno dei due profili liberi, e solo se l'email e' stata confermata.
--   4. is_couple_member(): usata dalle regole di sicurezza (vedi supabase/manual/rls_lockdown.sql).
--
-- Questa migrazione NON restringe ancora l'accesso ai dati: lo fa lo script manuale, dopo aver verificato il login.

-- ---------- 1. Collegamento account <-> profilo ----------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------- 2. Controlli sulle email in registrazione ----------
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  domain text PRIMARY KEY
);

-- Facoltativo ma consigliato: se contiene righe, possono registrarsi SOLO questi indirizzi.
-- Inserisci le vostre due email:  INSERT INTO public.allowed_emails VALUES ('tu@esempio.it'), ('lei@esempio.it');
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email text PRIMARY KEY
);

ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocked_email_domains FROM anon, authenticated;
REVOKE ALL ON public.allowed_emails FROM anon, authenticated;

INSERT INTO public.blocked_email_domains (domain) VALUES
  ('10minutemail.com'), ('10minutemail.net'), ('10minutemail.org'), ('1secmail.com'), ('1secmail.net'), ('1secmail.org'),
  ('20minutemail.com'), ('33mail.com'), ('anonbox.net'), ('anonymbox.com'), ('armyspy.com'), ('burnermail.io'),
  ('cuvox.de'), ('dayrep.com'), ('discard.email'), ('discardmail.com'), ('disposable.com'), ('dispostable.com'),
  ('dropmail.me'), ('einrot.com'), ('emailfake.com'), ('emailondeck.com'), ('emailtemporanea.com'), ('emailtemporanea.net'),
  ('fakeinbox.com'), ('fakemail.net'), ('fakemailgenerator.com'), ('fleckens.hu'), ('getairmail.com'), ('getnada.com'),
  ('gettempmail.com'), ('grr.la'), ('guerrillamail.biz'), ('guerrillamail.com'), ('guerrillamail.de'), ('guerrillamail.net'),
  ('guerrillamail.org'), ('guerrillamailblock.com'), ('gustr.com'), ('harakirimail.com'), ('inboxbear.com'), ('inboxkitten.com'),
  ('jetable.org'), ('jourrapide.com'), ('mail.tm'), ('mailcatch.com'), ('maildrop.cc'), ('mailforspam.com'),
  ('mailinator.com'), ('mailinator.net'), ('mailinator2.com'), ('mailnesia.com'), ('mailnull.com'), ('mailsac.com'),
  ('mailtemp.info'), ('mintemail.com'), ('moakt.com'), ('mohmal.com'), ('mt2015.com'), ('mytemp.email'),
  ('mytrashmail.com'), ('nada.email'), ('nowmymail.com'), ('sharklasers.com'), ('spam4.me'), ('spambog.com'),
  ('spambox.us'), ('spamgourmet.com'), ('spamex.com'), ('superrito.com'), ('teleworm.us'), ('temp-mail.io'),
  ('temp-mail.org'), ('tempail.com'), ('tempe-mail.com'), ('tempinbox.com'), ('tempmail.com'), ('tempmail.dev'),
  ('tempmail.net'), ('tempmail.plus'), ('tempmailaddress.com'), ('tempmailo.com'), ('tempr.email'), ('throwawaymail.com'),
  ('tmail.ws'), ('tmailor.com'), ('tmpmail.net'), ('tmpmail.org'), ('trash-mail.com'), ('trashmail.com'),
  ('trashmail.de'), ('trashmail.net'), ('trbvm.com'), ('wegwerfmail.de'), ('wegwerfmail.net'), ('yopmail.com'),
  ('yopmail.fr'), ('yopmail.net'), ('zetmail.com')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.guard_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_email  text := lower(btrim(COALESCE(NEW.email, '')));
  v_domain text;
BEGIN
  IF v_email = '' THEN
    RETURN NEW;
  END IF;
  v_domain := split_part(v_email, '@', 2);

  -- Email temporanee: il dominio, o un suo dominio padre, e' nella lista
  IF EXISTS (
    SELECT 1 FROM public.blocked_email_domains b
    WHERE v_domain = b.domain OR v_domain LIKE '%.' || b.domain
  ) THEN
    RAISE EXCEPTION 'Indirizzo email non ammesso: dominio temporaneo';
  END IF;

  -- Elenco chiuso: se ci sono indirizzi autorizzati, solo quelli possono registrarsi
  IF EXISTS (SELECT 1 FROM public.allowed_emails)
     AND NOT EXISTS (SELECT 1 FROM public.allowed_emails a WHERE lower(btrim(a.email)) = v_email) THEN
    RAISE EXCEPTION 'Indirizzo email non autorizzato';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS guard_signup_trg ON auth.users;
CREATE TRIGGER guard_signup_trg
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_signup();

-- Stesso controllo se qualcuno prova a cambiare l'email di un account esistente
DROP TRIGGER IF EXISTS guard_email_change_trg ON auth.users;
CREATE TRIGGER guard_email_change_trg
  BEFORE UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.guard_signup();

-- ---------- 3. Profilo dell'account ----------
-- Profilo (e partner) dell'utente che ha effettuato l'accesso
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (id uuid, name text, partner_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id,
         u.name,
         (SELECT p.id FROM public.users p WHERE p.id <> u.id ORDER BY p.id LIMIT 1)
  FROM public.users u
  WHERE u.auth_user_id = auth.uid();
$$;

-- Profili ancora liberi, visibili solo a chi ha l'email confermata e non ha ancora un profilo
CREATE OR REPLACE FUNCTION public.list_unclaimed_profiles()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.name
  FROM public.users u
  WHERE u.auth_user_id IS NULL
    AND auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id = auth.uid() AND a.email_confirmed_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.users m WHERE m.auth_user_id = auth.uid())
  ORDER BY u.name;
$$;

-- Collega l'account a un profilo libero. Un profilo si puo' reclamare una volta sola.
CREATE OR REPLACE FUNCTION public.claim_profile(p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso richiesto';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Conferma prima il tuo indirizzo email';
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = v_uid) THEN
    RAISE EXCEPTION 'Hai gia'' un profilo collegato';
  END IF;

  UPDATE public.users
     SET auth_user_id = v_uid
   WHERE id = p_profile_id AND auth_user_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profilo non disponibile';
  END IF;
  RETURN p_profile_id;
END;
$fn$;

-- True se chi chiama e' uno dei due profili della coppia (usata dalle policy di sicurezza)
CREATE OR REPLACE FUNCTION public.is_couple_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid());
$$;

-- Queste funzioni le possono chiamare solo gli utenti che hanno effettuato l'accesso
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_unclaimed_profiles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_couple_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_unclaimed_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_couple_member() TO authenticated;
