import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.3';
const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
if (vapidPublic && vapidPrivate)
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', vapidPublic, vapidPrivate);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
Deno.serve(async (req) => {
    if (!admin)
        return json({ error: 'Server configuration missing' }, 503);
    const secret = req.headers.get('x-push-secret');
    if (!secret)
        return json({ error: 'Unauthorized' }, 401);
    const batch = await admin.rpc('feature_worker_batch', {
        p_secret: secret,
        p_mode: req.method === 'POST' ? 'dispatch' : 'health',
    });
    if (batch.error)
        return json({ error: 'Worker database operation failed' }, 500);
    if (batch.data?.authorized !== true)
        return json({ error: 'Unauthorized' }, 401);
    if (req.method === 'GET') {
        const checkedAt = batch.data.checked_at;
        const age = checkedAt ? Date.now() - Date.parse(checkedAt) : Infinity;
        return json({ healthy: age < 180000, checked_at: checkedAt ?? null }, age < 180000 ? 200 : 503);
    }
    if (req.method !== 'POST')
        return json({ error: 'Method not allowed' }, 405);
    const jobs = batch.data.jobs ?? [];
    let delivered = 0;
    for (let offset = 0; offset < jobs.length; offset += 5) {
        await Promise.all(jobs.slice(offset, offset + 5).map(async (job: any) => {
            const checkinReady = async () => {
                if (!job.tag.startsWith('checkin')) return true;
                const ready = await admin!.rpc('checkin_notification_ready', { p_notification: job.id });
                // An uncertain check must never send a potentially obsolete alert.
                if (ready.error) return false;
                if (ready.data !== true) {
                    await admin!.from('feature_notifications').update({ cancelled_at: new Date().toISOString(), leased_until: null }).eq('id', job.id).is('delivered_at', null);
                    return false;
                }
                return true;
            };
            if (!await checkinReady()) return;
            if (job.tag === 'game-reminder') {
                const ready = await admin!.rpc('game_reminder_ready', { p_notification: job.id });
                // Recheck after claiming: the player may already have returned/moved.
                if (ready.error) return;
                if (ready.data !== true) {
                    await admin!.from('notification_inbox').delete().eq('id', job.id);
                    await admin!.from('feature_notifications').delete().eq('id', job.id);
                    return;
                }
            }
            let nativeDone = job.expo_done;
            let webDone = job.web_done;
            const errors: string[] = [];
            if (job.expo_token && !nativeDone) {
                try {
                    const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ to: job.expo_token, title: job.title, body: job.body, sound: 'default', priority: 'high', channelId: job.tag.startsWith('checkin') ? 'checkin_alerts' : 'pulse_alerts', data: { type: job.tag, url: job.url } }), signal: AbortSignal.timeout(10000) });
                    if (!res.ok)
                        throw new Error(`Expo HTTP ${res.status}`);
                    const payload = await res.json();
                    const ticket = Array.isArray(payload.data) ? payload.data[0] : payload.data;
                    if (ticket?.status === 'ok' && ticket.id) {
                        nativeDone = true;
                        await admin!.from('feature_push_receipts').upsert({ ticket_id: ticket.id, user_id: job.user_id, token: job.expo_token });
                    }
                    else if (ticket?.details?.error === 'DeviceNotRegistered') {
                        await admin!.from('users').update({ expo_push_token: null }).eq('id', job.user_id).eq('expo_push_token', job.expo_token);
                        errors.push('Native device expired');
                    }
                    else
                        throw new Error(ticket?.details?.error ?? 'Expo rejected delivery');
                }
                catch (e) {
                    errors.push(e instanceof Error ? e.message : 'Native delivery failed');
                }
            }
            if (job.web_subscription && !webDone) {
                // Native delivery may have awaited the provider while the trip changed.
                if (!await checkinReady()) return;
                try {
                    if (!vapidPublic || !vapidPrivate)
                        throw new Error('Web push configuration missing');
                    await webpush.sendNotification(job.web_subscription, JSON.stringify({ title: job.title, body: job.body, tag: job.tag, url: job.url, requireInteraction: job.tag.startsWith('checkin') }), { TTL: job.tag.startsWith('checkin') ? 900 : 86400, urgency: job.tag.startsWith('checkin') ? 'high' : 'normal', timeout: 10000 });
                    webDone = true;
                }
                catch (e) {
                    const status = (e as {
                        statusCode?: number;
                    }).statusCode;
                    if (status === 404 || status === 410)
                        await admin!.from('users').update({ web_push_subscription: null }).eq('id', job.user_id).eq('web_push_subscription', JSON.stringify(job.web_subscription));
                    errors.push(status ? `Web push HTTP ${status}` : 'Web push delivery failed');
                }
            }
            const anyEndpoint = !!job.expo_token || !!job.web_subscription;
            const complete = anyEndpoint && (!job.expo_token || nativeDone) && (!job.web_subscription || webDone);
            if (!anyEndpoint) {
                errors.push('No reachable device');
                if (job.tag.startsWith('checkin') && job.attempts === 1)
                    await admin!.from('checkin_events').insert({ kind: 'undeliverable', actor: job.user_id });
            }
            const result = await admin!.from('feature_notifications').update({ expo_done: nativeDone, web_done: webDone, delivered_at: complete ? new Date().toISOString() : null, dispatched_at: new Date().toISOString(), last_error: errors.join('; ') || null, leased_until: complete ? null : new Date(Date.now() + 120000).toISOString() }).eq('id', job.id);
            if (!result.error && complete)
                delivered++;
        }));
    }
    // Ticket acceptance is not delivery. Check receipts and remove invalid tokens.
    const receipts = batch.data.receipts ?? [];
    if (receipts.length) {
        try {
            const res = await fetch('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: receipts.map((r: any) => r.ticket_id) }), signal: AbortSignal.timeout(10000) });
            if (res.ok) {
                const payload = await res.json();
                for (const r of receipts) {
                    const receipt = payload.data?.[r.ticket_id];
                    if (!receipt)
                        continue;
                    if (receipt.details?.error === 'DeviceNotRegistered')
                        await admin.from('users').update({ expo_push_token: null }).eq('id', r.user_id).eq('expo_push_token', r.token);
                    await admin.from('feature_push_receipts').update({ checked_at: new Date().toISOString(), error: receipt.details?.error ?? null }).eq('ticket_id', r.ticket_id);
                }
            }
        }
        catch { /* Leave unchecked receipts available for the next worker. */ }
    }
    const cleanup = batch.data.cleanup ?? [];
    if (cleanup.length) {
        const paths = cleanup.map((row: { path: string }) => row.path);
        const removed = await admin.storage.from('capsules').remove(paths);
        if (!removed.error)
            await admin.from('capsule_cleanup').delete().in('path', paths);
    }
    return json({ processed: true, claimed: jobs.length, delivered });
});
