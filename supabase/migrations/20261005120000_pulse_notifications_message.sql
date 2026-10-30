-- Notifiche dei Pulse: aggiunge il messaggio, le risposte e l'apertura dell'app al tocco.
-- Sostituisce il corpo della funzione già collegata al trigger di pulse_logs (nessun trigger da ricreare).
-- Il destinatario ora è "l'altro utente" della tabella users, senza ID scritti nella funzione.

CREATE OR REPLACE FUNCTION public.handle_new_pulse_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_partner_id UUID;
  v_expo_token TEXT;
  v_web_sub JSONB;
  v_payload_expo JSONB;
  v_payload_web JSONB;
  v_title TEXT;
  v_body TEXT;
  v_supabase_url TEXT := 'https://xptsgwcywxphledcafvs.supabase.co';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdHNnd2N5d3hwaGxlZGNhZnZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODIxMDIsImV4cCI6MjEwNjI1ODEwMn0.mdOsmf51XxaSZ8wanhXPuiD-MtPQDajukdnqlK0WuRY';
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

  -- 5. Invio ad Android (Expo)
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

    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := v_payload_expo
    );
  END IF;

  -- 6. Invio a iOS / web (PWA)
  IF v_web_sub IS NOT NULL AND v_web_sub <> 'null'::jsonb THEN
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
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := v_payload_web
    );
  END IF;

  RETURN NEW;
END;
$function$;
