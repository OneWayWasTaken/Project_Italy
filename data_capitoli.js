/* ============================================================================
 * data_capitoli.js — struttura della campagna: capitoli, incontri, dungeon a nodi, oggetti, banner del gacha, codex.
 * Tabelle pure. I testi delle scene sono in data_scene.js.
 *
 * Dungeon di un capitolo: `strati` = elenco di strati; a ogni strato il giocatore sceglie UN nodo tra le opzioni.
 *   nodo: { tipo: 'combattimento'|'elite'|'evento'|'negozio'|'riposo'|'boss', incontro?, scena? }
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi;

  /* ---------- Incontri della campagna ---------- */
  const inc = (id, nome, nemici, extra) => { E.INCONTRI[id] = Object.assign({ id, nome, nemici, campagna: true }, extra || {}); };
  // I
  inc('cap1_c1', 'Pattuglia di Canne', ['eco_cartaginese', 'legionario']);
  inc('cap1_c2', 'Gli Elefanti nella Nebbia', ['elefante', 'eco_cartaginese', 'legionario']);
  inc('cap1_c3', 'Retroguardia Cartaginese', ['eco_cartaginese', 'elefante', 'eco_cartaginese'], { scalaPv: 1.1 });
  inc('cap1_boss', 'Annibale, Eco di Canne', ['annibale']);
  // II
  inc('cap2_c1', "Sabbia dell'Arena", ['gladiatore_fumante', 'pretoriano_ombra']);
  inc('cap2_c2', 'Vicoli in Fiamme', ['eco_rogo', 'gladiatore_fumante', 'pretoriano_ombra']);
  inc('cap2_c3', 'La Guardia del Palazzo', ['pretoriano_ombra', 'eco_rogo', 'pretoriano_ombra'], { scalaPv: 1.1 });
  inc('cap2_boss', "Nerone, Eco dell'Incendio", ['nerone'], { scalaDan: 0.65 });
  // III
  inc('cap3_c1', 'Mura del Comune', ['milizia_torre', 'falconiere_tetro']);
  inc('cap3_c2', 'Strada dei Mercenari', ['mercenario_ventura', 'milizia_torre', 'falconiere_tetro']);
  inc('cap3_c3', 'Piazza della Torre', ['mercenario_ventura', 'mercenario_ventura', 'milizia_torre'], { scalaPv: 1.1 });
  inc('cap3_boss', 'Ezzelino, Eco della Torre', ['ezzelino'], { scalaDan: 0.6 });
  // IV
  inc('cap4_c1', 'Vicoli di Firenze', ['bargello_cieco', 'fantasma_artista']);
  inc('cap4_c2', 'Bottega Perduta', ['fantasma_artista', 'condottiero_ombra', 'bargello_cieco']);
  inc('cap4_c3', 'La Piazza del Falò', ['condottiero_ombra', 'bargello_cieco', 'fantasma_artista'], { scalaPv: 1.1 });
  inc('cap4_boss', 'Savonarola, Eco del Falò', ['savonarola'], { scalaDan: 0.6 });
  // V
  inc('cap5_c1', 'Barricate di Milano', ['granatiere_bianco', 'patriota_frainteso']);
  inc('cap5_c2', 'Cospiratori in Maschera', ['spia_restaurazione', 'granatiere_bianco', 'patriota_frainteso']);
  inc('cap5_c3', 'La Linea Austriaca', ['granatiere_bianco', 'spia_restaurazione', 'granatiere_bianco'], { scalaPv: 1.1 });
  inc('cap5_boss', 'Radetzky, Eco delle Cinque Giornate', ['radetzky'], { scalaDan: 0.5 });
  // VI
  inc('cap6_c1', 'Trincea del Carso', ['eco_trincea', 'fante_fango']);
  inc('cap6_c2', 'Terra di Nessuno', ['cecchino_senza_nome', 'eco_trincea', 'fante_fango']);
  inc('cap6_c3', 'Altopiano Spezzato', ['eco_trincea', 'cecchino_senza_nome', 'eco_trincea'], { scalaPv: 1.1 });
  inc('cap6_boss', "L'Eco dell'Isonzo", ['isonzo'], { scalaDan: 0.55 });
  // VII (Echi astratti: paura, obbedienza, indifferenza)
  inc('cap7_c1', 'Strade Deserte', ['eco_paura', 'eco_obbedienza']);
  inc('cap7_c2', 'Finestre Chiuse', ['eco_indifferenza', 'eco_paura', 'eco_obbedienza']);
  inc('cap7_c3', 'Il Lungo Corridoio', ['eco_obbedienza', 'eco_indifferenza', 'eco_paura'], { scalaPv: 1.1 });
  inc('cap7_boss', 'Il Silenzio', ['silenzio'], { scalaDan: 0.6, npc: ['testimone', 'testimone2'], obiettivo: { tipo: 'sopravvivi', turni: 10, proteggi: true },
    desc: 'Non si sconfigge: proteggi i Testimoni per 10 turni.' });

  /* ---------- Oggetti (consumabili del dungeon) ---------- */
  E.OGGETTI = {
    pozione:        { nome: 'Pozione di Memoria', icona: '⚗', desc: 'Cura il 35% dei PV di una Voce.', tipo: 'cura', n: 0.35, prezzo: 40, bers: 'voce' },
    pozione_grande: { nome: 'Elisir della Storia', icona: '⚗', desc: 'Cura il 70% dei PV di una Voce.', tipo: 'cura', n: 0.70, prezzo: 75, bers: 'voce' },
    incenso:        { nome: 'Incenso di Fede', icona: '✚', desc: '+20 Sanità a tutta la squadra.', tipo: 'sanita', n: 20, prezzo: 35, bers: 'squadra' },
    talismano:      { nome: "Talismano d'Ardore", icona: '◆', desc: '+1 Ardore a inizio della prossima battaglia.', tipo: 'ardore', n: 1, prezzo: 50, bers: 'squadra' },
    benedizione:    { nome: 'Benedizione Antica', icona: '☀', desc: '+2 Voto a tutta la squadra a inizio della prossima battaglia.', tipo: 'voto', n: 2, prezzo: 45, bers: 'squadra' }
  };

  /* ---------- Capitoli ---------- */
  const lay = (cap) => [
    [{ tipo: 'combattimento', incontro: cap + '_c1' }],
    [{ tipo: 'combattimento', incontro: cap + '_c2' }, { tipo: 'evento', scena: cap + '_ev1' }],
    [{ tipo: 'negozio' }, { tipo: 'riposo' }],
    [{ tipo: 'elite', incontro: cap + '_c3' }, { tipo: 'evento', scena: cap + '_ev2' }],
    [{ tipo: 'riposo' }, { tipo: 'negozio' }],
    [{ tipo: 'boss', incontro: cap + '_boss' }]
  ];
  const cap = (n, num, epoca, eco, boss, voci, premio, descr, dan) => ({
    id: 'cap' + n, num, epoca, eco, boss, voci, descr, scalaDan: dan, scalaPv: 1,
    prologo: 'cap' + n + '_prologo', bossPre: 'cap' + n + '_boss', epilogo: 'cap' + n + '_epilogo', strati: lay('cap' + n),
    ricompensa: premio, codex: ['cap' + n + '_a', 'cap' + n + '_b']
  });
  E.CAPITOLI = [
    cap(1, 'I', 'Roma repubblicana', "L'Eco di Canne", 'annibale', ['scipione', 'spartaco'], { denari: 150, sigilli: 12, voce: 'augusto' }, "216 a.C.: Canne, la più grave sconfitta di Roma. Un ricordo che ogni versione della storia ha raccontato a modo suo.", 1.0),
    cap(2, 'II', 'Impero', "L'Eco dell'Incendio", 'nerone', ['augusto', 'perpetua'], { denari: 180, sigilli: 12, voce: 'federico' }, "64 d.C.: Roma brucia. Chi appiccò il fuoco? E chi pagò per colpe che forse non aveva?", 1.02),
    cap(3, 'III', 'Medioevo e Comuni', "L'Eco della Torre", 'ezzelino', ['federico', 'matilde'], { denari: 210, sigilli: 12, voce: 'matilde' }, "Dalla neve di Canossa alle torri dei tiranni: il Medioevo italiano tra papi, imperatori e Comuni.", 1.04),
    cap(4, 'IV', 'Rinascimento', "L'Eco del Falò", 'savonarola', ['leonardo', 'caterina'], { denari: 240, sigilli: 12, voce: 'caterina' }, "Firenze, 1497: l'arte, le idee e un falò di vanità. Quanto costa difendere la bellezza?", 1.06),
    cap(5, 'V', 'Risorgimento', "L'Eco delle Cinque Giornate", 'radetzky', ['garibaldi', 'cavour'], { denari: 270, sigilli: 12, voce: 'garibaldi' }, "Milano 1848, i Mille, Teano: l'Italia si fa, ma a quale prezzo e per chi?", 1.08),
    cap(6, 'VI', 'Prima guerra mondiale', "L'Eco del Carso", 'isonzo', ['baracca', 'mentil'], { denari: 300, sigilli: 12, voce: 'baracca' }, "Dodici battaglie dell'Isonzo e una guerra fatta di fango, fame e silenzi: eroi e vittime nello stesso fronte.", 1.1),
    cap(7, 'VII', 'Seconda guerra mondiale', "L'Eco del Silenzio", 'silenzio', ['perlasca', 'anselmi', 'bartali'], { denari: 400, sigilli: 20, voce: 'perlasca' }, "Dilemmi, paure e atti di coraggio silenziosi: la storia di chi scelse, e di chi scelse di non scegliere.", 1.12)
  ];
  // Voci sbloccate dal completamento dei capitoli (le altre arrivano dal gacha)
  E.CAPITOLI[2].ricompensa.voce2 = null;
  E.CAPITOLI[4].ricompensa.voce2 = 'cavour';
  E.CAPITOLI[5].ricompensa.voce2 = 'mentil';
  E.CAPITOLI[6].ricompensa.voce2 = 'anselmi'; E.CAPITOLI[6].ricompensa.voce3 = 'bartali';
  /** Calibrazione della difficoltà (PV finali dei nemici): cresce lentamente, i giocatori crescono con livelli Eco e nuove Voci. */
  const PV = { gladiatore_fumante: 175, pretoriano_ombra: 190, eco_rogo: 150, milizia_torre: 190, mercenario_ventura: 180, falconiere_tetro: 160, guardia_ezzelino: 120,
    bargello_cieco: 205, condottiero_ombra: 195, fantasma_artista: 180, granatiere_bianco: 215, spia_restaurazione: 195, patriota_frainteso: 210,
    eco_trincea: 235, fante_fango: 230, cecchino_senza_nome: 205, eco_obbedienza: 250, eco_paura: 240, eco_indifferenza: 265,
    nerone: 500, ezzelino: 560, savonarola: 560, radetzky: 500, isonzo: 640, silenzio: 900 };
  Object.keys(PV).forEach(k => { E.NEMICI[k].pv = PV[k]; });
  /** Voci possedute all'inizio di una nuova partita. */
  E.ROSTER_INIZIALE = ['scipione', 'spartaco', 'perpetua', 'leonardo'];

  /* ---------- Gacha: banner e tassi ---------- */
  E.GACHA = {
    COSTO_1: 1, COSTO_10: 10,
    RATE: { 5: 0.05, 4: 0.25, 3: 0.70 },
    PITY_SOFT: 60, PITY_HARD: 80,
    SIGILLI_INIZIALI: 30,
    MAX_LV: 5
  };
  E.BANNER = [
    { id: 'standard', nome: "Voci dell'Archivio", desc: 'Tutte le Voci, senza vantaggi.', evidenza: [], colore: '#e0b43a' },
    { id: 'roma', nome: 'Echi di Roma', desc: 'Scipione e Augusto in evidenza (Gloria e Ordine).', evidenza: ['scipione', 'augusto'], colore: '#b3302a' },
    { id: 'rinascita', nome: 'Luce del Rinascimento', desc: 'Leonardo e Caterina in evidenza (Ingegno e Sangue).', evidenza: ['leonardo', 'caterina'], colore: '#e0722e' },
    { id: 'unita', nome: "Nascita dell'Italia", desc: 'Garibaldi e Cavour in evidenza (Gloria e Astuzia).', evidenza: ['garibaldi', 'cavour'], colore: '#5ec28a' },
    { id: 'novecento', nome: 'Voci del Novecento', desc: 'Perlasca e Bartali in evidenza (Astuzia e Fede).', evidenza: ['perlasca', 'bartali'], colore: '#8fb4e8' }
  ];

  /* ---------- Codex: schede storiche sbloccate dai capitoli (storia vera + cosa è inventato nel gioco) ---------- */
  E.CODEX = {
    cap1_a: { cap: 1, titolo: 'La battaglia di Canne (216 a.C.)', testo: "Il 2 agosto del 216 a.C., durante la seconda guerra punica, l'esercito cartaginese di Annibale accerchiò e distrusse un'enorme armata romana in Puglia. È considerata una delle più gravi sconfitte della storia di Roma e un esempio di manovra di accerchiamento.", nota: "Nel gioco Annibale è un Eco: le sue parole sono inventate." },
    cap1_b: { cap: 1, titolo: 'La rivolta di Spartaco (73–71 a.C.)', testo: "Spartaco, gladiatore di origine tracia, guidò la più grande rivolta di schiavi della Roma repubblicana. Sconfitto da Crasso, morì in battaglia; molti seguaci furono crocifissi lungo la via Appia.", nota: "Carattere e dialoghi di Spartaco sono inventati." },
    cap2_a: { cap: 2, titolo: "L'incendio di Roma (64 d.C.)", testo: "Un incendio devastò gran parte di Roma per circa nove giorni. Gli storici antichi discutono le cause: Tacito riferisce che Nerone diede la colpa ai cristiani, ma sulle sue responsabilità dirette non c'è certezza.", nota: "Il gioco non decide se Nerone fu colpevole." },
    cap2_b: { cap: 2, titolo: 'Vibia Perpetua (203 d.C.)', testo: "Giovane donna di Cartagine, catechista, arrestata e condannata alle belve. Le è attribuito un diario in carcere, la «Passio Perpetuae».", nota: "Le parole di Perpetua nel gioco sono inventate." },
    cap3_a: { cap: 3, titolo: 'Canossa (1077)', testo: "Il re Enrico IV, scomunicato da papa Gregorio VII, attese per alcuni giorni davanti al castello di Canossa, dove si trovava il papa ospite di Matilde. Il perdono fu un passo importante nello scontro tra Papato e Impero.", nota: "Matilde fu mediatrice; i dettagli dei dialoghi sono inventati." },
    cap3_b: { cap: 3, titolo: 'Ezzelino III da Romano (1194–1259)', testo: "Signore ghibellino della Marca Trevigiana, noto per la durezza del suo governo. Fu scomunicato e combattuto da una crociata; morì dopo la sconfitta di Cassano.", nota: "Gli Echi dei sudditi sono simbolici." },
    cap4_a: { cap: 4, titolo: 'Il falò delle vanità (1497)', testo: "A Firenze, durante il predominio di Savonarola, furono bruciati in piazza libri, abiti, specchi e opere considerate immorali. Savonarola fu poi condannato e giustiziato nel 1498.", nota: "L'Eco di Savonarola non giudica l'uomo reale." },
    cap4_b: { cap: 4, titolo: 'Caterina Sforza (1463–1509)', testo: "Signora di Imola e Forlì, resistette nella rocca di Ravaldino all'esercito di Cesare Borgia (1499-1500). Fu una delle figure politiche femminili più note del Rinascimento.", nota: "Le sue abilità di gioco sono inventate." },
    cap5_a: { cap: 5, titolo: 'Le Cinque Giornate di Milano (1848)', testo: "Dal 18 al 22 marzo 1848 i milanesi insorsero contro il governo austriaco e costrinsero il maresciallo Radetzky a ritirarsi dalla città, che riconquistò poi nell'agosto seguente.", nota: "Radetzky è qui un Eco, non un giudizio sull'uomo." },
    cap5_b: { cap: 5, titolo: 'Bronte (1860)', testo: "Durante la spedizione dei Mille, a Bronte una rivolta contadina fu repressa duramente dalle truppe garibaldine al comando di Nino Bixio. Un episodio che mostra come l'Unità abbia avuto anche costi sociali.", nota: "Il gioco ne fa un dilemma, non una condanna." },
    cap6_a: { cap: 6, titolo: "Le battaglie dell'Isonzo (1915–1917)", testo: "Dodici battaglie lungo l'Isonzo tra Italia e Austria-Ungheria, con enormi perdite e piccoli guadagni territoriali. La disciplina fu durissima, e le decimazioni furono documentate in diversi reparti.", nota: "L'Eco dell'Isonzo è un'entità simbolica." },
    cap6_b: { cap: 6, titolo: 'Le portatrici carniche', testo: "Donne della Carnia che portarono rifornimenti ai soldati sulle montagne del fronte, a piedi e con le gerle. Maria Plozner Mentil morì nel 1916 colpita da un cecchino.", nota: "Il suo carattere nel gioco è inventato." },
    cap7_a: { cap: 7, titolo: 'Giorgio Perlasca (1910–1992)', testo: "Commerciante italiano che a Budapest nel 1944, spacciandosi per console spagnolo, contribuì a salvare migliaia di ebrei dalla deportazione. Riconosciuto Giusto tra le Nazioni.", nota: "Le parole di Perlasca nel gioco sono inventate." },
    cap7_b: { cap: 7, titolo: 'Resistenza e staffette', testo: "Molte giovani donne e molti ciclisti come Gino Bartali, impegnati nell'aiuto a perseguitati e partigiani, portarono messaggi e documenti rischiando la vita. Tina Anselmi, a 17 anni, scelse di entrare nella Resistenza dopo l'impiccagione di giovani partigiani a Bassano.", nota: "Alcuni dettagli aneddotici sono discussi dagli storici." }
  };
})(typeof window !== 'undefined' ? window : globalThis);
