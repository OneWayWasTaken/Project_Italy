/* ============================================================================
 * main.js — avvio, salvataggio (localStorage) e collegamento tra schermate.
 * Il salvataggio ha una versione (`v`) per le migrazioni future: aggiungere
 * nuovi campi in def() e lasciare che load() li fonda con i dati esistenti.
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi, C = E.CONFIG;

  E.Save = {
    data: null,
    def() {
      return {
        v: 1,
        squadra: ['scipione', 'spartaco', 'perpetua', 'leonardo'],
        incontro: 'pattuglia',
        opzioni: { vel: 1, audio: true },
        stats: { vittorie: 0, sconfitte: 0 },
        flag: {},                       // flag narrativi (Fase 3)
        valute: { denari: 0, sigilli: 0 }, // Fase 4
        roster: {}                      // livelli/duplicati delle Voci (Fase 4)
      };
    },
    load() {
      const base = this.def();
      try {
        const raw = root.localStorage.getItem(C.SAVE_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          this.data = Object.assign(base, d);
          this.data.opzioni = Object.assign(base.opzioni, d.opzioni || {});
          this.data.stats = Object.assign(this.def().stats, d.stats || {});
          return this.data;
        }
      } catch (e) { console.warn('Salvataggio non leggibile, ne creo uno nuovo.', e); }
      this.data = base;
      return base;
    },
    save() { try { root.localStorage.setItem(C.SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* storage non disponibile */ } },
    reset() { try { root.localStorage.removeItem(C.SAVE_KEY); } catch (e) { /* ignora */ } }
  };

  document.addEventListener('DOMContentLoaded', function () {
    const save = E.Save.load();
    let ultima = null;                                  // ultima battaglia (per "Riprova")
    const persist = () => E.Save.save();

    function avviaBattaglia(squadra, incontro, opz) {
      opz = opz || {};
      ultima = { squadra, incontro, opz };
      ctx.tutorial = !!opz.tutorial;
      if (!opz.tutorial) { save.squadra = squadra.slice(); save.incontro = incontro; persist(); }
      const B = E.Combat.creaBattaglia({ alleati: squadra, nemici: E.INCONTRI[incontro].nemici });
      root.__battaglia = B;                              // utile per debug da console
      E.UI.battaglia.avvia(B, ctx);
    }
    const ctx = {
      save, persist,
      onAvvia: avviaBattaglia,
      onRiprova: () => avviaBattaglia(ultima.squadra, ultima.incontro, ultima.opz),
      avviaTutorial: () => avviaBattaglia(E.INCONTRI.tutorial.squadra, 'tutorial', { tutorial: true }),
      onMenu: () => { E.UI.mostra('menu'); if (E.UI.menuScena) E.UI.menuScena(save); },
      onSquadra: () => { E.UI.squadra.init(ctx); E.UI.mostra('squadra'); },
      onFine(esito) { if (esito === 'vittoria') save.stats.vittorie++; else save.stats.sconfitte++; persist(); }
    };

    E.UI.init(ctx);
    E.UI.menuScena(save);
    // Primo avvio: propone il tutorial (con possibilità di saltarlo del tutto)
    if (save.tutorial === undefined) {
      const d = document.createElement('div');
      d.innerHTML = '<h3>Benvenuto in Echi d\'Italia</h3><p>Vuoi una breve <b>guida interattiva</b> che spiega come funziona il gioco? Dura un paio di minuti e puoi interromperla quando vuoi.</p><div class="primo-btn"></div>';
      const b1 = document.createElement('button'); b1.className = 'btn grande'; b1.textContent = 'Inizia il tutorial';
      const b2 = document.createElement('button'); b2.className = 'btn'; b2.textContent = 'Salta (non chiedermelo più)';
      b1.onclick = () => { document.getElementById('modale').classList.remove('on'); ctx.avviaTutorial(); };
      b2.onclick = () => { save.tutorial = 'saltato'; persist(); document.getElementById('modale').classList.remove('on'); };
      d.querySelector('.primo-btn').append(b1, b2);
      E.UI.modale(d);
      document.querySelector('#modale .pannello-modale > .btn:last-child').style.display = 'none';   // niente "Chiudi": si sceglie uno dei due
    }
    document.querySelectorAll('[data-azione]').forEach(b => {
      b.addEventListener('click', () => {
        E.UI.Snd.init();
        switch (b.dataset.azione) {
          case 'nuova-prova': E.UI.squadra.init(ctx); E.UI.mostra('squadra'); break;
          case 'menu': E.UI.mostra('menu'); break;
          case 'opzioni': E.UI.opzioni(save, persist, () => {}); break;
          case 'tutorial': ctx.avviaTutorial(); break;
          case 'manuale': E.UI.manuale(0); break;
        }
      });
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
