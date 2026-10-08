/* ============================================================================
 * campagna.js — la campagna: scelta del capitolo, spedizione a nodi (dungeon), eventi, negozio, riposo, battaglie
 * con danni portati da uno scontro all'altro, ricompense e finali.
 *
 * Flusso di un capitolo:
 *   scelta squadra → scena «prologo» → MAPPA A NODI (un nodo per strato: combattimento / evento / negozio / riposo / elite)
 *   → nodo BOSS: scena pre-boss → battaglia → scena «epilogo» (scelta di memoria) → ricompense → capitolo completato.
 *
 * Stato della spedizione (E.Save.data.run):
 *   { cap, squadra:[ids], strato, scelti:[indice scelto per strato], stati:{id:{pv,sanita}}, oggetti:{id:n},
 *     bonus:{ardore, voto}, negozio:{strato:[ids]} }
 * Le Voci cadute si rialzano al 25% PV con Sanità −15 (nessuna morte permanente).
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi = root.Echi || {};
  const K = E.Campagna = { ctx: null };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const S = () => E.Save;

  const ICONE = { combattimento: '⚔', elite: '☠', evento: '❖', negozio: '◎', riposo: '☾', boss: '♛' };
  const NOMI = { combattimento: 'Scontro', elite: 'Scontro duro', evento: 'Evento', negozio: 'Negozio', riposo: 'Riposo', boss: 'Boss' };
  const pvMax = id => Math.round(E.VOCI[id].pv * (1 + 0.05 * S().livello(id)));

  K.init = function (ctx) { K.ctx = ctx; };
  const capo = () => E.CAPITOLI[S().data.run.cap - 1];

  /* ===================================================================== */
  /* Hub dei capitoli                                                      */
  /* ===================================================================== */
  K.hub = function () {
    E.UI.mostra('campagna');
    const d = S().data, g = $('#c-griglia'); g.innerHTML = '';
    $('#c-valute').innerHTML = `<span class="val sigilli">❂ ${d.valute.sigilli}</span><span class="val denari">◎ ${d.valute.denari}</span>`;
    E.CAPITOLI.forEach((c, i) => {
      const n = i + 1, sbloccato = n <= d.progresso.sbloccato, fatto = d.progresso.completati.includes(n), inCorso = d.run && d.run.cap === n;
      const card = el('div', 'c-card' + (sbloccato ? '' : ' bloccato') + (fatto ? ' fatto' : '') + (inCorso ? ' in-corso' : ''));
      card.style.setProperty('--ac', E.Arte.palette(i).bordo);
      const volti = el('div', 'c-volti'); c.voci.forEach(id => volti.appendChild(E.UI.ritratto(E.VOCI[id])));
      card.appendChild(volti);
      const mem = d.flag['memoria' + n];
      card.appendChild(el('div', 'c-testo', `<div class="c-num">Capitolo ${c.num}</div><h3>${c.epoca}</h3><div class="c-eco">${c.eco}</div><p>${c.descr}</p>` +
        `<div class="c-stato">${!sbloccato ? '🔒 Completa il capitolo precedente' : inCorso ? '● Spedizione in corso' : fatto ? '★ Completato' + (mem ? ' · memoria: ' + mem : '') : 'Disponibile'}</div>`));
      const bx = el('div', 'c-btn');
      if (sbloccato) {
        if (inCorso) { const b1 = el('button', 'btn grande', 'Continua'); b1.onclick = () => K.riprendi(); const b2 = el('button', 'btn piccolo', 'Ricomincia'); b2.onclick = () => { if (confirm('Ricominciare il capitolo? La spedizione in corso andrà persa.')) { d.run = null; S().save(); K.apriCapitolo(n); } }; bx.append(b1, b2); }
        else { const b = el('button', 'btn grande', fatto ? 'Rigioca' : 'Inizia'); b.onclick = () => { if (d.run && !confirm('Hai una spedizione in corso in un altro capitolo: iniziare questo la annulla. Continuare?')) return; d.run = null; K.apriCapitolo(n); }; bx.appendChild(b); }
      }
      card.appendChild(bx); g.appendChild(card);
    });
  };

  /* ===================================================================== */
  /* Avvio capitolo                                                        */
  /* ===================================================================== */
  K.apriCapitolo = function (n) {
    const ctx = K.ctx, owned = Object.keys(S().data.roster).filter(id => E.VOCI[id]);
    E.UI.squadra.init(ctx, {
      pool: owned, titolo: 'Capitolo ' + E.CAPITOLI[n - 1].num + ': scegli la squadra', nascondiIncontro: true, testoVia: 'Parti',
      onVia: sel => K.nuovaSpedizione(n, sel)
    });
    E.UI.mostra('squadra');
  };
  K.nuovaSpedizione = async function (n, squadra) {
    const d = S().data, stati = {};
    squadra.forEach(id => { stati[id] = { pv: pvMax(id), sanita: 0 }; });
    d.squadra = squadra.slice();
    d.run = { cap: n, squadra: squadra.slice(), strato: 0, scelti: [], stati, oggetti: { pozione: 1 }, bonus: { ardore: 0, voto: 0 }, negozio: {}, fase: 'prologo' };
    S().save();
    await K.scena(capo().prologo);
    d.run.fase = 'mappa'; S().save(); K.mappa();
  };
  K.riprendi = function () { const r = S().data.run; if (!r) return K.hub(); K.mappa(); };

  /* ---------- Scene (con applicazione degli effetti alla spedizione) ---------- */
  K.effetto = function (e) {
    const d = S().data, run = d.run;
    if (e.denari) S().aggiungi('denari', e.denari);
    if (e.sigilli) S().aggiungi('sigilli', e.sigilli);
    if (e.codex) S().sblocca(e.codex);
    if (!run) return;
    run.squadra.forEach(id => {
      const st = run.stati[id]; if (!st) return;
      if (e.pv) st.pv = clamp(Math.round(st.pv + e.pv * pvMax(id)), 1, pvMax(id));
      if (e.sanita) st.sanita = clamp(st.sanita + e.sanita, E.CONFIG.SANITA_MIN + 5, E.CONFIG.SANITA_MAX);
    });
    if (e.oggetto) run.oggetti[e.oggetto] = (run.oggetti[e.oggetto] || 0) + 1;
    if (e.bonus) { run.bonus.ardore += e.bonus.ardore || 0; run.bonus.voto += e.bonus.voto || 0; }
    S().save();
  };
  K.scena = function (id) { return E.Story.gioca(id, { save: S(), effetto: K.effetto }); };

  /* ===================================================================== */
  /* Mappa a nodi                                                          */
  /* ===================================================================== */
  K.mappa = function () {
    const d = S().data, run = d.run, c = capo();
    E.UI.mostra('mappa');
    E.Arte.applicaPalette($('#scr-mappa'), run.cap - 1);
    $('#m-titolo').innerHTML = `<small>Capitolo ${c.num}</small> ${c.epoca} — ${c.eco}`;
    $('#m-valute').innerHTML = `<span class="val sigilli">❂ ${d.valute.sigilli}</span><span class="val denari">◎ ${d.valute.denari}</span>`;
    // strati e nodi
    const box = $('#m-mappa'); box.innerHTML = '';
    const svgLinee = el('div', 'm-linee'); box.appendChild(svgLinee);
    const cols = [];
    c.strati.forEach((strato, si) => {
      const col = el('div', 'm-strato' + (si === run.strato ? ' attuale' : si < run.strato ? ' passato' : ''));
      col.appendChild(el('div', 'm-num', si === c.strati.length - 1 ? 'Boss' : 'Strato ' + (si + 1)));
      strato.forEach((nodo, ni) => {
        const scelto = run.scelti[si] === ni, disp = si === run.strato;
        const n = el('button', 'm-nodo t-' + nodo.tipo + (disp ? ' disponibile' : '') + (scelto ? ' scelto' : '') + (si < run.strato && !scelto ? ' scartato' : '') + (si > run.strato ? ' futuro' : ''));
        n.innerHTML = `<span class="i">${ICONE[nodo.tipo]}</span><span class="l">${NOMI[nodo.tipo]}</span>`;
        n.disabled = !disp; n.dataset.tip = K.descrNodo(nodo);
        n.onclick = () => K.entraNodo(si, ni);
        col.appendChild(n); n._pos = [si, ni];
      });
      box.appendChild(col); cols.push(col);
    });
    requestAnimationFrame(() => K.disegnaLinee(box, svgLinee, cols));
    K.disegnaSquadra();
    const att = $('.m-strato.attuale', box); if (att && att.scrollIntoView) att.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  };
  K.descrNodo = nodo => {
    const base = '<b>' + NOMI[nodo.tipo] + '</b><br>';
    if (nodo.incontro) { const i = E.INCONTRI[nodo.incontro]; return base + i.nome + '<br>' + i.nemici.map(n => E.NEMICI[n].breve).join(', '); }
    if (nodo.tipo === 'evento') return base + 'Una scena con una scelta che ha conseguenze.';
    if (nodo.tipo === 'negozio') return base + 'Compra oggetti con i Denari.';
    return base + 'Recupera PV e Sanità.';
  };
  K.disegnaLinee = function (box, layer, cols) {
    layer.innerHTML = ''; const rb = box.getBoundingClientRect();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', box.scrollWidth); svg.setAttribute('height', box.scrollHeight); svg.style.position = 'absolute'; svg.style.left = 0; svg.style.top = 0;
    const run = S().data.run, pos = (si, ni) => { const n = cols[si].querySelectorAll('.m-nodo')[ni].getBoundingClientRect(); return [n.left - rb.left + box.scrollLeft + n.width / 2, n.top - rb.top + box.scrollTop + n.height / 2]; };
    for (let si = 0; si < cols.length - 1; si++) {
      const A = cols[si].querySelectorAll('.m-nodo').length, B = cols[si + 1].querySelectorAll('.m-nodo').length;
      for (let a = 0; a < A; a++) for (let b = 0; b < B; b++) {
        const p = pos(si, a), q = pos(si + 1, b), l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', p[0]); l.setAttribute('y1', p[1]); l.setAttribute('x2', q[0]); l.setAttribute('y2', q[1]);
        const sul = run.scelti[si] === a && (run.scelti[si + 1] === b || (si + 1 === run.strato)); l.setAttribute('class', sul ? 'attivo' : '');
        svg.appendChild(l);
      }
    }
    layer.appendChild(svg);
  };
  K.disegnaSquadra = function () {
    const run = S().data.run, box = $('#m-squadra'); box.innerHTML = '';
    run.squadra.forEach(id => {
      const v = E.VOCI[id], st = run.stati[id], mx = pvMax(id);
      const c = el('div', 'm-voce');
      c.appendChild(E.UI.ritratto(v));
      c.appendChild(el('div', 'm-info', `<b>${v.breve}</b>${S().livello(id) ? ` <small class="lv">Eco ${S().livello(id)}</small>` : ''}
        <div class="barra-pv"><div class="pieno" style="width:${st.pv / mx * 100}%"></div><div class="num">${st.pv} / ${mx}</div></div>
        <div class="barra-sanita"><div class="riempi" style="width:${Math.abs(st.sanita) / 45 * 50}%;left:${st.sanita >= 0 ? 50 : 50 - Math.abs(st.sanita) / 45 * 50}%;background:${st.sanita >= 0 ? 'linear-gradient(90deg,#6aa8ff,#9fd0ff)' : 'linear-gradient(270deg,#a97be0,#d1a3ff)'}"></div></div>`));
      box.appendChild(c);
    });
    const inv = $('#m-oggetti'); inv.innerHTML = '';
    Object.keys(run.oggetti).filter(k => run.oggetti[k] > 0).forEach(k => {
      const o = E.OGGETTI[k], b = el('button', 'btn piccolo ogg', `${o.icona} ${o.nome} ×${run.oggetti[k]}`); b.dataset.tip = '<b>' + o.nome + '</b><br>' + o.desc;
      b.onclick = () => K.usaOggetto(k); inv.appendChild(b);
    });
    if (run.bonus.ardore || run.bonus.voto) inv.appendChild(el('span', 'bonus-att', `Bonus prossima battaglia: ${run.bonus.ardore ? '+' + run.bonus.ardore + ' Ardore ' : ''}${run.bonus.voto ? '+' + run.bonus.voto + ' Voto' : ''}`));
    if (!inv.children.length) inv.appendChild(el('span', 'vuoto', 'Nessun oggetto'));
  };
  K.usaOggetto = function (k) {
    const run = S().data.run, o = E.OGGETTI[k];
    const applica = id => {
      if (o.tipo === 'cura') { const st = run.stati[id]; st.pv = clamp(st.pv + Math.round(o.n * pvMax(id)), 1, pvMax(id)); }
      else if (o.tipo === 'sanita') run.squadra.forEach(x => { run.stati[x].sanita = clamp(run.stati[x].sanita + o.n, -40, 45); });
      else if (o.tipo === 'ardore') run.bonus.ardore += o.n;
      else if (o.tipo === 'voto') run.bonus.voto += o.n;
      run.oggetti[k]--; S().save(); K.disegnaSquadra(); $('#modale').classList.remove('on');
    };
    if (o.bers === 'voce') {
      const d = el('div'); d.innerHTML = '<h3>' + o.nome + '</h3><p>' + o.desc + ' Su chi?</p>';
      run.squadra.forEach(id => { const b = el('button', 'btn', E.VOCI[id].breve + ' (' + run.stati[id].pv + '/' + pvMax(id) + ')'); b.style.margin = '3px'; b.onclick = () => applica(id); d.appendChild(b); });
      E.UI.modale(d);
    } else applica();
  };

  /* ===================================================================== */
  /* Nodi                                                                  */
  /* ===================================================================== */
  K.entraNodo = async function (si, ni) {
    const run = S().data.run, nodo = capo().strati[si][ni];
    run.scelti[si] = ni; S().save();
    if (nodo.tipo === 'combattimento' || nodo.tipo === 'elite') K.battaglia(nodo);
    else if (nodo.tipo === 'boss') { await K.scena(capo().bossPre); K.battaglia(nodo); }
    else if (nodo.tipo === 'evento') { await K.scena(nodo.scena); K.avanza(); }
    else if (nodo.tipo === 'negozio') K.negozio();
    else if (nodo.tipo === 'riposo') K.riposo();
  };
  K.avanza = function () { const run = S().data.run; run.strato++; S().save(); K.mappa(); };

  K.riposo = function () {
    const run = S().data.run, d = el('div', 'riposo');
    d.innerHTML = '<h3>☾ Un momento di quiete</h3><p>Gli Echi tacciono per un po\'. Come usi il tempo?</p>';
    const fai = (pv, san, msg) => {
      run.squadra.forEach(id => { const st = run.stati[id]; st.pv = clamp(st.pv + Math.round(pv * pvMax(id)), 1, pvMax(id)); st.sanita = clamp(st.sanita + san, -40, 45); });
      $('#modale').classList.remove('on'); K.avanza();
    };
    const b1 = el('button', 'btn grande', 'Riposare: +35% PV, +10 Sanità'); b1.onclick = () => fai(0.35, 10);
    const b2 = el('button', 'btn', 'Meditare: +15% PV, +25 Sanità'); b2.onclick = () => fai(0.15, 25);
    b1.style.margin = b2.style.margin = '4px'; d.append(b1, b2);
    E.UI.modale(d); const cb = $('#modale .pannello-modale > .btn:last-child'); if (cb) cb.style.display = 'none';
  };
  K.negozio = function () {
    const run = S().data.run, si = run.strato;
    if (!run.negozio[si]) { const ids = Object.keys(E.OGGETTI).sort(() => Math.random() - 0.5).slice(0, 4); run.negozio[si] = ids; }
    const disegna = () => {
      const d = el('div', 'negozio'), den = S().data.valute.denari;
      d.innerHTML = `<h3>◎ Bottega degli Echi</h3><p class="den">Denari: <b>${den}</b></p>`;
      run.negozio[si].forEach(k => {
        const o = E.OGGETTI[k], riga = el('div', 'n-riga'), b = el('button', 'btn piccolo', `Compra ${o.prezzo} ◎`);
        riga.innerHTML = `<span class="ic">${o.icona}</span><span class="tx"><b>${o.nome}</b><small>${o.desc}</small></span>`;
        b.disabled = den < o.prezzo; b.onclick = () => { if (S().spendi('denari', o.prezzo)) { run.oggetti[k] = (run.oggetti[k] || 0) + 1; S().save(); disegna(); K.disegnaSquadra(); } };
        riga.appendChild(b); d.appendChild(riga);
      });
      const es = el('button', 'btn grande', 'Esci dal negozio'); es.style.marginTop = '8px'; es.onclick = () => { $('#modale').classList.remove('on'); K.avanza(); }; d.appendChild(es);
      E.UI.modale(d); const cb = $('#modale .pannello-modale > .btn:last-child'); if (cb) cb.style.display = 'none';
    };
    disegna();
  };

  /* ===================================================================== */
  /* Battaglia                                                             */
  /* ===================================================================== */
  K.battaglia = function (nodo) {
    const d = S().data, run = d.run, c = capo(), inc = E.INCONTRI[nodo.incontro];
    const prima = JSON.parse(JSON.stringify(run));                // per ritentare dopo una sconfitta
    const opz = { alleati: run.squadra.slice(), nemici: inc.nemici.slice(), npc: inc.npc, obiettivo: inc.obiettivo, livelli: S().livelli(), stati: run.stati,
      scalaDan: c.scalaDan * (inc.scalaDan || 1), scalaPv: (inc.scalaPv || 1) * c.scalaPv, bonusArdore: run.bonus.ardore, bonusStati: run.bonus.voto ? { voto: run.bonus.voto } : null };
    run.bonus = { ardore: 0, voto: 0 }; S().save();
    const B = E.Combat.creaBattaglia(opz);
    const ctx = Object.assign({}, K.ctx, { modo: 'campagna', capitolo: run.cap - 1, onMenu: () => K.mappa(),
      fineCampagna: (esito, B2) => K.fineBattaglia(esito, B2, nodo, prima) });
    root.__battaglia = B;
    E.UI.battaglia.avvia(B, ctx);
  };

  /** Chiamata dalla UI a battaglia conclusa: applica esito e ricompense, ritorna {html, bottoni}. */
  K.fineBattaglia = function (esito, B, nodo, prima) {
    const d = S().data, run = d.run, c = capo();
    if (esito !== 'vittoria') {
      d.stats.sconfitte++;
      return { html: '<p class="rw">Gli Echi vi hanno sopraffatto. I danni subiti non vengono conservati se ritenti.</p>', bottoni: [
        { testo: 'Ritenta', cls: 'grande', fn: () => { d.run = prima; S().save(); K.battaglia(nodo); } },
        { testo: 'Abbandona capitolo', fn: () => { d.run = null; S().save(); K.hub(); } }] };
    }
    d.stats.vittorie++;
    run.stati = Object.assign({}, run.stati, E.Combat.statoFinale(B));
    const caduti = Object.keys(E.Combat.statoFinale(B)).filter(id => E.Combat.statoFinale(B)[id].caduto);
    let den = 0, sig = 0;
    if (nodo.tipo === 'combattimento') { den = 16 + 9 * run.cap; sig = 1; }
    else if (nodo.tipo === 'elite') { den = 34 + 14 * run.cap; sig = 2; }
    else if (nodo.tipo === 'boss') { den = 60 + 20 * run.cap; sig = 3; }
    const ripetuto = d.progresso.completati.includes(run.cap); if (ripetuto && nodo.tipo !== 'boss') { den = Math.round(den * 0.6); }
    S().aggiungi('denari', den); S().aggiungi('sigilli', sig); S().save();
    const html = `<p class="rw">Ricompense: <b>◎ ${den}</b> · <b>❂ ${sig}</b>${caduti.length ? '<br><small>Le Voci cadute si sono rialzate a fatica: ' + caduti.map(id => E.VOCI[id].breve).join(', ') + '.</small>' : ''}</p>`;
    const cont = async () => {
      if (nodo.tipo === 'boss') await K.completaCapitolo(); else K.avanza();
    };
    return { html, bottoni: [{ testo: nodo.tipo === 'boss' ? 'Prosegui' : 'Continua', cls: 'grande', fn: cont }] };
  };

  /** Epilogo, ricompense del capitolo ed eventuale finale. */
  K.completaCapitolo = async function () {
    const d = S().data, run = d.run, c = capo(), n = run.cap;
    await K.scena(c.epilogo);
    const primo = !d.progresso.completati.includes(n);
    if (primo) { d.progresso.completati.push(n); d.progresso.sbloccato = Math.max(d.progresso.sbloccato, Math.min(7, n + 1)); }
    const r = c.ricompensa, nuove = [];
    if (primo) {
      S().aggiungi('denari', r.denari); S().aggiungi('sigilli', r.sigilli);
      [r.voce, r.voce2, r.voce3].filter(Boolean).forEach(id => { const x = S().aggiungiVoce(id); nuove.push({ id, nuova: x.nuova, lv: x.lv }); });
    } else { S().aggiungi('denari', Math.round(r.denari / 2)); S().aggiungi('sigilli', 3); }
    d.run = null; S().save();
    const m = el('div', 'ricompensa-cap');
    m.innerHTML = `<h3>★ Capitolo ${c.num} completato</h3><p>${primo ? `Ricompense: <b>◎ ${r.denari}</b> · <b>❂ ${r.sigilli}</b>` : `Ripetizione: <b>◎ ${Math.round(r.denari / 2)}</b> · <b>❂ 3</b>`}</p>` +
      (nuove.length ? '<p>' + nuove.map(x => (x.nuova ? 'Nuova Voce: ' : 'Duplicato (Eco ' + x.lv + '): ') + '<b>' + E.VOCI[x.id].breve + '</b>').join('<br>') + '</p>' : '') +
      (primo && n < 7 ? `<p>Si apre il capitolo ${E.CAPITOLI[n].num}.</p>` : '');
    await new Promise(res => { E.UI.modale(m); const cb = $('#modale .pannello-modale > .btn:last-child'); if (cb) cb.onclick = () => { $('#modale').classList.remove('on'); res(); }; });
    if (n === 7) { const f = d.flag.finale || 'addolcire'; await K.scena('fine_' + f); }
    K.hub();
  };
})(typeof window !== 'undefined' ? window : globalThis);
