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
    raffica:      { dur: 1.00, imp: 0.72, dist: 'vicino',  fx: 'x' },
    contrattacco: { dur: 0.86, imp: 0.70, dist: 'vicino',  fx: 'taglio_o' },
    grido:        { dur: 0.95, imp: 0.55, dist: 'sul_posto', fx: 'onda' },
    hit:          { dur: 0.38 },
    vittoria:     { dur: 1.20 }
  };
  // Compatibilità con le versioni precedenti
  Arte.DURATA = {}; Arte.IMPATTO = {};
  Object.keys(Arte.ANIM).forEach(k => { Arte.DURATA[k] = Arte.ANIM[k].dur; Arte.IMPATTO[k] = Arte.ANIM[k].imp; });

  /* ---------- Colori e utilità ---------- */
  const OUT = 'stroke="#1b1422" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"';
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

  /* ---------- Gradienti condivisi: ombre "cel shading" (bordo netto) e luci di contorno ----------
   * Inseriti una sola volta nel documento: ogni forma disegnata con forma() riceve sopra un velo con
   * ombra dura sul lato posteriore (sinistra) e una lama di luce sul bordo anteriore (destra). */
  Arte.defs = function () {
    if (typeof document === 'undefined' || document.getElementById('gCel')) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.setAttribute('aria-hidden', 'true'); s.style.position = 'absolute';
    s.innerHTML = `<defs>
      <linearGradient id="gCel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a0c26" stop-opacity=".36"/><stop offset=".33" stop-color="#1a0c26" stop-opacity=".36"/><stop offset=".33" stop-color="#1a0c26" stop-opacity="0"/><stop offset=".86" stop-color="#fff" stop-opacity="0"/><stop offset=".86" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity=".16"/></linearGradient>
      <linearGradient id="gCelV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".14" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#1a0c26" stop-opacity="0"/><stop offset=".7" stop-color="#1a0c26" stop-opacity=".2"/><stop offset="1" stop-color="#1a0c26" stop-opacity=".3"/></linearGradient>
      <linearGradient id="gMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".28" stop-color="#fff" stop-opacity=".05"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset=".56" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
      <linearGradient id="gCoda" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="mCoda" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#gCoda)"/></mask>
      <radialGradient id="gLuce" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>`;
    (document.body || document.documentElement).appendChild(s);
  };

  /** Forma piena con contorno + velo d'ombra cel. `v` aggiunge anche l'ombra verticale (vesti lunghe). */
  const forma = (d, fill, v) => `<path d="${d}" fill="${fill}" ${OUT}/><path d="${d}" fill="url(#gCel)"/>${v ? `<path d="${d}" fill="url(#gCelV)"/>` : ''}`;
  const metallo = (d, fill) => `<path d="${d}" fill="${fill}" ${OUT}/><path d="${d}" fill="url(#gMetal)"/><path d="${d}" fill="url(#gCel)" opacity=".7"/>`;
  const f1 = n => (Math.round(n * 10) / 10).toString();
  /** Segmento d'arto affusolato (capsula) da (x1,y1) a (x2,y2), larghezze w1 → w2. */
  function seg(x1, y1, x2, y2, w1, w2) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, a = w1 / 2, b = w2 / 2;
    const p = (x, y) => f1(x) + ' ' + f1(y);
    return `M${p(x1 + nx * a, y1 + ny * a)} L${p(x2 + nx * b, y2 + ny * b)} A${f1(b)} ${f1(b)} 0 0 0 ${p(x2 - nx * b, y2 - ny * b)} L${p(x1 - nx * a, y1 - ny * a)} A${f1(a)} ${f1(a)} 0 0 0 ${p(x1 + nx * a, y1 + ny * a)} Z`;
  }

  /** Giuntura morbida: copre la cucitura del contorno dove due segmenti d'arto si sovrappongono (gomito, ginocchio). */
  const giunto = (x, y, w, col) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(w / 2 - 0.75)}" fill="${col}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(w / 2 - 0.75)}" fill="url(#gCel)"/>`;

  /* ---------- Vista di tre quarti ----------
   * Le figure guardano a destra girate di tre quarti verso chi guarda (come il viso: occhio vicino a sinistra,
   * occhio lontano a destra e più stretto). Il busto e i vestiti vengono quindi "girati": la metà destra (lontana)
   * si accorcia in prospettiva, la linea centrale (bottoni, cravatta, fibbia) si sposta verso destra.
   * Di conseguenza il braccio e la gamba di SINISTRA sono quelli vicini (davanti al corpo), quelli di destra lontani. */
  const V34 = { c: 60.5, k: 0.78 };
  const fx = x => x > V34.c ? V34.c + (x - V34.c) * V34.k : x;
  const kx = x => x > V34.c ? V34.k : 1;
  const ARGN = { M: 2, L: 2, T: 2, Q: 4, S: 4, C: 6, A: 7, H: 1, V: 1, Z: 0 };
  /** Riscrive le coordinate x di un attributo d di un path con fx (gestisce comandi assoluti e relativi). */
  function giraPath(d) {
    const t = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g); if (!t) return d;
    const out = []; let cmd = '', i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
    while (i < t.length) {
      if (/[a-zA-Z]/.test(t[i])) { cmd = t[i++]; out.push(cmd); if (cmd === 'Z' || cmd === 'z') { cx = sx; cy = sy; } continue; }
      const U = cmd.toUpperCase(), rel = cmd !== U, n = ARGN[U];
      if (!n) { i++; continue; }
      const a = t.slice(i, i + n).map(Number); i += n; if (a.length < n) break;
      let r;
      if (U === 'H') { const x = rel ? cx + a[0] : a[0]; r = [rel ? fx(x) - fx(cx) : fx(x)]; cx = x; }
      else if (U === 'V') { r = a; cy = rel ? cy + a[0] : a[0]; }
      else if (U === 'A') { const x = rel ? cx + a[5] : a[5], y = rel ? cy + a[6] : a[6], k = kx((cx + x) / 2); r = [a[0] * k, a[1], a[2], a[3], a[4], rel ? fx(x) - fx(cx) : fx(x), a[6]]; cx = x; cy = y; }
      else {
        r = [];
        for (let j = 0; j < n; j += 2) { const x = rel ? cx + a[j] : a[j]; r.push(rel ? fx(x) - fx(cx) : fx(x), a[j + 1]); }
        cx = rel ? cx + a[n - 2] : a[n - 2]; cy = rel ? cy + a[n - 1] : a[n - 1];
      }
      if (U === 'M') { sx = cx; sy = cy; cmd = rel ? 'l' : 'L'; }
      out.push(r.map(f1).join(' '));
    }
    return out.join(' ');
  }
  const num = (tag, n) => { const m = tag.match(new RegExp('\\s' + n + '="(-?[\\d.]+)"')); return m ? +m[1] : null; };
  const metti = (tag, n, v) => tag.replace(new RegExp('(\\s' + n + '=")(-?[\\d.]+)(")'), '$1' + f1(v) + '$3');
  /** Applica la vista di tre quarti a un frammento SVG (path, cerchi, ellissi, rettangoli, testi, linee, poligoni). */
  function treQuarti(svg) {
    return svg.replace(/<(path|circle|ellipse|rect|text|line|polygon)\b[^>]*>/g, (tag, tipo) => {
      tag = tag.replace(/\sd="([^"]*)"/, (m, d) => ' d="' + giraPath(d) + '"');
      if (tipo === 'circle' || tipo === 'ellipse') { const c = num(tag, 'cx'); if (c != null) { tag = metti(tag, 'cx', fx(c)); if (tipo === 'ellipse') { const r = num(tag, 'rx'); if (r != null) tag = metti(tag, 'rx', r * kx(c)); } } }
      else if (tipo === 'rect') { const x = num(tag, 'x'), w = num(tag, 'width'); if (x != null && w != null) { tag = metti(tag, 'width', fx(x + w) - fx(x)); tag = metti(tag, 'x', fx(x)); } }
      else if (tipo === 'text') { const x = num(tag, 'x'); if (x != null) tag = metti(tag, 'x', fx(x)); }
      else if (tipo === 'line') { ['x1', 'x2'].forEach(n => { const x = num(tag, n); if (x != null) tag = metti(tag, n, fx(x)); }); }
      else if (tipo === 'polygon') tag = tag.replace(/\spoints="([^"]*)"/, (m, p) => ' points="' + p.trim().split(/[\s,]+/).map((v, i) => i % 2 ? v : f1(fx(+v))).join(' ') + '"');
      return tag;
    });
  }

  /* ---------- Proporzioni (testa grande, stile "gacha") ----------
   * Testa: cranio 44→77 in x, 13→50 in y; occhi a y≈35.5; collo 46→57; spalle y=58; vita y=95; anche y=106;
   * gomito y=80, polso y=99, mano y=102; ginocchio y=142, caviglia y=178, suola y=187.
   * sw/ww/hw = mezze larghezze di spalle/vita/anche · ga/gl = spessore di braccia/gambe. */
  const DIM = {
    m: { sw: 14.5, ww: 10.5, hw: 11.5, ga: 9, gl: 11.4 },
    f: { sw: 12, ww: 8.6, hw: 11.6, ga: 7.8, gl: 10.2 },
    g: { sw: 18, ww: 14, hw: 14.5, ga: 11, gl: 13.6 }
  };
  const Y = { spalla: 59, gomito: 80, polso: 99, mano: 102, anca: 104, ginocchio: 142, caviglia: 178 };

  /** Sagoma del busto (spalle → anche). */
  const T = d => `M${60 - d.sw} 58 Q60 52 ${60 + d.sw} 58 Q${60 + d.sw + 1.6} 77 ${60 + d.ww} 95 L${60 + d.hw} 106 L${60 - d.hw} 106 L${60 - d.ww} 95 Q${60 - d.sw - 1.6} 77 ${60 - d.sw} 58 Z`;
  /** Gonna/falda dalla vita (y0) all'orlo (y1), svasata di `sv`, con orlo leggermente ondulato. */
  const K = (d, y0, y1, sv) => {
    const l = 60 - d.hw - sv, r = 60 + d.hw + sv, m = (y0 + y1) / 2;
    return `M${60 - d.hw + 0.5} ${y0} L${60 + d.hw - 0.5} ${y0} Q${r - sv * 0.3} ${m} ${r} ${y1} Q${60 + d.hw * 0.5} ${y1 + 3} 60 ${y1 + 1} Q${60 - d.hw * 0.5} ${y1 + 3} ${l} ${y1} Q${l + sv * 0.3} ${m} ${60 - d.hw + 0.5} ${y0} Z`;
  };
  const pieghe = (d, y0, y1, sv, c) => [-0.55, 0, 0.5].map(k => `<path d="M${f1(60 + d.hw * k)} ${y0 + 3} Q${f1(60 + (d.hw + sv) * k * 1.1)} ${(y0 + y1) / 2} ${f1(60 + (d.hw + sv) * k * 1.2)} ${y1 - 1}" stroke="${c}" stroke-width="1" fill="none" opacity=".55"/>`).join('');
  const cintura = (d, c, y) => `<path d="M${60 - d.ww - 0.6} ${(y || 93)} L${60 + d.ww + 0.6} ${(y || 93)} L${60 + d.ww + 1.2} ${(y || 93) + 5} L${60 - d.ww - 1.2} ${(y || 93) + 5} Z" fill="${c}" ${OUT}/><rect x="${60 + d.ww * 0.35}" y="${(y || 93) + 0.6}" width="4" height="3.8" rx=".8" fill="#e0c060" stroke="#1b1422" stroke-width=".8"/>`;
  const colletto = (c, tipo) => tipo === 'v' ? `<path d="M54 56 L60.5 67 L67 56" fill="${c}" ${OUT}/>` : `<path d="M53 56.5 Q60.5 63 68 56.5 Q60.5 60 53 56.5 Z" fill="${c}" ${OUT}/>`;

  /* ---------- Abiti ----------
   * Ognuno ritorna: svg (busto + falde, disegnato SOPRA le gambe), manica (colore | 'nuda'), corta (manica corta),
   * pant (colore | 'nuda'), stivale (colore scarpa), alti (stivali alti), sandali, nascondiGambe (veste fino ai piedi). */
  const ABITI = {
    tunica: (c1, c2, d) => ({
      svg: `${forma(K(d, 100, 134, 5), c1)}${pieghe(d, 100, 134, 5, scuro(c1, 0.3))}<path d="${K(d, 129, 134, 5.4)}" fill="none"/>
        <path d="M${60 - d.hw - 5.2} 131 Q60 136.5 ${60 + d.hw + 5.2} 131" stroke="${c2}" stroke-width="3" fill="none"/>
        ${forma(T(d), c1)}${colletto(scuro(c1, 0.2))}${cintura(d, c2)}`,
      manica: c1, corta: true, pant: 'nuda', stivale: '#7a5a3a', sandali: true
    }),
    corazza: (c1, c2, d) => ({
      svg: `${forma(K(d, 100, 122, 3), c1)}
        ${[0, 1, 2, 3, 4, 5].map(i => { const w = (2 * d.hw + 8) / 6, x = 60 - d.hw - 4 + i * w; return `<path d="M${f1(x + 0.4)} 104 L${f1(x + w - 0.4)} 104 L${f1(x + w - 0.8)} 128 Q${f1(x + w / 2)} 130 ${f1(x + 0.8)} 128 Z" fill="${i % 2 ? scuro(c2, 0.1) : c2}" ${OUT}/>`; }).join('')}
        ${forma(T(d), c1)}
        ${metallo(`M${60 - d.sw + 2.5} 59 Q60 54 ${60 + d.sw - 2.5} 59 Q${60 + d.sw - 1} 76 ${60 + d.ww} 96 L${60 - d.ww} 96 Q${60 - d.sw + 1} 76 ${60 - d.sw + 2.5} 59 Z`, c2)}
        <path d="M53 68 Q57 73 60.5 69 Q64 73 68 68 M55 80 Q60.5 84 66 80 M57 89 Q60.5 91.5 64 89" stroke="${scuro(c2, 0.4)}" stroke-width="1.1" fill="none"/>
        ${cintura(d, scuro(c1, 0.3), 95)}
        ${metallo(`M${60 - d.sw - 4} 62 Q${60 - d.sw} 52 ${60 - d.sw + 8} 56 L${60 - d.sw + 6} 66 Z`, c2)}`,
      manica: 'nuda', pant: 'nuda', stivale: '#5a3a22', sandali: true
    }),
    toga: (c1, c2, d) => ({
      svg: `${forma(K(d, 100, 150, 9), c1, true)}${pieghe(d, 100, 150, 9, scuro(c1, 0.22))}
        ${forma(T(d), c1)}
        <path d="M${60 - d.sw} 58 L${60 + d.sw - 4} 58 Q${60 + d.hw + 6} 106 ${60 + d.hw + 9} 150 L${60 + 2} 151 Q${60 - 4} 106 ${60 - d.sw} 58 Z" fill="${chiaro(c1, 0.35)}" ${OUT}/>
        <path d="M${60 - d.sw} 58 Q${60 - 2} 104 ${60 + 2} 151" stroke="${scuro(c1, 0.2)}" stroke-width="1" fill="none"/>
        <path d="M${60 - d.sw + 1} 58 L${60 + d.sw - 4} 58 Q${60 + d.hw + 6} 106 ${60 + d.hw + 9} 150" stroke="${c2}" stroke-width="3.2" fill="none"/>`,
      manica: c1, corta: true, pant: 'nuda', stivale: '#8a6a40', sandali: true
    }),
    veste_lunga: (c1, c2, d) => ({
      svg: `${forma(K(d, 98, 180, 15), c1, true)}${pieghe(d, 98, 180, 15, scuro(c1, 0.28))}
        <path d="M${60 - d.hw - 15.5} 175 Q60 183 ${60 + d.hw + 15.5} 175" stroke="${c2}" stroke-width="4" fill="none"/>
        <path d="M60.5 100 L60.5 180" stroke="${c2}" stroke-width="2.6"/>
        ${forma(T(d), c1)}<path d="M60.5 60 L60.5 96" stroke="${c2}" stroke-width="2.6"/>${colletto(c2, 'v')}${cintura(d, c2)}`,
      manica: c1, pant: c1, stivale: scuro(c1, 0.4), nascondiGambe: true
    }),
    gonna: (c1, c2, d) => ({
      svg: `${forma(K(d, 98, 152, 13), c2, true)}${pieghe(d, 98, 152, 13, scuro(c2, 0.3))}
        <path d="M${60 - d.hw + 1} 100 L${60 + d.hw - 1} 100 L${60 + d.hw + 4} 140 Q60 143 ${60 - d.hw - 4} 140 Z" fill="${chiaro(c1, 0.5)}" ${OUT}/>
        ${forma(T(d), c1)}<path d="M53 57 Q60.5 66 68 57" fill="none" stroke="${scuro(c1, 0.35)}" stroke-width="1.2"/>
        <path d="M${60 - d.ww - 0.5} 72 Q60.5 68 ${60 + d.ww + 0.5} 72 L${60 + d.ww} 96 L${60 - d.ww} 96 Z" fill="${scuro(c2, 0.1)}" ${OUT}/><path d="M58 75 L63 79 M63 75 L58 79 M58 81 L63 85 M63 81 L58 85 M58 87 L63 91 M63 87 L58 91" stroke="${chiaro(c1, 0.4)}" stroke-width=".8"/>`,
      manica: c1, pant: 'nuda', stivale: '#2a1d14', calze: '#5a4a3a'
    }),
    giubba: (c1, c2, d) => ({
      svg: `${forma(T(d), c1)}<path d="M54 56 L60.5 74 L67 56 Z" fill="#efe6d2" ${OUT}/><path d="M57.5 58 L60.5 66 L63.5 58" fill="${chiaro(c1, 0.1)}" stroke="none"/>
        <path d="M${60 - d.sw + 1} 59 Q60 64 ${60 + d.sw - 1} 59" stroke="${scuro(c1, 0.3)}" stroke-width="1" fill="none"/>
        ${[78, 86].map(y => `<circle cx="60.5" cy="${y}" r="1.1" fill="${scuro(c1, 0.45)}"/>`).join('')}
        ${cintura(d, '#3a2a1a', 94)}`,
      manica: c1, pant: c2, stivale: '#2a1d14', alti: true
    }),
    uniforme: (c1, c2, d) => ({
      svg: `${forma(K(d, 100, 120, 3), c1)}<path d="M60.5 100 L60.5 120" stroke="${scuro(c1, 0.35)}" stroke-width="1"/>
        ${forma(T(d), c1)}
        <path d="M${60 - d.sw + 3} 58 L${60 + d.ww} 96" stroke="${c2}" stroke-width="3.2"/>
        ${[66, 74, 82, 90].map(y => `<circle cx="${60 + (y - 60) * 0.06}" cy="${y}" r="1.3" fill="#d9b44a" stroke="#1b1422" stroke-width=".6"/>`).join('')}
        <path d="M53.5 55.5 L60.5 60 L67.5 55.5 L67.5 59.5 L60.5 63 L53.5 59.5 Z" fill="${scuro(c1, 0.25)}" ${OUT}/>
        <rect x="${60 - d.sw + 1.5}" y="71" width="7" height="7" rx="1" fill="${scuro(c1, 0.15)}" ${OUT}/>
        ${cintura(d, c2, 95)}
        <path d="M${60 + d.sw - 2} 57.5 L${60 + d.sw + 3} 59 L${60 + d.sw + 2} 62 L${60 + d.sw - 3} 61 Z" fill="#d9b44a" stroke="#1b1422" stroke-width=".7"/>`,
      manica: c1, pant: c1, stivale: c2, alti: true, fasce: true
    }),
    abito_nero: (c1, c2, d) => ({
      svg: `<path d="M${60 - d.hw} 102 L${60 - d.hw - 5} 146 L${60 - 1} 128 L${60 + d.hw + 4} 140 L${60 + d.hw} 102 Z" fill="${c2}" ${OUT}/><path d="M${60 - d.hw} 102 L${60 - d.hw - 5} 146 L${60 - 1} 128 Z" fill="url(#gCel)"/>
        ${forma(T(d), c2)}<path d="M54 57 L60.5 98 L67 57 Z" fill="${c1}" ${OUT}/>
        <path d="M54 57 L58 70 L52.5 66 Z M67 57 L63 70 L68.5 66 Z" fill="${scuro(c2, 0.2)}" ${OUT}/>
        <path d="M58.5 58 L62.5 58 L61.4 61 L62.4 72 L60.5 75 L58.6 72 L59.6 61 Z" fill="#6a1a2a" stroke="#1b1422" stroke-width=".7"/>
        ${[80, 87].map(y => `<circle cx="60.5" cy="${y}" r=".9" fill="${scuro(c1, 0.4)}"/>`).join('')}`,
      manica: c2, pant: c2, stivale: '#0e0c12', polsini: c1
    }),
    tuta: (c1, c2, d) => ({
      svg: `<path d="M${60 - d.hw} 100 L${60 + d.hw} 100 L${60 + d.hw + 2} 124 L${60 + 2} 126 L${60 - 1} 118 L${60 - 2} 126 L${60 - d.hw - 2} 124 Z" fill="#1e1e26" ${OUT}/>
        ${forma(T(d), c1)}<path d="M${60 - d.sw - 0.6} 74 L${60 + d.sw + 0.6} 74 L${60 + d.sw + 0.4} 81 L${60 - d.sw - 0.4} 81 Z" fill="${c2}"/>
        ${colletto(c2)}<path d="M60.5 58 L60.5 72" stroke="${scuro(c1, 0.3)}" stroke-width="1"/><text x="60.5" y="92" font-size="7" font-family="serif" font-weight="bold" fill="${c2}" text-anchor="middle">G</text>`,
      manica: c1, corta: true, pant: 'nuda', stivale: '#1e1e26', calze: '#ece6d6', calzeAlte: true
    }),
    cotta: (c1, c2, d) => ({
      svg: `${forma(K(d, 98, 128, 4), '#8a8a96')}<path d="${K(d, 98, 128, 4)}" fill="none" stroke="#5a5a66" stroke-width=".6" stroke-dasharray="1.6 1.4" opacity=".8"/>
        ${forma(T(d), '#8a8a96')}
        ${forma(`M${60 - d.ww - 1} 60 L${60 + d.ww + 1} 60 L${60 + d.hw + 5} 142 Q60 146 ${60 - d.hw - 5} 142 Z`, c2)}
        <path d="M56 70 L65 70 M60.5 66 L60.5 84" stroke="${chiaro(c2, 0.55)}" stroke-width="2.4"/>
        ${cintura(d, scuro(c2, 0.4), 95)}`,
      manica: '#8a8a96', pant: '#6a6a76', stivale: '#2e2a30', alti: true
    }),
    armatura: (c1, c2, d) => ({
      svg: `${[0, 1, 2, 3].map(i => { const w = (2 * d.hw + 6) / 4, x = 60 - d.hw - 3 + i * w; return metallo(`M${f1(x + 0.3)} 102 L${f1(x + w - 0.3)} 102 L${f1(x + w - 1)} 126 L${f1(x + 1)} 126 Z`, i % 2 ? scuro(c1, 0.1) : c1); }).join('')}
        ${metallo(T(d), c1)}
        <path d="M${60 - d.ww} 72 Q60.5 76 ${60 + d.ww} 72 M${60 - d.ww} 83 Q60.5 87 ${60 + d.ww} 83" stroke="${scuro(c1, 0.4)}" stroke-width="1.1" fill="none"/>
        <path d="M60.5 59 L60.5 94" stroke="${chiaro(c1, 0.3)}" stroke-width="1.2" opacity=".7"/>
        ${cintura(d, c2, 95)}
        ${metallo(`M${60 - d.sw - 5} 63 Q${60 - d.sw - 2} 51 ${60 - d.sw + 9} 55 L${60 - d.sw + 7} 67 Z`, c2)}`,
      manica: c1, metalloBraccia: true, pant: scuro(c1, 0.2), stivale: scuro(c1, 0.45), alti: true
    }),
    manto_imperiale: (c1, c2, d) => ({
      svg: `${forma(K(d, 98, 180, 15), c1, true)}${pieghe(d, 98, 180, 15, scuro(c1, 0.28))}
        ${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${f1(60 - d.hw - 13 + i * (2 * d.hw + 26) / 6)} 176 l2 4 l2 -4" fill="none" stroke="${c2}" stroke-width="1.2"/>`).join('')}
        <path d="M${60 - d.hw - 15.5} 174 Q60 182 ${60 + d.hw + 15.5} 174" stroke="${c2}" stroke-width="3.4" fill="none"/>
        ${forma(`M${60 + 1} 98 L${60 + d.hw + 14} 180 L${60 + 6} 181 Z`, chiaro(c2, 0.2))}
        ${forma(T(d), c1)}${[70, 78, 86].map(y => `<path d="M57 ${y} L64 ${y + 2}" stroke="${c2}" stroke-width="1.4"/>`).join('')}
        ${forma(`M${60 - d.sw - 2} 57 Q60.5 70 ${60 + d.sw + 2} 57 Q${60 + d.sw + 3} 63 ${60 + d.sw - 2} 66 Q60.5 74 ${60 - d.sw + 2} 66 Q${60 - d.sw - 3} 63 ${60 - d.sw - 2} 57 Z`, '#f2ede2')}
        ${[-9, -4, 1, 6, 10].map(k => `<path d="M${60.5 + k} ${62 + Math.abs(k) * 0.2} l0 2.4" stroke="#1b1422" stroke-width="1.3" stroke-linecap="round"/>`).join('')}
        ${cintura(d, c2)}`,
      manica: c1, pant: c1, stivale: scuro(c1, 0.4), nascondiGambe: true, polsini: '#f2ede2'
    }),
    abito_dama: (c1, c2, d) => ({
      svg: `${forma(K(d, 96, 180, 18), c1, true)}${pieghe(d, 96, 180, 18, scuro(c1, 0.3))}
        ${forma(`M${60 - 4} 98 L${60 + 5} 98 L${60 + 12} 180 L${60 - 10} 180 Z`, c2)}<path d="M${60 - 4} 98 L${60 - 10} 180 M${60 + 5} 98 L${60 + 12} 180" stroke="${scuro(c2, 0.3)}" stroke-width=".9"/>
        ${forma(T(d), c1)}
        <path d="M${60 - d.ww + 0.5} 70 L${60 + d.ww - 0.5} 70 L60.5 99 Z" fill="${c2}" ${OUT}/><path d="M57 76 L64 76 M57.6 82 L63.4 82 M58.4 88 L62.6 88" stroke="${scuro(c2, 0.4)}" stroke-width="1"/>
        <path d="M${60 - d.sw + 2} 59 Q60.5 68 ${60 + d.sw - 2} 59" fill="${chiaro(c1, 0.6)}" ${OUT}/>
        <path d="M54 63 Q60.5 66 67 63" stroke="#f2ede2" stroke-width="1.2" fill="none" stroke-dasharray="1 1.2"/>`,
      manica: c1, sbuffi: c2, pant: c1, stivale: scuro(c1, 0.45), nascondiGambe: true
    }),
    veste_studioso: (c1, c2, d) => ({
      svg: `${forma(K(d, 98, 176, 13), scuro(c1, 0.15), true)}${pieghe(d, 98, 176, 13, scuro(c1, 0.35))}
        ${forma(T(d), scuro(c1, 0.15))}
        ${forma(`M${60 - d.sw} 58 Q${60 - d.sw + 2} 120 ${60 - d.hw - 10} 178 L${60 - 4} 178 Q${60 - 3} 110 ${60 - 2} 60 Z`, c1)}
        ${forma(`M${60 + d.sw} 58 Q${60 + d.sw + 1} 120 ${60 + d.hw + 12} 176 L${60 + 7} 177 Q${60 + 4} 110 ${60 + 3} 60 Z`, c1)}
        <path d="M${60 - d.sw} 58 Q${60 - d.sw + 2} 120 ${60 - d.hw - 10} 178 M${60 + d.sw} 58 Q${60 + d.sw + 1} 120 ${60 + d.hw + 12} 176" stroke="${c2}" stroke-width="2" fill="none"/>
        ${cintura(d, '#4a3220')}<rect x="${60 + d.ww - 4}" y="98" width="6" height="8" rx="1.4" fill="#7a5a32" ${OUT}/>`,
      manica: c1, pant: c1, stivale: '#3a2a1a', nascondiGambe: true, polsini: c2
    }),
    saio: (c1, c2, d) => ({
      svg: `${forma(K(d, 98, 180, 12), c1, true)}${pieghe(d, 98, 180, 12, scuro(c1, 0.3))}
        ${forma(T(d), c1)}${forma(`M${60 - d.sw - 1} 57 L${60 + d.sw + 1} 57 L${60 + d.sw - 1} 72 Q60.5 78 ${60 - d.sw + 1} 72 Z`, c2)}
        <path d="M${60 - d.ww - 1} 95 Q60.5 99 ${60 + d.ww + 1} 95" stroke="#d8cfb4" stroke-width="2.4" fill="none"/><path d="M${60 + 4} 97 Q${60 + 6} 112 ${60 + 3} 126" stroke="#d8cfb4" stroke-width="2" fill="none"/><circle cx="${60 + 3}" cy="127" r="1.6" fill="#d8cfb4"/>`,
      manica: c1, pant: c1, stivale: '#3a2a1a', nascondiGambe: true
    }),
    civile: (c1, c2, d) => ({
      svg: `<path d="M${60 - d.hw - 0.5} 100 L${60 - d.hw - 4} 132 L${60 + d.hw + 4} 132 L${60 + d.hw + 0.5} 100 Z" fill="${c1}" ${OUT}/><path d="M${60 - d.hw - 0.5} 100 L${60 - d.hw - 4} 132 L${60 + d.hw + 4} 132 L${60 + d.hw + 0.5} 100 Z" fill="url(#gCel)"/>
        ${forma(T(d), c1)}<path d="M54 56.5 L60.5 82 L67 56.5" fill="#ece4d2" ${OUT}/>
        <path d="M59 58 L62 58 L61.2 61 L62.3 76 L60.5 79 L58.7 76 L59.8 61 Z" fill="#6a2a2a" stroke="#1b1422" stroke-width=".7"/>
        <path d="M52.5 57.5 L59 84 L51 72 Z M68.5 57.5 L62 84 L70 72 Z" fill="${scuro(c1, 0.18)}" ${OUT}/>
        <path d="M60.5 84 L60.5 130" stroke="${scuro(c1, 0.35)}" stroke-width="1"/>${[90, 100].map(y => `<circle cx="62.3" cy="${y}" r="1" fill="${scuro(c1, 0.5)}"/>`).join('')}
        <path d="M${60 + d.sw - 7} 70 l5 0 l0 2.5" stroke="#ece4d2" stroke-width="1.4" fill="none"/>`,
      manica: c1, pant: c2, stivale: '#15121a', polsini: '#ece4d2'
    })
  };

  /* ---------- Armi e oggetti in mano (impugnatura in (0,0), puntano in basso lungo +y) ---------- */
  const ARMI = {
    gladio: () => ({ svg: `<rect x="-2" y="-5" width="4" height="8" rx="1" fill="#5a3a22" ${OUT}/><path d="M-6 2.5 L6 2.5 L5 5.5 L-5 5.5 Z" fill="#b8923a" ${OUT}/><path d="M-2.6 5.5 L2.6 5.5 L2.8 30 L0 36 L-2.8 30 Z" fill="#dfe6ee" ${OUT}/><path d="M0 6 L0 33" stroke="#9aa4b2" stroke-width=".8"/><circle cy="-5.5" r="2" fill="#b8923a" ${OUT}/>`, lampo: 0, punta: 36 }),
    sciabola: () => ({ svg: `<path d="M-2 -5 L2 -5 L2 3 L-2 3 Z" fill="#3a2a1a" ${OUT}/><path d="M-5 2 Q-7 -6 -1 -7" stroke="#b8923a" stroke-width="1.6" fill="none"/><rect x="-5.5" y="2" width="11" height="3" rx="1" fill="#b8923a" ${OUT}/><path d="M-2.6 5 Q11 17 7.4 42 L2 40.6 Q4.4 19 -.2 6.4 Z" fill="#dfe6ee" ${OUT}/><path d="M0.6 7 Q7.6 18 5 38" stroke="#fff" stroke-width=".7" fill="none" opacity=".8"/>`, lampo: 0, punta: 40 }),
    lancia: () => ({ svg: `<rect x="-1.5" y="-28" width="3" height="88" rx="1" fill="#7a5a32" ${OUT}/><path d="M-1.5 -10 L1.5 -10 M-1.5 -6 L1.5 -6" stroke="#3a2a1a" stroke-width="1"/><path d="M-4.6 58 L0 78 L4.6 58 Q0 62 -4.6 58 Z" fill="#dfe6ee" ${OUT}/><path d="M-3 58 L-3 62 L3 62 L3 58" fill="#b8923a" ${OUT}/>`, lampo: 0, punta: 78 }),
    bastone: () => ({ svg: `<rect x="-1.8" y="-22" width="3.6" height="68" rx="1.6" fill="#6a4a2a" ${OUT}/><path d="M-1.8 -14 Q2 -10 -1.8 -6 M-1.8 20 Q2 24 -1.8 28" stroke="#4a321a" stroke-width=".9" fill="none"/><circle cy="-22" r="3" fill="#7a5a32" ${OUT}/>`, lampo: 0, punta: 46 }),
    archibugio: () => ({ svg: `<path d="M-5.4 -19 L5.4 -19 L4.2 -13 L-4.2 -13 Z" fill="#4a2e16" ${OUT}/><path d="M-4.2 -13 L4.2 -13 L3.4 9 L-3.4 9 Z" fill="#8a5a2c" ${OUT}/><path d="M-4.2 -13 L-3.4 9" stroke="#5a3a1a" stroke-width="1.2"/>
        <rect x="-2" y="6" width="4" height="40" rx=".6" fill="#55555f" ${OUT}/><rect x="-2" y="6" width="4" height="40" fill="url(#gMetal)"/><rect x="-2.6" y="44" width="5.2" height="3.4" rx=".6" fill="#3a3a44" ${OUT}/>
        <rect x="-2.8" y="17" width="5.6" height="2.2" fill="#c9a040" stroke="#1b1422" stroke-width=".6"/><rect x="-2.8" y="31" width="5.6" height="2.2" fill="#c9a040" stroke="#1b1422" stroke-width=".6"/>
        <path d="M3.4 3 Q9 1 7.4 -5" stroke="#1b1422" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M3.4 3 Q9 1 7.4 -5" stroke="#b0b0ba" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="7.4" cy="-5.6" r="1.6" fill="#ff7a2a"/><circle cx="7.4" cy="-5.6" r="3.2" fill="#ffb04a" opacity=".35"/>`, lampo: 48, punta: 47 }),
    pistola: () => ({ svg: `<path d="M-3.6 -7 L3.2 -7.6 L3.8 3 L-2.8 3.6 Z" fill="#6a4222" ${OUT}/><path d="M-2.2 -5 L2.2 -5.4 M-2 -2 L2.4 -2.4 M-1.8 1 L2.6 .6" stroke="#4a2c14" stroke-width=".8"/>
        <path d="M-3 1 L3 1 L3 24 L-3 24 Z" fill="#3a3a46" ${OUT}/><path d="M-3 1 L3 1 L3 24 L-3 24 Z" fill="url(#gMetal)"/><path d="M-3 7 L3 7 M-3 9.4 L3 9.4" stroke="#1b1422" stroke-width=".7"/>
        <rect x="-1.6" y="23" width="3.2" height="3.4" fill="#2a2a34" ${OUT}/><rect x="-.6" y="21" width="1.2" height="2" fill="#9a9aa8"/>
        <path d="M3 4 Q8.4 5.6 3 11" stroke="#1b1422" stroke-width="2.2" fill="none"/><path d="M3 4 Q8.4 5.6 3 11" stroke="#6a6a78" stroke-width="1" fill="none"/><path d="M3 6 L5 8" stroke="#1b1422" stroke-width="1.2"/>
        <path d="M-3 -1 L-5.4 -3 L-4.6 -.4" fill="#3a3a46" ${OUT}/>`, lampo: 27, punta: 26 }),
    falco: () => ({ svg: `<rect x="-5.5" y="-3" width="11" height="9" rx="3" fill="#6a4a2a" ${OUT}/>
        <path d="M-10 6 Q-2 -6 11 5 Q5 13 0 15 Q-7 13 -10 6 Z" fill="#8a6038" ${OUT}/><path d="M-10 6 Q-15 0 -18 -6 Q-10 -2 -4 2 Z" fill="#6a4628" ${OUT}/>
        <path d="M-6 9 Q0 3 6 9" stroke="#e0cfa0" stroke-width="1.6" fill="none"/><circle cx="4" cy="4" r="1.6" fill="#ffd75e" stroke="#1b1422" stroke-width=".6"/><path d="M8 4.6 L12 6 L8 7.4 Z" fill="#d9a43a" ${OUT}/>
        <path d="M-2 15 L-4 23 L4 23 L2 15 Z" fill="#6a4a2a" ${OUT}/>`, lampo: 0, punta: 14 }),
    libro: (c1) => ({ svg: `<rect x="-7" y="1" width="14" height="18" rx="1.5" fill="${c1 || '#7a3030'}" ${OUT}/><rect x="-5.2" y="3" width="10.4" height="14" fill="#efe6cc"/><path d="M-3 7 L3 7 M-3 10 L3 10 M-3 13 L2 13" stroke="#8a7a5a" stroke-width=".7"/>`, lampo: 0, punta: 18 }),
    compasso: () => ({ svg: `<path d="M-1.2 3 L-8 40 M1.2 3 L8 40" stroke="#1b1422" stroke-width="4.2" stroke-linecap="round"/><path d="M-1.2 3 L-8 40 M1.2 3 L8 40" stroke="#d8b450" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M-8 40 L-8.6 45 M8 40 L8.6 45" stroke="#c9ccd6" stroke-width="1.6" stroke-linecap="round"/><path d="M-5.6 24 Q0 27 5.6 24" stroke="#8a6a2a" stroke-width="1.4" fill="none"/>
        <circle cx="0" cy="3" r="3.8" fill="#e0c060" ${OUT}/><circle cx="0" cy="3" r="1.3" fill="#7a5a1a"/><rect x="-1.6" y="-7" width="3.2" height="7" rx="1.2" fill="#c9a040" ${OUT}/>`, lampo: 0, punta: 45 }),
    balestra: () => ({ svg: `<path d="M-3.2 -11 L3.2 -11 L2.6 36 L-2.6 36 Z" fill="#8a5a2c" ${OUT}/><path d="M-3.2 -11 L-2.6 36" stroke="#5a3a1a" stroke-width="1.1"/>
        <circle cx="0" cy="5" r="4.6" fill="#c9a040" stroke="#1b1422" stroke-width="1.2" stroke-dasharray="1.6 1"/><circle cx="0" cy="5" r="2.2" fill="#7a5a1a" ${OUT}/>
        <path d="M2.6 9 Q6 11 3 14" stroke="#1b1422" stroke-width="1.6" fill="none"/>
        <path d="M-18 25 Q0 37 18 25" stroke="#1b1422" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M-18 25 Q0 37 18 25" stroke="#6a4628" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        <path d="M-18 25 L0 17 L18 25" stroke="#efe6cc" stroke-width=".9" fill="none"/>
        <path d="M0 15 L0 40" stroke="#1b1422" stroke-width="2.6"/><path d="M0 15 L0 40" stroke="#c8b48a" stroke-width="1.2"/><path d="M-2.2 39 L0 45 L2.2 39 Z" fill="#dfe6ee" ${OUT}/><path d="M-1.6 15 L0 18 L1.6 15" fill="#b02a2a"/>
        <rect x="-3.4" y="30" width="6.8" height="3" rx="1" fill="#c9a040" ${OUT}/>`, lampo: 0, punta: 45 }),
    rotolo: () => ({ svg: `<rect x="-4.5" y="-2" width="9" height="26" rx="4" fill="#ece4c8" ${OUT}/><path d="M-2 4 L2 4 M-2 8 L2 8 M-2 12 L2 12 M-2 16 L1 16" stroke="#8a7a5a" stroke-width=".7"/><rect x="-5.6" y="-3" width="11.2" height="4.4" rx="2" fill="#8a5a2a" ${OUT}/><rect x="-5.6" y="20" width="11.2" height="4.4" rx="2" fill="#8a5a2a" ${OUT}/>`, lampo: 0, punta: 24 }),
    lettera: () => ({ svg: `<rect x="-8.5" y="2" width="17" height="12" rx=".8" fill="#f4eedc" ${OUT}/><path d="M-8.5 2 L0 9.5 L8.5 2" fill="none" stroke="#1b1422" stroke-width="1"/><circle cx="0" cy="9.5" r="2" fill="#b02a2a" stroke="#1b1422" stroke-width=".6"/>`, lampo: 0, punta: 14 }),
    cartella: () => ({ svg: `<path d="M-3 -1 Q0 -4 3 -1" stroke="#3a2a1a" stroke-width="1.6" fill="none"/><rect x="-9" y="1" width="18" height="21" rx="2" fill="#8a6a3a" ${OUT}/><rect x="-9" y="8" width="18" height="3" fill="#5a4222"/><rect x="-1.5" y="7.5" width="3" height="4" fill="#d9b44a" stroke="#1b1422" stroke-width=".6"/>`, lampo: 0, punta: 22 }),
    palma: () => ({ svg: `<path d="M0 -12 L0 32" stroke="#5a7a2a" stroke-width="2"/>${[4, 11, 18, 25].map(y => `<path d="M0 ${y} Q-11 ${y - 4} -13 ${y - 13} Q-3 ${y - 8} 0 ${y} M0 ${y} Q11 ${y - 4} 13 ${y - 13} Q3 ${y - 8} 0 ${y}" fill="#86b04e" ${OUT}/>`).join('')}`, lampo: 0, punta: 32 }),
    torcia: () => ({ svg: `<rect x="-2" y="-6" width="4" height="28" rx="1.5" fill="#6a4a2a" ${OUT}/><path d="M-3 20 L3 20 L3.6 26 L-3.6 26 Z" fill="#4a3a2a" ${OUT}/>
        <path class="fiamma" d="M0 25 Q-9 36 -2 49 Q-1 42 2 40 Q3 45 1 50 Q9 38 0 25 Z" fill="#ff8a3d" ${OUT}/><path d="M0 30 Q-4 38 0 45 Q4 38 0 30 Z" fill="#ffe27a"/>`, lampo: 0, punta: 46 }),
    spada: () => ({ svg: `<rect x="-1.8" y="-6" width="3.6" height="9" fill="#3a2a1a" ${OUT}/><circle cy="-7" r="2.4" fill="#b8923a" ${OUT}/><rect x="-7.5" y="3" width="15" height="3.4" rx="1.2" fill="#b8923a" ${OUT}/><path d="M-2.6 6.4 L2.6 6.4 L2.6 42 L0 48 L-2.6 42 Z" fill="#dfe6ee" ${OUT}/><path d="M0 7 L0 44" stroke="#9aa4b2" stroke-width=".8"/>`, lampo: 0, punta: 48 }),
    mazza: () => ({ svg: `<rect x="-1.8" y="-8" width="3.6" height="31" rx="1.4" fill="#6a4a2a" ${OUT}/><circle cx="0" cy="27" r="7.5" fill="#5a5a66" ${OUT}/><circle cx="0" cy="27" r="7.5" fill="url(#gMetal)"/><path d="M-7.5 27 L-11 27 M7.5 27 L11 27 M0 34.5 L0 38 M0 19.5 L0 16 M-5.3 21.7 L-7.8 19.2 M5.3 32.3 L7.8 34.8" stroke="#5a5a66" stroke-width="3" stroke-linecap="round"/>`, lampo: 0, punta: 36 }),
    fucile: () => ({ svg: `<path d="M-5 -19 L5 -19 L3.4 -2 L-3.4 -2 Z" fill="#5e3c1e" ${OUT}/><path d="M-5 -19 L5 -19" stroke="#2a1a0c" stroke-width="2.4"/><path d="M-3.4 -2 L3.4 -2 L2.6 28 L-2.6 28 Z" fill="#7a4e26" ${OUT}/>
        <rect x="-1.5" y="-1" width="3" height="48" fill="#4a4a54" ${OUT}/><rect x="-1.5" y="-1" width="3" height="48" fill="url(#gMetal)"/><rect x="-2.8" y="10" width="5.6" height="2" fill="#2a2a32"/><rect x="-2.8" y="24" width="5.6" height="2" fill="#2a2a32"/>
        <path d="M2.6 0 L7.4 2.6" stroke="#1b1422" stroke-width="2.6" stroke-linecap="round"/><path d="M2.6 0 L7.4 2.6" stroke="#9a9aa8" stroke-width="1.2" stroke-linecap="round"/><circle cx="7.6" cy="2.8" r="1.8" fill="#6a6a78" ${OUT}/>
        <path d="M-3.4 -10 Q-9 10 -2.6 26" stroke="#3a2a1a" stroke-width="1.2" fill="none"/>
        <path d="M-1.6 47 L1.6 47 L.6 63 L0 65 L-.6 63 Z" fill="#dfe6ee" ${OUT}/>`, lampo: 48, punta: 65 }),
    lanterna: () => ({ svg: `<path d="M0 -2 L0 6" stroke="#8a6a2a" stroke-width="1.6"/><rect x="-5.5" y="6" width="11" height="14" rx="2" fill="#3a2f20" ${OUT}/><rect x="-3.8" y="8" width="7.6" height="10" fill="#ffd75e"/><circle cx="0" cy="13" r="11" fill="#ffd75e" opacity=".22"/>`, lampo: 0, punta: 20 }),
    ruota: () => ({ svg: `<circle cx="0" cy="13" r="13" fill="none" stroke="#1b1422" stroke-width="3.4"/><circle cx="0" cy="13" r="13" fill="none" stroke="#c9ccd6" stroke-width="1.6"/><circle cx="0" cy="13" r="2" fill="#8a8a94" ${OUT}/><path d="M0 0 L0 26 M-13 13 L13 13 M-9.2 3.8 L9.2 22.2 M9.2 3.8 L-9.2 22.2" stroke="#9a9ca8" stroke-width=".8"/>`, lampo: 0, punta: 26 })
  };  Arte.ARMI = ARMI;   // esposto per la galleria

  /* Scudi: disegnati nel pezzo dell'avambraccio arretrato, centrati vicino alla mano. */
  const SCUDI = {
    scutum: (c1, c2, x) => `${forma(`M${x - 13} 70 Q${x - 1} 66 ${x + 11} 70 L${x + 11} 118 Q${x - 1} 122 ${x - 13} 118 Z`, c1)}
      <path d="M${x - 1} 69 L${x - 1} 120 M${x - 11} 94 L${x + 9} 94" stroke="${c2}" stroke-width="1.8"/><path d="M${x - 9} 76 L${x - 4} 82 M${x + 7} 76 L${x + 2} 82 M${x - 9} 112 L${x - 4} 106 M${x + 7} 112 L${x + 2} 106" stroke="${c2}" stroke-width="1.6"/>
      <circle cx="${x - 1}" cy="94" r="5.4" fill="${c2}" ${OUT}/><circle cx="${x - 1}" cy="94" r="5.4" fill="url(#gMetal)"/>`,
    clipeo: (c1, c2, x) => `<circle cx="${x - 1}" cy="94" r="16" fill="${c1}" ${OUT}/><circle cx="${x - 1}" cy="94" r="16" fill="url(#gCel)"/><circle cx="${x - 1}" cy="94" r="11" fill="none" stroke="${c2}" stroke-width="2.2"/>
      <circle cx="${x - 1}" cy="94" r="4" fill="${c2}" ${OUT}/><circle cx="${x - 1}" cy="94" r="4" fill="url(#gMetal)"/>`
  };

  /* ---------- Capelli e barba ----------
   * Il volto guarda a destra (3/4). La frangia finisce sempre sopra le sopracciglia (y ≤ 27.5) davanti agli occhi;
   * `dietro` (massa posteriore) si disegna dietro al busto, `davanti` sopra la testa. */
  function capelli(stile, c) {
    const lc = chiaro(c, 0.32), dc = scuro(c, 0.32);
    const luce = `<path d="M49.5 18 Q57 13.4 67.5 14.6" stroke="${lc}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".7"/><path d="M70.5 16 Q72.5 17 73.6 18.6" stroke="${lc}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".6"/>`;
    const frangia = `M44 33 Q41.5 10.5 60.5 10 Q79 10 78.2 26.6 Q76.6 24.8 75.2 27.4 L72.8 23.6 L70.2 27.4 L67.4 23.2 L64.6 27 L62 22.8 Q56.5 23.6 53.8 28.6 L52.6 39.5 Q47.4 40.8 44 33 Z`;
    const ciocche = `<path d="M62 22.8 Q60 18 63 14.5 M67.4 23.2 Q67 18.6 70 15.8 M72.8 23.6 Q73.4 20 76 18.6" stroke="${dc}" stroke-width=".9" fill="none" opacity=".75"/>`;
    const base = `<path d="${frangia}" fill="${c}" ${OUT}/><path d="${frangia}" fill="url(#gCel)"/>${ciocche}${luce}`;
    switch (stile) {
      case 'lungo': return {
        dietro: `${forma('M46 19 Q34 40 37.5 66 Q40 78 51 78.5 Q60.5 78 62 72 Q57 62 56 50 L51 41 Q45.5 35 46 19 Z', c)}<path d="M42 44 Q41 60 46 72 M47 46 Q47 60 52 74" stroke="${dc}" stroke-width="1" fill="none"/>`,
        davanti: base + `<path d="M44.4 30 Q42 44 45.6 52 Q48.6 46 49.6 39 Z" fill="${c}" ${OUT}/>` };
      case 'trecce': return {
        dietro: `<path d="M47 36 Q41 52 44 74" stroke="#1b1422" stroke-width="8.6" fill="none" stroke-linecap="round"/><path d="M47 36 Q41 52 44 74" stroke="${c}" stroke-width="6.2" fill="none" stroke-linecap="round"/>
          ${[42, 49, 56, 63, 70].map((y, i) => `<path d="M${f1(43.4 - (i < 2 ? 1.4 - i : 0) + (i > 2 ? i - 2 : 0) * 0.4)} ${y} q2.6 2.6 5.2 0" stroke="${dc}" stroke-width="1" fill="none"/>`).join('')}
          <path d="M41.6 74.5 L46.4 74.5 L45 79 L43 79 Z" fill="#c04040" ${OUT}/>`,
        davanti: base };
      case 'raccolto': return { dietro: `<circle cx="45.5" cy="20" r="7" fill="${c}" ${OUT}/><path d="M41 17 Q45 14 50 17" stroke="${lc}" stroke-width="1.4" fill="none" opacity=".7"/><path d="M47 13 L52 9" stroke="#d9b44a" stroke-width="1.4"/>`, davanti: base };
      case 'riccio': {
        const pt = [[47.5, 22.5, 6.2], [53.5, 15.6, 6.4], [61, 12.6, 6.4], [68.6, 13.8, 6.2], [74.6, 18.6, 5.6], [44.6, 31, 5.6], [77.4, 24, 3.6], [57.4, 21.4, 4.4], [64.6, 21, 4.6], [71.6, 21.6, 4]];
        return { dietro: `<g fill="${c}" ${OUT}><circle cx="43.6" cy="38" r="5.6"/><circle cx="46" cy="46" r="5"/><circle cx="41.6" cy="29" r="5"/></g>`,
          davanti: `<g fill="${c}" ${OUT}>${pt.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}"/>`).join('')}</g><path d="M50.4 39 L52.6 39.5 L53.8 28.6 Q51 30 50.4 39 Z" fill="${c}"/>
            ${pt.slice(0, 5).map(p => `<path d="M${p[0] - 2.6} ${p[1] - 1.4} q2.4 -2.4 4.6 -.6" stroke="${lc}" stroke-width="1.2" fill="none" opacity=".7"/>`).join('')}` };
      }
      case 'calvo': return { dietro: '', davanti: `<path d="M44.4 34 Q43.6 25 47.8 21.6 Q48.6 31 51.2 39.6 Q46.2 40 44.4 34 Z" fill="${c}" ${OUT}/><path d="M52 17 Q58 14.6 66 15.6" stroke="#fff" stroke-width="2" fill="none" opacity=".25" stroke-linecap="round"/>` };
      case 'coda': return { dietro: `${forma('M47 20 Q36 26 33 44 Q32 56 36 62 Q38 50 44 40 Q48 32 50 26 Z', c)}<rect x="44.6" y="21" width="4" height="5" rx="1" fill="#c04040" transform="rotate(-30 46.6 23.5)"/>`, davanti: base };
      default: return { dietro: '', davanti: base };
    }
  }
  function barba(tipo, c) {
    const lc = chiaro(c, 0.3);
    switch (tipo) {
      case 'barba': return `${forma('M49.4 37 Q48.8 54.5 62.5 57 Q75.6 55.6 76.6 41.5 Q72.6 47.6 67.4 46.6 Q63 49.4 58 46.4 Q52.4 45 49.4 37 Z', c)}<path d="M66 42.2 Q71 40.2 76.4 42.4 Q75 44.6 71.4 43.8 Q68 45.2 66 42.2 Z" fill="${c}" ${OUT}/><path d="M57 50 Q61 54 66 52.4 M62 53.6 Q66 55.6 70 53" stroke="${lc}" stroke-width=".9" fill="none" opacity=".6"/>`;
      case 'pizzo': return `<path d="M66.4 48 Q69.6 57.6 73.8 47.8 Q70 50 66.4 48 Z" fill="${c}" ${OUT}/><path d="M66.6 42.4 Q71 40.8 75.8 42.8 Q71.6 44.6 66.6 42.4 Z" fill="${c}" ${OUT}/>`;
      case 'baffi': return `<path d="M65.6 42.4 Q71 39.6 76.8 42.4 Q75.4 45.2 71.4 43.8 Q67.6 45.6 65.6 42.4 Z" fill="${c}" ${OUT}/><path d="M65.6 42.4 Q63.6 41 63.8 39" stroke="${c}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
      default: return '';
    }
  }

  /* ---------- Copricapi (c1 = principale, c2 = accento). Il bordo davanti agli occhi resta a y ≤ 27.5. ---------- */
  const TESTE = {
    elmo_romano: (c1, c2) => `${metallo('M43 31 Q42 9 60.5 9 Q79 9 79 28.6 L43 31 Z', c1)}<path d="M42.4 27.4 L79.6 25.6 L79.6 29.2 L42.4 31 Z" fill="${scuro(c1, 0.25)}" ${OUT}/>
      ${metallo('M44.6 30.4 L47 48 L54.4 33 Z', c1)}<path d="M43 26 L38.6 34 L45 32.6 Z" fill="${scuro(c1, 0.15)}" ${OUT}/>
      <path d="M47 12.6 Q60.5 -11 75.6 12.6 L69.6 12.6 Q60.5 0 53 12.6 Z" fill="${c2}" ${OUT}/><path d="M51 9 Q60.5 -5 71 9" stroke="${scuro(c2, 0.35)}" stroke-width=".9" fill="none"/><path d="M54 5 L56 10 M60.5 1.5 L60.5 8 M67 5 L65 10" stroke="${scuro(c2, 0.35)}" stroke-width=".8"/>`,
    elmo_cartaginese: (c1, c2) => `${metallo('M43 31 Q42 9 60.5 9 Q79 9 79 28.6 L43 31 Z', c1)}<path d="M42.4 27.4 L79.6 25.6 L79.6 29.2 L42.4 31 Z" fill="${scuro(c1, 0.25)}" ${OUT}/>
      <path d="M53 12 Q51 -13 66 -8 Q58 -1 66.6 11 Z" fill="${c2}" ${OUT}/><path d="M56 6 Q57 -4 63 -6" stroke="${chiaro(c2, 0.3)}" stroke-width="1" fill="none"/>${metallo('M44.6 30.4 L47.6 50 L54.4 33 Z', c1)}
      <path d="M45 20 Q49 14 54 13" stroke="${chiaro(c1, 0.5)}" stroke-width="1.4" fill="none" opacity=".8"/>`,
    elmo_medievale: (c1) => `${metallo('M43 31 Q42 10 60.5 10 Q79 10 79 28.6 L43 31 Z', c1)}<path d="M42.4 27 L79.6 25.2 L79.6 29 L42.4 30.8 Z" fill="${scuro(c1, 0.3)}" ${OUT}/>
      ${metallo('M66.4 27.6 L69.4 27.4 L69.2 42 L66.6 42 Z', c1)}${metallo('M44.6 30.4 L46.6 47 L53.6 33 Z', c1)}<path d="M60.5 10 L60.5 26" stroke="${scuro(c1, 0.3)}" stroke-width="1.1"/>`,
    alloro: (c1) => `<path d="M45 27 Q60 16 77 23" stroke="${scuro(c1, 0.3)}" stroke-width="1.2" fill="none"/><g fill="${c1}" ${OUT}>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => { const a = Math.PI * (1.02 + i * 0.094), x = 61 + 16.6 * Math.cos(a), y = 31 + 13.4 * Math.sin(a); return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="3.9" ry="1.8" transform="rotate(${(a * 180 / Math.PI + 70 + (i % 2) * 40).toFixed(0)} ${f1(x)} ${f1(y)})"/>`; }).join('')}</g>`,
    corona: (c1) => `${metallo('M48 25.4 L49 11 L55 18.6 L60.5 8 L66 18.6 L72 11 L73 25.4 Z', c1)}<path d="M47.6 22.6 L73.4 22.6 L73.4 26.2 L47.6 26.2 Z" fill="${scuro(c1, 0.2)}" ${OUT}/><circle cx="60.5" cy="20" r="1.9" fill="#c0303f" ${OUT}/><circle cx="53" cy="24.4" r="1.1" fill="#3a6ac0"/><circle cx="68" cy="24.4" r="1.1" fill="#3a6ac0"/>`,
    velo_corona: (c1) => ({ dietro: `${forma('M45.5 22 Q35 40 37 66 L46 80 L64 72 Q60 56 58 46 L51 38 Z', '#ece4d4')}<path d="M42 46 Q42 62 47 76" stroke="#c8c0b0" stroke-width="1" fill="none"/>`,
      davanti: `${forma('M44.6 30 Q43.6 12 60.5 11.4 Q77.6 11.4 78.4 27 Q69 22.4 60.5 22.6 Q52 23 47.6 30 L46.6 40 Q44.2 37 44.6 30 Z', '#ece4d4')}${metallo('M49 24 L50 12.6 L55.4 19 L60.5 10 L65.6 19 L71 12.6 L72 24 Z', c1)}<circle cx="60.5" cy="19.6" r="1.6" fill="#3a6ac0" ${OUT}/>` }),
    cappello_piuma: (c1, c2) => `<path d="M48 21 Q48.6 7 61 7 Q73 7 73.6 19" fill="${c1}" ${OUT}/><ellipse cx="59" cy="21.4" rx="20" ry="5.6" fill="${c1}" ${OUT} transform="rotate(-7 59 21.4)"/><ellipse cx="59" cy="20.6" rx="20" ry="5.6" fill="url(#gCel)" transform="rotate(-7 59 21.4)"/>
      <path d="M48.6 17 Q61 14 73.4 15.8 L73.6 19 Q61 17 48.4 20.4 Z" fill="${c2}"/><path d="M68 15 Q86 0 94 18 Q84 8 72 19 Z" fill="${c2}" ${OUT}/><path d="M72 16 Q82 8 90 14" stroke="${scuro(c2, 0.3)}" stroke-width=".8" fill="none"/>`,
    berretto: (c1) => `${forma('M42.6 30.6 Q41 11 62 10 Q82 10.6 79 27 Q61 20.4 42.6 30.6 Z', c1)}<path d="M43.4 27.6 Q61 18.6 79.2 24.4 L79 27.6 Q61 21 42.8 30.8 Z" fill="${scuro(c1, 0.3)}"/><circle cx="62" cy="10.4" r="1.6" fill="${scuro(c1, 0.3)}"/>`,
    aviatore: (c1, c2) => `${forma('M43.6 34 Q42 11 60.5 11 Q79 11 78.6 27 Q74 24 70 25.4 L50 27 Q47 30 47 36 Z', c1)}${forma('M43.6 33 L44 47 Q48 49 51 45 L50.6 34 Z', c1)}
      <path d="M49 19.6 Q61 15.6 76.6 19" stroke="${scuro(c1, 0.4)}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="59" cy="18.4" r="4" fill="${c2}" ${OUT}/><circle cx="69.6" cy="18.6" r="3.6" fill="${c2}" ${OUT}/>
      <path d="M57.4 16.6 Q58.6 15.8 60 16.4 M68.2 16.8 Q69.2 16 70.4 16.6" stroke="#fff" stroke-width=".9" fill="none"/>`,
    fazzoletto: (c1) => `${forma('M43.8 35 Q42 11 60.5 11 Q79 11 78.6 27 Q69 22.6 60.5 22.8 Q52 23.4 47.4 31 L47 40 Q44 39 43.8 35 Z', c1)}${forma('M45 30 L35 48 L41 50 L47.6 38 Z', c1)}${forma('M45 32 L37 30 L40 36 Z', scuro(c1, 0.15))}
      <path d="M50 16 Q60 12 70 14" stroke="${chiaro(c1, 0.35)}" stroke-width="1.6" fill="none" opacity=".7"/>`,
    fedora: (c1, c2) => `${forma('M47.6 21 Q47 3.6 61 3.6 Q75 3.6 74.6 21 Z', c1)}<path d="M54 5.4 Q61 9 68 5.4" stroke="${scuro(c1, 0.35)}" stroke-width="1.2" fill="none"/><rect x="47.4" y="15.6" width="27.4" height="4.8" fill="${c2}"/><ellipse cx="61" cy="22" rx="22" ry="4.8" fill="${c1}" ${OUT}/><ellipse cx="61" cy="21.4" rx="22" ry="4.8" fill="url(#gCel)"/>`,
    basco: (c1) => `<ellipse cx="57.6" cy="17" rx="18" ry="7.4" fill="${c1}" ${OUT} transform="rotate(-10 57.6 17)"/><ellipse cx="57.6" cy="16" rx="18" ry="7.4" fill="url(#gCel)" transform="rotate(-10 57.6 17)"/><path d="M55 9.6 L54.4 6.6" stroke="${c1}" stroke-width="2" stroke-linecap="round"/>`,
    cappellino_ciclista: (c1) => `${forma('M45.6 28 Q45 10.6 61 10.6 Q77 10.6 77.6 26.4 Z', c1)}<path d="M50 13 L50 27 M61 10.6 L61 26.8 M71.6 13 L71.6 26.6" stroke="#c0303f" stroke-width="1.6"/><path d="M76 23.6 L91 25.4 L77 28.4 Z" fill="${c1}" ${OUT}/>`,
    cappuccio: (c1) => `${forma('M40.6 54 Q37 5 60.5 5 Q84 5 80.6 52 L74 60 Q61 45 48 60 Z', c1)}<path d="M49.4 25 Q61 16.6 74.6 24 L76.4 44.4 Q62 53 48.6 44.6 Z" fill="#08060c"/><path d="M49.4 25 Q61 16.6 74.6 24" stroke="${scuro(c1, 0.4)}" stroke-width="1.6" fill="none"/>
      <path d="M44 20 Q50 9 62 8" stroke="${chiaro(c1, 0.3)}" stroke-width="1.6" fill="none" opacity=".7"/>`,
    bicorno: (c1, c2) => `${forma('M36.6 26 Q60 2 86 23 Q79 30 61 23.6 Q45 30 36.6 26 Z', c1)}<path d="M36.6 26 Q60 2 86 23" stroke="${c2}" stroke-width="2" fill="none"/><circle cx="62" cy="17" r="3" fill="${c2}" ${OUT}/><circle cx="62" cy="17" r="1.4" fill="#c0303f"/>`,
    elmetto: (c1) => `${metallo('M43.4 28 Q42.6 9.6 60.5 9.6 Q78.4 9.6 78.6 26 Z', c1)}<path d="M38 28.6 L83 25 L83.4 28.4 L38.4 32 Z" fill="${c1}" ${OUT}/><path d="M38 28.6 L83 25" stroke="${chiaro(c1, 0.3)}" stroke-width=".8"/><path d="M52 11.4 Q60.5 5.4 69 11.4" stroke="${scuro(c1, 0.3)}" stroke-width="2.2" fill="none"/>`,
    cappuccio_aperto: (c1) => ({ dietro: `${forma('M43 22 Q36 50 42 70 L64 64 Q60 50 58 42 Z', scuro(c1, 0.15))}`,
      davanti: `${forma('M43 36 Q41 11 60.5 10.4 Q79 10.4 78.6 27 Q70 21.6 60.5 22 Q51.6 22.6 47.6 32 L48 44 Q44 42 43 36 Z', c1)}<path d="M47.6 32 Q51.6 22.6 60.5 22 Q70 21.6 78.6 27" stroke="${scuro(c1, 0.35)}" stroke-width="1.2" fill="none"/>` }),
    fascia: (c1) => `<path d="M43.6 25 Q60.5 17 78.6 22.6 L78.6 26.6 Q60.5 21.4 43.8 29.4 Z" fill="${c1}" ${OUT}/><path d="M44 26 L36 33 L39 35 L45 29 M44 27 L38 38" stroke="${c1}" stroke-width="2.6" stroke-linecap="round"/>`
  };

  /* ---------- Accessori e segni sul viso ---------- */
  function accessorio(nome, c, d) {
    switch (nome) {
      case 'catene': return `<g fill="none" stroke="#1b1422" stroke-width="3.2"><path d="M${60 - d.sw + 2} 60 L${60 + d.ww} 94"/></g><g fill="none" stroke="#9a9aa6" stroke-width="1.8" stroke-dasharray="3 1.4"><path d="M${60 - d.sw + 2} 60 L${60 + d.ww} 94"/></g>`;
      case 'sciarpa': return `${forma('M50 52.6 Q60.5 61 71 52.6 L72.6 58.6 Q60.5 67 48.4 58.6 Z', c)}${forma('M49 58 L35 80 L41.4 82 L53 62 Z', c)}<path d="M41 80 L36 84 M43 81 L40 86" stroke="${c}" stroke-width="1.4"/>`;
      default: return '';
    }
  }
  function sulViso(acc) {
    switch (acc) {
      case 'occhiali': return `<g fill="#cfe4f0" fill-opacity=".18" stroke="#2a2030" stroke-width="1.1"><circle cx="63" cy="35.8" r="4.6"/><ellipse cx="72.4" cy="35.8" rx="3.2" ry="4.2"/></g><path d="M67.6 35.4 L69.2 35.4 M58.4 35.2 L50 34.6" stroke="#2a2030" stroke-width="1.1"/><path d="M60.6 33.6 L62.4 32.8" stroke="#fff" stroke-width=".8" opacity=".8"/>`;
      case 'benda': return `<path d="M68.4 31.6 Q72.4 30.4 76.4 32.6 L76 39.6 Q72 41 68.8 38.6 Z" fill="#15101c" ${OUT}/><path d="M44.6 25 L69 33 M76.2 33.4 L78 34" stroke="#15101c" stroke-width="1.8"/>`;
      default: return '';
    }
  }

  /* ---------- Mantello e gerla (dietro al corpo) ---------- */
  function mantello(c, d) {
    const p = `M${60 - d.sw + 1} 56 Q${60 - d.sw - 14} 98 ${60 - d.sw - 20} 160 Q${60 - d.sw - 8} 167 ${60 - 4} 162 Q${60 + d.hw - 2} 150 ${60 + d.hw + 1} 128 L${60 + d.sw - 3} 56 Z`;
    return `${forma(p, c, true)}<path d="M${60 - d.sw + 3} 62 Q${60 - d.sw - 8} 104 ${60 - d.sw - 12} 158 M${60 - 6} 70 Q${60 - 10} 110 ${60 - 14} 160" stroke="${scuro(c, 0.32)}" stroke-width="1.1" fill="none"/>
      <path d="M${60 - d.sw - 20} 160 Q${60 - d.sw - 8} 167 ${60 - 4} 162" stroke="${chiaro(c, 0.25)}" stroke-width="1.2" fill="none"/>`;
  }
  const GERLA = `${forma('M28 62 L47 62 L49 114 L26 114 Z', '#8a6a3a')}<path d="M28 74 L47.4 74 M27.4 86 L48 86 M27 98 L48.6 98 M33 62 L32 114 M40 62 L40 114" stroke="#5a4222" stroke-width="1.1"/><path d="M47 60 L58 58 M48 113 L54 104" stroke="#4a321a" stroke-width="2.2" fill="none"/><path d="M30 62 Q37 52 45 62" fill="#6a8a3a" ${OUT}/>`;

  /* ---------- Figura umanoide (parti separate e articolate) ----------
   * Gerarchia dei pezzi (ognuno ruota attorno alla sua articolazione):
   *   braccio (spalla) > avambraccio (gomito) > arma (mano)  ·  gamba (anca) > stinco (ginocchio)  ·  testa (collo) > occhi, bocca */
  function umanoide(spec) {
    const vb = VB_UMANO, d = DIM[spec.corpo || 'm'];
    const pelle = spec.pelle || '#e6bf9f', pelleOmbra = mix(pelle, '#6a2a4a', 0.28);
    const ab = spec.abito || { tipo: 'tunica', c1: '#999', c2: '#666' };
    const A = ABITI[ab.tipo](ab.c1, ab.c2, d);
    const manica = A.manica === 'nuda' ? pelle : (A.manica || ab.c1);
    const avamb = A.corta || A.manica === 'nuda' ? pelle : manica;
    const pant = A.pant === 'nuda' ? pelle : (A.pant || ab.c2);
    const xR = fx(60 + d.sw) - d.ga * 0.45, xL = 60 - d.sw + d.ga * 0.4;   // spalla lontana (dx) un po' dietro il busto girato

    // --- braccia: omero e avambraccio affusolati, polsino, mano a pugno
    const omero = (x, col) => `${forma(seg(x, Y.spalla - 1.5, x, Y.gomito, d.ga * 1.12, d.ga * 0.86), col)}${A.sbuffi ? `<ellipse cx="${x}" cy="${Y.spalla + 4}" rx="${f1(d.ga * 0.95)}" ry="6.4" fill="${col}" ${OUT}/><path d="M${f1(x - 2)} ${Y.spalla} L${f1(x - 2)} ${Y.spalla + 9} M${f1(x + 2)} ${Y.spalla} L${f1(x + 2)} ${Y.spalla + 9}" stroke="${A.sbuffi}" stroke-width="1.4"/>` : ''}${A.metalloBraccia ? metallo(seg(x, Y.spalla - 1, x, Y.spalla + 9, d.ga * 1.35, d.ga * 1.1), col) : ''}`;
    const avambraccio = (x, col) => `${forma(seg(x, Y.gomito, x, Y.polso, d.ga * 0.86, d.ga * 0.68), col)}${giunto(x, Y.gomito, d.ga * 0.86, col)}
      ${A.polsini ? `<rect x="${f1(x - d.ga * 0.42)}" y="${Y.polso - 3}" width="${f1(d.ga * 0.84)}" height="3" fill="${A.polsini}" ${OUT}/>` : ''}
      ${A.metalloBraccia ? metallo(seg(x, Y.gomito + 3, x, Y.polso - 2, d.ga * 1.0, d.ga * 0.86), manica) : ''}
      ${!A.corta && A.manica !== 'nuda' && !A.polsini ? `<rect x="${f1(x - d.ga * 0.46)}" y="${Y.polso - 3.4}" width="${f1(d.ga * 0.92)}" height="3.4" rx="1" fill="${scuro(col, 0.25)}" ${OUT}/>` : ''}`;
    const mano = (x) => `<path d="M${f1(x - 4.2)} ${Y.mano - 3} Q${f1(x - 4.6)} ${Y.mano + 3.4} ${x} ${Y.mano + 3.6} Q${f1(x + 4.6)} ${Y.mano + 3.2} ${f1(x + 4.2)} ${Y.mano - 3} Q${x} ${Y.mano - 5} ${f1(x - 4.2)} ${Y.mano - 3} Z" fill="${pelle}" ${OUT}/><path d="M${f1(x + 2.6)} ${Y.mano - 2.4} Q${f1(x + 5.6)} ${Y.mano} ${f1(x + 3)} ${Y.mano + 2.4}" fill="${pelle}" ${OUT}/>`;

    // --- gambe: coscia e stinco + scarpa che punta in avanti (destra)
    const coscia = (xa, xg) => forma(seg(xa, Y.anca, xg, Y.ginocchio, d.gl, d.gl * 0.8), pant);
    const scarpa = (x) => {
      const c = A.stivale || '#222';
      return `${forma(`M${f1(x - 4.8)} 187 L${f1(x - 5)} 178.4 Q${x} 175 ${f1(x + 4.2)} 178.8 Q${f1(x + 11.6)} 180.6 ${f1(x + 11.8)} 185 L${f1(x + 11.8)} 187.4 Z`, c)}<path d="M${f1(x - 4.8)} 186 L${f1(x + 11.8)} 186" stroke="${scuro(c, 0.45)}" stroke-width="1.4"/>`;
    };
    const stinco = (xg, xc, lato) => {
      const c = A.alti ? (A.stivale || '#222') : (A.calze && A.calzeAlte ? A.calze : pant);
      const cs = pant === pelle && A.calzeAlte ? pelle : pant;
      let s = forma(seg(xg, Y.ginocchio, xc, Y.caviglia, d.gl * 0.8, d.gl * 0.6), cs) + giunto(xg, Y.ginocchio, d.gl * 0.8, cs);
      if (A.alti) s += forma(seg(xg + (xc - xg) * 0.45, Y.ginocchio + 16, xc, Y.caviglia + 2, d.gl * 0.86, d.gl * 0.7), A.stivale);
      else if (A.calze) s += forma(seg(xg + (xc - xg) * (A.calzeAlte ? 0.35 : 0.7), Y.ginocchio + (A.calzeAlte ? 12 : 26), xc, Y.caviglia + 1, d.gl * 0.74, d.gl * 0.62), A.calze);
      if (A.fasce) s += `<path d="M${xc - 4} 152 L${xc + 4} 156 M${xc - 4} 160 L${xc + 4} 164" stroke="${scuro(A.stivale || '#222')}" stroke-width="1.2"/>`;
      if (A.sandali) s += `<path d="M${xc - 4} 172 L${xc + 4} 168 M${xc - 4} 176 L${xc + 4} 172" stroke="#6a4a2a" stroke-width="1.4"/>`;
      return s + scarpa(xc) + (lato === 'lontano' ? `<path d="${seg(xg, Y.ginocchio, xc, Y.caviglia, d.gl * 0.8, d.gl * 0.6)}" fill="#140a1e" opacity=".18"/>` : '');
    };

    const arma = spec.arma && ARMI[spec.arma] ? ARMI[spec.arma](spec.armaC1, spec.armaC2) : null;
    const cap = spec.capelli || {};
    const hc = cap.colore || '#3a2a1c';
    const hair = capelli(cap.stile, hc);
    let th = spec.testa && TESTE[spec.testa.tipo || spec.testa] ? TESTE[spec.testa.tipo || spec.testa](spec.testa.c1 || '#888', spec.testa.c2 || '#c33') : '';
    let thDietro = '';
    if (th && typeof th === 'object') { thDietro = th.dietro || ''; th = th.davanti || ''; }
    const cappuccio = spec.testa && spec.testa.tipo === 'cappuccio';
    const coperto = spec.testa && ['elmo_romano', 'elmo_cartaginese', 'elmo_medievale', 'aviatore', 'cappuccio', 'fazzoletto', 'elmetto', 'cappuccio_aperto', 'velo_corona'].includes(spec.testa.tipo);
    const glow = spec.glow || '#ffd75e';
    const iride = spec.iride || (spec.eco ? glow : mix(hc, '#6a4a2a', 0.4));
    const ciglia = (spec.corpo === 'f');

    // espressione (dal carattere: spec.espr oppure dedotta dalla personalità di riposo)
    const ESPR_IDLE = { fiero: 'fiero', regale: 'severo', nervoso: 'grinta', sereno: 'gentile', curioso: 'sorriso', sfrontato: 'sorriso', composto: 'serio', dondola: 'sorriso', spettro: 'severo', pesante: 'severo' };
    const espr = spec.espr || ESPR_IDLE[spec.idle] || 'serio';
    const BOCCHE = { sorriso: 'M68.2 43.8 Q70.8 46.6 73.2 43.8', gentile: 'M68.6 44.4 Q70.8 45.8 72.8 44.2', serio: 'M68.8 44.8 Q70.8 45.2 72.8 44.6', severo: 'M68.6 45.6 Q70.8 44.2 72.9 45.4', grinta: 'M68.4 45.2 Q71 45.6 73.1 43.6', fiero: 'M68.6 44.8 Q70.8 45.4 73 44.2' };
    const bocca = `<path d="${BOCCHE[espr] || BOCCHE.serio}" stroke="${spec.eco ? '#1b1422' : '#7a2a32'}" stroke-width="1.1" fill="none" stroke-linecap="round"/>${espr === 'sorriso' && !spec.eco ? '<path d="M67.6 43.4 L68.4 44" stroke="#7a2a32" stroke-width=".8" stroke-linecap="round"/>' : ''}`;
    const rughe = spec.eta === 'anziano' ? `<path d="M60.6 39.6 Q63 40.8 65.6 39.8 M70.6 39.8 Q72.4 40.6 74.2 39.8 M66.4 41.6 Q66 44 67.2 46 M58 22.6 Q62 21.6 66 22.4" stroke="${pelleOmbra}" stroke-width=".8" fill="none" opacity=".8"/>` : '';
    // --- testa: cranio a uovo con mento in avanti, ombra cel netta sulla nuca, orecchio, naso, guance
    const VISO = 'M44.5 30 Q44 13 60.5 13 Q76.5 13 77 28.5 Q77.6 38.5 74 44.5 Q69.5 50.5 62.5 50.5 Q53.5 50 48.5 44 Q44.5 38.5 44.5 30 Z';
    const testa = `<path d="${VISO}" fill="${pelle}" ${OUT}/>
      <path d="M44.5 30 Q44 13 60.5 13 Q52 16.4 50.6 28 Q50 40 57.6 50.3 Q52.6 49.4 48.5 44 Q44.5 38.5 44.5 30 Z" fill="${pelleOmbra}" opacity=".5"/>
      <path d="M76.6 26 Q77.6 36 74.4 43.4" stroke="#fff" stroke-width="1.2" fill="none" opacity=".35" stroke-linecap="round"/>
      <ellipse cx="50.2" cy="36.2" rx="2.7" ry="3.8" fill="${pelle}" ${OUT}/><path d="M50.6 34.4 Q49.2 36.2 50.6 38" stroke="${pelleOmbra}" stroke-width="1" fill="none"/>
      <path d="M76.8 34.6 Q79.4 38.8 76.2 40.6" fill="${pelle}" ${OUT}/>
      <ellipse cx="65.6" cy="41.4" rx="2.9" ry="1.3" fill="#ec6a7c" opacity="${spec.eco ? 0 : 0.3}"/><ellipse cx="75.4" cy="41.4" rx="1.3" ry="1.1" fill="#ec6a7c" opacity="${spec.eco ? 0 : 0.3}"/>
      ${rughe}${barba(cap.barba, hc)}${coperto ? '' : hair.davanti}${th}`;
    const urlo = `<path d="M68.2 43.8 Q70.6 43 73 43.6 Q72.4 47.8 70.4 47.8 Q68.6 47.4 68.2 43.8 Z" fill="#4a1420" stroke="#1b1422" stroke-width=".8"/><path d="M69 46.4 Q70.6 45.6 72 46.6" fill="#d05a6a"/><path d="M68.6 44 L72.6 43.8" stroke="#fff" stroke-width=".9"/>`;
    const occhi = spec.eco
      ? `<ellipse cx="63.6" cy="35.8" rx="5.6" ry="5.2" fill="${glow}" opacity=".22"/><ellipse cx="63.6" cy="35.8" rx="3" ry="3.6" fill="${glow}"/><ellipse cx="72.6" cy="35.8" rx="2" ry="3.4" fill="${glow}"/><ellipse cx="63.9" cy="35.6" rx="1.1" ry="1.6" fill="#fff"/>
         <path d="M59.4 31.6 Q63.4 30.4 67 32.4 M70.2 32.2 Q72.8 31.2 75 32.6" stroke="#1b1422" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
      : `<ellipse cx="63" cy="35.6" rx="3.4" ry="4.1" fill="#fff" stroke="#1b1422" stroke-width=".5"/><ellipse cx="72.3" cy="35.6" rx="2.3" ry="3.9" fill="#fff" stroke="#1b1422" stroke-width=".5"/>
         <ellipse cx="63.9" cy="36.1" rx="2.5" ry="3.3" fill="${iride}"/><ellipse cx="72.9" cy="36.1" rx="1.7" ry="3.1" fill="${iride}"/>
         <ellipse cx="63.9" cy="37.4" rx="2" ry="1.6" fill="${chiaro(iride, 0.35)}" opacity=".7"/><ellipse cx="72.9" cy="37.4" rx="1.3" ry="1.4" fill="${chiaro(iride, 0.35)}" opacity=".7"/>
         <ellipse cx="64.2" cy="36.3" rx="1.15" ry="1.8" fill="#120a16"/><ellipse cx="73.1" cy="36.3" rx=".85" ry="1.7" fill="#120a16"/>
         <circle cx="65" cy="34.6" r="1" fill="#fff"/><circle cx="73.6" cy="34.6" r=".75" fill="#fff"/><circle cx="62.9" cy="38" r=".5" fill="#fff" opacity=".8"/>
         <path d="M59.4 33 Q62.9 30.2 66.9 32.4" stroke="#1b1422" stroke-width="${ciglia ? 1.9 : 1.6}" fill="none" stroke-linecap="round"/><path d="M70 32.6 Q72.5 30.8 75 32.6" stroke="#1b1422" stroke-width="${ciglia ? 1.6 : 1.3}" fill="none" stroke-linecap="round"/>
         ${ciglia ? '<path d="M59.6 33 L57.8 31.8 M60.4 32.2 L59 30.6 M70.2 32.6 L69 31.4" stroke="#1b1422" stroke-width="1" stroke-linecap="round"/>' : ''}
         ${['fiero', 'grinta', 'severo'].includes(espr) ? `<path d="M59.4 33.2 Q63 31 66.9 32.6 L66.9 31 L59.4 31 Z" fill="${pelle}"/><path d="M59.4 33.4 Q62.9 31.2 66.9 32.8" stroke="#1b1422" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M70 32.8 Q72.5 31.4 75 32.8 L75 31 L70 31 Z" fill="${pelle}"/><path d="M70 33 Q72.5 31.6 75 33" stroke="#1b1422" stroke-width="1.4" fill="none" stroke-linecap="round"/>` : ''}`;
    const SOPR = { fiero: ['M59.2 28.6 Q63 27.4 66.8 29.6', 'M70 29.6 Q72.8 27.8 75.2 28.6'], grinta: ['M59.2 28.4 Q63 27.6 66.8 30.2', 'M70 30.2 Q72.8 27.6 75.2 28'], severo: ['M59.2 28.8 Q63 28 66.8 30', 'M70 30 Q72.8 28.4 75.2 28.8'],
      gentile: ['M59.2 29.6 Q63 27 66.8 28.2', 'M70 28.4 Q72.8 27.2 75.2 29'], sorriso: ['M59.2 29.2 Q63 26.8 66.8 28.4', 'M70 28.6 Q72.8 27.2 75.2 28.8'], serio: ['M59.2 29.4 Q63 27.6 66.8 28.8', 'M70 28.9 Q72.8 27.8 75.2 29'] };
    const sp = SOPR[espr] || SOPR.serio;
    const sopracciglia = spec.eco ? '' : `<path d="${sp[0]}" stroke="${scuro(hc, 0.15)}" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="${sp[1]}" stroke="${scuro(hc, 0.15)}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;

    // gamba lontana (a, destra) dietro e in ombra, gamba vicina (b, sinistra) davanti
    const xGa = fx(60 + d.hw * 0.5), xKa = fx(67), xCa = fx(69);
    const gambe = A.nascondiGambe || spec.eco ? '' :
      pezzo(vb, 'f-gamba f-gamba-a', xGa, Y.anca, coscia(xGa, xKa) + `<path d="${seg(xGa, Y.anca, xKa, Y.ginocchio, d.gl, d.gl * 0.8)}" fill="#140a1e" opacity=".18"/>`,
        pezzo(vb, 'f-stinco f-stinco-a', xKa, Y.ginocchio, stinco(xKa, xCa, 'lontano'))) +
      pezzo(vb, 'f-gamba f-gamba-b', 60 - d.hw * 0.5, Y.anca, coscia(60 - d.hw * 0.5, 55),
        pezzo(vb, 'f-stinco f-stinco-b', 55, Y.ginocchio, stinco(55, 53, 'vicino')));
    const piedi = A.nascondiGambe && !spec.eco ? pezzo(vb, 'f-piedi', 60, 180, scarpa(fx(66)) + scarpa(52)) : '';
    const coda = spec.eco ? pezzo(vb, 'f-coda', 60, 100, `<g mask="url(#mCoda)"><path d="M${60 - d.hw - 4} 100 Q${60 - d.hw - 10} 138 50 158 Q57 170 47 188 Q67 172 65 158 Q82 148 ${60 + d.hw + 4} 100 Z" fill="${mix(ab.c1, '#000', 0.2)}"/>
        <path d="M${60 - d.hw} 104 Q${60 - d.hw - 4} 132 54 150 Q60 160 55 176" stroke="${glow}" stroke-width="1.4" fill="none" opacity=".7"/></g>`) : '';
    const lampo = arma && arma.lampo ? `<g class="f-lampo" transform="translate(0,${arma.lampo})"><circle r="9" fill="url(#gLuce)"/><path d="M0 -9 L3 -2.4 L10 0 L3 2.4 L0 12 L-3 2.4 L-10 0 L-3 -2.4 Z" fill="#fff3a0"/><circle r="4" fill="#ff9a2a"/></g>` : '';
    const scudo = spec.scudo ? SCUDI[spec.scudo.tipo](spec.scudo.c1, spec.scudo.c2, xL) : '';
    const collo = `${forma(`M56 44 L65 44 L65.4 57 L55.6 57 Z`, pelle)}<path d="M55.8 47 Q60.5 52.6 65.2 47 L65.3 51.6 Q60.5 54.6 55.7 51.6 Z" fill="${pelleOmbra}" opacity=".55"/>`;
    const torsoSvg = treQuarti(`${collo}${A.svg}${accessorio(spec.accessorio, spec.accessorioC || '#f0ece0', d)}`);

    const armaPezzo = arma ? pezzo(vb, 'f-arma', xR, Y.mano, `<g transform="translate(${xR},${Y.mano})">${arma.svg}${lampo}</g>`) : '';
    const ombraA = (x1, y1, y2, w1, w2) => `<path d="${seg(x1, y1, x1, y2, w1, w2)}" fill="#140a1e" opacity=".2"/>`;
    // braccio lontano (a, destra, con l'arma): dietro al busto, in ombra
    const braccioA = pezzo(vb, 'f-braccio-a', xR, Y.spalla, omero(xR, manica) + ombraA(xR, Y.spalla - 1.5, Y.gomito, d.ga * 1.12, d.ga * 0.86),
      pezzo(vb, 'f-avambraccio f-avambraccio-a', xR, Y.gomito, avambraccio(xR, avamb) + mano(xR) + ombraA(xR, Y.gomito, Y.polso, d.ga * 0.86, d.ga * 0.68), armaPezzo));
    // braccio vicino (b, sinistra, con lo scudo): davanti al busto
    const braccioB = pezzo(vb, 'f-braccio-b', xL, Y.spalla, omero(xL, manica),
      pezzo(vb, 'f-avambraccio f-avambraccio-b', xL, Y.gomito, avambraccio(xL, avamb) + mano(xL) + scudo));
    const occhiCappuccio = cappuccio && spec.eco ? pezzo(vb, 'f-occhi', 67, 36, `<ellipse cx="63.6" cy="36" rx="5.4" ry="5" fill="${glow}" opacity=".25"/><ellipse cx="63.6" cy="36" rx="2.6" ry="3" fill="${glow}"/><ellipse cx="72.6" cy="36" rx="1.9" ry="2.9" fill="${glow}"/>`) : '';
    const testaPezzo = pezzo(vb, 'f-testa', 60, 50, testa,
      (cappuccio ? '' : pezzo(vb, 'f-sopracciglia', 67, 30, sopracciglia) + pezzo(vb, 'f-occhi', 67, 36, occhi) +
        pezzo(vb, 'f-bocca', 70.6, 44.6, bocca) + pezzo(vb, 'f-urlo', 70.6, 44.6, urlo)) +
      (spec.viso ? pezzo(vb, 'f-viso', 67, 36, sulViso(spec.viso)) : '') + occhiCappuccio);
    const dietroTesta = (coperto ? '' : hair.dietro) + thDietro;
    // Scheletro: il busto è un gruppo che ruota sull'anca e porta con sé testa e braccia (niente colli o spalle che si staccano).
    // Tre strati con la stessa animazione del busto: dietro (mantello, capelli lunghi) → gambe → braccio lontano → busto, testa, braccio vicino.
    const dietro = (spec.mantello ? pezzo(vb, 'f-mantello', 60 - d.sw + 3, 57, treQuarti(mantello(spec.mantello, d))) : '') +
      (spec.dorso === 'gerla' ? pezzo(vb, 'f-mantello f-gerla', 46, 62, GERLA) : '') +
      (dietroTesta ? pezzo(vb, 'f-testa f-capelli-d', 60, 50, dietroTesta) : '');
    const davanti = pezzo(vb, 'f-busto', 60, 106, torsoSvg) + testaPezzo + braccioB;
    return pezzo(vb, 'f-tutto', 60, 188,
      '', pezzo(vb, 'f-aura', 60, 100, `<circle cx="60" cy="100" r="46" fill="none" stroke="${glow}" stroke-width="3" opacity="0"/>`) +
      pezzo(vb, 'f-torso f-torso-d', 60, 106, '', dietro) +
      gambe + coda + piedi +
      pezzo(vb, 'f-torso f-torso-m', 60, 106, '', braccioA) +
      pezzo(vb, 'f-torso', 60, 106, '', davanti));
  }

  /* ---------- Elefante (nemico quadrupede) ---------- */
  function elefante(spec) {
    const vb = VB_ELEFANTE;
    const c = spec.pelle || '#8a8090', cs = scuro(c, 0.3), glow = spec.glow || '#c0303f', drappo = spec.drappo || '#7a1f2a';
    const zampa = (x, cls, lont) => pezzo(vb, 'f-gamba ' + cls, x + 8, 124,
      `${forma(`M${x - 1} 122 Q${x + 8} 118 ${x + 18} 122 L${x + 17} 152 Q${x + 18} 166 ${x + 19} 180 Q${x + 9} 189 ${x - 2} 180 Q${x} 166 ${x + 1} 152 Z`, lont ? cs : c)}
       <path d="M${x + 2} 150 Q${x + 9} 154 ${x + 16} 150" stroke="${scuro(c, 0.45)}" stroke-width="1" fill="none"/>
       <path d="M${x + 1} 181 h4 M${x + 7.4} 183 h4 M${x + 13.6} 181 h3.6" stroke="#ece4cf" stroke-width="2.6" stroke-linecap="round"/>`);
    const corpo = 'M8 112 Q4 78 44 70 Q92 64 106 92 Q116 120 100 138 Q88 146 60 146 L26 144 Q8 138 8 112 Z';
    const gualdrappa = `M24 82 Q60 72 98 84 L102 128 Q60 140 22 128 Z`;
    const torre = `${forma('M40 54 L82 54 L80 76 L42 76 Z', '#6a4a2a')}<path d="M40 54 L82 54" stroke="#d9b44a" stroke-width="2"/>${[44, 54, 64, 74].map(x => `<rect x="${x}" y="47" width="6" height="8" fill="#6a4a2a" ${OUT}/>`).join('')}
      <path d="M44 62 L78 62 M44 69 L78 69" stroke="#4a321a" stroke-width="1"/><path d="M38 76 Q60 70 84 76" stroke="#3a2a1a" stroke-width="2" fill="none"/>
      <path d="M60 47 L60 24" stroke="#5a3a1a" stroke-width="1.8"/><path d="M60 24 L76 29 L60 34 Z" fill="${glow}" ${OUT}/>`;
    return pezzo(vb, 'f-tutto', 60, 188, '',
      pezzo(vb, 'f-aura', 60, 110, `<circle cx="60" cy="110" r="70" fill="none" stroke="${glow}" stroke-width="3" opacity="0"/>`) +
      zampa(16, 'f-gamba-b', true) + zampa(74, 'f-gamba-b', true) +
      pezzo(vb, 'f-mantello', 8, 100, `<path d="M9 100 Q-6 110 0 134" stroke="${cs}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M-2 132 l3 8 l3 -7 z" fill="${cs}" ${OUT}/>`) +
      pezzo(vb, 'f-torso', 60, 150, `${forma(corpo, c, true)}<path d="M28 98 Q44 92 58 98 M36 120 Q56 114 74 122" stroke="${cs}" stroke-width="1.2" fill="none" opacity=".6"/>
        ${forma(gualdrappa, drappo)}<path d="M22 128 Q60 140 102 128" stroke="#d9b44a" stroke-width="3" fill="none"/>${[30, 44, 58, 72, 86].map(x => `<path d="M${x} ${131 + Math.sin(x) * 1.5} l3 6 l3 -6" fill="#d9b44a" stroke="#1b1422" stroke-width=".6"/>`).join('')}
        <circle cx="62" cy="104" r="7" fill="#d9b44a" ${OUT}/><circle cx="62" cy="104" r="3" fill="${glow}"/>${torre}`) +
      zampa(34, 'f-gamba-a') + zampa(92, 'f-gamba-a') +
      pezzo(vb, 'f-testa', 100, 96, `${forma('M94 76 Q120 62 130 90 Q134 108 126 122 Q120 150 130 172 Q131 180 124 180 Q116 178 114 168 Q108 142 106 124 L92 118 Z', c)}
        <path d="M118 128 Q125 130 128 136 M116 140 Q123 142 126 148 M117 152 Q123 154 126 160" stroke="${cs}" stroke-width="1.1" fill="none"/>
        ${forma('M98 74 Q118 64 128 84 L124 92 Q112 80 100 86 Z', '#6a6a76')}<path d="M100 86 Q112 80 124 92" stroke="#d9b44a" stroke-width="1.6" fill="none"/>
        ${forma('M93 70 Q72 72 76 100 Q80 124 100 118 Q106 96 93 70 Z', cs)}<path d="M90 80 Q80 88 84 108" stroke="${scuro(c, 0.5)}" stroke-width="1.1" fill="none"/>
        ${forma('M114 116 Q134 124 140 104 Q130 112 113 108 Z', '#f2ead4')}<path d="M134 110 L140 104 L138 112 Z" fill="#b8923a" ${OUT}/>
        <circle cx="117" cy="92" r="4.6" fill="${glow}" opacity=".35"/><circle cx="117" cy="92" r="2.6" fill="${glow}"/><circle cx="117.4" cy="91.6" r=".9" fill="#fff"/>
        <path d="M112 86 Q117 84 121 87" stroke="#1b1422" stroke-width="1.6" fill="none" stroke-linecap="round"/>`));
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

  const VESTI_LUNGHE = ['veste_lunga', 'manto_imperiale', 'abito_dama', 'veste_studioso', 'saio'];
  /** Costruisce l'elemento figura (corpo intero). `id` = id della Voce o del nemico. */
  Arte.figura = function (id, opz) {
    const spec = E.ARTE[id]; opz = opz || {};
    if (!spec) { const d = el('div', 'fig'); d.textContent = '?'; return d; }
    if (spec.sprite) return sprite(spec);
    Arte.defs();
    const quad = spec.figura === 'elefante', vb = quad ? VB_ELEFANTE : VB_UMANO;
    const d = el('div', 'fig' + (spec.eco ? ' eco' : '') + (quad ? ' quadrupede' : ''));
    const aA = spec.attacco === 'sparo' ? -14 : -18;
    // Personalità di riposo (spec.idle → classe idle-xxx) + piccola variazione dei tempi ricavata dall'id.
    let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 997;
    const jf = (0.86 + (h % 40) / 100).toFixed(2);
    d.classList.add('idle-' + (spec.idle || (spec.eco ? 'spettro' : 'sereno')));
    if (spec.abito && VESTI_LUNGHE.includes(spec.abito.tipo)) d.classList.add('veste');
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
    const box = quad ? { x: 70, y: 62, w: 72, h: 72 } : { x: 31, y: 5, w: 60, h: 60 }, vb = quad ? VB_ELEFANTE : VB_UMANO;
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
    fig.classList.toggle('atk', !!meta.imp);
    if (fig._sprite) { const map = { hit: 'colpo', morte: 'morte' }; Arte._sheet(fig, map[nome] || 'attacco', velocita); }
    if (nome === 'morte' || nome === 'vittoria') return Promise.resolve();
    return new Promise(res => setTimeout(() => {
      if (fig._tok === tok) {                       // solo l'animazione più recente ripulisce la classe
        fig.classList.remove('a-' + nome, 'atk');
        if (fig._sprite) Arte._sheet(fig, fig.classList.contains('ced') ? 'ced' : 'idle', velocita);
      }
      res();
    }, dur * 1000));
  };
  Arte.reset = function (fig) { fig._tok = (fig._tok || 0) + 1; fig.classList.remove('atk'); [...fig.classList].filter(c => c.startsWith('a-')).forEach(c => fig.classList.remove(c)); };

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
  /**
   * Sfondo lontano di ogni capitolo (cielo + sagome a strati). L'orizzonte sta in basso (y=150): il pavimento è in CSS.
   * Ogni epoca ha un paesaggio proprio: Canne al tramonto, Roma in fiamme, torri e neve, la cupola di Firenze,
   * le barricate di Milano, le trincee alpine, una città in rovina di notte.
   */
  Arte.sfondo = function (cap) {
    const p = Arte.palette(cap), c = cap % 7, S = p.sagome;
    const stelle = (n, op) => Array.from({ length: n }, (_, i) => `<circle cx="${(i * 97 + 13) % 520}" cy="${(i * 53) % 80}" r="${0.5 + (i % 3) * 0.4}" fill="#fff" opacity="${(op || 1) * (0.2 + (i % 4) * 0.12)}"/>`).join('');
    const nuvole = (col, op, y) => [0, 1, 2, 3].map(i => `<ellipse cx="${60 + i * 140 + (i % 2) * 30}" cy="${(y || 30) + (i % 2) * 14}" rx="${46 + (i % 3) * 14}" ry="${6 + (i % 2) * 3}" fill="${col}" opacity="${op}"/>`).join('');
    const cielo = (c0, c1, c2) => `<defs><linearGradient id="gC${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset=".65" stop-color="${c1}"/><stop offset="1" stop-color="${c2 || c1}"/></linearGradient>
      <radialGradient id="gS${c}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" stop-color="${c2 || c1}" stop-opacity=".5"/><stop offset="1" stop-color="${c2 || c1}" stop-opacity="0"/></radialGradient></defs>
      <rect width="520" height="150" fill="url(#gC${c})"/>`;
    const sole = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r * 3}" fill="url(#gS${c})"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".55"/>`;
    const colline = (y, col, op, amp) => `<path d="M0 ${y} Q70 ${y - amp} 140 ${y - amp * 0.3} T280 ${y - amp * 0.5} T420 ${y - amp * 0.2} T520 ${y - amp * 0.6} L520 150 L0 150 Z" fill="${col}" opacity="${op}"/>`;
    let corpo = '';
    switch (c) {
      case 0: { // Roma repubblicana — Canne: colline al tramonto, tempio, insegne delle legioni
        const insegna = (x, h) => `<g fill="${S}"><rect x="${x}" y="${150 - h}" width="2" height="${h}"/><rect x="${x - 6}" y="${150 - h + 6}" width="14" height="10" rx="1"/><path d="M${x - 5} ${150 - h} Q${x + 1} ${150 - h - 9} ${x + 7} ${150 - h} Z"/></g>`;
        corpo = cielo('#2b1c3a', '#9a4a4a', '#e08a4a') + stelle(14, 0.6) + sole(390, 100, 18) + nuvole('#e8a070', 0.25, 62) +
          colline(118, S, 0.55, 26) +
          `<g fill="${S}" opacity=".85"><path d="M60 96 L130 78 L200 96 Z"/><rect x="66" y="96" width="128" height="5"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${72 + i * 22}" y="101" width="7" height="34"/>`).join('')}<rect x="62" y="135" width="136" height="6"/></g>` +
          colline(134, S, 0.95, 16) + insegna(250, 46) + insegna(300, 40) + insegna(470, 52) + insegna(30, 36);
        break;
      }
      case 1: { // Impero — Roma brucia: anfiteatro, insulae, fumo e bagliore
        const archi = (x, y, n) => Array.from({ length: n }, (_, i) => `<path d="M${x + i * 13} ${y + 12} L${x + i * 13} ${y + 4} Q${x + i * 13 + 5} ${y - 2} ${x + i * 13 + 10} ${y + 4} L${x + i * 13 + 10} ${y + 12} Z" fill="#ffb060" opacity=".55"/>`).join('');
        corpo = cielo('#1a0c0c', '#8a2a14', '#ff8a3d') +
          `<g opacity=".5">${[0, 1, 2, 3, 4].map(i => `<path d="M${40 + i * 110} 120 Q${20 + i * 110} 70 ${60 + i * 110} 40 Q${90 + i * 110} 10 ${70 + i * 110} -10" stroke="#2a1410" stroke-width="${22 + (i % 2) * 10}" fill="none" stroke-linecap="round"/>`).join('')}</g>` +
          `<path d="M0 150 Q120 96 260 110 T520 100 L520 150 Z" fill="#ff8a3d" opacity=".35"/>` +
          `<g fill="${S}"><path d="M180 150 L180 96 Q260 80 340 96 L340 150 Z"/></g>${archi(186, 100, 12)}${archi(186, 118, 12)}` +
          `<g fill="${S}">${[10, 50, 90, 360, 400, 440, 480].map((x, i) => `<rect x="${x}" y="${104 - (i % 3) * 10}" width="${30 + (i % 2) * 8}" height="${46 + (i % 3) * 10}"/>`).join('')}</g>` +
          `<g fill="#ffd060" opacity=".7">${[18, 62, 98, 368, 410, 452, 488].map((x, i) => `<rect x="${x}" y="${112 - (i % 3) * 8}" width="4" height="5"/><rect x="${x + 10}" y="${122 - (i % 2) * 6}" width="4" height="5"/>`).join('')}</g>` +
          `<g>${[30, 120, 230, 330, 420, 500].map((x, i) => `<path d="M${x} 150 Q${x - 10} ${128 - i % 2 * 8} ${x} ${118 - (i % 3) * 6} Q${x + 10} ${130} ${x + 6} 150 Z" fill="#ff6a2a" opacity=".8"/><path d="M${x + 2} 150 Q${x - 3} 138 ${x + 2} 130 Q${x + 6} 140 ${x + 4} 150 Z" fill="#ffd060"/>`).join('')}</g>`;
        break;
      }
      case 2: { // Medioevo — torri del Comune e castello sulla neve
        const torre = (x, w, h, merli) => `<g fill="${S}"><rect x="${x}" y="${150 - h}" width="${w}" height="${h}"/>${merli ? Array.from({ length: Math.floor(w / 4) }, (_, i) => i % 2 ? '' : `<rect x="${x + i * 4}" y="${146 - h}" width="3" height="4"/>`).join('') : ''}</g><rect x="${x + w / 2 - 1}" y="${150 - h + 10}" width="2" height="4" fill="#ffe0a0" opacity=".5"/>`;
        corpo = cielo('#141c2c', '#4a5a7a', '#8a9ab8') + stelle(30, 1) + `<circle cx="110" cy="34" r="11" fill="#e8eef8" opacity=".75"/><circle cx="114" cy="31" r="9" fill="#4a5a7a" opacity=".5"/>` +
          colline(112, '#2a3448', 0.9, 30) + `<path d="M300 84 L340 72 L380 84 L380 110 L300 110 Z" fill="${S}"/><g fill="${S}">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => i % 2 ? '' : `<rect x="${300 + i * 8}" y="80" width="6" height="5"/>`).join('')}</g><path d="M340 72 L340 60 L352 64 L340 66" fill="#c0303f"/>` +
          torre(40, 14, 70, true) + torre(64, 11, 92, true) + torre(84, 16, 60, true) + torre(150, 12, 80, true) + torre(430, 15, 74, true) + torre(456, 10, 96, true) + torre(476, 14, 64, true) +
          colline(136, '#d8e0ee', 0.18, 10) + `<g fill="#fff" opacity=".7">${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 61) % 520}" cy="${(i * 37) % 150}" r="${0.6 + (i % 3) * 0.4}"/>`).join('')}</g>`;
        break;
      }
      case 3: { // Rinascimento — Firenze: cupola, torre di Arnolfo, tetti, falò
        corpo = cielo('#2a1e34', '#b06a4a', '#f0b070') + sole(130, 104, 14) + nuvole('#f0c090', 0.3, 50) +
          `<g fill="${S}"><path d="M250 150 L250 104 L262 104 Q262 70 290 62 L290 54 L294 50 L298 54 L298 62 Q326 70 326 104 L338 104 L338 150 Z"/><rect x="292" y="40" width="4" height="12"/><circle cx="294" cy="39" r="2.4"/>
           <rect x="380" y="56" width="16" height="94"/><rect x="376" y="52" width="24" height="6"/><rect x="383" y="40" width="10" height="13"/><path d="M381 40 L388 30 L395 40 Z"/>
           <rect x="214" y="70" width="8" height="80"/><path d="M212 70 L218 58 L224 70 Z"/></g>` +
          `<g fill="${S}" opacity=".9">${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 34 - 6} 150 L${i * 34 - 6} ${124 - (i % 3) * 6} L${i * 34 + 10} ${116 - (i % 3) * 6} L${i * 34 + 26} ${124 - (i % 3) * 6} L${i * 34 + 26} 150 Z"/>`).join('')}</g>` +
          `<g fill="#ffd080" opacity=".6">${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 37 + 4}" y="${130 - (i % 2) * 6}" width="3" height="5"/>`).join('')}</g>` +
          `<path d="M470 150 Q456 120 474 96 Q478 120 490 106 Q496 128 486 150 Z" fill="#ff7a2a" opacity=".85"/><path d="M474 150 Q468 132 478 118 Q484 134 482 150 Z" fill="#ffe080"/>`;
        break;
      }
      case 4: { // Risorgimento — Milano: guglie del Duomo, tetti, barricate e bandiere
        const bandiera = (x, y) => `<rect x="${x}" y="${y}" width="1.6" height="${150 - y}" fill="${S}"/><rect x="${x + 1.6}" y="${y}" width="6" height="9" fill="#2a8a4a"/><rect x="${x + 7.6}" y="${y}" width="6" height="9" fill="#f2ede2"/><rect x="${x + 13.6}" y="${y}" width="6" height="9" fill="#c0303f"/>`;
        corpo = cielo('#18282a', '#4a7a70', '#a0c0a8') + nuvole('#d0e0d0', 0.18, 40) +
          `<g fill="${S}"><path d="M170 150 L170 96 L350 96 L350 150 Z"/>${Array.from({ length: 14 }, (_, i) => `<path d="M${172 + i * 13} 96 L${175 + i * 13} ${70 - (i % 3) * 8 - (i === 7 ? 18 : 0)} L${178 + i * 13} 96 Z"/>`).join('')}<path d="M256 96 L258 38 L262 96 Z"/><circle cx="259" cy="36" r="2" fill="#e0b43a"/></g>` +
          `<g fill="${S}" opacity=".9">${Array.from({ length: 10 }, (_, i) => i > 2 && i < 7 ? '' : `<rect x="${i * 54}" y="${112 - (i % 2) * 10}" width="46" height="${38 + (i % 2) * 10}"/>`).join('')}</g>` +
          `<g fill="#1a1414"><path d="M20 150 L40 126 L70 132 L96 118 L120 134 L150 128 L170 150 Z"/><path d="M370 150 L392 128 L420 136 L446 122 L470 132 L500 124 L520 150 Z"/></g>` +
          bandiera(90, 98) + bandiera(450, 92) + `<g opacity=".35">${[100, 300, 460].map(x => `<ellipse cx="${x}" cy="${80}" rx="40" ry="14" fill="#d0d0c8"/>`).join('')}</g>`;
        break;
      }
      case 5: { // Prima guerra mondiale — montagne, trincee, filo spinato, pioggia
        corpo = cielo('#22242a', '#5a5e66', '#8a8c90') + nuvole('#3a3c42', 0.6, 26) + nuvole('#4a4c52', 0.5, 46) +
          `<path d="M0 150 L0 92 L50 60 L90 84 L140 40 L190 80 L240 56 L300 96 L350 50 L410 86 L460 58 L520 90 L520 150 Z" fill="#3a3c44"/>
           <path d="M140 40 L156 54 L148 52 L140 60 L132 52 Z M350 50 L364 62 L352 60 L342 66 Z M50 60 L62 70 L50 70 Z" fill="#d8dce4" opacity=".7"/>` +
          colline(128, S, 0.95, 14) +
          `<g stroke="#15161a" stroke-width="1" fill="none">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<path d="M${i * 54} 130 L${i * 54} 144 M${i * 54 - 4} 133 L${i * 54 + 4} 141"/><path d="M${i * 54} 134 Q${i * 54 + 27} 140 ${i * 54 + 54} 134" stroke-dasharray="2 2"/>`).join('')}</g>` +
          `<g stroke="#b8c0cc" stroke-width=".6" opacity=".35">${Array.from({ length: 60 }, (_, i) => `<path d="M${(i * 37) % 520} ${(i * 29) % 150} l-3 9"/>`).join('')}</g>`;
        break;
      }
      default: { // Seconda guerra mondiale — città in rovina di notte, fari, cenere
        corpo = cielo('#08080c', '#24242e', '#3a3a46') + stelle(18, 0.5) +
          `<g opacity=".18" fill="#e8e8f0"><path d="M120 150 L60 0 L90 0 Z"/><path d="M400 150 L470 0 L500 0 Z"/></g>` +
          `<g fill="${S}">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => { const x = i * 50 - 10, h = 50 + (i * 23) % 46; return `<path d="M${x} 150 L${x} ${150 - h} L${x + 12} ${150 - h + 6} L${x + 20} ${150 - h - 4} L${x + 30} ${150 - h + 10} L${x + 44} ${150 - h + 2} L${x + 44} 150 Z"/>`; }).join('')}</g>` +
          `<g fill="#0a0a0e">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => `<rect x="${i * 50 + 2}" y="${116 + (i % 3) * 4}" width="5" height="7"/><rect x="${i * 50 + 18}" y="${124 - (i % 2) * 6}" width="5" height="7"/>`).join('')}</g>` +
          `<g fill="#ffd080" opacity=".5">${[2, 5, 8].map(i => `<rect x="${i * 50 + 18}" y="${124 - (i % 2) * 6}" width="5" height="7"/>`).join('')}</g>` +
          `<g fill="#c8c8d0" opacity=".55">${Array.from({ length: 36 }, (_, i) => `<circle cx="${(i * 71) % 520}" cy="${(i * 43) % 150}" r="${0.6 + (i % 3) * 0.4}"/>`).join('')}</g>`;
      }
    }
    return `<svg viewBox="0 0 520 150" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" class="sfondo-svg">${corpo}</svg>`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
