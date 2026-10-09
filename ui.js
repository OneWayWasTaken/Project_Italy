/* ============================================================================
 * ui.js — rendering e animazioni (DOM + canvas + figure SVG).
 *
 * Moduli:
 *   Snd    effetti sonori sintetizzati (WebAudio, nessun file)
 *   Fx     motore particellare su canvas: scintille, linee di clash, anelli, flash, proiettili
 *   UI.ritratto()          busto circolare (HUD): usa Arte.busto() → SVG o sprite
 *   UI.squadra             schermata di scelta squadra
 *   UI.battaglia           schermata di combattimento: palcoscenico + pianificazione + riproduzione eventi
 *
 * La UI non decide MAI nulla di logico: legge gli eventi prodotti da Combat e li anima.
 * Le figure (art.js) sono sul palcoscenico (#stage); le "targhette" con barre PV/Sanità stanno nelle colonne.
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi, C = E.CONFIG;
  const UI = E.UI = {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const Combat = () => E.Combat;

  /* ===================================================================== */
  /* Suoni sintetizzati                                                    */
  /* ===================================================================== */
  const Snd = UI.Snd = {
    ctx: null, on: true,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try { const AC = root.AudioContext || root.webkitAudioContext; if (AC) this.ctx = new AC(); } catch (e) { this.ctx = null; }
      if (this.ctx && E.Musica) { E.Musica.on = !(E.Save && E.Save.data && E.Save.data.opzioni.musica === false); E.Musica.init(this.ctx); }
    },
    tono(f, d, tipo, vol, slide) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
      o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
      g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    },
    rumore(d, vol, freq) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), dat = buf.getChannelData(0);
      for (let i = 0; i < n; i++) dat[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq || 1200; g.gain.value = vol || 0.2;
      s.connect(f); f.connect(g); g.connect(c.destination); s.start();
    },
    /** Parziali inarmoniche (metallo, campane). */
    metallo(f, d, vol, rapporti) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime, g = c.createGain(); g.connect(c.destination);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      (rapporti || [1, 2.41, 3.77, 5.2]).forEach((r, i) => { const o = c.createOscillator(), gg = c.createGain(); o.type = 'sine'; o.frequency.value = f * r; gg.gain.value = 1 / (i + 1.4); o.connect(gg); gg.connect(g); o.start(t); o.stop(t + d + 0.02); });
    },
    rumoreF(d, vol, tipo, f0, f1) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime, n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), dat = buf.getChannelData(0);
      for (let i = 0; i < n; i++) dat[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.6);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = buf; f.type = tipo; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + d); g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
    },
    /** Suono d'impatto con la "materia" dell'affinità della skill. */
    colpoAff(aff, forza) {
      const k = Math.min(1.4, 0.6 + (forza || 0) / 40);
      this.tono(110, 0.16, 'sine', 0.22 * k, -60);                       // tonfo comune
      switch (aff) {
        case 'sangue': this.rumoreF(0.16, 0.38 * k, 'highpass', 2600, 900); this.rumoreF(0.1, 0.25 * k, 'lowpass', 500); break;
        case 'ordine': this.metallo(520, 0.5, 0.11 * k, [1, 2.76, 4.07, 5.93]); this.rumoreF(0.05, 0.25, 'highpass', 3000); break;
        case 'astuzia': this.rumoreF(0.28, 0.25 * k, 'bandpass', 600, 2400); this.tono(900, 0.08, 'triangle', 0.08, -500); break;
        case 'ingegno': this.rumoreF(0.45, 0.45 * k, 'lowpass', 1400, 120); this.tono(70, 0.35, 'sawtooth', 0.12 * k, -30); break;
        case 'fede': this.metallo(880, 0.8, 0.08 * k, [1, 2, 3.01, 4.2]); this.rumoreF(0.12, 0.15, 'bandpass', 1600); break;
        default: this.tono(392, 0.22, 'sawtooth', 0.09 * k); this.tono(587, 0.22, 'sawtooth', 0.07 * k); this.rumoreF(0.12, 0.3 * k, 'bandpass', 1800); break;
      }
    },
    sfx(nome, x) {
      switch (nome) {
        case 'moneta': this.metallo(1900, 0.18, 0.05, [1, 2.4, 3.9]); setTimeout(() => this.metallo(2300, 0.14, 0.04, [1, 2.4]), 110); break;
        case 'clash': this.rumore(0.18, 0.25, 2500); this.metallo(330, 0.6, 0.1, [1, 2.76, 4.07, 5.93, 8.2]); break;
        case 'colpo': this.rumore(0.14, 0.3, 700 + (x || 0) * 8); this.tono(140, 0.14, 'square', 0.12, -90); break;
        case 'forte': this.rumore(0.3, 0.45, 400); this.tono(90, 0.3, 'sawtooth', 0.2, -50); break;
        case 'sparo': this.rumore(0.12, 0.35, 2000); this.tono(300, 0.1, 'square', 0.1, -200); break;
        case 'cura': this.tono(520, 0.25, 'sine', 0.12, 400); break;
        case 'stato': this.tono(400, 0.1, 'triangle', 0.06, 100); break;
        case 'rompi': this.tono(500, 0.25, 'sawtooth', 0.12, -420); this.rumore(0.2, 0.2, 3000); break;
        case 'morte': this.tono(200, 0.6, 'sawtooth', 0.15, -170); break;
        case 'ced': this.tono(160, 0.5, 'square', 0.15, -100); this.rumore(0.3, 0.3, 300); break;
        case 'vittoria': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tono(f, 0.35, 'triangle', 0.14), i * 140)); break;
        case 'sconfitta': [330, 262, 196, 147].forEach((f, i) => setTimeout(() => this.tono(f, 0.45, 'triangle', 0.14), i * 220)); break;
        case 'ui': this.tono(700, 0.05, 'triangle', 0.06); break;
      }
    }
  };

  /* ===================================================================== */
  /* Motore effetti su canvas                                              */
  /* ===================================================================== */
  const Fx = UI.Fx = {
    cv: null, ctx: null, W: 0, H: 0, dpr: 1, forme: [], velo: [], flares: [], parts: [], lines: [], rings: [], flashes: [], proiettili: [], pilastri: [], puffs: [], urti: [], tagli: [], emettitori: {}, motes: [], ambiente: null, frozen: 0, last: 0,
    init() {
      this.cv = $('#fx'); this.ctx = this.cv.getContext('2d');
      const res = () => {
        this.dpr = Math.min(2, root.devicePixelRatio || 1);
        this.W = root.innerWidth; this.H = root.innerHeight;
        this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
      };
      res(); root.addEventListener('resize', res);
      requestAnimationFrame(t => this.loop(t));
    },
    /** Raffica di scintille. */
    sparks(x, y, n, colore, forza) {
      forza = forza || 1;
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2), v = rnd(120, 520) * forza;
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0, max: rnd(0.3, 0.8), w: rnd(1.2, 3.2), c: Math.random() < 0.35 ? '#fff' : colore });
      }
    },
    /** Nuvole di polvere ai piedi (x,y = punto di contatto con il terreno). */
    polvere(x, y, n, forza, rgb) {
      for (let i = 0; i < n; i++) this.puffs.push({ x: x + rnd(-14, 14), y: y + rnd(-4, 3), vx: rnd(-70, 70) * (forza || 1), vy: rnd(-34, -8), r: rnd(5, 11), life: 0, max: rnd(0.45, 0.8), c: rgb || '210,190,160' });
    },
    /** Onda d'urto schiacciata sul pavimento (prospettiva). */
    urto(x, y, r, colore) { this.urti.push({ x, y, r: r || 80, c: colore || '#fff', t: 0, max: 0.5 }); },
    /** Fendente: mezzaluna luminosa che spazza l'impatto (ang in radianti, direzione del colpo). */
    taglio(x, y, ang, len, colore) { this.tagli.push({ x, y, ang, len: len || 60, c: colore, t: 0, max: 0.26 }); },
    /** Stoccata: raggi che convergono sul punto d'impatto. */
    raggi(x, y, ang, colore) { for (let i = 0; i < 9; i++) { const a = ang + rnd(-0.5, 0.5), v = rnd(260, 620); this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, g: 0, life: 0, max: rnd(0.15, 0.32), w: rnd(1.5, 3.2), c: i % 3 ? colore : '#fff' }); } },
    /** Registra/aggiorna gli stati di un'unità: emettono particelle continue (fiamme, sangue, scintille…). */
    setStati(id, fn, stati) { if (!stati) { delete this.emettitori[id]; return; } const em = this.emettitori[id] || { acc: {} }; em.fn = fn; em.stati = stati; this.emettitori[id] = em; },
    emetti(dt) {
      Object.keys(this.emettitori).forEach(id => {
        const em = this.emettitori[id], p = em.fn(); if (!p) return;
        const R = { bruciatura: 34, sanguinamento: 9, splendore: 16, voto: 8, marchio: 7 };
        Object.keys(em.stati).forEach(st => {
          if (!R[st]) return;
          em.acc[st] = (em.acc[st] || 0) + R[st] * Math.min(1, 0.4 + em.stati[st] * 0.15) * dt;
          while (em.acc[st] >= 1) {
            em.acc[st]--;
            const x = p.x + rnd(-p.w * 0.28, p.w * 0.28);
            switch (st) {
              case 'bruciatura': this.parts.push({ x, y: p.y + rnd(-p.h * 0.1, p.h * 0.3), vx: rnd(-14, 14), vy: rnd(-110, -50), g: -30, life: 0, max: rnd(0.4, 0.85), w: rnd(2, 4), c: Math.random() < 0.5 ? '#ff8a3d' : '#ffd75e' }); break;
              case 'sanguinamento': this.parts.push({ x, y: p.y + rnd(-p.h * 0.1, p.h * 0.2), vx: rnd(-8, 8), vy: rnd(0, 30), g: 700, life: 0, max: rnd(0.35, 0.6), w: 2.2, c: '#c0303f' }); break;
              case 'splendore': this.parts.push({ x, y: p.y + rnd(-p.h * 0.3, p.h * 0.4), vx: rnd(-10, 10), vy: rnd(-50, -20), g: 0, life: 0, max: rnd(0.6, 1.1), w: rnd(1.5, 2.8), c: '#ffe27a' }); break;
              case 'voto': this.parts.push({ x, y: p.y - p.h * 0.45 + rnd(-6, 6), vx: rnd(-12, 12), vy: rnd(-26, -8), g: 0, life: 0, max: rnd(0.6, 1), w: 2, c: '#cfe6ff' }); break;
              case 'marchio': this.parts.push({ x, y: p.y - p.h * 0.1 + rnd(-8, 8), vx: rnd(-20, 20), vy: rnd(-34, -12), g: 0, life: 0, max: rnd(0.5, 0.9), w: 2, c: '#b58cf0' }); break;
            }
          }
        });
      });
    },
    /* ---------- Particelle "a forma": gocce, schegge, fumo, piume, stelle, braci, ingranaggi ---------- */
    forma(p) { p.life = 0; p.rot = p.rot || rnd(0, 6.28); p.vr = p.vr == null ? rnd(-8, 8) : p.vr; this.forme.push(p); },
    /** Impatto tematico per affinità: ogni affinità ha la sua "materia". */
    impattoAff(aff, x, y, forza, ang) {
      forza = forza || 1; const n = Math.round(8 + 10 * forza), dir = ang == null ? 0 : ang;
      const cono = () => dir + rnd(-1.1, 1.1);
      switch (aff) {
        case 'sangue': for (let i = 0; i < n; i++) { const a = cono(), v = rnd(140, 460) * forza; this.forma({ t: 'goccia', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, g: 900, max: rnd(0.4, 0.8), r: rnd(1.6, 3.6), c: Math.random() < 0.7 ? '#b01e30' : '#e0455a' }); } break;
        case 'ordine': for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(120, 380) * forza; this.forma({ t: 'scheggia', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 600, max: rnd(0.35, 0.7), r: rnd(3, 6), c: Math.random() < 0.5 ? '#cfe0f0' : '#7d93ab' }); }
          this.esagono(x, y, 40 + 30 * forza, '#b4c4d5'); break;
        case 'astuzia': for (let i = 0; i < 6 + 4 * forza; i++) this.forma({ t: 'fumo', x: x + rnd(-14, 14), y: y + rnd(-14, 14), vx: rnd(-60, 60), vy: rnd(-50, 10), g: -20, max: rnd(0.6, 1), r: rnd(10, 18), c: '60,30,90' });
          for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(80, 260) * forza; this.forma({ t: 'brace', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, max: rnd(0.3, 0.6), r: rnd(1.5, 2.6), c: '#c9a0ff' }); } break;
        case 'ingegno': for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(80, 340) * forza; this.forma({ t: 'brace', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, g: -60, max: rnd(0.5, 1), r: rnd(1.6, 3.2), c: Math.random() < 0.5 ? '#ffb04a' : '#ff6a2a' }); }
          for (let i = 0; i < 2 + forza; i++) { const a = rnd(0, 6.28), v = rnd(100, 260); this.forma({ t: 'ingranaggio', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, g: 700, max: rnd(0.6, 0.9), r: rnd(4, 7), c: '#d9a43a' }); }
          for (let i = 0; i < 4; i++) this.forma({ t: 'fumo', x: x + rnd(-10, 10), y: y + rnd(-6, 6), vx: rnd(-30, 30), vy: rnd(-60, -20), g: -30, max: rnd(0.6, 0.9), r: rnd(9, 15), c: '70,50,40' }); break;
        case 'fede': for (let i = 0; i < 6 + 3 * forza; i++) this.forma({ t: 'piuma', x: x + rnd(-20, 20), y: y + rnd(-26, 6), vx: rnd(-40, 40), vy: rnd(-90, -30), g: 60, max: rnd(0.9, 1.4), r: rnd(5, 8), c: '#eef6ff', vr: rnd(-3, 3) });
          this.flare(x, y, '#cfe6ff', 46 + 26 * forza); break;
        default: for (let i = 0; i < 4 + 3 * forza; i++) { const a = rnd(0, 6.28), v = rnd(140, 420) * forza; this.forma({ t: 'stella', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 300, max: rnd(0.4, 0.75), r: rnd(3, 6), c: Math.random() < 0.5 ? '#fff3c4' : '#e0b43a' }); }
          this.flare(x, y, '#ffe27a', 50 + 30 * forza);
      }
    },
    /** Stella a quattro punte (bagliore d'impatto / scontro). */
    flare(x, y, colore, r) { this.flares.push({ x, y, c: colore, r: r || 60, t: 0, max: 0.32 }); },
    /** Esagono di "scudo" che si frantuma (Ordine). */
    esagono(x, y, r, c) { this.flares.push({ x, y, c, r, t: 0, max: 0.4, esa: true }); },
    /** Linee di velocità a tutto schermo che convergono su (x,y): colpi pesanti. */
    velocita(x, y, colore) { this.velo.push({ x, y, c: colore || '#fff', t: 0, max: 0.32, seme: Math.random() * 1000 }); },
    /** La figura si dissolve in particelle (sconfitta). */
    dissolvi(x, y, w, h, colore, eco) {
      for (let i = 0; i < 46; i++) this.forma({ t: eco ? 'brace' : 'scheggia', x: x + rnd(-w * 0.3, w * 0.3), y: y + rnd(-h * 0.45, h * 0.45), vx: rnd(-40, 40), vy: rnd(-160, -40), g: -40, max: rnd(0.7, 1.4), r: rnd(1.6, 3.4), c: Math.random() < 0.5 ? colore : '#fff' });
      for (let i = 0; i < 6; i++) this.forma({ t: 'fumo', x: x + rnd(-w * 0.3, w * 0.3), y: y + rnd(-h * 0.2, h * 0.4), vx: rnd(-20, 20), vy: rnd(-40, -10), g: -10, max: rnd(0.8, 1.3), r: rnd(12, 22), c: eco ? '50,30,70' : '40,36,44' });
    },
    disegnaForme(g, dt) {
      this.forme = this.forme.filter(p => (p.life += dt) < p.max);
      // il fumo usa la composizione normale, il resto è additivo
      g.globalCompositeOperation = 'source-over';
      this.forme.forEach(p => { if (p.t !== 'fumo' && p.t !== 'goccia') return; this.muovi(p, dt); const k = p.life / p.max;
        if (p.t === 'fumo') { const r = p.r * (1 + 1.6 * k), gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, 'rgba(' + p.c + ',' + 0.55 * (1 - k) + ')'); gr.addColorStop(1, 'rgba(' + p.c + ',0)'); g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill(); }
        else { g.globalAlpha = 1 - k * 0.6; g.fillStyle = p.c; g.beginPath(); const sp = Math.min(3, Math.hypot(p.vx, p.vy) / 140); g.ellipse(p.x, p.y, p.r * (1 + sp * 0.5), p.r, Math.atan2(p.vy, p.vx), 0, 7); g.fill(); } });
      g.globalCompositeOperation = 'lighter';
      this.forme.forEach(p => { if (p.t === 'fumo' || p.t === 'goccia') return; this.muovi(p, dt); const k = p.life / p.max; g.globalAlpha = Math.max(0, 1 - k); g.fillStyle = p.c; g.strokeStyle = p.c;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        switch (p.t) {
          case 'scheggia': g.beginPath(); g.moveTo(-p.r, -p.r * 0.3); g.lineTo(p.r, 0); g.lineTo(-p.r * 0.4, p.r * 0.5); g.closePath(); g.fill(); break;
          case 'piuma': g.globalAlpha *= 0.9; g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.32, 0, 0, 7); g.fill(); g.strokeStyle = '#9fc4f0'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-p.r, 0); g.lineTo(p.r, 0); g.stroke(); break;
          case 'stella': { const r = p.r * (1 - k * 0.5); g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.3 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); break; }
          case 'ingranaggio': g.lineWidth = 2; g.beginPath(); g.arc(0, 0, p.r * 0.6, 0, 7); g.stroke(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.fillRect(Math.cos(a) * p.r * 0.75 - 1.4, Math.sin(a) * p.r * 0.75 - 1.4, 2.8, 2.8); } break;
          default: { const gr = g.createRadialGradient(0, 0, 0, 0, 0, p.r * 2.4); gr.addColorStop(0, p.c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, p.r * 2.4, 0, 7); g.fill(); }
        }
        g.restore(); });
      // bagliori a stella / esagoni
      this.flares = this.flares.filter(f => (f.t += dt) < f.max);
      this.flares.forEach(f => { const k = f.t / f.max, e = 1 - Math.pow(1 - k, 3);
        g.save(); g.translate(f.x, f.y); g.globalAlpha = 1 - k;
        if (f.esa) { g.strokeStyle = f.c; g.lineWidth = 3 * (1 - k) + 1; const r = f.r * (0.6 + 0.6 * e); g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9); } g.closePath(); g.stroke(); }
        else { const r = f.r * (0.4 + e); g.fillStyle = f.c; g.rotate(0.3); g.beginPath(); g.moveTo(-r, 0); g.quadraticCurveTo(0, 0, 0, -r * 0.16); g.quadraticCurveTo(0, 0, r, 0); g.quadraticCurveTo(0, 0, 0, r * 0.16); g.quadraticCurveTo(0, 0, -r, 0); g.fill();
          g.beginPath(); g.moveTo(0, -r * 0.7); g.quadraticCurveTo(0, 0, r * 0.12, 0); g.quadraticCurveTo(0, 0, 0, r * 0.7); g.quadraticCurveTo(0, 0, -r * 0.12, 0); g.quadraticCurveTo(0, 0, 0, -r * 0.7); g.fill();
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.5); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 0.5, 0, 7); g.fill(); }
        g.restore(); });
      // linee di velocità
      this.velo = this.velo.filter(v => (v.t += dt) < v.max);
      this.velo.forEach(v => { const k = v.t / v.max, R = Math.hypot(this.W, this.H); g.strokeStyle = v.c;
        for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.283 + Math.sin(v.seme + i * 7.1) * 0.07, r0 = R * (0.22 + 0.25 * Math.abs(Math.sin(v.seme + i))) * (1 - k * 0.4), r1 = R * 0.75;
          g.globalAlpha = (1 - k) * 0.5; g.lineWidth = 1 + (i % 3); g.beginPath(); g.moveTo(v.x + Math.cos(a) * r0, v.y + Math.sin(a) * r0); g.lineTo(v.x + Math.cos(a) * r1, v.y + Math.sin(a) * r1); g.stroke(); } });
    },
    muovi(p, dt) { p.vy += (p.g || 0) * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.t === 'piuma') p.vx += Math.sin(p.life * 6) * 60 * dt; },
    ring(x, y, colore, r) { this.rings.push({ x, y, c: colore, t: 0, max: 0.45, r: r || 90 }); },
    flash(colore, alpha) { this.flashes.push({ c: colore, a: alpha || 0.35, t: 0, max: 0.35 }); },
    /** Proiettile luminoso da a verso b in `dur` secondi (colpi a distanza). */
    proiettile(a, b, colore, dur, arco, spessore) { this.proiettili.push({ a, b, c: colore, t: 0, max: dur || 0.2, arco: arco || 0, w: spessore || 1 }); },
    /** Colonna di luce verticale che cala sul bersaglio. */
    pilastro(x, y, colore) { this.pilastri.push({ x, y, c: colore, t: 0, max: 0.65 }); },
    /** Linea "elettrica" persistente tra due punti: restituisce l'oggetto (poi .fine = true per toglierla). */
    linea(a, b, c1, c2) { const l = { a, b, c1, c2, pts: [], t: 0, ag: 0 }; this.lines.push(l); return l; },
    pulisciLinee() { this.lines.forEach(l => { l.fine = true; }); },
    congela(ms) { this.frozen = performance.now() + ms; },
    loop(t) {
      let dt = Math.min(0.05, (t - this.last) / 1000 || 0.016); this.last = t;
      if (t < this.frozen) dt = 0;
      const g = this.ctx; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, this.W, this.H);
      if (dt) this.emetti(dt);
      // polvere d'ambiente (granelli che galleggiano)
      if (this.ambiente) {
        while (this.motes.length < 34) this.motes.push({ x: rnd(0, this.W), y: rnd(0, this.H), r: rnd(0.8, 2.4), vx: rnd(-8, 12), vy: rnd(-14, -2), ph: rnd(0, 7), a: rnd(0.15, 0.45) });
        this.motes.forEach(m => { m.x += m.vx * dt; m.y += m.vy * dt; m.ph += dt; if (m.y < -4 || m.x > this.W + 4 || m.x < -4) { m.y = this.H + 4; m.x = rnd(0, this.W); } });
        this.motes.forEach(m => { g.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(m.ph * 2)); g.fillStyle = 'rgb(' + this.ambiente + ')'; g.beginPath(); g.arc(m.x, m.y, m.r, 0, 7); g.fill(); });
      }
      // nuvole di polvere (compositing normale)
      this.puffs = this.puffs.filter(p => (p.life += dt) < p.max);
      this.puffs.forEach(p => {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; const k = p.life / p.max, r = p.r * (1 + 1.9 * k);
        const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, 'rgba(' + p.c + ',' + 0.5 * (1 - k) + ')'); gr.addColorStop(1, 'rgba(' + p.c + ',0)');
        g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
      });
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      this.disegnaForme(g, dt);
      // onde d'urto sul pavimento
      this.urti = this.urti.filter(r => (r.t += dt) < r.max);
      this.urti.forEach(r => { const k = r.t / r.max; g.globalAlpha = (1 - k) * 0.9; g.strokeStyle = r.c; g.lineWidth = 5 * (1 - k) + 1; g.beginPath(); g.ellipse(r.x, r.y, 10 + r.r * k, (10 + r.r * k) * 0.32, 0, 0, 7); g.stroke(); });
      // fendenti
      this.tagli = this.tagli.filter(s => (s.t += dt) < s.max);
      this.tagli.forEach(s => {
        const k = s.t / s.max, e = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3), a0 = s.ang - 1.05, a1 = s.ang + 1.05, head = a0 + (a1 - a0) * e, tail = Math.max(a0, head - 1.3);
        const N = 18; g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.45) / 0.55);
        for (let i = 0; i < N; i++) {
          const t0 = tail + (head - tail) * i / N, t1 = tail + (head - tail) * (i + 1) / N, w = (i + 1) / N;
          [[s.c, 14, 0.4], ['#fff', 5, 1]].forEach(([c, lw, al]) => {
            g.strokeStyle = c; g.globalAlpha = al * w * Math.max(0, 1 - Math.max(0, k - 0.45) / 0.55); g.lineWidth = lw * w;
            g.beginPath(); g.arc(s.x - Math.cos(s.ang) * s.len * 0.5, s.y - Math.sin(s.ang) * s.len * 0.5, s.len, t0, t1); g.stroke();
          });
        }
      });
      this.flashes = this.flashes.filter(f => { f.t += dt; return f.t < f.max; });
      this.flashes.forEach(f => { g.globalAlpha = f.a * (1 - f.t / f.max); g.fillStyle = f.c; g.fillRect(0, 0, this.W, this.H); });
      this.rings = this.rings.filter(r => { r.t += dt; return r.t < r.max; });
      this.rings.forEach(r => { const k = r.t / r.max; g.globalAlpha = 1 - k; g.strokeStyle = r.c; g.lineWidth = 6 * (1 - k) + 1; g.beginPath(); g.arc(r.x, r.y, 8 + r.r * k, 0, 7); g.stroke(); });
      this.proiettili = this.proiettili.filter(p => (p.t += dt) < p.max);
      this.proiettili.forEach(p => {
        const k = p.t / p.max, k0 = Math.max(0, k - 0.22), arc = kk => -p.arco * Math.sin(Math.PI * kk);
        const x1 = p.a.x + (p.b.x - p.a.x) * k, y1 = p.a.y + (p.b.y - p.a.y) * k + arc(k), x0 = p.a.x + (p.b.x - p.a.x) * k0, y0 = p.a.y + (p.b.y - p.a.y) * k0 + arc(k0);
        g.globalAlpha = 0.5; g.strokeStyle = p.c; g.lineWidth = 8 * p.w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = 3 * p.w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      });
      this.pilastri = this.pilastri.filter(p => (p.t += dt) < p.max);
      this.pilastri.forEach(p => {
        const k = p.t / p.max, w = 34 * (1 - k * 0.6), top = Math.max(0, p.y - 420), gr = g.createLinearGradient(0, top, 0, p.y);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, p.c); gr.addColorStop(1, '#fff');
        g.globalAlpha = (1 - k) * 0.85; g.fillStyle = gr; g.fillRect(p.x - w, top, w * 2, p.y - top);
      });
      this.parts = this.parts.filter(p => (p.life += dt) < p.max);
      this.parts.forEach(p => {
        p.vy += (p.g == null ? 900 : p.g) * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = 1 - p.life / p.max; g.strokeStyle = p.c; g.lineWidth = p.w;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
      });
      this.lines = this.lines.filter(l => !l.fine || (l.fade = (l.fade || 0) + dt) < 0.25);
      this.lines.forEach(l => {
        l.t += dt; l.ag -= dt;
        if (l.ag <= 0) {            // rigenera la forma ogni ~50ms (crepitio)
          l.ag = 0.05; l.pts = [];
          const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, N = 12;
          for (let i = 0; i <= N; i++) {
            const k = i / N, j = (i === 0 || i === N) ? 0 : rnd(-1, 1) * 18 * Math.sin(k * Math.PI);
            l.pts.push({ x: l.a.x + dx * k + nx * j, y: l.a.y + dy * k + ny * j });
          }
        }
        const alpha = (l.fine ? 1 - (l.fade || 0) / 0.25 : 1) * (0.75 + 0.25 * Math.sin(l.t * 40));
        [[l.c1, 9, 0.35], [l.c2, 5, 0.6], ['#fff', 2, 1]].forEach(([c, w, a]) => {
          g.globalAlpha = alpha * a; g.strokeStyle = c; g.lineWidth = w; g.beginPath();
          l.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
        });
        if (Math.random() < 0.5) { const m = l.pts[6]; if (m) this.sparks(m.x, m.y, 1, l.c2, 0.4); }
      });
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      requestAnimationFrame(t2 => this.loop(t2));
    }
  };

  /* ===================================================================== */
  /* Elementi riutilizzabili                                               */
  /* ===================================================================== */
  /** Busto circolare per HUD e liste. Usa l'arte SVG (o lo sprite) se disponibile, altrimenti l'iniziale. */
  UI.ritratto = function (def, cls) {
    if (E.Arte) return E.Arte.busto(def, cls);
    const d = el('div', 'ritratto ' + (cls || ''), def.sigla || def.breve.slice(0, 1));
    d.style.setProperty('--c', def.colore || E.AFFINITA[def.aff].colore);
    return d;
  };
  /** Moneta 3D in CSS. */
  function creaMoneta(piccola) {
    const m = el('div', 'moneta fissa esito-testa' + (piccola ? ' piccola' : ''));
    const d3 = el('div', 'm3d');
    d3.innerHTML = '<div class="rim"></div><div class="rim"></div><div class="rim"></div><div class="rim"></div><div class="testa">♛</div><div class="croce">✕</div>';
    m.appendChild(d3);
    return m;
  }
  function lanciaMoneta(m, testa) {
    m.classList.remove('lancio', 'fissa', 'esito-testa', 'esito-croce');
    void m.offsetWidth;   // riavvia l'animazione
    m.classList.add('lancio', testa ? 'esito-testa' : 'esito-croce');
  }
  UI.modale = function (nodo) {
    const m = $('#modale'); m.innerHTML = ''; const p = el('div', 'pannello-modale');
    p.appendChild(nodo);
    const b = el('button', 'btn', 'Chiudi'); b.style.marginTop = '12px'; b.onclick = () => m.classList.remove('on');
    p.appendChild(b); m.appendChild(p); m.classList.add('on');
    m.onclick = e => { if (e.target === m) m.classList.remove('on'); };
  };
  UI.mostra = function (nome) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + nome));
    // musica di sottofondo per schermata (la battaglia sceglie da sé battaglia/boss)
    const temi = { menu: 'menu', squadra: 'menu', archivio: 'menu', campagna: 'mappa', mappa: 'mappa', storia: 'storia', gacha: 'gacha' };
    const run = E.Save && E.Save.data && E.Save.data.run;
    if (E.Musica && temi[nome]) E.Musica.tema(temi[nome], (nome === 'mappa' || nome === 'storia') && run ? run.cap - 1 : nome === 'menu' && E.Save && E.Save.data ? Math.max(0, (E.Save.data.progresso.sbloccato || 1) - 1) : 0);
  };
  UI.tabellaAffinita = function () {
    const d = el('div');
    d.innerHTML = '<h3>Affinità</h3><p>Ogni affinità è forte contro la successiva e debole contro la precedente. Vantaggio: <b>+1 PM</b> e <b>+25% danno</b>. Svantaggio: <b>−1 PM</b> e <b>−20% danno</b>.</p>';
    const t = el('table', 'tab-aff'); t.innerHTML = '<tr><th>Affinità</th><th>Batte</th><th>Perde contro</th></tr>';
    const o = E.AFFINITA_ORDINE;
    o.forEach((a, i) => {
      const nx = o[(i + 1) % 6], pr = o[(i + 5) % 6];
      const r = el('tr'); r.innerHTML = `<td style="color:${E.AFFINITA[a].colore}"><b>${E.AFFINITA[a].simbolo} ${E.AFFINITA[a].nome}</b><br><small>${E.AFFINITA[a].tema}</small></td><td class="v">${E.AFFINITA[nx].nome}</td><td class="s">${E.AFFINITA[pr].nome}</td>`;
      t.appendChild(r);
    });
    d.appendChild(t);
    d.appendChild(el('p', '', '<b>Concordie</b> (coppie opposte): ' + E.CONCORDIE.map(c => E.AFFINITA[c[0]].nome + ' + ' + E.AFFINITA[c[1]].nome).join(' · ') + '.<br>Con una Concordia in squadra: +4 Sanità ai due membri e +1 Ardore iniziale.'));
    UI.modale(d);
  };
  /** Diagramma del ciclo delle affinità (SVG). */
  UI.diagrammaAffinita = function () {
    const o = E.AFFINITA_ORDINE, cx = 100, cy = 96, R = 70, pos = i => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
    let s = '<svg viewBox="0 0 200 192" class="diag-svg"><defs><marker id="frecciaA" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#e8d8a8"/></marker></defs>';
    o.forEach((a, i) => {
      const p = pos(i), q = pos((i + 1) % 6), dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), k = 17 / L;
      s += `<line x1="${p[0] + dx * k}" y1="${p[1] + dy * k}" x2="${q[0] - dx * k}" y2="${q[1] - dy * k}" stroke="#e8d8a8" stroke-width="2" marker-end="url(#frecciaA)"/>`;
    });
    o.forEach((a, i) => { const p = pos(i), A = E.AFFINITA[a]; s += `<circle cx="${p[0]}" cy="${p[1]}" r="15" fill="${A.colore}" stroke="#000" stroke-opacity=".5" stroke-width="1.5"/><text x="${p[0]}" y="${p[1] + 5}" text-anchor="middle" font-size="15" fill="#1b1422" font-weight="bold">${A.simbolo}</text><text x="${p[0]}" y="${p[1] + (p[1] < cy ? -20 : 29)}" text-anchor="middle" font-size="10" fill="#efe6d2">${A.nome}</text>`; });
    return s + '<text x="100" y="94" text-anchor="middle" font-size="9" fill="#a99fb4">forte contro →</text></svg>';
  };
  /** Manuale "Come si gioca" a pagine. */
  UI.manuale = function (pag) {
    const P = E.TUTORIAL.manuale; pag = pag || 0;
    const d = el('div', 'manuale');
    d.appendChild(el('h3', '', 'Come si gioca — ' + P[pag].titolo));
    const corpo = el('div', 'man-corpo', P[pag].html); d.appendChild(corpo);
    const dg = corpo.querySelector('.diag-aff'); if (dg) dg.innerHTML = UI.diagrammaAffinita();
    const ls = corpo.querySelector('.lista-stati');
    if (ls) Object.keys(E.STATI).forEach(k => { const s = E.STATI[k]; ls.appendChild(el('li', '', `<b style="color:${s.colore}">${s.icona} ${s.nome}</b> — ${s.desc}`)); });
    const nav = el('div', 'man-nav');
    const prec = el('button', 'btn piccolo', '← Indietro'), succ = el('button', 'btn piccolo', 'Avanti →');
    prec.disabled = pag === 0; succ.disabled = pag === P.length - 1;
    prec.onclick = () => UI.manuale(pag - 1); succ.onclick = () => UI.manuale(pag + 1);
    nav.appendChild(prec); nav.appendChild(el('span', 'man-pag', (pag + 1) + ' / ' + P.length)); nav.appendChild(succ); d.appendChild(nav);
    UI.modale(d);
  };
  /** Suggerimenti al passaggio del mouse / tocco su elementi con data-tip. */
  UI.iniziaTip = function () {
    const tip = el('div', 'tip'); tip.id = 'tip'; $('#app').appendChild(tip); let to = null;
    const mostra = t => {
      tip.innerHTML = t.dataset.tip; tip.classList.add('on');
      const r = t.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 6, root.innerWidth - tw - 6) + 'px';
      tip.style.top = (r.top - th - 8 < 6 ? r.bottom + 8 : r.top - th - 8) + 'px';
    };
    const nascondi = () => { tip.classList.remove('on'); clearTimeout(to); };
    document.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse') return; const t = e.target.closest && e.target.closest('[data-tip]'); if (t) mostra(t); else nascondi(); });
    document.addEventListener('pointerdown', e => {
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (t && e.pointerType !== 'mouse') { mostra(t); clearTimeout(to); to = setTimeout(nascondi, 2800); } else if (e.pointerType !== 'mouse') nascondi();
    });
  };
  UI.opzioni = function (save, persist, onVel) {
    const d = el('div'); d.innerHTML = '<h3>Opzioni</h3>';
    const r1 = el('div', 'opz-riga', '<span>Velocità animazioni</span>'); const g = el('span');
    [1, 2, 4].forEach(v => { const b = el('button', 'btn piccolo' + (save.opzioni.vel === v ? ' attivo' : ''), '×' + v); b.style.marginLeft = '4px'; b.onclick = () => { save.opzioni.vel = v; persist(); onVel(v); $$('button', g).forEach(x => x.classList.toggle('attivo', x === b)); }; g.appendChild(b); });
    r1.appendChild(g); d.appendChild(r1);
    const r2 = el('div', 'opz-riga', '<span>Suono</span>'); const b2 = el('button', 'btn piccolo', save.opzioni.audio ? 'Sì' : 'No');
    b2.onclick = () => { save.opzioni.audio = !save.opzioni.audio; Snd.on = save.opzioni.audio; b2.textContent = save.opzioni.audio ? 'Sì' : 'No'; persist(); };
    r2.appendChild(b2); d.appendChild(r2);
    const rm = el('div', 'opz-riga', '<span>Musica</span>'); const bm = el('button', 'btn piccolo', save.opzioni.musica === false ? 'No' : 'Sì');
    bm.onclick = () => { save.opzioni.musica = save.opzioni.musica === false; bm.textContent = save.opzioni.musica ? 'Sì' : 'No'; persist(); Snd.init(); if (E.Musica) E.Musica.attiva(save.opzioni.musica); };
    rm.appendChild(bm); d.appendChild(rm);
    const rf = el('div', 'opz-riga', '<span>Schermo intero</span>'); const bf = el('button', 'btn piccolo', 'Attiva');
    bf.onclick = () => { const de = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else if (de.requestFullscreen) de.requestFullscreen(); } catch (e) { /* non supportato */ } };
    rf.appendChild(bf); d.appendChild(rf);
    const rt = el('div', 'opz-riga', '<span>Tutorial: ' + (save.tutorial === 'completato' ? 'completato' : save.tutorial === 'saltato' ? 'saltato' : 'da fare') + '</span>');
    const bt = el('button', 'btn piccolo', 'Riattiva suggerimenti'); bt.onclick = () => { delete save.tutorial; persist(); bt.textContent = 'Fatto'; bt.disabled = true; }; rt.appendChild(bt); d.appendChild(rt);
    const r3 = el('div', 'opz-riga', '<span>Cancella salvataggio</span>'); const b3 = el('button', 'btn piccolo', 'Cancella');
    b3.onclick = () => { if (confirm('Cancellare tutti i progressi?')) { E.Save.reset(); location.reload(); } };
    r3.appendChild(b3); d.appendChild(r3);
    d.appendChild(el('p', 'vuoto', `Vittorie: ${save.stats.vittorie} · Sconfitte: ${save.stats.sconfitte}`));
    UI.modale(d);
  };

  /* ===================================================================== */
  /* Selezione squadra                                                     */
  /* ===================================================================== */
  UI.squadra = {
    sel: [], ctx: null, filtro: null,
    init(ctx, opts) {
      this.ctx = ctx; const save = ctx.save; this.filtro = null; this.opts = opts = opts || {};
      const pool = opts.pool || Object.keys(E.VOCI);
      this.pool = pool;
      this.sel = (save.squadra || []).filter(id => E.VOCI[id] && pool.includes(id)).slice(0, C.SQUADRA_MAX);
      if (this.sel.length < C.SQUADRA_MAX) pool.forEach(id => { if (this.sel.length < C.SQUADRA_MAX && !this.sel.includes(id)) this.sel.push(id); });
      $('#scr-squadra .barra h2').textContent = opts.titolo || 'Scegli 4 Voci';
      $('#sq-via').textContent = opts.testoVia || 'Combatti';
      $('#sq-incontro').parentElement.style.display = opts.nascondiIncontro ? 'none' : '';
      const g = $('#sq-griglia'); g.innerHTML = '';
      Object.values(E.VOCI).filter(v => pool.includes(v.id)).sort((a, b) => a.epoca - b.epoca).forEach(v => {
        const c = el('div', 'sq-card'); c.dataset.id = v.id; c.dataset.aff = v.aff;
        c.appendChild(UI.ritratto(v));
        c.appendChild(el('div', 'n', v.breve));
        c.appendChild(el('div', 'm', `<span style="color:${E.AFFINITA[v.aff].colore}">${E.AFFINITA[v.aff].simbolo} ${E.AFFINITA[v.aff].nome}</span> · Cap. ${E.CAPITOLI[v.epoca - 1].num}`));
        c.appendChild(el('div', 'stelle', '★'.repeat(v.rarita)));
        const lvl = E.Save && E.Save.livello ? E.Save.livello(v.id) : 0; if (opts.pool && lvl) c.appendChild(el('div', 'eco-lv', 'Eco ' + lvl));
        c.onclick = () => { Snd.sfx('ui'); this.toggle(v.id); };
        g.appendChild(c);
      });
      // filtri per affinità
      const f = $('#sq-filtri'); f.innerHTML = '';
      const chip = (txt, aff, col) => { const b = el('button', 'chip-filtro' + (aff === this.filtro ? ' on' : ''), txt); if (col) b.style.setProperty('--ac', col); b.dataset.aff = aff || ''; b.onclick = () => { this.filtro = aff || null; this.applicaFiltro(); }; f.appendChild(b); };
      chip('Tutte', null); E.AFFINITA_ORDINE.forEach(a => chip(E.AFFINITA[a].simbolo + ' ' + E.AFFINITA[a].nome, a, E.AFFINITA[a].colore));
      const s = $('#sq-incontro'); s.innerHTML = '';
      Object.values(E.INCONTRI).filter(i => !i.tutorial).forEach(i => { const o = el('option', '', i.nome); o.value = i.id; s.appendChild(o); });
      s.value = save.incontro && E.INCONTRI[save.incontro] ? save.incontro : 'pattuglia';
      $('#sq-via').onclick = () => (opts.onVia ? opts.onVia(this.sel.slice()) : ctx.onAvvia(this.sel.slice(), s.value));
      $('#sq-affinita').onclick = () => UI.tabellaAffinita();
      $('#sq-consigliata').onclick = () => { this.sel = ['scipione', 'spartaco', 'perpetua', 'leonardo'].filter(id => pool.includes(id)); pool.forEach(id => { if (this.sel.length < C.SQUADRA_MAX && !this.sel.includes(id)) this.sel.push(id); }); this.salva(); this.aggiorna(); this.dettaglio(this.sel[0]); };
      $('#sq-casuale').onclick = () => {
        const tutte = pool.slice().sort(() => Math.random() - 0.5), sc = [], usate = new Set();
        tutte.forEach(id => { if (sc.length < C.SQUADRA_MAX && !usate.has(E.VOCI[id].aff)) { sc.push(id); usate.add(E.VOCI[id].aff); } });
        tutte.forEach(id => { if (sc.length < C.SQUADRA_MAX && !sc.includes(id)) sc.push(id); });
        this.sel = sc; this.salva(); this.aggiorna(); this.dettaglio(sc[0]);
      };
      this.aggiorna(); this.dettaglio(this.sel[0] || pool[0]);
    },
    applicaFiltro() {
      $$('.chip-filtro').forEach(b => b.classList.toggle('on', (b.dataset.aff || null) === this.filtro));
      $$('.sq-card').forEach(c => c.classList.toggle('nascosta', !!this.filtro && c.dataset.aff !== this.filtro));
    },
    salva() { this.ctx.save.squadra = this.sel.slice(); this.ctx.persist(); },
    toggle(id) {
      const i = this.sel.indexOf(id);
      if (i >= 0) this.sel.splice(i, 1);
      else if (this.sel.length < C.SQUADRA_MAX) this.sel.push(id);
      this.dettaglio(id); this.aggiorna(); this.salva();
    },
    aggiorna() {
      $$('.sq-card').forEach(c => c.classList.toggle('sel', this.sel.includes(c.dataset.id)));
      $('#sq-conta').textContent = this.sel.length + '/' + C.SQUADRA_MAX;
      $('#sq-via').disabled = this.sel.length !== C.SQUADRA_MAX;
      // anteprima della squadra con Concordie e copertura delle affinità
      const t = $('#sq-team'); t.innerHTML = '';
      for (let i = 0; i < C.SQUADRA_MAX; i++) {
        const id = this.sel[i], slot = el('div', 'slot' + (id ? ' pieno' : ''));
        if (id) { slot.appendChild(UI.ritratto(E.VOCI[id])); slot.appendChild(el('span', 'nm', E.VOCI[id].breve)); slot.title = 'Rimuovi'; slot.onclick = () => this.toggle(id); }
        else slot.appendChild(el('span', 'vuoto-slot', '+'));
        t.appendChild(slot);
      }
      const affs = this.sel.map(id => E.VOCI[id].aff), info = el('div', 'team-info');
      const conc = E.CONCORDIE.filter(([a, b]) => affs.includes(a) && affs.includes(b));
      info.innerHTML = (conc.length ? conc.map(c => `<span class="badge-conc">Concordia ${E.AFFINITA[c[0]].simbolo}${E.AFFINITA[c[1]].simbolo}</span>`).join('') : '<span class="badge-no">Nessuna Concordia</span>') +
        `<span class="badge-aff">${new Set(affs).size} affinità</span>`;
      t.appendChild(info);
    },
    dettaglio(id) {
      const v = E.VOCI[id], d = $('#sq-dettaglio'); d.innerHTML = '';
      const a = E.AFFINITA[v.aff];
      const fw = el('div', 'det-fig'); if (E.Arte) fw.appendChild(E.Arte.figura(id)); d.appendChild(fw);
      d.appendChild(el('h3', '', v.nome));
      d.appendChild(el('small', '', `${E.CAPITOLI[v.epoca - 1].epoca} · ${v.ruolo} · <span style="color:${a.colore}">${a.simbolo} ${a.nome}</span> · ${'★'.repeat(v.rarita)}`));
      d.appendChild(el('p', '', `PV <b>${v.pv}</b> · Velocità <b>${v.vel[0]}–${v.vel[1]}</b> · Forte contro <b style="color:${E.AFFINITA[E.AFFINITA_ORDINE[(E.AFFINITA_ORDINE.indexOf(v.aff) + 1) % 6]].colore}">${E.AFFINITA[E.AFFINITA_ORDINE[(E.AFFINITA_ORDINE.indexOf(v.aff) + 1) % 6]].nome}</b>`));
      d.appendChild(el('div', 'skill-box', `<b>Passiva — ${v.passiva.nome}</b><small>${v.passiva.desc}</small>`));
      v.skills.forEach(sid => {
        const s = E.SKILL[sid];
        d.appendChild(el('div', 'skill-box', `<b>${s.nome}</b> <span style="color:var(--oro)">◆${s.costo}</span>
          <small>${s.monete} monete · PB ${s.pb} · PM +${s.pm} · ${E.AFFINITA[s.aff].nome} · attacco «${(E.ANIM_SKILL && E.ANIM_SKILL[sid]) || 'base'}»</small>
          <small>${E.descrizioneSkill(s).join('<br>') || '—'}</small>`));
      });
      d.appendChild(el('small', 'vuoto', 'Voce romanzata: carattere e abilità sono inventati; nomi e fatti storici no.'));
    }
  };

  /** Scena animata dietro il menu principale: la squadra salvata contro un Eco, tutti con la loro idle. */
  UI.menuScena = function (save) {
    const c = $('#menu-scena'); if (!c || !E.Arte) return;
    const prog = save.progresso || { sbloccato: 1 }, cap = clamp((prog.sbloccato || 1) - 1, 0, 6);
    const p = E.Arte.applicaPalette(c, cap);
    c.innerHTML = '<div class="ms-bg"></div><div class="ms-floor"><div class="arena-disco"></div></div>';
    $('.ms-bg', c).innerHTML = E.Arte.sfondo(cap);
    const capo = E.CAPITOLI[cap]; const mb = $('#mb-cap'); if (mb && capo) mb.textContent = (save.run ? 'Spedizione in corso · ' : '') + 'Capitolo ' + capo.num + ' · ' + capo.epoca;
    const mv = $('#menu-valute'); if (mv && save.valute) mv.innerHTML = `<span class="val sigilli">❂ ${save.valute.sigilli}</span><span class="val denari">◎ ${save.valute.denari}</span>`;
    const alleati = (save.squadra && save.squadra.length ? save.squadra : ['scipione', 'spartaco', 'perpetua', 'leonardo']).filter(id => E.ARTE[id]).slice(0, 4);
    const pos = [[62, 80], [76, 72], [70, 96], [86, 88]];
    const anim = ['grido', 'invocazione', 'vittoria', 'benedizione', 'turbine', 'salto'];
    alleati.forEach((id, i) => {
      const d = document.createElement('div'); d.className = 'ms-pg'; d.style.left = pos[i][0] + '%'; d.style.top = pos[i][1] + '%'; d.style.zIndex = Math.round(pos[i][1]);
      if (E.ARTE[id].scala) d.style.setProperty('--sc', E.ARTE[id].scala);
      const f = E.Arte.figura(id); d.appendChild(f); c.appendChild(d);
      // tocco: il personaggio reagisce con una delle sue mosse
      d.onclick = () => { const sk = (E.VOCI[id] && E.VOCI[id].skills) || []; const mosse = sk.map(s => E.ANIM_SKILL[s]).filter(Boolean).concat(['grido']); const a = mosse[Math.floor(Math.random() * mosse.length)] || anim[0];
        E.Arte.anima(f, a === 'vittoria' ? 'grido' : a, 1); Snd.init(); Snd.sfx('ui'); };
    });
    if (UI.Fx) UI.Fx.ambiente = p.polvere;
  };

  /* ===================================================================== */
  /* Battaglia                                                             */
  /* ===================================================================== */
  /** Formazioni sul palcoscenico: posizione dei PIEDI (x%, y%) per numero di unità. */
  const FORM = {
    a: { 1: [[26, 86]], 2: [[19, 74], [33, 92]], 3: [[11, 76], [25, 92], [32, 68]], 4: [[9, 76], [22, 66], [26, 93], [39, 82]] },
    n: { 1: [[74, 86]], 2: [[81, 74], [67, 92]], 3: [[89, 76], [75, 92], [68, 68]], 4: [[91, 76], [78, 66], [74, 93], [61, 82]] }
  };
  /** Scala di prospettiva: chi sta più indietro (y minore) è più piccolo. */
  const profondita = y => clamp(0.82 + (y - 64) / 30 * 0.24, 0.8, 1.08);

  const Bat = UI.battaglia = {
    B: null, V: {}, els: {}, dadi: {}, sel: null, fase: 'idle', velBase: 1, skip: false, ctx: null, cl: null, linea: null, ardoreV: 0,
    skillDi: {}, spostati: new Set(), affondoOn: false,

    avvia(B, ctx) {
      this.B = B; this.ctx = ctx; this.fase = 'riproduzione'; this.skip = false;
      this.V = {}; this.els = {}; this.dadi = {}; this.sel = null; this.cl = null; this.skillDi = {}; this.spostati = new Set();
      this.sessione = (this.sessione || 0) + 1; this.stat = {}; this.skip = false;
      B.unita.forEach(x => { this.stat[x.id] = { danno: 0, colpi: 0, max: 0, subito: 0 }; });
      this.velBase = ctx.save.opzioni.vel || 1;
      Snd.on = ctx.save.opzioni.audio !== false;
      $('#col-alleati').innerHTML = ''; $('#col-nemici').innerHTML = ''; $('#log').innerHTML = ''; $('#risultato').classList.remove('on');
      $$('#stage .pg').forEach(p => p.remove());
      $('#clash').className = ''; $('#clash').innerHTML = '';
      $('#stage-bg').innerHTML = E.Arte ? E.Arte.sfondo(ctx.capitolo || 0) : '';
      const pal = E.Arte ? E.Arte.applicaPalette($('#stage'), ctx.capitolo || 0) : null;
      Fx.ambiente = pal ? pal.polvere : null; Fx.motes = []; Fx.emettitori = {};
      $('#cam').style.transform = ''; $('#stage').classList.remove('clashing');
      UI.mostra('battaglia');
      if (E.Musica) E.Musica.tema(B.unita.some(x => x.boss) ? 'boss' : 'battaglia', ctx.capitolo || 0);
      Combat().snapshot(B).forEach(u => this.aggiungiCarta(u));
      this.layout();
      this.ardoreV = B.ardore; this.mostraArdore();
      this.aggiornaVel(); $('#btn-audio').textContent = Snd.on ? '♪' : '✕'; $('#log').classList.remove('on');
      this.log('Il Custode entra nell\'Eco…', 'imp');
      if (E.Tutorial) { if (ctx.tutorial) E.Tutorial.inizia(ctx); else E.Tutorial.attivo = false; }
      this.cicloTurno(B.eventiIniziali);
    },

    /* ----- costruzione: targhetta (HUD) + figura (palcoscenico) ----- */
    aggiungiCarta(u) {
      this.V[u.id] = u;
      const def = u.lato === 'a' ? E.VOCI[u.def] : E.NEMICI[u.def];
      const spec = E.ARTE && E.ARTE[u.def] || {};
      const a = E.AFFINITA[u.aff];
      // Carta nel dock (solo alleati): ritratto, nome, PV, Sanità, dadi
      const c = el('div', 'unit ' + (u.lato === 'a' ? 'alleato' : 'nemico')); c.dataset.id = u.id;
      c.style.setProperty('--ac', a.colore);
      const rit = UI.ritratto(def);
      const info = el('div', 'info');
      info.innerHTML = `<div class="nome"><span class="aff" style="color:${a.colore}">${a.simbolo}</span>${u.breve}</div>
        <div class="barra-pv"><div class="ritardo"></div><div class="pieno"></div><div class="num"></div></div>
        <div class="barra-sanita"><div class="riempi"></div><div class="num"></div></div>
        <div class="chips"></div><div class="intenzioni"></div>`;
      c.append(rit, info);
      const dadi = el('div', 'dadi'); c.appendChild(dadi);
      c.onclick = () => this.clickCarta(u.id);
      if (u.lato === 'a') $('#col-alleati').appendChild(c);
      // Figura sul palcoscenico + targhetta sopra la testa (segue la figura quando scatta)
      const pg = el('div', 'pg ' + (u.lato === 'a' ? 'alleato' : 'nemico') + (spec.figura === 'elefante' ? ' quadrupede' : '')); pg.dataset.id = u.id;
      pg.style.setProperty('--sc', spec.scala || 1);
      const mov = el('div', 'pg-mov'), fig = E.Arte ? E.Arte.figura(u.def) : el('div', 'fig');
      const aure = el('div', 'pg-aure');
      const targa = el('div', 'targa'); targa.style.setProperty('--ac', a.colore);
      targa.innerHTML = `<div class="dadi"></div><div class="t-riga"><span class="t-aff">${a.simbolo}</span><span class="t-nome">${u.breve}</span></div>
        <div class="t-pv"><b></b><i></i></div><div class="t-san"><i></i></div><div class="t-chips"></div><div class="t-int"></div>`;
      targa.dataset.tip = `<b>${def.nome || u.breve}</b><br>${a.simbolo} ${a.nome}${def.ruolo ? ' · ' + def.ruolo : ''}`;
      mov.append(el('div', 'pg-ombra'), aure, fig, targa);
      pg.append(mov);
      pg.onclick = () => this.clickCarta(u.id);
      $('#cam').appendChild(pg);
      fig.classList.add('entra'); setTimeout(() => fig.classList.remove('entra'), 1000);
      this.els[u.id] = { card: c, rit, ritardo: $('.ritardo', c), pieno: $('.pieno', c), num: $('.barra-pv .num', c), san: $('.barra-sanita .riempi', c),
        sanNum: $('.barra-sanita .num', c), chips: $('.chips', c), intent: $('.t-int', targa), dadi, tag: null, pg, mov, fig, pgTag: null, aure,
        targa, tPv: $('.t-pv i', targa), tPvR: $('.t-pv b', targa), tSan: $('.t-san i', targa), tChips: $('.t-chips', targa), tDadi: $('.dadi', targa) };
      this.render(u.id);
    },
    /** Posiziona le figure secondo le formazioni e ridimensiona in base al palcoscenico. */
    layout() {
      const st = $('#stage'); if (!st) return;
      const cam = $('#cam'); st.style.setProperty('--fh', clamp(cam.clientHeight * 0.32, 48, 220) + 'px');
      ['a', 'n'].forEach(l => {
        const lista = Object.values(this.V).filter(u => u.lato === l);
        const slots = FORM[l][clamp(lista.length, 1, 4)];
        lista.forEach((u, i) => {
          const p = this.els[u.id].pg, s = slots[i] || slots[slots.length - 1];
          p.style.left = s[0] + '%'; p.style.top = s[1] + '%'; p.style.zIndex = Math.round(s[1] * 10);
          p.dataset.z = p.style.zIndex;
          const spec = (E.ARTE && E.ARTE[u.def]) || {};
          p.style.setProperty('--sc', ((spec.scala || 1) * profondita(s[1]) * (u.boss ? 1.28 : 1)).toFixed(3));
          p.classList.toggle('boss', !!u.boss);
        });
      });
    },
    render(id) {
      const u = this.V[id], e = this.els[id];
      const pct = clamp(u.pv / u.pvMax * 100, 0, 100);
      e.pieno.style.width = pct + '%'; e.ritardo.style.width = pct + '%';
      e.num.textContent = Math.ceil(u.pv) + ' / ' + u.pvMax;
      const w = Math.abs(u.sanita) / C.SANITA_MAX * 50;
      e.san.style.width = w + '%'; e.san.style.left = (u.sanita >= 0 ? 50 : 50 - w) + '%';
      e.san.style.background = u.sanita >= 0 ? 'linear-gradient(90deg,#6aa8ff,#9fd0ff)' : 'linear-gradient(270deg,#a97be0,#d1a3ff)';
      e.sanNum.textContent = u.sanita;
      const chips = Object.keys(u.stati).map(s => { const d = E.STATI[s]; return `<span class="chip" style="color:${d.colore}" data-tip="<b>${d.nome} ${u.stati[s]}</b><br>${d.desc}">${d.icona}${u.stati[s]}</span>`; }).join('');
      e.chips.innerHTML = chips; e.tChips.innerHTML = chips;
      e.tPv.style.width = pct + '%'; e.tPvR.style.width = pct + '%';
      e.tSan.style.width = w + '%'; e.tSan.style.left = (u.sanita >= 0 ? 50 : 50 - w) + '%'; e.tSan.style.background = u.sanita >= 0 ? '#9fd0ff' : '#d1a3ff';
      e.targa.dataset.tip = e.targa.dataset.tip.split('<br><small>')[0] + `<br><small>PV ${Math.ceil(u.pv)}/${u.pvMax} · Sanità ${u.sanita}</small>`;
      // aure degli stati (CSS) + particelle continue (Fx)
      Object.keys(E.STATI).forEach(st => {
        const k = 'aura-' + st, ex = e.aure.querySelector('.' + k);
        if (u.stati[st] && u.vivo) { if (!ex) e.aure.appendChild(el('div', 'aura ' + k, st === 'marchio' ? '<b>◎</b>' : '')); }
        else if (ex) ex.remove();
      });
      Fx.setStati(id, () => (this.els[id] && this.V[id].vivo ? this.pos(id) : null), u.vivo && Object.keys(u.stati).length ? Object.assign({}, u.stati) : null);
      e.card.classList.toggle('morto', !u.vivo);
      e.pg.classList.toggle('morto', !u.vivo);
      const ced = u.ced > 0 && u.vivo;
      e.card.classList.toggle('ced', ced);
      if (ced) e.fig.classList.add('ced'); else e.fig.classList.remove('ced');
      if (e.fig._sprite && E.Arte) E.Arte._sheet(e.fig, ced ? 'ced' : 'idle', 1);
      const tag = ced ? ['CEDIMENTO', ''] : u.panico && u.vivo ? ['PANICO', 'panico'] : u.sanita >= C.SANITA_MAX && u.vivo ? ['ESALTAZIONE', 'esaltazione'] : null;
      if (e.tag) { e.tag.remove(); e.tag = null; } if (e.pgTag) { e.pgTag.remove(); e.pgTag = null; }
      if (tag) { e.tag = el('div', 'tag ' + tag[1], tag[0]); e.card.appendChild(e.tag); e.pgTag = el('div', 'pg-tag ' + tag[1], tag[0]); e.pg.appendChild(e.pgTag); }
    },
    renderDadi(id, anima) {
      const e = this.els[id]; if (!e) return; e.dadi.innerHTML = ''; e.tDadi.innerHTML = '';
      (this.dadi[id] || []).forEach(d => [e.dadi, e.tDadi].forEach(box => { const x = el('div', 'dado' + (anima ? ' rolla' : ''), d); x.dataset.tip = '<b>Dado di velocità: ' + d + '</b><br>Chi ha il numero più alto agisce per primo e sceglie chi affrontare.'; box.appendChild(x); }));
    },
    mostraArdore() {
      const B = this.B, costo = this.fase === 'pianifica' ? Combat().costoPiano(B) : 0, tot = this.ardoreV;
      let h = '<span class="lab">Ardore</span>';
      for (let i = 0; i < C.ARDORE_MAX; i++) h += '<span class="gem ' + (i < tot - costo ? 'on' : i < tot ? 'pend' : '') + '"></span>';
      let rs = '';
      if (this.fase === 'pianifica') { const r = Combat().risonanza(B); rs = Object.keys(r).filter(k => r[k] >= 3).map(k => `<span class="ris" style="--c:${E.AFFINITA[k].colore}" data-tip="<b>Risonanza ${E.AFFINITA[k].nome} ×${r[k]}</b><br>+${C.RISONANZA[r[k] >= 4 ? 4 : 3]} PB alle skill di ${E.AFFINITA[k].nome} di questo turno">${E.AFFINITA[k].simbolo}×${r[k]}</span>`).join(''); }
      $('#ardore').innerHTML = h + '<span class="n">' + tot + (costo ? ' (−' + costo + ')' : '') + '</span>' + rs;
    },
    log(msg, cls) {
      const l = $('#log'); const d = el('div', cls || '', msg); l.appendChild(d);
      while (l.children.length > 80) l.removeChild(l.firstChild);
      l.scrollTop = l.scrollHeight;
    },

    /* ----- ciclo di turno ----- */
    async cicloTurno(evIniziali) {
      const B = this.B, S = this.sessione, viva = () => S === this.sessione;      // la sessione cambia se si abbandona o si ricomincia
      try {
        if (evIniziali && evIniziali.length) await this.riproduci(evIniziali);
        while (!B.esito && viva()) {
          Combat().iniziaTurno(B);
          await this.riproduci(B.eventi);
          if (B.esito || !viva()) break;
          await this.pianifica();
          if (!viva()) return;
          const evs = Combat().esegui(B);
          await this.riproduci(evs);
        }
        if (!viva()) return;
        await this.finale();
      } catch (err) { console.error('Errore nel ciclo di battaglia', err); this.log('Errore interno: ' + err.message, 'imp'); }
    },
    /** Attende che il giocatore prema "Esegui turno". */
    pianifica() {
      const B = this.B;
      this.fase = 'pianifica'; this.skip = false;
      const prima = Object.keys(this.V).filter(id => this.V[id].lato === 'a' && this.V[id].vivo && B.azioni.some(a => a.u === id))[0];
      this.sel = this.sel && B.azioni.some(a => a.u === this.sel) && this.V[this.sel].vivo ? this.sel : prima;
      this.aggiornaPiano(); setTimeout(() => { if (this.fase === 'pianifica') this.disegnaFrecce(); }, 450);
      this.log('— Pianifica: scegli skill e bersagli, poi Esegui turno —');
      if (E.Tutorial && E.Tutorial.attivo) E.Tutorial.pianifica(B.turno, this);
      return new Promise(res => { this._pronto = res; });
    },
    conferma() {
      if (this.fase !== 'pianifica' || this.bloccato()) return;
      if (!Combat().pianoValido(this.B)) { this.log('Ardore insufficiente per il piano scelto.', 'imp'); return; }
      Snd.init(); Snd.sfx('ui');
      if (E.Tutorial) E.Tutorial.notifica('esegui');
      this.fase = 'riproduzione'; $('#btn-esegui').disabled = true; $('#btn-affondo').style.display = 'none';
      $$('.unit, .pg').forEach(c => c.classList.remove('sel', 'bersaglio-di-sel', 'bersagliabile'));
      Object.keys(this.els).forEach(id => { this.els[id].intent.textContent = ''; });
      $('#scr-battaglia').classList.remove('pianifica'); this.disegnaFrecce();
      this.disegnaSkills();
      const r = this._pronto; this._pronto = null; r && r();
    },
    /** Abbandona la battaglia in corso e torna al menu. */
    abbandona() {
      this.sessione++; this.skip = true; this.fase = 'fine';
      const r = this._pronto; this._pronto = null; r && r();
      if (E.Tutorial && E.Tutorial.attivo) E.Tutorial.ferma(null);
      Fx.pulisciLinee(); this.zoom(0, 0, 1); this.messaAFuoco(null); $('#clash').className = ''; $('#risultato').classList.remove('on');
      $$('.num-fly,.banner,.cutin').forEach(n => n.remove());
      this.ctx.onMenu();
    },
    menuPausa() {
      if (this.fase === 'fine') return;
      const d = el('div', 'menu-pausa'); d.innerHTML = '<h3>Pausa</h3>';
      const mk = (txt, fn, cls) => { const b = el('button', 'btn ' + (cls || ''), txt); b.onclick = fn; d.appendChild(b); return b; };
      mk('Riprendi', () => $('#modale').classList.remove('on'), 'grande');
      mk('Come si gioca', () => UI.manuale(0));
      mk('Tabella affinità', () => UI.tabellaAffinita());
      mk('Registro dei combattimenti', () => { const w = el('div', 'log-modale'); w.innerHTML = '<h3>Registro</h3>' + $('#log').innerHTML; UI.modale(w); });
      mk('Opzioni', () => UI.opzioni(this.ctx.save, this.ctx.persist, v => { this.velBase = v; this.aggiornaVel(); }));
      mk('Abbandona battaglia', () => { if (confirm('Abbandonare la battaglia? I progressi di questo scontro andranno persi.')) { $('#modale').classList.remove('on'); this.abbandona(); } }, 'pericolo');
      UI.modale(d); const cb = $('#modale .pannello-modale > .btn:last-child'); if (cb) cb.style.display = 'none';
    },
    bloccato() { return !!(E.Tutorial && E.Tutorial.bloccaInput()); },
    clickCarta(id) {
      if (this.fase !== 'pianifica' || this.bloccato()) return;
      Snd.init();
      const u = this.V[id];
      if (u.lato === 'a') { if (u.vivo) { this.sel = id; Snd.sfx('ui'); this.aggiornaPiano(); } return; }
      if (!u.vivo || !this.sel) return;
      const a = this.B.azioni.find(x => x.u === this.sel);
      if (!a) return;
      const idx = this.B.byId[this.sel].skills.indexOf(a.skill);
      Combat().pianifica(this.B, this.sel, idx, id); Snd.sfx('ui');
      this.aggiornaPiano();
      if (E.Tutorial) E.Tutorial.notifica('bersaglio');
    },
    scegliSkill(idx) {
      if (this.fase !== 'pianifica' || !this.sel || this.bloccato()) return;
      const a = this.B.azioni.find(x => x.u === this.sel); if (!a) return;
      const dis = this.disponibile(a);
      if (E.SKILL[this.B.byId[this.sel].skills[idx]].costo > dis) return;
      Combat().pianifica(this.B, this.sel, idx, a.bers); Snd.sfx('ui');
      this.aggiornaPiano();
    },
    /** Attiva/disattiva l'Affondo: la Voce selezionata colpisce gratis un nemico in Cedimento. */
    toggleAffondo() {
      if (this.fase !== 'pianifica' || this.bloccato()) return;
      const B = this.B;
      if (B.affondo) { Combat().pianificaAffondo(B, null); this.log('Affondo annullato.'); }
      else {
        const ced = Combat().bersagliAffondo(B), act = B.azioni.find(x => x.u === this.sel);
        const tgt = (act && ced.find(c => c.id === act.bers)) || ced[0];
        if (!tgt || !this.sel || !Combat().pianificaAffondo(B, this.sel, tgt.id)) { this.log('Seleziona una Voce che possa agire per l\'Affondo.', 'imp'); return; }
        this.log(`Affondo pianificato: ${B.byId[this.sel].breve} → ${tgt.breve} (gratis, ×${C.AFFONDO_MOLT} danni).`, 'imp');
      }
      Snd.sfx('ui'); this.aggiornaPiano();
    },
    disponibile(a) { return this.B.ardore - (Combat().costoPiano(this.B) - E.SKILL[a.skill].costo); },
    aggiornaPiano() {
      const B = this.B;
      $('#scr-battaglia').classList.toggle('pianifica', this.fase === 'pianifica');
      Object.keys(this.els).forEach(id => {
        const e = this.els[id], u = this.V[id];
        [e.card, e.pg].forEach(x => { x.classList.toggle('sel', id === this.sel); x.classList.remove('bersaglio-di-sel'); x.classList.toggle('bersagliabile', u.lato === 'n' && u.vivo && !!this.sel); });
        const az = B.azioni.filter(a => a.u === id && !a.annullata && a.skill).map(a => `${E.SKILL[a.skill].nome} → ${this.V[a.bers] ? this.V[a.bers].breve : '?'}`);
        if (B.affondo && B.affondo.u === id) az.push(`AFFONDO → ${this.V[B.affondo.bers].breve}`);
        e.intent.textContent = this.fase === 'pianifica' ? az.join(' · ') : '';
      });
      const act = B.azioni.find(a => a.u === this.sel);
      if (act) { const t = this.els[act.bers]; if (t) { t.card.classList.add('bersaglio-di-sel'); t.pg.classList.add('bersaglio-di-sel'); } }
      // Pulsante Affondo: visibile solo con nemici in Cedimento
      const ab = $('#btn-affondo'), ced = Combat().bersagliAffondo(B);
      ab.style.display = ced.length && this.fase === 'pianifica' ? '' : 'none';
      ab.classList.toggle('attivo', !!B.affondo);
      ab.textContent = B.affondo ? 'Affondo ✔' : 'Affondo!';
      this.disegnaSkills(); this.mostraArdore(); this.disegnaFrecce();
      $('#btn-esegui').disabled = this.fase !== 'pianifica' || !Combat().pianoValido(B);
    },
    /** Frecce sul palcoscenico: piani delle Voci (colore della skill) e intenzioni dei nemici (rosse tratteggiate). */
    disegnaFrecce() {
      const svg = $('#frecce'); if (!svg) return;
      if (this.fase !== 'pianifica') { svg.innerHTML = ''; return; }
      const cam = $('#cam').getBoundingClientRect(), B = this.B;
      const centro = id => { const r = this.els[id].fig.getBoundingClientRect(); return { x: r.left + r.width / 2 - cam.left, y: r.top + r.height * 0.42 - cam.top }; };
      let h = '';
      const freccia = (da, a, col, cls, et, idx) => {
        const p = centro(da), q = centro(a), mx = (p.x + q.x) / 2, dy = Math.abs(q.x - p.x) * 0.22 + 18, my = Math.min(p.y, q.y) - dy - idx * 10;
        // il tratto si ferma prima della figura bersaglio; la punta è un triangolo orientato
        const t = 0.92, ex = (1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * mx + t * t * q.x, ey = (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * my + t * t * q.y;
        const ang = Math.atan2(ey - (my + (ey - my) * 0.6), ex - (mx + (ex - mx) * 0.6));
        const pt = (r, da) => `${(ex + Math.cos(ang + da) * r).toFixed(1)},${(ey + Math.sin(ang + da) * r).toFixed(1)}`;
        h += `<path class="fr ${cls}" style="--c:${col}" stroke="${col}" d="M${p.x.toFixed(1)} ${p.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"/>`;
        h += `<polygon points="${pt(9, 0)} ${pt(8, 2.5)} ${pt(8, -2.5)}" fill="${col}" style="filter:drop-shadow(0 0 4px ${col})"/>`;
        if (et) { const w = et.length * 6.4 + 12, lx = mx, ly = (p.y + 2 * my + q.y) / 4; h += `<g class="fr-et"><rect x="${(lx - w / 2).toFixed(1)}" y="${(ly - 9).toFixed(1)}" width="${w.toFixed(1)}" height="17" rx="8" stroke="${col}"/><text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle">${et}</text></g>`; }
      };
      const conta = {};
      B.azioni.forEach(a => {
        const u = this.V[a.u]; if (!u || !u.vivo || a.annullata || !a.skill || !this.V[a.bers] || !this.V[a.bers].vivo) return;
        const k = a.u + '>' + a.bers; conta[k] = (conta[k] || 0) + 1;
        if (u.lato === 'n') freccia(a.u, a.bers, '#ff5a6e', 'nem', '', conta[k] - 1);
        else {
          const pr = Combat().anteprima(B, a.u), col = E.AFFINITA[E.SKILL[a.skill].aff].colore;
          const et = pr && pr.scontro ? Math.round(pr.vittoria * 100) + '%' : pr ? 'libero' : '';
          freccia(a.u, a.bers, col, 'all' + (a.u === this.sel ? ' sel' : ''), a.u === this.sel ? et : '', conta[k] - 1);
        }
      });
      svg.innerHTML = h;
    },
    disegnaSkills() {
      const box = $('#skills'); box.innerHTML = '';
      if (this.fase !== 'pianifica' || !this.sel) { box.appendChild(el('div', 'vuoto', this.fase === 'pianifica' ? 'Nessuna Voce può agire.' : 'Gli Echi si scontrano…')); return; }
      const B = this.B, u = B.byId[this.sel], a = B.azioni.find(x => x.u === this.sel);
      if (!a) { box.appendChild(el('div', 'vuoto', u.breve + ' non può agire in questo turno.')); return; }
      const bers = B.byId[a.bers];
      u.skills.forEach((sid, idx) => {
        const s = E.SKILL[sid], af = E.AFFINITA[s.aff];
        const pr = bers ? Combat().anteprima(B, this.sel, sid, a.bers) : null, rel = pr ? pr.rel : 0;
        const b = el('button', 'skill-btn' + (a.skill === sid ? ' sel' : ''));
        b.style.setProperty('--ac', af.colore); b.dataset.sim = af.simbolo;
        b.disabled = u.panico || s.costo > this.disponibile(a) && a.skill !== sid;
        const pips = '<span class="pip"></span>'.repeat(pr ? pr.monete : s.monete);
        let prev = '';
        if (pr && pr.scontro) {
          const v = Math.round(pr.vittoria * 100), rs = E.SKILL[pr.rivale.skill];
          prev = `<div class="prev" data-tip="<b>Scontro previsto</b><br>contro ${rs.nome} (${pr.rivale.min}–${pr.rivale.max})<br>Probabilità di vincerlo: ${v}%"><span>${v}%</span><span class="barra"><i style="width:${v}%"></i></span><span style="color:var(--testo2)">${pr.rivale.min}–${pr.rivale.max}</span></div>`;
        } else if (pr) prev = '<div class="prev libero">Colpo libero</div>';
        b.innerHTML = `<div class="t"><span>${s.nome}</span><span class="costo${s.costo ? '' : ' zero'}">${s.costo ? '◆' + s.costo : '0'}</span></div>
          <div class="num"><span style="color:${af.colore}">${af.simbolo}</span><span class="pips">${pips}</span><span class="pot">${pr ? pr.min + '–' + pr.max : s.pb + '+' + s.pm}</span>
          ${rel > 0 ? '<span class="rel vant">▲</span>' : rel < 0 ? '<span class="rel svant">▼</span>' : ''}</div>
          <div class="d">${E.descrizioneSkill(s).join(' · ') || '&nbsp;'}</div>${prev}`;
        b.dataset.tip = `<b>${s.nome}</b> · ${af.nome}<br>${s.monete} monete · PB ${s.pb} · PM +${s.pm}${s.costo ? ' · costa ' + s.costo + ' Ardore' : ''}<br>${E.descrizioneSkill(s).join('<br>')}`;
        b.onclick = () => this.scegliSkill(idx);
        box.appendChild(b);
      });
      if (u.panico) box.appendChild(el('div', 'vuoto', 'In Panico: agisce senza controllo.'));
    },
    async finale() {
      const B = this.B; this.fase = 'fine';
      await this.rientraTutti();
      if (E.Tutorial && E.Tutorial.attivo && B.esito === 'vittoria') await E.Tutorial.fine(); else if (E.Tutorial && E.Tutorial.attivo) E.Tutorial.ferma(null);
      // Posa di vittoria dei sopravvissuti
      if (B.esito === 'vittoria') Object.keys(this.els).forEach(id => { if (this.V[id].lato === 'a' && this.V[id].vivo) this.els[id].fig.classList.add('a-vittoria'); });
      await this.sleep(900);
      const r = $('#risultato'); r.className = 'overlay on ' + B.esito;
      Snd.sfx(B.esito); if (E.Musica) E.Musica.fanfara(B.esito);
      const alleati = B.unita.filter(x => x.lato === 'a' && !x.npc), mvp = alleati.slice().sort((x, y) => this.stat[y.id].danno - this.stat[x.id].danno)[0];
      let righe = '';
      alleati.forEach(x => { const st = this.stat[x.id], v = this.V[x.id]; righe += `<tr class="${v.vivo ? '' : 'caduto'}${x === mvp && st.danno ? ' mvp' : ''}"><td>${x === mvp && st.danno ? '★ ' : ''}${x.breve}${v.vivo ? '' : ' ✝'}</td><td>${st.danno}</td><td>${st.colpi}</td><td>${st.max}</td><td>${st.subito}</td></tr>`; });
      r.innerHTML = `<h2>${B.esito === 'vittoria' ? 'VITTORIA' : 'SCONFITTA'}</h2><p class="sub">${B.esito === 'vittoria' ? 'L\'Eco si placa.' : 'L\'Eco vi inghiotte… per ora.'} · ${B.turno} turni</p>
        <table class="tab-risultato"><tr><th>Voce</th><th>Danni</th><th>Colpi</th><th>Max</th><th>Subiti</th></tr>${righe}</table><div class="risultato-extra"></div>`;
      const bx = el('div', 'risultato-btn');
      if (this.ctx.fineCampagna) {            // modalità campagna: ricompense e pulsanti decisi dalla campagna
        const f = this.ctx.fineCampagna(B.esito, B); $('.risultato-extra', r).innerHTML = f.html;
        f.bottoni.forEach(bt => { const b = el('button', 'btn ' + (bt.cls || ''), bt.testo); b.onclick = () => { r.classList.remove('on'); bt.fn(); }; bx.appendChild(b); });
      } else {
        const b1 = el('button', 'btn grande', 'Riprova'), b2 = el('button', 'btn', 'Cambia squadra'), b3 = el('button', 'btn', 'Menu');
        b1.onclick = () => this.ctx.onRiprova(); b2.onclick = () => this.ctx.onSquadra(); b3.onclick = () => this.ctx.onMenu();
        bx.append(b1, b2, b3);
      }
      r.appendChild(bx);
      if (!this.ctx.fineCampagna) this.ctx.onFine(B.esito, B);
    },

    /* ----- controlli velocità ----- */
    aggiornaVel() { $$('#comandi .vel button').forEach(b => { b.classList.toggle('attivo', +b.dataset.vel === this.velBase); }); },
    setVel(v) {
      if (v === 0) { this.skip = true; return; }
      this.velBase = v; this.ctx.save.opzioni.vel = v; this.ctx.persist(); this.aggiornaVel();
    },
    get vel() { return this.skip ? 8 : this.velBase; },
    sleep(ms) {
      if (this.skip) return Promise.resolve();
      return new Promise(r => setTimeout(r, ms / this.velBase));
    },

    /* ===================================================================== */
    /* Riproduzione degli eventi                                             */
    /* ===================================================================== */
    /** Centro (schermo) del busto della figura: usato come origine/bersaglio degli effetti. */
    pos(id) {
      const r = this.els[id].fig.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.45, w: r.width, h: r.height };
    },
    async riproduci(evs) {
      const S = this.sessione;
      if (this.fase !== 'pianifica') this.fase = 'riproduzione';
      for (const e of evs) {
        if (S !== this.sessione) return;
        try { await this.gestisci(e); } catch (err) { if (S === this.sessione) console.error('Errore evento', e, err); }
      }
      if (S !== this.sessione) return;
      await this.rientraTutti();
      this.skip = false;
    },
    numero(id, testo, cls, dy) {
      if (!this.els[id]) return;
      const p = this.pos(id), n = el('div', 'num-fly ' + (cls || ''), testo);
      n.style.left = clamp(p.x + rnd(-18, 18), cls === 'testo' ? 90 : 20, root.innerWidth - (cls === 'testo' ? 90 : 20)) + 'px'; n.style.top = (p.y - p.h * 0.3 + (dy || 0) + rnd(-8, 8)) + 'px'; n.style.setProperty('--dx', rnd(-46, 46) + 'px');
      $('#app').appendChild(n); setTimeout(() => n.remove(), 1200);
    },
    shake(elem, amp, dur) {
      const k = []; for (let i = 0; i < 8; i++) k.push({ transform: `translate(${rnd(-amp, amp)}px,${rnd(-amp, amp)}px)` }); k.push({ transform: 'translate(0,0)' });
      elem.animate(k, { duration: (dur || 300) / this.vel, composite: 'add' });
    },
    /** Hit-stop: congela animazioni DOM e canvas per pochi millisecondi. */
    async hitStop(ms) {
      if (this.skip) return;
      ms = ms / this.velBase;
      // Le animazioni CSS si fermano con una classe (animation-play-state): metterle in pausa via API le
      // "staccherebbe" dal CSS e la posa finale resterebbe appiccicata alla figura. Solo le animazioni
      // create da script (Element.animate) si fermano con pause()/play().
      const app = $('#app');
      const run = document.getAnimations().filter(a => a.playState === 'running' && !(root.CSSAnimation && a instanceof root.CSSAnimation));
      app.classList.add('congelato'); run.forEach(a => a.pause()); Fx.congela(ms);
      await new Promise(r => setTimeout(r, ms));
      app.classList.remove('congelato');
      run.forEach(a => { try { if (a.playState === 'paused') a.play(); } catch (x) { /* animazione già conclusa */ } });
    },
    banner(testo) {
      const b = el('div', 'banner', testo); $('#app').appendChild(b); setTimeout(() => b.remove(), 1700);
    },
    /** Stile d'attacco di un'unità per una skill (da ARTE o dalla skill stessa). */
    stile(unitId, skillId) {
      const s = E.SKILL[skillId], u = this.V[unitId];
      return (E.ANIM_SKILL && E.ANIM_SKILL[skillId]) || (s && s.anim) || (E.ARTE && E.ARTE[u.def] && E.ARTE[u.def].attacco) || 'fendente';
    },
    anima(id, nome) { return E.Arte ? E.Arte.anima(this.els[id].fig, nome, this.vel) : Promise.resolve(); },

    /* ----- spostamenti delle figure ----- */
    /** Punto di contatto con il terreno (centro dei piedi) in coordinate schermo. */
    piedi(id) { const r = this.els[id].fig.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - 2 }; },
    /** Sposta la figura con una corsa (gambe animate, polvere, schiacciamento in partenza). */
    muovi(id, dx, dy, dur) {
      const e = this.els[id], d = (dur || 0.28) / this.vel;
      const corre = Math.hypot(dx, dy) > 14 && !this.skip;
      e.mov.style.transitionDuration = d + 's'; e.mov.style.transitionTimingFunction = 'cubic-bezier(.35,.0,.25,1)';
      e.mov.style.transform = `translate(${dx}px,${dy}px)`;
      this.spostati.add(id);
      { // ordinamento in profondità: chi sta più in basso sullo schermo (più vicino) sta davanti
        const st = $('#stage').getBoundingClientRect(), fr = e.fig.getBoundingClientRect();
        e.pg.style.zIndex = 2000 + Math.round((fr.bottom + dy - st.top) / st.height * 1000) + 5; }
      if (corre) {
        e.fig.classList.add('corre');
        const f0 = this.piedi(id); Fx.polvere(f0.x, f0.y, 5, 0.9);
        e.fig.style.transformOrigin = '50% 100%';
        e.fig.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(.9,1.1)', offset: .25 }, { transform: 'scale(1.1,.94)', offset: .8 }, { transform: 'scale(1,1)' }], { duration: d * 1000 });
        const t0 = performance.now();
        const passo = () => { if (!e.fig.classList.contains('corre')) return; const f = this.piedi(id); Fx.polvere(f.x, f.y, 1, 0.5); setTimeout(passo, 70); };
        setTimeout(passo, 70);
        setTimeout(() => { e.fig.classList.remove('corre'); const f = this.piedi(id); Fx.polvere(f.x, f.y, 6, 1.1); }, d * 1000 + 20);
      }
    },
    /** L'attaccante raggiunge il bersaglio lungo il terreno; la distanza dipende dal tipo di animazione. */
    async avanza(att, bers, A) {
      const fa = this.piedi(att), fb = this.piedi(bers), pa = this.pos(att);
      const dist = (A && A.dist) || 'vicino';
      if (dist === 'sul_posto') return;
      const stop = dist === 'lontano' ? Math.max(pa.w * 2.8, 100) : dist === 'medio' ? Math.max(pa.w * 2.0, 80) : dist === 'carica' ? Math.max(pa.w * 0.7, 30) : Math.max(pa.w * 0.9, 38);
      const lato = Math.sign(fa.x - fb.x) || 1;                       // da che parte del bersaglio si trova
      const tx = fb.x + lato * stop, dx = Math.abs(fa.x - fb.x) < stop ? 0 : tx - fa.x;
      const dur = dist === 'carica' ? 0.2 : 0.28;
      this.muovi(att, dx, fb.y - fa.y + 2, dur);
      await this.sleep(dur * 1000 + 20);
    },
    /** Due combattenti si incontrano a metà strada, sulla stessa linea di terreno. */
    async incontra(ida, idb) {
      const fa = this.piedi(ida), fb = this.piedi(idb), pa = this.pos(ida);
      const mx = (fa.x + fb.x) / 2, my = (fa.y + fb.y) / 2, gap = Math.max(pa.w * 0.95, 46), la = Math.sign(fb.x - fa.x) || 1;
      this.muovi(ida, mx - la * gap / 2 - fa.x, my - fa.y);
      this.muovi(idb, mx + la * gap / 2 - fb.x, my - fb.y + 1);
      await this.sleep(320);
    },
    async rientraTutti() {
      if (!this.spostati.size) return;
      this.spostati.forEach(id => {
        const e = this.els[id]; if (!e) return;
        e.mov.style.transitionDuration = (0.3 / this.vel) + 's'; e.mov.style.transform = '';
        e.pg.style.zIndex = e.pg.dataset.z || '';
        if (!this.skip) { e.fig.classList.add('corre'); setTimeout(() => e.fig.classList.remove('corre'), 300 / this.vel); }
      });
      this.spostati.clear();
      await this.sleep(300);
    },
    /** Zoom della camera verso un punto dello schermo (con sfondo che si scurisce attorno). */
    zoom(x, y, s) {
      const st = $('#stage'), r = st.getBoundingClientRect(), cam = $('#cam');
      cam.style.transitionDuration = (0.38 / this.vel) + 's';
      cam.style.transformOrigin = '0 0';
      if (!(s > 1)) { cam.style.transform = 'translate(0px,0px) scale(1)'; return; }
      // La camera non scopre mai i bordi: la traslazione è limitata allo spazio extra generato dallo zoom.
      const W = r.width, H = r.height, ox = x - r.left, oy = y - r.top;
      const tx = clamp(ox - ox * s, W - W * s, 0), ty = clamp(oy - oy * s, H - H * s, 0);
      cam.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
    },
    /** Illumina solo i combattenti coinvolti. */
    messaAFuoco(ids) {
      $('#stage').classList.toggle('clashing', !!ids);
      Object.keys(this.els).forEach(id => this.els[id].pg.classList.toggle('in-clash', !!ids && ids.includes(id)));
    },
    /** Sequenza "cut-in" per le skill culmine: banda diagonale con il volto del personaggio. */
    async cutin(attId, skillId) {
      const u = this.V[attId], s = E.SKILL[skillId], def = u.lato === 'a' ? E.VOCI[u.def] : E.NEMICI[u.def], ac = E.AFFINITA[s.aff].colore;
      const d = 1.15 / this.vel, w = el('div', 'cutin');
      w.style.setProperty('--ac', ac); w.style.setProperty('--d', d + 's');
      w.innerHTML = '<div class="banda"><div class="strisce"></div></div>';
      const cf = el('div', 'cut-fig'); if (E.Arte) { const f = E.Arte.figura(u.def); if (u.lato === 'n') f.querySelector('.fig-in') && (f.querySelector('.fig-in').style.transform = 'scaleX(-1)'); cf.appendChild(f); E.Arte.anima(f, this.stile(attId, skillId), 0.9); } w.appendChild(cf);
      w.appendChild(el('div', 'cut-aff', E.AFFINITA[s.aff].simbolo));
      w.appendChild(el('div', 'cut-nome', s.nome));
      w.appendChild(el('div', 'cut-chi', u.breve));
      $('#app').appendChild(w); setTimeout(() => w.remove(), d * 1000 + 100);
      Fx.flash(ac, 0.3); Snd.sfx('forte');
      await this.sleep(1000);
    },

    async gestisci(e) {
      if (E.Tutorial && E.Tutorial.attivo) await E.Tutorial.evento(e);
      if (['azione', 'turno', 'dot', 'affondo', 'regola'].includes(e.t)) await this.rientraTutti();
      switch (e.t) {
        case 'turno':
          $('#turno-n').textContent = 'Turno ' + e.n + (this.B.obiettivo && this.B.obiettivo.turni ? ' / ' + this.B.obiettivo.turni : ''); this.ardoreV = e.ardore; this.mostraArdore();
          this.log('— Turno ' + e.n + ' —', 'imp'); this.banner('TURNO ' + e.n); await this.sleep(700); break;
        case 'dadi':
          this.dadi = e.dadi; Object.keys(e.dadi).forEach(id => this.renderDadi(id, true));
          Snd.sfx('moneta'); await this.sleep(600); break;
        case 'risonanza': { const A = E.AFFINITA[e.aff]; this.log(e.msg, 'imp'); Fx.flash(A.colore, 0.25); const b = el('div', 'banner risonanza', `RISONANZA ${A.simbolo}×${e.n}`); b.style.color = A.colore; $('#app').appendChild(b); setTimeout(() => b.remove(), 1700); Snd.sfx('forte'); await this.sleep(800); break; }
        case 'regola': this.log(e.msg, 'imp'); Fx.flash('#a97be0', 0.2); this.banner(e.msg.split(':')[0].slice(0, 28)); await this.sleep(700); break;
        case 'msg': this.log(e.msg); break;
        case 'azione': {
          this.log(e.msg); this.skillDi[e.att] = e.skill;
          const s = E.SKILL[e.skill];
          if (s.costo >= 5 || s.ultima) await this.cutin(e.att, e.skill);     // skill culmine: cut-in a tutto schermo
          else { this.numero(e.att, s.nome, 'testo', -34); await this.sleep(240); }
          break;
        }
        case 'affondo': {
          this.skillDi[e.att] = e.skill; this.log(e.msg, 'imp'); this.banner('AFFONDO!'); Fx.flash('#fff', 0.3); Snd.sfx('forte'); await this.sleep(700); break;
        }
        case 'schiva': {
          this.numero(e.id, 'SCHIVATA!', 'testo', -20); this.log(e.msg);
          const m = this.els[e.id].mov; m.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-34px)' }, { transform: 'translateX(0)' }], { duration: 400 / this.vel });
          await this.sleep(450); break;
        }
        case 'clash': await this.apriClash(e); break;
        case 'round': await this.roundClash(e); break;
        case 'clash_fine': await this.chiudiClash(e); break;
        case 'colpo': await this.colpo(e); break;
        case 'stato': {
          const u = this.V[e.id];
          if (e.totale) u.stati[e.stato] = e.totale; else delete u.stati[e.stato];
          this.render(e.id);
          const d = E.STATI[e.stato];
          this.numero(e.id, (e.delta > 0 ? '+' : '') + e.delta + ' ' + d.nome, 'stato', 26);
          this.els[e.id].rit.animate([{ filter: 'brightness(2)' }, { filter: 'none' }], { duration: 300 });
          this.log(`${u.breve}: ${e.delta > 0 ? '+' : ''}${e.delta} ${d.nome}`);
          Snd.sfx('stato'); await this.sleep(150); break;
        }
        case 'sanita': {
          this.V[e.id].sanita = e.valore; this.render(e.id);
          if (Math.abs(e.delta) >= 3) this.numero(e.id, (e.delta > 0 ? '+' : '') + e.delta + ' ◇', 'sanita' + (e.delta < 0 ? ' neg' : ''), 40);
          break;
        }
        case 'ardore': this.ardoreV = e.valore; this.mostraArdore(); break;
        case 'cura': {
          this.V[e.id].pv = e.pvDopo; this.render(e.id); this.numero(e.id, '+' + e.n, 'cura');
          const p = this.pos(e.id); Fx.sparks(p.x, p.y, 14, '#5ec28a', 0.6); Snd.sfx('cura'); await this.sleep(250); break;
        }
        case 'dot': {
          const u = this.V[e.id]; u.pv = e.pvDopo; this.render(e.id);
          this.numero(e.id, '-' + e.danno, e.tipo === 'bruciatura' ? 'stato' : '');
          const p = this.pos(e.id); Fx.sparks(p.x, p.y, 8, e.tipo === 'bruciatura' ? '#ff8a3d' : '#e0455a', 0.5);
          this.anima(e.id, 'hit'); Snd.sfx('colpo', 10);
          this.log(`${u.breve} subisce ${e.danno} danni (${e.tipo}).`); await this.sleep(320); break;
        }
        case 'cedimento': {
          const u = this.V[e.id]; u.ced = 2; this.render(e.id);
          this.log(e.msg, 'imp'); this.numero(e.id, 'CEDIMENTO!', 'testo', -30);
          const p = this.pos(e.id); Fx.ring(p.x, p.y, '#fff', 150); Fx.flash('#fff', 0.3); Fx.sparks(p.x, p.y, 40, '#fff', 1);
          this.shake($('#cam'), 8, 400); Snd.sfx('ced'); await this.hitStop(160); await this.sleep(500); break;
        }
        case 'ced_agg': { const u = this.V[e.id]; u.ced = e.ced; this.render(e.id); break; }
        case 'panico_fine': { this.V[e.id].panico = false; this.render(e.id); break; }
        case 'morte': {
          const u = this.V[e.id]; u.vivo = false; u.pv = 0;
          const p = this.pos(e.id); Fx.sparks(p.x, p.y, 50, u.colore, 1.2); Fx.ring(p.x, p.y, u.colore, 130);
          this.log(e.msg, 'imp'); Snd.sfx('morte');
          if (u.lato === 'n') { Fx.velocita(p.x, p.y, u.colore); Fx.flash('#fff', 0.35); await this.hitStop(220); }
          this.anima(e.id, 'morte'); setTimeout(() => Fx.dissolvi(p.x, p.y, p.w, p.h, u.colore || '#fff', u.lato === 'n'), 500 / this.vel);
          this.render(e.id); await this.sleep(700); break;
        }
        case 'panico': {
          this.V[e.id].panico = true; this.render(e.id); this.log(e.msg, 'imp'); this.numero(e.id, 'PANICO!', 'testo', -30); await this.sleep(300); break;
        }
        case 'fase': this.banner(e.testo.toUpperCase().slice(0, 24)); this.log(e.testo, 'imp'); Fx.flash('#e0b43a', 0.35); this.shake($('#cam'), 10, 500); await this.sleep(1000); break;
        case 'evoca': this.aggiungiCarta(e.unit); this.layout(); this.log(e.msg, 'imp'); Snd.sfx('forte'); await this.sleep(700); break;
        case 'fine': break;
      }
    },

    /* ----- Clash ----- */
    async apriClash(e) {
      this.skillDi[e.a.id] = e.a.skill; this.skillDi[e.b.id] = e.b.skill;
      const box = $('#clash'); box.innerHTML = '';
      const cl = this.cl = { a: null, b: null, sa: this.stile(e.a.id, e.a.skill), sb: this.stile(e.b.id, e.b.skill) };
      ['a', 'b'].forEach(k => {
        const s = e[k], u = this.V[s.id], lato = el('div', 'clash-lato');
        lato.appendChild(el('div', 'nome', `${u.breve} — ${E.SKILL[s.skill].nome}`));
        const row = el('div', 'monete'), coins = [];
        for (let i = 0; i < s.monete; i++) { const m = creaMoneta(); row.appendChild(m); coins.push(m); }
        lato.appendChild(row);
        const pot = el('div', 'pot', ''); lato.appendChild(pot);
        cl[k] = { id: s.id, lato, coins, lost: 0, pot, perse: [] };
      });
      box.appendChild(cl.a.lato); box.appendChild(el('div', 'clash-vs', 'VS')); box.appendChild(cl.b.lato);
      box.className = 'on';
      this.log(e.msg, 'imp'); Snd.sfx('clash');
      this.messaAFuoco([e.a.id, e.b.id]);
      await this.incontra(e.a.id, e.b.id);
      { const a0 = this.pos(e.a.id), b0 = this.pos(e.b.id); this.zoom((a0.x + b0.x) / 2, (a0.y + b0.y) / 2 + 10, 1.34); }
      await this.sleep(380);
      const a = this.pos(e.a.id), b = this.pos(e.b.id);
      this.linea = Fx.linea(a, b, E.AFFINITA[this.V[e.a.id].aff].colore, E.AFFINITA[this.V[e.b.id].aff].colore);
      Fx.flash('#fff', 0.18); Fx.ring((a.x + b.x) / 2, (a.y + b.y) / 2, '#fff', 120);
      await this.sleep(450);
    },
    async roundClash(e) {
      const cl = this.cl; if (!cl) return;
      ['a', 'b'].forEach(k => {
        const intatte = cl[k].coins.filter((_, i) => !cl[k].perse.includes(i));
        e[k].flips.forEach((f, i) => { if (intatte[i]) lanciaMoneta(intatte[i], f); });
        cl[k].pot.textContent = ''; cl[k].lato.classList.remove('vince', 'perde');
      });
      Snd.sfx('moneta'); await this.sleep(950);
      ['a', 'b'].forEach(k => {
        cl[k].pot.textContent = e[k].pot;
        cl[k].lato.classList.toggle('vince', e.v === k); cl[k].lato.classList.toggle('perde', !!e.v && e.v !== k);
      });
      // Entrambi i combattenti si lanciano l'uno contro l'altro; all'impatto scintille al centro
      const A = this.pos(cl.a.id), Bp = this.pos(cl.b.id), mx = (A.x + Bp.x) / 2, my = (A.y + Bp.y) / 2;
      const pa = this.anima(cl.a.id, cl.sa), pb = this.anima(cl.b.id, cl.sb);
      const imp = Math.min(E.Arte.IMPATTO[cl.sa] * E.Arte.DURATA[cl.sa], E.Arte.IMPATTO[cl.sb] * E.Arte.DURATA[cl.sb]);
      await this.sleep(imp * 1000);
      Fx.sparks(mx, my, 30, '#ffd75e', 1); Fx.ring(mx, my, '#ffd75e', 90); Fx.flare(mx, my, '#fff3c4', 110); Fx.urto(mx, Math.max(this.piedi(cl.a.id).y, this.piedi(cl.b.id).y), 110, '#ffd75e'); this.shake($('#cam'), 3, 200); Snd.sfx('clash');
      await this.hitStop(60);
      await Promise.all([pa, pb]);
      if (e.v) {
        const l = e.v === 'a' ? 'b' : 'a', L = cl[l];
        const idx = L.coins.map((_, i) => i).filter(i => !L.perse.includes(i)).pop();
        if (e.ignorata === l) {
          L.coins[idx].classList.add('ignorata'); this.log(this.V[L.id].breve + ' ignora la perdita di una moneta!');
          setTimeout(() => L.coins[idx].classList.remove('ignorata'), 700);
        } else {
          L.perse.push(idx); L.coins[idx].classList.add('persa'); Snd.sfx('rompi');
          const pc = L.coins[idx].getBoundingClientRect(); Fx.sparks(pc.left + pc.width / 2, pc.top + pc.height / 2, 18, '#ffd75e', 0.8);
        }
      } else this.log('Pareggio: si rilancia!');
      await this.sleep(450);
    },
    async chiudiClash(e) {
      const cl = this.cl; if (!cl) return;
      this.log(e.msg);
      ['a', 'b'].forEach(k => { cl[k].lato.classList.toggle('vince', cl[k].id === e.vincitore); cl[k].lato.classList.toggle('perde', cl[k].id !== e.vincitore); });
      this.anima(e.perdente, 'hit');
      await this.sleep(500);
      $('#clash').className = ''; Fx.pulisciLinee(); this.linea = null; this.cl = null;
      this.zoom(0, 0, 1); this.messaAFuoco(null);
      await this.sleep(300);
    },

    /* ----- Colpo singolo ----- */
    async colpo(e) {
      const att = this.V[e.att], bers = this.V[e.bers];
      const skillId = this.skillDi[e.att], stile = this.stile(e.att, skillId), A = E.Arte.ANIM[stile] || E.Arte.ANIM.fendente, s = E.SKILL[skillId] || {};
      if (!this.spostati.has(e.att)) await this.avanza(e.att, e.bers, A);
      await this.miniMoneta(e.att, e.testa);
      const colore = E.AFFINITA[att.aff].colore, figA = this.els[e.att].fig;
      if (s.costo >= 5 || s.ultima) figA.classList.add('ultima');
      const tImp = A.dur * A.imp, pAnim = this.anima(e.att, stile);
      const a0 = this.pos(e.att), b0 = this.pos(e.bers);
      // proiettili / lanci: partono in anticipo in modo da arrivare nel momento d'impatto
      if (A.fx && A.fx.indexOf('proiettile') === 0) {
        const n = A.n || 1, gap = A.gap || 0;
        for (let k = 0; k < n; k++) {
          const dt = Math.max(0, (tImp + k * gap - (A.fx === 'proiettile_arco' ? 0.34 : 0.12)) * 1000 / this.vel);
          setTimeout(() => {
            Fx.proiettile({ x: a0.x + a0.w * 0.5, y: a0.y }, { x: b0.x, y: b0.y }, colore, A.fx === 'proiettile_arco' ? 0.34 : 0.12, A.fx === 'proiettile_arco' ? 70 : 0, A.fx === 'proiettile_forte' ? 2 : 1);
            if (stile.indexOf('sparo') === 0) Snd.sfx('sparo');
          }, dt);
          if (k > 0) setTimeout(() => { Fx.sparks(b0.x, b0.y, 12, '#ffb04a', 0.9); Snd.sfx('colpo', 10); }, (tImp + k * gap) * 1000 / this.vel);
        }
      }
      await this.sleep(tImp * 1000);
      // ---- impatto ----
      const forte = e.danno >= 22 || e.rel === 1;
      bers.pv = e.pvDopo; this.render(e.bers);
      { const st = this.stat[e.att], sb = this.stat[e.bers]; if (st) { st.danno += e.danno; st.colpi++; st.max = Math.max(st.max, e.danno); } if (sb) sb.subito += e.danno; }
      const p = this.pos(e.bers), pa = this.pos(e.att), ang = Math.atan2(p.y - pa.y, p.x - pa.x);
      Fx.sparks(p.x, p.y, clamp(10 + Math.round(e.danno * 0.8), 10, 50), colore, 0.7 + Math.min(1, e.danno / 40));
      Fx.ring(p.x, p.y, colore, 60 + e.danno);
      const fp = this.piedi(e.bers);
      this.effettoImpatto(A.fx, p, fp, ang, colore, e.danno);
      Fx.impattoAff(s.aff || att.aff, p.x, p.y, clamp(e.danno / 18, 0.6, 2.2), ang);
      if (forte) { Fx.flash(colore, 0.2); Fx.urto(fp.x, fp.y, 70 + e.danno, colore); Fx.polvere(fp.x, fp.y, 4, 0.9); }
      if (e.danno >= 30 || (e.rel === 1 && e.danno >= 20)) Fx.velocita(p.x, p.y, '#fff');
      // contraccolpo: il bersaglio viene spinto indietro e ritorna con un rimbalzo
      { const kb = clamp(6 + e.danno * 0.6, 8, 30) * (Math.cos(ang) >= 0 ? 1 : -1);
        this.els[e.bers].fig.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${kb}px)`, offset: 0.25 }, { transform: `translateX(${-kb * 0.2}px)`, offset: 0.6 }, { transform: 'translateX(0)' }], { duration: 420 / this.vel, easing: 'ease-out' }); }
      this.numero(e.bers, e.danno, e.rel === 1 ? 'vant' : e.rel === -1 ? 'svant' : '');
      if (e.assorbito) this.numero(e.bers, 'assorbe ' + e.assorbito, 'assorbi', 24);
      this.anima(e.bers, 'hit');
      if (forte) this.shake($('#cam'), 3 + Math.min(8, e.danno / 6), 320);
      Snd.colpoAff(s.aff || att.aff, e.danno); if (forte) Snd.sfx('forte', e.danno);
      this.log(`${att.breve} → ${bers.breve}: ${e.danno} danni${e.rel === 1 ? ' (vantaggio)' : e.rel === -1 ? ' (svantaggio)' : ''}${e.testa ? '' : ' [croce]'}.`);
      await this.hitStop(clamp(40 + e.danno * 2.2, 50, 150));
      await pAnim;
      figA.classList.remove('ultima');
      await this.sleep(120);
    },
    /** Effetto grafico all'impatto, specifico di ogni tipo di attacco (vedi Arte.ANIM[x].fx). */
    effettoImpatto(fx, p, fp, ang, colore, danno) {
      const len = clamp(46 + danno * 1.5, 56, 120);
      switch (fx) {
        case 'taglio': Fx.taglio(p.x, p.y, ang + (Math.random() < 0.5 ? 0.55 : -0.55), len, colore); break;
        case 'taglio_o':                        // ampio taglio orizzontale: due archi quasi piatti
          Fx.taglio(p.x, p.y - 8, ang + Math.PI / 2 + 0.12, len * 1.5, colore); Fx.taglio(p.x, p.y + 10, ang - Math.PI / 2 - 0.12, len * 1.2, '#fff'); break;
        case 'x':                               // due tagli incrociati
          Fx.taglio(p.x, p.y, ang + 0.75, len, colore); setTimeout(() => Fx.taglio(p.x, p.y, ang - 0.75, len, '#fff'), 90 / this.vel); break;
        case 'raggi': Fx.raggi(p.x, p.y, ang + Math.PI, colore); break;
        case 'raggi_forti': Fx.raggi(p.x, p.y, ang + Math.PI, colore); Fx.raggi(p.x, p.y, ang + Math.PI, '#fff'); Fx.ring(p.x, p.y, '#fff', 90); this.shake($('#cam'), 4, 240); break;
        case 'onda':                            // schianto a terra: onda d'urto, polvere, scossa
          Fx.urto(fp.x, fp.y, 130 + danno, colore); Fx.urto(fp.x, fp.y, 80, '#fff'); Fx.polvere(fp.x, fp.y, 12, 1.6); Fx.sparks(fp.x, fp.y, 26, colore, 1.2); this.shake($('#cam'), 7, 380); break;
        case 'turbine':                         // tre tagli in rotazione
          [0, 2.09, 4.19].forEach((o, i) => setTimeout(() => Fx.taglio(p.x, p.y, ang + o, len, i % 2 ? '#fff' : colore), i * 80 / this.vel)); Fx.ring(p.x, p.y, colore, 150); break;
        case 'proiettile': Fx.sparks(p.x, p.y, 10, '#ffb04a', 0.9); Fx.raggi(p.x, p.y, ang + Math.PI, '#fff3a0'); break;
        case 'proiettile_forte': Fx.sparks(p.x, p.y, 24, '#ffb04a', 1.3); Fx.raggi(p.x, p.y, ang + Math.PI, '#fff3a0'); Fx.ring(p.x, p.y, '#ffb04a', 120); this.shake($('#cam'), 5, 280); break;
        case 'proiettile_arco': Fx.ring(p.x, p.y, '#fff', 60 + danno); Fx.sparks(p.x, p.y, 12, '#fff', 0.9); Fx.polvere(fp.x, fp.y, 6, 1); break;
        case 'luce': Fx.ring(p.x, p.y, '#ffe9a8', 110); Fx.sparks(p.x, p.y, 20, '#ffe9a8', 0.9); break;
        case 'luce_forte': Fx.pilastro(p.x, fp.y, colore); Fx.ring(p.x, p.y, '#fff', 150); Fx.sparks(p.x, p.y, 34, '#ffe9a8', 1.2); Fx.flash(colore, 0.25); break;
        default: Fx.ring(p.x, p.y, colore, 80);
      }
    },
    /** Piccola moneta 3D che gira sopra l'attaccante: mostra Testa/Croce del colpo. */
    async miniMoneta(att, testa) {
      if (this.skip) return;
      const p = this.pos(att), m = creaMoneta(true);
      const w = el('div'); w.style.cssText = `position:fixed;z-index:61;left:${p.x - 15}px;top:${p.y - p.h * 0.62}px;pointer-events:none`;
      w.appendChild(m); $('#app').appendChild(w);
      lanciaMoneta(m, testa); Snd.sfx('moneta');
      await this.sleep(520);
      w.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-14px)' }], { duration: 220 / this.velBase }).onfinish = () => w.remove();
    }
  };

  /* ----- Collegamento controlli (una sola volta) ----- */
  UI.init = function (ctx) {
    Fx.init(); UI.iniziaTip();
    $('#btn-esegui').onclick = () => Bat.conferma();
    $('#btn-menu').onclick = () => Bat.menuPausa();
    $('#btn-affondo').onclick = () => Bat.toggleAffondo();
    $$('#comandi .vel button').forEach(b => { b.onclick = () => Bat.setVel(+b.dataset.vel); });
    $('#btn-audio').onclick = () => {
      Snd.init(); Snd.on = !Snd.on; ctx.save.opzioni.audio = Snd.on; ctx.save.opzioni.musica = Snd.on; ctx.persist();
      if (E.Musica) E.Musica.attiva(Snd.on);
      $('#btn-audio').textContent = Snd.on ? '♪' : '✕';
    };
    $('#btn-log').onclick = () => { $('#log').classList.toggle('on'); };
    root.addEventListener('resize', () => { if (Bat.B) { Bat.layout(); setTimeout(() => Bat.disegnaFrecce(), 600); } });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('#scr-battaglia').classList.contains('active') && !$('#modale').classList.contains('on')) { Bat.menuPausa(); return; }
      if (!$('#scr-battaglia').classList.contains('active') || Bat.fase !== 'pianifica' || Bat.bloccato()) return;
      if (e.key >= '1' && e.key <= '3') Bat.scegliSkill(+e.key - 1);
      else if (e.key === 'Enter') Bat.conferma();
      else if (e.key === 'a' || e.key === 'A') Bat.toggleAffondo();
    });
    document.addEventListener('pointerdown', () => Snd.init(), { once: true });
  };
})(typeof window !== 'undefined' ? window : globalThis);
