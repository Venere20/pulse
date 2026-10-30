export interface TriviaQuestion {
  id: number;
  cat: string;
  q: string;
  options: [string, string, string, string];
  /** indice (0-3) della risposta corretta, nell'ordine originale */
  answer: number;
}

type Raw = [string, string, [string, string, string, string], number];

// Domande di cultura generale sul mondo. L'id è la posizione nell'elenco: NON riordinare, solo aggiungere in fondo.
const RAW: Raw[] = [
  ['Geografia', "Qual è la capitale dell'Australia?", ['Sydney', 'Melbourne', 'Canberra', 'Perth'], 2],
  ['Spazio', 'Quale pianeta è chiamato "il pianeta rosso"?', ['Marte', 'Venere', 'Giove', 'Mercurio'], 0],
  ['Geografia', "Qual è l'oceano più grande della Terra?", ['Atlantico', 'Indiano', 'Artico', 'Pacifico'], 3],
  ['Storia', "In che anno l'uomo mise piede sulla Luna per la prima volta?", ['1965', '1969', '1972', '1959'], 1],
  ['Arte', 'Chi dipinse "La notte stellata"?', ['Claude Monet', 'Pablo Picasso', 'Vincent van Gogh', 'Salvador Dalí'], 2],
  ['Geografia', "Qual è il fiume più lungo d'Europa?", ['Danubio', 'Volga', 'Reno', 'Senna'], 1],
  ['Natura', "Qual è l'animale terrestre più veloce?", ['Leone', 'Antilope', 'Ghepardo', 'Cavallo'], 2],
  ['Scienza', 'Quante ossa ha il corpo umano adulto?', ['206', '180', '250', '312'], 0],
  ['Scienza', "Qual è il simbolo chimico dell'oro?", ['Ag', 'Au', 'Or', 'Go'], 1],
  ['Geografia', 'Qual è la montagna più alta del mondo sul livello del mare?', ['K2', 'Kangchenjunga', 'Everest', 'Makalu'], 2],
  ['Geografia', 'In quale Paese si trova Machu Picchu?', ['Perù', 'Bolivia', 'Messico', 'Colombia'], 0],
  ['Cultura', 'Qual è la lingua madre più parlata al mondo?', ['Inglese', 'Spagnolo', 'Hindi', 'Cinese mandarino'], 3],
  ['Letteratura', 'Chi scrisse "Cent\'anni di solitudine"?', ['Mario Vargas Llosa', 'Gabriel García Márquez', 'Jorge Luis Borges', 'Isabel Allende'], 1],
  ['Geografia', 'Qual è il più grande deserto caldo del mondo?', ['Gobi', 'Kalahari', 'Sahara', 'Arabico'], 2],
  ['Spazio', "Cos'è un anno luce?", ['Una misura di tempo', 'Una misura di distanza', 'Una misura di velocità', 'Una misura di luminosità'], 1],
  ['Geografia', 'Qual è il più piccolo Stato del mondo?', ['Monaco', 'San Marino', 'Liechtenstein', 'Città del Vaticano'], 3],
  ['Scienza', "Quale gas è il più abbondante nell'atmosfera terrestre?", ['Ossigeno', 'Azoto', 'Anidride carbonica', 'Argon'], 1],
  ['Scienza', 'Chi formulò la teoria della relatività?', ['Isaac Newton', 'Niels Bohr', 'Albert Einstein', 'Galileo Galilei'], 2],
  ['Geografia', 'In quale Paese si trova la città di Marrakech?', ['Tunisia', 'Egitto', 'Algeria', 'Marocco'], 3],
  ['Geografia', 'Qual è la capitale del Canada?', ['Toronto', 'Ottawa', 'Montréal', 'Vancouver'], 1],
  ['Natura', 'Quanti cuori ha un polpo?', ['1', '2', '3', '8'], 2],
  ['Geografia', 'Quale lago è il più profondo del mondo?', ['Lago Superiore', 'Lago Vittoria', 'Lago Bajkal', 'Lago Tanganica'], 2],
  ['Storia', 'Chi fu il primo uomo nello spazio?', ['Neil Armstrong', 'Jurij Gagarin', 'Buzz Aldrin', 'Alan Shepard'], 1],
  ['Geografia', "Qual è l'isola più grande del mondo?", ['Groenlandia', 'Madagascar', 'Borneo', 'Nuova Guinea'], 0],
  ['Scienza', "Qual è l'organo più grande del corpo umano?", ['Fegato', 'Intestino', 'Pelle', 'Polmone'], 2],
  ['Storia', 'In che anno cadde il Muro di Berlino?', ['1985', '1991', '1987', '1989'], 3],
  ['Cultura', 'Qual è la valuta del Giappone?', ['Won', 'Yen', 'Yuan', 'Baht'], 1],
  ['Letteratura', 'Chi creò il personaggio di Sherlock Holmes?', ['Agatha Christie', 'Edgar Allan Poe', 'Arthur Conan Doyle', 'Charles Dickens'], 2],
  ['Geografia', 'Qual è la capitale della Turchia?', ['Istanbul', 'Ankara', 'Smirne', 'Antalya'], 1],
  ['Scienza', 'Quanti giorni ha un anno bisestile?', ['365', '364', '366', '367'], 2],
  ['Spazio', 'Quale pianeta del Sistema Solare ha gli anelli più evidenti?', ['Giove', 'Urano', 'Nettuno', 'Saturno'], 3],
  ['Geografia', 'Quale fiume attraversa Parigi?', ['Loira', 'Senna', 'Rodano', 'Garonna'], 1],
  ['Geografia', 'Qual è il Paese più esteso del mondo?', ['Canada', 'Cina', 'Russia', 'Stati Uniti'], 2],
  ['Arte', 'Chi dipinse la Gioconda?', ['Michelangelo', 'Raffaello', 'Leonardo da Vinci', 'Botticelli'], 2],
  ['Geografia', 'Qual è la capitale del Brasile?', ['Rio de Janeiro', 'San Paolo', 'Salvador', 'Brasília'], 3],
  ['Arte', 'In quale città si trova la Sagrada Família?', ['Madrid', 'Barcellona', 'Valencia', 'Siviglia'], 1],
  ['Scienza', "Qual è l'osso più lungo del corpo umano?", ['Omero', 'Tibia', 'Femore', 'Perone'], 2],
  ['Natura', 'Qual è il mammifero più grande del mondo?', ['Elefante africano', 'Balenottera azzurra', 'Capodoglio', 'Orso polare'], 1],
  ['Scienza', 'Quale metallo è liquido a temperatura ambiente?', ['Piombo', 'Stagno', 'Mercurio', 'Zinco'], 2],
  ['Geografia', 'Qual è la capitale della Norvegia?', ['Oslo', 'Bergen', 'Stoccolma', 'Helsinki'], 0],
  ['Geografia', "Quale stretto attraversa Istanbul separando Europa e Asia?", ['Dardanelli', 'Bosforo', 'Gibilterra', 'Messina'], 1],
  ['Scienza', 'Quanti minuti ci sono in un giorno?', ['1.200', '1.440', '1.640', '1.240'], 1],
  ['Spazio', 'Qual è la stella più vicina alla Terra?', ['Proxima Centauri', 'Sirio', 'Il Sole', 'Betelgeuse'], 2],
  ['Natura', "Quale animale è il simbolo del WWF?", ['Orso polare', 'Panda gigante', 'Tigre', 'Koala'], 1],
  ['Geografia', "Qual è la capitale dell'Argentina?", ['Santiago', 'Lima', 'Buenos Aires', 'Montevideo'], 2],
  ['Scienza', 'Chi scoprì la penicillina?', ['Louis Pasteur', 'Alexander Fleming', 'Marie Curie', 'Robert Koch'], 1],
  ['Geografia', 'Quale mare bagna Napoli?', ['Adriatico', 'Ionio', 'Tirreno', 'Ligure'], 2],
  ['Cultura', 'Con quale soprannome è nota New York?', ['La Città dei Venti', 'La Grande Mela', 'La Città degli Angeli', 'La Città Eterna'], 1],
  ['Letteratura', 'Chi scrisse la "Divina Commedia"?', ['Petrarca', 'Boccaccio', 'Dante Alighieri', 'Ariosto'], 2],
  ['Geografia', 'Di quale Paese Nairobi è la capitale?', ['Tanzania', 'Kenya', 'Uganda', 'Etiopia'], 1],
  ['Scienza', 'Quale colore si ottiene mescolando blu e giallo?', ['Verde', 'Viola', 'Arancione', 'Marrone'], 0],
  ['Scienza', "Quanti sono i colori dell'arcobaleno?", ['5', '6', '7', '8'], 2],
  ['Storia', 'In che anno iniziò la Rivoluzione francese?', ['1689', '1789', '1815', '1848'], 1],
  ['Spazio', 'Quale pianeta è il più vicino al Sole?', ['Venere', 'Mercurio', 'Marte', 'Terra'], 1],
  ['Cultura', 'Di che colore è la "scatola nera" degli aerei?', ['Nera', 'Rossa', 'Arancione', 'Gialla'], 2],
  ['Geografia', 'Quale oceano bagna la costa orientale degli Stati Uniti?', ['Pacifico', 'Atlantico', 'Indiano', 'Artico'], 1],
  ['Cultura', 'Quale lingua si parla in Brasile?', ['Spagnolo', 'Portoghese', 'Inglese', 'Francese'], 1],
  ['Scienza', 'Qual è la velocità approssimativa della luce nel vuoto?', ['300.000 km/s', '30.000 km/s', '3.000.000 km/s', '150.000 km/s'], 0],
];

export const TRIVIA: TriviaQuestion[] = RAW.map(([cat, q, options, answer], id) => ({ id, cat, q, options, answer }));
