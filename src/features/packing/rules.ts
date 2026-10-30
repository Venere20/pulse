import type { Visit } from '../../types/travel';
import type { TripWeather } from '../../utils/weather';
export const packingCategories = { documents: 'Documenti', clothes: 'Abiti', hygiene: 'Igiene', electronics: 'Elettronica', health: 'Salute', other: 'Altro' } as const;
export interface PackingSuggestion {
    source_key: string;
    label: string;
    category: keyof typeof packingCategories;
    quantity: number;
    source: 'suggested';
}
/** Suggestions never mutate an existing list when the forecast changes. */
export function packingSuggestions(visit: Visit, weather: TripWeather | null, climate: 'cold' | 'mild' | 'hot', wishes: string[]): PackingSuggestion[] {
    const nights = Math.max(0, Math.round((Date.parse(visit.end_date) - Date.parse(visit.start_date)) / 86400000));
    const quantity = Math.min(7, nights + 1);
    const temp = weather?.avgTemp ?? ({ cold: 5, mild: 18, hot: 28 }[climate]);
    const rainy = !!weather && (weather.rainChance >= 50 || (weather.code >= 51 && weather.code <= 67) || (weather.code >= 80 && weather.code <= 82) || weather.code >= 95);
    const transport = visit.transport?.toLowerCase() ?? '';
    const plan = wishes.join(' ').toLowerCase();
    const result: PackingSuggestion[] = [];
    const add = (key: string, label: string, category: PackingSuggestion['category'], q = 1, condition = true) => { if (condition)
        result.push({ source_key: key, label, category, quantity: q, source: 'suggested' }); };
    add('id', 'Documento d’identità', 'documents');
    add('wallet', 'Portafoglio', 'documents');
    add('tickets', 'Biglietti e prenotazioni', 'documents', 1, !!transport);
    add('healthcard', 'Tessera sanitaria', 'documents');
    add('insurance', 'Documenti di viaggio', 'documents', 1, transport.includes('aereo'));
    add('shirts', 'Magliette', 'clothes', quantity);
    add('underwear', 'Biancheria intima', 'clothes', quantity);
    add('socks', 'Calze', 'clothes', quantity);
    add('trousers', 'Pantaloni', 'clothes', Math.min(3, Math.ceil(quantity / 3)));
    add('sleepwear', 'Pigiama', 'clothes');
    add('shoes', 'Scarpe comode', 'clothes');
    add('jacket', 'Giacca leggera', 'clothes', 1, temp < 22);
    add('sweater', 'Maglia calda', 'clothes', 1, temp < 18);
    add('coat', 'Giacca pesante', 'clothes', 1, temp < 12);
    add('scarf', 'Sciarpa e guanti', 'clothes', 1, temp < 5);
    add('raincoat', 'Impermeabile', 'clothes', 1, rainy);
    add('umbrella', 'Ombrello', 'other', 1, rainy);
    add('toothbrush', 'Spazzolino e dentifricio', 'hygiene');
    add('deodorant', 'Deodorante', 'hygiene');
    add('washbag', 'Necessaire da bagno', 'hygiene');
    add('towel', 'Asciugamano', 'hygiene', 1, !visit.hotel);
    add('liquids', 'Sacchetto per i liquidi', 'hygiene', 1, transport.includes('aereo'));
    add('charger', 'Caricatore del telefono', 'electronics');
    add('powerbank', 'Batteria portatile', 'electronics', 1, !!transport);
    add('earphones', 'Auricolari', 'electronics');
    add('medicine', 'Farmaci personali, se necessari', 'health');
    add('sunscreen', 'Crema solare', 'hygiene', 1, temp >= 23);
    add('sunglasses', 'Occhiali da sole', 'other', 1, temp >= 23);
    add('water', 'Borraccia', 'other');
    add('snack', 'Uno snack per il viaggio', 'other', 1, !!transport);
    add('laundry', 'Sacchetto per biancheria', 'other', 1, nights > 0);
    add('laundryplan', 'Organizzare un lavaggio', 'other', 1, nights >= 7);
    add('swim', 'Costume da bagno', 'clothes', 1, /mare|piscina|spiaggia|spa/.test(plan));
    add('hiking', 'Scarpe da escursione', 'clothes', 1, /trekking|montagna|escursione/.test(plan));
    add('dinner', 'Un abito per uscire', 'clothes', 1, /cena|teatro|concerto/.test(plan));
    return result;
}
