/* gacha.js — evocazioni (FASE 4): banner, rate, pity, pull x1/x10, duplicati → Frammenti.
 * Il progetto prevede: ★3 70% · ★4 25% · ★5 5%; pity soft 60, hard 80 (design.md §8). */
(function (root) {
  'use strict';
  const E = root.Echi = root.Echi || {};
  E.Gacha = {
    RATE: { 3: 0.70, 4: 0.25, 5: 0.05 },
    PITY_SOFT: 60, PITY_HARD: 80,
    pull() { throw new Error('Gacha.pull: non ancora implementato (Fase 4)'); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
