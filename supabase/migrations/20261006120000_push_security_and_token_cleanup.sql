-- Sicurezza delle notifiche (BUG-03) e pulizia automatica dei token Expo non più validi.
--
-- 1) Il segreto che autorizza `send-web-push` vive nel Vault del database: la funzione dei Pulse lo legge da lì
--    e la Edge Function lo verifica chiamando verify_push_secret() con la service role. Nessun segreto nel codice.
-- 2) Ogni invio Expo viene registrato in expo_push_outbox; un job pg_cron controlla le ricevute di consegna di
--    Expo e, quando risulta DeviceNotRegistered, azzera users.expo_push_token (solo se è ancora lo stesso token).

CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- ---------- 1. Segreto condiviso nel Vault ----------
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_secret') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'push_secret',
      'Segreto condiviso tra il trigger dei Pulse e la Edge Function send-web-push'
    );
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION public.verify_push_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT COALESCE(p_secret, '') <> ''
     AND EXISTS (
       SELECT 1 FROM vault.decrypted_secrets
       WHERE name = 'push_secret' AND decrypted_secret = p_secret
     );
$$;

-- Richiamabile solo dalla service role (la Edge Function), non dal client con la chiave anon.
REVOKE ALL ON FUNCTION public.verify_push_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_push_secret(text) TO service_role;

