/* ============================================================================
 * data_battute.js — battute di combattimento (riquadro in alto durante la battaglia).
 * Tutte inventate, come i dialoghi: le Voci sono personaggi romanzati.
 *   inizio: a inizio turno · vittoria: quando abbatte un nemico o vince uno scontro · dolore: quando barcolla
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi;
  E.BATTUTE = {
    scipione:  { inizio: ['Formazione! Nessuno resta scoperto.', 'Questa volta il campo lo scelgo io.'], vittoria: ['Come a Zama.', 'Studiato, previsto, battuto.'], dolore: ['Ho visto di peggio, a Canne…'] },
    spartaco:  { inizio: ['In piedi. Tutti quanti.', 'Le catene si spezzano un anello alla volta.'], vittoria: ['Un altro padrone in meno.', 'Libero chi lotta!'], dolore: ['Non mi inginocchio. Mai.'] },
    augusto:   { inizio: ['Ogni cosa al suo posto.', 'L\'impero si difende con la pazienza.'], vittoria: ['L\'ordine è ristabilito.', 'Così si governa.'], dolore: ['Anche Roma ha avuto giorni difficili.'] },
    perpetua:  { inizio: ['Restate vicini. Insieme non abbiamo paura.', 'Coraggio, sorelle e fratelli.'], vittoria: ['Che la pace torni qui.', 'È finita. Respirate.'], dolore: ['Non mi piegherete.'] },
    federico:  { inizio: ['Osserviamo prima di colpire.', 'Interessante… vediamo come reagisce.'], vittoria: ['Esperimento riuscito.', 'Il falco non sbaglia mai.'], dolore: ['Ah! Questo non era nei miei calcoli.'] },
    matilde:   { inizio: ['Il castello tiene. Noi teniamo.', 'Avanti, ma con giudizio.'], vittoria: ['Canossa non cade.', 'Ben fatto. Ora si tratta.'], dolore: ['Le mura sono ancora in piedi.'] },
    leonardo:  { inizio: ['Ho un\'idea. Forse due.', 'Guardate gli angoli, le leve, i punti deboli.'], vittoria: ['Funziona! Devo annotarlo.', 'La geometria non perdona.'], dolore: ['Il prototipo… va rivisto.'] },
    caterina:  { inizio: ['Chi vuole la mia rocca deve passare da me.', 'Caricate. E mirate bene.'], vittoria: ['Ve l\'avevo detto.', 'La rocca resiste!'], dolore: ['Tutto qui? Mi aspettavo di più.'] },
    garibaldi: { inizio: ['Avanti, camicie rosse!', 'O si fa, o si fa meglio.'], vittoria: ['Obbedisco… alla vittoria!', 'Un passo in più verso casa.'], dolore: ['Ferito, non vinto.'] },
    cavour:    { inizio: ['Calma: la partita è lunga.', 'Ogni mossa ha un prezzo, scegliamolo noi.'], vittoria: ['Accordo raggiunto.', 'Come previsto dalla terza lettera.'], dolore: ['Una complicazione diplomatica.'] },
    baracca:   { inizio: ['Contatto! Ore dodici.', 'Lassù si vede tutto. Seguitemi.'], vittoria: ['Abbattuto. Senza gloria, però.', 'Cielo libero!'], dolore: ['Colpito… ma ancora in volo.'] },
    mentil:    { inizio: ['Un passo dopo l\'altro, come sul sentiero.', 'La gerla è pesante, ma ce la faccio.'], vittoria: ['Uno di meno sul sentiero.', 'Avanti, la cima è vicina.'], dolore: ['Non lascio cadere il carico.'] },
    perlasca:  { inizio: ['Lasciate parlare me.', 'Un timbro, una firma, e passiamo.'], vittoria: ['Documenti in regola.', 'Nessuno resta indietro.'], dolore: ['Si può sempre trovare un\'altra strada.'] },
    anselmi:   { inizio: ['Il messaggio deve arrivare.', 'Ho scelto da che parte stare.'], vittoria: ['Arrivato in tempo.', 'Resistere vuol dire anche questo.'], dolore: ['Non mi fermo adesso.'] },
    bartali:   { inizio: ['Testa bassa e pedalare.', 'Ce la faremo, una salita alla volta.'], vittoria: ['Traguardo!', 'Certe cose si fanno e basta.'], dolore: ['Una foratura. Si ripara.'] }
  };
  /** Battute degli Echi nemici (senza nome: sono ricordi deformati). */
  E.BATTUTE_ECO = { inizio: ['…ricordami come vuoi tu…', 'La storia l\'hanno scritta i vincitori.', 'Resta. Resta nel ricordo.'], vittoria: ['Un\'altra voce che tace.', 'Dimentica.'], dolore: ['No… non così…'] };
  E.battuta = function (unitDef, tipo) {
    const b = (E.BATTUTE[unitDef] || E.BATTUTE_ECO)[tipo] || E.BATTUTE_ECO[tipo];
    return b[Math.floor(Math.random() * b.length)];
  };
})(typeof window !== 'undefined' ? window : globalThis);
