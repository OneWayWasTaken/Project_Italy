/* ============================================================================
 * art.js — personaggi SVG stilizzati con animazioni (FASE 2).
 *
 * Ogni personaggio/nemico è descritto da una piccola tabella in data.js (E.ARTE[id]):
 * corpo, colori, abito, copricapo, arma, stile d'attacco… Questo modulo la trasforma in
 * una figura SVG "a pezzi" (testa, torso, braccia, gambe, mantello, arma) che il CSS anima:
 *
 *   idle        sempre attivo (respiro, ondeggiare del mantello)
 *   a-fendente  a-affondo  a-sparo  a-lancio  a-preghiera   (attacchi)
 *   a-hit  ced  a-morte  a-vittoria                          (stati)
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

  /** Durata (s) e momento d'impatto (0-1) di ogni stile d'attacco: la UI li usa per sincronizzare gli effetti. */
  Arte.DURATA = { fendente: 0.62, affondo: 0.5, sparo: 0.55, lancio: 0.62, preghiera: 0.7, hit: 0.38, vittoria: 1.2 };
  Arte.IMPATTO = { fendente: 0.62, affondo: 0.5, sparo: 0.42, lancio: 0.55, preghiera: 0.5 };

  /* ---------- Colori e utilità ---------- */
  const OUT = 'stroke="#1b1422" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"';
  function mix(a, b, t) {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const x = p(a), y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const scuro = (c, t) => mix(c, '#000000', t == null ? 0.35 : t);
  const chiaro = (c, t) => mix(c, '#ffffff', t == null ? 0.3 : t);

  /* ---------- Dimensioni del corpo ---------- */
  // sw = mezza larghezza spalle, ww = mezza larghezza vita, gw = spessore arti
  const DIM = {
    m: { sw: 15, ww: 12, gw: 9 },
    f: { sw: 12, ww: 9.5, gw: 8 },
    g: { sw: 18, ww: 15, gw: 11 }
  };

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

  /* ---------- Capelli e barba ---------- */
  function capelli(stile, c) {
    const alto = `<path d="M47 36 Q46 20 60 20 Q74 20 73 36 Q68 28 60 28 Q52 28 47 36 Z" fill="${c}" ${OUT}/>`;
    switch (stile) {
      case 'lungo': return { dietro: `<path d="M46 30 Q42 56 52 66 L70 66 Q78 56 74 30 Z" fill="${c}" ${OUT}/>`, davanti: alto };
      case 'trecce': return { dietro: `<path d="M48 38 Q44 52 50 66" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M72 38 Q76 52 70 66" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`, davanti: alto };
      case 'raccolto': return { dietro: '', davanti: alto + `<circle cx="55" cy="19" r="5.5" fill="${c}" ${OUT}/>` };
      case 'riccio': return { dietro: '', davanti: `<g fill="${c}" ${OUT}>${[[50, 28], [56, 22], [64, 22], [71, 28], [60, 18], [48, 36], [72, 36]].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="6"/>`).join('')}</g>` };
      case 'calvo': return { dietro: '', davanti: `<path d="M48 36 Q47 30 50 28 Q49 34 48 36 Z" fill="${c}"/>` };
      default: return { dietro: '', davanti: alto };
    }
  }
  function barba(tipo, c) {
    switch (tipo) {
      case 'barba': return `<path d="M49 36 Q50 58 62 59 Q72 57 72 38 Q66 47 60 47 Q54 47 49 36 Z" fill="${c}" ${OUT}/>`;
      case 'pizzo': return `<path d="M56 46 Q60 56 66 46 Q61 49 56 46 Z" fill="${c}" ${OUT}/>`;
      case 'baffi': return `<path d="M60 42 Q66 40 73 43 Q66 47 60 44 Z" fill="${c}" ${OUT}/>`;
      default: return '';
    }
  }

  /* ---------- Copricapi (colori c1 = principale, c2 = accento) ---------- */
  const TESTE = {
    elmo_romano: (c1, c2) => `<path d="M46 38 Q45 18 60 18 Q75 18 74 38 L46 38 Z" fill="${c1}" ${OUT}/><rect x="44" y="36" width="32" height="4" rx="1.5" fill="${scuro(c1, 0.2)}" ${OUT}/>
      <path d="M47 40 L51 52 L56 41 Z M73 40 L69 52 L64 41 Z" fill="${c1}" ${OUT}/><path d="M48 22 Q60 2 72 22 L67 22 Q60 11 53 22 Z" fill="${c2}" ${OUT}/>`,
    elmo_cartaginese: (c1, c2) => `<path d="M46 38 Q45 17 60 17 Q75 17 74 38 L46 38 Z" fill="${c1}" ${OUT}/><rect x="44" y="36" width="32" height="4" rx="1.5" fill="${scuro(c1, 0.2)}" ${OUT}/>
      <path d="M52 20 Q54 -2 62 2 Q58 8 64 20 Z" fill="${c2}" ${OUT}/><path d="M47 40 L52 54 L57 41 Z" fill="${c1}" ${OUT}/>`,
    elmo_medievale: (c1) => `<path d="M46 38 Q45 17 60 17 Q75 17 74 38 L46 38 Z" fill="${c1}" ${OUT}/><rect x="58" y="37" width="4" height="12" fill="${c1}" ${OUT}/><rect x="44" y="36" width="32" height="3.5" fill="${scuro(c1, 0.25)}" ${OUT}/>`,
    alloro: (c1) => `<g fill="${c1}" ${OUT}>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = Math.PI * (1.08 + i * 0.12); return `<ellipse cx="${60 + 13 * Math.cos(a)}" cy="${37 + 13 * Math.sin(a)}" rx="3.6" ry="1.9" transform="rotate(${(a * 180 / Math.PI) + 90} ${60 + 13 * Math.cos(a)} ${37 + 13 * Math.sin(a)})"/>`; }).join('')}</g>`,
    corona: (c1) => `<path d="M48 28 L50 18 L55 25 L60 15 L65 25 L70 18 L72 28 Z" fill="${c1}" ${OUT}/><circle cx="60" cy="22" r="1.6" fill="#c0303f"/>`,
    velo_corona: (c1) => `<path d="M46 38 Q46 17 60 17 Q74 17 74 38 L78 70 L62 52 L46 62 Z" fill="#e9e1cf" ${OUT}/><path d="M49 26 L51 18 L56 24 L60 15 L64 24 L69 18 L71 26 Z" fill="${c1}" ${OUT}/>`,
    cappello_piuma: (c1, c2) => `<ellipse cx="58" cy="25" rx="16" ry="6" fill="${c1}" ${OUT} transform="rotate(-10 58 25)"/><path d="M68 24 Q84 14 88 30 Q80 22 70 28 Z" fill="${c2}" ${OUT}/>`,
    berretto: (c1) => `<path d="M46 34 Q48 16 66 19 Q78 22 74 34 Q60 27 46 34 Z" fill="${c1}" ${OUT}/>`,
    aviatore: (c1, c2) => `<path d="M46 38 Q45 18 60 18 Q75 18 74 38 L71 31 Q60 25 49 31 Z" fill="${c1}" ${OUT}/><rect x="52" y="24" width="20" height="6" rx="3" fill="${scuro(c1)}" ${OUT}/>
      <circle cx="58" cy="27" r="3.4" fill="${c2}" ${OUT}/><circle cx="67" cy="27" r="3.4" fill="${c2}" ${OUT}/>`,
    fazzoletto: (c1) => `<path d="M46 38 Q45 17 60 17 Q75 17 74 38 Q66 30 60 30 Q54 30 46 38 Z" fill="${c1}" ${OUT}/><path d="M48 36 L40 52 L52 44 Z" fill="${c1}" ${OUT}/>`,
    fedora: (c1, c2) => `<ellipse cx="60" cy="28" rx="18" ry="4.2" fill="${c1}" ${OUT}/><path d="M49 28 Q49 14 60 14 Q71 14 71 28 Z" fill="${c1}" ${OUT}/><rect x="49" y="23" width="22" height="4" fill="${c2}"/>`,
    basco: (c1) => `<ellipse cx="57" cy="25" rx="15" ry="7" fill="${c1}" ${OUT} transform="rotate(-12 57 25)"/><circle cx="55" cy="18" r="1.6" fill="${c1}"/>`,
    cappellino_ciclista: (c1) => `<path d="M48 33 Q48 20 60 20 Q72 20 72 33 Z" fill="${c1}" ${OUT}/><path d="M70 31 L83 34 L70 36 Z" fill="${c1}" ${OUT}/>`,
    cappuccio: (c1) => `<path d="M43 44 Q42 12 60 12 Q78 12 77 44 L72 52 Q60 40 48 52 Z" fill="${c1}" ${OUT}/><path d="M49 30 Q60 24 71 30 L71 44 Q60 50 49 44 Z" fill="#0a0810"/>`,
    fascia: (c1) => `<path d="M47 30 Q60 24 73 30 L73 34 Q60 28 47 34 Z" fill="${c1}" ${OUT}/>`
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

  /* ---------- Accessori ---------- */
  function accessorio(nome, c, d) {
    switch (nome) {
      case 'catene': return `<g fill="none" stroke="#8a8a94" stroke-width="2"><circle cx="${60 + d.sw - 2}" cy="94" r="3.4"/><circle cx="${60 - d.sw + 2}" cy="94" r="3.4"/><path d="M${60 + d.sw + 1} 94 l5 5 m-4 -1 l4 6" /></g>`;
      case 'sciarpa': return `<path d="M50 52 Q60 60 70 52 L72 58 Q60 66 48 58 Z" fill="${c}" ${OUT}/><path d="M48 58 L36 78 L42 80 L52 62 Z" fill="${c}" ${OUT}/>`;
      default: return '';
    }
  }
  function sulViso(acc, c) {
    switch (acc) {
      case 'occhiali': return `<g fill="none" stroke="#1b1422" stroke-width="1.1"><circle cx="62" cy="36" r="3.2"/><circle cx="70" cy="36" r="3.2"/><path d="M65.2 36 L66.8 36"/></g>`;
      case 'benda': return `<ellipse cx="70" cy="36" rx="3.8" ry="3.4" fill="#15101c"/><path d="M47 30 L73 40" stroke="#15101c" stroke-width="1.5"/>`;
      default: return '';
    }
  }

  /* ---------- Mantelli e gerla (dietro al corpo) ---------- */
  function dietro(spec, d) {
    let s = '';
    if (spec.mantello) {
      const c = spec.mantello;
      s += `<g class="f-mantello" style="transform-origin:${60 - d.sw + 4}px 58px"><path d="M${60 - d.sw + 2} 56 Q${34 - d.sw / 2} 100 ${30 - d.sw / 2} 156 Q56 150 ${60 + d.ww} 120 L${60 + d.sw - 4} 56 Z" fill="${c}" ${OUT}/>
        <path d="M${60 - d.sw + 4} 60 Q${44 - d.sw / 2} 104 ${42 - d.sw / 2} 150" stroke="${scuro(c, 0.3)}" stroke-width="1" fill="none"/></g>`;
    }
    if (spec.dorso === 'gerla') {
      s += `<g class="f-mantello" style="transform-origin:46px 62px"><path d="M30 64 L46 64 L48 112 L28 112 Z" fill="#8a6a3a" ${OUT}/><path d="M30 76 L46 76 M29 88 L47 88 M28 100 L48 100" stroke="#5a4222" stroke-width="1.2"/>
        <path d="M46 62 L58 60 M46 112 L52 104" stroke="#5a4222" stroke-width="2" fill="none"/></g>`;
    }
    return s;
  }

  /* ---------- Figura umanoide ---------- */
  function umanoide(id, spec, o) {
    o = o || {};
    const d = DIM[spec.corpo || 'm'];
    const pelle = spec.pelle || '#e6bf9f';
    const ab = spec.abito || { tipo: 'tunica', c1: '#999', c2: '#666' };
    const A = ABITI[ab.tipo](ab.c1, ab.c2, d);
    const manica = A.manica === 'nuda' ? pelle : (A.manica || ab.c1);
    const pant = A.pant === 'nuda' ? pelle : (A.pant || ab.c2);
    const xR = 60 + d.sw - 2, xL = 60 - d.sw + 2;
    const arto = (x1, y1, x2, y2, col) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#1b1422" stroke-width="${d.gw + 2.6}" stroke-linecap="round" fill="none"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${col}" stroke-width="${d.gw}" stroke-linecap="round" fill="none"/>`;
    const gamba = (x0, x1) => `${arto(x0, 104, x1, 178, pant)}${A.fasce ? `<path d="M${x1 - 4} 160 L${x1 + 4} 164 M${x1 - 4} 168 L${x1 + 4} 172" stroke="${scuro(pant)}" stroke-width="1.4"/>` : ''}<path d="M${x1 - 5} 184 Q${x1 - 6} 177 ${x1 + 1} 177 Q${x1 + 6} 177 ${x1 + 10} 182 L${x1 + 10} 187 L${x1 - 5} 187 Z" fill="${A.stivale || '#222'}" ${OUT}/>`;
    const arma = spec.arma && ARMI[spec.arma] ? ARMI[spec.arma](spec.armaC1, spec.armaC2) : null;
    const hair = capelli((spec.capelli || {}).stile, (spec.capelli || {}).colore || '#3a2a1c');
    const bc = (spec.capelli || {}).colore || '#3a2a1c';
    const th = spec.testa && TESTE[spec.testa.tipo || spec.testa] ? TESTE[spec.testa.tipo || spec.testa](spec.testa.c1 || '#888', spec.testa.c2 || '#c33') : '';
    const occhio = spec.eco ? (spec.glow || '#ffd75e') : '#1b1422';
    const testa = `${hair.dietro}<rect x="56" y="44" width="9" height="12" fill="${pelle}" ${OUT}/>
      <circle cx="60" cy="36" r="12" fill="${pelle}" ${OUT}/><circle cx="49.5" cy="38" r="2.6" fill="${pelle}" ${OUT}/>
      <path d="M72.5 37 Q76 39 72.6 41.5" fill="${pelle}" ${OUT}/>
      <circle cx="64" cy="36" r="1.5" fill="${occhio}"/><circle cx="70" cy="36" r="1.5" fill="${occhio}"/><path d="M65 43 Q68 45 71 43" stroke="#1b1422" stroke-width="1" fill="none"/>
      ${sulViso(spec.viso)}${barba((spec.capelli || {}).barba, bc)}${hair.davanti}${th}`;
    const gambe = A.nascondiGambe || spec.eco ? '' : `<g class="f-gamba f-gamba-b">${gamba(xL + 6, 52)}</g><g class="f-gamba f-gamba-a">${gamba(xR - 6, 70)}</g>`;
    const coda = spec.eco ? `<g class="f-coda"><path d="M${60 - d.ww - 4} 104 Q${60 - d.ww - 8} 140 ${52} 160 Q58 172 50 186 Q66 170 64 158 Q80 150 ${60 + d.ww + 4} 104 Z" fill="${mix(ab.c1, '#000', 0.25)}" opacity=".85"/></g>` : '';
    const fx = arma && arma.lampo ? `<g class="f-lampo" transform="translate(0,${arma.lampo})"><path d="M0 -8 L3 -2 L9 0 L3 2 L0 8 L-3 2 L-9 0 L-3 -2 Z" fill="#fff3a0"/><circle r="4" fill="#ff9a2a"/></g>` : '';
    const scudo = spec.scudo ? SCUDI[spec.scudo.tipo](spec.scudo.c1, spec.scudo.c2) : '';
    return `<g class="f-tutto" style="transform-origin:60px 188px">
      <g class="f-aura"><circle cx="60" cy="100" r="46" fill="none" stroke="${spec.glow || '#ffd75e'}" stroke-width="3" opacity="0"/></g>
      ${dietro(spec, d)}${gambe}${coda}
      <g class="f-torso" style="transform-origin:60px 106px">${A.svg}${accessorio(spec.accessorio, spec.accessorioC || '#f0ece0', d)}</g>
      <g class="f-braccio-b" style="transform-origin:${xL}px 60px">${arto(xL, 60, xL - 2, 92, manica)}<circle cx="${xL - 2}" cy="93" r="4.6" fill="${pelle}" ${OUT}/>${scudo}</g>
      <g class="f-testa" style="transform-origin:60px 50px">${testa}</g>
      <g class="f-braccio-a" style="transform-origin:${xR}px 60px">${arto(xR, 60, xR, 92, manica)}<circle cx="${xR}" cy="93" r="4.6" fill="${pelle}" ${OUT}/>
        ${arma ? `<g class="f-arma" transform="translate(${xR},93)">${arma.svg}${fx}</g>` : ''}</g>
    </g>`;
  }

  /* ---------- Elefante (nemico quadrupede) ---------- */
  function elefante(id, spec) {
    const c = spec.pelle || '#8a8090', cs = scuro(c, 0.3);
    const zampa = (x, cls) => `<g class="f-gamba ${cls}"><rect x="${x}" y="130" width="15" height="54" rx="6" fill="${cs}" ${OUT}/><ellipse cx="${x + 7.5}" cy="184" rx="9" ry="4" fill="#4a4250" ${OUT}/></g>`;
    return `<g class="f-tutto" style="transform-origin:60px 188px">
      <g class="f-aura"><circle cx="60" cy="110" r="70" fill="none" stroke="${spec.glow || '#c0303f'}" stroke-width="3" opacity="0"/></g>
      ${zampa(14, 'f-gamba-b')}${zampa(70, 'f-gamba-b')}
      <g class="f-torso" style="transform-origin:60px 150px"><path d="M6 110 Q8 78 50 76 Q92 76 98 108 Q100 138 84 144 L22 144 Q4 138 6 110 Z" fill="${c}" ${OUT}/>
        <path d="M96 106 Q102 106 104 114" stroke="${cs}" stroke-width="3" fill="none"/></g>
      ${zampa(30, 'f-gamba-a')}${zampa(86, 'f-gamba-a')}
      <g class="f-testa" style="transform-origin:96px 100px">
        <path d="M82 84 Q96 66 112 82 Q122 98 118 126 Q116 160 122 172 Q110 176 108 164 Q104 138 98 118 Z" fill="${c}" ${OUT}/>
        <ellipse cx="94" cy="96" rx="14" ry="22" fill="${cs}" ${OUT}/><path d="M112 96 Q132 100 128 118 Q122 106 112 106 Z" fill="#e9e1cf" ${OUT}/>
        <circle cx="108" cy="90" r="2.4" fill="${spec.glow || '#ffd75e'}"/></g>
      <g class="f-braccio-a f-braccio-b"></g>
    </g>`;
  }

  /* ---------- API: figura, busto, animazioni ---------- */
  function sprite(spec, o) {
    const sp = spec.sprite, d = el('div', 'fig sprite-fig' + (spec.eco ? ' eco' : ''));
    const w = sp.w || 128, h = sp.h || 192;
    d.dataset.sprite = '1'; d.style.setProperty('--sw', w + 'px'); d.style.setProperty('--sh', h + 'px');
    d.style.aspectRatio = w + ' / ' + h;
    const s = el('div', 'spr'); s.style.backgroundImage = 'url("' + sp.src + '")'; s.style.width = '100%'; s.style.height = '100%';
    if (sp.anim) { s.classList.add('sheet'); }
    else { s.style.backgroundSize = 'contain'; s.style.backgroundRepeat = 'no-repeat'; s.style.backgroundPosition = 'bottom center'; }
    d.appendChild(s);
    d._sprite = sp;
    if (sp.anim) Arte._sheet(d, 'idle');
    return d;
  }
  /** Avvia un'animazione di sprite sheet: nome ∈ idle, attacco, colpo, ced, morte. */
  Arte._sheet = function (fig, nome, speed) {
    const sp = fig._sprite; if (!sp || !sp.anim) return 0;
    const a = sp.anim[nome] || sp.anim.idle; if (!a) return 0;
    const s = fig.firstChild, n = a.frame || 1;
    // Dimensioni dello sheet (in frame): colonne = max frame, righe = max riga + 1 (sovrascrivibili in sprite.colonne / sprite.righe).
    const all = Object.values(sp.anim);
    const N = sp.colonne || Math.max(...all.map(x => x.frame || 1)), R = sp.righe || Math.max(...all.map(x => (x.riga || 0) + 1));
    s.style.animation = 'none'; void s.offsetWidth;
    s.style.backgroundSize = (N * 100) + '% ' + (R * 100) + '%';
    s.style.backgroundRepeat = 'no-repeat';
    s.style.backgroundPositionY = R > 1 ? ((a.riga || 0) / (R - 1) * 100) + '%' : '0%';
    s.style.setProperty('--to', N > 1 ? (n / (N - 1) * 100) + '%' : '0%');
    const loop = nome === 'idle' || nome === 'ced';
    const dur = n / (a.fps || 8) / (speed || 1);
    s.style.animation = `spr-steps ${dur}s steps(${n}) ${loop ? 'infinite' : '1 forwards'}`;
    return dur;
  };
  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  /** Costruisce l'elemento figura (full body). `id` = id della Voce o del nemico. */
  Arte.figura = function (id, opz) {
    const spec = E.ARTE[id]; opz = opz || {};
    if (!spec) { const d = el('div', 'fig'); d.textContent = '?'; return d; }
    if (spec.sprite) return sprite(spec, opz);
    const vb = spec.figura === 'elefante' ? '-6 0 140 200' : '0 0 120 200';
    const body = spec.figura === 'elefante' ? elefante(id, spec) : umanoide(id, spec, opz);
    const d = el('div', 'fig' + (spec.eco ? ' eco' : '') + (spec.figura === 'elefante' ? ' quadrupede' : ''));
    const aA = spec.attacco === 'sparo' ? -14 : -18;
    d.style.cssText = `--aA:${aA}deg;--aB:7deg;--dl:${(-Math.random() * 3).toFixed(2)}s;--glow:${spec.glow || '#ffd75e'}`;
    d.dataset.vb = vb;
    d.innerHTML = `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">${body}</svg>`;
    return d;
  };
  /** Ritratto circolare (HUD): testa e spalle della stessa figura. */
  Arte.busto = function (def, cls) {
    const id = def.id, spec = E.ARTE[id];
    const d = el('div', 'ritratto busto ' + (cls || ''));
    d.style.setProperty('--c', def.colore || '#888');
    if (!spec) { d.textContent = def.sigla || def.breve.slice(0, 1); return d; }
    if (spec.sprite) {
      const sp = spec.sprite, i = el('div', 'spr-busto');
      i.style.backgroundImage = 'url("' + (sp.busto || sp.src) + '")';
      if (sp.anim && !sp.busto) {       // sheet: mostra il primo frame
        const all = Object.values(sp.anim);
        i.style.backgroundSize = ((sp.colonne || Math.max(...all.map(x => x.frame || 1))) * 100) + '% ' + ((sp.righe || Math.max(...all.map(x => (x.riga || 0) + 1))) * 100) + '%';
        i.style.backgroundPosition = '0 0';
      }
      d.appendChild(i); return d;
    }
    const vb = spec.figura === 'elefante' ? '60 56 78 78' : '28 6 64 64';
    const body = spec.figura === 'elefante' ? elefante(id, spec) : umanoide(id, spec);
    d.innerHTML = `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="busto-svg">${body}</svg>`;
    return d;
  };
  /** Riproduce un'animazione "a-xxx" sulla figura. Ritorna una promessa risolta a fine animazione. */
  Arte.anima = function (fig, nome, velocita) {
    if (!fig) return Promise.resolve();
    velocita = velocita || 1;
    const dur = (Arte.DURATA[nome] || 0.5) / velocita;
    [...fig.classList].filter(c => c.startsWith('a-')).forEach(c => fig.classList.remove(c));
    fig.style.setProperty('--t', dur + 's');
    void fig.offsetWidth;
    fig.classList.add('a-' + nome);
    if (fig._sprite) { const map = { fendente: 'attacco', affondo: 'attacco', sparo: 'attacco', lancio: 'attacco', preghiera: 'attacco', hit: 'colpo', morte: 'morte' }; Arte._sheet(fig, map[nome] || 'idle', velocita); }
    if (nome === 'morte' || nome === 'vittoria') return Promise.resolve();
    return new Promise(res => setTimeout(() => {
      fig.classList.remove('a-' + nome);
      if (fig._sprite) Arte._sheet(fig, fig.classList.contains('ced') ? 'ced' : 'idle', velocita);
      res();
    }, dur * 1000));
  };
  Arte.reset = function (fig) { [...fig.classList].filter(c => c.startsWith('a-')).forEach(c => fig.classList.remove(c)); };

  /* ---------- Sfondo del palcoscenico per capitolo ---------- */
  Arte.sfondo = function (cap) {
    const pal = [
      ['#2b1c3a', '#6a3a4a', '#1a1220'], ['#2a1a1a', '#8a3a1a', '#1e1210'], ['#1e2a3a', '#4a5a7a', '#141a24'], ['#2a2230', '#8a6a4a', '#1a141c'],
      ['#1c2a2a', '#4a7a6a', '#121a1a'], ['#26262c', '#6a6a72', '#16161a'], ['#161618', '#3a3a42', '#0c0c0e']][cap % 7];
    const colonne = [0, 1, 2, 3, 4].map(i => `<g fill="${pal[2]}" opacity=".85"><rect x="${70 + i * 90}" y="${50 + (i % 2) * 14}" width="20" height="130"/><rect x="${64 + i * 90}" y="${44 + (i % 2) * 14}" width="32" height="8"/></g>`).join('');
    return `<svg viewBox="0 0 520 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" class="sfondo-svg">
      <rect width="520" height="300" fill="${pal[0]}"/><circle cx="410" cy="70" r="34" fill="${pal[1]}" opacity=".55"/><circle cx="410" cy="70" r="52" fill="${pal[1]}" opacity=".15"/>
      <path d="M0 190 Q90 140 190 180 T380 170 T520 185 L520 300 L0 300 Z" fill="${pal[2]}" opacity=".8"/>${colonne}
      <rect y="196" width="520" height="104" fill="${pal[2]}"/><ellipse cx="260" cy="250" rx="300" ry="54" fill="${pal[1]}" opacity=".16"/></svg>`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
