/* ============================================================================
 * musica.js — musica generativa con WebAudio (nessun file audio).
 *
 * Ogni "tema" è una piccola partitura procedurale: una progressione di accordi in un modo, un tempo,
 * e quali strumenti suonano (pad, basso, liuto pizzicato, campane, tamburi). Lo scheduler mette in coda
 * le note qualche decimo di secondo in anticipo sull'orologio dell'AudioContext, quindi il ritmo è stabile.
 *
 *   E.Musica.tema('battaglia', capitolo)   // cambia tema con dissolvenza
 *   E.Musica.attiva(true|false)            // opzione «Musica»
 *
 * Temi: menu, mappa, storia, battaglia, boss, gacha, vittoria (breve), sconfitta (breve).
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi = root.Echi || {};
  const M = E.Musica = { on: true, ctx: null, nome: null, cap: 0 };

  // Scale (semitoni dalla tonica) e progressioni (gradi della scala, 0 = I)
  const MODI = {
    dorico: [0, 2, 3, 5, 7, 9, 10], eolio: [0, 2, 3, 5, 7, 8, 10], frigio: [0, 1, 3, 5, 7, 8, 10],
    lidio: [0, 2, 4, 6, 7, 9, 11], misolidio: [0, 2, 4, 5, 7, 9, 10], armonica: [0, 2, 3, 5, 7, 8, 11]
  };
  // Ogni capitolo sposta la tonica e colora l'atmosfera (Roma solenne, Impero cupo, Medioevo modale…)
  const TONICA_CAP = [50, 48, 45, 52, 47, 43, 46];          // note MIDI della tonica (re, do, la, mi, si, sol, si♭)
  const TEMI = {
    menu:      { bpm: 72, modo: 'dorico', prog: [0, 5, 3, 4], pad: .14, basso: .12, liuto: .07, ritmoLiuto: [1, 0, 1, 0, 0, 1, 0, 1], campane: .025 },
    mappa:     { bpm: 84, modo: 'misolidio', prog: [0, 6, 3, 0], pad: .1, basso: .1, liuto: .07, ritmoLiuto: [1, 0, 0, 1, 0, 0, 1, 0], tamburi: .05, ritmoT: [1, 0, 0, 0, 1, 0, 0, 0] },
    storia:    { bpm: 60, modo: 'eolio', prog: [0, 5, 2, 6], pad: .13, basso: .06, liuto: .045, ritmoLiuto: [1, 0, 0, 0, 0, 0, 1, 0], campane: .02 },
    battaglia: { bpm: 118, modo: 'eolio', prog: [0, 0, 5, 6], pad: .07, basso: .14, ritmoBasso: [1, 0, 1, 1, 1, 0, 1, 1], liuto: .06, ritmoLiuto: [1, 1, 0, 1, 1, 0, 1, 0], tamburi: .12, ritmoT: [1, 0, 2, 0, 1, 1, 2, 0] },
    boss:      { bpm: 132, modo: 'armonica', prog: [0, 1, 0, 4], pad: .08, basso: .16, ritmoBasso: [1, 1, 1, 1, 1, 1, 1, 1], liuto: .06, ritmoLiuto: [1, 0, 1, 1, 0, 1, 1, 1], tamburi: .15, ritmoT: [1, 0, 2, 1, 1, 0, 2, 2] },
    gacha:     { bpm: 90, modo: 'lidio', prog: [0, 1, 0, 4], pad: .12, basso: .07, liuto: .06, ritmoLiuto: [1, 1, 1, 1, 1, 1, 1, 1], arpeggio: true, campane: .05 }
  };

  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

  M.init = function (ctx) {
    if (M.ctx || !ctx) return;
    M.ctx = ctx;
    M.master = ctx.createGain(); M.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    // riverbero: risposta all'impulso generata (coda di rumore che decade)
    const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    M.rev = ctx.createConvolver(); M.rev.buffer = ir;
    M.revG = ctx.createGain(); M.revG.gain.value = 0.32;
    M.dry = ctx.createGain(); M.dry.gain.value = 0.8;
    M.bus = ctx.createGain();
    M.bus.connect(M.dry); M.bus.connect(M.rev); M.rev.connect(M.revG);
    M.dry.connect(M.master); M.revG.connect(M.master); M.master.connect(comp); comp.connect(ctx.destination);
    M.passo = 0; M.prossimo = ctx.currentTime + 0.1;
    setInterval(M.scheduler, 90);
    if (M.nome) M.tema(M.nome, M.cap, true);
  };
  M.attiva = function (si) {
    M.on = si; if (!M.ctx) return;
    const t = M.ctx.currentTime; M.master.gain.cancelScheduledValues(t); M.master.gain.setTargetAtTime(si && M.nome ? M.volume() : 0, t, 0.4);
  };
  M.volume = () => 0.55;
  /** Cambia tema (con dissolvenza). Lo stesso tema non riparte da capo. */
  M.tema = function (nome, cap, forza) {
    cap = cap || 0;
    if (!forza && nome === M.nome && cap === M.cap) return;
    M.nome = nome; M.cap = cap;
    if (!M.ctx) return;
    const t = M.ctx.currentTime;
    M.master.gain.cancelScheduledValues(t);
    M.master.gain.setTargetAtTime(0, t, 0.25);
    M.cambio = t + 0.7;                     // il nuovo tema comincia dopo la dissolvenza
    M.passo = 0;
    if (M.on && TEMI[nome]) M.master.gain.setTargetAtTime(M.volume(), t + 0.7, 0.8);
  };
  /** Brevi fanfare (non cambiano il tema in corso). */
  M.fanfara = function (tipo) {
    if (!M.ctx || !M.on) return;
    const t = M.ctx.currentTime + 0.05, ton = TONICA_CAP[M.cap % 7] + 12;
    const note = tipo === 'vittoria' ? [0, 4, 7, 12, 16] : [12, 10, 7, 3, 0];
    note.forEach((n, i) => M.nota('ottone', mtof(ton + n), t + i * (tipo === 'vittoria' ? 0.13 : 0.22), tipo === 'vittoria' ? 0.5 : 0.7, 0.09));
  };

  M.scheduler = function () {
    if (!M.ctx || !M.on || !TEMI[M.nome]) return;
    const T = TEMI[M.nome], dur = 60 / T.bpm / 2;   // ottavi
    if (M.prossimo < M.ctx.currentTime - 0.5) M.prossimo = M.ctx.currentTime + 0.05;
    while (M.prossimo < M.ctx.currentTime + 0.35) {
      if (!(M.cambio && M.prossimo < M.cambio)) M.suona(T, M.passo, M.prossimo, dur);
      M.prossimo += dur; M.passo++;
    }
  };
  /** Suona l'ottavo `p` del tema all'istante t. */
  M.suona = function (T, p, t, d) {
    const modo = MODI[T.modo], ton = TONICA_CAP[M.cap % 7], battuta = Math.floor(p / 8) % T.prog.length, k = p % 8;
    const grado = T.prog[battuta];
    const nota = (g, ott) => ton + modo[((g % 7) + 7) % 7] + 12 * (Math.floor(g / 7) + (ott || 0));
    const accordo = [nota(grado), nota(grado + 2), nota(grado + 4)];
    if (k === 0) {                                   // pad: accordo tenuto per la battuta
      if (T.pad) accordo.forEach(n => M.nota('pad', mtof(n), t, d * 8, T.pad / 3));
      if (T.campane && Math.random() < 0.5) M.nota('campana', mtof(nota(grado + 4, 2)), t + d * 2, 2.5, T.campane);
    }
    if (T.basso && (T.ritmoBasso ? T.ritmoBasso[k] : k === 0 || k === 4)) M.nota('basso', mtof(nota(grado, -1) - 12 + (k === 6 && T.ritmoBasso ? 7 : 0)), t, d * (T.ritmoBasso ? 0.9 : 3.6), T.basso);
    if (T.liuto && T.ritmoLiuto[k]) {
      let n;
      if (T.arpeggio) n = accordo[k % 3] + 12 * (1 + Math.floor(k / 3) % 2);
      else n = nota(grado + [0, 2, 4, 7, 4, 2, 5, 4][(k + Math.floor(p / 16)) % 8], 1) + (Math.random() < 0.12 ? 12 : 0);
      M.nota('liuto', mtof(n), t, d * 1.6, T.liuto);
    }
    if (T.tamburi && T.ritmoT && T.ritmoT[k]) M.tamburo(T.ritmoT[k], t, T.tamburi);
  };
  /** Strumenti sintetici. */
  M.nota = function (tipo, f, t, dur, vol) {
    const c = M.ctx, g = c.createGain(), out = M.bus;
    g.connect(out);
    const osc = (type, fr, det) => { const o = c.createOscillator(); o.type = type; o.frequency.value = fr; if (det) o.detune.value = det; return o; };
    if (tipo === 'pad') {
      const f1 = c.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = 900; f1.Q.value = 0.6; f1.connect(g);
      const a = osc('sawtooth', f, -7), b = osc('sawtooth', f, 7); a.connect(f1); b.connect(f1);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur + 0.4);
      a.start(t); b.start(t); a.stop(t + dur + 0.5); b.stop(t + dur + 0.5);
    } else if (tipo === 'basso') {
      const f1 = c.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = 420; f1.connect(g);
      const a = osc('triangle', f), b = osc('sine', f / 2); a.connect(f1); b.connect(f1);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      a.start(t); b.start(t); a.stop(t + dur + 0.05); b.stop(t + dur + 0.05);
    } else if (tipo === 'liuto') {
      const f1 = c.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.setValueAtTime(3200, t); f1.frequency.exponentialRampToValueAtTime(700, t + dur); f1.connect(g);
      const a = osc('triangle', f), b = osc('square', f * 2); const gb = c.createGain(); gb.gain.value = 0.18; a.connect(f1); b.connect(gb); gb.connect(f1);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      a.start(t); b.start(t); a.stop(t + dur + 0.05); b.stop(t + dur + 0.05);
    } else if (tipo === 'campana') {
      [1, 2.76, 5.4].forEach((m, i) => { const o = osc('sine', f * m), gg = c.createGain(); gg.gain.value = [1, 0.4, 0.15][i]; o.connect(gg); gg.connect(g); o.start(t); o.stop(t + dur); });
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    } else if (tipo === 'ottone') {
      const f1 = c.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.setValueAtTime(600, t); f1.frequency.linearRampToValueAtTime(2600, t + 0.08); f1.connect(g);
      const a = osc('sawtooth', f), b = osc('sawtooth', f, 9); a.connect(f1); b.connect(f1);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      a.start(t); b.start(t); a.stop(t + dur + 0.05); b.stop(t + dur + 0.05);
    }
  };
  /** Tamburi: 1 = tamburo basso, 2 = colpo secco (rullante leggero). */
  M.tamburo = function (tipo, t, vol) {
    const c = M.ctx, g = c.createGain(); g.connect(M.bus);
    if (tipo === 1) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.25); o.connect(g);
      g.gain.setValueAtTime(vol * 1.6, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.3); o.start(t); o.stop(t + 0.32);
    } else {
      const n = Math.floor(c.sampleRate * 0.12), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1800; s.connect(f); f.connect(g);
      g.gain.value = vol * 0.9; s.start(t);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
