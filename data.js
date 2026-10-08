/* ============================================================================
 * data.js — TUTTI i dati di gioco (data-driven).
 * Nessuna logica di combattimento qui: solo tabelle e piccoli helper di lettura.
 * Per aggiungere un personaggio / skill / nemico basta aggiungere una riga.
 *
 * Convenzioni:
 *  - Gli id sono stringhe snake_case.
 *  - Potenza di una moneta = PB + (teste fin lì) × PM  (vedi design.md §2.2)
 *  - fx = lista di effetti: { on, ... } dove on ∈ 'use' | 'hit' | 'win'
 *      use  → quando la skill viene attivata
 *      hit  → dopo il colpo, se almeno una moneta ha colpito (con perTesta: per ogni Testa che colpisce)
 *      win  → se la skill vince lo scontro (clash)
 *    campi effetto: stato+n, sanita, ardore, cura (frazione PV max), rimuoviNegativi,
 *    rimuoviPositivi (n), raddoppia (stato), velProx (bonus al dado del turno dopo), perdiPv (frazione)
 *    to ∈ 'self' | 'target' | 'ally' (alleato col minor PV%) | 'team' | 'nemici'
 *  - Modificatori di skill: pbPer {s,k,consuma}, pmPerStato {s,k,max}, moltSeStato {s,min,molt,consuma},
 *    moltPerStato {s,per,consuma}, pbPerVel k, pmSePiuVeloce n
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi = root.Echi || {};

  /* ---------- Configurazione globale di bilanciamento ---------- */
  E.CONFIG = {
    SANITA_MIN: -45, SANITA_MAX: 45,
    ARDORE_START: 3, ARDORE_TURNO: 2, ARDORE_MAX: 10,
    SOGLIE_CEDIMENTO: [0.5, 0.25],   // frazioni di PV che provocano il Cedimento
    DANNO_MOLT: 1.3,                  // moltiplicatore globale del danno per moneta
    BONUS_VANTAGGIO: 1.25, MALUS_SVANTAGGIO: 0.8,
    MOLT_CEDIMENTO: 1.3,
    STATO_MAX: 20,
    SQUADRA_MAX: 4,
    SAVE_KEY: 'echi_save_v1'
  };

  /* ---------- Affinità ----------
   * L'ordine dell'array è il ciclo di vantaggio: ognuna batte la successiva. */
  E.AFFINITA_ORDINE = ['ordine', 'sangue', 'astuzia', 'ingegno', 'fede', 'gloria'];
  E.AFFINITA = {
    gloria:  { nome: 'Gloria',  simbolo: '☀', colore: '#e0b43a', stato: 'splendore',     tema: 'Trionfi, carisma, prestigio' },
    ingegno: { nome: 'Ingegno', simbolo: '⚙', colore: '#e0722e', stato: 'bruciatura',    tema: 'Macchine, scienza, strategia' },
    fede:    { nome: 'Fede',    simbolo: '✚', colore: '#8fb4e8', stato: 'voto',          tema: 'Devozione, sacrificio, comunità' },
    sangue:  { nome: 'Sangue',  simbolo: '♦', colore: '#c0303f', stato: 'sanguinamento', tema: 'Furia, rivolta, sopravvivenza' },
    ordine:  { nome: 'Ordine',  simbolo: '▣', colore: '#7d93ab', stato: 'formazione',    tema: 'Leggi, legioni, disciplina' },
    astuzia: { nome: 'Astuzia', simbolo: '◈', colore: '#8c5cc4', stato: 'marchio',       tema: 'Inganno, diplomazia, spionaggio' }
  };
  /** Relazione dell'attaccante verso il difensore: +1 vantaggio, -1 svantaggio, 0 neutra. */
  E.rel = function (att, dif) {
    const o = E.AFFINITA_ORDINE, a = o.indexOf(att), d = o.indexOf(dif);
    if (a < 0 || d < 0) return 0;
    if ((a + 1) % o.length === d) return 1;
    if ((d + 1) % o.length === a) return -1;
    return 0;
  };
  /** Coppie opposte nel ciclo (Concordia). */
  E.CONCORDIE = [['ordine', 'ingegno'], ['sangue', 'fede'], ['astuzia', 'gloria']];

  /* ---------- Stati ---------- */
  E.STATI = {
    sanguinamento: { nome: 'Sanguinamento', icona: '✦', colore: '#e0455a', max: 20, neg: true,  desc: 'Quando agisce subisce n danni, poi n si dimezza.' },
    bruciatura:    { nome: 'Bruciatura',    icona: '♨', colore: '#ff8a3d', max: 20, neg: true,  desc: 'A fine turno subisce n danni e −1 Sanità, poi n−1.' },
    marchio:       { nome: 'Marchio',       icona: '◎', colore: '#a97be0', max: 10, neg: true,  desc: '+5% danni subiti per Marchio; ne consuma 1 per colpo.' },
    formazione:    { nome: 'Formazione',    icona: '▤', colore: '#9fb3c8', max: 20, neg: false, desc: '+1 PM ogni 3 stack (max +3), −5% danni subiti per stack (max 50%). Cala perdendo scontri.' },
    voto:          { nome: 'Voto',          icona: '✚', colore: '#b9d4ff', max: 20, neg: false, desc: 'Ogni stack assorbe 3 danni e dona +1 Sanità.' },
    splendore:     { nome: 'Splendore',     icona: '☀', colore: '#ffd75e', max: 20, neg: false, desc: '+0,5 PB per stack (max +6), +2 Sanità per scontro vinto. Si dimezza a fine turno.' }
  };
  E.POSITIVI = ['splendore', 'voto', 'formazione'];
  E.NEGATIVI = ['sanguinamento', 'bruciatura', 'marchio'];

  /* ---------- Skill ---------- */
  E.SKILL = {};
  /** Helper di compilazione: sk(id, nome, aff, monete, pb, pm, costo, extra) */
  function sk(id, nome, aff, monete, pb, pm, costo, extra) {
    E.SKILL[id] = Object.assign({ id, nome, aff, monete, pb, pm, costo, fx: [] }, extra || {});
  }
  const S = (on, stato, n, to) => ({ on, stato, n, to });          // effetto stato
  const SAN = (on, sanita, to) => ({ on, sanita, to });            // effetto sanità

  // --- Capitolo I
  sk('gladio_disciplinato', 'Gladio Disciplinato', 'gloria', 2, 4, 3, 0, { fx: [S('hit', 'splendore', 1, 'self')] });
  sk('manovra_avvolgente', 'Manovra Avvolgente', 'gloria', 3, 4, 3, 2, { fx: [S('win', 'marchio', 2, 'target')] });
  sk('giornata_zama', 'Giornata di Zama', 'gloria', 4, 6, 4, 5, { pbPer: { s: 'splendore', k: 1 } });
  sk('colpo_gladio', 'Colpo di Gladio', 'sangue', 2, 4, 3, 0, { fx: [S('hit', 'sanguinamento', 1, 'target')] });
  sk('rete_tridente', 'Rete e Tridente', 'sangue', 3, 3, 3, 2, { fx: [S('win', 'sanguinamento', 2, 'target')] });
  sk('rivolta_schiavi', 'Rivolta degli Schiavi', 'sangue', 4, 5, 4, 5, { fx: [{ on: 'use', perdiPv: 0.10, to: 'self' }, { on: 'hit', perTesta: true, stato: 'sanguinamento', n: 1, to: 'target' }] });
  // --- Capitolo II
  sk('ordine_marcia', 'Ordine di Marcia', 'ordine', 2, 4, 2, 0, { fx: [S('hit', 'formazione', 1, 'self')] });
  sk('editto', 'Editto', 'ordine', 2, 3, 3, 2, { fx: [S('win', 'formazione', 2, 'ally')] });
  sk('pax_romana', 'Pax Romana', 'ordine', 3, 6, 3, 5, { fx: [S('use', 'formazione', 6, 'team')] });
  sk('preghiera_arena', "Preghiera nell'Arena", 'fede', 2, 3, 3, 0, { fx: [S('hit', 'voto', 2, 'self')] });
  sk('fermezza', 'Fermezza', 'fede', 2, 4, 3, 2, { fx: [S('use', 'voto', 2, 'ally'), SAN('use', 5, 'ally')] });
  sk('il_rifiuto', 'Il Rifiuto', 'fede', 3, 5, 4, 5, { pbPer: { s: 'voto', k: 1, consuma: 0.5 } });
  // --- Capitolo III
  sk('falcone_addestrato', 'Falcone Addestrato', 'ingegno', 2, 4, 3, 0, { fx: [S('hit', 'bruciatura', 1, 'target')] });
  sk('macchina_assedio', "Macchina d'Assedio", 'ingegno', 3, 4, 3, 2, { fx: [S('hit', 'bruciatura', 2, 'target')] });
  sk('stupor_mundi', 'Stupor Mundi', 'ingegno', 4, 5, 4, 5, { fx: [{ on: 'hit', raddoppia: 'bruciatura', to: 'target' }] });
  sk('lancia_canossiana', 'Lancia Canossiana', 'ordine', 2, 4, 3, 0, { fx: [S('hit', 'formazione', 1, 'self')] });
  sk('mediazione', 'Mediazione', 'ordine', 2, 3, 3, 2, { fx: [{ on: 'win', rimuoviPositivi: 3, to: 'target' }] });
  sk('castello_tiene', 'Il Castello Tiene', 'ordine', 3, 5, 3, 5, { fx: [S('use', 'formazione', 5, 'self')] });
  // --- Capitolo IV
  sk('balestra_girevole', 'Balestra Girevole', 'ingegno', 2, 3, 4, 0, { fx: [S('hit', 'bruciatura', 1, 'target')] });
  sk('ornitottero', 'Ornitottero', 'ingegno', 3, 3, 3, 2, { fx: [{ on: 'use', velProx: 2, to: 'self' }] });
  sk('grande_carro', 'Il Grande Carro', 'ingegno', 4, 5, 3, 5, { fx: [S('hit', 'bruciatura', 3, 'target')] });
  sk('colpo_archibugio', 'Colpo di Archibugio', 'sangue', 2, 4, 3, 0, { fx: [S('hit', 'sanguinamento', 1, 'target')] });
  sk('stratagemma_ravaldino', 'Stratagemma di Ravaldino', 'sangue', 3, 4, 3, 2, { fx: [S('win', 'sanguinamento', 2, 'target')] });
  sk('rappresaglia', 'Rappresaglia', 'sangue', 3, 6, 3, 5, { moltSeStato: { s: 'sanguinamento', min: 3, molt: 1.5, consuma: true } });
  // --- Capitolo V
  sk('sciabola', 'Sciabola', 'gloria', 2, 4, 3, 0, { fx: [S('hit', 'splendore', 1, 'self')] });
  sk('carica_calatafimi', 'Carica di Calatafimi', 'gloria', 3, 4, 3, 2, { fx: [S('win', 'splendore', 2, 'self')] });
  sk('obbedisco', '«Obbedisco»', 'gloria', 4, 5, 4, 5, { pbPer: { s: 'splendore', k: 1, consuma: 1 } });
  sk('lettera_riservata', 'Lettera Riservata', 'astuzia', 2, 3, 3, 0, { fx: [S('hit', 'marchio', 1, 'target')] });
  sk('intesa_plombieres', 'Intesa di Plombières', 'astuzia', 3, 3, 3, 2, { fx: [S('win', 'marchio', 2, 'target'), { on: 'use', ardore: 1 }] });
  sk('gran_tessitore', 'Il Gran Tessitore', 'astuzia', 4, 4, 4, 5, { moltPerStato: { s: 'marchio', per: 0.2, consuma: true } });
  // --- Capitolo VI
  sk('picchiata', 'Picchiata', 'gloria', 2, 4, 3, 0, { fx: [S('hit', 'splendore', 1, 'self')] });
  sk('duello_aereo', 'Duello Aereo', 'gloria', 3, 4, 3, 2, { pmSePiuVeloce: 2, fx: [SAN('win', 3, 'self')] });
  sk('cielo_montello', 'Cielo del Montello', 'gloria', 4, 5, 3, 5, { pbPerVel: 1 });
  sk('gerla_pesante', 'Gerla Pesante', 'fede', 2, 3, 2, 0, { fx: [S('hit', 'voto', 2, 'self')] });
  sk('sentiero_carnico', 'Sentiero Carnico', 'fede', 2, 3, 3, 2, { fx: [S('use', 'voto', 3, 'ally'), SAN('use', 5, 'ally')] });
  sk('il_carico', 'Il Carico', 'fede', 3, 4, 3, 5, { fx: [{ on: 'use', cura: 0.15, to: 'team' }, S('use', 'voto', 2, 'team')] });
  // --- Capitolo VII
  sk('lettera_protetta', 'Lettera Protetta', 'astuzia', 2, 3, 3, 0, { fx: [S('hit', 'marchio', 1, 'target'), S('use', 'formazione', 1, 'ally')] });
  sk('documenti_perfetti', 'Documenti Perfetti', 'astuzia', 2, 3, 3, 2, { fx: [S('use', 'voto', 2, 'ally')] });
  sk('casa_protetta', 'Casa Protetta', 'astuzia', 3, 5, 3, 5, { fx: [S('use', 'formazione', 3, 'team'), SAN('use', 10, 'team'), { on: 'use', rimuoviNegativi: true, to: 'team' }] });
  sk('messaggio_cifrato', 'Messaggio Cifrato', 'ordine', 2, 3, 3, 0, { fx: [S('hit', 'formazione', 1, 'ally')] });
  sk('rete_memoria', 'Rete della Memoria', 'ordine', 3, 4, 3, 2, { fx: [S('win', 'marchio', 2, 'target')] });
  sk('giustizia_paziente', 'Giustizia Paziente', 'ordine', 3, 5, 3, 5, { moltSeStato: { s: 'marchio', min: 1, molt: 1.3 }, fx: [S('use', 'formazione', 5, 'self'), S('use', 'formazione', 5, 'ally')] });
  sk('salita_dolomitica', 'Salita Dolomitica', 'fede', 2, 3, 3, 0, { fx: [S('hit', 'voto', 1, 'self'), SAN('hit', 2, 'self')] });
  sk('telaio_segreto', 'Telaio Segreto', 'fede', 2, 3, 3, 2, { fx: [S('use', 'voto', 2, 'ally'), { on: 'use', velProx: 1, to: 'ally' }] });
  sk('corsa_alba', "Corsa Fino all'Alba", 'fede', 4, 4, 3, 5, { pmPerStato: { s: 'voto', k: 1, max: 3 }, fx: [SAN('hit', 3, 'team')] });

  // --- Skill dei nemici (costo 0: i nemici non usano l'Ardore)
  sk('n_dardo', 'Dardo Cartaginese', 'astuzia', 2, 3, 2, 0, { fx: [S('hit', 'marchio', 1, 'target')] });
  sk('n_imboscata', 'Imboscata', 'astuzia', 3, 3, 3, 0, { fx: [S('win', 'marchio', 2, 'target')] });
  sk('n_carica', 'Carica Pesante', 'sangue', 2, 4, 3, 0, { fx: [S('hit', 'sanguinamento', 2, 'target')] });
  sk('n_barrito', 'Barrito Spettrale', 'sangue', 1, 2, 4, 0, { fx: [SAN('hit', -6, 'target')] });
  sk('n_gladio_ombra', "Gladio d'Ombra", 'ordine', 2, 4, 2, 0);
  sk('n_testuggine', 'Testuggine', 'ordine', 2, 3, 2, 0, { fx: [S('use', 'formazione', 3, 'self')] });
  sk('a_stratagemma', 'Stratagemma', 'astuzia', 3, 4, 3, 0, { fx: [S('hit', 'marchio', 2, 'target')] });
  sk('a_accerchiamento', 'Accerchiamento', 'astuzia', 3, 3, 3, 0, { fx: [S('win', 'sanguinamento', 2, 'target')] });
  sk('a_canne', 'La Battaglia di Canne', 'astuzia', 4, 5, 3, 0, { moltPerStato: { s: 'marchio', per: 0.1, consuma: false } });

  /* ---------- Passive ----------
   * `tipo` seleziona il gestore in combat.js (PASSIVE_HANDLERS); gli altri campi sono parametri. */
  const P = (id, nome, desc, tipo, par) => Object.assign({ id, nome, desc, tipo }, par || {});

  /* ---------- Voci (personaggi giocabili) ---------- */
  E.VOCI = {};
  /** v(id, nome, breve, epoca, aff, rarita, pv, vel, skills, passiva, ruolo, extra) */
  function v(id, nome, breve, epoca, aff, rarita, pv, vel, skills, passiva, ruolo, extra) {
    E.VOCI[id] = Object.assign({
      id, nome, breve, epoca, aff, rarita, pv, vel, skills, passiva, ruolo,
      sigla: breve.slice(0, 1), colore: E.AFFINITA[aff].colore, svg: id /* id del ritratto SVG (Fase 2) */
    }, extra || {});
  }
  v('scipione', "Publio Cornelio Scipione, detto l'Africano", 'Scipione', 1, 'gloria', 5, 95, [4, 7],
    ['gladio_disciplinato', 'manovra_avvolgente', 'giornata_zama'],
    P('console_vittorioso', 'Console Vittorioso', 'A inizio battaglia: 1 Splendore per ogni alleato in vita.', 'inizio_stato_per_alleato', { stato: 'splendore' }), 'Comandante');
  v('spartaco', 'Spartaco', 'Spartaco', 1, 'sangue', 4, 105, [3, 6],
    ['colpo_gladio', 'rete_tridente', 'rivolta_schiavi'],
    P('catene_spezzate', 'Catene Spezzate', '+1 PM ogni 25% di PV mancanti (max +3).', 'pm_pv_mancanti', { passo: 0.25, max: 3 }), 'Berserker');
  v('augusto', 'Augusto (Gaio Ottavio Turino)', 'Augusto', 2, 'ordine', 4, 90, [3, 5],
    ['ordine_marcia', 'editto', 'pax_romana'],
    P('pax', 'Pax', 'A inizio turno gli alleati non in Cedimento ricevono 1 Formazione.', 'inizio_turno_stato_alleati', { stato: 'formazione', n: 1 }), 'Supporto');
  v('perpetua', 'Vibia Perpetua', 'Perpetua', 2, 'fede', 4, 85, [2, 5],
    ['preghiera_arena', 'fermezza', 'il_rifiuto'],
    P('testimone', 'Testimone', 'Quando un alleato va in Cedimento, la squadra riceve +5 Sanità.', 'cedimento_alleato_sanita', { sanita: 5 }), 'Guaritrice');
  v('federico', 'Federico II di Svevia', 'Federico II', 3, 'ingegno', 5, 80, [4, 7],
    ['falcone_addestrato', 'macchina_assedio', 'stupor_mundi'],
    P('curiosita', 'Curiosità', '+1 PM se usa una skill diversa da quella del turno precedente.', 'pm_skill_diversa'), 'Controllo');
  v('matilde', 'Matilde di Canossa', 'Matilde', 3, 'ordine', 4, 100, [3, 5],
    ['lancia_canossiana', 'mediazione', 'castello_tiene'],
    P('rocca_inespugnabile', 'Rocca Inespugnabile', 'Una volta per battaglia resta a 1 PV invece di cadere e ottiene 5 Formazione.', 'sopravvivenza', { stato: 'formazione', n: 5 }), 'Guardia');
  v('leonardo', 'Leonardo da Vinci', 'Leonardo', 4, 'ingegno', 5, 75, [3, 7],
    ['balestra_girevole', 'ornitottero', 'grande_carro'],
    P('taccuino', 'Taccuino', 'Ogni skill diversa usata dà 1 Appunto; con 5 Appunti la skill successiva ha +1 moneta.', 'taccuino', { soglia: 5 }), 'Inventore');
  v('caterina', 'Caterina Sforza', 'Caterina', 4, 'sangue', 4, 90, [4, 6],
    ['colpo_archibugio', 'stratagemma_ravaldino', 'rappresaglia'],
    P('contessa_forli', 'Contessa di Forlì', '+1 Sanguinamento inflitto se il bersaglio ha meno PV di lei.', 'bonus_stato_se_meno_pv', { stato: 'sanguinamento' }), 'Duellante');
  v('garibaldi', 'Giuseppe Garibaldi', 'Garibaldi', 5, 'gloria', 5, 100, [4, 6],
    ['sciabola', 'carica_calatafimi', 'obbedisco'],
    P('camicia_rossa', 'Camicia Rossa', 'Ogni Testa con PM ≥ 3 dà +1 Splendore (max 6 per turno).', 'splendore_testa', { pmMin: 3, maxTurno: 6 }), 'Attaccante');
  v('cavour', 'Camillo Benso, conte di Cavour', 'Cavour', 5, 'astuzia', 4, 70, [2, 5],
    ['lettera_riservata', 'intesa_plombieres', 'gran_tessitore'],
    P('realpolitik', 'Realpolitik', 'I Marchi che infligge valgono +1 stack.', 'bonus_stato', { stato: 'marchio' }), 'Stratega');
  v('baracca', 'Francesco Baracca', 'Baracca', 6, 'gloria', 4, 70, [5, 8],
    ['picchiata', 'duello_aereo', 'cielo_montello'],
    P('asso_cielo', 'Asso del Cielo', 'Se il suo dado è il più alto del turno, +1 moneta alla skill.', 'moneta_se_piu_veloce'), 'Assassino');
  v('mentil', 'Maria Plozner Mentil', 'Maria', 6, 'fede', 3, 85, [2, 4],
    ['gerla_pesante', 'sentiero_carnico', 'il_carico'],
    P('portatrice', 'Portatrice', 'A inizio turno dona 3 Sanità all’alleato con Sanità più bassa.', 'inizio_turno_sanita_minore', { sanita: 3 }), 'Supporto');
  v('perlasca', 'Giorgio Perlasca', 'Perlasca', 7, 'astuzia', 5, 75, [3, 6],
    ['lettera_protetta', 'documenti_perfetti', 'casa_protetta'],
    P('falsa_identita', 'Falsa Identità', 'La prima moneta che perderebbe in ogni scontro è ignorata.', 'prima_moneta_ignorata'), 'Protettore');
  v('anselmi', 'Tina Anselmi', 'Tina', 7, 'ordine', 4, 80, [3, 6],
    ['messaggio_cifrato', 'rete_memoria', 'giustizia_paziente'],
    P('staffetta', 'Staffetta', 'A inizio turno l’alleato con il dado più basso ottiene +1.', 'dado_alleato_minimo', { bonus: 1 }), 'Tattica');
  v('bartali', 'Gino Bartali', 'Bartali', 7, 'fede', 4, 85, [5, 8],
    ['salita_dolomitica', 'telaio_segreto', 'corsa_alba'],
    P('gamba_campione', 'Gamba da Campione', '+1 PM se il suo dado è ≥ 6.', 'pm_dado_min', { min: 6 }), 'Mobilità');

  /* ---------- Nemici ----------
   * ia: sequenza di skill (per azione/turno). azioni: numero di dadi di velocità.
   * regole: effetti automatici a inizio turno. fasi: cambi di fase a soglia di PV. */
  E.NEMICI = {
    eco_cartaginese: { id: 'eco_cartaginese', nome: 'Eco Cartaginese', aff: 'astuzia', pv: 140, vel: [3, 6], skills: ['n_dardo', 'n_imboscata'], ia: ['n_dardo', 'n_dardo', 'n_imboscata'], colore: '#8c5cc4', sigla: 'C' },
    elefante: { id: 'elefante', nome: 'Elefante Spettrale', aff: 'sangue', pv: 210, vel: [2, 4], skills: ['n_carica', 'n_barrito'], ia: ['n_carica', 'n_barrito', 'n_carica'], colore: '#c0303f', sigla: 'E' },
    legionario: { id: 'legionario', nome: 'Legionario Dimenticato', aff: 'ordine', pv: 180, vel: [3, 5], skills: ['n_gladio_ombra', 'n_testuggine'], ia: ['n_testuggine', 'n_gladio_ombra', 'n_gladio_ombra'], colore: '#7d93ab', sigla: 'L' },
    annibale: {
      id: 'annibale', nome: 'Annibale Barca — Eco di Canne', breve: 'Annibale', boss: true, aff: 'astuzia', pv: 470, vel: [3, 6], azioni: 2,
      skills: ['a_stratagemma', 'a_accerchiamento', 'a_canne'],
      ia: ['a_stratagemma', 'a_accerchiamento', 'a_stratagemma'],
      soglie: [0.66, 0.33],
      colore: '#8c5cc4', sigla: 'A',
      regole: [{ da: 3, stato: 'marchio', n: 1, a: 'alleati', testo: 'Il cerchio di Canne si stringe: tutti ricevono Marchio.' }],
      fasi: [{ soglia: 0.5, azioni: 3, ia: ['a_canne', 'a_accerchiamento', 'a_stratagemma'], evoca: ['elefante'], testo: 'Annibale chiama gli elefanti dalla nebbia!' }]
    }
  };
  // Nome breve di default
  Object.values(E.NEMICI).forEach(n => { n.breve = n.breve || n.nome; });

  /* ---------- Incontri di prova (Fase 1) ---------- */
  E.INCONTRI = {
    pattuglia: { id: 'pattuglia', nome: "Pattuglia dell'Eco", desc: 'Tre echi di Canne. Ideale per imparare gli scontri.', nemici: ['eco_cartaginese', 'elefante', 'legionario'] },
    annibale:  { id: 'annibale', nome: 'Annibale, Eco di Canne', desc: 'Il Nodo del primo capitolo: 2-3 azioni per turno e due fasi.', nemici: ['annibale'] }
  };

  /* ---------- Capitoli (struttura; riempiti nelle fasi 3 e 5) ---------- */
  E.CAPITOLI = [
    { id: 'cap1', num: 'I',   epoca: 'Roma repubblicana',       eco: "L'Eco di Canne",          boss: 'annibale' },
    { id: 'cap2', num: 'II',  epoca: 'Impero',                  eco: "L'Eco dell'Incendio",     boss: 'nerone' },
    { id: 'cap3', num: 'III', epoca: 'Medioevo e Comuni',       eco: "L'Eco della Torre",       boss: 'ezzelino' },
    { id: 'cap4', num: 'IV',  epoca: 'Rinascimento',            eco: "L'Eco del Falò",          boss: 'savonarola' },
    { id: 'cap5', num: 'V',   epoca: 'Risorgimento',            eco: "L'Eco delle Cinque Giornate", boss: 'radetzky' },
    { id: 'cap6', num: 'VI',  epoca: 'Prima guerra mondiale',   eco: "L'Eco del Carso",         boss: 'isonzo' },
    { id: 'cap7', num: 'VII', epoca: 'Seconda guerra mondiale', eco: "L'Eco del Silenzio",      boss: 'silenzio' }
  ];

  /* ---------- Helper: descrizione testuale di una skill (per la UI) ---------- */
  const TO = { self: 'sé', target: 'bersaglio', ally: 'alleato', team: 'squadra', nemici: 'nemici' };
  const ON = { use: 'Uso', hit: 'Al colpo', win: 'Se vince lo scontro' };
  E.descrizioneSkill = function (s) {
    const out = [];
    (s.fx || []).forEach(f => {
      let t = '';
      if (f.stato) t = (f.n > 0 ? '+' : '') + f.n + ' ' + E.STATI[f.stato].nome;
      else if (f.sanita != null) t = (f.sanita > 0 ? '+' : '') + f.sanita + ' Sanità';
      else if (f.ardore) t = '+' + f.ardore + ' Ardore';
      else if (f.cura) t = 'cura ' + Math.round(f.cura * 100) + '% PV';
      else if (f.rimuoviNegativi) t = 'rimuove stati negativi';
      else if (f.rimuoviPositivi) t = 'rimuove ' + f.rimuoviPositivi + ' stack positivi';
      else if (f.raddoppia) t = 'raddoppia ' + E.STATI[f.raddoppia].nome;
      else if (f.velProx) t = '+' + f.velProx + ' al dado del prossimo turno';
      else if (f.perdiPv) t = 'costa ' + Math.round(f.perdiPv * 100) + '% PV';
      out.push((ON[f.on] || f.on) + (f.perTesta ? ' (per Testa)' : '') + ': ' + t + (f.to ? ' → ' + TO[f.to] : ''));
    });
    if (s.pbPer) out.push('+' + s.pbPer.k + ' PB per ' + E.STATI[s.pbPer.s].nome + (s.pbPer.consuma ? ' (consumato)' : ''));
    if (s.pmPerStato) out.push('+' + s.pmPerStato.k + ' PM per ' + E.STATI[s.pmPerStato.s].nome + ' (max +' + s.pmPerStato.max + ')');
    if (s.moltSeStato) out.push('×' + s.moltSeStato.molt + ' danno se bersaglio ha ' + s.moltSeStato.min + '+ ' + E.STATI[s.moltSeStato.s].nome);
    if (s.moltPerStato) out.push('+' + Math.round(s.moltPerStato.per * 100) + '% danno per ' + E.STATI[s.moltPerStato.s].nome + ' sul bersaglio');
    if (s.pbPerVel) out.push('+' + s.pbPerVel + ' PB per punto di velocità sul bersaglio');
    if (s.pmSePiuVeloce) out.push('+' + s.pmSePiuVeloce + ' PM se più veloce del bersaglio');
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
