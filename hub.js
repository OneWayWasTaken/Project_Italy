/* ============================================================================
 * hub.js — schermate di gestione con il tema «Macchina dell'Archivio»:
 *   HUD fisso in basso (Custode, risorse, navigazione) · bacheca di sfondo · Atrio (schermata iniziale)
 *   Voci (composizione della squadra con preset) · Viaggio (scelta del capitolo sulla mappa d'Italia)
 *
 * Usa le stesse API del resto del gioco: E.UI.squadra.init(ctx, opts) resta compatibile con la campagna
 * (pool, titolo, testoVia, nascondiIncontro, onVia).
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi, C = E.CONFIG;
  const H = E.Hub = {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const S = () => E.Save;

  /* ===================================================================== */
  /* Livello del Custode (esperienza)                                      */
  /* ===================================================================== */
  const XP_LIVELLO = lv => 80 + lv * 20;
  /** {lv, xp nel livello, necessaria} dall'esperienza totale. */
  H.livello = function () {
    let xp = S().data.xp || 0, lv = 1;
    while (xp >= XP_LIVELLO(lv)) { xp -= XP_LIVELLO(lv); lv++; }
    return { lv, xp, max: XP_LIVELLO(lv) };
  };
  H.esperienza = function (n) { const d = S().data, prima = H.livello().lv; d.xp = (d.xp || 0) + n; S().save(); return H.livello().lv > prima; };
  H.numero = function () { const d = S().data; if (!d.numero) { d.numero = String(100000 + Math.floor(Math.random() * 900000)); S().save(); } return d.numero; };

  /* ===================================================================== */
  /* HUD e navigazione                                                     */
  /* ===================================================================== */
  const ICONE = {
    atrio: '<path d="M4 26V13a12 10 0 0 1 24 0v13M10 26V15a6 5 0 0 1 12 0v11M2 26h28"/>',
    voci: '<circle cx="11" cy="10" r="4.2"/><path d="M3 26c0-5 3.6-8 8-8s8 3 8 8"/><circle cx="22.5" cy="9" r="3.5"/><path d="M19 17.6c1.1-.7 2.3-1 3.5-1 3.8 0 6.5 2.6 6.5 7.4"/>',
    viaggio: '<circle cx="16" cy="14" r="11"/><circle cx="16" cy="14" r="3"/><path d="M16 3v4M16 21v4M5 14h4M23 14h4M8.2 6.2l2.8 2.8M21 19l2.8 2.8M23.8 6.2 21 9M11 19l-2.8 2.8"/>',
    archivio: '<path d="M4 5h9a3 3 0 0 1 3 3v17a3 3 0 0 0-3-3H4zM28 5h-9a3 3 0 0 0-3 3v17a3 3 0 0 1 3-3h9z"/>',
    evoca: '<path d="M16 2.5l3.2 7.8 8.3.6-6.4 5.4 2 8.2-7.1-4.4-7.1 4.4 2-8.2-6.4-5.4 8.3-.6z"/>'
  };
  const NAV = [['atrio', 'Atrio', 'menu'], ['voci', 'Voci', 'squadra'], ['viaggio', 'Viaggio', 'campagna'], ['archivio', 'Archivio', 'archivio'], ['evoca', 'Evoca', 'gacha']];
  const SCHERMO_NAV = { menu: 'atrio', squadra: 'voci', campagna: 'viaggio', mappa: 'viaggio', archivio: 'archivio', gacha: 'evoca' };
  H.CON_HUD = ['menu', 'squadra', 'campagna', 'archivio', 'gacha'];
  H.CON_BACHECA = ['menu', 'squadra', 'campagna', 'archivio'];

  H.init = function (ctx) {
    H.ctx = ctx;
    const nav = $('#hud-nav'); nav.innerHTML = '';
    NAV.forEach(([k, nome]) => {
      const b = el('button', 'tasto', `<svg viewBox="0 0 32 28">${ICONE[k]}</svg><b>${nome}</b>`); b.dataset.nav = k;
      b.onclick = () => { E.UI.Snd.init(); E.UI.Snd.sfx('ui'); H.vai(k); };
      nav.appendChild(b);
    });
    H.bacheca();
  };
  H.vai = function (k) {
    const ctx = H.ctx;
    switch (k) {
      case 'atrio': ctx.onMenu(); break;
      case 'voci': E.UI.squadra.init(ctx); E.UI.mostra('squadra'); break;
      case 'viaggio': E.Campagna.hub(); break;
      case 'archivio': E.Archivio.apri(); break;
      case 'evoca': E.Gacha.ui.apri(ctx); break;
    }
  };
  /** Chiamata da UI.mostra: classi del corpo, voce attiva della barra, numeri aggiornati. */
  H.mostra = function (nome) {
    document.body.classList.toggle('con-hud', H.CON_HUD.includes(nome));
    document.body.classList.toggle('hub', H.CON_BACHECA.includes(nome));
    $$('#hud-nav .tasto').forEach(t => t.classList.toggle('on', t.dataset.nav === SCHERMO_NAV[nome]));
    if (H.CON_HUD.includes(nome)) H.aggiornaHud();
  };
  H.aggiornaHud = function () {
    const d = S().data; if (!d) return;
    const L = H.livello();
    $('#hud-lv').textContent = String(L.lv).padStart(2, '0');
    $('#hud-num').textContent = 'N° ' + H.numero();
    $('#hud-sig').textContent = d.valute.sigilli; $('#hud-den').textContent = d.valute.denari;
    $('#hud-xpb').style.width = (L.xp / L.max * 100) + '%'; $('#hud-xp').textContent = L.xp + ' / ' + L.max;
    const cap = Math.max(0, Math.min(6, (d.run ? d.run.cap : d.progresso.sbloccato || 1) - 1));
    const hc = $('#hud-cap'); if (hc.dataset.cap !== String(cap)) { hc.dataset.cap = cap; hc.innerHTML = E.Arte.sfondo(cap) + `<span>Cap. ${E.CAPITOLI[cap].num}</span>`; }
  };

  /** Bacheca: fogli d'archivio, foto, puntine e fili rossi (generata una volta, a bassa opacità). */
  H.bacheca = function () {
    const b = $('#bacheca'); if (!b || b.firstChild) return;
    let seme = 7; const r = () => { seme = (seme * 9301 + 49297) % 233280; return seme / 233280; };
    let s = '<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="1600" height="900" fill="#1e1814"/>';
    s += `<g opacity=".5">${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 200} 0 L${i * 200} 900" stroke="#2a221c" stroke-width="2"/>`).join('')}</g>`;
    const pins = [];
    for (let i = 0; i < 26; i++) {
      const x = r() * 1600, y = r() * 900, w = 90 + r() * 150, h = 110 + r() * 160, a = (r() - 0.5) * 16, foto = r() < 0.3;
      const col = foto ? '#3a3632' : ['#5a5246', '#4e483e', '#625a4c', '#46423a'][i % 4];
      s += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${a.toFixed(1)})" opacity="${(0.3 + r() * 0.3).toFixed(2)}"><rect x="${-w / 2}" y="${-h / 2}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${col}"/>`;
      if (foto) s += `<rect x="${-w / 2 + 8}" y="${-h / 2 + 8}" width="${(w - 16).toFixed(0)}" height="${(h * 0.6).toFixed(0)}" fill="#26221e"/><circle cx="0" cy="${(-h * 0.2).toFixed(0)}" r="${(w * 0.16).toFixed(0)}" fill="#33302c"/>`;
      else for (let k = 0; k < 6; k++) s += `<rect x="${-w / 2 + 10}" y="${(-h / 2 + 16 + k * 16).toFixed(0)}" width="${((w - 20) * (0.5 + r() * 0.5)).toFixed(0)}" height="3" fill="#2a2620"/>`;
      s += '</g>';
      pins.push([x, y - h / 2 + 8]);
    }
    for (let i = 0; i < 12; i++) { const p = pins[Math.floor(r() * pins.length)], q = pins[Math.floor(r() * pins.length)]; s += `<path d="M${p[0].toFixed(0)} ${p[1].toFixed(0)} Q${((p[0] + q[0]) / 2).toFixed(0)} ${(Math.max(p[1], q[1]) + 40).toFixed(0)} ${q[0].toFixed(0)} ${q[1].toFixed(0)}" stroke="#8a1c18" stroke-width="2" fill="none" opacity=".55"/>`; }
    pins.forEach(p => { s += `<circle cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="5" fill="#a02a22" opacity=".7"/>`; });
    s += '<rect width="1600" height="900" fill="url(#vgBach)"/><defs><radialGradient id="vgBach" cx=".5" cy=".45" r=".7"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient></defs></svg>';
    b.innerHTML = s;
  };

  /* ===================================================================== */
  /* Atrio                                                                 */
  /* ===================================================================== */
  // Battute di gioco delle Voci (inventate, come tutti i dialoghi: le Voci sono personaggi romanzati)
  H.FRASI = {
    scipione: ['Conoscere il campo vale più di mille lance.', 'Canne mi ha insegnato a non sottovalutare nessuno.'],
    spartaco: ['Nessuna catena è più forte di chi decide di spezzarla.', 'Ascolta bene: anche il silenzio di un\'arena ha una voce.'],
    augusto: ['L\'ordine è un edificio: si costruisce pietra su pietra.', 'Ogni editto ha un prezzo. Lo paga sempre qualcuno.'],
    perpetua: ['Non ho paura del buio, se qualcuno resta accanto a me.', 'Scriverò fino all\'ultimo giorno: le parole restano.'],
    federico: ['Domandare è il primo passo per capire il mondo.', 'Un falco insegna la pazienza meglio di un precettore.'],
    matilde: ['La pace si costruisce anche davanti a una porta chiusa.', 'Un castello regge se regge chi lo abita.'],
    leonardo: ['Guarda come vola un uccello: ogni macchina nasce da lì.', 'Un errore annotato è già mezzo progetto.'],
    caterina: ['Le mura si difendono con la testa, prima che con i cannoni.', 'Chi mi sottovaluta, di solito, se ne pente.'],
    garibaldi: ['Avanti! Ma ricordiamoci di chi resta indietro.', 'Una camicia rossa non basta: serve il coraggio di dubitare.'],
    cavour: ['La politica è un telaio: ogni filo conta.', 'Una lettera ben scritta vale un reggimento.'],
    baracca: ['Il cielo è grande, ma non abbastanza per l\'orgoglio.', 'Lassù si vede tutto: anche quanto costa una guerra.'],
    mentil: ['La gerla pesa, ma pesa di più lasciare soli quelli in montagna.', 'Un passo alla volta si arriva anche in cima.'],
    perlasca: ['A volte basta un timbro e il coraggio di usarlo.', 'Non ero un eroe. Ho solo deciso di non voltarmi.'],
    anselmi: ['Scegliere da che parte stare è già una forma di lotta.', 'Le parole giuste devono arrivare in tempo.'],
    bartali: ['Certe cose si fanno e non si raccontano.', 'Pedalare è come pregare: una salita alla volta.']
  };
  H.atrio = function () {
    const d = S().data, L = H.livello();
    const cap = Math.max(0, Math.min(6, (d.progresso.sbloccato || 1) - 1));
    $('#at-lv').innerHTML = `<i>LV</i>${String(L.lv).padStart(3, '0')}`; $('#at-id').textContent = 'N° ' + H.numero();
    // vetrina con la Voce guida
    const scena = $('#menu-scena'), guida = d.guida && S().possiede(d.guida) ? d.guida : (d.squadra && d.squadra[0]) || 'scipione';
    E.Arte.applicaPalette(scena, cap);
    scena.innerHTML = `<div class="ms-bg">${E.Arte.sfondo(cap)}</div><div class="ms-floor"></div>
      <svg class="at-sigillo" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 4"/><path d="M50 10 L57 43 L90 50 L57 57 L50 90 L43 57 L10 50 L43 43 Z" fill="none" stroke="currentColor" stroke-width="2"/><text x="50" y="54" text-anchor="middle" font-size="11" fill="currentColor" font-family="Oswald">ARCHIVIO</text></svg>
      <div class="at-fig"></div><div class="at-frase"><small></small><span></span></div>
      <button class="at-ic" id="at-cambia" title="Cambia Voce guida" style="position:absolute;right:10px;top:10px;z-index:3">⇄</button>`;
    const fw = $('.at-fig', scena), f = E.Arte.figura(guida); fw.appendChild(f);
    fw.style.setProperty('--glow-at', E.AFFINITA[E.VOCI[guida].aff].colore + '66');
    let k = 0; const frasi = H.FRASI[guida] || ['L\'Archivio ascolta.'];
    const dici = () => { $('.at-frase small', scena).textContent = E.VOCI[guida].breve + ' · battuta di gioco'; $('.at-frase span', scena).textContent = '«' + frasi[k % frasi.length] + '»'; k++; };
    dici();
    scena.onclick = e => { if (e.target.closest('#at-cambia')) return; const sk = E.VOCI[guida].skills.map(s => E.ANIM_SKILL[s]).filter(Boolean); E.Arte.anima(f, sk[Math.floor(Math.random() * sk.length)] || 'grido', 1); dici(); E.UI.Snd.init(); };
    $('#at-cambia').onclick = () => H.scegliGuida();
    // colonna dei capitoli
    const col = $('#at-capitoli'); $$('.at-cap', col).forEach(x => x.remove());
    E.CAPITOLI.forEach((c, i) => {
      const n = i + 1, ok = n <= d.progresso.sbloccato, fatto = d.progresso.completati.includes(n);
      const b = el('div', 'at-cap' + (ok ? '' : ' bloccato') + (fatto ? ' fatto' : ''), E.Arte.sfondo(i) + `<small>CAPITOLO ${c.num}</small><b>${c.epoca}</b>`);
      b.onclick = () => { E.UI.Snd.init(); E.UI.Snd.sfx('ui'); H.capSel = n; E.Campagna.hub(); };
      col.appendChild(b);
    });
    // banner
    const bx = $('#at-banner'); bx.innerHTML = '';
    const banner = (sfondo, figure, sop, titolo, fn) => {
      const b = el('div', 'at-banner', `<div class="sf">${E.Arte.sfondo(sfondo)}</div>`);
      figure.forEach((id, j) => { const w = el('div', 'bf' + (j ? ' bf2' : '')); w.appendChild(E.Arte.figura(id)); b.appendChild(w); });
      b.appendChild(el('div', 'tt', `<small>${sop}</small><b class="scritta">${titolo}</b>`));
      b.onclick = () => { E.UI.Snd.init(); E.UI.Snd.sfx('ui'); fn(); }; bx.appendChild(b);
    };
    const B = E.BANNER.find(x => x.evidenza.length && (E.Gacha.ui.banner === x.id)) || E.BANNER[1];
    banner(B.evidenza[0] && E.VOCI[B.evidenza[0]] ? E.VOCI[B.evidenza[0]].epoca - 1 : 0, B.evidenza.slice(0, 2), 'Evocazione in evidenza', B.nome, () => { E.Gacha.ui.banner = B.id; E.Gacha.ui.apri(H.ctx); });
    const cc = E.CAPITOLI[d.run ? d.run.cap - 1 : cap];
    banner(d.run ? d.run.cap - 1 : cap, [cc.boss], d.run ? 'Spedizione in corso' : 'Viaggio · Capitolo ' + cc.num, cc.eco, () => { if (d.run) E.Campagna.riprendi(); else { H.capSel = cap + 1; E.Campagna.hub(); } });
    banner(0, ['legionario'], 'Arena', 'Battaglia libera', () => H.vai('voci'));
    if (E.UI.Fx) E.UI.Fx.ambiente = E.Arte.palette(cap).polvere;
  };
  H.scegliGuida = function () {
    const d = el('div'); d.innerHTML = '<h3>Voce guida</h3><p>Chi ti accoglie nell\'Atrio?</p>';
    const g = el('div', 'sq-griglia'); g.style.gridTemplateColumns = 'repeat(auto-fill,minmax(90px,1fr))';
    Object.keys(S().data.roster).forEach(id => { const v = E.VOCI[id]; if (!v) return; const c = el('div', 'sq-card r' + v.rarita); c.style.setProperty('--ac', E.AFFINITA[v.aff].colore); c.appendChild(E.UI.ritratto(v)); c.appendChild(el('div', 'n', v.breve));
      c.onclick = () => { S().data.guida = id; S().save(); $('#modale').classList.remove('on'); H.atrio(); }; g.appendChild(c); });
    d.appendChild(g); E.UI.modale(d);
  };

  /* ===================================================================== */
  /* Voci — composizione della squadra                                     */
  /* ===================================================================== */
  const Q = E.UI.squadra = {
    sel: [], det: null, filtro: null, ctx: null, opts: {},
    init(ctx, opts) {
      this.ctx = ctx; this.opts = opts = opts || {}; this.filtro = null;
      const d = ctx.save, pool = this.pool = (opts.pool || Object.keys(d.roster || {}).filter(id => E.VOCI[id])).filter(id => E.VOCI[id]);
      if (!d.squadre) d.squadre = [0, 1, 2, 3, 4].map(i => ({ nome: 'Squadra ' + (i + 1), ids: i === 0 ? (d.squadra || []).slice() : [] }));
      if (!Array.isArray(d.squadre) || d.squadre.length !== 5) d.squadre = [0, 1, 2, 3, 4].map(i => (d.squadre && d.squadre[i]) || { nome: 'Squadra ' + (i + 1), ids: [] });
      d.squadre.forEach((q, i) => { if (!q || !Array.isArray(q.ids)) d.squadre[i] = { nome: (q && q.nome) || 'Squadra ' + (i + 1), ids: [] }; });
      d.squadraAttiva = d.squadraAttiva >= 0 && d.squadraAttiva < 5 ? d.squadraAttiva : 0;
      this.sel = (d.squadre[d.squadraAttiva].ids.length ? d.squadre[d.squadraAttiva].ids : d.squadra || []).filter(id => pool.includes(id)).slice(0, C.SQUADRA_MAX);
      if (this.sel.length < C.SQUADRA_MAX && !opts.libera) pool.forEach(id => { if (this.sel.length < C.SQUADRA_MAX && !this.sel.includes(id)) this.sel.push(id); });
      this.det = this.sel[0] || pool[0];
      $('#sq-via').textContent = opts.testoVia || 'Combatti';
      $('#sq-inc-wrap').style.display = opts.nascondiIncontro ? 'none' : '';
      const s = $('#sq-incontro'); s.innerHTML = '';
      Object.values(E.INCONTRI).filter(i => !i.tutorial && !i.campagna).forEach(i => { const o = el('option', '', i.nome); o.value = i.id; s.appendChild(o); });
      s.value = d.incontro && E.INCONTRI[d.incontro] && !E.INCONTRI[d.incontro].campagna ? d.incontro : 'pattuglia';
      $('#sq-via').onclick = () => (opts.onVia ? opts.onVia(this.sel.slice()) : ctx.onAvvia(this.sel.slice(), s.value));
      $('#sq-affinita').onclick = () => E.UI.tabellaAffinita();
      $('#sq-dettagli').onclick = () => E.Archivio.scheda(this.det);
      $('#sq-consigliata').onclick = () => { this.sel = ['scipione', 'spartaco', 'perpetua', 'leonardo'].filter(id => pool.includes(id)); pool.forEach(id => { if (this.sel.length < C.SQUADRA_MAX && !this.sel.includes(id)) this.sel.push(id); }); this.salva(); this.disegna(); };
      $('#sq-casuale').onclick = () => {
        const tutte = pool.slice().sort(() => Math.random() - 0.5), sc = [], usate = new Set();
        tutte.forEach(id => { if (sc.length < C.SQUADRA_MAX && !usate.has(E.VOCI[id].aff)) { sc.push(id); usate.add(E.VOCI[id].aff); } });
        tutte.forEach(id => { if (sc.length < C.SQUADRA_MAX && !sc.includes(id)) sc.push(id); });
        this.sel = sc; this.salva(); this.disegna();
      };
      $('#vs-rinomina').onclick = () => { const n = prompt('Nome della squadra:', d.squadre[d.squadraAttiva].nome); if (n) { d.squadre[d.squadraAttiva].nome = n.slice(0, 22); ctx.persist(); this.disegna(); } };
      this.disegna();
    },
    salva() { const d = this.ctx.save; d.squadra = this.sel.slice(); if (d.squadre) d.squadre[d.squadraAttiva].ids = this.sel.slice(); this.ctx.persist(); },
    toggle(id) {
      const i = this.sel.indexOf(id);
      if (i >= 0) this.sel.splice(i, 1); else if (this.sel.length < C.SQUADRA_MAX) this.sel.push(id);
      this.det = id; this.salva(); this.disegna();
    },
    disegna() {
      const d = this.ctx.save, pool = this.pool;
      // preset
      const ls = $('#vs-squadre'); ls.innerHTML = '<span class="piastra">SQUADRE</span>';
      d.squadre.forEach((q, i) => { const b = el('button', 'vs-sq' + (i === d.squadraAttiva ? ' on' : ''), q.nome); b.onclick = () => { d.squadraAttiva = i; this.sel = q.ids.filter(id => pool.includes(id)); this.det = this.sel[0] || pool[0]; d.squadra = this.sel.slice(); this.ctx.persist(); E.UI.Snd.sfx('ui'); this.disegna(); }; ls.appendChild(b); });
      $('#vs-titolo').textContent = this.opts.titolo || d.squadre[d.squadraAttiva].nome;
      $('#sq-conta').textContent = this.sel.length + '/' + C.SQUADRA_MAX;
      // guida
      const g = d.guida && E.VOCI[d.guida] ? d.guida : this.sel[0] || pool[0], cf = $('#vs-capo'); cf.innerHTML = ''; if (g) { cf.appendChild(E.Arte.figura(g)); $('#vs-capo-n').textContent = E.VOCI[g].nome; }
      // filtri
      const f = $('#sq-filtri'); f.innerHTML = '';
      const chip = (txt, aff, col) => { const b = el('button', 'chip-filtro' + (aff === this.filtro ? ' on' : ''), txt); if (col) b.style.setProperty('--ac', col); b.onclick = () => { this.filtro = aff || null; this.disegna(); }; f.appendChild(b); };
      chip('Tutte', null); E.AFFINITA_ORDINE.forEach(a => chip(E.AFFINITA[a].simbolo, a, E.AFFINITA[a].colore));
      // carte
      const gr = $('#sq-griglia'), sx = gr.scrollLeft; gr.innerHTML = '';
      const ordine = pool.slice().sort((a, b) => (this.sel.includes(b) - this.sel.includes(a)) || (this.sel.indexOf(a) - this.sel.indexOf(b)) || (E.VOCI[b].rarita - E.VOCI[a].rarita) || (E.VOCI[a].epoca - E.VOCI[b].epoca));
      ordine.forEach(id => {
        const v = E.VOCI[id], a = E.AFFINITA[v.aff], lv = S().livello(id), i = this.sel.indexOf(id);
        const c = el('div', 'carta-voce r' + v.rarita + (i >= 0 ? ' sel' : '') + (this.det === id ? ' det' : '') + (this.filtro && v.aff !== this.filtro ? ' nascosta' : ''));
        c.style.setProperty('--ac', a.colore);
        const fw = el('div', 'cv-fig'); fw.appendChild(E.Arte.figura(id)); c.appendChild(fw);
        c.insertAdjacentHTML('beforeend', `<span class="cv-rar">${'★'.repeat(v.rarita)}</span><span class="cv-aff">${a.simbolo}</span><span class="cv-ord">${i + 1}</span>
          <div class="cv-testo"><span class="cv-lv scritta bianca">Eco ${lv}</span><span class="cv-nome scritta">${v.breve}</span></div>`);
        c.dataset.tip = `<b>${v.nome}</b><br>${a.simbolo} ${a.nome} · ${v.ruolo} · ${'★'.repeat(v.rarita)}<br>PV ${v.pv} · Velocità ${v.vel[0]}–${v.vel[1]}`;
        c.onclick = () => { E.UI.Snd.init(); E.UI.Snd.sfx('ui'); this.toggle(id); };
        gr.appendChild(c);
      });
      gr.scrollLeft = sx;
      // pannello affinità: skill della squadra per affinità | Voci di quell'affinità
      const ul = $('#vs-aff'); ul.innerHTML = '';
      E.AFFINITA_ORDINE.forEach(af => {
        const A = E.AFFINITA[af], sk = this.sel.reduce((t, id) => t + E.VOCI[id].skills.filter(s => E.SKILL[s].aff === af).length, 0), vo = this.sel.filter(id => E.VOCI[id].aff === af).length;
        ul.appendChild(el('li', '', `<i style="color:${A.colore}">${A.simbolo}</i><span style="color:${sk >= 3 ? A.colore : ''}">${sk}</span><small>${vo ? vo + ' Voc' + (vo > 1 ? 'i' : 'e') : '—'}</small>`));
      });
      const affs = this.sel.map(id => E.VOCI[id].aff), conc = E.CONCORDIE.filter(([x, y]) => affs.includes(x) && affs.includes(y));
      $('#vs-conc').innerHTML = conc.length ? conc.map(c => `Concordia ${E.AFFINITA[c[0]].simbolo}${E.AFFINITA[c[1]].simbolo}`).join(' · ') : '<span style="color:var(--testo2)">Nessuna Concordia</span>';
      $('#sq-via').disabled = this.sel.length !== C.SQUADRA_MAX;
    }
  };

  /* ===================================================================== */
  /* Viaggio — mappa d'Italia                                              */
  /* ===================================================================== */
  // Contorni approssimati (lon, lat) di penisola, Sicilia e Sardegna
  const ITALIA = [[7.5, 43.8], [7.0, 44.2], [6.9, 44.9], [7.1, 45.3], [6.8, 45.8], [7.5, 45.95], [8.4, 46.45], [9.0, 46.0], [9.5, 46.5], [10.2, 46.6], [10.5, 46.9], [11.2, 46.97], [12.2, 47.0], [12.7, 46.65], [13.7, 46.5], [13.5, 46.2], [13.7, 45.75], [13.77, 45.6],
    [13.1, 45.75], [12.4, 45.45], [12.25, 45.2], [12.5, 44.9], [12.25, 44.5], [12.6, 44.0], [13.6, 43.5], [14.0, 42.9], [14.5, 42.3], [15.0, 42.0], [15.9, 41.95], [16.1, 41.6], [16.9, 41.15], [17.9, 40.65], [18.5, 40.15], [18.35, 39.8], [17.9, 40.25], [17.2, 40.45], [16.6, 40.1], [16.55, 39.6], [17.15, 39.2], [16.5, 38.7], [16.1, 38.0], [15.65, 37.95],
    [15.75, 38.6], [16.0, 39.4], [15.65, 40.05], [14.9, 40.25], [14.4, 40.6], [14.2, 40.8], [13.6, 41.25], [12.9, 41.4], [12.2, 41.75], [11.8, 42.1], [11.1, 42.4], [10.5, 42.95], [10.3, 43.5], [10.1, 44.0], [9.5, 44.2], [8.8, 44.4], [8.2, 43.95]];
  const SICILIA = [[12.4, 37.8], [13.3, 38.2], [14.3, 38.0], [15.65, 38.25], [15.1, 37.3], [15.25, 36.7], [14.4, 36.8], [13.0, 37.5]];
  const SARDEGNA = [[8.4, 41.2], [9.25, 41.25], [9.7, 40.9], [9.7, 40.0], [9.6, 39.2], [9.0, 39.0], [8.4, 38.9], [8.4, 39.7], [8.5, 40.4], [8.2, 40.9]];
  const TAPPE = [[16.1, 41.3, 'Canne'], [12.5, 41.9, 'Roma'], [11.0, 45.4, 'Verona'], [11.25, 43.77, 'Firenze'], [9.19, 45.46, 'Milano'], [13.6, 45.9, 'Isonzo'], [12.6, 43.07, 'Assisi']];
  const MAPPA = { W: 600, H: 520, lon0: 6.0, lon1: 19.2, lat0: 47.4, lat1: 36.4 };
  const proietta = (lon, lat) => [(lon - MAPPA.lon0) / (MAPPA.lon1 - MAPPA.lon0) * MAPPA.W, (MAPPA.lat0 - lat) / (MAPPA.lat0 - MAPPA.lat1) * MAPPA.H * 1.0];
  const percorso = pts => 'M' + pts.map(p => proietta(p[0], p[1]).map(v => v.toFixed(1)).join(' ')).join(' L') + ' Z';

  H.viaggio = function () {
    const K = E.Campagna, d = S().data;
    const modi = $('#vg-modi'); modi.innerHTML = '';
    const modo = (cls, sf, sop, nome, fn) => { const b = el('button', 'vg-modo ' + cls, `<div class="sf">${E.Arte.sfondo(sf)}</div><small>${sop}</small><b class="scritta">${nome}</b>`); b.onclick = () => { E.UI.Snd.init(); E.UI.Snd.sfx('ui'); fn(); }; modi.appendChild(b); };
    modo('on', 0, 'Storia', 'Campagna', () => {});
    if (d.run) modo('speciale', d.run.cap - 1, 'In corso', 'Spedizione', () => K.riprendi());
    modo('', 2, 'Allenamento', 'Arena', () => H.vai('voci'));
    modo('', 3, 'Archivio', 'Codex storico', () => { E.Archivio.tab = 'codex'; E.Archivio.apri(); });
    // mappa
    const sel = H.capSel || (d.run ? d.run.cap : Math.min(7, d.progresso.sbloccato || 1)); H.capSel = sel;
    const m = $('#vg-mappa');
    let svg = `<svg class="mappa-svg" viewBox="-20 -10 ${MAPPA.W + 40} ${MAPPA.H + 20}" preserveAspectRatio="xMinYMid meet"><g class="griglia">`;
    for (let i = 0; i <= 12; i++) svg += `<line x1="${i * 50}" y1="-10" x2="${i * 50}" y2="${MAPPA.H + 10}"/>`;
    for (let i = 0; i <= 11; i++) svg += `<line x1="-20" y1="${i * 50}" x2="${MAPPA.W + 20}" y2="${i * 50}"/>`;
    svg += `</g><circle cx="${MAPPA.W * 0.44}" cy="${MAPPA.H * 0.45}" r="190" fill="none" stroke="#ff4a3a18" stroke-width="1"/><circle cx="${MAPPA.W * 0.44}" cy="${MAPPA.H * 0.45}" r="120" fill="none" stroke="#ff4a3a18" stroke-width="1"/>`;
    svg += `<path class="regione" d="${percorso(ITALIA)}"/><path class="regione" d="${percorso(SICILIA)}"/><path class="regione" d="${percorso(SARDEGNA)}"/>`;
    // rotta dei capitoli completati
    const pt = TAPPE.map(t => proietta(t[0], t[1]));
    const fatti = d.progresso.completati.slice().sort((a, b) => a - b);
    if (fatti.length) svg += `<path class="rotta" d="M${pt.slice(0, Math.min(7, Math.max(...fatti) + 1)).map(p => p.map(v => v.toFixed(0)).join(' ')).join(' L')}"/>`;
    E.CAPITOLI.forEach((c, i) => {
      const n = i + 1, ok = n <= d.progresso.sbloccato, fatto = d.progresso.completati.includes(n), [x, y] = pt[i];
      svg += `<g class="tappa${ok ? '' : ' bloccato'}${fatto ? ' fatto' : ''}${n === sel ? ' sel' : ''}" data-n="${n}"><circle class="alone" cx="${x}" cy="${y}" r="13"/><circle class="pt" cx="${x}" cy="${y}" r="6"/><text x="${x + 10}" y="${y - 6}">${c.num}</text><text class="lbl" x="${x + 10}" y="${y + 8}">${TAPPE[i][2].toUpperCase()}</text></g>`;
    });
    svg += `<g transform="translate(${MAPPA.W - 50} ${MAPPA.H - 60})" stroke="#e3c47e" fill="none" opacity=".45"><circle r="26"/><path d="M0 -24 L5 0 L0 24 L-5 0 Z" fill="#e3c47e33"/><text y="-30" text-anchor="middle" fill="#e3c47e" stroke="none" font-size="11" font-family="Oswald">N</text></g></svg>`;
    m.innerHTML = svg;
    $$('.tappa', m).forEach(g => { g.onclick = () => { E.UI.Snd.init(); E.UI.Snd.sfx('ui'); H.capSel = +g.dataset.n; H.viaggio(); }; });
    // pannello del capitolo scelto
    const c = E.CAPITOLI[sel - 1], ok = sel <= d.progresso.sbloccato, fatto = d.progresso.completati.includes(sel), inCorso = d.run && d.run.cap === sel, mem = d.flag['memoria' + sel];
    const info = el('div', 'vg-info', `<div class="vg-etic"><span class="num">${c.num}</span><b class="scritta bianca">${c.epoca}</b></div>
      <div class="vg-corpo"><div class="eco">${c.eco}</div><p>${c.descr}</p><div class="vg-volti"></div>
      <div class="stato">${!ok ? '🔒 Completa il capitolo precedente' : inCorso ? '● Spedizione in corso' : fatto ? '★ Completato' + (mem ? ' · memoria: ' + mem : '') : 'Disponibile'}</div><div class="vg-btn"></div></div>`);
    c.voci.forEach(id => $('.vg-volti', info).appendChild(E.UI.ritratto(E.VOCI[id])));
    const bx = $('.vg-btn', info);
    if (ok) {
      if (inCorso) { const b1 = el('button', 'btn grande', 'Continua'); b1.onclick = () => K.riprendi(); const b2 = el('button', 'btn piccolo', 'Ricomincia'); b2.onclick = () => { if (confirm('Ricominciare il capitolo? La spedizione in corso andrà persa.')) { d.run = null; S().save(); K.apriCapitolo(sel); } }; bx.append(b2, b1); }
      else { const b = el('button', 'btn grande', fatto ? 'Rigioca' : 'Inizia'); b.onclick = () => { if (d.run && !confirm('Hai una spedizione in corso in un altro capitolo: iniziare questo la annulla. Continuare?')) return; d.run = null; K.apriCapitolo(sel); }; bx.appendChild(b); }
    }
    m.appendChild(info);
    if (E.UI.Fx) E.UI.Fx.ambiente = '255,120,90';
  };
})(typeof window !== 'undefined' ? window : globalThis);
