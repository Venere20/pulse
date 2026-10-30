-- Giochi per due: Tris a turni e «Preferisci…?» del giorno, con notifiche.
-- Richiede la migrazione 20261006120000 (Vault, expo_push_outbox): va applicata PRIMA di questa.

-- ---------- 1. Tabelle ----------
CREATE TABLE IF NOT EXISTS public.game_matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game        text        NOT NULL DEFAULT 'tris',
  player_x    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_o    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  board       text        NOT NULL DEFAULT '---------' CHECK (board ~ '^[XO-]{9}$'),
  turn        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'won', 'draw')),
  winner      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (player_x <> player_o)
);

CREATE INDEX IF NOT EXISTS game_matches_created_idx ON public.game_matches (created_at DESC);

CREATE TABLE IF NOT EXISTS public.wyr_answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day         date        NOT NULL,
  question_id integer     NOT NULL,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  choice      smallint    NOT NULL CHECK (choice IN (0, 1)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day, user_id)
);

-- Stessa impostazione delle altre tabelle (policy aperte): si restringono insieme quando arriva il login.
ALTER TABLE public.game_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wyr_answers  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_matches_open ON public.game_matches;
CREATE POLICY game_matches_open ON public.game_matches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS wyr_answers_open ON public.wyr_answers;
CREATE POLICY wyr_answers_open ON public.wyr_answers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Aggiornamenti in tempo reale
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'game_matches') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.game_matches;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wyr_answers') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wyr_answers;
    END IF;
  END IF;
END
$do$;

-- ---------- 2. Invio notifica a un utente (Expo + Web Push) ----------
-- Stessa logica del trigger dei Pulse: l'invio Expo viene registrato in expo_push_outbox,
-- così la pulizia automatica dei token funziona anche per le notifiche dei giochi.
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_tag     text DEFAULT 'game',
  p_url     text DEFAULT '/'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_expo_token  text;
  v_web_sub     jsonb;
  v_req         bigint;
  v_push_secret text;
  v_supabase_url text := 'https://xptsgwcywxphledcafvs.supabase.co';
BEGIN
  SELECT expo_push_token, web_push_subscription
    INTO v_expo_token, v_web_sub
    FROM public.users
   WHERE id = p_user_id;

  IF v_expo_token IS NOT NULL AND v_expo_token <> '' THEN
    v_req := net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'to', v_expo_token,
        'sound', 'default',
        'title', p_title,
        'body', p_body,
        'channelId', 'pulse_alerts',
        'priority', 'high',
        'data', jsonb_build_object('type', p_tag)
      )
    );
    INSERT INTO public.expo_push_outbox (user_id, token, send_request_id)
    VALUES (p_user_id, v_expo_token, v_req);
  END IF;

  IF v_web_sub IS NOT NULL AND v_web_sub <> 'null'::jsonb THEN
    SELECT decrypted_secret INTO v_push_secret
      FROM vault.decrypted_secrets
     WHERE name = 'push_secret'
     LIMIT 1;

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-web-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', COALESCE(v_push_secret, '')
      ),
      body := jsonb_build_object(
        'subscription', v_web_sub,
        'title', p_title,
        'body', p_body,
        'url', p_url,
        'tag', p_tag
      )
    );
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------- 3. Notifiche del Tris ----------
CREATE OR REPLACE FUNCTION public.handle_tris_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_target uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Nuova partita: lo sa l'altro giocatore, non chi l'ha creata
    v_target := CASE
      WHEN NEW.created_by IS NULL THEN NEW.turn
      WHEN NEW.created_by = NEW.player_x THEN NEW.player_o
      ELSE NEW.player_x
    END;

    IF NEW.turn = v_target THEN
      PERFORM public.notify_user(v_target, '🎮 Nuova partita a Tris!', 'Il tuo partner ti ha sfidato: inizi tu.', 'tris', '/#/play/tris');
    ELSE
      PERFORM public.notify_user(v_target, '🎮 Nuova partita a Tris!', 'Il tuo partner ti ha sfidato e fa la prima mossa.', 'tris', '/#/play/tris');
    END IF;
    RETURN NEW;
  END IF;

  -- Mossa: notifica a chi NON ha mosso (il turno, prima della mossa, era di chi ha mosso)
  IF OLD.status = 'playing' AND NEW.board IS DISTINCT FROM OLD.board THEN
    v_target := CASE WHEN OLD.turn = NEW.player_x THEN NEW.player_o ELSE NEW.player_x END;

    IF NEW.status = 'won' THEN
      PERFORM public.notify_user(v_target, '🏆 Tris: ha vinto il partner', 'Rivincita? Una nuova partita ti aspetta.', 'tris', '/#/play/tris');
    ELSIF NEW.status = 'draw' THEN
      PERFORM public.notify_user(v_target, '🤝 Tris: pareggio', 'Nessun vincitore stavolta. Rivincita?', 'tris', '/#/play/tris');
    ELSE
      PERFORM public.notify_user(v_target, '⭕ Tris: tocca a te!', 'Il tuo partner ha fatto la sua mossa.', 'tris', '/#/play/tris');
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS tris_notification ON public.game_matches;
CREATE TRIGGER tris_notification
  AFTER INSERT OR UPDATE ON public.game_matches
  FOR EACH ROW EXECUTE FUNCTION public.handle_tris_notification();

-- ---------- 4. Notifiche di «Preferisci…?» ----------
CREATE OR REPLACE FUNCTION public.handle_wyr_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_target   uuid;
  v_answered boolean;
BEGIN
  SELECT id INTO v_target FROM public.users WHERE id <> NEW.user_id LIMIT 1;
  IF v_target IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.wyr_answers WHERE day = NEW.day AND user_id = v_target
  ) INTO v_answered;

  IF v_answered THEN
    -- Ha già risposto chi riceve la notifica: ora le scelte si sbloccano
    PERFORM public.notify_user(v_target, '💞 Preferisci…? sbloccato', 'Il partner ha risposto: scopri se avete scelto lo stesso!', 'wyr', '/#/play/wyr');
  ELSE
    PERFORM public.notify_user(v_target, '🤔 Preferisci…?', 'Il partner ha già scelto: rispondi per scoprire cosa ha preferito!', 'wyr', '/#/play/wyr');
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS wyr_notification ON public.wyr_answers;
CREATE TRIGGER wyr_notification
  AFTER INSERT ON public.wyr_answers
  FOR EACH ROW EXECUTE FUNCTION public.handle_wyr_notification();
