/* ============================================================================
 * archivio.js — «Archivio»: le Voci possedute (con livello Eco e anteprima delle animazioni di ogni skill)
 * e il Codex (schede storiche sbloccate dai capitoli, con la distinzione tra storia vera e parti inventate).
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi = root.Echi || {};
  const A = E.Archivio = { tab: 'voci', sel: null };
  const $ = (s, r) => (r || document).querySelector(s);
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  A.apri = function () { E.UI.mostra('archivio'); A.disegna(); };
  A.disegna = function () {
    const S = E.Save;
    $$tab();
    const corpo = $('#a-corpo'); corpo.innerHTML = '';
    if (A.tab === 'voci') voci(corpo, S); else codex(corpo, S);
    const n = Object.keys(S.data.roster).length, tot = Object.keys(E.VOCI).length;
    $('#a-conta').textContent = A.tab === 'voci' ? `${n}/${tot} Voci` : `${Object.keys(S.data.codex).length}/${Object.keys(E.CODEX).length} schede`;
  };
  function $$tab() { document.querySelectorAll('#scr-archivio .a-tab').forEach(b => { b.classList.toggle('on', b.dataset.tab === A.tab); b.onclick = () => { A.tab = b.dataset.tab; A.disegna(); }; }); }

  function voci(corpo, S) {
    const lay = el('div', 'a-layout'), g = el('div', 'sq-griglia a-griglia'), det = el('aside', 'sq-dettaglio a-dettaglio');
    Object.values(E.VOCI).sort((a, b) => a.epoca - b.epoca).forEach(v => {
      const ho = S.possiede(v.id), c = el('div', 'sq-card' + (ho ? '' : ' sconosciuta') + (A.sel === v.id ? ' sel' : ''));
      c.appendChild(E.UI.ritratto(v));
      c.appendChild(el('div', 'n', ho ? v.breve : '???'));
      c.appendChild(el('div', 'm', ho ? `<span style="color:${E.AFFINITA[v.aff].colore}">${E.AFFINITA[v.aff].simbolo} ${E.AFFINITA[v.aff].nome}</span> · Cap. ${E.CAPITOLI[v.epoca - 1].num}` : 'Non ancora evocata'));
      c.appendChild(el('div', 'stelle', ho ? '★'.repeat(v.rarita) : ''));
      if (ho && S.livello(v.id)) c.appendChild(el('div', 'eco-lv', 'Eco ' + S.livello(v.id)));
      c.onclick = () => { A.sel = v.id; A.disegna(); };
      g.appendChild(c);
    });
    lay.append(g, det); corpo.appendChild(lay);
    dettaglio(det, S);
  }
  function dettaglio(det, S) {
    const id = A.sel; if (!id) { det.appendChild(el('p', 'vuoto', 'Scegli una Voce per vederne i dettagli.')); return; }
    const v = E.VOCI[id], ho = S.possiede(id), a = E.AFFINITA[v.aff];
    if (!ho) { det.appendChild(el('h3', '', '???')); det.appendChild(el('p', 'vuoto', `Una Voce di ${a.nome}, del capitolo ${E.CAPITOLI[v.epoca - 1].num}. Si ottiene con le Evocazioni o completando capitoli della campagna.`)); return; }
    const lv = S.livello(id), fw = el('div', 'det-fig'), fig = E.Arte.figura(id); fw.appendChild(fig); det.appendChild(fw);
    det.appendChild(el('h3', '', v.nome));
    det.appendChild(el('small', '', `${E.CAPITOLI[v.epoca - 1].epoca} · ${v.ruolo} · <span style="color:${a.colore}">${a.simbolo} ${a.nome}</span> · ${'★'.repeat(v.rarita)}`));
    det.appendChild(el('p', '', `PV <b>${Math.round(v.pv * (1 + 0.05 * lv))}</b>${lv ? ` <small>(base ${v.pv})</small>` : ''} · Velocità <b>${v.vel[0]}–${v.vel[1]}</b>`));
    const pip = '<span class="eco-pips">' + Array.from({ length: E.GACHA.MAX_LV }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('') + '</span>';
    det.appendChild(el('div', 'skill-box', `<b>Livello Eco ${lv}/${E.GACHA.MAX_LV}</b> ${pip}<small>Ogni duplicato aumenta il livello: +5% PV per livello · +1 PM dal livello 3 ${lv >= 3 ? '✔' : ''} · +10 Sanità iniziale al livello 5 ${lv >= 5 ? '✔' : ''}</small>`));
    det.appendChild(el('div', 'skill-box', `<b>Passiva — ${v.passiva.nome}</b><small>${v.passiva.desc}</small>`));
    v.skills.forEach(sid => {
      const s = E.SKILL[sid], anim = E.ANIM_SKILL[sid] || 'fendente';
      const b = el('div', 'skill-box cliccabile', `<b>${s.nome}</b> <span style="color:var(--oro)">◆${s.costo}</span> <span class="anteprima">▶ anteprima</span>
        <small>${s.monete} monete · PB ${s.pb} · PM +${s.pm} · ${E.AFFINITA[s.aff].nome}</small><small>${E.descrizioneSkill(s).join('<br>') || '—'}</small>`);
      b.onclick = () => E.Arte.anima(fig, anim, 1);
      det.appendChild(b);
    });
    det.appendChild(el('small', 'vuoto', 'Tocca una skill per vedere la sua animazione. Voce romanzata: carattere e abilità sono inventati; nomi e fatti storici no.'));
  }
  function codex(corpo, S) {
    const w = el('div', 'a-codex');
    E.CAPITOLI.forEach((c, i) => {
      const sez = el('section', 'cx-sez'); sez.appendChild(el('h3', '', `Capitolo ${c.num} — ${c.epoca}`));
      Object.keys(E.CODEX).filter(k => E.CODEX[k].cap === i + 1).forEach(k => {
        const s = E.CODEX[k], ok = !!S.data.codex[k];
        sez.appendChild(el('div', 'cx-scheda' + (ok ? '' : ' bloccata'), ok ? `<h4>${s.titolo}</h4><p>${s.testo}</p><p class="cx-nota">Nel gioco: ${s.nota}</p>` : '<h4>Scheda non ancora sbloccata</h4><p>Completa il capitolo e scegli di «ricordare».</p>'));
      });
      w.appendChild(sez);
    });
    corpo.appendChild(w);
  }
})(typeof window !== 'undefined' ? window : globalThis);
