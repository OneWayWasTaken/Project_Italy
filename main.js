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

    function avviaBattaglia(squadra, incontro) {
      ultima = { squadra, incontro };
      save.squadra = squadra.slice(); save.incontro = incontro; persist();
      const B = E.Combat.creaBattaglia({ alleati: squadra, nemici: E.INCONTRI[incontro].nemici });
      root.__battaglia = B;                              // utile per debug da console
      E.UI.battaglia.avvia(B, ctx);
    }
    const ctx = {
      save, persist,
      onAvvia: avviaBattaglia,
      onRiprova: () => avviaBattaglia(ultima.squadra, ultima.incontro),
      onMenu: () => E.UI.mostra('menu'),
      onFine(esito) { if (esito === 'vittoria') save.stats.vittorie++; else save.stats.sconfitte++; persist(); }
    };

    E.UI.init(ctx);
    document.querySelectorAll('[data-azione]').forEach(b => {
      b.addEventListener('click', () => {
        E.UI.Snd.init();
        switch (b.dataset.azione) {
          case 'nuova-prova': E.UI.squadra.init(ctx); E.UI.mostra('squadra'); break;
          case 'menu': E.UI.mostra('menu'); break;
          case 'opzioni': E.UI.opzioni(save, persist, () => {}); break;
        }
      });
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
