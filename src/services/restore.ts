import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { memoryPhotoDownloadUrl, memoryPhotoStoragePath } from './memoryPhotos';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const base64ToBytes = (b64: string): Uint8Array => {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n0 = B64.indexOf(clean[i]);
    const n1 = B64.indexOf(clean[i + 1]);
    const n2 = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1;
    const n3 = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    out[o++] = (n0 << 2) | (n1 >> 4);
    if (n2 >= 0) out[o++] = ((n1 & 15) << 4) | (n2 >> 2);
    if (n3 >= 0) out[o++] = ((n2 & 3) << 6) | n3;
  }
  return out.slice(0, o);
};

/** Fa scegliere un file di backup (.json) e ne restituisce il testo. null = annullato. */
export async function pickBackupFile(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        try {
          resolve(await file.text());
        } catch (e) {
          reject(e);
        }
      };
      input.click();
    });
  }

  let picker: any = null;
  try {
    picker = require('expo-document-picker');
  } catch (e) {
    picker = null;
  }
  if (!picker?.getDocumentAsync) {
    throw new Error('Il ripristino non è disponibile in questa versione dell’app. Aggiorna Pulse e riprova.');
  }
  const res = await picker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const response = await fetch(res.assets[0].uri);
  return await response.text();
}

export interface RestoreSummary {
  inserted: Record<string, number>;
  photos: number;
  archiveOnly: number;
  skippedStory: number;
}

// Ordine di inserimento che rispetta i collegamenti tra tabelle; onConflict = chiave univoca della tabella
const PLAN: { table: string; onConflict?: string }[] = [
  { table: 'visits' },
  { table: 'bucket_list' },
  { table: 'visit_bucket_items', onConflict: 'visit_id,bucket_item_id' },
  { table: 'trip_expenses' },
  { table: 'settlements' },
  { table: 'pulse_logs' },
  { table: 'daily_answers', onConflict: 'day,user_id' },
  {table:'couple_settings',onConflict:'user_id'},
  {table:'game_matches'},
  {table:'wyr_answers',onConflict:'day,user_id'},
];

/**
 * Ripristino "non distruttivo": inserisce solo le righe che mancano nel database e non sovrascrive mai quelle esistenti.
 * Le foto mancanti dallo storage vengono ricaricate allo stesso indirizzo.
 */
export async function restoreBackup(text: string, onProgress?: (m: string) => void): Promise<RestoreSummary> {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Il file non è un backup valido (JSON non leggibile).');
  }
  if (data?.app !== 'couples-app' || !data.tables) throw new Error('Il file non sembra un backup di questa app.');

  const inserted: Record<string, number> = {};
  for (const { table, onConflict } of PLAN) {
    const rows: any[] = data.tables[table] || [];
    inserted[table] = 0;
    if (!rows.length) continue;
    onProgress?.(`Ripristino ${table} (${rows.length})...`);
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { data: res, error } = await supabase
        .from(table)
        .upsert(chunk, { onConflict, ignoreDuplicates: true })
        .select();
      if (error) throw new Error(`${table}: ${error.message}`);
      inserted[table] += res?.length || 0;
    }
  }

  let photos = 0;
  const entries = Object.entries(data.photos || {}) as [string, { mime: string; base64: string }][];
  let n = 0;
  for (const [url, p] of entries) {
    n++;
    onProgress?.(`Controllo foto ${n}/${entries.length}...`);
    const path = memoryPhotoStoragePath(url);
    if (!path || !['image/jpeg', 'image/png', 'image/webp'].includes(p?.mime)) continue;
    try {
      let exists = false;
      try { exists = (await fetch(await memoryPhotoDownloadUrl(url), { method: 'HEAD' })).ok; }
      catch { /* Missing file: attempt an authorized insert, never overwrite. */ }
      if (exists) continue;
      const bytes = base64ToBytes(p.base64);
      const { error } = await supabase.storage.from('meetings').upload(path, bytes.buffer as ArrayBuffer, {
        contentType: p.mime || 'image/jpeg',
        upsert: false,
      });
      if (!error) photos++;
    } catch (e) {
      // foto non ripristinabile: si va avanti con le altre
    }
  }

  const story = Array.isArray(data.tables.story_moments) ? data.tables.story_moments : [];
  let skippedStory = 0;
  if (story.length || data.stored_photos?.length) {
    const profile = await supabase.rpc('get_my_profile');
    if (profile.error) throw new Error(profile.error.message);
    const owner = (Array.isArray(profile.data) ? profile.data[0] : profile.data)?.id as string | undefined;
    if (!owner) throw new Error('Accedi al tuo profilo per ripristinare le foto e la storia.');
    const allowed = new Set<string>();
    for (const row of story) if (row.author_id === owner && Array.isArray(row.photo_paths))
      for (const path of row.photo_paths) allowed.add(JSON.stringify(['story-photos', path]));
    for (const row of data.tables.visits ?? []) if (row.cover_storage_path)
      allowed.add(JSON.stringify(['visit-covers', row.cover_storage_path]));
    for (const file of Array.isArray(data.stored_photos) ? data.stored_photos : []) {
      if (!allowed.has(JSON.stringify([file.bucket, file.path])) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mime) || typeof file.base64 !== 'string') continue;
      const bucket = supabase.storage.from(file.bucket);
      const signed = await bucket.createSignedUrl(file.path, 60);
      if (!signed.error && signed.data && (await fetch(signed.data.signedUrl, { method: 'HEAD' })).ok) continue;
      const bytes = base64ToBytes(file.base64);
      const uploaded = await bucket.upload(file.path, bytes.buffer as ArrayBuffer, { contentType: file.mime, upsert: false });
      if (uploaded.error) throw new Error('Impossibile ripristinare una foto della storia o una copertina: ' + uploaded.error.message);
      photos++;
    }
    inserted.story_moments = 0;
    for (const row of story) {
      if (row.author_id !== owner) { skippedStory++; continue; }
      onProgress?.('Ripristino dei tuoi momenti…');
      const saved = await supabase.rpc('restore_story_moment', { p_id: row.id, p_title: row.title, p_day: row.day, p_body: row.body ?? '', p_photo_paths: row.photo_paths ?? [], p_photo_settings: row.photo_settings ?? {}, p_author: row.author_id });
      if (saved.error) throw new Error('Impossibile ripristinare un momento: ' + saved.error.message);
      if (saved.data) inserted.story_moments++;
    }
  }
  const restoredTables = new Set([...PLAN.map(p => p.table), 'story_moments']);
  const archiveOnly = Object.entries(data.tables).filter(([name, rows]) => !restoredTables.has(name) && Array.isArray(rows) && rows.length > 0).length;
  return { inserted, photos, archiveOnly, skippedStory };
}
