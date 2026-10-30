export type TravelMode = 'train' | 'flight' | 'sea' | 'bus' | 'transit' | 'car';

export interface TravelLink {
  id: string;
  mode: TravelMode;
  label: string;
  url: string;
  /** true se l'indirizzo apre già la ricerca con partenza/arrivo/data compilati */
  prefilled: boolean;
}

const enc = encodeURIComponent;

/**
 * Link diretti per cercare orari e prezzi. Non esiste un'API pubblica gratuita con gli orari reali
 * di treni, voli e traghetti: dove possibile la ricerca si apre già compilata (Google Maps, Google Voli,
 * Rome2Rio, che copre anche traghetti e aliscafi); per gli operatori si apre il sito ufficiale.
 */
export const buildTravelLinks = (from: string, to: string, date: string): TravelLink[] => {
  const f = from.trim();
  const t = to.trim();
  return [
    {
      id: 'gmaps-transit',
      mode: 'transit',
      label: 'Mezzi pubblici (treni, bus, traghetti)',
      url: `https://www.google.com/maps/dir/?api=1&origin=${enc(f)}&destination=${enc(t)}&travelmode=transit`,
      prefilled: true,
    },
    {
      id: 'rome2rio',
      mode: 'transit',
      label: 'Rome2Rio (tutti i mezzi, anche via mare)',
      url: `https://www.rome2rio.com/map/${enc(f)}/${enc(t)}`,
      prefilled: true,
    },
    {
      id: 'gmaps-car',
      mode: 'car',
      label: 'Auto (percorso e traffico)',
      url: `https://www.google.com/maps/dir/?api=1&origin=${enc(f)}&destination=${enc(t)}&travelmode=driving`,
      prefilled: true,
    },
    {
      id: 'gflights',
      mode: 'flight',
      label: 'Google Voli',
      url: `https://www.google.com/travel/flights?q=${enc(`Flights from ${f} to ${t} on ${date}`)}`,
      prefilled: true,
    },
    { id: 'trenitalia', mode: 'train', label: 'Trenitalia', url: 'https://www.trenitalia.com/it.html', prefilled: false },
    { id: 'italo', mode: 'train', label: 'Italo', url: 'https://www.italotreno.com/it', prefilled: false },
    { id: 'trainline', mode: 'train', label: 'Trainline', url: 'https://www.thetrainline.com/it', prefilled: false },
    { id: 'flixbus', mode: 'bus', label: 'FlixBus', url: 'https://www.flixbus.it/', prefilled: false },
    { id: 'snav', mode: 'sea', label: 'SNAV (aliscafi e traghetti)', url: 'https://www.snav.it/', prefilled: false },
    { id: 'libertylines', mode: 'sea', label: 'Liberty Lines (aliscafi)', url: 'https://www.libertylines.it/', prefilled: false },
    { id: 'caremar', mode: 'sea', label: 'Caremar (golfo di Napoli)', url: 'https://www.caremar.it/', prefilled: false },
    { id: 'moby', mode: 'sea', label: 'Moby', url: 'https://www.moby.it/', prefilled: false },
    { id: 'tirrenia', mode: 'sea', label: 'Tirrenia', url: 'https://www.tirrenia.it/', prefilled: false },
    { id: 'gnv', mode: 'sea', label: 'GNV', url: 'https://www.gnv.it/', prefilled: false },
    { id: 'directferries', mode: 'sea', label: 'Direct Ferries (confronto traghetti)', url: 'https://www.directferries.it/', prefilled: false },
    { id: 'traghettilines', mode: 'sea', label: 'Traghettilines', url: 'https://www.traghettilines.it/', prefilled: false },
  ];
};

export interface ModeAdvice {
  mode: TravelMode;
  reason: string;
}

/** Consiglio indicativo sul mezzo, in base alla distanza stradale e alla presenza (o no) di un percorso su strada. */
export const adviseModes = (km: number | null, hasRoadRoute: boolean): ModeAdvice[] => {
  if (!hasRoadRoute) {
    return [
      { mode: 'sea', reason: 'Nessun percorso su strada trovato: probabile traversata via mare (traghetto o aliscafo).' },
      { mode: 'flight', reason: 'In alternativa un volo, se il collegamento via mare è lento.' },
    ];
  }
  if (km == null) return [{ mode: 'transit', reason: 'Confronta i mezzi pubblici disponibili.' }];
  if (km <= 80) {
    return [
      { mode: 'car', reason: 'Distanza breve: auto o treno regionale sono i più comodi.' },
      { mode: 'train', reason: 'Treno regionale o bus, senza pensare al parcheggio.' },
    ];
  }
  if (km <= 500) {
    return [
      { mode: 'train', reason: 'Fascia ideale per Frecciarossa/Italo o Intercity, da centro a centro.' },
      { mode: 'car', reason: 'In auto se siete in due o con bagagli; controlla traffico e pedaggi.' },
      { mode: 'bus', reason: 'Il bus a lunga percorrenza costa meno, ma impiega di più.' },
    ];
  }
  return [
    { mode: 'flight', reason: 'Oltre i 500 km il volo fa spesso risparmiare ore; verifica anche il treno notturno.' },
    { mode: 'train', reason: 'Alta velocità se esiste una tratta diretta.' },
    { mode: 'sea', reason: 'Se la meta è su un\'isola, controlla traghetti e aliscafi.' },
  ];
};

export const MODE_LABEL: Record<TravelMode, string> = {
  train: 'Treno',
  flight: 'Volo',
  sea: 'Traghetto / Aliscafo',
  bus: 'Bus',
  transit: 'Mezzi pubblici',
  car: 'Auto',
};
