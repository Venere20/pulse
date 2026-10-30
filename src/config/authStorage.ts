// Archivio della sessione di login per l'app nativa.
// Usa expo-file-system (già presente nel progetto) invece di AsyncStorage, così non serve ricompilare il dev client.
// Su web Supabase usa direttamente localStorage e questo file non viene usato.

const FILE_PREFIX = 'sb-auth-';

// Se il modulo non fosse disponibile, la sessione resta solo in memoria (si riesegue il login a ogni avvio).
const memory = new Map<string, string>();

let fsModule: any = null;
const getFs = (): any => {
  if (fsModule === null) {
    try {
      fsModule = require('expo-file-system');
    } catch (e) {
      fsModule = false;
    }
  }
  return fsModule && fsModule.File && fsModule.Paths ? fsModule : null;
};

const fileFor = (fs: any, key: string) =>
  new fs.File(fs.Paths.document, FILE_PREFIX + key.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.json');

export const nativeAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const fs = getFs();
    if (!fs) return memory.get(key) ?? null;
    try {
      const file = fileFor(fs, key);
      if (!file.exists) return null;
      return await file.text();
    } catch (e) {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    const fs = getFs();
    if (!fs) {
      memory.set(key, value);
      return;
    }
    try {
      const file = fileFor(fs, key);
      if (file.exists) file.delete();
      file.create();
      await file.write(value);
    } catch (e) {
      memory.set(key, value);
      console.warn('Sessione non salvata su disco:', e);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    memory.delete(key);
    const fs = getFs();
    if (!fs) return;
    try {
      const file = fileFor(fs, key);
      if (file.exists) file.delete();
    } catch (e) {}
  },
};
