// Promemoria 24h prima dell'incontro per la web app (iPhone/PWA). Da schedulare con pg_cron una volta al giorno.
// Il telefono Android riceve gli stessi promemoria in locale: l'app li sincronizza ad ogni apertura.
// Secrets richiesti: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, (opz.) VAPID_SUBJECT, CRON_SECRET, SEND_EXPO_PUSH
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già forniti da Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com", vapidPublic, vapidPrivate);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Range del giorno dopo in fuso Europe/Rome: start_date è timestamptz
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" });
  const tomorrow = fmt.format(new Date(Date.now() + 24 * 3600 * 1000));
  const dayAfter = fmt.format(new Date(Date.now() + 48 * 3600 * 1000));

  const { data: visits, error } = await supabase
    .from("visits")
    .select("*")
    .gte("start_date", tomorrow)
    .lt("start_date", dayAfter)
    .or("status.is.null,status.neq.concluded")
    .is("ended_at", null)
    .is("started_at", null)
    .is("reminder_sent_at", null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!visits?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  const { data: users } = await supabase.from("users").select("id, expo_push_token, web_push_subscription");
  const { data: bucket } = await supabase
    .from("bucket_list")
    .select("title")
    .or("is_completed.is.null,is_completed.eq.false")
    .order("created_at", { ascending: true })
    .limit(2);
  const bucketTitles = (bucket ?? []).map((b: { title: string }) => b.title);

  let sent = 0;
  for (const v of visits) {
    const parts: string[] = [];
    if (v.arrival_time) parts.push(`Arrivo: ${v.arrival_time}`);
    if (v.hotel) parts.push(`Alloggio: ${v.hotel}`);
    if (bucketTitles.length) parts.push(`Desideri: ${bucketTitles.join(", ")}`);
    const title = `❤️ Domani: ${v.title}`;
    const body = parts.length ? parts.join(" · ") : "Manca un giorno al vostro incontro!";

    for (const u of users ?? []) {
      // Di default il telefono Android usa i promemoria locali (l'app li sincronizza da sola):
      // per inviare anche la push Expo imposta il secret SEND_EXPO_PUSH=true (e ENABLE_LOCAL_REMINDERS = false nell'app).
      if (u.expo_push_token && Deno.env.get("SEND_EXPO_PUSH") === "true") {
        try {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: u.expo_push_token,
              title,
              body,
              sound: "default",
              channelId: "pulse_alerts",
              data: { visitId: v.id },
            }),
          });
          sent++;
        } catch (_e) { /* ignora */ }
      }
      if (u.web_push_subscription && vapidPublic && vapidPrivate) {
        try {
          await webpush.sendNotification(
            u.web_push_subscription,
            JSON.stringify({ title, body, icon: "/icon.png", badge: "/badge.png", url: "/", tag: `visit-${v.id}` }),
          );
          sent++;
        } catch (_e) { /* subscription scaduta */ }
      }
    }

    await supabase.from("visits").update({ reminder_sent_at: new Date().toISOString() }).eq("id", v.id);
  }

  return new Response(JSON.stringify({ sent }), { status: 200, headers: { "Content-Type": "application/json" } });
});
