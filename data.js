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
    AFFONDO_MOLT: 1.5,               // bonus di danno dell'Affondo (azione di squadra su nemico in Cedimento)
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
  sk('rete_tridente', 'Rete e Tridente', 'sangue', 3, 3, 3, 2, { fx: [S('win', 'sanguinamento', 2, 'target'), { on: 'win', velProx: -1, to: 'target' }] });
  sk('rivolta_schiavi', 'Rivolta degli Schiavi', 'sangue', 4, 5, 4, 5, { fx: [{ on: 'use', perdiPv: 0.10, to: 'self' }, { on: 'hit', perTesta: true, stato: 'sanguinamento', n: 1, to: 'target' }] });
  // --- Capitolo II
  sk('ordine_marcia', 'Ordine di Marcia', 'ordine', 2, 4, 2, 0, { fx: [S('hit', 'formazione', 1, 'self')] });
  sk('editto', 'Editto', 'ordine', 2, 3, 3, 2, { fx: [S('win', 'formazione', 2, 'ally')] });
  sk('pax_romana', 'Pax Romana', 'ordine', 3, 6, 3, 5, { fx: [S('use', 'formazione', 6, 'team'), S('hit', 'splendore', -3, 'target')] });
  sk('preghiera_arena', "Preghiera nell'Arena", 'fede', 2, 3, 3, 0, { fx: [S('hit', 'voto', 2, 'self')] });
  sk('fermezza', 'Fermezza', 'fede', 2, 4, 3, 2, { fx: [S('use', 'voto', 2, 'ally'), SAN('use', 5, 'ally')] });
  sk('il_rifiuto', 'Il Rifiuto', 'fede', 3, 5, 4, 5, { pbPer: { s: 'voto', k: 1, consuma: 0.5 } });
  // --- Capitolo III
  sk('falcone_addestrato', 'Falcone Addestrato', 'ingegno', 2, 4, 3, 0, { fx: [S('hit', 'bruciatura', 1, 'target')] });
  sk('macchina_assedio', "Macchina d'Assedio", 'ingegno', 3, 4, 3, 2, { monetePiuSeCed: 1, fx: [S('hit', 'bruciatura', 2, 'target')] });
  sk('stupor_mundi', 'Stupor Mundi', 'ingegno', 4, 5, 4, 5, { fx: [{ on: 'hit', raddoppia: 'bruciatura', to: 'target' }] });
  sk('lancia_canossiana', 'Lancia Canossiana', 'ordine', 2, 4, 3, 0, { fx: [S('hit', 'formazione', 1, 'self')] });
  sk('mediazione', 'Mediazione', 'ordine', 2, 3, 3, 2, { fx: [{ on: 'win', rimuoviPositivi: 3, to: 'target' }] });
  sk('castello_tiene', 'Il Castello Tiene', 'ordine', 3, 5, 3, 5, { fx: [S('use', 'formazione', 5, 'self'), { on: 'use', noCed: true, to: 'self' }] });
  // --- Capitolo IV
  sk('balestra_girevole', 'Balestra Girevole', 'ingegno', 2, 3, 4, 0, { fx: [S('hit', 'bruciatura', 1, 'target')] });
  sk('ornitottero', 'Ornitottero', 'ingegno', 3, 3, 3, 2, { fx: [{ on: 'use', velProx: 2, to: 'self' }, { on: 'use', evade: true, to: 'self' }] });
  sk('grande_carro', 'Il Grande Carro', 'ingegno', 4, 5, 3, 5, { ignoraDifesa: 0.3, fx: [S('hit', 'bruciatura', 3, 'target')] });
  sk('colpo_archibugio', 'Colpo di Archibugio', 'sangue', 2, 4, 3, 0, { fx: [S('hit', 'sanguinamento', 1, 'target')] });
  sk('stratagemma_ravaldino', 'Stratagemma di Ravaldino', 'sangue', 3, 4, 3, 2, { fx: [S('win', 'sanguinamento', 2, 'target'), { on: 'win', pmProx: -1, to: 'target' }] });
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
  sk('documenti_perfetti', 'Documenti Perfetti', 'astuzia', 2, 3, 3, 2, { fx: [S('use', 'voto', 2, 'ally'), S('use', 'marchio', -2, 'ally')] });
  sk('casa_protetta', 'Casa Protetta', 'astuzia', 3, 5, 3, 5, { fx: [S('use', 'formazione', 3, 'team'), SAN('use', 10, 'team'), { on: 'use', rimuoviNegativi: true, to: 'team' }] });
  sk('messaggio_cifrato', 'Messaggio Cifrato', 'ordine', 2, 3, 3, 0, { fx: [S('hit', 'formazione', 1, 'ally')] });
  sk('rete_memoria', 'Rete della Memoria', 'ordine', 3, 4, 3, 2, { fx: [{ on: 'win', trasferisci: { stato: 'marchio', n: 2 }, to: 'target' }] });
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
  sk('a_canne', 'La Battaglia di Canne', 'astuzia', 4, 5, 3, 0, { ultima: true, moltPerStato: { s: 'marchio', per: 0.1, consuma: false } });

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
  v('cavour', 'Camillo Benso, conte di Cavour', 'Cavour', 5, 'astuzia', 3, 70, [2, 5],
    ['lettera_riservata', 'intesa_plombieres', 'gran_tessitore'],
    P('realpolitik', 'Realpolitik', 'I Marchi che infligge valgono +1 stack.', 'bonus_stato', { stato: 'marchio' }), 'Stratega');
  v('baracca', 'Francesco Baracca', 'Baracca', 6, 'gloria', 3, 70, [5, 8],
    ['picchiata', 'duello_aereo', 'cielo_montello'],
    P('asso_cielo', 'Asso del Cielo', 'Se il suo dado è il più alto del turno, +1 moneta alla skill.', 'moneta_se_piu_veloce'), 'Assassino');
  v('mentil', 'Maria Plozner Mentil', 'Maria', 6, 'fede', 3, 85, [2, 4],
    ['gerla_pesante', 'sentiero_carnico', 'il_carico'],
    P('portatrice', 'Portatrice', 'A inizio turno dona 3 Sanità all’alleato con Sanità più bassa.', 'inizio_turno_sanita_minore', { sanita: 3 }), 'Supporto');
  v('perlasca', 'Giorgio Perlasca', 'Perlasca', 7, 'astuzia', 5, 75, [3, 6],
    ['lettera_protetta', 'documenti_perfetti', 'casa_protetta'],
    P('falsa_identita', 'Falsa Identità', 'La prima moneta che perderebbe in ogni scontro è ignorata.', 'prima_moneta_ignorata'), 'Protettore');
  v('anselmi', 'Tina Anselmi', 'Tina', 7, 'ordine', 3, 80, [3, 6],
    ['messaggio_cifrato', 'rete_memoria', 'giustizia_paziente'],
    P('staffetta', 'Staffetta', 'A inizio turno l’alleato con il dado più basso ottiene +1.', 'dado_alleato_minimo', { bonus: 1 }), 'Tattica');
  v('bartali', 'Gino Bartali', 'Bartali', 7, 'fede', 3, 85, [5, 8],
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
    tutorial:  { id: 'tutorial', nome: 'Tutorial', desc: 'Incontro guidato.', nemici: ['eco_cartaginese', 'legionario'], tutorial: true, squadra: ['scipione', 'spartaco', 'perpetua', 'leonardo'] },
    pattuglia: { id: 'pattuglia', nome: "Pattuglia dell'Eco", desc: 'Tre echi di Canne. Ideale per imparare gli scontri.', nemici: ['eco_cartaginese', 'elefante', 'legionario'] },
    annibale:  { idle: 'regale', idleVars: { '--cape': '10deg' }, id: 'annibale', nome: 'Annibale, Eco di Canne', desc: 'Il Nodo del primo capitolo: 2-3 azioni per turno e due fasi.', nemici: ['annibale'] }
  };

  /* ---------- Tutorial e manuale (testi) ----------
   * passi: coach-mark durante la pianificazione del 1° turno (sel = selettore CSS evidenziato,
   * azione = attende che il giocatore faccia qualcosa: 'bersaglio' | 'esegui').
   * reattivi: spiegazioni che compaiono la prima volta che succede qualcosa (chiave = tipo di evento di combattimento). */
  E.TUTORIAL = {
    passi: [
      { id: 'benvenuto', titolo: 'Benvenuto, Custode', testo: 'Sei dentro un <b>Eco</b>: un ricordo deformato del passato. Guidi una squadra di 4 <b>Voci</b> contro gli Echi nemici. Ogni turno scegli cosa farà ciascuna Voce, poi gli scontri si risolvono animati. Questa guida dura un paio di minuti e puoi <b>saltarla in qualsiasi momento</b>.' },
      { id: 'voci', sel: '#col-alleati', pos: 'destra', titolo: 'Le tue Voci', testo: 'Ogni Voce ha <b>PV</b> (barra verde), <b>Sanità</b> (barra azzurra/viola sotto) e <b>stati</b> (le piccole icone). Clicca una Voce, o la sua figura sul campo, per selezionarla: compare un anello dorato.' },
      { id: 'nemici', sel: '#col-nemici', pos: 'sinistra', titolo: 'I nemici', testo: 'I nemici <b>dichiarano in anticipo</b> cosa faranno: nella loro targhetta vedi la skill e chi attaccheranno. I numeri gialli in alto sono i loro <b>dadi di velocità</b>.' },
      { id: 'dadi', sel: '#col-alleati .dado', pos: 'destra', titolo: 'Dado di velocità', testo: 'A inizio turno ogni Voce tira un dado. Chi ha il numero più alto agisce per primo e <b>sceglie chi affrontare</b>: se il bersaglio non ha ancora agito, il suo attacco viene trascinato in uno <b>scontro</b> con il tuo.' },
      { id: 'skill', sel: '#skills', pos: 'sopra', titolo: 'Le skill', testo: 'Ogni Voce ha 3 skill. I pallini ● sono le <b>monete</b>, <b>PB</b> la potenza base, <b>PM</b> il bonus di ogni moneta Testa. Il numero nel cerchio dorato è il <b>costo in Ardore</b>. Puoi scegliere anche con i tasti 1-2-3.' },
      { id: 'ardore', sel: '#ardore', pos: 'sotto', titolo: 'Ardore', testo: "L'<b>Ardore</b> è la risorsa di squadra: parti con 3 gemme e ne guadagni 2 a ogni turno (massimo 10). Le skill più forti costano di più: scegli come spenderlo." },
      { id: 'bersaglio', sel: '#col-nemici', pos: 'sinistra', azione: 'bersaglio', titolo: 'Scegli il bersaglio', testo: 'Con una Voce selezionata, <b>clicca un nemico</b> (targhetta o figura) per scegliere chi attaccare. Sulle skill vedi ▲ <b>vantaggio</b> o ▼ <b>svantaggio</b> contro quel nemico (le affinità!). Prova adesso.' },
      { id: 'esegui', sel: '#btn-esegui', pos: 'sopra', azione: 'esegui', titolo: 'Esegui il turno', testo: 'Quando sei pronto premi <b>Esegui turno</b> (o Invio). Guarda cosa succede: ti spiegherò le cose man mano che compaiono.' }
    ],
    reattivi: {
      clash: { sel: '#clash', pos: 'sotto', titolo: 'Scontro (clash)', testo: 'Due azioni che si affrontano lanciano le loro monete: <b>Testa</b> (oro) o <b>Croce</b> (argento). Potenza = PB + (Teste × PM). Chi ha la potenza maggiore vince il round e <b>l\'avversario perde una moneta</b>. Si ripete finché uno resta senza monete: il vincitore colpisce con quelle che gli restano.' },
      clash_fine: { sel: '#col-alleati', pos: 'destra', titolo: 'Sanità e fortuna', testo: 'La <b>Sanità</b> cambia la probabilità di Testa: 50% a Sanità 0, fino al 95% a +45 e al 5% a −45. Vincere scontri la alza; perdere o vedere un alleato cadere la abbassa. A −45 si va nel <b>Panico</b>.' },
      colpo: { titolo: 'Il colpo', testo: 'Ogni moneta rimasta colpisce in sequenza e la potenza cresce con le Teste. Il danno cambia con le <b>affinità</b>: ▲ +25% e +1 PM, ▼ −20% e −1 PM. Ogni affinità batte la successiva: Ordine → Sangue → Astuzia → Ingegno → Fede → Gloria → Ordine.', bottone: 'affinita' },
      stato: { titolo: 'Stati', testo: 'Le icone sotto le barre sono <b>stati</b>: Sanguinamento, Bruciatura, Marchio (negativi) e Formazione, Voto, Splendore (positivi). Passa il mouse o <b>tocca</b> un\'icona per leggerne l\'effetto.' },
      cedimento: { titolo: 'Cedimento!', testo: 'Quando un personaggio scende sotto il 50% e il 25% dei PV <b>barcolla</b>: salta il turno, subisce +30% danni e non può difendersi. Nel turno dopo compare <b>Affondo</b> (tasto A): una Voce a tua scelta lo colpisce gratis con danni ×1,5.' },
      fine: { titolo: 'Ben fatto!', testo: 'Conosci l\'essenziale. Nel menu trovi <b>Come si gioca</b> con tutte le regole in dettaglio. Buona fortuna, Custode.' }
    },
    turno2: { titolo: 'Affinità e Concordie', testo: 'Ogni affinità è forte contro la successiva del ciclo. Due Voci con affinità <b>opposte</b> nel ciclo (Ordine+Ingegno, Sangue+Fede, Astuzia+Gloria) formano una <b>Concordia</b>: +Sanità iniziale e +1 Ardore.', bottone: 'affinita' },
    manuale: [
      { titolo: 'Obiettivo e turno', html: '<p>Sei il <b>Custode</b>: entri negli <b>Echi</b> del passato italiano per restituire loro una forma onesta. Guidi 4 <b>Voci</b> (personaggi storici romanzati) contro gli Echi nemici.</p><p>Ogni <b>turno</b>: (1) tutti tirano il <b>dado di velocità</b>; (2) tu scegli <b>skill</b> e <b>bersaglio</b> di ogni Voce; (3) premi <b>Esegui</b> e gli scontri si risolvono. Vinci se tutti i nemici cadono, perdi se cadono tutte le tue Voci.</p>' },
      { titolo: 'Skill, monete e Ardore', html: '<p>Una skill ha <b>N monete</b>, una <b>potenza base (PB)</b>, un bonus per moneta <b>(PM)</b> e un <b>costo in Ardore</b>. Potenza = PB + (Teste × PM).</p><p>L\'<b>Ardore</b> è condiviso: 3 all\'inizio, +2 a turno, massimo 10. Le skill da costo 5 sono le <b>skill culmine</b> (con cut-in a schermo).</p>' },
      { titolo: 'Scontri e Sanità', html: '<p>Chi ha il dado più alto sceglie il bersaglio. Se il bersaglio non ha ancora agito, il suo attacco si <b>scontra</b> con il tuo: si lanciano le monete, vince il round chi ha più potenza e il perdente <b>perde una moneta</b>. Il vincitore finale colpisce con le monete rimaste.</p><p>La <b>Sanità</b> (−45…+45) decide la probabilità di Testa: <b>50% + Sanità%</b> (da 5% a 95%). Vincere la alza, perdere la abbassa. A −45: <b>Panico</b>; a +45: <b>Esaltazione</b> (+1 PM).</p>' },
      { titolo: 'Affinità', html: '<p>Le sei affinità formano un ciclo: ognuna batte la successiva.</p><div class="diag-aff"></div><p>Vantaggio: <b>+1 PM e +25% danno</b>. Svantaggio: <b>−1 PM e −20% danno</b>. Le coppie opposte (Ordine+Ingegno, Sangue+Fede, Astuzia+Gloria) formano una <b>Concordia</b>: +4 Sanità e +1 Ardore a inizio battaglia.</p>' },
      { titolo: 'Stati', html: '<ul class="lista-stati"></ul>' },
      { titolo: 'Cedimento e Affondo', html: '<p>Scendere sotto il <b>50%</b> e il <b>25%</b> dei PV provoca il <b>Cedimento</b>: salti il turno, subisci +30% danni e non puoi difenderti. Un nemico in Cedimento può essere colpito con l\'<b>Affondo</b> (tasto A): azione di squadra gratuita, danni ×1,5.</p>' },
      { titolo: 'Consigli', html: '<ul><li>Guarda sempre le <b>intenzioni</b> dei nemici prima di scegliere.</li><li>Usa l\'affinità giusta: ▲ vantaggio sulle skill.</li><li>Tieni alta la <b>Sanità</b>: più Teste, più danni.</li><li>Non sprecare l\'Ardore: le skill culmine decidono i combattimenti.</li><li>Una Concordia in squadra è un vantaggio gratuito.</li></ul>' }
    ]
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

  /* ---------- Arte (Fase 2) ----------
   * Descrizione visiva di ogni Voce/nemico: la legge art.js per disegnare la figura SVG.
   * Campi: corpo (m|f|g), pelle, capelli{stile,colore,barba}, abito{tipo,c1,c2}, mantello, dorso,
   *        testa{tipo,c1,c2}, viso, accessorio, arma, scudo{tipo,c1,c2}, attacco (stile d'attacco),
   *        scala (dimensione), eco (aspetto spettrale) + glow.
   * Per usare uno sprite tuo aggiungi: sprite:{src,w,h[,anim]}  (vedi ARTE.md). */
  E.ARTE = {
    scipione:  { idle: 'fiero', corpo: 'm', pelle: '#e0b090', capelli: { stile: 'corto', colore: '#3a2a1c' }, abito: { tipo: 'corazza', c1: '#b3302a', c2: '#d9b44a' }, mantello: '#8e1f24', testa: { tipo: 'elmo_romano', c1: '#c9a24a', c2: '#b3302a' }, arma: 'gladio', scudo: { tipo: 'scutum', c1: '#b3302a', c2: '#d9b44a' }, attacco: 'fendente' },
    spartaco:  { idle: 'nervoso', corpo: 'g', pelle: '#c9976f', capelli: { stile: 'riccio', colore: '#2a1a10', barba: 'barba' }, abito: { tipo: 'tunica', c1: '#7a5a3a', c2: '#4a3523' }, accessorio: 'catene', testa: { tipo: 'fascia', c1: '#8a2a2a' }, arma: 'sciabola', attacco: 'fendente' },
    augusto:   { idle: 'regale', corpo: 'm', pelle: '#e6bf9e', capelli: { stile: 'corto', colore: '#4b3622' }, abito: { tipo: 'toga', c1: '#efe8d6', c2: '#7a2a66' }, testa: { tipo: 'alloro', c1: '#7fa84a' }, arma: 'rotolo', attacco: 'preghiera' },
    perpetua:  { idle: 'sereno', corpo: 'f', pelle: '#e8c4a4', capelli: { stile: 'lungo', colore: '#4a2e1e' }, abito: { tipo: 'veste_lunga', c1: '#e8e2d0', c2: '#6a8cc4' }, testa: { tipo: 'fazzoletto', c1: '#cfd8ea' }, arma: 'palma', attacco: 'preghiera' },
    federico:  { idle: 'curioso', idleVars: { '--wig': '18deg', '--wigd': '1.8s' }, corpo: 'm', pelle: '#e3b895', capelli: { stile: 'corto', colore: '#7a4a22', barba: 'pizzo' }, abito: { tipo: 'veste_lunga', c1: '#1f3b7a', c2: '#d9b44a' }, mantello: '#6a1f4a', testa: { tipo: 'corona', c1: '#d9b44a' }, arma: 'falco', attacco: 'lancio' },
    matilde:   { idle: 'regale', corpo: 'f', pelle: '#ecc8a8', capelli: { stile: 'lungo', colore: '#7a4a20' }, abito: { tipo: 'veste_lunga', c1: '#3a5a9a', c2: '#d9b44a' }, mantello: '#2a3a6a', testa: { tipo: 'velo_corona', c1: '#d9b44a' }, arma: 'lancia', scudo: { tipo: 'clipeo', c1: '#3a5a9a', c2: '#d9b44a' }, attacco: 'affondo' },
    leonardo:  { idle: 'curioso', idleVars: { '--gestb': '-64deg', '--gestd': '4.6s', '--look': '22deg' }, corpo: 'm', pelle: '#e0b896', capelli: { stile: 'lungo', colore: '#b8b0a0', barba: 'barba' }, abito: { tipo: 'veste_lunga', c1: '#7a3030', c2: '#d9b44a' }, testa: { tipo: 'berretto', c1: '#7a3030' }, arma: 'compasso', attacco: 'lancio' },
    caterina:  { idle: 'sfrontato', idleVars: { '--wig': '16deg', '--wigd': '1.3s' }, corpo: 'f', pelle: '#efcdb0', capelli: { stile: 'lungo', colore: '#c98a3a' }, abito: { tipo: 'veste_lunga', c1: '#a0243a', c2: '#d9b44a' }, testa: { tipo: 'cappello_piuma', c1: '#2a2a3a', c2: '#d9b44a' }, arma: 'archibugio', attacco: 'sparo' },
    garibaldi: { idle: 'dondola', corpo: 'm', pelle: '#e0b088', capelli: { stile: 'lungo', colore: '#c9a55a', barba: 'barba' }, abito: { tipo: 'giubba', c1: '#c0272d', c2: '#6a6a72' }, mantello: '#d8d0bc', testa: { tipo: 'berretto', c1: '#1f1f2a' }, arma: 'sciabola', attacco: 'fendente' },
    cavour:    { idle: 'composto', idleVars: { '--gestb': '-118deg', '--gestd': '7s' }, corpo: 'm', pelle: '#e8c4a0', capelli: { stile: 'corto', colore: '#6a5a4a' }, viso: 'occhiali', abito: { tipo: 'abito_nero', c1: '#efe8d6', c2: '#23232e' }, arma: 'lettera', attacco: 'lancio' },
    baracca:   { idle: 'nervoso', idleVars: { '--cape': '10deg', '--bobd': '.8s' }, corpo: 'm', pelle: '#e3b995', capelli: { stile: 'corto', colore: '#3a2a1a', barba: 'baffi' }, abito: { tipo: 'uniforme', c1: '#6b4a2b', c2: '#3a2a1a' }, accessorio: 'sciarpa', accessorioC: '#f0ece0', testa: { tipo: 'aviatore', c1: '#5a3b20', c2: '#cfe0ea' }, arma: 'pistola', attacco: 'sparo' },
    mentil:    { idle: 'sereno', idleVars: { '--rock': '1.6deg', '--bobd': '4.6s' }, corpo: 'f', pelle: '#e6bf9f', capelli: { stile: 'trecce', colore: '#5a3a22' }, abito: { tipo: 'gonna', c1: '#bfae90', c2: '#4a3a32' }, dorso: 'gerla', testa: { tipo: 'fazzoletto', c1: '#7a3a3a' }, arma: 'bastone', attacco: 'affondo' },
    perlasca:  { idle: 'composto', idleVars: { '--look': '24deg', '--hdd': '4s' }, corpo: 'm', pelle: '#e0b794', capelli: { stile: 'corto', colore: '#2a2a2e' }, abito: { tipo: 'civile', c1: '#3a3d4a', c2: '#2c2e38' }, testa: { tipo: 'fedora', c1: '#4a4a52', c2: '#222222' }, arma: 'cartella', attacco: 'lancio' },
    anselmi:   { idle: 'curioso', idleVars: { '--bob': '-3px', '--bobd': '1.6s' }, corpo: 'f', pelle: '#efc8aa', capelli: { stile: 'trecce', colore: '#6a4a2c' }, abito: { tipo: 'gonna', c1: '#e8e2d0', c2: '#3a4a6a' }, arma: 'lettera', attacco: 'lancio' },
    bartali:   { idle: 'dondola', idleVars: { '--tap': '-24deg', '--tapd': '1.1s' }, corpo: 'm', pelle: '#d9a67f', capelli: { stile: 'corto', colore: '#2a1a10' }, abito: { tipo: 'tuta', c1: '#3a6aa0', c2: '#e0c040' }, testa: { tipo: 'cappellino_ciclista', c1: '#e8e2d0' }, arma: 'ruota', attacco: 'lancio' },
    // --- Nemici (Echi: aspetto spettrale)
    eco_cartaginese: { idle: 'spettro', eco: true, glow: '#8c5cc4', corpo: 'm', pelle: '#7a6a8a', abito: { tipo: 'tunica', c1: '#4a2f68', c2: '#8c5cc4' }, testa: { tipo: 'cappuccio', c1: '#3a2455' }, arma: 'lancia', attacco: 'affondo' },
    elefante:        { idle: 'pesante', eco: true, glow: '#c0303f', figura: 'elefante', pelle: '#8a8090', scala: 1.25, attacco: 'affondo' },
    legionario:      { idle: 'spettro', idleVars: { '--bob': '-3px', '--gest': '-6deg' }, eco: true, glow: '#7d93ab', corpo: 'm', pelle: '#8a98a8', abito: { tipo: 'corazza', c1: '#4a5a6e', c2: '#8da0b8' }, testa: { tipo: 'elmo_romano', c1: '#8da0b8', c2: '#4a5a6e' }, arma: 'gladio', scudo: { tipo: 'scutum', c1: '#4a5a6e', c2: '#8da0b8' }, attacco: 'fendente' },
    annibale:        { idle: 'regale', idleVars: { '--cape': '10deg' }, eco: true, glow: '#8c5cc4', corpo: 'g', scala: 1.3, pelle: '#8a6a5a', capelli: { stile: 'corto', colore: '#15101c', barba: 'barba' }, viso: 'benda', abito: { tipo: 'armatura', c1: '#5a3a7a', c2: '#d9b44a' }, mantello: '#3a1f55', testa: { tipo: 'elmo_cartaginese', c1: '#b8923a', c2: '#2a1a3a' }, arma: 'sciabola', attacco: 'fendente' }
  };

  /* ---------- Animazioni d'attacco per skill ----------
   * Ogni skill ha un movimento diverso (nomi definiti in art.js → Arte.ANIM). Se una skill non è qui,
   * vale E.SKILL[id].anim oppure lo stile predefinito del personaggio (E.ARTE[id].attacco). */
  E.ANIM_SKILL = {
    gladio_disciplinato: 'fendente', manovra_avvolgente: 'sweep', giornata_zama: 'salto',
    colpo_gladio: 'doppio', rete_tridente: 'lancio_alto', rivolta_schiavi: 'turbine',
    ordine_marcia: 'affondo', editto: 'benedizione', pax_romana: 'invocazione',
    preghiera_arena: 'preghiera', fermezza: 'benedizione', il_rifiuto: 'invocazione',
    falcone_addestrato: 'lancio', macchina_assedio: 'lancio_alto', stupor_mundi: 'invocazione',
    lancia_canossiana: 'lungo', mediazione: 'colpo_scudo', castello_tiene: 'salto',
    balestra_girevole: 'sparo_rapido', ornitottero: 'lancio_alto', grande_carro: 'sparo_mira',
    colpo_archibugio: 'sparo', stratagemma_ravaldino: 'sparo_rapido', rappresaglia: 'sparo_mira',
    sciabola: 'fendente', carica_calatafimi: 'carica', obbedisco: 'turbine',
    lettera_riservata: 'lancio', intesa_plombieres: 'benedizione', gran_tessitore: 'invocazione',
    picchiata: 'carica', duello_aereo: 'sparo_rapido', cielo_montello: 'sparo_mira',
    gerla_pesante: 'sweep', sentiero_carnico: 'lungo', il_carico: 'salto',
    lettera_protetta: 'lancio', documenti_perfetti: 'benedizione', casa_protetta: 'invocazione',
    messaggio_cifrato: 'lancio', rete_memoria: 'lancio_alto', giustizia_paziente: 'colpo_scudo',
    salita_dolomitica: 'carica', telaio_segreto: 'lancio', corsa_alba: 'turbine',
    n_dardo: 'lancio', n_imboscata: 'doppio', n_carica: 'ele_carica', n_barrito: 'ele_barrito',
    n_gladio_ombra: 'fendente', n_testuggine: 'colpo_scudo', a_stratagemma: 'sweep', a_accerchiamento: 'doppio', a_canne: 'salto'
  };

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
      else if (f.velProx) t = (f.velProx > 0 ? '+' : '') + f.velProx + ' al dado del prossimo turno';
      else if (f.pmProx) t = f.pmProx + ' PM al prossimo turno';
      else if (f.evade) t = 'schiva il primo colpo libero';
      else if (f.noCed) t = 'non va in Cedimento questo turno';
      else if (f.trasferisci) t = 'trasferisce ' + f.trasferisci.n + ' ' + E.STATI[f.trasferisci.stato].nome + ' da un alleato';
      else if (f.perdiPv) t = 'costa ' + Math.round(f.perdiPv * 100) + '% PV';
      out.push((ON[f.on] || f.on) + (f.perTesta ? ' (per Testa)' : '') + ': ' + t + (f.to ? ' → ' + TO[f.to] : ''));
    });
    if (s.pbPer) out.push('+' + s.pbPer.k + ' PB per ' + E.STATI[s.pbPer.s].nome + (s.pbPer.consuma ? ' (consumato)' : ''));
    if (s.pmPerStato) out.push('+' + s.pmPerStato.k + ' PM per ' + E.STATI[s.pmPerStato.s].nome + ' (max +' + s.pmPerStato.max + ')');
    if (s.moltSeStato) out.push('×' + s.moltSeStato.molt + ' danno se bersaglio ha ' + s.moltSeStato.min + '+ ' + E.STATI[s.moltSeStato.s].nome);
    if (s.moltPerStato) out.push('+' + Math.round(s.moltPerStato.per * 100) + '% danno per ' + E.STATI[s.moltPerStato.s].nome + ' sul bersaglio');
    if (s.monetePiuSeCed) out.push('+' + s.monetePiuSeCed + ' moneta se il bersaglio è in Cedimento');
    if (s.ignoraDifesa) out.push('ignora ' + Math.round(s.ignoraDifesa * 100) + '% di Formazione/Voto');
    if (s.pbPerVel) out.push('+' + s.pbPerVel + ' PB per punto di velocità sul bersaglio');
    if (s.pmSePiuVeloce) out.push('+' + s.pmSePiuVeloce + ' PM se più veloce del bersaglio');
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
