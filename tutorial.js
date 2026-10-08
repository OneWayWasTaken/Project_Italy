/* ============================================================================
 * tutorial.js — tutorial guidato (coach-mark con riflettore) e manuale "Come si gioca".
 *
 * Il tutorial è una battaglia speciale (E.INCONTRI.tutorial) durante la quale compaiono spiegazioni:
 *   - al 1° turno, in pianificazione: una sequenza di passi (E.TUTORIAL.passi) che evidenziano la UI;
 *   - durante la riproduzione: spiegazioni "reattive" la prima volta che accade qualcosa (E.TUTORIAL.reattivi).
 * In ogni momento il giocatore può premere «Salta tutorial»: lo stato (save.tutorial = 'saltato' | 'completato')
 * viene salvato e non verrà più riproposto (resta disponibile dal menu).
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi, T = E.Tutorial = {};
  const $ = (s, r) => (r || document).querySelector(s);
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  T.attivo = false; T.ctx = null; T.fatti = {}; T._pend = null; T._rect = null; T.inCombattimento = false; T._seq = 0;

  /** true se una spiegazione sta coprendo il gioco: gli input del gioco vanno ignorati. */
  T.bloccaInput = function () { const r = $('#tut'); return !!(T.attivo && r && r.classList.contains('on') && r.classList.contains('info')); };

  /** Crea (una sola volta) gli elementi del riflettore. */
  function dom() {
    let r = $('#tut'); if (r) return r;
    r = el('div', 'tut');
    r.id = 'tut';
    r.innerHTML = '<div class="tut-blocco"></div><div class="tut-spot"></div><div class="tut-card"><div class="tut-titolo"></div><div class="tut-testo"></div><div class="tut-azioni"></div></div>';
    $('#app').appendChild(r);
    const loop = () => { if (T._rect) T._posiziona(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    return r;
  }

  /** Avvia il tutorial (chiamato quando parte la battaglia-tutorial). */
  T.inizia = function (ctx) { T.attivo = true; T.ctx = ctx; T.fatti = {}; T.inCombattimento = false; T._seq++; dom(); };

  /** Chiude il tutorial: motivo 'saltato' | 'completato' (viene salvato). */
  T.ferma = function (motivo) {
    T.attivo = false; T._seq++;
    if (T.ctx && motivo) { T.ctx.save.tutorial = motivo; T.ctx.persist(); }
    T._nascondi();
    const p = T._pend; T._pend = null; if (p) p();
  };
  T.salta = function () { T.ferma('saltato'); };

  T._nascondi = function () { const r = $('#tut'); if (r) r.className = 'tut'; T._rect = null; };

  /** Mostra un passo e attende «Avanti» (o, per i passi con azione, che il giocatore la compia). */
  T.mostra = function (p) {
    if (!T.attivo) return Promise.resolve();
    const r = dom();
    $('.tut-titolo', r).textContent = p.titolo;
    $('.tut-testo', r).innerHTML = p.testo;
    const az = $('.tut-azioni', r); az.innerHTML = '';
    const info = !p.azione;
    if (p.bottone === 'affinita') { const b = el('button', 'btn piccolo', 'Tabella affinità'); b.onclick = () => E.UI.tabellaAffinita(); az.appendChild(b); }
    const salta = el('button', 'btn piccolo tut-salta', 'Salta tutorial'); salta.onclick = () => T.salta(); az.appendChild(salta);
    const avanti = el('button', 'btn grande piccolo', p.azione ? 'Salta questo passo' : p.ultimo ? 'Fine' : 'Avanti'); avanti.onclick = () => { const f = T._pend; T._pend = null; f && f(); }; az.appendChild(avanti);
    r.className = 'tut on' + (info ? ' info' : ' azione') + (p.sel ? ' con-spot' : '');
    T._sel = p.sel || null; T._pos = p.pos || (p.sel ? 'sotto' : 'basso'); T._rect = true; T._posiziona();
    return new Promise(res => { T._pend = () => { T._nascondi(); res(); }; });
  };

  /** Posiziona riflettore e scheda in base all'elemento evidenziato. */
  T._posiziona = function () {
    const r = $('#tut'); if (!r || !r.classList.contains('on')) return;
    const spot = $('.tut-spot', r), card = $('.tut-card', r), W = root.innerWidth, H = root.innerHeight;
    let b = null;
    if (T._sel) { const x = document.querySelector(T._sel); if (x) { const bb = x.getBoundingClientRect(); if (bb.width > 0 && bb.height > 0) b = bb; } }
    if (b) {
      const m = 6; spot.style.display = 'block';
      spot.style.left = (b.left - m) + 'px'; spot.style.top = (b.top - m) + 'px'; spot.style.width = (b.width + 2 * m) + 'px'; spot.style.height = (b.height + 2 * m) + 'px';
    } else spot.style.display = 'none';
    const cw = Math.min(380, W - 20), ch = card.offsetHeight || 160;
    card.style.width = cw + 'px';
    let x = (W - cw) / 2, y = (H - ch) / 2;
    if (b) {
      if (T._pos === 'destra') { x = b.right + 14; y = b.top + b.height / 2 - ch / 2; }
      else if (T._pos === 'sinistra') { x = b.left - cw - 14; y = b.top + b.height / 2 - ch / 2; }
      else if (T._pos === 'sopra') { x = b.left + b.width / 2 - cw / 2; y = b.top - ch - 14; }
      else { x = b.left + b.width / 2 - cw / 2; y = b.bottom + 14; }
      // se non entra, la scheda va al centro dello schermo (senza coprire il riflettore quando possibile)
      if (x < 8 || x + cw > W - 8 || y < 8 || y + ch > H - 8) { x = (W - cw) / 2; y = b.top > H / 2 ? Math.max(8, b.top - ch - 12) : Math.min(H - ch - 8, b.bottom + 12); }
    } else if (T._pos === 'basso') { y = H - ch - Math.min(150, H * 0.3); }
    card.style.left = Math.max(8, Math.min(W - cw - 8, x)) + 'px'; card.style.top = Math.max(8, Math.min(H - ch - 8, y)) + 'px';
  };

  /** Sequenza dei passi in pianificazione (turno 1) + passo sulle affinità (turno 2). */
  T.pianifica = async function (turno, bat) {
    if (!T.attivo) return;
    const seq = T._seq;
    if (turno === 1 && !T.fatti.passi) {
      T.fatti.passi = true;
      for (const p of E.TUTORIAL.passi) {
        if (!T.attivo || seq !== T._seq || bat.fase !== 'pianifica') return;
        await T.mostra(p);
      }
    } else if (turno === 2 && !T.fatti.turno2) {
      T.fatti.turno2 = true; await T.mostra(E.TUTORIAL.turno2);
    }
  };

  /** L'interfaccia notifica un'azione del giocatore: sblocca i passi che la attendono. */
  T.notifica = function (nome) {
    if (!T.attivo) return;
    if (nome === 'esegui') T.inCombattimento = true;
    const cur = (E.TUTORIAL.passi.find(p => p.azione === nome));
    if (cur && T._pend && $('#tut').classList.contains('azione')) { const f = T._pend; T._pend = null; f(); }
  };

  /** Chiamato per ogni evento di combattimento durante la riproduzione: può fermare l'animazione per spiegare. */
  T.evento = async function (e) {
    if (!T.attivo || !T.inCombattimento) return;
    let k = null;
    switch (e.t) {
      case 'clash': k = 'clash'; break;
      case 'clash_fine': k = 'clash_fine'; break;
      case 'colpo': k = 'colpo'; break;
      case 'stato': k = 'stato'; break;
      case 'cedimento': k = 'cedimento'; break;
    }
    if (!k || T.fatti[k]) return;
    T.fatti[k] = true;
    const p = E.TUTORIAL.reattivi[k]; if (p) await T.mostra(p);
  };

  /** A fine battaglia: messaggio finale e chiusura (completato). */
  T.fine = async function () {
    if (!T.attivo) return;
    const p = Object.assign({ ultimo: true }, E.TUTORIAL.reattivi.fine);
    T.inCombattimento = true; await T.mostra(p); T.ferma('completato');
  };
})(typeof window !== 'undefined' ? window : globalThis);
