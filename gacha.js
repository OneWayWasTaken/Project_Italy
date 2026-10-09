/* ============================================================================
 * gacha.js — «Evocazioni»: banner, tassi, pity, evocazioni ×1 e ×10, duplicati che potenziano (livello Eco).
 *
 * Regole (E.GACHA in data_capitoli.js):
 *   ★5 = 5%, ★4 = 25%, ★3 = 70%. «Pity»: dopo 60 evocazioni senza ★5 la probabilità cresce del 6% a ogni evocazione;
 *   alla 80ª la ★5 è garantita. Ogni ×10 garantisce almeno una ★4. Nei banner a tema, metà delle volte la Voce
 *   della rarità estratta è una di quelle in evidenza. Un duplicato aumenta di 1 il livello Eco della Voce (max 5);
 *   al massimo il duplicato diventa Denari. Si paga solo con Sigilli guadagnati giocando (nessun acquisto reale).
 *
 * La logica (Gacha.evoca) è pura rispetto al DOM: riceve il salvataggio e restituisce i risultati.
 * Più sotto c'è l'interfaccia (schermata, animazione dell'evocazione, tabella dei tassi).
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi = root.Echi || {};
  const G = E.Gacha = { rng: Math.random };
  const $ = (s, r) => (r || document).querySelector(s);
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ===================================================================== */
  /* Logica                                                                */
  /* ===================================================================== */
  /** Probabilità di ★5 alla prossima evocazione, dato il pity corrente (n° di evocazioni senza ★5). */
  G.tassoCinque = function (pity) {
    const g = E.GACHA, n = pity + 1;
    if (n >= g.PITY_HARD) return 1;
    if (n > g.PITY_SOFT) return Math.min(1, g.RATE[5] + (n - g.PITY_SOFT) * 0.06);
    return g.RATE[5];
  };
  const pool = r => Object.values(E.VOCI).filter(v => v.rarita === r).map(v => v.id);

  /** Estrae una rarità. `garantito4`: forza almeno ★4 (ultima evocazione di un ×10 senza ★4+). */
  function estraiRarita(pity, garantito4) {
    const g = E.GACHA, r = G.rng(), p5 = G.tassoCinque(pity);
    if (r < p5) return 5;
    if (garantito4) return 4;
    const r2 = G.rng();
    return r2 < g.RATE[4] / (1 - g.RATE[5]) ? 4 : 3;
  }
  function estraiVoce(banner, rarita) {
    const ev = (banner.evidenza || []).filter(id => E.VOCI[id] && E.VOCI[id].rarita === rarita);
    if (ev.length && G.rng() < 0.5) return ev[Math.floor(G.rng() * ev.length)];
    const p = pool(rarita); return p[Math.floor(G.rng() * p.length)];
  }
  /** Evoca n volte (1 o 10) sul banner. Ritorna {ok, motivo?, risultati:[{id, rarita, nuova, lv, max, denari}]}. */
  G.evoca = function (S, bannerId, n) {
    const g = E.GACHA, banner = E.BANNER.find(b => b.id === bannerId) || E.BANNER[0];
    const costo = n === 10 ? g.COSTO_10 : g.COSTO_1 * n;
    if (!S.spendi('sigilli', costo)) return { ok: false, motivo: 'Sigilli insufficienti' };
    const d = S.data; d.gacha.pity = d.gacha.pity || {};
    let pity = d.gacha.pity[banner.id] || 0, haAlto = false; const out = [];
    for (let i = 0; i < n; i++) {
      const garantito4 = n === 10 && i === 9 && !haAlto;
      const rar = estraiRarita(pity, garantito4);
      if (rar >= 4) haAlto = true;
      pity = rar === 5 ? 0 : pity + 1;
      const id = estraiVoce(banner, rar), r = S.aggiungiVoce(id);
      const res = { id, rarita: rar, nuova: r.nuova, lv: r.lv, max: !!r.max, denari: 0 };
      if (r.max) { res.denari = 20 * rar; S.aggiungi('denari', res.denari); }
      out.push(res);
    }
    d.gacha.pity[banner.id] = pity; d.gacha.evocazioni = (d.gacha.evocazioni || 0) + n;
    d.gacha.frammenti = d.gacha.frammenti || {}; d.gacha.frammenti[banner.id] = (d.gacha.frammenti[banner.id] || 0) + n;
    // storico (ultime 80 evocazioni, la più recente per prima)
    d.gacha.storia = (out.map(r => ({ id: r.id, r: r.rarita, b: banner.id, t: Date.now() })).reverse().concat(d.gacha.storia || [])).slice(0, 80);
    return { ok: true, risultati: out, banner: banner.id };
  };
  /** Scambio: Denari → Sigilli (dà uno scopo ai Denari accumulati). */
  G.CAMBIO = 120;
  G.FRAMMENTI = 100;
  G.scambia = function (S, n) { if (!S.spendi('denari', G.CAMBIO * n)) return false; S.aggiungi('sigilli', n); S.save(); return true; };
  /** Evocazioni rimaste prima della ★5 garantita. */
  G.alla_garanzia = function (S, bannerId) { return Math.max(1, E.GACHA.PITY_HARD - ((S.data.gacha.pity || {})[bannerId] || 0)); };

  /* ===================================================================== */
  /* Interfaccia                                                           */
  /* ===================================================================== */
  const COL = { 5: '#ffd75e', 4: '#c79bff', 3: '#8fc4f0' };
  const NOME_R = { 5: 'Leggendaria', 4: 'Rara', 3: 'Comune' };
  G.ui = { banner: 'standard', ctx: null };

  G.ui.apri = function (ctx) {
    G.ui.ctx = ctx; G.ui.banner = G.ui.banner || 'standard';
    E.UI.mostra('gacha'); G.ui.disegna();
    $('#g-x1').onclick = () => G.ui.evoca(1); $('#g-x10').onclick = () => G.ui.evoca(10);
    $('#g-tassi').onclick = () => G.ui.tassi(); $('#g-storico').onclick = () => G.ui.storico(); $('#g-scambio').onclick = () => G.ui.scambio();
    if (E.UI.Fx) E.UI.Fx.ambiente = '255,225,160';
  };
  G.ui.valute = function () {
    const S = E.Save;
    $('#g-valute').innerHTML = `<span class="val sigilli" data-tip="<b>Sigilli</b><br>Valuta delle evocazioni: si guadagna giocando.">❂ ${S.data.valute.sigilli}</span><span class="val denari" data-tip="<b>Denari</b><br>Servono nei negozi delle spedizioni; si possono scambiare in Sigilli.">◎ ${S.data.valute.denari}</span>`;
  };
  G.ui.disegna = function () {
    const S = E.Save, B = E.BANNER.find(b => b.id === G.ui.banner) || E.BANNER[0], g = E.GACHA;
    G.ui.valute();
    const scr = $('#scr-gacha'); scr.style.setProperty('--ac', B.colore);
    $('#g-sfondo').innerHTML = `<div class="g-raggi"></div><div class="g-luna"></div><div class="g-velo"></div>`;
    const nav = $('#g-banner'); nav.innerHTML = '';
    E.BANNER.forEach(b => {
      const ev = b.evidenza.length ? b.evidenza : ['scipione', 'leonardo'];
      const x = el('button', 'g-tab' + (b.id === B.id ? ' on' : ''));
      x.style.setProperty('--ac', b.colore);
      x.appendChild(el('div', 'gt-sf', E.Arte.sfondo(E.VOCI[ev[0]].epoca - 1)));
      ev.slice(0, 2).forEach((id, j) => { const w = el('div', 'gt-fig'); w.style.right = (4 + j * 22) + '%'; w.appendChild(E.Arte.figura(id)); x.appendChild(w); });
      x.appendChild(el('div', 'g-tab-t', `<small>${b.evidenza.length ? 'Evocazione in evidenza' : 'Evocazione standard'}</small><b class="scritta">${b.nome}</b>`));
      x.onclick = () => { if (G.ui.banner !== b.id) { E.UI.Snd.sfx('ui'); G.ui.banner = b.id; G.ui.disegna(); } }; nav.appendChild(x);
    });
    // Vetrina: le Voci in evidenza in grande, su piedistalli, con nome e rarità
    const v = $('#g-vetrina'); v.innerHTML = '';
    $('.g-scena').style.backgroundImage = 'none'; $('#g-sfondo').querySelector('.g-velo').insertAdjacentHTML('beforebegin', `<div class="g-epoca">${E.Arte.sfondo(B.evidenza.length ? E.VOCI[B.evidenza[0]].epoca - 1 : 0)}</div>`);
    const ev = B.evidenza.length ? B.evidenza : ['scipione', 'leonardo', 'garibaldi', 'perlasca'];
    ev.forEach((id, i) => {
      const V = E.VOCI[id], a = E.AFFINITA[V.aff];
      const p = el('div', 'g-pedana' + (ev.length <= 2 ? ' grande' : '')); p.style.setProperty('--i', i); p.style.setProperty('--c', a.colore);
      const f = E.Arte.figura(id); p.appendChild(f);
      p.appendChild(el('div', 'g-nome', `<span class="g-aff" style="color:${a.colore}">${a.simbolo}</span>${V.breve}<small>${'★'.repeat(V.rarita)}</small>`));
      p.onclick = () => { if (E.Archivio && E.Archivio.scheda) E.Archivio.scheda(id); };
      p.dataset.tip = `<b>${V.nome}</b><br>${a.simbolo} ${a.nome} · ${V.ruolo}<br><small>Tocca per la scheda</small>`;
      v.appendChild(p);
      setTimeout(() => E.Arte.anima(f, 'grido', 1), 300 + i * 260);
    });
    const rest = G.alla_garanzia(S, B.id), pity = (S.data.gacha.pity || {})[B.id] || 0;
    $('#g-info').innerHTML = `<div class="g-titolo">${B.nome}</div><div class="g-desc">${B.desc}</div>
      <div class="g-pity"><span>★5 garantita entro <b>${rest}</b> evocazioni</span><div class="g-pity-barra"><i style="width:${Math.min(100, pity / g.PITY_HARD * 100)}%"></i><u style="left:${g.PITY_SOFT / g.PITY_HARD * 100}%" data-tip="Da qui la probabilità di ★5 cresce a ogni evocazione"></u></div></div>
      <div class="g-frammenti" data-tip="Ogni evocazione su questo banner dà 1 Frammento d'Eco. Con ${G.FRAMMENTI} Frammenti scegli una Voce in evidenza (o, nel banner standard, una ★5 a scelta).">Frammenti d'Eco <b>${(S.data.gacha.frammenti || {})[B.id] || 0}/${G.FRAMMENTI}</b><button class="btn piccolo" id="g-fr-scambia" ${((S.data.gacha.frammenti || {})[B.id] || 0) < G.FRAMMENTI ? 'disabled' : ''}>Scambia ▸</button></div>
      <div class="g-nota">${B.evidenza.length ? 'Nelle estrazioni ★4/★5 una Voce su due è tra quelle in evidenza.' : 'Banner standard: tutte le Voci con la stessa probabilità.'} · Evocazioni totali: ${S.data.gacha.evocazioni || 0}</div>`;
    const bf = $('#g-fr-scambia'); if (bf) bf.onclick = () => G.ui.scambiaFrammenti(B);
    $('#g-x1').disabled = S.data.valute.sigilli < g.COSTO_1; $('#g-x10').disabled = S.data.valute.sigilli < g.COSTO_10;
  };
  /** Scambio dei Frammenti d'Eco: scegli una Voce (in evidenza, o una ★5 nel banner standard). */
  G.ui.scambiaFrammenti = function (B) {
    const S = E.Save, lista = B.evidenza.length ? B.evidenza : Object.values(E.VOCI).filter(v => v.rarita === 5).map(v => v.id);
    const d = el('div'); d.innerHTML = `<h3>Scambio dei Frammenti</h3><p>Spendi ${G.FRAMMENTI} Frammenti d'Eco per una di queste Voci (se l'hai già, sale di un livello Eco).</p>`;
    const gr = el('div', 'sq-griglia'); gr.style.gridTemplateColumns = 'repeat(auto-fill,minmax(100px,1fr))';
    lista.forEach(id => { const v = E.VOCI[id], c = el('div', 'sq-card r' + v.rarita); c.style.setProperty('--ac', E.AFFINITA[v.aff].colore); c.appendChild(E.UI.ritratto(v)); c.appendChild(el('div', 'n', v.breve)); c.appendChild(el('div', 'stelle', '★'.repeat(v.rarita)));
      c.onclick = () => { const f = S.data.gacha.frammenti; if ((f[B.id] || 0) < G.FRAMMENTI) return; f[B.id] -= G.FRAMMENTI; const r = S.aggiungiVoce(id); if (r.max) S.aggiungi('denari', 100); S.save(); $('#modale').classList.remove('on'); E.UI.Snd.sfx('vittoria'); G.ui.disegna(); E.UI.modale(el('p', '', `<b>${v.breve}</b> ${r.nuova ? 'entra nel tuo Archivio!' : r.max ? 'è già al massimo: ricevi 100 Denari.' : 'sale al livello Eco ' + r.lv + '.'}`)); };
      gr.appendChild(c); });
    d.appendChild(gr); E.UI.modale(d);
  };
  G.ui.tassi = function () {
    const g = E.GACHA, d = el('div');
    d.innerHTML = `<h3>Tassi di evocazione</h3><table class="tab-aff"><tr><th>Rarità</th><th>Probabilità</th><th>Voci</th></tr>
      ${[5, 4, 3].map(r => `<tr><td style="color:${COL[r]}">${'★'.repeat(r)}</td><td>${(g.RATE[r] * 100)}%</td><td>${Object.values(E.VOCI).filter(v => v.rarita === r).map(v => v.breve).join(', ')}</td></tr>`).join('')}</table>
      <p>• <b>Garanzia</b>: dopo ${g.PITY_SOFT} evocazioni senza ★5 la probabilità cresce del 6% a ogni evocazione; alla ${g.PITY_HARD}ª la ★5 è sicura (il conteggio è separato per ogni banner).<br>• Ogni ×10 garantisce almeno una ★4.<br>• Un duplicato aumenta di 1 il <b>livello Eco</b> (max ${g.MAX_LV}): +5% PV per livello, +1 PM dal livello 3, +10 Sanità iniziale al 5. Al massimo il duplicato dà Denari.<br>• I Sigilli si guadagnano giocando (e scambiando Denari): nessun acquisto con denaro reale.</p>`;
    E.UI.modale(d);
  };
  G.ui.storico = function () {
    const st = E.Save.data.gacha.storia || [], d = el('div', 'g-storico');
    d.innerHTML = '<h3>Storico delle evocazioni</h3>' + (st.length ? '<div class="g-st-lista">' + st.map(x => { const V = E.VOCI[x.id], B = E.BANNER.find(b => b.id === x.b); return `<div class="g-st r${x.r}"><span class="st" style="color:${COL[x.r]}">${'★'.repeat(x.r)}</span><b>${V ? V.breve : x.id}</b><small>${B ? B.nome : ''}</small></div>`; }).join('') + '</div>' : '<p class="vuoto">Nessuna evocazione ancora.</p>');
    E.UI.modale(d);
  };
  G.ui.scambio = function () {
    const S = E.Save, d = el('div', 'g-scambio');
    const disegna = () => {
      d.innerHTML = `<h3>Scambio</h3><p>Il Custode può convertire i <b>Denari</b> raccolti nelle spedizioni in <b>Sigilli</b>.</p><p class="g-cambio">◎ ${G.CAMBIO} → ❂ 1</p><p>Hai ◎ ${S.data.valute.denari} · ❂ ${S.data.valute.sigilli}</p>`;
      const r = el('div', 'risultato-btn');
      [1, 5].forEach(n => { const b = el('button', 'btn' + (n === 5 ? ' grande' : ''), `Scambia ×${n}`); b.disabled = S.data.valute.denari < G.CAMBIO * n; b.onclick = () => { if (G.scambia(S, n)) { E.UI.Snd.sfx('moneta'); disegna(); G.ui.disegna(); } }; r.appendChild(b); });
      d.appendChild(r);
    };
    disegna(); E.UI.modale(d);
  };
  G.ui.evoca = async function (n) {
    const S = E.Save, r = G.evoca(S, G.ui.banner, n);
    if (!r.ok) { E.UI.modale(el('p', '', r.motivo + '. Guadagnali completando capitoli e spedizioni, o usa lo Scambio.')); return; }
    S.save(); G.ui.valute();
    await G.ui.animazione(r.risultati);
    G.ui.disegna();
  };

  /**
   * Animazione dell'evocazione, in tre atti:
   *  1. il sigillo si carica sul pavimento: parte azzurro e "sale" di colore se c'è una ★4 (viola) o una ★5 (oro);
   *  2. le carte arrivano coperte, con un bagliore del colore della rarità, e si girano una a una;
   *     una ★5 (o una Voce nuova ★4) interrompe la sequenza con la rivelazione a tutto schermo;
   *  3. riepilogo. Un tocco accelera; «Salta» porta subito al riepilogo.
   */
  G.ui.animazione = function (ris) {
    return new Promise(resolve => {
      const ov = $('#g-risultato'), best = Math.max(...ris.map(r => r.rarita));
      const Snd = E.UI.Snd, Fx = E.UI.Fx, W = () => innerWidth, H = () => innerHeight;
      let saltato = false, veloce = false, timers = [];
      const dopo = (ms, fn) => { const t = setTimeout(fn, veloce ? ms * 0.35 : ms); timers.push(t); return t; };
      ov.className = 'overlay on g-ov'; ov.innerHTML = '';
      const salta = el('button', 'btn piccolo g-salta', 'Salta ⏭'); ov.appendChild(salta);
      salta.onclick = e => { e.stopPropagation(); if (saltato) return; saltato = true; timers.forEach(clearTimeout); ov.querySelectorAll('.g-portale,.g-rivela').forEach(x => x.remove()); mostraCarte(true); };
      ov.onclick = () => { veloce = true; };

      // --- 1. Portale ---
      const port = el('div', 'g-portale'); port.style.setProperty('--c', COL[3]);
      port.innerHTML = `<div class="g-pav"></div><svg class="g-sig" viewBox="0 0 200 200"><circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 5"/>
        ${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6, x = 100 + Math.cos(a) * 87, y = 100 + Math.sin(a) * 87; return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="currentColor">${'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ'[i]}</text>`; }).join('')}
        <path d="M100 18 L113 87 L182 100 L113 113 L100 182 L87 113 L18 100 L87 87 Z" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="100" cy="100" r="18" fill="currentColor"/></svg>
        <div class="g-colonna"></div><div class="g-testo">Gli Echi rispondono…</div>`;
      ov.appendChild(port);
      Snd.sfx('clash');
      const sale = (r, t) => dopo(t, () => { if (saltato) return; port.style.setProperty('--c', COL[r]); port.classList.add('sale'); setTimeout(() => port.classList.remove('sale'), 300);
        Fx.flash(COL[r], 0.35); Fx.sparks(W() / 2, H() * 0.55, 30, COL[r], 1.2); Snd.sfx('rompi'); });
      if (best >= 4) sale(4, 1000);
      if (best >= 5) { sale(5, 1700); dopo(1750, () => { if (!saltato) port.classList.add('oro'); }); }
      dopo(best === 5 ? 2500 : best === 4 ? 1800 : 1300, () => {
        if (saltato) return;
        Fx.flash(COL[best], 0.7); Fx.ring(W() / 2, H() / 2, COL[best], 300); Fx.sparks(W() / 2, H() / 2, 80, COL[best], 1.8); Fx.flare(W() / 2, H() / 2, '#fff', 260);
        Snd.sfx(best === 5 ? 'vittoria' : 'forte'); port.classList.add('esplode');
        dopo(420, () => { port.remove(); mostraCarte(false); });
      });

      // --- 2. Carte ---
      const carte = el('div', 'g-carte g' + ris.length);
      let els = [];
      function costruisci() {
        ov.appendChild(carte);
        els = ris.map((r, i) => {
          const V = E.VOCI[r.id], a = E.AFFINITA[V.aff], c = el('div', 'g-carta r' + r.rarita);
          c.style.setProperty('--c', COL[r.rarita]); c.style.setProperty('--i', i); c.style.setProperty('--ac', a.colore);
          const f = el('div', 'g-faccia');
          const fig = el('div', 'g-fig'); fig.appendChild(E.Arte.figura(r.id)); f.appendChild(fig);
          f.appendChild(el('div', 'g-nome2', `<span style="color:${a.colore}">${a.simbolo}</span> ${V.breve}`)); f.appendChild(el('div', 'g-stelle', '★'.repeat(r.rarita)));
          f.appendChild(el('div', 'g-stato ' + (r.nuova ? 'nuova' : r.max ? 'max' : 'dup'), r.nuova ? 'NUOVA!' : r.max ? 'MAX · +' + r.denari + ' ◎' : 'Eco Lv ' + r.lv));
          c.appendChild(el('div', 'g-dorso', '<span>❂</span>')); c.appendChild(f); carte.appendChild(c); return c;
        });
      }
      function mostraCarte(subito) {
        if (!els.length) costruisci();
        if (subito) { els.forEach(c => c.classList.add('gira', 'arrivata')); fine(); return; }
        els.forEach((c, i) => setTimeout(() => c.classList.add('arrivata'), i * 60));
        let i = 0;
        const passo = () => {
          if (saltato) return;
          if (i >= els.length) { fine(); return; }
          const c = els[i], r = ris[i]; i++;
          const gira = () => {
            c.classList.add('gira'); Snd.sfx(r.rarita === 5 ? 'forte' : r.rarita === 4 ? 'stato' : 'moneta');
            const b = c.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
            if (r.rarita >= 4) { Fx.sparks(cx, cy, r.rarita === 5 ? 50 : 22, COL[r.rarita], r.rarita === 5 ? 1.4 : 0.9); Fx.ring(cx, cy, COL[r.rarita], 120); }
            dopo(300, passo);
          };
          // una ★5 (o una ★4 nuova) si presenta prima a tutto schermo, poi la carta si gira
          if (r.rarita === 5 || (r.rarita === 4 && r.nuova)) { c.classList.add('attesa'); dopo(350, () => rivela(r, gira)); }
          else gira();
        };
        dopo(ris.length === 1 ? 500 : 700, passo);
      }
      /** Rivelazione a tutto schermo di una Voce rara: figura che entra, nome, epoca, stelle. */
      function rivela(r, poi) {
        if (saltato) return;
        const V = E.VOCI[r.id], a = E.AFFINITA[V.aff], cap = E.CAPITOLI && E.CAPITOLI[V.epoca - 1];
        const d = el('div', 'g-rivela r' + r.rarita); d.style.setProperty('--c', COL[r.rarita]); d.style.setProperty('--ac', a.colore);
        d.innerHTML = `<div class="g-rv-raggi"></div><div class="g-rv-simbolo">${a.simbolo}</div><div class="g-rv-fig"></div>
          <div class="g-rv-testo"><div class="g-rv-rar">${NOME_R[r.rarita]} · ${'★'.repeat(r.rarita)}</div><div class="g-rv-nome">${V.breve}</div><div class="g-rv-full">${V.nome}</div>
          <div class="g-rv-info"><span style="color:${a.colore}">${a.simbolo} ${a.nome}</span> · ${V.ruolo}${cap ? ' · ' + cap.epoca : ''}</div>${r.nuova ? '<div class="g-rv-nuova">Nuova Voce nell\'Archivio</div>' : ''}</div>
          <div class="g-rv-tocca">tocca per continuare</div>`;
        const f = E.Arte.figura(r.id); d.querySelector('.g-rv-fig').appendChild(f);
        ov.appendChild(d); Fx.flash(COL[r.rarita], 0.5); Snd.sfx('vittoria');
        setTimeout(() => E.Arte.anima(f, 'grido', 0.8), 500);
        let chiusa = false;
        const chiudi = e => { if (e) e.stopPropagation(); if (chiusa) return; chiusa = true; d.classList.add('via'); setTimeout(() => { d.remove(); poi(); }, 300); };
        setTimeout(() => { d.onclick = chiudi; }, 700);
        dopo(3600, chiudi);
      }
      // --- 3. Riepilogo ---
      function fine() {
        if (ov.querySelector('.g-riepilogo')) return;
        const nuove = ris.filter(r => r.nuova).length, dup = ris.filter(r => !r.nuova).length;
        salta.remove();
        const box = el('div', 'g-riepilogo', `<b>${nuove}</b> nuove Voci · <b>${dup}</b> duplicati` + (ris.some(r => r.denari) ? ' · duplicati al massimo convertiti in Denari' : ''));
        const bt = el('div', 'risultato-btn');
        const b = el('button', 'btn grande', 'Continua'); b.onclick = e => { e.stopPropagation(); ov.classList.remove('on'); ov.onclick = null; resolve(); };
        const S = E.Save, g = E.GACHA, n = ris.length, costo = n === 10 ? g.COSTO_10 : g.COSTO_1;
        const b2 = el('button', 'btn', `Di nuovo ×${n} (❂ ${costo})`); b2.disabled = S.data.valute.sigilli < costo;
        b2.onclick = e => { e.stopPropagation(); ov.classList.remove('on'); ov.onclick = null; resolve(); setTimeout(() => G.ui.evoca(n), 50); };
        bt.append(b2, b); ov.append(box, bt);
      }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
