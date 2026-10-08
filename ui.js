/* ============================================================================
 * ui.js — rendering e animazioni (DOM + canvas).
 *
 * Moduli:
 *   Snd    effetti sonori sintetizzati (WebAudio, nessun file)
 *   Fx     motore particellare su canvas: scintille, linee di clash, anelli, flash, hit-stop
 *   UI.ritratto()          ritratto segnaposto → in Fase 2 verrà sostituito dagli SVG
 *   UI.squadra             schermata di scelta squadra
 *   UI.battaglia           schermata di combattimento: pianificazione + riproduzione eventi
 *
 * La UI non decide MAI nulla di logico: legge gli eventi prodotti da Combat e li anima.
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

  /* ===================================================================== */
  /* Suoni sintetizzati                                                    */
  /* ===================================================================== */
  const Snd = UI.Snd = {
    ctx: null, on: true,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try { const AC = root.AudioContext || root.webkitAudioContext; if (AC) this.ctx = new AC(); } catch (e) { this.ctx = null; }
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
    sfx(nome, x) {
      switch (nome) {
        case 'moneta': this.tono(1200, 0.07, 'triangle', 0.1, 500); setTimeout(() => this.tono(1800, 0.06, 'triangle', 0.07), 120); break;
        case 'clash': this.rumore(0.18, 0.25, 2500); this.tono(220, 0.2, 'sawtooth', 0.1, -120); break;
        case 'colpo': this.rumore(0.14, 0.3, 700 + (x || 0) * 8); this.tono(140, 0.14, 'square', 0.12, -90); break;
        case 'forte': this.rumore(0.3, 0.45, 400); this.tono(90, 0.3, 'sawtooth', 0.2, -50); break;
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
    cv: null, ctx: null, W: 0, H: 0, dpr: 1, parts: [], lines: [], rings: [], flashes: [], frozen: 0, last: 0,
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
    ring(x, y, colore, r) { this.rings.push({ x, y, c: colore, t: 0, max: 0.45, r: r || 90 }); },
    flash(colore, alpha) { this.flashes.push({ c: colore, a: alpha || 0.35, t: 0, max: 0.35 }); },
    /** Linea "elettrica" persistente tra due punti: restituisce l'oggetto (poi .fine = true per toglierla). */
    linea(a, b, c1, c2) {
      const l = { a, b, c1, c2, pts: [], t: 0, ag: 0 }; this.lines.push(l); return l;
    },
    pulisciLinee() { this.lines.forEach(l => { l.fine = true; }); },
    congela(ms) { this.frozen = performance.now() + ms; },
    loop(t) {
      let dt = Math.min(0.05, (t - this.last) / 1000 || 0.016); this.last = t;
      if (t < this.frozen) dt = 0;
      const g = this.ctx; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, this.W, this.H);
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      // flash
      this.flashes = this.flashes.filter(f => { f.t += dt; return f.t < f.max; });
      this.flashes.forEach(f => { g.globalAlpha = f.a * (1 - f.t / f.max); g.fillStyle = f.c; g.fillRect(0, 0, this.W, this.H); });
      // anelli
      this.rings = this.rings.filter(r => { r.t += dt; return r.t < r.max; });
      this.rings.forEach(r => { const k = r.t / r.max; g.globalAlpha = 1 - k; g.strokeStyle = r.c; g.lineWidth = 6 * (1 - k) + 1; g.beginPath(); g.arc(r.x, r.y, 8 + r.r * k, 0, 7); g.stroke(); });
      // particelle
      this.parts = this.parts.filter(p => (p.life += dt) < p.max);
      this.parts.forEach(p => {
        p.vy += 900 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = 1 - p.life / p.max; g.strokeStyle = p.c; g.lineWidth = p.w;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
      });
      // linee di clash
      this.lines = this.lines.filter(l => !l.fine || (l.fade = (l.fade || 0) + dt) < 0.25);
      this.lines.forEach(l => {
        l.t += dt; l.ag -= dt;
        if (l.ag <= 0) {            // rigenera la forma ogni ~50ms (crepitio)
          l.ag = 0.05; l.pts = [];
          const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, N = 12;
          for (let i = 0; i <= N; i++) {
            const k = i / N, j = (i === 0 || i === N) ? 0 : rnd(-1, 1) * 22 * Math.sin(k * Math.PI);
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
  /** Ritratto segnaposto. FASE 2: sostituire il corpo con il rendering SVG/sprite di `def.svg`. */
  UI.ritratto = function (def, cls) {
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
  UI.opzioni = function (save, persist, onVel) {
    const d = el('div'); d.innerHTML = '<h3>Opzioni</h3>';
    const r1 = el('div', 'opz-riga', '<span>Velocità animazioni</span>'); const g = el('span');
    [1, 2, 4].forEach(v => { const b = el('button', 'btn piccolo' + (save.opzioni.vel === v ? ' attivo' : ''), '×' + v); b.style.marginLeft = '4px'; b.onclick = () => { save.opzioni.vel = v; persist(); onVel(v); $$('button', g).forEach(x => x.classList.toggle('attivo', x === b)); }; g.appendChild(b); });
    r1.appendChild(g); d.appendChild(r1);
    const r2 = el('div', 'opz-riga', '<span>Suono</span>'); const b2 = el('button', 'btn piccolo', save.opzioni.audio ? 'Sì' : 'No');
    b2.onclick = () => { save.opzioni.audio = !save.opzioni.audio; Snd.on = save.opzioni.audio; b2.textContent = save.opzioni.audio ? 'Sì' : 'No'; persist(); };
    r2.appendChild(b2); d.appendChild(r2);
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
    sel: [], ctx: null,
    init(ctx) {
      this.ctx = ctx; const save = ctx.save;
      this.sel = (save.squadra || []).filter(id => E.VOCI[id]).slice(0, C.SQUADRA_MAX);
      const g = $('#sq-griglia'); g.innerHTML = '';
      Object.values(E.VOCI).sort((a, b) => a.epoca - b.epoca).forEach(v => {
        const c = el('div', 'sq-card'); c.dataset.id = v.id;
        c.appendChild(UI.ritratto(v));
        c.appendChild(el('div', 'n', v.breve));
        c.appendChild(el('div', 'm', `<span style="color:${E.AFFINITA[v.aff].colore}">${E.AFFINITA[v.aff].simbolo} ${E.AFFINITA[v.aff].nome}</span> · Cap. ${E.CAPITOLI[v.epoca - 1].num}`));
        c.appendChild(el('div', 'stelle', '★'.repeat(v.rarita)));
        c.onclick = () => { Snd.sfx('ui'); this.toggle(v.id); };
        g.appendChild(c);
      });
      const s = $('#sq-incontro'); s.innerHTML = '';
      Object.values(E.INCONTRI).forEach(i => { const o = el('option', '', i.nome); o.value = i.id; s.appendChild(o); });
      s.value = save.incontro && E.INCONTRI[save.incontro] ? save.incontro : 'pattuglia';
      $('#sq-via').onclick = () => ctx.onAvvia(this.sel.slice(), s.value);
      $('#sq-affinita').onclick = () => UI.tabellaAffinita();
      this.aggiorna(); this.dettaglio(this.sel[0] || Object.keys(E.VOCI)[0]);
    },
    toggle(id) {
      const i = this.sel.indexOf(id);
      if (i >= 0) this.sel.splice(i, 1);
      else if (this.sel.length < C.SQUADRA_MAX) this.sel.push(id);
      this.dettaglio(id); this.aggiorna();
      this.ctx.save.squadra = this.sel.slice(); this.ctx.persist();
    },
    aggiorna() {
      $$('.sq-card').forEach(c => c.classList.toggle('sel', this.sel.includes(c.dataset.id)));
      $('#sq-conta').textContent = this.sel.length + '/' + C.SQUADRA_MAX;
      $('#sq-via').disabled = this.sel.length !== C.SQUADRA_MAX;
    },
    dettaglio(id) {
      const v = E.VOCI[id], d = $('#sq-dettaglio'); d.innerHTML = '';
      const a = E.AFFINITA[v.aff];
      d.appendChild(el('h3', '', v.nome));
      d.appendChild(el('small', '', `${E.CAPITOLI[v.epoca - 1].epoca} · ${v.ruolo} · <span style="color:${a.colore}">${a.simbolo} ${a.nome}</span> · ${'★'.repeat(v.rarita)}`));
      d.appendChild(el('p', '', `PV <b>${v.pv}</b> · Velocità <b>${v.vel[0]}–${v.vel[1]}</b>`));
      d.appendChild(el('div', 'skill-box', `<b>Passiva — ${v.passiva.nome}</b><small>${v.passiva.desc}</small>`));
      v.skills.forEach(sid => {
        const s = E.SKILL[sid];
        d.appendChild(el('div', 'skill-box', `<b>${s.nome}</b> <span style="color:var(--oro)">◆${s.costo}</span>
          <small>${s.monete} monete · PB ${s.pb} · PM +${s.pm} · ${E.AFFINITA[s.aff].nome}</small>
          <small>${E.descrizioneSkill(s).join('<br>') || '—'}</small>`));
      });
      d.appendChild(el('small', 'vuoto', 'Voce romanzata: carattere e abilità sono inventati; nomi e fatti storici no.'));
    }
  };

  /* ===================================================================== */
  /* Battaglia                                                             */
  /* ===================================================================== */
  const Bat = UI.battaglia = {
    B: null, V: {}, els: {}, dadi: {}, sel: null, fase: 'idle', velBase: 1, skip: false, ctx: null, cl: null, linea: null, ardoreV: 0,

    avvia(B, ctx) {
      this.B = B; this.ctx = ctx; this.fase = 'riproduzione'; this.skip = false;
      this.V = {}; this.els = {}; this.dadi = {}; this.sel = null; this.cl = null;
      this.velBase = ctx.save.opzioni.vel || 1;
      Snd.on = ctx.save.opzioni.audio !== false;
      $('#col-alleati').innerHTML = ''; $('#col-nemici').innerHTML = ''; $('#log').innerHTML = ''; $('#risultato').classList.remove('on');
      $('#clash').className = ''; $('#clash').innerHTML = '';
      Combat().snapshot(B).forEach(u => this.aggiungiCarta(u));
      this.ardoreV = B.ardore; this.mostraArdore();
      this.aggiornaVel(); $('#btn-audio').textContent = 'Suono: ' + (Snd.on ? 'sì' : 'no');
      UI.mostra('battaglia');
      this.log('Il Custode entra nell\'Eco…', 'imp');
      this.cicloTurno(B.eventiIniziali);
    },

    /* ----- costruzione carte ----- */
    aggiungiCarta(u) {
      this.V[u.id] = u;
      const def = u.lato === 'a' ? E.VOCI[u.def] : E.NEMICI[u.def];
      const c = el('div', 'unit ' + (u.lato === 'a' ? 'alleato' : 'nemico')); c.dataset.id = u.id;
      const rit = UI.ritratto(def);
      const a = E.AFFINITA[u.aff];
      const info = el('div', 'info');
      info.innerHTML = `<div class="nome"><span class="aff" style="color:${a.colore}">${a.simbolo}</span>${u.breve}</div>
        <div class="barra-pv"><div class="ritardo"></div><div class="pieno"></div><div class="num"></div></div>
        <div class="barra-sanita"><div class="riempi"></div><div class="num"></div></div>
        <div class="chips"></div><div class="intenzioni"></div>`;
      c.append(rit, info);
      const dadi = el('div', 'dadi'); c.appendChild(dadi);
      c.onclick = () => this.clickCarta(u.id);
      $(u.lato === 'a' ? '#col-alleati' : '#col-nemici').appendChild(c);
      this.els[u.id] = { card: c, rit, ritardo: $('.ritardo', c), pieno: $('.pieno', c), num: $('.barra-pv .num', c), san: $('.barra-sanita .riempi', c),
        sanNum: $('.barra-sanita .num', c), chips: $('.chips', c), intent: $('.intenzioni', c), dadi, tag: null };
      this.render(u.id);
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
      e.chips.innerHTML = Object.keys(u.stati).map(s => { const d = E.STATI[s]; return `<span class="chip" style="color:${d.colore}" title="${d.nome}: ${d.desc}">${d.icona}${u.stati[s]}</span>`; }).join('');
      e.card.classList.toggle('morto', !u.vivo);
      e.card.classList.toggle('ced', u.ced > 0 && u.vivo);
      let tag = u.ced > 0 && u.vivo ? ['CEDIMENTO', ''] : u.panico && u.vivo ? ['PANICO', 'panico'] : null;
      if (e.tag) { e.tag.remove(); e.tag = null; }
      if (tag) { e.tag = el('div', 'tag ' + tag[1], tag[0]); e.card.appendChild(e.tag); }
    },
    renderDadi(id, anima) {
      const e = this.els[id]; e.dadi.innerHTML = '';
      (this.dadi[id] || []).forEach(d => { const x = el('div', 'dado' + (anima ? ' rolla' : ''), d); e.dadi.appendChild(x); });
    },
    mostraArdore() {
      const B = this.B; let t = 'Ardore ' + this.ardoreV + '/' + C.ARDORE_MAX;
      if (this.fase === 'pianifica') { const c = Combat().costoPiano(B); if (c) t += ' (−' + c + ')'; }
      $('#ardore').textContent = t;
    },
    log(msg, cls) {
      const l = $('#log'); const d = el('div', cls || '', msg); l.appendChild(d);
      while (l.children.length > 80) l.removeChild(l.firstChild);
      l.scrollTop = l.scrollHeight;
    },

    /* ----- ciclo di turno ----- */
    async cicloTurno(evIniziali) {
      const B = this.B;
      try {
        if (evIniziali && evIniziali.length) await this.riproduci(evIniziali);
        while (!B.esito) {
          Combat().iniziaTurno(B);
          await this.riproduci(B.eventi);
          if (B.esito) break;
          await this.pianifica();
          const evs = Combat().esegui(B);
          await this.riproduci(evs);
        }
        await this.finale();
      } catch (err) { console.error('Errore nel ciclo di battaglia', err); this.log('Errore interno: ' + err.message, 'imp'); }
    },
    /** Attende che il giocatore prema "Esegui turno". */
    pianifica() {
      const B = this.B;
      this.fase = 'pianifica'; this.skip = false;
      $('#btn-esegui').disabled = false;
      const prima = Object.keys(this.V).filter(id => this.V[id].lato === 'a' && this.V[id].vivo && B.azioni.some(a => a.u === id))[0];
      this.sel = this.sel && B.azioni.some(a => a.u === this.sel) && this.V[this.sel].vivo ? this.sel : prima;
      this.aggiornaPiano();
      this.log('— Pianifica: scegli skill e bersagli, poi Esegui turno —');
      return new Promise(res => { this._pronto = res; });
    },
    conferma() {
      if (this.fase !== 'pianifica') return;
      if (!Combat().pianoValido(this.B)) { this.log('Ardore insufficiente per il piano scelto.', 'imp'); return; }
      Snd.init(); Snd.sfx('ui');
      this.fase = 'riproduzione'; $('#btn-esegui').disabled = true;
      $$('.unit').forEach(c => c.classList.remove('sel', 'bersaglio-di-sel', 'bersagliabile'));
      Object.keys(this.els).forEach(id => { this.els[id].intent.innerHTML = ''; });
      this.disegnaSkills();
      const r = this._pronto; this._pronto = null; r && r();
    },
    clickCarta(id) {
      if (this.fase !== 'pianifica') return;
      Snd.init();
      const u = this.V[id];
      if (u.lato === 'a') { if (u.vivo) { this.sel = id; Snd.sfx('ui'); this.aggiornaPiano(); } return; }
      if (!u.vivo || !this.sel) return;
      const a = this.B.azioni.find(x => x.u === this.sel);
      if (!a) return;
      const idx = this.B.byId[this.sel].skills.indexOf(a.skill);
      Combat().pianifica(this.B, this.sel, idx, id); Snd.sfx('ui');
      this.aggiornaPiano();
    },
    scegliSkill(idx) {
      if (this.fase !== 'pianifica' || !this.sel) return;
      const a = this.B.azioni.find(x => x.u === this.sel); if (!a) return;
      const dis = this.disponibile(a);
      if (E.SKILL[this.B.byId[this.sel].skills[idx]].costo > dis) return;
      Combat().pianifica(this.B, this.sel, idx, a.bers); Snd.sfx('ui');
      this.aggiornaPiano();
    },
    disponibile(a) { return this.B.ardore - (Combat().costoPiano(this.B) - E.SKILL[a.skill].costo); },
    aggiornaPiano() {
      const B = this.B;
      Object.keys(this.els).forEach(id => {
        const e = this.els[id], u = this.V[id];
        e.card.classList.toggle('sel', id === this.sel);
        e.card.classList.remove('bersaglio-di-sel');
        e.card.classList.toggle('bersagliabile', u.lato === 'n' && u.vivo && !!this.sel);
        // Intenzioni
        e.intent.innerHTML = '';
        B.azioni.filter(a => a.u === id && !a.annullata && a.skill).forEach(a => {
          const s = E.SKILL[a.skill], t = this.V[a.bers];
          e.intent.appendChild(el('div', 'intenzione ' + (u.lato === 'a' ? 'alleata' : ''), `${s.nome} → ${t ? t.breve : '?'}`));
        });
      });
      const act = B.azioni.find(a => a.u === this.sel);
      if (act) { const t = this.els[act.bers]; if (t) t.card.classList.add('bersaglio-di-sel'); }
      this.disegnaSkills(); this.mostraArdore();
      $('#btn-esegui').disabled = this.fase !== 'pianifica' || !Combat().pianoValido(B);
    },
    disegnaSkills() {
      const box = $('#skills'); box.innerHTML = '';
      if (this.fase !== 'pianifica' || !this.sel) { box.appendChild(el('div', 'vuoto', this.fase === 'pianifica' ? 'Nessuna Voce può agire.' : 'Gli Echi si scontrano…')); return; }
      const B = this.B, u = B.byId[this.sel], a = B.azioni.find(x => x.u === this.sel);
      if (!a) { box.appendChild(el('div', 'vuoto', u.breve + ' non può agire in questo turno.')); return; }
      const bers = B.byId[a.bers];
      u.skills.forEach((sid, idx) => {
        const s = E.SKILL[sid], rel = bers ? E.rel(s.aff, bers.aff) : 0;
        const b = el('button', 'skill-btn' + (a.skill === sid ? ' sel' : ''));
        b.disabled = u.panico || s.costo > this.disponibile(a) && a.skill !== sid;
        const af = E.AFFINITA[s.aff];
        b.innerHTML = `<div class="t"><span>${idx + 1}. ${s.nome}</span><span class="costo">◆${s.costo}</span></div>
          <div class="num"><span style="color:${af.colore}">${af.simbolo}</span> ${s.monete}● · PB ${s.pb} · PM +${s.pm}
          ${rel > 0 ? '<span class="rel vant">▲ vantaggio</span>' : rel < 0 ? '<span class="rel svant">▼ svantaggio</span>' : ''}</div>
          <div class="d">${E.descrizioneSkill(s).join(' · ')}</div>`;
        b.onclick = () => this.scegliSkill(idx);
        box.appendChild(b);
      });
      if (u.panico) box.appendChild(el('div', 'vuoto', 'In Panico: agisce senza controllo.'));
    },
    async finale() {
      const B = this.B; this.fase = 'fine';
      await this.sleep(500);
      const r = $('#risultato'); r.className = 'overlay on ' + B.esito;
      Snd.sfx(B.esito);
      r.innerHTML = `<h2>${B.esito === 'vittoria' ? 'VITTORIA' : 'SCONFITTA'}</h2><p>${B.esito === 'vittoria' ? 'L\'Eco si placa.' : 'L\'Eco vi inghiotte… per ora.'} Turni: ${B.turno}</p>`;
      const b1 = el('button', 'btn grande', 'Riprova'), b2 = el('button', 'btn', 'Menu');
      b1.onclick = () => this.ctx.onRiprova(); b2.onclick = () => this.ctx.onMenu();
      r.append(b1, b2);
      this.ctx.onFine(B.esito, B);
    },

    /* ----- controlli velocità ----- */
    aggiornaVel() { $$('#comandi .vel button').forEach(b => { b.classList.toggle('attivo', +b.dataset.vel === this.velBase); }); },
    setVel(v) {
      if (v === 0) { this.skip = true; return; }
      this.velBase = v; this.ctx.save.opzioni.vel = v; this.ctx.persist(); this.aggiornaVel();
    },
    sleep(ms) {
      if (this.skip) return Promise.resolve();
      return new Promise(r => setTimeout(r, ms / this.velBase));
    },

    /* ===================================================================== */
    /* Riproduzione degli eventi                                             */
    /* ===================================================================== */
    pos(id) {
      const r = this.els[id].rit.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    async riproduci(evs) {
      const prev = this.fase;
      if (prev !== 'pianifica') this.fase = 'riproduzione';
      for (const e of evs) {
        try { await this.gestisci(e); } catch (err) { console.error('Errore evento', e, err); }
      }
      this.skip = false;
    },
    numero(id, testo, cls, dy) {
      if (!this.els[id]) return;
      const p = this.pos(id), n = el('div', 'num-fly ' + (cls || ''), testo);
      n.style.left = (p.x + rnd(-22, 22)) + 'px'; n.style.top = (p.y - 20 + (dy || 0) + rnd(-8, 8)) + 'px';
      $('#app').appendChild(n); setTimeout(() => n.remove(), 1200);
    },
    shake(elem, amp, dur) {
      const k = []; for (let i = 0; i < 8; i++) k.push({ transform: `translate(${rnd(-amp, amp)}px,${rnd(-amp, amp)}px)` }); k.push({ transform: 'translate(0,0)' });
      elem.animate(k, { duration: (dur || 300) / (this.skip ? 4 : this.velBase) });
    },
    /** Hit-stop: congela animazioni DOM e canvas per pochi millisecondi. */
    async hitStop(ms) {
      if (this.skip) return;
      ms = ms / this.velBase;
      const run = document.getAnimations().filter(a => a.playState === 'running');
      run.forEach(a => a.pause()); Fx.congela(ms);
      await new Promise(r => setTimeout(r, ms));
      run.forEach(a => { try { a.play(); } catch (x) { /* animazione già conclusa */ } });
    },
    banner(testo) {
      const b = el('div', 'banner', testo); $('#app').appendChild(b); setTimeout(() => b.remove(), 1700);
    },
    async lunge(att, bers, tImpatto) {
      const a = this.els[att].card, pa = this.pos(att), pb = this.pos(bers);
      const dx = (pb.x - pa.x) * 0.45, dy = (pb.y - pa.y) * 0.45;
      a.style.zIndex = 20;
      const dur = 380 / (this.skip ? 8 : this.velBase);
      const an = a.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px,${dy}px) scale(1.12)`, offset: 0.4 }, { transform: 'translate(0,0) scale(1)' }], { duration: dur, easing: 'ease-out' });
      an.onfinish = () => { a.style.zIndex = ''; };
      await this.sleep(380 * 0.4);
    },
    async miniMoneta(att, testa) {
      if (this.skip) return;
      const p = this.pos(att), m = creaMoneta(true);
      const w = el('div'); w.style.cssText = `position:fixed;z-index:61;left:${p.x - 15}px;top:${p.y - 62}px;pointer-events:none`;
      w.appendChild(m); $('#app').appendChild(w);
      lanciaMoneta(m, testa); Snd.sfx('moneta');
      await this.sleep(560);
      w.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-14px)' }], { duration: 250 / this.velBase }).onfinish = () => w.remove();
    },

    async gestisci(e) {
      const B = this.B;
      switch (e.t) {
        case 'turno':
          $('#turno-n').textContent = 'Turno ' + e.n; this.ardoreV = e.ardore; this.mostraArdore();
          this.log('— Turno ' + e.n + ' —', 'imp'); this.banner('TURNO ' + e.n); await this.sleep(700); break;
        case 'dadi':
          this.dadi = e.dadi; Object.keys(e.dadi).forEach(id => this.renderDadi(id, true));
          Snd.sfx('moneta'); await this.sleep(600); break;
        case 'regola': this.log(e.msg, 'imp'); Fx.flash('#a97be0', 0.2); await this.sleep(500); break;
        case 'msg': this.log(e.msg); break;
        case 'azione': {
          this.log(e.msg);
          const s = E.SKILL[e.skill]; this.numero(e.att, s.nome, 'testo', -34);
          await this.sleep(260); break;
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
          this.shake(this.els[e.id].card, 4, 200); Snd.sfx('colpo', 10);
          this.log(`${u.breve} subisce ${e.danno} danni (${e.tipo}).`); await this.sleep(300); break;
        }
        case 'cedimento': {
          const u = this.V[e.id]; u.ced = 2; this.render(e.id);
          this.log(e.msg, 'imp'); this.numero(e.id, 'CEDIMENTO!', 'testo', -30);
          const p = this.pos(e.id); Fx.ring(p.x, p.y, '#fff', 150); Fx.flash('#fff', 0.3); Fx.sparks(p.x, p.y, 40, '#fff', 1);
          this.shake($('#campo'), 8, 400); Snd.sfx('ced'); await this.hitStop(160); await this.sleep(500); break;
        }
        case 'morte': {
          const u = this.V[e.id]; u.vivo = false; u.pv = 0; this.render(e.id);
          const p = this.pos(e.id); Fx.sparks(p.x, p.y, 50, this.els[e.id] ? u.colore : '#fff', 1.2); Fx.ring(p.x, p.y, u.colore, 130);
          this.log(e.msg, 'imp'); Snd.sfx('morte'); await this.sleep(500); break;
        }
        case 'panico': {
          this.V[e.id].panico = true; this.render(e.id); this.log(e.msg, 'imp'); this.numero(e.id, 'PANICO!', 'testo', -30); await this.sleep(300); break;
        }
        case 'fase': this.banner(e.testo.toUpperCase().slice(0, 24)); this.log(e.testo, 'imp'); Fx.flash('#e0b43a', 0.35); this.shake($('#campo'), 10, 500); await this.sleep(1000); break;
        case 'evoca': this.aggiungiCarta(e.unit); this.log(e.msg, 'imp'); Snd.sfx('forte'); await this.sleep(500); break;
        case 'fine': break;
      }
    },

    /* ----- Clash ----- */
    async apriClash(e) {
      const box = $('#clash'); box.innerHTML = '';
      const cl = this.cl = { a: null, b: null };
      ['a', 'b'].forEach(k => {
        const s = e[k], u = this.V[s.id], lato = el('div', 'clash-lato');
        lato.appendChild(el('div', 'nome', `${u.breve} — ${E.SKILL[s.skill].nome}`));
        const row = el('div', 'monete'), coins = [];
        for (let i = 0; i < s.monete; i++) { const m = creaMoneta(); row.appendChild(m); coins.push(m); }
        lato.appendChild(row);
        const pot = el('div', 'pot', ''); lato.appendChild(pot);
        cl[k] = { id: s.id, lato, coins, lost: 0, pot, perse: [] };
        if (k === 'a') box.appendChild(lato);
      });
      box.appendChild(el('div', 'clash-vs', 'SCONTRO'));
      box.appendChild(cl.b.lato);
      box.className = 'on';
      const a = this.pos(e.a.id), b = this.pos(e.b.id);
      this.linea = Fx.linea(a, b, E.AFFINITA[this.V[e.a.id].aff].colore, E.AFFINITA[this.V[e.b.id].aff].colore);
      this.log(e.msg, 'imp'); Snd.sfx('clash');
      Fx.flash('#fff', 0.18); Fx.ring((a.x + b.x) / 2, (a.y + b.y) / 2, '#fff', 120);
      await this.sleep(650);
    },
    async roundClash(e) {
      const cl = this.cl; if (!cl) return;
      ['a', 'b'].forEach(k => {
        const intatte = cl[k].coins.filter((_, i) => !cl[k].perse.includes(i));
        e[k].flips.forEach((f, i) => { if (intatte[i]) lanciaMoneta(intatte[i], f); });
        cl[k].pot.textContent = ''; cl[k].lato.classList.remove('vince', 'perde');
      });
      Snd.sfx('moneta'); await this.sleep(980);
      ['a', 'b'].forEach(k => {
        cl[k].pot.textContent = e[k].pot;
        cl[k].lato.classList.toggle('vince', e.v === k); cl[k].lato.classList.toggle('perde', !!e.v && e.v !== k);
      });
      const A = this.pos(cl.a.id), Bp = this.pos(cl.b.id), mx = (A.x + Bp.x) / 2, my = (A.y + Bp.y) / 2;
      Fx.sparks(mx, my, 26, '#ffd75e', 1); Fx.ring(mx, my, '#ffd75e', 90); this.shake($('#campo'), 3, 200); Snd.sfx('clash');
      await this.hitStop(60); await this.sleep(450);
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
      await this.sleep(550);
    },
    async chiudiClash(e) {
      const cl = this.cl; if (!cl) return;
      this.log(e.msg);
      ['a', 'b'].forEach(k => { cl[k].lato.classList.toggle('vince', cl[k].id === e.vincitore); cl[k].lato.classList.toggle('perde', cl[k].id !== e.vincitore); });
      await this.sleep(500);
      $('#clash').className = ''; Fx.pulisciLinee(); this.linea = null; this.cl = null;
    },

    /* ----- Colpo singolo ----- */
    async colpo(e) {
      const att = this.V[e.att], bers = this.V[e.bers];
      await this.miniMoneta(e.att, e.testa);
      const colore = E.AFFINITA[att.aff].colore;
      // Avvicinamento; l'impatto avviene al 40% dell'animazione
      await this.lunge(e.att, e.bers);
      const forte = e.danno >= 22 || e.rel === 1;
      bers.pv = e.pvDopo; this.render(e.bers);
      const p = this.pos(e.bers);
      Fx.sparks(p.x, p.y, clamp(10 + Math.round(e.danno * 0.8), 10, 50), colore, 0.7 + Math.min(1, e.danno / 40));
      Fx.ring(p.x, p.y, colore, 60 + e.danno);
      if (forte) Fx.flash(colore, 0.2);
      this.numero(e.bers, e.danno, e.rel === 1 ? 'vant' : e.rel === -1 ? 'svant' : '');
      if (e.assorbito) this.numero(e.bers, 'assorbe ' + e.assorbito, 'assorbi', 24);
      this.shake(this.els[e.bers].card, 5 + Math.min(12, e.danno / 4), 320);
      if (forte) this.shake($('#campo'), 3 + Math.min(8, e.danno / 6), 320);
      this.els[e.bers].rit.animate([{ filter: 'brightness(3)' }, { filter: 'none' }], { duration: 250 });
      Snd.sfx(forte ? 'forte' : 'colpo', e.danno);
      this.log(`${att.breve} → ${bers.breve}: ${e.danno} danni${e.rel === 1 ? ' (vantaggio)' : e.rel === -1 ? ' (svantaggio)' : ''}${e.testa ? '' : ' [croce]'}.`);
      await this.hitStop(clamp(40 + e.danno * 2.2, 50, 150));
      await this.sleep(230);
    }
  };
  function Combat() { return E.Combat; }

  /* ----- Collegamento controlli (una sola volta) ----- */
  UI.init = function (ctx) {
    Fx.init();
    $('#btn-esegui').onclick = () => Bat.conferma();
    $$('#comandi .vel button').forEach(b => { b.onclick = () => Bat.setVel(+b.dataset.vel); });
    $('#btn-audio').onclick = () => {
      Snd.init(); Snd.on = !Snd.on; ctx.save.opzioni.audio = Snd.on; ctx.persist();
      $('#btn-audio').textContent = 'Suono: ' + (Snd.on ? 'sì' : 'no');
    };
    document.addEventListener('keydown', e => {
      if (!$('#scr-battaglia').classList.contains('active') || Bat.fase !== 'pianifica') return;
      if (e.key >= '1' && e.key <= '3') Bat.scegliSkill(+e.key - 1);
      else if (e.key === 'Enter') Bat.conferma();
    });
    document.addEventListener('pointerdown', () => Snd.init(), { once: true });
  };
})(typeof window !== 'undefined' ? window : globalThis);
