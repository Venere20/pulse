export interface ReleaseNote {
  id: string;
  date: string;
  title: string;
  changes: readonly string[];
}

// Newest first. Add a unique entry with each user-facing publication; never
// reuse an id or edit the meaning of an already published entry.
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    id: '2026-10-30-percorsi-orari', date: '2026-10-30',
    title: 'Correzioni del pianificatore',
    changes: [
      'Il pianificatore chiarisce il formato dell’ora: usa sempre due cifre, per esempio 07:10.',
      'Corretto il recupero degli incontri: il pianificatore riconosce le impostazioni di entrambi i profili.',
    ],
  },
  {
    id: '2026-10-30-grande-aggiornamento', date: '2026-10-30',
    title: 'Più spazio ai vostri ricordi e ai vostri viaggi',
    changes: [
      'Desideri: due elenchi distinti per quelli da realizzare e quelli già realizzati, con filtri e conteggi.',
      'Incontri: puoi correggere manualmente inizio e fine effettivi. Le statistiche si aggiornano senza contare due volte il tempo degli incontri sovrapposti.',
      'Etichetta +18 facoltativa sul singolo incontro, assente da Home e Per noi.',
      'Ricordi degli incontri: fino a cinque foto per ricordo, anche selezionate insieme.',
      'Copertine degli incontri: ritaglio, spostamento, rotazione e scelta fra riquadro fisso e adattivo.',
      'Disegna e indovina: 200 parole nuove, per un totale di 220.',
      'Percorsi: chilometri personali e insieme separati; ogni tratto condiviso conta una sola volta, con andata e ritorno distinti. Puoi correggere anche i vecchi incontri.',
      'Pianificatore: aggiungi e riordina le tappe, cerca stazioni e locali, scegli cammino, metro o treno e indica le soste. Per Ischia puoi includere il riferimento personale di 33 km di aliscafo per direzione.',
      'Ogni partner può scegliere i propri mezzi, inclusi Cammino e Metro. Nuovi obiettivi per 500, 2.000 e 10.000 km percorsi insieme.',
      'Punto di incontro: confronto fra tempi o distanze simili, con chilometri e minuti di entrambi.',
      'Streak: almeno un Pulse ciascuno completa la giornata. Un giorno saltato congela il conteggio, due consecutivi lo azzerano. La data è quella italiana del server. Traguardi a 3, 7 e 30 giornate.',
      'Valigia: categorie, filtri e conteggi per organizzare gli oggetti.',
      'Lavagna: nessuna notifica quando la apri; il partner viene avvisato solo quando il disegno cambia. Sincronizzazione dal vivo conservata.',
      'Caricamenti più leggeri e meno letture ripetute. Migliorate conferme e gestione degli errori.',
      'Questo riepilogo rimane consultabile in I tuoi avvisi → Riepilogo degli aggiornamenti.',
    ],
  },
  {
    id: '2026-10-27-checkin-four-fixes',
    date: '2026-10-27',
    title: 'Check-in: avvisi e preferenze più coerenti',
    changes: [
      'Gli avvisi non più attuali vengono fermati dopo arrivo, annullamento o modifica dell’orario; lo storico resta conservato.',
      'Il margine delle Impostazioni viene usato per i nuovi viaggi. I tragitti salvati mantengono il proprio valore.',
      'Le proroghe che supererebbero le 12 ore sono disattivate e i tragitti personali sono inclusi nell’esportazione dati.',
    ],
  },
  {
    id: '2026-10-27-checkin-future-departures',
    date: '2026-10-27',
    title: 'Scegli anche una partenza futura',
    changes: [
      'Il check-in accetta partenze nelle prossime 24 ore, oltre a quelle già avvenute nelle ultime 12 ore con arrivo ancora futuro.',
      'Prima dell’orario scelto il viaggio mostra «Partenza prevista». Promemoria e avvisi seguono l’arrivo previsto e il margine.',
    ],
  },
  {
    id: '2026-10-27-checkin-favorites-fix',
    date: '2026-10-27',
    title: 'Salvare i tragitti è più semplice',
    changes: [
      'Puoi salvare un tragitto preferito compilando la destinazione: se non scegli un nome, Pulse usa quello della destinazione.',
      'Dopo il salvataggio si apre subito l’elenco dei tuoi tragitti, con il preferito appena aggiunto.',
    ],
  },
  {
    id: '2026-10-27-checkin-v22',
    date: '2026-10-27',
    title: 'Il Check-in si rinnova',
    changes: [
      'Arrivo previsto in evidenza e pulsante principale sempre raggiungibile durante la preparazione e il viaggio.',
      'Tragitti salvati, note, preferenze e storico sono raccolti in sezioni espandibili.',
      'La nuova interfaccia è disponibile su Android e webapp, con le stesse regole di arrivo e notifica.',
    ],
  },
  {
    id: '2026-10-27-checkin-v2',
    date: '2026-10-27',
    title: 'Check-in più semplice per i tuoi tragitti',
    changes: [
      'Salva i tragitti abituali, personalizza durata e margine e riparti senza ricompilare tutto.',
      'La partenza usa l’ora attuale: puoi modificarla e vedere subito l’arrivo previsto.',
      'Prima ricevi un promemoria, poi, se l’arrivo non è confermato entro il margine, Pulse avvisa entrambi. Rimosso il banner nella Home.',
    ],
  },
  {
    id: '2026-10-26-drawguess-v22-partial-eraser',
    date: '2026-10-26',
    title: 'Disegnare e indovinare diventa più semplice',
    changes: [
      'Disegna e indovina: Penna, Forme e Gomma subito visibili, colori rapidi, palette completa e tre spessori.',
      'Chi indovina trova il disegno in primo piano, la risposta sempre raggiungibile e lo storico dei tentativi espandibile.',
      'La gomma di Lavagna e Disegna e indovina cancella solo le porzioni toccate dei tuoi tratti. Le cancellazioni vengono salvate e condivise con il partner.',
    ],
  },
  {
    id: '2026-10-25-emotions-canvas-v2',
    date: '2026-10-25',
    title: 'Come mi sento e Lavagna si rinnovano',
    changes: [
      'Come mi sento: il vostro stato è subito visibile, con sei emozioni iniziali e tutte le dodici disponibili. Frase, durata e notifica sono nei dettagli espandibili.',
      'Lavagna 2.0: più spazio per disegnare e una barra degli strumenti con colori, pennelli, spessori e annullamento. Salvataggio e galleria sono a portata di mano.',
      'La lavagna continua a conservarsi automaticamente e a sincronizzarsi in tempo reale. Le copie nella galleria si salvano soltanto quando lo scegliete.',
    ],
  },
  {
    id: '2026-10-25-canvas-moods-recap',
    date: '2026-10-25',
    title: 'Più modi per esprimervi',
    changes: [
      'Il nostro mese: i desideri realizzati durante un incontro passato compaiono nel mese dell’uscita, anche se li avete segnati come completati più tardi.',
      'Lavagna: 24 colori, gomma per i propri tratti, linee, rettangoli e cerchi con anteprima. Il disegno libero resta in tempo reale.',
      'Come mi sento: puoi condividere anche Infastidito/a, Arrabbiato/a e Dispiaciuto/a.',
      'Sincronizzazione: meno caricamenti duplicati al rientro nell’app e controlli della lavagna che si adattano alla connessione.',
    ],
  },
  {
    id: '2026-10-22-update-summary',
    date: '2026-10-22',
    title: 'Le ultime novità di Pulse',
    changes: [
      'Riepilogo degli aggiornamenti: al primo accesso trovi le modifiche e le nuove funzioni. Dopo averlo chiuso, non ricompare per lo stesso aggiornamento.',
      'Incontri già conclusi: puoi aggiungere uscite del passato dal calendario e ritrovarle nei Ricordi, con le loro date originali.',
      'Notifiche per categoria: il pallino indica solo gli avvisi da leggere della sezione interessata. Capsule e Lavagna sono escluse.',
      'Preferenze alimentari: nelle Impostazioni puoi compilare la tua scheda e leggere quella del partner, comprese le eccezioni.',
    ],
  },
];

export function unseenReleases(seenId: string | null, releases = RELEASE_NOTES): readonly ReleaseNote[] {
  if (!releases.length || seenId === releases[0].id) return [];
  const seen = releases.findIndex(release => release.id === seenId);
  return seen < 0 ? releases.slice(0, 1) : releases.slice(0, seen);
}
