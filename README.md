# Pulse

Uno spazio personale per una coppia: incontri, ricordi privati, desideri, Pulse, giochi e attività condivise. Applicazione Expo SDK 57 / React Native per Android e webapp iPhone.

## Avvio

Node.js e npm: eseguire npm ci, configurare .env partendo da .env.example, poi npm start. Typecheck: npm run typecheck; lint: npm run lint. Per Android configurare il proprio google-services.json, progetto Firebase ed EAS. Non sono inclusi credenziali, contenuti degli utenti, allegati, backup o storia Git privata. Le migrazioni includono funzioni storiche superate da quelle successive: verificarle prima di applicarle a una nuova installazione.

## Percorsi

Il backend journey-plan autentica l’utente e verifica l’accesso all’incontro. Richieste solo su azione esplicita, massimo 120 al giorno per installazione, una al secondo; cache in memoria cinque minuti, senza archiviazione delle risposte complete. La sorgente di calcolo MOTIS viene usata per stime geometriche: nessun fallback in linea d’aria. L’aliscafo Ischia–Beverello usa un riferimento personale dichiarato di 33 km, non un orario verificato. I tratti condivisi contano una volta; andata e ritorno sono distinti. Nessun GPS o monitoraggio nascosto.

Servizio [Transitous](https://transitous.org/api/): uso pubblico non commerciale, aperto e leggero, best effort; può essere interrotto. Il software è MIT; questo non autorizza usi commerciali del servizio Transitous. Per carichi elevati o uso commerciale configurare un servizio appropriato. Contatto: aprire una issue in questo repository.

Dati: [fonti Transitous](https://transitous.org/sources/) e [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Le licenze dei singoli feed e ODbL restano applicabili ai dati. Dipendenze installate tramite npm mantengono le rispettive licenze. Non si distribuisce una copia del database cartografico o degli orari.

## Sicurezza

Configurare Auth, RLS e bucket privati su un proprio progetto Supabase. Non inserire service role, segreti push, token o password nel client. La pubblicazione del codice non pubblica i contenuti dell’installazione originale. Nessuna demo Rottura è inclusa nell’app.
