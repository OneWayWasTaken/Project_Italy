/* story.js — motore dialoghi stile visual novel (FASE 3).
 * Pianificato: capitoli in JSON dentro data.js (CAPITOLI[i].scene), portrait, scelte, flag salvati in Save.flag.
 * Per ora solo lo spazio dei nomi e le API pubbliche previste. */
(function (root) {
  'use strict';
  const E = root.Echi = root.Echi || {};
  E.Story = {
    /** Imposta/legge i flag narrativi (persistiti nel salvataggio). */
    setFlag(save, k, v) { save.flag[k] = v === undefined ? true : v; },
    getFlag(save, k) { return save.flag[k]; },
    /** Riproduce una scena (Fase 3). */
    play() { throw new Error('Story.play: non ancora implementato (Fase 3)'); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
