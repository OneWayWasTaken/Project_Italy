/* ============================================================================
 * art.js — personaggi SVG stilizzati con animazioni.
 *
 * Ogni personaggio/nemico è descritto da una tabella in data.js (E.ARTE[id]): corpo, colori, abito,
 * copricapo, arma, stile d'attacco, personalità di riposo… Questo modulo la trasforma in una figura
 * "a pezzi": ogni parte (testa, occhi, torso, braccia, gambe, mantello, arma) è un <div> con il suo
 * piccolo SVG. Le animazioni CSS agiscono sui <div> (trasformazioni accelerate dalla GPU), non sui
 * gruppi SVG: niente scatti né "tearing", anche con molti personaggi insieme.
 *
 *   struttura:  .fig > .fig-in > .f-tutto > [ .f-aura .f-mantello .f-gamba… .f-torso .f-braccio-b
 *                                              .f-testa(>.f-occhi,.f-viso) .f-braccio-a(>.f-arma) ]
 *
 * ANIMAZIONI (classi .a-xxx messe sulla .fig da Arte.anima): vedi Arte.ANIM per l'elenco completo.
 *
 * COME SOSTITUIRE UNA FIGURA CON UNO SPRITE TUO (vedi anche ARTE.md):
 *   in data.js, nella voce E.ARTE[id], aggiungi
 *      sprite: { src: 'img/scipione.png', w: 160, h: 240 }                   // immagine singola
 *      sprite: { src: 'img/scipione_sheet.png', w: 128, h: 192,              // sprite sheet
 *                anim: { idle:{riga:0,frame:4,fps:6}, attacco:{riga:1,frame:6,fps:14},
 *                        colpo:{riga:2,frame:2,fps:8}, ced:{riga:3,frame:2,fps:4}, morte:{riga:4,frame:5,fps:8} } }
 *   Nessun altro codice cambia: la UI chiede sempre Arte.figura()/Arte.busto()/Arte.anima().
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi = root.Echi || {};
  const Arte = E.Arte = {};

  /* ---------- Animazioni d'attacco ----------
   * dur: durata (s) · imp: momento d'impatto (0-1) · dist: come si avvicina al bersaglio
   *   vicino (corpo a corpo) | medio | lontano (a distanza) | carica (scatta addosso) | sul_posto
   * fx: effetto grafico all'impatto (vedi UI.battaglia.effettoImpatto) · n/gap: colpi multipli visivi */
  Arte.ANIM = {
    fendente:     { dur: 0.62, imp: 0.60, dist: 'vicino',  fx: 'taglio' },
    sweep:        { dur: 0.72, imp: 0.56, dist: 'vicino',  fx: 'taglio_o' },
    doppio:       { dur: 0.84, imp: 0.55, dist: 'vicino',  fx: 'x' },
    affondo:      { dur: 0.50, imp: 0.50, dist: 'vicino',  fx: 'raggi' },
    lungo:        { dur: 0.64, imp: 0.50, dist: 'vicino',  fx: 'raggi_forti' },
    salto:        { dur: 1.00, imp: 0.62, dist: 'vicino',  fx: 'onda' },
    turbine:      { dur: 1.00, imp: 0.50, dist: 'vicino',  fx: 'turbine' },
    carica:       { dur: 0.55, imp: 0.50, dist: 'carica',  fx: 'onda' },
    colpo_scudo:  { dur: 0.58, imp: 0.50, dist: 'vicino',  fx: 'raggi_forti' },
    sparo:        { dur: 0.55, imp: 0.42, dist: 'lontano', fx: 'proiettile' },
    sparo_rapido: { dur: 0.78, imp: 0.30, dist: 'lontano', fx: 'proiettile', n: 2, gap: 0.2 },
    sparo_mira:   { dur: 1.00, imp: 0.64, dist: 'lontano', fx: 'proiettile_forte' },
    lancio:       { dur: 0.62, imp: 0.55, dist: 'lontano', fx: 'proiettile' },
    lancio_alto:  { dur: 0.84, imp: 0.64, dist: 'lontano', fx: 'proiettile_arco' },
    benedizione:  { dur: 0.78, imp: 0.55, dist: 'medio',   fx: 'luce' },
    invocazione:  { dur: 1.00, imp: 0.58, dist: 'medio',   fx: 'luce_forte' },
    preghiera:    { dur: 0.70, imp: 0.50, dist: 'medio',   fx: 'luce' },
    ele_carica:   { dur: 0.72, imp: 0.55, dist: 'carica',  fx: 'onda' },
    ele_barrito:  { dur: 0.95, imp: 0.65, dist: 'medio',   fx: 'onda' },
    ele_pestone:  { dur: 0.84, imp: 0.60, dist: 'vicino',  fx: 'onda' },
    hit:          { dur: 0.38 },
    vittoria:     { dur: 1.20 }
  };
  // Compatibilità con le versioni precedenti
  Arte.DURATA = {}; Arte.IMPATTO = {};
  Object.keys(Arte.ANIM).forEach(k => { Arte.DURATA[k] = Arte.ANIM[k].dur; Arte.IMPATTO[k] = Arte.ANIM[k].imp; });

  /* ---------- Colori e utilità ---------- */
  const OUT = 'stroke="#1b1422" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"';
  function mix(a, b, t) {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const x = p(a), y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const scuro = (c, t) => mix(c, '#000000', t == null ? 0.35 : t);
  const chiaro = (c, t) => mix(c, '#ffffff', t == null ? 0.3 : t);
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

  /** Un "pezzo" della figura: <div> animabile con il suo SVG (viewBox comune a tutta la figura). */
  function pezzo(vb, cls, ox, oy, inner, figli, stile) {
    const po = ((ox - vb.x) / vb.w * 100).toFixed(2) + '% ' + ((oy - vb.y) / vb.h * 100).toFixed(2) + '%';
    return `<div class="p ${cls}" style="transform-origin:${po};${stile || ''}">` +
      (inner ? `<svg viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>` : '') + (figli || '') + '</div>';
  }
  const VB_UMANO = { x: 0, y: 0, w: 120, h: 190 };
  const VB_ELEFANTE = { x: -6, y: 0, w: 140, h: 190 };

  /* ---------- Dimensioni del corpo ---------- */
  // sw = mezza larghezza spalle, ww = mezza larghezza vita, gw = spessore arti
  const DIM = { m: { sw: 15, ww: 12, gw: 9 }, f: { sw: 12, ww: 9.5, gw: 8 }, g: { sw: 18, ww: 15, gw: 11 } };

  /* ---------- Abiti: ritornano il disegno del busto (+ gonne) e i colori di maniche/pantaloni ---------- */
  const T = d => `M${60 - d.sw} 58 Q60 51 ${60 + d.sw} 58 L${60 + d.ww} 106 L${60 - d.ww} 106 Z`;
  const ABITI = {
    tunica: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c1}" ${OUT}/><path d="M${60 - d.ww - 2} 104 L${60 + d.ww + 2} 104 L${60 + d.ww + 6} 132 L${60 - d.ww - 6} 132 Z" fill="${c1}" ${OUT}/>
            <rect x="${60 - d.ww - 6}" y="127" width="${2 * d.ww + 12}" height="5" fill="${c2}" ${OUT}/><rect x="${60 - d.ww}" y="99" width="${2 * d.ww}" height="6" fill="${c2}" ${OUT}/>`,
      manica: 'nuda', pant: 'nuda', stivale: '#7a5a3a'
    }),
    corazza: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c1}" ${OUT}/>
            <path d="M${60 - d.sw + 2} 58 Q60 52 ${60 + d.sw - 2} 58 L${60 + d.ww} 100 L${60 - d.ww} 100 Z" fill="${c2}" ${OUT}/>
            <path d="M52 66 Q60 72 68 66 M54 78 Q60 83 66 78 M56 90 Q60 94 64 90" stroke="${scuro(c2)}" stroke-width="1.1" fill="none"/>
            ${[0, 1, 2, 3, 4].map(i => `<rect x="${60 - d.ww - 3 + i * ((2 * d.ww + 6) / 5)}" y="102" width="${(2 * d.ww + 6) / 5 - 0.6}" height="22" rx="2" fill="${c1}" ${OUT}/>`).join('')}
            <rect x="${60 - d.ww}" y="99" width="${2 * d.ww}" height="5" fill="${scuro(c2, 0.25)}" ${OUT}/>
            <circle cx="${60 - d.sw + 1}" cy="59" r="5.5" fill="${c2}" ${OUT}/><circle cx="${60 + d.sw - 1}" cy="59" r="5.5" fill="${c2}" ${OUT}/>`,
      manica: 'nuda', pant: 'nuda', stivale: '#5a3a22'
    }),
    toga: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c1}" ${OUT}/><path d="M${60 - d.ww - 3} 104 L${60 + d.ww + 3} 104 L${60 + d.ww + 8} 150 L${60 - d.ww - 8} 150 Z" fill="${c1}" ${OUT}/>
            <path d="M${60 - d.sw} 58 L${60 + d.sw - 4} 58 L${60 + d.ww + 8} 150 L${60 + 2} 150 Z" fill="${chiaro(c1, 0.4)}" ${OUT}/>
            <path d="M${60 - d.sw} 58 L${60 + d.sw - 4} 58 L${60 + d.ww + 8} 150" stroke="${c2}" stroke-width="2.6" fill="none"/>`,
      manica: c1, pant: 'nuda', stivale: '#8a6a40'
    }),
    veste_lunga: (c1, c2, d) => ({
      svg: `<path d="M${60 - d.ww} 100 L${60 + d.ww} 100 L${60 + d.ww + 16} 178 L${60 - d.ww - 16} 178 Z" fill="${c1}" ${OUT}/>
            <path d="${T(d)}" fill="${c1}" ${OUT}/>
            <path d="M60 58 L60 178" stroke="${scuro(c1, 0.25)}" stroke-width="1"/>
            <rect x="${60 - d.ww}" y="97" width="${2 * d.ww}" height="6" fill="${c2}" ${OUT}/>
            <path d="M${60 - d.ww - 16} 172 L${60 + d.ww + 16} 172 L${60 + d.ww + 17} 178 L${60 - d.ww - 17} 178 Z" fill="${c2}" ${OUT}/>
            <path d="M54 56 L60 66 L66 56" fill="${c2}" ${OUT}/>`,
      manica: c1, pant: c1, stivale: c1, nascondiGambe: true
    }),
    gonna: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c1}" ${OUT}/><path d="M${60 - d.ww} 100 L${60 + d.ww} 100 L${60 + d.ww + 12} 150 L${60 - d.ww - 12} 150 Z" fill="${c2}" ${OUT}/>
            <path d="M52 56 Q60 64 68 56" fill="none" stroke="${scuro(c1)}" stroke-width="1.2"/>`,
      manica: c1, pant: 'nuda', stivale: '#2a1d14'
    }),
    giubba: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c1}" ${OUT}/><path d="M54 56 L60 72 L66 56 Z" fill="#e9e1cf" ${OUT}/>
            <rect x="${60 - d.ww}" y="99" width="${2 * d.ww}" height="6" fill="#2a1d14" ${OUT}/>`,
      manica: c1, pant: c2, stivale: '#2a1d14'
    }),
    uniforme: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c1}" ${OUT}/><rect x="${60 - d.ww}" y="98" width="${2 * d.ww}" height="6" fill="${c2}" ${OUT}/>
            <path d="M${60 - d.sw + 3} 58 L${60 + d.ww} 100" stroke="${c2}" stroke-width="3"/>
            <rect x="${60 - d.sw + 5}" y="74" width="7" height="8" fill="${scuro(c1, 0.15)}" ${OUT}/><rect x="${60 + 4}" y="74" width="7" height="8" fill="${scuro(c1, 0.15)}" ${OUT}/>
            <path d="M${60 - d.ww - 2} 104 L${60 + d.ww + 2} 104 L${60 + d.ww + 4} 122 L${60 - d.ww - 4} 122 Z" fill="${c1}" ${OUT}/>`,
      manica: c1, pant: c1, stivale: c2, fasce: true
    }),
    abito_nero: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c2}" ${OUT}/><path d="M54 58 L60 100 L66 58 Z" fill="${c1}" ${OUT}/>
            <path d="M${60 - d.ww} 100 L${60 - d.ww - 4} 142 L60 128 L${60 + d.ww + 4} 142 L${60 + d.ww} 100 Z" fill="${c2}" ${OUT}/>
            <path d="M56 56 L60 64 L64 56 Z" fill="${c1}" ${OUT}/>`,
      manica: c2, pant: c2, stivale: '#0e0c12'
    }),
    tuta: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c1}" ${OUT}/><rect x="${60 - d.ww - 1}" y="78" width="${2 * d.ww + 2}" height="6" fill="${c2}"/>
            <path d="M${60 - d.ww} 100 L${60 + d.ww} 100 L${60 + d.ww + 3} 128 L${60 - d.ww - 3} 128 Z" fill="${scuro(c1, 0.45)}" ${OUT}/>`,
      manica: c1, pant: 'nuda', stivale: '#e8e2d0'
    }),
    cotta: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c1}" ${OUT}/>
            <path d="M${60 - d.ww} 62 L${60 + d.ww} 62 L${60 + d.ww + 4} 140 L${60 - d.ww - 4} 140 Z" fill="${c2}" ${OUT}/>
            <rect x="${60 - d.ww}" y="99" width="${2 * d.ww}" height="5" fill="${scuro(c2)}" ${OUT}/>`,
      manica: c1, pant: c1, stivale: '#2e2a30'
    }),
    armatura: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c1}" ${OUT}/>
            <path d="M${60 - d.ww} 70 L${60 + d.ww} 70 M${60 - d.ww} 82 L${60 + d.ww} 82 M${60 - d.ww} 94 L${60 + d.ww} 94" stroke="${scuro(c1)}" stroke-width="1.2"/>
            ${[0, 1, 2, 3].map(i => `<path d="M${60 - d.ww - 4 + i * (d.ww * 0.5 + 2)} 104 l${d.ww * 0.5 + 2} 0 l-1 22 l-${d.ww * 0.5} 0 z" fill="${c1}" ${OUT}/>`).join('')}
            <rect x="${60 - d.ww}" y="99" width="${2 * d.ww}" height="6" fill="${c2}" ${OUT}/>
            <circle cx="${60 - d.sw + 1}" cy="59" r="6.5" fill="${c2}" ${OUT}/><circle cx="${60 + d.sw - 1}" cy="59" r="6.5" fill="${c2}" ${OUT}/>`,
      manica: c1, pant: scuro(c1, 0.2), stivale: scuro(c1, 0.4)
    }),
    civile: (c1, c2, d) => ({
      svg: `<path d="${T(d)}" fill="${c1}" ${OUT}/>
            <path d="M${60 - d.ww - 1} 100 L${60 - d.ww - 5} 140 L${60 + d.ww + 5} 140 L${60 + d.ww + 1} 100 Z" fill="${c1}" ${OUT}/>
            <path d="M54 56 L60 80 L66 56" fill="#e9e1cf" ${OUT}/><path d="M52 58 L58 84 L50 70 Z M68 58 L62 84 L70 70 Z" fill="${scuro(c1, 0.15)}" ${OUT}/>
            <path d="M60 84 L60 138" stroke="${scuro(c1, 0.3)}" stroke-width="1"/>`,
      manica: c1, pant: c2, stivale: '#15121a'
    })
  };


  /* ---------- Armi e oggetti in mano (disegnati con l'impugnatura in (0,0), puntando verso il basso, lungo +y) ---------- */
  const ARMI = {
    gladio: (c1, c2) => ({ svg: `<rect x="-5" y="2" width="10" height="3" fill="#7a5a2a" ${OUT}/><path d="M-2.2 5 L2.2 5 L2.2 28 L0 33 L-2.2 28 Z" fill="#d6dde6" ${OUT}/><rect x="-1.6" y="-4" width="3.2" height="7" fill="#5a3a22"/>`, lampo: 0 }),
    sciabola: () => ({ svg: `<rect x="-5" y="2" width="10" height="3" fill="#8a6a2a" ${OUT}/><path d="M-1.6 5 Q9 16 5 38 L2.6 37 Q5 17 1.6 6 Z" fill="#d6dde6" ${OUT}/><rect x="-1.6" y="-4" width="3.2" height="7" fill="#3a2a1a"/>`, lampo: 0 }),
    lancia: () => ({ svg: `<rect x="-1.3" y="-26" width="2.6" height="84" fill="#7a5a32" ${OUT}/><path d="M-4 58 L0 74 L4 58 Z" fill="#cfd6df" ${OUT}/>`, lampo: 0 }),
    bastone: () => ({ svg: `<rect x="-1.6" y="-18" width="3.2" height="62" rx="1.5" fill="#6a4a2a" ${OUT}/>`, lampo: 0 }),
    archibugio: () => ({ svg: `<rect x="-2.6" y="-8" width="5.2" height="14" rx="2" fill="#6a4a2a" ${OUT}/><rect x="-1.8" y="4" width="3.6" height="34" fill="#4a4a54" ${OUT}/><circle cx="3" cy="2" r="2" fill="#8a8a94"/>`, lampo: 40 }),
    pistola: () => ({ svg: `<rect x="-2.4" y="-4" width="4.8" height="9" rx="1.5" fill="#5a3a22" ${OUT}/><rect x="-1.8" y="3" width="3.6" height="13" fill="#3c3c48" ${OUT}/>`, lampo: 17 }),
    falco: () => ({ svg: `<rect x="-5" y="-3" width="10" height="9" rx="3" fill="#6a4a2a" ${OUT}/><path d="M-9 6 Q0 -4 10 6 Q4 12 0 14 Q-6 12 -9 6 Z" fill="#8a6038" ${OUT}/><path d="M-6 9 Q0 3 6 9" stroke="#d9c9a0" stroke-width="1.6" fill="none"/><circle cx="1" cy="8" r="1" fill="#111"/><path d="M0 14 L-3 22 L3 22 Z" fill="#6a4a2a" ${OUT}/>`, lampo: 0 }),
    libro: (c1) => ({ svg: `<rect x="-6" y="1" width="12" height="16" rx="1.5" fill="${c1 || '#7a3030'}" ${OUT}/><rect x="-4.5" y="3" width="9" height="12" fill="#efe6cc"/>`, lampo: 0 }),
    compasso: () => ({ svg: `<rect x="-6" y="0" width="12" height="15" rx="1.5" fill="#5a3a22" ${OUT}/><rect x="-4.5" y="2" width="9" height="11" fill="#efe6cc"/><path d="M2 10 L-6 32 M2 10 L10 32" stroke="#b8923a" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="2" cy="10" r="2" fill="#d9b44a"/>`, lampo: 0 }),
    rotolo: () => ({ svg: `<rect x="-4" y="-2" width="8" height="24" rx="4" fill="#e9e1c8" ${OUT}/><rect x="-5" y="-2" width="10" height="4" rx="2" fill="#8a5a2a"/><rect x="-5" y="18" width="10" height="4" rx="2" fill="#8a5a2a"/>`, lampo: 0 }),
    lettera: () => ({ svg: `<rect x="-8" y="2" width="16" height="11" fill="#f2ecd8" ${OUT}/><path d="M-8 2 L0 9 L8 2" fill="none" stroke="#1b1422" stroke-width="1"/><circle cx="0" cy="9" r="1.8" fill="#b02a2a"/>`, lampo: 0 }),
    cartella: () => ({ svg: `<rect x="-8" y="2" width="16" height="20" rx="2" fill="#8a6a3a" ${OUT}/><rect x="-8" y="9" width="16" height="3" fill="#5a4222"/>`, lampo: 0 }),
    palma: () => ({ svg: `<rect x="-1" y="-10" width="2" height="40" fill="#5a7a2a"/>${[6, 14, 22, 30].map(y => `<path d="M0 ${y} Q-10 ${y - 4} -12 ${y - 12} Q-3 ${y - 8} 0 ${y} M0 ${y} Q10 ${y - 4} 12 ${y - 12} Q3 ${y - 8} 0 ${y}" fill="#7fa84a" ${OUT}/>`).join('')}`, lampo: 0 }),
    ruota: () => ({ svg: `<circle cx="0" cy="12" r="12" fill="none" stroke="#1b1422" stroke-width="3"/><circle cx="0" cy="12" r="12" fill="none" stroke="#c9ccd6" stroke-width="1.4"/><path d="M0 0 L0 24 M-12 12 L12 12 M-8.5 3.5 L8.5 20.5 M8.5 3.5 L-8.5 20.5" stroke="#9a9ca8" stroke-width="0.8"/>`, lampo: 0 })
  };
  const SCUDI = {
    scutum: (c1, c2) => `<rect x="30" y="64" width="24" height="46" rx="8" fill="${c1}" ${OUT}/><circle cx="42" cy="87" r="5" fill="${c2}" ${OUT}/><path d="M42 66 L42 108" stroke="${c2}" stroke-width="1.5"/>`,
    clipeo: (c1, c2) => `<circle cx="42" cy="86" r="15" fill="${c1}" ${OUT}/><circle cx="42" cy="86" r="10" fill="none" stroke="${c2}" stroke-width="2"/><circle cx="42" cy="86" r="3.5" fill="${c2}" ${OUT}/>`
  };



  /* ---------- Capelli e barba ----------
   * Il volto guarda a destra (3/4). I capelli stanno SOPRA la fronte (mai sotto y≈29) e dietro l'orecchio:
   * `dietro` si disegna prima del torso/testa, `davanti` sulla testa. Gli occhi sono un pezzo a parte, sempre in cima. */
  function capelli(stile, c) {
    const calotta = `<path d="M47.5 33 Q45.5 20 59.5 19 Q74.5 19 74.5 31 Q69 27.5 62.5 27.3 Q55.5 27.3 51 31.5 L50 37 Z" fill="${c}" ${OUT}/>
      <path d="M52 22.5 Q60 19.5 68 23" stroke="${chiaro(c, 0.28)}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/>`;
    const basette = `<path d="M47.5 33 Q46 44 51.5 46.5 L52.5 37 Z" fill="${c}" ${OUT}/>`;
    switch (stile) {
      case 'lungo': return { dietro: `<path d="M47 27 Q37 50 44.5 68 Q53 73 66 67.5 L64 47 L52 40 Z" fill="${c}" ${OUT}/><path d="M44 52 Q47 62 52 68" stroke="${scuro(c, 0.3)}" stroke-width="1.2" fill="none"/>`, davanti: calotta + basette };
      case 'trecce': return { dietro: `<path d="M49 39 Q42 53 47 69" stroke="${c}" stroke-width="5.5" fill="none" stroke-linecap="round"/><path d="M49 39 Q42 53 47 69" stroke="${scuro(c, 0.35)}" stroke-width="1" fill="none" stroke-dasharray="2 3"/><circle cx="47.2" cy="70" r="2.4" fill="#c04040"/>`, davanti: calotta + basette };
      case 'raccolto': return { dietro: `<circle cx="51" cy="20.5" r="5.8" fill="${c}" ${OUT}/>`, davanti: calotta + basette };
      case 'riccio': return { dietro: `<g fill="${c}" ${OUT}><circle cx="47" cy="30" r="5.5"/><circle cx="45.5" cy="39" r="5"/><circle cx="51" cy="23.5" r="5.5"/></g>`,
        davanti: `<g fill="${c}" ${OUT}>${[[57, 22.5], [64, 21], [70.5, 24.5], [51, 26]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="5.4"/>`).join('')}</g>` };
      case 'calvo': return { dietro: '', davanti: `<path d="M47.5 33 Q46.5 27 50 25.5 Q49 31 49.5 37 Z" fill="${c}"/>` };
      default: return { dietro: '', davanti: calotta + basette };
    }
  }
  function barba(tipo, c) {
    switch (tipo) {
      case 'barba': return `<path d="M49.5 38 Q50 58 62 59 Q72 56 72.8 41 Q68 49.5 62 49.5 Q55 49.5 49.5 38 Z" fill="${c}" ${OUT}/><path d="M60 52 Q63 54 67 52" stroke="${scuro(c, 0.3)}" stroke-width="1" fill="none"/>`;
      case 'pizzo': return `<path d="M58 47.5 Q63 58 69 47.5 Q63.5 50.5 58 47.5 Z" fill="${c}" ${OUT}/>`;
      case 'baffi': return `<path d="M62 42.4 Q67.5 40.6 73 43 Q67.5 46.4 62 43.8 Z" fill="${c}" ${OUT}/>`;
      default: return '';
    }
  }

  /* ---------- Copricapi (c1 = principale, c2 = accento). Bordo inferiore SEMPRE sopra gli occhi (y ≤ 30). ---------- */
  const TESTE = {
    elmo_romano: (c1, c2) => `<path d="M47 31 Q46 13.5 60 13.5 Q74 13.5 74.5 30 L47 31 Z" fill="${c1}" ${OUT}/><rect x="46" y="29.2" width="29" height="3.2" rx="1.4" fill="${scuro(c1, 0.2)}" ${OUT}/>
      <path d="M47 32 L49.5 48 L54.5 34 Z" fill="${c1}" ${OUT}/><path d="M49 19 Q60 -2 71 19 L66.5 19 Q60 7 53.5 19 Z" fill="${c2}" ${OUT}/><path d="M52 18 Q60 13 68 18" stroke="${chiaro(c1, 0.4)}" stroke-width="1.2" fill="none" opacity=".7"/>`,
    elmo_cartaginese: (c1, c2) => `<path d="M47 31 Q46 13 60 13 Q74 13 74.5 30 L47 31 Z" fill="${c1}" ${OUT}/><rect x="46" y="29.2" width="29" height="3.2" rx="1.4" fill="${scuro(c1, 0.2)}" ${OUT}/>
      <path d="M52 17 Q53 -6 63 -1 Q58 5 64 17 Z" fill="${c2}" ${OUT}/><path d="M47 32 L50 50 L54.5 34 Z" fill="${c1}" ${OUT}/>`,
    elmo_medievale: (c1) => `<path d="M47 31 Q46 14 60 14 Q74 14 74.5 30 L47 31 Z" fill="${c1}" ${OUT}/><rect x="46" y="29.2" width="29" height="3" fill="${scuro(c1, 0.25)}" ${OUT}/><rect x="58.2" y="31" width="2.8" height="13" fill="${c1}" ${OUT}/><path d="M47 32 L49 46 L54 34 Z" fill="${c1}" ${OUT}/>`,
    alloro: (c1) => `<g fill="${c1}" ${OUT}>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => { const a = Math.PI * (1.0 + i * 0.105), x = 60.5 + 13.5 * Math.cos(a), y = 33 + 12.5 * Math.sin(a); return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.6" ry="1.9" transform="rotate(${(a * 180 / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join('')}</g>`,
    corona: (c1) => `<path d="M49 27 L50.5 16 L55 22.5 L60 13 L65 22.5 L69.5 16 L71 27 Z" fill="${c1}" ${OUT}/><circle cx="60" cy="21" r="1.7" fill="#c0303f"/>`,
    // il velo sta DIETRO la testa (non copre il volto); sopra resta solo la corona
    velo_corona: (c1) => ({ dietro: `<path d="M46 26 Q38 40 40 62 L47 74 L64 66 L62 44 L52 36 Z" fill="#e9e1cf" ${OUT}/>`,
      davanti: `<path d="M47.5 28 Q47 18 60 17 Q73 17 74 28 Q67 24.5 60 24.5 Q53 24.5 47.5 28 Z" fill="#e9e1cf" ${OUT}/><path d="M49 25 L50.5 16 L55 21.5 L60 12.5 L65 21.5 L69.5 16 L71 25 Z" fill="${c1}" ${OUT}/>` }),
    cappello_piuma: (c1, c2) => `<ellipse cx="58" cy="22.5" rx="16" ry="5.6" fill="${c1}" ${OUT} transform="rotate(-10 58 22.5)"/><path d="M69 21 Q86 10 88 27 Q80 19 71 25 Z" fill="${c2}" ${OUT}/>`,
    berretto: (c1) => `<path d="M46.5 31 Q47 14 66 17 Q79 20 74.5 31 Q60 25.5 46.5 31 Z" fill="${c1}" ${OUT}/>`,
    aviatore: (c1, c2) => `<path d="M46.5 33 Q45.5 15 60 15 Q74.5 15 74.5 31 L72 27.5 Q60 23.5 49.5 28.5 Z" fill="${c1}" ${OUT}/><path d="M46.5 33 L47 46 L52 40 Z" fill="${c1}" ${OUT}/>
      <rect x="52" y="21" width="21" height="6.5" rx="3.2" fill="${scuro(c1)}" ${OUT}/><circle cx="58" cy="24.3" r="3.3" fill="${c2}" ${OUT}/><circle cx="67" cy="24.3" r="3.3" fill="${c2}" ${OUT}/>`,
    fazzoletto: (c1) => `<path d="M46.5 34 Q45 14 60 14 Q74.5 14 74.5 30 Q66 25.5 60 25.5 Q54 25.5 46.5 34 Z" fill="${c1}" ${OUT}/><path d="M48 30 L38 52 L53 45 Z" fill="${c1}" ${OUT}/>`,
    fedora: (c1, c2) => `<path d="M50.5 24 Q50.5 9 61 9 Q71.5 9 71.5 24 Z" fill="${c1}" ${OUT}/><rect x="50.5" y="18" width="21" height="4.6" fill="${c2}"/><ellipse cx="61" cy="25" rx="18" ry="4.2" fill="${c1}" ${OUT}/>`,
    basco: (c1) => `<ellipse cx="58" cy="22" rx="15.5" ry="6.4" fill="${c1}" ${OUT} transform="rotate(-12 58 22)"/><circle cx="55" cy="15" r="1.7" fill="${c1}"/>`,
    cappellino_ciclista: (c1) => `<path d="M48.5 30 Q48.5 17 60 17 Q71.5 17 72.5 30 Z" fill="${c1}" ${OUT}/><path d="M70 28 L84 31 L70 33 Z" fill="${c1}" ${OUT}/>`,
    cappuccio: (c1) => `<path d="M43.5 48 Q41.5 10 60 10 Q78.5 10 77.5 48 L72 55 Q60 42 48 55 Z" fill="${c1}" ${OUT}/><path d="M50 28 Q60 22 71 28 L72 44 Q60 50 49 44 Z" fill="#0a0810"/>`,
    fascia: (c1) => `<path d="M47.5 28.5 Q60 22 73.5 28.5 L73.5 32 Q60 26 47.5 32 Z" fill="${c1}" ${OUT}/>`
  };

  /* ---------- Accessori e segni sul viso ---------- */
  function accessorio(nome, c, d) {
    switch (nome) {
      case 'catene': return `<g fill="none" stroke="#8a8a94" stroke-width="2"><circle cx="${60 + d.sw - 2}" cy="94" r="3.4"/><circle cx="${60 - d.sw + 2}" cy="94" r="3.4"/><path d="M${60 + d.sw + 1} 94 l5 5 m-4 -1 l4 6" /></g>`;
      case 'sciarpa': return `<path d="M50 52 Q60 60 70 52 L72 58 Q60 66 48 58 Z" fill="${c}" ${OUT}/><path d="M48 58 L36 78 L42 80 L52 62 Z" fill="${c}" ${OUT}/>`;
      default: return '';
    }
  }
  function sulViso(acc) {
    switch (acc) {
      case 'occhiali': return `<g fill="none" stroke="#1b1422" stroke-width="1.1"><circle cx="64.3" cy="36.8" r="3.9"/><circle cx="70.6" cy="36.8" r="3.2"/><path d="M68.2 36.6 L67.4 36.6"/><path d="M60.4 36.4 L50 35.5"/></g>`;
      case 'benda': return `<ellipse cx="70.6" cy="36.8" rx="3.6" ry="4" fill="#15101c"/><path d="M49 29 L74 40" stroke="#15101c" stroke-width="1.6"/>`;
      default: return '';
    }
  }

  /* ---------- Mantelli e gerla (dietro al corpo) ---------- */
  function mantello(spec, d) {
    const c = spec.mantello;
    return `<path d="M${60 - d.sw + 2} 56 Q${34 - d.sw / 2} 100 ${30 - d.sw / 2} 156 Q56 150 ${60 + d.ww} 120 L${60 + d.sw - 4} 56 Z" fill="${c}" ${OUT}/>
      <path d="M${60 - d.sw + 4} 60 Q${44 - d.sw / 2} 104 ${42 - d.sw / 2} 150" stroke="${scuro(c, 0.3)}" stroke-width="1" fill="none"/>`;
  }
  const GERLA = `<path d="M30 64 L46 64 L48 112 L28 112 Z" fill="#8a6a3a" ${OUT}/><path d="M30 76 L46 76 M29 88 L47 88 M28 100 L48 100" stroke="#5a4222" stroke-width="1.2"/><path d="M46 62 L58 60 M46 112 L52 104" stroke="#5a4222" stroke-width="2" fill="none"/>`;

  /* ---------- Figura umanoide (parti separate) ---------- */
  function umanoide(spec) {
    const vb = VB_UMANO, d = DIM[spec.corpo || 'm'];
    const pelle = spec.pelle || '#e6bf9f';
    const ab = spec.abito || { tipo: 'tunica', c1: '#999', c2: '#666' };
    const A = ABITI[ab.tipo](ab.c1, ab.c2, d);
    const manica = A.manica === 'nuda' ? pelle : (A.manica || ab.c1);
    const pant = A.pant === 'nuda' ? pelle : (A.pant || ab.c2);
    const xR = 60 + d.sw - 2, xL = 60 - d.sw + 2;
    const arto = (x1, y1, x2, y2, col) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#1b1422" stroke-width="${d.gw + 2.6}" stroke-linecap="round" fill="none"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${col}" stroke-width="${d.gw}" stroke-linecap="round" fill="none"/>
      <path d="M${x1 - d.gw * 0.22} ${y1 + 1} L${x2 - d.gw * 0.22} ${y2 - 1}" stroke="#fff" stroke-opacity=".2" stroke-width="${d.gw * 0.28}" stroke-linecap="round" fill="none"/>
      <path d="M${x1 + d.gw * 0.26} ${y1 + 1} L${x2 + d.gw * 0.26} ${y2 - 1}" stroke="#000" stroke-opacity=".22" stroke-width="${d.gw * 0.3}" stroke-linecap="round" fill="none"/>`;
    const gamba = (x0, x1) => `${arto(x0, 104, x1, 178, pant)}${A.fasce ? `<path d="M${x1 - 4} 160 L${x1 + 4} 164 M${x1 - 4} 168 L${x1 + 4} 172" stroke="${scuro(pant)}" stroke-width="1.4"/>` : ''}<path d="M${x1 - 5} 184 Q${x1 - 6} 177 ${x1 + 1} 177 Q${x1 + 6} 177 ${x1 + 10} 182 L${x1 + 10} 187 L${x1 - 5} 187 Z" fill="${A.stivale || '#222'}" ${OUT}/>`;
    const arma = spec.arma && ARMI[spec.arma] ? ARMI[spec.arma](spec.armaC1, spec.armaC2) : null;
    const cap = spec.capelli || {};
    const hair = capelli(cap.stile, cap.colore || '#3a2a1c');
    const bc = cap.colore || '#3a2a1c';
    let th = spec.testa && TESTE[spec.testa.tipo || spec.testa] ? TESTE[spec.testa.tipo || spec.testa](spec.testa.c1 || '#888', spec.testa.c2 || '#c33') : '';
    let thDietro = '';
    if (th && typeof th === 'object') { thDietro = th.dietro || ''; th = th.davanti || ''; }
    const occhio = spec.eco ? (spec.glow || '#ffd75e') : '#1b1422';
    const cappuccio = spec.testa && spec.testa.tipo === 'cappuccio';

    // Testa: collo + cranio a uovo (mento in avanti) + orecchio + naso, poi barba, capelli e copricapo
    const testa = `<rect x="55.5" y="44" width="9" height="13" fill="${pelle}" ${OUT}/><path d="M55.5 49 L64.5 49 L64.5 52 Q60 54 55.5 52 Z" fill="#000" opacity=".16"/>
      <path d="M48.5 33 Q47.5 21.5 59.5 21 Q72.5 21 73.5 32.5 Q74.5 40.5 70.5 45.5 Q65.5 50 59 48.5 Q49.5 46 48.5 33 Z" fill="${pelle}" ${OUT}/>
      <path d="M48.5 33 Q47.5 21.5 59.5 21 Q72.5 21 73.5 32.5 Q74.5 40.5 70.5 45.5 Q65.5 50 59 48.5 Q49.5 46 48.5 33 Z" fill="url(#gTesta)"/>
      <ellipse cx="50.6" cy="38.6" rx="2.3" ry="3.4" fill="${pelle}" ${OUT}/><path d="M73.2 36.8 Q77 40.2 73.2 42.4" fill="${pelle}" ${OUT}/>
      <path d="M65.6 44 Q68.4 45.4 71 43.8" stroke="#1b1422" stroke-width="1.1" fill="none" stroke-linecap="round"/><ellipse cx="67.4" cy="41.2" rx="2.7" ry="1.4" fill="#e0707a" opacity=".24"/>
      ${barba(cap.barba, bc)}${hair.davanti}${th}`;
    const occhi = spec.eco
      ? `<ellipse cx="64.3" cy="36.8" rx="2.4" ry="3" fill="${occhio}"/><ellipse cx="70.6" cy="36.8" rx="1.8" ry="3" fill="${occhio}"/>`
      : `<ellipse cx="64.3" cy="36.8" rx="2.5" ry="3.1" fill="#fff"/><ellipse cx="70.6" cy="36.8" rx="1.8" ry="3.1" fill="#fff"/>
         <circle cx="65.4" cy="37.2" r="1.7" fill="${occhio}"/><circle cx="71.3" cy="37.2" r="1.35" fill="${occhio}"/><circle cx="65.9" cy="36.4" r=".55" fill="#fff"/><circle cx="71.7" cy="36.4" r=".45" fill="#fff"/>
         <path d="M61.2 32.4 Q64.3 30.4 67.2 32.2 M68.4 32.6 Q70.8 31.2 73 32.8" stroke="${scuro(bc, 0.1)}" stroke-width="1.25" fill="none" stroke-linecap="round"/>`;
    const gambe = A.nascondiGambe || spec.eco ? '' :
      pezzo(vb, 'f-gamba f-gamba-b', xL + 6, 104, gamba(xL + 6, 52)) + pezzo(vb, 'f-gamba f-gamba-a', xR - 6, 104, gamba(xR - 6, 70));
    const coda = spec.eco ? pezzo(vb, 'f-coda', 60, 104, `<path d="M${60 - d.ww - 4} 104 Q${60 - d.ww - 8} 140 52 160 Q58 172 50 186 Q66 170 64 158 Q80 150 ${60 + d.ww + 4} 104 Z" fill="${mix(ab.c1, '#000', 0.25)}" opacity=".85"/>`) : '';
    const fx = arma && arma.lampo ? `<g class="f-lampo" transform="translate(0,${arma.lampo})"><path d="M0 -8 L3 -2 L9 0 L3 2 L0 8 L-3 2 L-9 0 L-3 -2 Z" fill="#fff3a0"/><circle r="4" fill="#ff9a2a"/></g>` : '';
    const scudo = spec.scudo ? SCUDI[spec.scudo.tipo](spec.scudo.c1, spec.scudo.c2) : '';
    const torsoSvg = `${A.svg}<path d="${T(d)}" fill="url(#gVert)"/><path d="${T(d)}" fill="url(#gOmbra)"/>${A.nascondiGambe ? `<path d="M${60 - d.ww} 100 L${60 + d.ww} 100 L${60 + d.ww + 16} 178 L${60 - d.ww - 16} 178 Z" fill="url(#gOmbra)"/>` : ''}${accessorio(spec.accessorio, spec.accessorioC || '#f0ece0', d)}`;

    const braccioA = pezzo(vb, 'f-braccio-a', xR, 60, `${arto(xR, 60, xR, 92, manica)}<circle cx="${xR}" cy="93" r="4.6" fill="${pelle}" ${OUT}/>`,
      arma ? pezzo(vb, 'f-arma', xR, 93, `<g transform="translate(${xR},93)">${arma.svg}${fx}</g>`) : '');
    const testaPezzo = pezzo(vb, 'f-testa', 60, 50, testa,
      pezzo(vb, 'f-occhi', 67, 37, occhi) + (spec.viso ? pezzo(vb, 'f-viso', 67, 37, sulViso(spec.viso)) : '') +
      (cappuccio && spec.eco ? pezzo(vb, 'f-occhi', 67, 37, `<ellipse cx="64.3" cy="37.2" rx="2.2" ry="2.8" fill="${occhio}"/><ellipse cx="70.6" cy="37.2" rx="1.8" ry="2.8" fill="${occhio}"/>`) : ''));
    return pezzo(vb, 'f-tutto', 60, 188,
      '', pezzo(vb, 'f-aura', 60, 100, `<circle cx="60" cy="100" r="46" fill="none" stroke="${spec.glow || '#ffd75e'}" stroke-width="3" opacity="0"/>`) +
      (spec.mantello ? pezzo(vb, 'f-mantello', xL + 4, 58, mantello(spec, d)) : '') +
      (spec.dorso === 'gerla' ? pezzo(vb, 'f-mantello', 46, 62, GERLA) : '') +
      (hair.dietro || thDietro ? pezzo(vb, 'f-testa f-capelli-d', 60, 50, thDietro + hair.dietro) : '') +
      gambe + coda +
      pezzo(vb, 'f-torso', 60, 106, torsoSvg) +
      pezzo(vb, 'f-braccio-b', xL, 60, `${arto(xL, 60, xL - 2, 92, manica)}<circle cx="${xL - 2}" cy="93" r="4.6" fill="${pelle}" ${OUT}/>${scudo}`) +
      testaPezzo + braccioA);
  }

  /* ---------- Elefante (nemico quadrupede) ---------- */
  function elefante(spec) {
    const vb = VB_ELEFANTE;
    const c = spec.pelle || '#8a8090', cs = scuro(c, 0.28);
    const zampa = (x, cls) => pezzo(vb, 'f-gamba ' + cls, x + 8, 128,
      `<path d="M${x} 126 L${x + 16} 126 L${x + 17} 180 Q${x + 8} 190 ${x - 1} 180 Z" fill="${cs}" ${OUT}/><path d="M${x + 1} 178 h4 M${x + 7} 180 h4 M${x + 13} 178 h3" stroke="#e9e1cf" stroke-width="2.4" stroke-linecap="round"/>`);
    const corpo = 'M10 112 Q8 76 48 72 Q92 70 104 96 Q112 122 98 138 L24 138 Q8 132 10 112 Z';
    return pezzo(vb, 'f-tutto', 60, 188, '',
      pezzo(vb, 'f-aura', 60, 110, `<circle cx="60" cy="110" r="70" fill="none" stroke="${spec.glow || '#c0303f'}" stroke-width="3" opacity="0"/>`) +
      zampa(14, 'f-gamba-b') + zampa(72, 'f-gamba-b') +
      pezzo(vb, 'f-mantello', 8, 96, `<path d="M10 96 Q-4 106 2 130" stroke="${cs}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="2" cy="132" r="3" fill="${cs}"/>`) +
      pezzo(vb, 'f-torso', 60, 150, `<path d="${corpo}" fill="${c}" ${OUT}/><path d="${corpo}" fill="url(#gVert)"/><path d="${corpo}" fill="url(#gOmbra)"/><path d="M30 90 Q44 84 56 90 M40 110 Q56 104 70 112" stroke="${cs}" stroke-width="1.2" fill="none" opacity=".6"/>`) +
      zampa(32, 'f-gamba-a') + zampa(90, 'f-gamba-a') +
      pezzo(vb, 'f-testa', 100, 96, `<path d="M96 78 Q122 66 128 96 Q132 112 124 124 Q118 156 128 176 Q116 182 112 168 Q106 140 104 124 L92 118 Z" fill="${c}" ${OUT}/>
        <path d="M112 98 Q122 100 126 112" stroke="${cs}" stroke-width="1.1" fill="none"/><path d="M110 112 Q124 114 128 126" stroke="${cs}" stroke-width="1.1" fill="none"/>
        <ellipse cx="94" cy="96" rx="15" ry="24" fill="${cs}" ${OUT}/><ellipse cx="96" cy="96" rx="9" ry="17" fill="${scuro(c, 0.1)}" opacity=".7"/>
        <path d="M114 118 Q132 124 134 106 Q124 114 112 108 Z" fill="#efe6cf" ${OUT}/>
        <circle cx="116" cy="94" r="2.6" fill="${spec.glow || '#ffd75e'}"/><circle cx="116" cy="94" r="1" fill="#1b1422"/>`));
  }


  /* ---------- Sprite sostitutivi ---------- */
  function sprite(spec) {
    const sp = spec.sprite, d = el('div', 'fig sprite-fig' + (spec.eco ? ' eco' : ''));
    const w = sp.w || 128, h = sp.h || 192;
    d.dataset.sprite = '1'; d.style.aspectRatio = w + ' / ' + h;
    const s = el('div', 'spr'); s.style.backgroundImage = 'url("' + sp.src + '")'; s.style.width = '100%'; s.style.height = '100%';
    if (sp.anim) s.classList.add('sheet');
    else { s.style.backgroundSize = 'contain'; s.style.backgroundRepeat = 'no-repeat'; s.style.backgroundPosition = 'bottom center'; }
    d.appendChild(s); d._sprite = sp;
    if (sp.anim) Arte._sheet(d, 'idle');
    return d;
  }
  /** Avvia un'animazione di sprite sheet: nome ∈ idle, attacco, colpo, ced, morte. */
  Arte._sheet = function (fig, nome, speed) {
    const sp = fig._sprite; if (!sp || !sp.anim) return 0;
    const a = sp.anim[nome] || sp.anim.idle; if (!a) return 0;
    const s = fig.firstChild, n = a.frame || 1;
    const all = Object.values(sp.anim);
    const N = sp.colonne || Math.max(...all.map(x => x.frame || 1)), R = sp.righe || Math.max(...all.map(x => (x.riga || 0) + 1));
    s.style.animation = 'none'; void s.offsetWidth;
    s.style.backgroundSize = (N * 100) + '% ' + (R * 100) + '%'; s.style.backgroundRepeat = 'no-repeat';
    s.style.backgroundPositionY = R > 1 ? ((a.riga || 0) / (R - 1) * 100) + '%' : '0%';
    s.style.setProperty('--to', N > 1 ? (n / (N - 1) * 100) + '%' : '0%');
    const loop = nome === 'idle' || nome === 'ced';
    const dur = n / (a.fps || 8) / (speed || 1);
    s.style.animation = `spr-steps ${dur}s steps(${n}) ${loop ? 'infinite' : '1 forwards'}`;
    return dur;
  };

  /** Costruisce l'elemento figura (corpo intero). `id` = id della Voce o del nemico. */
  Arte.figura = function (id, opz) {
    const spec = E.ARTE[id]; opz = opz || {};
    if (!spec) { const d = el('div', 'fig'); d.textContent = '?'; return d; }
    if (spec.sprite) return sprite(spec);
    const quad = spec.figura === 'elefante', vb = quad ? VB_ELEFANTE : VB_UMANO;
    const d = el('div', 'fig' + (spec.eco ? ' eco' : '') + (quad ? ' quadrupede' : ''));
    const aA = spec.attacco === 'sparo' ? -14 : -18;
    // Personalità di riposo (spec.idle → classe idle-xxx) + piccola variazione dei tempi ricavata dall'id.
    let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 997;
    const jf = (0.86 + (h % 40) / 100).toFixed(2);
    d.classList.add('idle-' + (spec.idle || (spec.eco ? 'spettro' : 'sereno')));
    const extra = Object.keys(spec.idleVars || {}).map(k => `${k}:${spec.idleVars[k]}`).join(';');
    d.style.cssText = `--aA:${aA}deg;--aB:7deg;--dl:${(-Math.random() * 6).toFixed(2)}s;--jf:${jf};--glow:${spec.glow || '#ffd75e'};${extra}`;
    d.style.aspectRatio = vb.w + ' / ' + vb.h;
    d.innerHTML = `<div class="fig-in">${quad ? elefante(spec) : umanoide(spec)}</div>`;
    return d;
  };
  /** Ritratto circolare (HUD): testa e spalle della stessa figura, ritagliati. */
  Arte.busto = function (def, cls) {
    const id = def.id, spec = E.ARTE[id];
    const d = el('div', 'ritratto busto ' + (cls || ''));
    d.style.setProperty('--c', def.colore || '#888');
    if (!spec) { d.textContent = def.sigla || def.breve.slice(0, 1); return d; }
    if (spec.sprite) {
      const sp = spec.sprite, i = el('div', 'spr-busto');
      i.style.backgroundImage = 'url("' + (sp.busto || sp.src) + '")';
      if (sp.anim && !sp.busto) {
        const all = Object.values(sp.anim);
        i.style.backgroundSize = ((sp.colonne || Math.max(...all.map(x => x.frame || 1))) * 100) + '% ' + ((sp.righe || Math.max(...all.map(x => (x.riga || 0) + 1))) * 100) + '%';
        i.style.backgroundPosition = '0 0';
      }
      d.appendChild(i); return d;
    }
    const quad = spec.figura === 'elefante';
    const f = Arte.figura(id, { busto: true });
    f.classList.add('statico');
    const box = quad ? { x: 70, y: 62, w: 72, h: 72 } : { x: 28, y: 4, w: 64, h: 64 }, vb = quad ? VB_ELEFANTE : VB_UMANO;
    // ritaglio: la figura viene ingrandita e spostata in modo che si veda solo il riquadro `box`
    f.style.position = 'absolute'; f.style.aspectRatio = 'auto';
    f.style.width = (vb.w / box.w * 100) + '%'; f.style.height = (vb.h / box.h * 100) + '%';
    f.style.left = (-(box.x - vb.x) / box.w * 100) + '%'; f.style.top = (-(box.y - vb.y) / box.h * 100) + '%';
    d.appendChild(f); return d;
  };

  /**
   * Riproduce un'animazione "a-xxx" sulla figura; la promessa si risolve a fine animazione.
   * Ogni figura ha un "gettone" (_tok): un'animazione più recente invalida il timer di quella precedente,
   * così due animazioni ravvicinate non si cancellano a vicenda (era la causa degli scatti nell'idle).
   */
  Arte.anima = function (fig, nome, velocita) {
    if (!fig) return Promise.resolve();
    velocita = velocita || 1;
    const meta = Arte.ANIM[nome] || { dur: 0.5 };
    const dur = meta.dur / velocita;
    const tok = fig._tok = (fig._tok || 0) + 1;
    [...fig.classList].filter(c => c.startsWith('a-')).forEach(c => fig.classList.remove(c));
    fig.style.setProperty('--t', dur + 's');
    void fig.offsetWidth;
    fig.classList.add('a-' + nome);
    if (fig._sprite) { const map = { hit: 'colpo', morte: 'morte' }; Arte._sheet(fig, map[nome] || 'attacco', velocita); }
    if (nome === 'morte' || nome === 'vittoria') return Promise.resolve();
    return new Promise(res => setTimeout(() => {
      if (fig._tok === tok) {                       // solo l'animazione più recente ripulisce la classe
        fig.classList.remove('a-' + nome);
        if (fig._sprite) Arte._sheet(fig, fig.classList.contains('ced') ? 'ced' : 'idle', velocita);
      }
      res();
    }, dur * 1000));
  };
  Arte.reset = function (fig) { fig._tok = (fig._tok || 0) + 1; [...fig.classList].filter(c => c.startsWith('a-')).forEach(c => fig.classList.remove(c)); };

  /* ---------- Sfondo e arena per capitolo ---------- */
  /** Palette per capitolo: cielo, luna, sagome, sabbia/pietra dell'arena, bordo, colore delle particelle d'ambiente. */
  Arte.PALETTE = [
    { cielo: ['#2b1c3a', '#7a3a4a'], sagome: '#1a1220', sabbia: ['#b89a6a', '#7a5f3e', '#3a2c20'], bordo: '#d9b44a', polvere: '255,215,150' },   // Roma repubblicana
    { cielo: ['#2a1a1a', '#a0401a'], sagome: '#1e1210', sabbia: ['#b0825a', '#74503a', '#34231a'], bordo: '#e0722e', polvere: '255,160,90' },
    { cielo: ['#1e2a3a', '#5a6a8a'], sagome: '#141a24', sabbia: ['#8a8f96', '#5c6068', '#2a2c32'], bordo: '#9fb3c8', polvere: '200,215,240' },
    { cielo: ['#2a2230', '#9a7a4a'], sagome: '#1a141c', sabbia: ['#a8906a', '#6e5a3c', '#30261c'], bordo: '#d9b44a', polvere: '255,220,160' },
    { cielo: ['#1c2a2a', '#4a8a7a'], sagome: '#121a1a', sabbia: ['#8aa07a', '#566a4e', '#243026'], bordo: '#7fc4a0', polvere: '190,255,210' },
    { cielo: ['#26262c', '#7a7a82'], sagome: '#16161a', sabbia: ['#8a8478', '#575248', '#26231e'], bordo: '#b0b0b8', polvere: '210,210,220' },
    { cielo: ['#161618', '#3a3a44'], sagome: '#0c0c0e', sabbia: ['#6a6a70', '#44444a', '#1c1c20'], bordo: '#8a8a94', polvere: '180,180,190' }];
  Arte.palette = cap => Arte.PALETTE[cap % Arte.PALETTE.length];
  /** Applica i colori dell'arena alle variabili CSS dello stage. */
  Arte.applicaPalette = function (stageEl, cap) {
    const p = Arte.palette(cap);
    stageEl.style.setProperty('--sabbia1', p.sabbia[0]); stageEl.style.setProperty('--sabbia2', p.sabbia[1]); stageEl.style.setProperty('--sabbia3', p.sabbia[2]);
    stageEl.style.setProperty('--bordo-arena', p.bordo); stageEl.style.setProperty('--orizzonte', p.cielo[1]);
    return p;
  };
  /** Sfondo lontano (cielo, luna, colline, colonne): l'orizzonte sta al 42% dell'altezza, il pavimento è in CSS. */
  Arte.sfondo = function (cap) {
    const p = Arte.palette(cap);
    const colonne = [0, 1, 2, 3, 4, 5].map(i => `<g fill="${p.sagome}" opacity="${0.55 + (i % 2) * 0.25}"><rect x="${40 + i * 88}" y="${62 + (i % 2) * 12}" width="${18 - (i % 2) * 4}" height="${86 - (i % 2) * 12}"/><rect x="${35 + i * 88}" y="${57 + (i % 2) * 12}" width="${28 - (i % 2) * 4}" height="7"/><rect x="${36 + i * 88}" y="${146}" width="${26}" height="4"/></g>`).join('');
    const stelle = Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 97) % 520}" cy="${(i * 53) % 90}" r="${0.6 + (i % 3) * 0.4}" fill="#fff" opacity="${0.25 + (i % 4) * 0.12}"/>`).join('');
    return `<svg viewBox="0 0 520 150" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" class="sfondo-svg">
      <defs><linearGradient id="gCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.cielo[0]}"/><stop offset="1" stop-color="${p.cielo[1]}"/></linearGradient></defs>
      <rect width="520" height="150" fill="url(#gCielo)"/>${stelle}
      <circle cx="400" cy="52" r="46" fill="${p.cielo[1]}" opacity=".18"/><circle cx="400" cy="52" r="26" fill="#fff" opacity=".22"/>
      <path d="M0 118 Q90 78 190 108 T380 100 T520 112 L520 150 L0 150 Z" fill="${p.sagome}" opacity=".7"/>
      <path d="M0 132 Q120 104 240 128 T520 124 L520 150 L0 150 Z" fill="${p.sagome}" opacity=".95"/>${colonne}</svg>`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
