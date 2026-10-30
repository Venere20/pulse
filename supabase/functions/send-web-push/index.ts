import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.3";

// Chiavi VAPID: SOLO dai secrets di Supabase, mai nel codice.
// Impostale con `node scripts/rotate-vapid.js` (genera una nuova coppia e fa `supabase secrets set`).
const publicVapidKey = Deno.env.get("VAPID_PUBLIC_KEY");
const privateVapidKey = Deno.env.get("VAPID_PRIVATE_KEY");

if (!publicVapidKey || !privateVapidKey) {
  throw new Error(
    "Mancano i secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. Esegui `node scripts/rotate-vapid.js` e ripubblica la funzione.",
  );
}

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:example@yourdomain.com",
  publicVapidKey,
  privateVapidKey,
);

// Client con service role (variabili iniettate automaticamente da Supabase): serve solo a chiedere al
// database se il segreto ricevuto è quello giusto. Il segreto vero non lascia mai il database (Vault).
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status });

serve(async (req) => {
  // BUG-03: la funzione è pubblica (verify_jwt = false), quindi solo la funzione SQL dei Pulse,
  // che conosce il segreto salvato nel Vault, può inviare notifiche.
  const provided = req.headers.get("x-push-secret") ?? "";
  if (!provided) return json({ error: "Unauthorized" }, 401);

  const { data: valid, error: verifyError } = await admin.rpc("verify_push_secret", { p_secret: provided });
  if (verifyError || valid !== true) return json({ error: "Unauthorized" }, 401);

  try {
    const { subscription, title, body, url, tag } = await req.json();
    if (!subscription?.endpoint) return json({ error: "subscription mancante" }, 400);

    const payload = JSON.stringify({
      title: title || "❤️ Hai ricevuto un Pulse!",
      body: body || "Il tuo partner sta pensando a te.",
      icon: "/icon.png",
      badge: "/badge.png",
      url: url || "/",
      tag: tag || "pulse",
    });

    await webpush.sendNotification(subscription, payload);
    return json({ success: true });
  } catch (error) {
    // 404/410: la sottoscrizione non esiste più (app disinstallata o permesso revocato)
    const status = (error as { statusCode?: number }).statusCode;
    return json({ error: (error as Error).message, expired: status === 404 || status === 410 }, 500);
  }
});
