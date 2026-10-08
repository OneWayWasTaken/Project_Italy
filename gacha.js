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
    return { ok: true, risultati: out, banner: banner.id };
  };
  /** Evocazioni rimaste prima della ★5 garantita. */
  G.alla_garanzia = function (S, bannerId) { return Math.max(1, E.GACHA.PITY_HARD - ((S.data.gacha.pity || {})[bannerId] || 0)); };

  /* ===================================================================== */
  /* Interfaccia                                                           */
  /* ===================================================================== */
  const COL = { 5: '#ffd75e', 4: '#b58cf0', 3: '#8fb4e8' };
  G.ui = { banner: 'standard', ctx: null };

  G.ui.apri = function (ctx) {
    G.ui.ctx = ctx; G.ui.banner = G.ui.banner || 'standard';
    E.UI.mostra('gacha'); G.ui.disegna();
    $('#g-x1').onclick = () => G.ui.evoca(1); $('#g-x10').onclick = () => G.ui.evoca(10);
    $('#g-tassi').onclick = () => G.ui.tassi();
  };
  G.ui.disegna = function () {
    const S = E.Save, B = E.BANNER.find(b => b.id === G.ui.banner) || E.BANNER[0], g = E.GACHA;
    $('#g-valute').innerHTML = `<span class="val sigilli" data-tip="<b>Sigilli</b><br>Valuta delle evocazioni: si guadagna giocando.">❂ ${S.data.valute.sigilli}</span><span class="val denari" data-tip="<b>Denari</b><br>Servono nei negozi del dungeon.">◎ ${S.data.valute.denari}</span>`;
    const nav = $('#g-banner'); nav.innerHTML = '';
    E.BANNER.forEach(b => {
      const x = el('button', 'g-tab' + (b.id === B.id ? ' on' : ''), `<b>${b.nome}</b><small>${b.desc}</small>`); x.style.setProperty('--ac', b.colore);
      x.onclick = () => { G.ui.banner = b.id; G.ui.disegna(); }; nav.appendChild(x);
    });
    // Vetrina: Voci in evidenza (o un invito per il banner standard)
    const v = $('#g-vetrina'); v.innerHTML = ''; v.style.setProperty('--ac', B.colore);
    const ev = B.evidenza.length ? B.evidenza : ['scipione', 'leonardo', 'garibaldi', 'perlasca'];
    ev.forEach((id, i) => { const p = el('div', 'g-pedana'); p.style.setProperty('--i', i); p.appendChild(E.Arte.figura(id)); p.appendChild(el('div', 'g-nome', E.VOCI[id].breve + ' <small>' + '★'.repeat(E.VOCI[id].rarita) + '</small>')); v.appendChild(p); });
    const rest = G.alla_garanzia(S, B.id), pity = (S.data.gacha.pity || {})[B.id] || 0;
    $('#g-info').innerHTML = `<div class="g-pity"><span>★5 garantita tra <b>${rest}</b> evocazioni</span><div class="g-pity-barra"><i style="width:${Math.min(100, pity / g.PITY_HARD * 100)}%"></i><u style="left:${g.PITY_SOFT / g.PITY_HARD * 100}%"></u></div></div><div class="g-nota">${B.evidenza.length ? 'Nelle estrazioni ★4/★5 una Voce su due è tra quelle in evidenza.' : 'Banner standard: tutte le Voci.'} Evocazioni totali: ${S.data.gacha.evocazioni || 0}</div>`;
    $('#g-x1').disabled = S.data.valute.sigilli < g.COSTO_1; $('#g-x10').disabled = S.data.valute.sigilli < g.COSTO_10;
  };
  G.ui.tassi = function () {
    const g = E.GACHA, d = el('div');
    d.innerHTML = `<h3>Tassi di evocazione</h3><table class="tab-aff"><tr><th>Rarità</th><th>Probabilità</th><th>Voci</th></tr>
      ${[5, 4, 3].map(r => `<tr><td style="color:${COL[r]}">${'★'.repeat(r)}</td><td>${(g.RATE[r] * 100)}%</td><td>${Object.values(E.VOCI).filter(v => v.rarita === r).map(v => v.breve).join(', ')}</td></tr>`).join('')}</table>
      <p>• <b>Garanzia</b>: dopo ${g.PITY_SOFT} evocazioni senza ★5 la probabilità cresce del 6% a ogni evocazione; alla ${g.PITY_HARD}ª la ★5 è sicura.<br>• Ogni ×10 garantisce almeno una ★4.<br>• Un duplicato aumenta di 1 il <b>livello Eco</b> (max ${g.MAX_LV}): +5% PV per livello, +1 PM dal livello 3, +10 Sanità iniziale al 5. Al massimo il duplicato dà Denari.<br>• I Sigilli si guadagnano giocando: nessun acquisto con denaro reale.</p>`;
    E.UI.modale(d);
  };
  G.ui.evoca = async function (n) {
    const S = E.Save, r = G.evoca(S, G.ui.banner, n);
    if (!r.ok) { E.UI.modale(el('p', '', r.motivo)); return; }
    S.save(); G.ui.disegna();
    await G.ui.animazione(r.risultati);
    G.ui.disegna();
  };

  /** Animazione dell'evocazione: carica del sigillo (il colore anticipa la rarità migliore) → rivelazione delle carte. */
  G.ui.animazione = function (ris) {
    return new Promise(resolve => {
      const ov = $('#g-risultato'), best = Math.max(...ris.map(r => r.rarita)), col = COL[best];
      const Snd = E.UI.Snd, Fx = E.UI.Fx;
      ov.className = 'overlay on g-ov'; ov.innerHTML = '';
      const sig = el('div', 'g-sigillo'); sig.style.setProperty('--c', col);
      sig.innerHTML = '<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="100" cy="100" r="74" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 6"/><path d="M100 14 L112 88 L186 100 L112 112 L100 186 L88 112 L14 100 L88 88 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="100" cy="100" r="16" fill="currentColor"/></svg>';
      ov.appendChild(sig);
      const testo = el('div', 'g-carica', 'Gli Echi rispondono…'); ov.appendChild(testo);
      Snd.sfx('clash');
      setTimeout(() => {
        Fx.flash(col, 0.6); Fx.ring(innerWidth / 2, innerHeight / 2, col, 260); Fx.sparks(innerWidth / 2, innerHeight / 2, 60, col, 1.6); Snd.sfx(best === 5 ? 'vittoria' : 'forte');
        sig.classList.add('esplode'); testo.remove();
        setTimeout(() => { sig.remove(); mostraCarte(); }, 450);
      }, 1500);
      const carte = el('div', 'g-carte g' + ris.length);
      function mostraCarte() {
        ov.appendChild(carte);
        const els = ris.map(r => {
          const v = E.VOCI[r.id], c = el('div', 'g-carta r' + r.rarita); c.style.setProperty('--c', COL[r.rarita]);
          const f = el('div', 'g-faccia');
          const fig = el('div', 'g-fig'); fig.appendChild(E.Arte.figura(r.id)); f.appendChild(fig);
          f.appendChild(el('div', 'g-nome2', v.breve)); f.appendChild(el('div', 'g-stelle', '★'.repeat(r.rarita)));
          f.appendChild(el('div', 'g-stato ' + (r.nuova ? 'nuova' : r.max ? 'max' : 'dup'), r.nuova ? 'NUOVA!' : r.max ? 'MAX · +' + r.denari + ' ◎' : 'Eco Lv ' + r.lv));
          c.appendChild(el('div', 'g-dorso', '❂')); c.appendChild(f); carte.appendChild(c); return c;
        });
        let i = 0;
        const passo = () => {
          if (i >= els.length) { fine(); return; }
          const c = els[i], r = ris[i]; i++;
          c.classList.add('gira'); Snd.sfx(r.rarita === 5 ? 'vittoria' : r.rarita === 4 ? 'forte' : 'moneta');
          const b = c.getBoundingClientRect();
          if (r.rarita >= 4) { Fx.sparks(b.left + b.width / 2, b.top + b.height / 2, r.rarita === 5 ? 50 : 24, COL[r.rarita], r.rarita === 5 ? 1.4 : 0.9); Fx.ring(b.left + b.width / 2, b.top + b.height / 2, COL[r.rarita], 120); }
          if (r.rarita === 5) { Fx.flash('#ffd75e', 0.35); const bn = el('div', 'banner', 'LEGGENDARIA'); document.getElementById('app').appendChild(bn); setTimeout(() => bn.remove(), 1700); }
          setTimeout(passo, ris.length === 1 ? 300 : r.rarita === 5 ? 900 : 380);
        };
        setTimeout(passo, 350);
      }
      function fine() {
        const nuove = ris.filter(r => r.nuova).length, dup = ris.filter(r => !r.nuova).length;
        const b = el('button', 'btn grande', 'Continua');
        const riga = el('div', 'g-riepilogo', `${nuove} nuove Voci · ${dup} duplicati` + (ris.some(r => r.denari) ? ' · duplicati al massimo convertiti in Denari' : ''));
        b.onclick = () => { ov.classList.remove('on'); resolve(); };
        ov.appendChild(riga); ov.appendChild(b);
      }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
