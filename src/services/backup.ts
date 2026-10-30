import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { supabase } from '../config/supabase';
import { localDateStr } from '../utils/dates';
import { memoryPhotoDownloadUrl } from './memoryPhotos';
import { BACKUP_KEYS, EXTENDED_BACKUP_TABLES } from './backupPlan';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const bytesToBase64 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
};

const TABLES = [
  'visits',
  'trip_expenses',
  'settlements',
  'bucket_list',
  'visit_bucket_items',
  'pulse_logs',
  'daily_answers',
  'couple_settings',
  'game_matches','wyr_answers',
] as const;

export interface BackupResult {
  fileName: string;
  rows: Record<string, number>;
  photos: number;
  sizeMb: number;
}

interface Options {
  userId: string;
  includePhotos: boolean;
  includeDeepTalk?:boolean;
  includeCapsules?:boolean;
  onProgress?: (message: string) => void;
}

/** Crea un unico file JSON con incontri, spese, conguagli, bucket list, pulse, risposte e (opzionale) le foto del diario incorporate. */
export async function exportBackup({ userId, includePhotos, includeDeepTalk=false,includeCapsules=false,onProgress }: Options): Promise<BackupResult> {
  const tables: Record<string, any[]> = {};
  const rows: Record<string, number> = {};

  const selectedTables=[...TABLES,...EXTENDED_BACKUP_TABLES,...(includeDeepTalk?['deep_talk_marks','deep_talk_answers']:[]),...(includeCapsules?['time_capsules','capsule_contents']:[])];
  for (const name of selectedTables) {
    onProgress?.(`Leggo ${name}...`);
    tables[name]=[];
    for(let offset=0;;offset+=500){
      let query=supabase.from(name).select('*');for(const key of BACKUP_KEYS[name]??['id'])query=query.order(key);
      const {data,error}=await query.range(offset,offset+499);
      if(error){if(error.code==='42P01'||error.code==='PGRST205')break;throw new Error(`Backup ${name}: ${error.message}`);}
      tables[name].push(...data);if(data.length<500)break;
    }
    rows[name] = tables[name].length;
  }

  const photos: Record<string, { mime: string; base64: string }> = {};
  const privatePhotos:Record<string,{mime:string;base64:string}>={};
  if (includePhotos) {
    const urls = Array.from(
      new Set(
        (tables.visits || []).flatMap((v: any) => (Array.isArray(v.memory_photos) ? v.memory_photos : [])).filter(Boolean)
      )
    ) as string[];
    let n = 0;
    for (const url of urls) {
      n++;
      onProgress?.(`Scarico foto ${n}/${urls.length}...`);
      try {
        const res = await fetch(await memoryPhotoDownloadUrl(url));
        if (!res.ok) throw new Error('Fotografia non disponibile');
        const mime = res.headers.get('content-type') || 'image/jpeg';
        photos[url] = { mime, base64: bytesToBase64(new Uint8Array(await res.arrayBuffer())) };
      } catch {
        throw new Error(`Impossibile includere la foto ${n}/${urls.length}. Riprova oppure scegli un backup senza foto.`);
      }
    }
  }

  const storedPhotos: { bucket: string; path: string; mime: string; base64: string }[] = [];
  if (includePhotos) {
    const files = [
      ...(tables.story_moments ?? []).flatMap(row => (row.photo_paths ?? []).map((path: string) => ({ bucket: 'story-photos', path }))),
      ...(tables.visits ?? []).filter(row => row.cover_storage_path).map(row => ({ bucket: 'visit-covers', path: row.cover_storage_path as string })),
    ];
    const seen = new Set<string>();
    for (const file of files) {
      const key = JSON.stringify([file.bucket, file.path]); if (seen.has(key)) continue; seen.add(key);
      onProgress?.(`Scarico foto della storia e copertine (${seen.size}/${files.length})…`);
      const signed = await supabase.storage.from(file.bucket).createSignedUrl(file.path, 300);
      if (signed.error || !signed.data) throw new Error('Impossibile includere una foto della storia o una copertina. Riprova oppure scegli un backup senza foto.');
      const response = await fetch(signed.data.signedUrl);
      if (!response.ok) throw new Error('Una foto della storia o una copertina non è disponibile.');
      storedPhotos.push({ ...file, mime: response.headers.get('content-type') ?? 'image/jpeg', base64: bytesToBase64(new Uint8Array(await response.arrayBuffer())) });
    }
  }
  if(includeCapsules&&includePhotos){
    for(const path of Array.from(new Set((tables.capsule_contents??[]).flatMap(row=>row.photo_paths??[])))){
      const signed=await supabase.storage.from('capsules').createSignedUrl(path,300);
      if(signed.error||!signed.data)throw new Error('Foto privata non esportabile: '+(signed.error?.message??path));
      const result=await fetch(signed.data.signedUrl);if(!result.ok)throw new Error('Foto privata non disponibile');
      privatePhotos[path]={mime:result.headers.get('content-type')??'image/jpeg',base64:bytesToBase64(new Uint8Array(await result.arrayBuffer()))};
    }
  }

  onProgress?.('Creo il file...');
  const json = JSON.stringify(
    {
      app: 'couples-app',
      version: 2,
      exported_at: new Date().toISOString(),
      exported_by: userId,
      tables,
      photos,
      private_photos:privatePhotos,
      stored_photos: storedPhotos,
      archive_only_tables: [...EXTENDED_BACKUP_TABLES.filter(name => name !== 'story_moments'), ...(includeDeepTalk ? ['deep_talk_marks', 'deep_talk_answers'] : []), ...(includeCapsules ? ['time_capsules', 'capsule_contents'] : [])],
      private_archive:{deep_talk:includeDeepTalk,capsules:includeCapsules,automatic_restore:false},
    },
    null,
    2
  );
  const fileName = `couples-backup-${localDateStr()}.json`;
  const sizeMb = Math.round((json.length / 1024 / 1024) * 10) / 10;

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(href), 5000);
  } else {
    let fs: any = null;
    try {
      fs = require('expo-file-system');
    } catch (e) {
      fs = null;
    }
    if (!fs?.File) {
      throw new Error('La creazione del backup non è disponibile in questa versione dell’app. Aggiorna Pulse e riprova.');
    }
    const file = new fs.File(fs.Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    await file.write(json);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Salva il backup', UTI: 'public.json' });
    } else {
      throw new Error('Condivisione non disponibile su questo dispositivo');
    }
  }

  return { fileName, rows, photos: Object.keys(photos).length + Object.keys(privatePhotos).length + storedPhotos.length, sizeMb };
}
