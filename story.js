/* ============================================================================
 * story.js — motore dei dialoghi stile visual novel.
 *
 * Una scena (E.SCENE[id], vedi data_scene.js) è una lista di passi: dialogo, narra, entra/esce, scelta (con flag ed
 * effetti), etichetta/vai, se/altrimenti, flag, effetto, fine. Il motore la esegue mostrando personaggi (le stesse
 * figure animate del combattimento), testo che si scrive, scelte numerate, registro dei dialoghi e salto veloce.
 *
 *   await E.Story.gioca('cap1_prologo', ctx)
 *   ctx = { save: E.Save, effetto(e) }   // effetto(e) applica pv/sanità/denari/oggetti… (lo fornisce la campagna)
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi = root.Echi || {};
  const S = E.Story = {};
  const $ = (s, r) => (r || document).querySelector(s);
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  S.stato = { palco: {}, log: [], skip: false, auto: false, attesa: null, scrittura: null };

  /* ---------- Valutazione delle condizioni sui flag ---------- */
  S.cond = function (save, c) {
    if (!c) return true;
    const f = save.data ? save.data.flag : save.flag;
    if (c.somma) return c.somma.filter(k => f[k] === c.eq).length >= (c.min || 1);
    return c.eq === undefined ? f[c.flag] === undefined : f[c.flag] === c.eq;
  };

  /** Dati di un parlante: nome, colore. */
  function attore(chi) {
    if (E.ATTORI[chi]) return E.ATTORI[chi];
    if (E.VOCI[chi]) return { nome: E.VOCI[chi].breve, colore: E.AFFINITA[E.VOCI[chi].aff].colore };
    if (E.NEMICI[chi]) return { nome: E.NEMICI[chi].breve + ' (Eco)', colore: E.NEMICI[chi].colore };
    return { nome: chi, colore: '#a99fb4' };
  }

  /* ---------- Palco ---------- */
  function imposta(sfondo) {
    const bg = $('#vn-sfondo'), pal = E.Arte.applicaPalette(bg, sfondo || 0);
    bg.innerHTML = '<div class="ms-bg"></div><div class="ms-floor"><div class="arena-disco"></div></div>';
    $('.ms-bg', bg).innerHTML = E.Arte.sfondo(sfondo || 0);
    E.UI.Fx.ambiente = pal.polvere;
    $('#vn-sx').innerHTML = ''; $('#vn-dx').innerHTML = ''; S.stato.palco = {};
  }
  function riposiziona() {
    ['sx', 'dx'].forEach(l => {
      const ids = Object.keys(S.stato.palco).filter(id => S.stato.palco[id].lato === l);
      ids.forEach((id, i) => { const p = S.stato.palco[id].el; p.style.setProperty('--i', i); p.style.setProperty('--n', ids.length); });
    });
  }
  function entra(id, lato) {
    if (S.stato.palco[id] || !E.ARTE[id]) return;
    lato = lato || (id === 'custode' ? 'sx' : 'dx');
    const p = el('div', 'vn-pg ' + lato); p.dataset.id = id;
    if (E.ARTE[id].scala) p.style.setProperty('--sc', Math.min(1.15, E.ARTE[id].scala));
    p.appendChild(E.Arte.figura(id));
    $(lato === 'sx' ? '#vn-sx' : '#vn-dx').appendChild(p);
    S.stato.palco[id] = { el: p, lato }; riposiziona();
    requestAnimationFrame(() => p.classList.add('in'));
  }
  function esce(id) {
    const x = S.stato.palco[id]; if (!x) return; x.el.classList.remove('in'); setTimeout(() => x.el.remove(), 400); delete S.stato.palco[id]; riposiziona();
  }
  function evidenzia(chi) {
    Object.keys(S.stato.palco).forEach(id => { const e = S.stato.palco[id].el; e.classList.toggle('parla', id === chi); e.classList.toggle('dim', !!chi && id !== chi); if (!chi) e.classList.add('dim'); });
  }

  /* ---------- Testo: macchina da scrivere ---------- */
  function scrivi(testo, velocita) {
    const box = $('#vn-testo'); box.textContent = '';
    return new Promise(res => {
      let i = 0; const v = S.stato.skip ? 0 : velocita;
      if (!v) { box.textContent = testo; res(); return; }
      clearInterval(S.stato.scrittura);
      S.stato.scrittura = setInterval(() => {
        i += 1 + (v > 1 ? 1 : 0); box.textContent = testo.slice(0, i);
        if (i >= testo.length) { clearInterval(S.stato.scrittura); S.stato.scrittura = null; res(); }
      }, 24);
      S.stato.completa = () => { clearInterval(S.stato.scrittura); S.stato.scrittura = null; box.textContent = testo; res(); };
    });
  }
  /** Attende il click/tasto del giocatore (o prosegue da solo in salto/auto). */
  function attendi() {
    const fr = $('#vn-avanti'); fr.classList.add('on');
    return new Promise(res => {
      let t = null;
      const vai = () => { fr.classList.remove('on'); S.stato.attesa = null; clearTimeout(t); res(); };
      S.stato.attesa = vai;
      if (S.stato.skip) t = setTimeout(vai, 40);
      else if (S.stato.auto) t = setTimeout(vai, 2200);
    });
  }
  /** Avanzamento: se il testo si sta ancora scrivendo lo completa, altrimenti passa oltre. */
  S.avanza = function () {
    if (S.stato.scrittura && S.stato.completa) { S.stato.completa(); return; }
    if (S.stato.attesa) S.stato.attesa();
  };

  /* ---------- Esecuzione dei passi ---------- */
  async function dialogo(chi, testo, ctx) {
    const a = attore(chi);
    if (chi !== 'narratore' && chi !== 'voce' && E.ARTE[chi] && !S.stato.palco[chi]) entra(chi);
    evidenzia(chi === 'narratore' || chi === 'voce' ? null : chi);
    const nm = $('#vn-nome'); nm.textContent = a.nome; nm.style.setProperty('--ac', a.colore || '#e0b43a'); nm.style.visibility = a.nome ? 'visible' : 'hidden';
    $('#vn-box').classList.toggle('narra', !a.nome);
    S.stato.log.push({ chi: a.nome, testo });
    await scrivi(testo, (ctx.save.data.opzioni.testo === undefined ? 1 : ctx.save.data.opzioni.testo));
    await attendi();
  }
  function scelta(passo, ctx) {
    return new Promise(res => {
      const box = $('#vn-scelte'); box.innerHTML = ''; box.classList.add('on'); S.stato.skip = false; $('#vn-skip').classList.remove('on');
      if (passo.domanda) box.appendChild(el('div', 'vn-domanda', passo.domanda));
      const opz = passo.opzioni.filter(o => S.cond(ctx.save, o.cond));
      const scegli = (o, idx) => { box.classList.remove('on'); box.innerHTML = ''; S.stato.scelta = null; res(o); };
      opz.forEach((o, i) => { const b = el('button', 'btn vn-opz', `<span class="n">${i + 1}</span>${o.testo}`); b.onclick = () => scegli(o, i); box.appendChild(b); });
      S.stato.scelta = i => { if (opz[i]) scegli(opz[i], i); };
    });
  }
  async function esegui(lista, ctx) {
    let pos = 0;
    while (pos < lista.length) {
      if (S.stato.abort) return { fine: true };
      const p = lista[pos++];
      switch (p.t) {
        case 'dialogo': await dialogo(p.chi, p.testo, ctx); break;
        case 'narra': await dialogo('narratore', p.testo, ctx); break;
        case 'entra': entra(p.id, p.lato); break;
        case 'esce': esce(p.id); break;
        case 'etichetta': break;
        case 'vai': { const k = lista.findIndex(x => x.t === 'etichetta' && x.nome === p.a); if (k >= 0) pos = k; else return { vai: p.a }; break; }
        case 'flag': Object.assign(ctx.save.data.flag, p.set); ctx.save.save(); break;
        case 'effetto': ctx.effetto && ctx.effetto(p); break;
        case 'scelta': {
          const o = await scelta(p, ctx);
          S.stato.log.push({ chi: 'Scelta', testo: o.testo });
          if (o.flag) Object.assign(ctx.save.data.flag, o.flag);
          (o.effetti || []).forEach(e => ctx.effetto && ctx.effetto(e));
          ctx.save.save();
          if (o.vai) { const k = lista.findIndex(x => x.t === 'etichetta' && x.nome === o.vai); if (k >= 0) pos = k; }
          break;
        }
        case 'se': {
          const r = await esegui(S.cond(ctx.save, p.cond) ? p.allora : p.altrimenti, ctx);
          if (r && r.vai) { const k = lista.findIndex(x => x.t === 'etichetta' && x.nome === r.vai); if (k >= 0) pos = k; else return r; }
          if (r && r.fine) return r;
          break;
        }
        case 'fine': return { fine: true };
      }
    }
    return { fine: false };
  }

  /** Esegue una scena dall'inizio alla fine. */
  S.gioca = async function (id, ctx) {
    const sc = E.SCENE[id]; if (!sc) { console.warn('Scena mancante', id); return; }
    S.stato.skip = false; S.stato.abort = false; S.stato.log = []; S.stato.auto = false;
    E.UI.mostra('storia');
    $('#vn-titolo').textContent = sc.titolo || ''; $('#vn-skip').classList.remove('on'); $('#vn-scelte').classList.remove('on');
    $('#vn-box').classList.add('nascosta'); imposta(sc.sfondo);
    await new Promise(r => setTimeout(r, 350));
    $('#vn-box').classList.remove('nascosta');
    try { await esegui(sc.passi, ctx); } catch (e) { console.error('Errore nella scena', id, e); }
    $('#vn-box').classList.add('nascosta'); evidenzia('__nessuno__');
    await new Promise(r => setTimeout(r, 250));
  };

  /** Cablaggio dei controlli (una sola volta). */
  S.init = function (ctxGlobale) {
    const root_ = $('#scr-storia');
    root_.addEventListener('click', e => { if (e.target.closest('button') || e.target.closest('.vn-scelte')) return; S.avanza(); });
    document.addEventListener('keydown', e => {
      if (!root_.classList.contains('active') || $('#modale').classList.contains('on')) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.avanza(); }
      else if (e.key >= '1' && e.key <= '4' && S.stato.scelta) S.stato.scelta(+e.key - 1);
      else if (e.key === 'Escape') S.stato.skip = false;
    });
    $('#vn-log').onclick = () => {
      const d = el('div', 'log-modale'); d.innerHTML = '<h3>Registro dei dialoghi</h3>' + S.stato.log.map(l => `<p><b>${l.chi || '—'}</b> ${l.testo}</p>`).join('');
      E.UI.modale(d);
    };
    $('#vn-skip').onclick = () => { S.stato.skip = !S.stato.skip; $('#vn-skip').classList.toggle('on', S.stato.skip); if (S.stato.skip) S.avanza(); };
    $('#vn-auto').onclick = () => { S.stato.auto = !S.stato.auto; $('#vn-auto').classList.toggle('on', S.stato.auto); if (S.stato.auto) S.avanza(); };
  };
})(typeof window !== 'undefined' ? window : globalThis);