-- ---------- 2. Registro degli invii Expo ----------
CREATE TABLE IF NOT EXISTS public.expo_push_outbox (
  id                  bigserial PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token               text        NOT NULL,
  send_request_id     bigint,
  ticket_id           text,
  receipts_request_id bigint,
  status              text        NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('sent', 'ticketed', 'receipt_requested', 'done')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expo_push_outbox_status_idx ON public.expo_push_outbox (status, created_at);

-- Tabella interna: RLS attivo e nessuna policy, quindi la chiave anon non può leggerla né scriverla.
ALTER TABLE public.expo_push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expo_push_outbox FROM anon, authenticated;

-- ---------- 3. Trigger dei Pulse: invia con il segreto e registra l'invio Expo ----------
CREATE OR REPLACE FUNCTION public.handle_new_pulse_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_partner_id UUID;
  v_expo_token TEXT;
  v_web_sub JSONB;
  v_payload_expo JSONB;
  v_payload_web JSONB;
  v_title TEXT;
  v_body TEXT;
  v_req BIGINT;
  v_push_secret TEXT;
  v_supabase_url TEXT := 'https://xptsgwcywxphledcafvs.supabase.co';
BEGIN
  -- 1. Testi in base al tipo di Pulse
  CASE COALESCE(NEW.type, 'thinking')
    WHEN 'coffee' THEN
      v_title := '☕ Pausa Caffè?';
      v_body  := 'Il tuo partner vorrebbe un caffè con te!';
    WHEN 'miss_you' THEN
      v_title := '🫂 Mi Manchi!';
      v_body  := 'Il tuo partner ti sta mandando un forte abbraccio.';
    WHEN 'urgent' THEN
      v_title := '⚡ Rispondimi appena puoi!';
      v_body  := 'Il tuo partner ha bisogno di sentirti.';
    ELSE
      v_title := '❤️ Pulse Ricevuto!';
      v_body  := 'Il tuo partner ti sta pensando!';
  END CASE;

  -- 2. Risposta a un Pulse: lo si capisce dal titolo
  IF NEW.reply_to IS NOT NULL THEN
    v_title := 'Risposta: ' || v_title;
  END IF;

  -- 3. Se c'è un messaggio, è il testo della notifica
  IF NEW.message IS NOT NULL AND btrim(NEW.message) <> '' THEN
    v_body := left(btrim(NEW.message), 140);
  END IF;

  -- 4. Destinatario = l'altro utente
  SELECT id INTO v_partner_id
  FROM public.users
  WHERE id <> NEW.sender_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT expo_push_token, web_push_subscription
  INTO v_expo_token, v_web_sub
  FROM public.users
  WHERE id = v_partner_id;

  -- 5. Invio ad Android (Expo) + registrazione per il controllo delle ricevute
  IF v_expo_token IS NOT NULL AND v_expo_token <> '' THEN
    v_payload_expo := jsonb_build_object(
      'to', v_expo_token,
      'sound', 'default',
      'title', v_title,
      'body', v_body,
      'channelId', 'pulse_alerts',
      'priority', 'high',
      'data', jsonb_build_object('type', COALESCE(NEW.type, 'thinking'), 'pulseId', NEW.id)
    );

    v_req := net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := v_payload_expo
    );

    INSERT INTO public.expo_push_outbox (user_id, token, send_request_id)
    VALUES (v_partner_id, v_expo_token, v_req);
  END IF;

  -- 6. Invio a iOS / web (PWA), autenticato con il segreto del Vault
  IF v_web_sub IS NOT NULL AND v_web_sub <> 'null'::jsonb THEN
    SELECT decrypted_secret INTO v_push_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_secret'
    LIMIT 1;

    v_payload_web := jsonb_build_object(
      'subscription', v_web_sub,
      'title', v_title,
      'body', v_body,
      'url', '/',
      'tag', 'pulse'
    );

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-web-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', COALESCE(v_push_secret, '')
      ),
      body := v_payload_web
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------- 4. Pulizia automatica dei token Expo non più validi ----------
-- Restituisce il codice d'errore di un ticket/ricevuta Expo (es. 'DeviceNotRegistered'), altrimenti NULL.
CREATE OR REPLACE FUNCTION public._expo_item_error(p_item jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_item ->> 'status' = 'error' THEN p_item -> 'details' ->> 'error' END;
$$;

REVOKE ALL ON FUNCTION public._expo_item_error(jsonb) FROM PUBLIC, anon, authenticated;

-- Macchina a stati per ogni invio: sent → ticketed → receipt_requested → done
--   sent               invio fatto, in attesa della risposta di Expo (il "ticket")
--   ticketed           ticket ok: dopo qualche minuto si chiedono le ricevute di consegna
--   receipt_requested  ricevute richieste: al giro successivo si leggono e si agisce
-- Ordine nel giro: leggo le ricevute (C), poi i ticket (A), infine chiedo le nuove ricevute (B),
-- perché le chiamate net.http_post sono asincrone e la risposta si legge al giro dopo.
CREATE OR REPLACE FUNCTION public.cleanup_expo_push_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r      record;
  o      record;
  v_resp record;
  v_data jsonb;
  v_item jsonb;
  v_ids  text[];
  v_req  bigint;
BEGIN
  -- C) Ricevute richieste al giro precedente
  FOR r IN
    SELECT DISTINCT receipts_request_id AS req
    FROM public.expo_push_outbox
    WHERE status = 'receipt_requested' AND receipts_request_id IS NOT NULL
  LOOP
    SELECT status_code, content INTO v_resp FROM net._http_response WHERE id = r.req;

    IF v_resp.status_code IS DISTINCT FROM 200 THEN
      -- risposta non ancora disponibile o richiesta fallita: riprova più tardi (entro 24 ore)
      UPDATE public.expo_push_outbox
         SET status = CASE WHEN created_at < now() - interval '24 hours' THEN 'done' ELSE 'ticketed' END,
             receipts_request_id = NULL
       WHERE receipts_request_id = r.req AND status = 'receipt_requested';
      CONTINUE;
    END IF;

    BEGIN
      v_data := (v_resp.content::jsonb) -> 'data';
    EXCEPTION WHEN OTHERS THEN
      v_data := NULL;
    END;

    FOR o IN
      SELECT * FROM public.expo_push_outbox
      WHERE receipts_request_id = r.req AND status = 'receipt_requested'
    LOOP
      v_item := CASE WHEN jsonb_typeof(v_data) = 'object' THEN v_data -> o.ticket_id ELSE NULL END;

      IF v_item IS NULL THEN
        -- ricevuta non ancora pronta: Expo la rende disponibile dopo qualche minuto
        UPDATE public.expo_push_outbox
           SET status = CASE WHEN created_at < now() - interval '24 hours' THEN 'done' ELSE 'ticketed' END,
               receipts_request_id = NULL
         WHERE id = o.id;
      ELSE
        IF public._expo_item_error(v_item) = 'DeviceNotRegistered' THEN
          -- Azzera solo se è ancora lo stesso token: un token nuovo registrato nel frattempo non si tocca.
          UPDATE public.users SET expo_push_token = NULL
           WHERE id = o.user_id AND expo_push_token = o.token;
        END IF;
        UPDATE public.expo_push_outbox SET status = 'done' WHERE id = o.id;
      END IF;
    END LOOP;
  END LOOP;

  -- A) Ticket di risposta all'invio
  FOR o IN
    SELECT * FROM public.expo_push_outbox
    WHERE status = 'sent' AND created_at < now() - interval '1 minute'
  LOOP
    SELECT status_code, content INTO v_resp FROM net._http_response WHERE id = o.send_request_id;

    IF v_resp.status_code IS NULL THEN
      -- risposta non ancora disponibile (o ripulita da pg_net): dopo 2 ore si lascia perdere
      IF o.created_at < now() - interval '2 hours' THEN
        UPDATE public.expo_push_outbox SET status = 'done' WHERE id = o.id;
      END IF;
      CONTINUE;
    ELSIF v_resp.status_code <> 200 THEN
      UPDATE public.expo_push_outbox SET status = 'done' WHERE id = o.id;
      CONTINUE;
    END IF;

    BEGIN
      v_data := (v_resp.content::jsonb) -> 'data';
    EXCEPTION WHEN OTHERS THEN
      v_data := NULL;
    END;

    v_item := CASE jsonb_typeof(v_data)
                WHEN 'array'  THEN v_data -> 0
                WHEN 'object' THEN v_data
                ELSE NULL
              END;

    IF v_item IS NULL THEN
      UPDATE public.expo_push_outbox SET status = 'done' WHERE id = o.id;
    ELSIF v_item ->> 'status' = 'ok' AND v_item ->> 'id' IS NOT NULL THEN
      UPDATE public.expo_push_outbox SET ticket_id = v_item ->> 'id', status = 'ticketed' WHERE id = o.id;
    ELSE
      IF public._expo_item_error(v_item) = 'DeviceNotRegistered' THEN
        UPDATE public.users SET expo_push_token = NULL
         WHERE id = o.user_id AND expo_push_token = o.token;
      END IF;
      UPDATE public.expo_push_outbox SET status = 'done' WHERE id = o.id;
    END IF;
  END LOOP;

  -- B) Chiedo le ricevute dei ticket "ok" più vecchi di 5 minuti (Expo le prepara con un po' di ritardo)
  SELECT array_agg(t) INTO v_ids
  FROM (
    SELECT DISTINCT ticket_id AS t
    FROM public.expo_push_outbox
    WHERE status = 'ticketed' AND ticket_id IS NOT NULL AND created_at < now() - interval '5 minutes'
    LIMIT 500
  ) s;

  IF v_ids IS NOT NULL THEN
    v_req := net.http_post(
      url := 'https://exp.host/--/api/v2/push/getReceipts',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := jsonb_build_object('ids', to_jsonb(v_ids))
    );

    UPDATE public.expo_push_outbox
       SET status = 'receipt_requested', receipts_request_id = v_req
     WHERE status = 'ticketed' AND ticket_id = ANY (v_ids);
  END IF;

  -- Pulizia del registro
  DELETE FROM public.expo_push_outbox WHERE created_at < now() - interval '3 days';
END;
$fn$;

REVOKE ALL ON FUNCTION public.cleanup_expo_push_tokens() FROM PUBLIC, anon, authenticated;

-- Esecuzione ogni 10 minuti (richiede pg_cron; se non è attivo la migrazione prosegue senza job).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-expo-push-tokens',
      '*/10 * * * *',
      $cron$SELECT public.cleanup_expo_push_tokens();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron non attivo: abilitalo da Database > Extensions e ripeti cron.schedule(...)';
  END IF;
END
$do$;
