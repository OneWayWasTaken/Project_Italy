/* ============================================================================
 * data_nemici.js — nemici, boss, NPC e attori della storia (capitoli II-VII + estensioni).
 * Tabelle pure, come data.js: aggiungere una riga = aggiungere un nemico.
 * Convenzioni dei nemici: vedi E.NEMICI in data.js (azioni = n° di dadi di velocità, ia = sequenza di skill,
 * regole = effetti automatici a inizio turno, fasi = cambi di fase a soglia di PV, soglie = Cedimento).
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi;
  const AFF = a => E.AFFINITA[a].colore;

  /* ---------- Skill dei nemici "normali": due per nemico, statistiche per affinità e livello di capitolo ---------- */
  const ANIM_AFF = { sangue: ['doppio', 'sweep'], ordine: ['colpo_scudo', 'fendente'], astuzia: ['lancio', 'doppio'], ingegno: ['lancio_alto', 'sparo'], fede: ['benedizione', 'preghiera'], gloria: ['fendente', 'invocazione'] };
  function fxBase(aff, n) {
    switch (aff) {
      case 'sangue': return [{ on: 'hit', stato: 'sanguinamento', n, to: 'target' }, { on: 'win', stato: 'sanguinamento', n: n + 1, to: 'target' }];
      case 'ordine': return [{ on: 'use', stato: 'formazione', n: n + 1, to: 'self' }, { on: 'win', stato: 'formazione', n: n + 1, to: 'self' }];
      case 'astuzia': return [{ on: 'hit', stato: 'marchio', n, to: 'target' }, { on: 'win', stato: 'marchio', n: n + 1, to: 'target' }];
      case 'ingegno': return [{ on: 'hit', stato: 'bruciatura', n, to: 'target' }, { on: 'win', stato: 'bruciatura', n: n + 1, to: 'target' }];
      case 'fede': return [{ on: 'use', stato: 'voto', n: n + 1, to: 'self' }, { on: 'hit', sanita: -4, to: 'target' }];
      default: return [{ on: 'hit', stato: 'splendore', n, to: 'self' }, { on: 'win', sanita: -4, to: 'target' }];
    }
  }
  /** esk(idNemico, [nome1, nome2], aff, livello) → crea le skill idNemico_1 e idNemico_2 */
  function esk(id, nomi, aff, lv) {
    const n = 1 + Math.floor(lv / 3);
    const fx = fxBase(aff, n);
    E.SKILL[id + '_1'] = { id: id + '_1', nome: nomi[0], aff, monete: 2, pb: 3 + Math.floor(lv / 3), pm: 2 + (lv > 4 ? 1 : 0), costo: 0, fx: [fx[0]] };
    E.SKILL[id + '_2'] = { id: id + '_2', nome: nomi[1], aff, monete: 3, pb: 3 + Math.floor(lv / 3), pm: 3, costo: 0, fx: [fx[1]] };
    E.ANIM_SKILL[id + '_1'] = ANIM_AFF[aff][0]; E.ANIM_SKILL[id + '_2'] = ANIM_AFF[aff][1];
  }
  /** nem(id, nome, aff, pv, vel, nomiSkill, livello, art) → nemico normale con IA a 3 passi */
  function nem(id, nome, aff, pv, vel, nomiSkill, lv, art) {
    esk(id, nomiSkill, aff, lv);
    E.NEMICI[id] = { id, nome, breve: nome, aff, pv, vel, skills: [id + '_1', id + '_2'], ia: [id + '_1', id + '_1', id + '_2'], colore: AFF(aff), sigla: nome.slice(0, 1) };
    E.ARTE[id] = Object.assign({ eco: true, glow: AFF(aff), idle: 'spettro', corpo: 'm', attacco: ANIM_AFF[aff][1] === 'sweep' ? 'fendente' : ANIM_AFF[aff][1] }, art);
  }

  /* ---------- Capitolo II — Impero ---------- */
  nem('gladiatore_fumante', 'Gladiatore Fumante', 'sangue', 200, [3, 5], ['Colpo di Rete', "Furia dell'Arena"], 2,
    { pelle: '#8a6a5a', abito: { tipo: 'tunica', c1: '#6a3a30', c2: '#a04a3a' }, testa: { tipo: 'elmo_medievale', c1: '#8a7a6a' }, arma: 'gladio', scudo: { tipo: 'clipeo', c1: '#6a3a30', c2: '#c0a060' } });
  nem('pretoriano_ombra', "Pretoriano d'Ombra", 'ordine', 215, [3, 5], ['Scudo Pretoriano', 'Gladio di Guardia'], 2,
    { pelle: '#7a8090', abito: { tipo: 'corazza', c1: '#3a3a4a', c2: '#8a8aa0' }, testa: { tipo: 'elmo_romano', c1: '#8a8aa0', c2: '#2a2a3a' }, arma: 'gladio', scudo: { tipo: 'scutum', c1: '#3a3a4a', c2: '#8a8aa0' } });
  nem('eco_rogo', 'Eco del Rogo', 'gloria', 175, [4, 6], ['Brace Viva', 'Corona di Fiamme'], 2,
    { pelle: '#c08a60', abito: { tipo: 'toga', c1: '#c04a2a', c2: '#e0b43a' }, testa: { tipo: 'alloro', c1: '#b0602a' }, arma: 'torcia', attacco: 'sweep' });

  /* ---------- Capitolo III — Medioevo e Comuni ---------- */
  nem('milizia_torre', 'Milizia della Torre', 'ordine', 240, [3, 5], ['Muro di Lance', 'Colpo della Torre'], 3,
    { pelle: '#8a8a98', abito: { tipo: 'cotta', c1: '#6a6a78', c2: '#3a4a6a' }, testa: { tipo: 'elmo_medievale', c1: '#7a7a88' }, arma: 'lancia', scudo: { tipo: 'clipeo', c1: '#3a4a6a', c2: '#c0b080' } });
  nem('mercenario_ventura', 'Mercenario di Ventura', 'sangue', 225, [3, 6], ['Fendente Prezzolato', 'Saccheggio'], 3,
    { pelle: '#8a6a5a', abito: { tipo: 'armatura', c1: '#5a5a62', c2: '#8a2a2a' }, testa: { tipo: 'elmo_medievale', c1: '#6a6a72' }, arma: 'spada' });
  nem('falconiere_tetro', 'Falconiere Tetro', 'ingegno', 205, [4, 6], ['Falco Notturno', 'Lancio di Pece'], 3,
    { pelle: '#7a7a8a', abito: { tipo: 'veste_lunga', c1: '#3a3a52', c2: '#c08a3a' }, testa: { tipo: 'cappello_piuma', c1: '#2a2a3a', c2: '#c08a3a' }, arma: 'falco' });
  nem('guardia_ezzelino', 'Guardia di Ezzelino', 'sangue', 150, [3, 5], ['Alabarda Crudele', 'Giuramento di Sangue'], 3,
    { pelle: '#6a5a5a', abito: { tipo: 'armatura', c1: '#3a2a2e', c2: '#a02828' }, testa: { tipo: 'elmo_medievale', c1: '#4a3a3e' }, arma: 'lancia' });

  /* ---------- Capitolo IV — Rinascimento ---------- */
  nem('bargello_cieco', 'Bargello Cieco', 'ordine', 270, [3, 5], ['Bastone della Legge', 'Catena di Giudizio'], 4,
    { pelle: '#8a8a90', abito: { tipo: 'civile', c1: '#3a3a40', c2: '#2a2a30' }, testa: { tipo: 'berretto', c1: '#5a2a2a' }, arma: 'bastone', viso: 'benda' });
  nem('condottiero_ombra', "Condottiero d'Ombra", 'astuzia', 255, [4, 6], ['Tradimento di Lega', 'Colpo alle Spalle'], 4,
    { pelle: '#8a7a8a', abito: { tipo: 'armatura', c1: '#3a2a4a', c2: '#c0a040' }, testa: { tipo: 'cappello_piuma', c1: '#2a1a3a', c2: '#c0a040' }, arma: 'spada', mantello: '#2a1a3a' });
  nem('fantasma_artista', "Fantasma d'Artista", 'ingegno', 235, [4, 7], ['Pennello di Fiamma', 'Prospettiva Rotta'], 4,
    { pelle: '#9a9a8a', abito: { tipo: 'veste_lunga', c1: '#5a5a4a', c2: '#d08a3a' }, testa: { tipo: 'basco', c1: '#6a3a2a' }, arma: 'compasso' });

  /* ---------- Capitolo V — Risorgimento ---------- */
  nem('granatiere_bianco', 'Granatiere Bianco', 'ordine', 300, [3, 5], ['Salva di Granatieri', 'Baionetta Ferma'], 5,
    { pelle: '#9a9aa8', abito: { tipo: 'uniforme', c1: '#c8c8d4', c2: '#3a3a6a' }, testa: { tipo: 'bicorno', c1: '#2a2a3a', c2: '#c0b080' }, arma: 'fucile', attacco: 'sparo' });
  nem('spia_restaurazione', 'Spia della Restaurazione', 'astuzia', 265, [4, 6], ['Lettera Intercettata', 'Pugnale nel Buio'], 5,
    { pelle: '#8a8a9a', abito: { tipo: 'abito_nero', c1: '#9a9aa8', c2: '#1a1a24' }, testa: { tipo: 'fedora', c1: '#2a2a34', c2: '#5a2a3a' }, arma: 'lettera' });
  nem('patriota_frainteso', 'Patriota Frainteso', 'fede', 290, [3, 5], ['Inno Spezzato', 'Bandiera Strappata'], 5,
    { pelle: '#8a9aa8', abito: { tipo: 'giubba', c1: '#5a7a5a', c2: '#6a6a72' }, testa: { tipo: 'berretto', c1: '#3a5a3a' }, arma: 'bastone' });

  /* ---------- Capitolo VI — Prima guerra mondiale ---------- */
  nem('eco_trincea', 'Eco di Trincea', 'sangue', 330, [3, 5], ['Assalto alla Baionetta', 'Filo Spinato'], 6,
    { pelle: '#7a7a6a', abito: { tipo: 'uniforme', c1: '#5a5a48', c2: '#3a3a30' }, testa: { tipo: 'elmetto', c1: '#6a6a58' }, arma: 'fucile', attacco: 'affondo' });
  nem('fante_fango', 'Fante di Fango', 'fede', 320, [3, 5], ['Preghiera nel Fango', 'Lettera dal Fronte'], 6,
    { pelle: '#8a8a78', abito: { tipo: 'uniforme', c1: '#6a6a50', c2: '#4a4a38' }, testa: { tipo: 'elmetto', c1: '#7a7a60' }, arma: 'lettera' });
  nem('cecchino_senza_nome', 'Cecchino senza Nome', 'astuzia', 285, [4, 7], ['Colpo dal Silenzio', 'Mirino Gelido'], 6,
    { pelle: '#8a8a88', abito: { tipo: 'uniforme', c1: '#4a4a40', c2: '#2a2a24' }, testa: { tipo: 'elmetto', c1: '#5a5a50' }, arma: 'fucile', attacco: 'sparo_mira' });

  /* ---------- Capitolo VII — Seconda guerra mondiale: Echi di paura, obbedienza e indifferenza (astratti) ---------- */
  nem('eco_obbedienza', "Eco dell'Obbedienza", 'ordine', 360, [3, 5], ['Ordine Eseguito', 'Silenzio in Fila'], 7,
    { pelle: '#8a8a94', abito: { tipo: 'civile', c1: '#4a4a52', c2: '#34343c' }, testa: { tipo: 'cappuccio', c1: '#3a3a44' }, arma: 'cartella' });
  nem('eco_paura', 'Eco della Paura', 'sangue', 340, [4, 7], ['Porta Sfondata', 'Sirena di Notte'], 7,
    { pelle: '#8a7a80', abito: { tipo: 'veste_lunga', c1: '#4a3a40', c2: '#7a4a50' }, testa: { tipo: 'cappuccio', c1: '#3a2a30' }, arma: 'torcia' });
  nem('eco_indifferenza', "Eco dell'Indifferenza", 'fede', 380, [3, 5], ['Sguardo Altrove', 'Finestra Chiusa'], 7,
    { pelle: '#9a9aa4', abito: { tipo: 'gonna', c1: '#8a8a94', c2: '#5a5a66' }, testa: { tipo: 'fazzoletto', c1: '#8a8a94' }, arma: 'lettera' });

  /* ---------- BOSS ---------- */
  function sk(id, nome, aff, monete, pb, pm, fx, anim, extra) {
    E.SKILL[id] = Object.assign({ id, nome, aff, monete, pb, pm, costo: 0, fx: fx || [] }, extra || {}); E.ANIM_SKILL[id] = anim;
  }
  // II — Nerone (Gloria): il Grande Incendio
  sk('ne_fiaccola', 'Fiaccola Ardente', 'gloria', 3, 4, 3, [{ on: 'hit', stato: 'bruciatura', n: 2, to: 'target' }], 'sweep');
  sk('ne_canto', "Canto sull'Incendio", 'gloria', 2, 3, 4, [{ on: 'hit', sanita: -6, to: 'target' }, { on: 'use', stato: 'splendore', n: 2, to: 'self' }], 'invocazione');
  sk('ne_incendio', 'Domus Aurea in Fiamme', 'gloria', 4, 5, 3, [{ on: 'hit', stato: 'bruciatura', n: 3, to: 'target' }], 'salto');
  E.NEMICI.nerone = { id: 'nerone', nome: "Nerone — Eco dell'Incendio", breve: 'Nerone', boss: true, aff: 'gloria', pv: 650, vel: [3, 6], azioni: 2, skills: ['ne_fiaccola', 'ne_canto', 'ne_incendio'],
    ia: ['ne_fiaccola', 'ne_canto', 'ne_fiaccola'], soglie: [0.66, 0.33], colore: AFF('gloria'), sigla: 'N',
    regole: [{ da: 2, a: 'alleati', stato: 'bruciatura', n: 1, crescente: 3, testo: 'Il Grande Incendio divora il campo: tutti bruciano.' }],
    fasi: [{ soglia: 0.5, azioni: 3, ia: ['ne_incendio', 'ne_canto', 'ne_fiaccola'], stati: { splendore: 6 }, sanitaAlleati: -6, testo: 'Nerone si crede un dio: il rogo lo esalta!' }] };
  E.ARTE.nerone = { eco: true, glow: '#ff8a3d', idle: 'regale', corpo: 'g', scala: 1.25, pelle: '#c09a7a', capelli: { stile: 'riccio', colore: '#c0a050', barba: 'pizzo' }, abito: { tipo: 'manto_imperiale', c1: '#8a1f4a', c2: '#e0b43a' }, mantello: '#c0401a', testa: { tipo: 'alloro', c1: '#c0a040' }, arma: 'torcia', attacco: 'sweep' };

  // III — Ezzelino da Romano (Sangue)
  sk('ez_catena', 'Catena del Tiranno', 'sangue', 3, 4, 3, [{ on: 'hit', stato: 'sanguinamento', n: 2, to: 'target' }], 'sweep');
  sk('ez_esecuzione', 'Esecuzione Pubblica', 'sangue', 3, 5, 3, [{ on: 'win', stato: 'sanguinamento', n: 3, to: 'target' }], 'salto');
  sk('ez_terrore', 'Il Terrore dei Sudditi', 'sangue', 4, 4, 4, [{ on: 'hit', sanita: -8, to: 'target' }], 'turbine');
  E.NEMICI.ezzelino = { id: 'ezzelino', nome: 'Ezzelino da Romano — Eco della Torre', breve: 'Ezzelino', boss: true, aff: 'sangue', pv: 760, vel: [3, 6], azioni: 2, skills: ['ez_catena', 'ez_esecuzione', 'ez_terrore'],
    ia: ['ez_catena', 'ez_esecuzione', 'ez_catena'], soglie: [0.66, 0.33], colore: AFF('sangue'), sigla: 'E',
    regole: [{ da: 2, a: 'alleati', sanita: -2, testo: 'Il terrore dei sudditi pesa sui cuori.' }],
    fasi: [{ soglia: 0.5, azioni: 3, ia: ['ez_terrore', 'ez_esecuzione', 'ez_catena'], evoca: ['guardia_ezzelino'], testo: 'Ezzelino richiama la sua guardia!' }] };
  E.ARTE.ezzelino = { eco: true, glow: '#c0303f', idle: 'regale', corpo: 'g', scala: 1.25, pelle: '#8a6a5a', capelli: { stile: 'corto', colore: '#15101c', barba: 'barba' }, abito: { tipo: 'armatura', c1: '#3a3a42', c2: '#a02828' }, mantello: '#2a0f12', testa: { tipo: 'elmo_medievale', c1: '#5a5a66' }, arma: 'mazza', attacco: 'fendente' };

  // IV — Girolamo Savonarola (Fede)
  sk('sv_predica', 'Predica Infuocata', 'fede', 3, 4, 3, [{ on: 'hit', sanita: -5, to: 'target' }], 'invocazione');
  sk('sv_falo', 'Falò delle Vanità', 'fede', 3, 5, 3, [{ on: 'hit', stato: 'bruciatura', n: 2, to: 'target' }, { on: 'hit', rimuoviPositivi: 3, to: 'target' }], 'benedizione');
  sk('sv_anatema', 'Anatema', 'fede', 4, 5, 4, [{ on: 'win', stato: 'marchio', n: 2, to: 'target' }], 'invocazione');
  E.NEMICI.savonarola = { id: 'savonarola', nome: 'Girolamo Savonarola — Eco del Falò', breve: 'Savonarola', boss: true, aff: 'fede', pv: 860, vel: [3, 6], azioni: 2, skills: ['sv_predica', 'sv_falo', 'sv_anatema'],
    ia: ['sv_predica', 'sv_falo', 'sv_predica'], soglie: [0.66, 0.33], colore: AFF('fede'), sigla: 'S',
    regole: [{ da: 1, a: 'alleati', rimuovi: 'splendore', testo: 'Il Falò delle Vanità cancella ogni splendore.' }],
    fasi: [{ soglia: 0.66, sanitaAlleati: -5, testo: 'La folla grida: «Pentitevi!»' }, { soglia: 0.33, azioni: 3, ia: ['sv_anatema', 'sv_falo', 'sv_predica'], stati: { voto: 4 }, testo: 'Savonarola arde di fervore: il suo Voto si moltiplica!' }] };
  E.ARTE.savonarola = { eco: true, glow: '#ffb04a', idle: 'regale', corpo: 'm', scala: 1.2, pelle: '#b09a8a', abito: { tipo: 'saio', c1: '#e8e2d0', c2: '#2a2a2e' }, mantello: '#2a2a2e', testa: { tipo: 'cappuccio', c1: '#2a2a2e' }, arma: 'libro', attacco: 'invocazione' };

  // V — Josef Radetzky (Ordine)
  sk('ra_linea', 'Linea Immobile', 'ordine', 3, 5, 3, [{ on: 'use', stato: 'formazione', n: 1, to: 'self' }], 'colpo_scudo');
  sk('ra_cavalleria', 'Carica di Cavalleria', 'ordine', 3, 5, 3, [{ on: 'win', stato: 'sanguinamento', n: 2, to: 'target' }], 'carica');
  sk('ra_cannonata', 'Cannonata Ordinata', 'ordine', 4, 6, 3, [{ on: 'hit', stato: 'marchio', n: 2, to: 'target' }], 'sparo_mira');
  E.NEMICI.radetzky = { id: 'radetzky', nome: 'Josef Radetzky — Eco delle Cinque Giornate', breve: 'Radetzky', boss: true, aff: 'ordine', pv: 960, vel: [3, 6], azioni: 2, skills: ['ra_linea', 'ra_cavalleria', 'ra_cannonata'],
    ia: ['ra_linea', 'ra_cavalleria', 'ra_cannonata'], soglie: [0.66, 0.33], colore: AFF('ordine'), sigla: 'R', statiIniziali: { formazione: 1 },
    fasi: [{ soglia: 0.5, azioni: 3, ia: ['ra_cannonata', 'ra_cavalleria', 'ra_linea'], testo: 'Radetzky ordina la carica generale!' }] };
  E.ARTE.radetzky = { eco: true, glow: '#9fb3c8', idle: 'regale', corpo: 'm', scala: 1.2, pelle: '#9a8a8a', capelli: { stile: 'calvo', colore: '#9a9aa4', barba: 'baffi' }, abito: { tipo: 'uniforme', c1: '#e0e0ea', c2: '#2a3a6a' }, mantello: '#c8c8d4', testa: { tipo: 'bicorno', c1: '#1a1a26', c2: '#d9b44a' }, arma: 'sciabola', attacco: 'sweep' };

  // VI — L'Eco dell'Isonzo (entità, non una persona)
  sk('is_offensiva', "L'Offensiva", 'sangue', 3, 5, 3, [{ on: 'hit', stato: 'sanguinamento', n: 2, to: 'target' }], 'sweep');
  sk('is_mitraglia', 'Mitragliatrice', 'sangue', 3, 4, 3, [{ on: 'hit', sanita: -4, to: 'target' }], 'sparo_rapido');
  sk('is_fango', 'Fango e Silenzio', 'ordine', 3, 4, 4, [{ on: 'win', stato: 'marchio', n: 2, to: 'target' }], 'colpo_scudo');
  E.NEMICI.isonzo = { id: 'isonzo', nome: "L'Eco dell'Isonzo", breve: 'Isonzo', boss: true, aff: 'sangue', pv: 1050, vel: [3, 6], azioni: 2, skills: ['is_offensiva', 'is_mitraglia', 'is_fango'],
    ia: ['is_offensiva', 'is_mitraglia', 'is_offensiva', 'is_fango', 'is_mitraglia', 'is_offensiva', 'is_mitraglia', 'is_fango', 'is_offensiva', 'is_offensiva', 'is_mitraglia', 'is_fango'],
    soglie: [0.66, 0.33], colore: AFF('sangue'), sigla: 'I',
    regole: [{ da: 1, a: 'alleati', sanita: -2, testo: "Un'altra offensiva sull'Isonzo: la speranza cala." }],
    fasi: [{ soglia: 0.5, azioni: 3, testo: 'La dodicesima offensiva: il fango inghiotte tutto.' }] };
  E.ARTE.isonzo = { eco: true, glow: '#8a8a70', idle: 'pesante', corpo: 'g', scala: 1.3, pelle: '#6a6a58', abito: { tipo: 'uniforme', c1: '#4a4a3a', c2: '#2a2a22' }, testa: { tipo: 'elmetto', c1: '#5a5a48' }, arma: 'fucile', attacco: 'sparo_mira' };

  // VII — Il Silenzio (entità, non si sconfigge: si attraversa)
  sk('si_vuoto', 'Voce Soffocata', 'fede', 3, 4, 3, [{ on: 'hit', sanita: -6, to: 'target' }], 'benedizione');
  sk('si_peso', 'Il Peso della Scelta', 'ordine', 3, 5, 3, [{ on: 'win', stato: 'marchio', n: 2, to: 'target' }], 'invocazione');
  sk('si_indifferenza', "L'Indifferenza", 'astuzia', 4, 4, 4, [{ on: 'hit', rimuoviPositivi: 2, to: 'target' }, { on: 'hit', sanita: -3, to: 'target' }], 'preghiera');
  E.NEMICI.silenzio = { id: 'silenzio', nome: 'Il Silenzio', breve: 'Silenzio', boss: true, immortale: true, aff: 'fede', pv: 1100, vel: [3, 6], azioni: 2, skills: ['si_vuoto', 'si_peso', 'si_indifferenza'],
    ia: ['si_vuoto', 'si_peso', 'si_indifferenza'], soglie: [0.75, 0.5, 0.25], colore: '#c8c8d4', sigla: 'S',
    regole: [{ da: 1, a: 'alleati', sanita: -2, testo: 'Il Silenzio si fa più pesante.' }],
    fasi: [{ soglia: 0.75, aff: 'ordine', testo: "Il Silenzio diventa Obbedienza." }, { soglia: 0.5, aff: 'sangue', azioni: 3, testo: 'Il Silenzio diventa Paura.' }, { soglia: 0.25, aff: 'astuzia', testo: 'Il Silenzio diventa Indifferenza.' }] };
  E.ARTE.silenzio = { eco: true, glow: '#e8e8f2', idle: 'spettro', corpo: 'g', scala: 1.35, pelle: '#d8d8e2', abito: { tipo: 'veste_lunga', c1: '#d8d8e2', c2: '#8a8a98' }, mantello: '#bcbcc8', testa: { tipo: 'cappuccio', c1: '#c8c8d4' }, attacco: 'invocazione' };

  /* ---------- NPC (alleati che non agiscono: vanno protetti) ---------- */
  E.NPC = {
    testimone: { id: 'testimone', nome: 'Testimone', breve: 'Testimone', aff: 'fede', pv: 70, vel: [1, 1], azioni: 0, skills: [], npc: true, colore: '#c8c0b0', sigla: 'T' },
    testimone2: { id: 'testimone2', nome: 'Testimone', breve: 'Testimone', aff: 'fede', pv: 70, vel: [1, 1], azioni: 0, skills: [], npc: true, colore: '#b0b8c8', sigla: 'T' }
  };
  E.ARTE.testimone = { idle: 'sereno', corpo: 'f', pelle: '#e0c0a0', capelli: { stile: 'raccolto', colore: '#6a5a4a' }, abito: { tipo: 'gonna', c1: '#b0a898', c2: '#5a5a6a' }, testa: { tipo: 'fazzoletto', c1: '#a8a090' }, attacco: 'preghiera' };
  E.ARTE.testimone2 = { idle: 'composto', corpo: 'm', pelle: '#d8b898', capelli: { stile: 'corto', colore: '#4a4a4e' }, abito: { tipo: 'civile', c1: '#6a6a76', c2: '#4a4a56' }, testa: { tipo: 'basco', c1: '#5a5a66' }, attacco: 'preghiera' };

  /* ---------- Attori della storia (compaiono nei dialoghi) ---------- */
  E.ATTORI = {
    custode: { nome: 'Il Custode', arte: 'custode', colore: '#e0b43a' },
    oblio: { nome: "L'Oblio Gentile", arte: 'oblio', colore: '#d8d8e8' },
    narratore: { nome: '', colore: '#a99fb4' },
    voce: { nome: 'Una voce', colore: '#a99fb4' }
  };
  E.ARTE.custode = { idle: 'composto', corpo: 'm', pelle: '#e0c0a0', capelli: { stile: 'corto', colore: '#3a2a2a' }, abito: { tipo: 'veste_lunga', c1: '#2a2a48', c2: '#e0b43a' }, mantello: '#1a1a30', testa: { tipo: 'cappuccio_aperto', c1: '#2a2a48' }, arma: 'lanterna', attacco: 'preghiera' };
  E.ARTE.oblio = { eco: true, glow: '#fff3c4', idle: 'spettro', corpo: 'f', pelle: '#f4f0e8', abito: { tipo: 'veste_lunga', c1: '#f4f0e8', c2: '#d8c898' }, mantello: '#e8e0d0', testa: { tipo: 'velo_corona', c1: '#e8d8a8' }, attacco: 'benedizione' };
  E.NEMICI_NOMI_STORIA = {};
  // i boss e i nemici possono parlare nelle scene: stesso id di E.NEMICI
})(typeof window !== 'undefined' ? window : globalThis);
