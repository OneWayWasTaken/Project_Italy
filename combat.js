/* ============================================================================
 * combat.js — logica PURA del combattimento (nessun DOM).
 *
 * Il motore muta lo stato della battaglia `B` e produce una lista di EVENTI
 * (B.eventi) che la UI riproduce con le animazioni. Gli eventi portano i valori
 * assoluti (pvDopo, totale, valore…) così la UI può mostrare lo stato "al momento
 * dell'evento" anche se il motore ha già risolto tutto il turno.
 *
 * Flusso di un turno:
 *   Combat.iniziaTurno(B)   → tira i dadi, crea le azioni, pianifica i nemici
 *   Combat.pianifica(...)   → il giocatore sceglie skill/bersaglio (UI)
 *   Combat.esegui(B)        → risolve scontri e colpi, fine turno
 *
 * Eventi (campo `t`): turno, dadi, regola, azione, clash, round, clash_fine,
 *   colpo, stato, sanita, ardore, cura, cedimento, morte, dot, panico, fase,
 *   evoca, schiva, affondo, ced_agg, panico_fine, aff, msg, fine
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi, C = E.CONFIG;
  const Combat = E.Combat = {};

  /* ---------- Utilità ---------- */
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  /** RNG deterministico (mulberry32): permette test e replay riproducibili. */
  function creaRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const get = (B, id) => B.byId[id];
  const vivi = (B, lato) => B.unita.filter(u => u.lato === lato && u.vivo);
  const opposto = l => (l === 'a' ? 'n' : 'a');
  const ev = (B, o) => { B.eventi.push(o); return o; };
  const pick = (B, arr) => arr[Math.floor(B.rng() * arr.length)];
  const hasPass = (u, tipo) => u.passiva && u.passiva.tipo === tipo;

  /** Probabilità di Testa in base alla Sanità (design.md §2.2). */
  Combat.chanceTesta = u => (u.panico ? 0.05 : clamp(0.5 + u.sanita / 100, 0.05, 0.95));

  /* ---------- Creazione ---------- */
  function creaUnita(B, def, lato, opt) {
    opt = opt || {};
    const n = B.unita.filter(u => u.lato === lato).length;
    const u = {
      id: lato + n, lato, def: def.id, nome: def.nome, breve: def.breve || def.nome, aff: def.aff,
      pv: def.pv, pvMax: def.pv, sanita: 0, vel: def.vel.slice(), azioni: def.azioni != null ? def.azioni : 1,
      skills: def.skills.slice(), passiva: def.passiva || null, ia: def.ia ? def.ia.slice() : null,
      fasi: (def.fasi || []).map(f => Object.assign({ fatta: false }, f)), regole: def.regole || [],
      soglie: def.soglie || C.SOGLIE_CEDIMENTO,
      stati: {}, bonusPM: 0, bonusPMProx: 0, evade: false, noCed: false, ced: 0, sogliaIdx: 0, panico: false, vivo: true, dadi: [], bonusDado: 0,
      ultimaSkill: null, appunti: 0, usate: [], passivaUsata: false, bleedTurno: false, splTurno: 0,
      boss: !!def.boss, colore: def.colore, sigla: def.sigla || def.breve.slice(0, 1),
      npc: !!def.npc, immortale: !!def.immortale, lv: 0, bonusPMlv: 0
    };
    // Livello "Eco" delle Voci possedute (duplicati del gacha): +5% PV per livello, +1 PM dal 3°, +10 Sanità iniziale al 5°
    if (opt.lv) {
      u.lv = opt.lv; u.pvMax = u.pv = Math.round(def.pv * (1 + 0.05 * opt.lv));
      if (opt.lv >= 3) u.bonusPMlv = 1;
      if (opt.lv >= 5) u.sanita = 10;
    }
    // Scala di difficoltà dei nemici (per capitolo)
    if (lato === 'n' && opt.scalaPv) { u.pvMax = u.pv = Math.round(def.pv * opt.scalaPv); }
    // Danni e sanità portati dalle battaglie precedenti (dungeon)
    if (opt.stato) {
      u.pv = Math.max(1, Math.min(u.pvMax, Math.round(opt.stato.pv != null ? opt.stato.pv : u.pv)));
      if (opt.stato.sanita != null) u.sanita = clamp(opt.stato.sanita, C.SANITA_MIN, C.SANITA_MAX);
    }
    B.unita.push(u); B.byId[u.id] = u;
    if (def.statiIniziali) Object.keys(def.statiIniziali).forEach(k => { u.stati[k] = def.statiIniziali[k]; });
    return u;
  }

  /** Crea una battaglia. opz = { alleati:[idVoce], nemici:[idNemico], seed } */
  Combat.creaBattaglia = function (opz) {
    const B = {
      rng: creaRng(opz.seed != null ? opz.seed : (Math.random() * 4294967296) >>> 0),
      turno: 0, ardore: C.ARDORE_START + (opz.bonusArdore || 0), unita: [], byId: {}, azioni: [], eventi: [], esito: null,
      obiettivo: opz.obiettivo || null, scalaDan: opz.scalaDan || 1, scalaPv: opz.scalaPv || 1
    };
    const lvls = opz.livelli || {}, stati = opz.stati || {};
    opz.alleati.forEach(id => creaUnita(B, E.VOCI[id], 'a', { lv: lvls[id] || 0, stato: stati[id] }));
    (opz.npc || []).forEach(id => creaUnita(B, E.NPC[id], 'a'));
    opz.nemici.forEach(id => creaUnita(B, E.NEMICI[id], 'n', { scalaPv: B.scalaPv }));
    // Oggetti/bonus del dungeon: stati iniziali per tutta la squadra giocabile
    Object.keys(opz.bonusStati || {}).forEach(k => B.unita.filter(u => u.lato === 'a' && !u.npc).forEach(u => { u.stati[k] = (u.stati[k] || 0) + opz.bonusStati[k]; }));
    // Passive di inizio battaglia
    B.unita.forEach(u => {
      if (hasPass(u, 'inizio_stato_per_alleato')) {
        addStato(B, u, u.passiva.stato, vivi(B, u.lato).length, u);
      }
    });
    // Concordie: coppie di affinità opposte in squadra (design.md §3.2)
    let conc = 0;
    E.CONCORDIE.forEach(([x, y]) => {
      const a = vivi(B, 'a').filter(u => u.aff === x), b = vivi(B, 'a').filter(u => u.aff === y);
      if (a.length && b.length) {
        conc++;
        [a[0], b[0]].forEach(u => addSanita(B, u, 4));
        ev(B, { t: 'msg', msg: 'Concordia: ' + E.AFFINITA[x].nome + ' e ' + E.AFFINITA[y].nome + ' risuonano insieme.' });
      }
    });
    B.ardore = clamp(B.ardore + conc, 0, C.ARDORE_MAX);
    B.eventiIniziali = B.eventi; B.eventi = [];
    return B;
  };

  /* ---------- Stati / Sanità ---------- */
  function addStato(B, tgt, stato, n, src) {
    if (!tgt.vivo || !n) return 0;
    const def = E.STATI[stato];
    if (n > 0 && src && src.passiva) {
      const p = src.passiva;
      if (p.tipo === 'bonus_stato' && p.stato === stato) n += 1;
      if (p.tipo === 'bonus_stato_se_meno_pv' && p.stato === stato && tgt.pv < src.pv) n += 1;
    }
    const cur = tgt.stati[stato] || 0;
    const nuovo = clamp(cur + n, 0, Math.min(def.max, C.STATO_MAX));
    if (nuovo === cur) return 0;
    if (nuovo === 0) delete tgt.stati[stato]; else tgt.stati[stato] = nuovo;
    ev(B, { t: 'stato', id: tgt.id, stato, delta: nuovo - cur, totale: nuovo });
    return nuovo - cur;
  }
  function addSanita(B, u, d) {
    if (!u.vivo || !d) return;
    const nuovo = clamp(u.sanita + d, C.SANITA_MIN, C.SANITA_MAX);
    if (nuovo === u.sanita) return;
    ev(B, { t: 'sanita', id: u.id, delta: nuovo - u.sanita, valore: nuovo });
    u.sanita = nuovo;
  }
  function cura(B, u, pv) {
    if (!u.vivo) return;
    const nuovo = Math.min(u.pvMax, u.pv + pv);
    if (nuovo === u.pv) return;
    ev(B, { t: 'cura', id: u.id, n: nuovo - u.pv, pvDopo: nuovo });
    u.pv = nuovo;
  }

  /* ---------- Danno, cedimento, fasi, morte ---------- */
  /** Sottrae PV (con eventuale passiva di sopravvivenza). Ritorna i PV dopo. */
  function sottraiPv(B, T, d) {
    T.pv = Math.max(0, T.pv - d);
    if (T.pv === 0 && T.immortale) T.pv = 1;               // entità che non si possono sconfiggere (es. Il Silenzio)
    if (T.pv === 0 && hasPass(T, 'sopravvivenza') && !T.passivaUsata) {
      T.passivaUsata = true; T.pv = 1;
      ev(B, { t: 'msg', msg: T.breve + ' resta in piedi per un soffio: ' + T.passiva.nome + '!' });
      addStato(B, T, T.passiva.stato, T.passiva.n, T);
    }
    return T.pv;
  }
  function annullaAzioni(B, u) {
    B.azioni.forEach(a => { if (a.u === u.id && !a.usata) { a.usata = true; a.annullata = true; } });
  }
  function morte(B, T, killer) {
    T.vivo = false; T.pv = 0;
    annullaAzioni(B, T);
    ev(B, { t: 'morte', id: T.id, msg: T.breve + ' si dissolve.' });
    vivi(B, T.lato).forEach(u => addSanita(B, u, -5));
    if (killer && killer.vivo) addSanita(B, killer, 3);
    controllaEsito(B);
  }
  /** Dopo ogni danno: morte, soglie di Cedimento, fasi del boss. */
  function dopoDanno(B, T, src) {
    if (!T.vivo) return;
    if (T.pv <= 0) { morte(B, T, src); return; }
    const fr = T.pv / T.pvMax;
    // Cedimento (stagger)
    let trig = false;
    while (T.sogliaIdx < T.soglie.length && fr <= T.soglie[T.sogliaIdx]) { T.sogliaIdx++; trig = true; }
    if (trig && T.noCed) trig = false;     // Castello Tiene: nessun Cedimento questo turno
    if (trig) {
      T.ced = 2; annullaAzioni(B, T);
      ev(B, { t: 'cedimento', id: T.id, msg: T.breve + ' va in Cedimento!' });
      vivi(B, T.lato).forEach(u => { if (u !== T) addSanita(B, u, -5); });
      vivi(B, T.lato).forEach(u => { if (hasPass(u, 'cedimento_alleato_sanita') && u !== T) vivi(B, T.lato).forEach(x => addSanita(B, x, u.passiva.sanita)); });
    }
    // Fasi
    T.fasi.forEach(f => {
      if (f.fatta || fr > f.soglia) return;
      f.fatta = true;
      if (f.ia) T.ia = f.ia.slice();
      if (f.azioni) T.azioni = f.azioni;
      if (f.aff) { T.aff = f.aff; ev(B, { t: 'aff', id: T.id, aff: f.aff }); }
      if (f.stati) Object.keys(f.stati).forEach(k => addStato(B, T, k, f.stati[k]));
      if (f.sanitaAlleati) vivi(B, 'a').forEach(a => addSanita(B, a, f.sanitaAlleati));
      ev(B, { t: 'fase', id: T.id, testo: f.testo, msg: f.testo });
      (f.evoca || []).forEach(id => {
        if (vivi(B, 'n').length >= 4) return;
        const nu = creaUnita(B, E.NEMICI[id], 'n');
        ev(B, { t: 'evoca', unit: Combat.pubblica(nu), msg: nu.breve + ' appare sul campo.' });
      });
    });
  }
  function controllaEsito(B) {
    if (B.esito) return;
    const giocabili = vivi(B, 'a').filter(u => !u.npc), npc = vivi(B, 'a').filter(u => u.npc);
    const haNpc = B.unita.some(u => u.npc);
    if (!giocabili.length || (B.obiettivo && B.obiettivo.proteggi && haNpc && !npc.length)) B.esito = 'sconfitta';
    else if (!B.obiettivo && !vivi(B, 'n').length) B.esito = 'vittoria';
    else if (B.obiettivo && B.obiettivo.tipo === 'elimina' && !vivi(B, 'n').length) B.esito = 'vittoria';
  }

  /* ---------- Effetti (fx) ---------- */
  function alleatoDebole(B, u) {
    const l = vivi(B, u.lato).filter(x => x !== u).sort((x, y) => x.pv / x.pvMax - y.pv / y.pvMax);
    return l[0] || u;
  }
  function bersagliFx(B, to, u, T) {
    switch (to) {
      case 'self': return [u];
      case 'target': return T && T.vivo ? [T] : [];
      case 'ally': return [alleatoDebole(B, u)];
      case 'team': return vivi(B, u.lato);
      case 'nemici': return vivi(B, opposto(u.lato));
      default: return [];
    }
  }
  /** Applica gli effetti di una skill per un dato momento (on). */
  function applicaFx(B, s, on, u, T, soloPerTesta) {
    (s.fx || []).forEach(f => {
      if (f.on !== on) return;
      if (!!f.perTesta !== !!soloPerTesta) return;
      bersagliFx(B, f.to || 'self', u, T).forEach(t => {
        if (f.stato) addStato(B, t, f.stato, f.n, u);
        if (f.sanita != null) addSanita(B, t, f.sanita);
        if (f.cura) cura(B, t, Math.ceil(t.pvMax * f.cura));
        if (f.rimuoviNegativi) E.NEGATIVI.forEach(st => { if (t.stati[st]) addStato(B, t, st, -t.stati[st]); });
        if (f.rimuoviPositivi) {
          let resto = f.rimuoviPositivi;
          E.POSITIVI.forEach(st => { if (resto > 0 && t.stati[st]) { const r = Math.min(resto, t.stati[st]); addStato(B, t, st, -r); resto -= r; } });
        }
        if (f.raddoppia && t.stati[f.raddoppia]) addStato(B, t, f.raddoppia, t.stati[f.raddoppia]);
        if (f.velProx) t.bonusDado += f.velProx;
        if (f.pmProx) t.bonusPMProx += f.pmProx;
        if (f.evade) t.evade = true;
        if (f.noCed) t.noCed = true;
        if (f.trasferisci) {
          // Sposta stack di uno stato da un alleato (quello che ne ha di più) al bersaglio
          const st = f.trasferisci.stato;
          const don = vivi(B, u.lato).sort((x, y) => (y.stati[st] || 0) - (x.stati[st] || 0))[0];
          const n = Math.min(f.trasferisci.n, don ? (don.stati[st] || 0) : 0);
          if (n > 0) { addStato(B, don, st, -n); addStato(B, t, st, n, u); } else addStato(B, t, st, 1, u);
        }
        if (f.perdiPv) {
          const d = Math.min(t.pv - 1, Math.ceil(t.pvMax * f.perdiPv));
          if (d > 0) { t.pv -= d; ev(B, { t: 'dot', id: t.id, tipo: 'costo', danno: d, pvDopo: t.pv }); }
        }
      });
      if (f.ardore && u.lato === 'a') {
        B.ardore = clamp(B.ardore + f.ardore, 0, C.ARDORE_MAX);
        ev(B, { t: 'ardore', valore: B.ardore });
      }
    });
  }

  /* ---------- Preparazione di una skill (potenze effettive) ---------- */
  function dadoMax(B, unitId) {
    return Math.max(0, ...B.azioni.filter(a => a.u === unitId).map(a => a.dado));
  }
  /** Risonanza: quante azioni alleate pianificate usano skill di ciascuna affinità in questo turno. */
  Combat.risonanza = function (B) {
    const n = {};
    B.azioni.forEach(a => { if (a.annullata || !a.skill) return; const u = get(B, a.u); if (!u || u.lato !== 'a' || !u.vivo) return; const af = E.SKILL[a.skill].aff; n[af] = (n[af] || 0) + 1; });
    return n;
  };
  const bonusRisonanza = n => (C.RISONANZA && (n >= 4 ? C.RISONANZA[4] : n >= 3 ? C.RISONANZA[3] : 0)) || 0;
  function prepara(B, u, s, az, rival, simula) {
    const rel = E.rel(s.aff, rival.aff);
    let pb = s.pb + (u.lato === 'a' ? bonusRisonanza(Combat.risonanza(B)[s.aff] || 0) : 0), pm = s.pm + rel + u.bonusPM + u.bonusPMlv, molt = 1, monete = s.monete;
    if (s.monetePiuSeCed && rival.ced > 0) monete += s.monetePiuSeCed;
    pb += Math.min(6, Math.floor((u.stati.splendore || 0) / 2));
    pm += Math.min(3, Math.floor((u.stati.formazione || 0) / 3));
    if (u.sanita >= C.SANITA_MAX) pm += 1;                       // Esaltazione
    if (s.pbPer) {
      const n = u.stati[s.pbPer.s] || 0;
      pb += n * s.pbPer.k;
      if (s.pbPer.consuma && n && !simula) addStato(B, u, s.pbPer.s, -Math.ceil(n * s.pbPer.consuma));
    }
    if (s.pmPerStato) pm += Math.min(s.pmPerStato.max, (u.stati[s.pmPerStato.s] || 0) * s.pmPerStato.k);
    const rd = dadoMax(B, rival.id);
    if (s.pmSePiuVeloce && az.dado > rd) pm += s.pmSePiuVeloce;
    if (s.pbPerVel) pb += s.pbPerVel * Math.max(0, az.dado - rd);
    if (s.moltSeStato) {
      const n = rival.stati[s.moltSeStato.s] || 0;
      if (n >= s.moltSeStato.min) { molt *= s.moltSeStato.molt; if (s.moltSeStato.consuma && !simula) addStato(B, rival, s.moltSeStato.s, -n); }
    }
    if (s.moltPerStato) {
      const n = rival.stati[s.moltPerStato.s] || 0;
      molt *= 1 + s.moltPerStato.per * n;
      if (s.moltPerStato.consuma && n && !simula) addStato(B, rival, s.moltPerStato.s, -n);
    }
    // Passive
    const p = u.passiva;
    if (p) switch (p.tipo) {
      case 'pm_pv_mancanti': pm += Math.min(p.max, Math.floor((1 - u.pv / u.pvMax) / p.passo + 1e-9)); break;
      case 'pm_skill_diversa': if (u.ultimaSkill && u.ultimaSkill !== s.id) pm += 1; break;
      case 'pm_dado_min': if (az.dado >= p.min) pm += 1; break;
      case 'moneta_se_piu_veloce': if (az.dado === Math.max(...B.azioni.map(a => a.dado))) monete += 1; break;
      case 'taccuino':
        if (simula) { if (u.appunti >= p.soglia) monete += 1; break; }
        if (u.appunti >= p.soglia) { monete += 1; u.appunti = 0; u.usate = []; ev(B, { t: 'msg', msg: u.breve + ' consulta il Taccuino: +1 moneta!' }); }
        if (!u.usate.includes(s.id)) { u.usate.push(s.id); u.appunti++; }
        break;
    }
    return { u, s, az, rival, rel, pb, pm, molt, monete, ignora: s.ignoraDifesa || 0 };
  }

  const lancia = (B, u, n) => Array.from({ length: n }, () => B.rng() < Combat.chanceTesta(u));

  /* ---------- Sequenza di colpi ---------- */
  function colpi(B, p, T, n) {
    const U = p.u; let teste = 0, riusciti = 0;
    for (let i = 0; i < n && T.vivo; i++) {
      const testa = B.rng() < Combat.chanceTesta(U);
      if (testa) teste++;
      const pot = p.pb + teste * p.pm;
      let d = pot * C.DANNO_MOLT * p.molt * (U.lato === 'n' ? B.scalaDan : 1);
      if (p.rel === 1) d *= C.BONUS_VANTAGGIO; else if (p.rel === -1) d *= C.MALUS_SVANTAGGIO;
      const mk = T.stati.marchio || 0;
      if (mk) d *= 1 + 0.05 * mk;
      d *= 1 - Math.min(0.5, 0.05 * (T.stati.formazione || 0)) * (1 - p.ignora);
      if (T.ced > 0) d *= C.MOLT_CEDIMENTO;
      d = Math.max(1, Math.round(d));
      // Voto: assorbe 3 danni per stack
      let assorbito = 0;
      const voto = T.stati.voto || 0;
      if (voto) {
        const dAss = Math.round(d * (1 - p.ignora));
        const usa = Math.min(voto, Math.ceil(dAss / 3));
        assorbito = Math.min(dAss, usa * 3); d -= assorbito;
        addStato(B, T, 'voto', -usa); addSanita(B, T, usa);
      }
      const pvDopo = sottraiPv(B, T, d);
      ev(B, { t: 'colpo', att: U.id, bers: T.id, idx: i, n, testa, pot: Math.round(pot * 10) / 10, danno: d, assorbito, pvDopo, rel: p.rel, ced: T.ced > 0 });
      riusciti++;
      if (mk) addStato(B, T, 'marchio', -1);
      if (testa && hasPass(U, 'splendore_testa') && p.pm >= U.passiva.pmMin && U.splTurno < U.passiva.maxTurno) { U.splTurno++; addStato(B, U, 'splendore', 1); }
      if (testa) applicaFx(B, p.s, 'hit', U, T, true);
      dopoDanno(B, T, U);
    }
    if (riusciti) applicaFx(B, p.s, 'hit', U, T, false);
  }

  /* ---------- Scontro (clash) ---------- */
  function scontro(B, aA, aB) {
    const uA = get(B, aA.u), uB = get(B, aB.u), sA = E.SKILL[aA.skill], sB = E.SKILL[aB.skill];
    aA.usata = aB.usata = true;
    applicaFx(B, sA, 'use', uA, uB); applicaFx(B, sB, 'use', uB, uA);
    const pA = prepara(B, uA, sA, aA, uB), pB = prepara(B, uB, sB, aB, uA);
    let cA = pA.monete, cB = pB.monete;
    let ignA = hasPass(uA, 'prima_moneta_ignorata'), ignB = hasPass(uB, 'prima_moneta_ignorata');
    const info = (u, p, c) => ({ id: u.id, skill: p.s.id, monete: c, pb: p.pb, pm: p.pm, rel: p.rel });
    ev(B, { t: 'clash', a: info(uA, pA, cA), b: info(uB, pB, cB), msg: uA.breve + ' (' + sA.nome + ') contro ' + uB.breve + ' (' + sB.nome + ')!' });
    let round = 0;
    while (cA > 0 && cB > 0) {
      round++;
      const fa = lancia(B, uA, cA), fb = lancia(B, uB, cB);
      const potA = pA.pb + fa.filter(Boolean).length * pA.pm, potB = pB.pb + fb.filter(Boolean).length * pB.pm;
      let v = potA > potB ? 'a' : potB > potA ? 'b' : null;
      if (round > 40) v = B.rng() < 0.5 ? 'a' : 'b';
      const r = { t: 'round', n: round, v, ignorata: null,
        a: { id: uA.id, flips: fa, pot: Math.round(potA * 10) / 10, monete: cA },
        b: { id: uB.id, flips: fb, pot: Math.round(potB * 10) / 10, monete: cB } };
      if (v === 'a') { if (ignB) { ignB = false; r.ignorata = 'b'; } else cB--; }
      else if (v === 'b') { if (ignA) { ignA = false; r.ignorata = 'a'; } else cA--; }
      r.restanti = { a: cA, b: cB };
      ev(B, r);
    }
    const vincA = cA > 0, wp = vincA ? pA : pB, lp = vincA ? pB : pA, n = vincA ? cA : cB;
    ev(B, { t: 'clash_fine', vincitore: wp.u.id, perdente: lp.u.id, restanti: n, msg: wp.u.breve + ' vince lo scontro!' });
    addSanita(B, wp.u, 4); addSanita(B, lp.u, -4);
    if (wp.u.stati.splendore) addSanita(B, wp.u, 2);
    if (lp.u.stati.formazione) addStato(B, lp.u, 'formazione', -1);
    applicaFx(B, wp.s, 'win', wp.u, lp.u);
    colpi(B, wp, lp.u, n);
    wp.u.ultimaSkill = wp.s.id; lp.u.ultimaSkill = lp.s.id;
  }

  /** Azione libera: nessun avversario può rispondere. */
  function attaccoLibero(B, a, T) {
    const u = get(B, a.u), s = E.SKILL[a.skill];
    a.usata = true;
    applicaFx(B, s, 'use', u, T);
    if (T.evade) {
      T.evade = false;
      ev(B, { t: 'schiva', id: T.id, msg: T.breve + ' schiva il colpo!' });
      u.ultimaSkill = s.id; return;
    }
    const p = prepara(B, u, s, a, T);
    ev(B, { t: 'msg', msg: u.breve + ' colpisce ' + T.breve + ' senza opposizione.' });
    colpi(B, p, T, p.monete);
    u.ultimaSkill = s.id;
  }

  /** Sceglie quale azione di T viene "agganciata" dall'attacco `a`. */
  function azioneDifensiva(B, T, a) {
    const libere = B.azioni.filter(x => x.u === T.id && !x.usata && !x.annullata && x.skill);
    if (!libere.length) return null;
    return libere.find(x => x.bers === a.u) || libere.sort((x, y) => y.dado - x.dado)[0];
  }

  /* ---------- Turno ---------- */
  Combat.iniziaTurno = function (B) {
    B.turno++; B.eventi = []; B.azioni = []; B.affondo = null;
    B.unita.forEach(u => { u.bonusPM = u.bonusPMProx; u.bonusPMProx = 0; });
    if (B.turno > 1) B.ardore = clamp(B.ardore + C.ARDORE_TURNO, 0, C.ARDORE_MAX);
    ev(B, { t: 'turno', n: B.turno, ardore: B.ardore });
    B.unita.forEach(u => {
      if (u.vivo && u.sanita <= C.SANITA_MIN && !u.panico) {
        u.panico = true; ev(B, { t: 'panico', id: u.id, msg: u.breve + ' è in preda al Panico!' });
      }
    });
    // Dadi di velocità
    const dadi = {};
    vivi(B, 'a').concat(vivi(B, 'n')).forEach(u => {
      u.dadi = [];
      if (u.ced > 0) { dadi[u.id] = []; return; }
      for (let i = 0; i < u.azioni; i++) {
        const d = u.vel[0] + Math.floor(B.rng() * (u.vel[1] - u.vel[0] + 1)) + (i === 0 ? u.bonusDado : 0);
        u.dadi.push(Math.max(1, d));
      }
      u.bonusDado = 0;
    });
    // Passive di inizio turno
    vivi(B, 'a').concat(vivi(B, 'n')).forEach(u => {
      const p = u.passiva; if (!p) return;
      if (p.tipo === 'inizio_turno_stato_alleati') vivi(B, u.lato).forEach(x => { if (x.ced === 0) addStato(B, x, p.stato, p.n, u); });
      if (p.tipo === 'inizio_turno_sanita_minore') {
        const l = vivi(B, u.lato).sort((x, y) => x.sanita - y.sanita)[0]; if (l) addSanita(B, l, p.sanita);
      }
      if (p.tipo === 'dado_alleato_minimo') {
        const l = vivi(B, u.lato).filter(x => x.dadi.length).sort((x, y) => x.dadi[0] - y.dadi[0])[0];
        if (l) l.dadi[0] += p.bonus;
      }
    });
    vivi(B, 'a').concat(vivi(B, 'n')).forEach(u => { dadi[u.id] = u.dadi.slice(); });
    ev(B, { t: 'dadi', dadi });
    // Regole automatiche (boss)
    vivi(B, 'n').forEach(u => u.regole.forEach(r => {
      if (B.turno < r.da) return;
      const tgt = r.a === 'alleati' ? vivi(B, 'a') : r.a === 'se' ? [u] : vivi(B, 'n');
      const n = (r.n || 0) + (r.crescente ? Math.floor((B.turno - r.da) / r.crescente) : 0);
      tgt.forEach(t => {
        if (r.stato && n) addStato(B, t, r.stato, n);
        if (r.sanita) addSanita(B, t, r.sanita);
        if (r.rimuovi && t.stati[r.rimuovi]) addStato(B, t, r.rimuovi, -t.stati[r.rimuovi]);
      });
      ev(B, { t: 'regola', id: u.id, msg: r.testo });
    }));
    // Azioni
    B.unita.forEach(u => {
      if (!u.vivo) return;
      u.dadi.forEach((dado, i) => B.azioni.push({ id: u.id + '#' + i, u: u.id, i, dado, skill: null, bers: null, usata: false, annullata: false }));
    });
    pianificaAutomatico(B);
    return B.eventi;
  };

  /** Piano predefinito: nemici via IA; alleati skill 1 sul primo nemico (modificabile dalla UI). */
  function pianificaAutomatico(B) {
    B.azioni.forEach(a => {
      const u = get(B, a.u);
      if (u.lato === 'n') {
        a.skill = u.ia[(B.turno - 1 + a.i) % u.ia.length];
        a.bers = pick(B, vivi(B, 'a')).id;
      } else {
        a.skill = u.skills[0];
        a.bers = vivi(B, 'n')[0].id;
        if (u.panico) a.bers = pick(B, vivi(B, 'n')).id;
      }
    });
  }

  /** La UI imposta il piano di una Voce alleata. */
  Combat.pianifica = function (B, unitId, skillIdx, bersId) {
    const u = get(B, unitId);
    const a = B.azioni.find(x => x.u === unitId);
    if (!a || u.lato !== 'a' || u.panico) return false;
    a.skill = u.skills[skillIdx]; a.bers = bersId;
    return true;
  };

  /**
   * Anteprima per la UI (nessun effetto sulla battaglia): per l'azione pianificata di `unitId` dice
   * contro quale azione avversaria finirà in scontro, le potenze minime/massime e la probabilità di
   * vincere lo scontro (stima Monte Carlo con le stesse regole di scontro()).
   */
  Combat.anteprima = function (B, unitId, skillId, bersId) {
    const a = B.azioni.find(x => x.u === unitId); if (!a) return null;
    const vecchia = a.skill; if (skillId) a.skill = skillId;   // la risonanza dipende dalla skill che si sta valutando
    try { return anteprima(B, a, unitId, skillId, bersId); } finally { a.skill = vecchia; }
  };
  function anteprima(B, a, unitId, skillId, bersId) {
    const u = get(B, unitId), T = get(B, bersId || a.bers), s = E.SKILL[skillId || a.skill];
    if (!T || !T.vivo || !s) return null;
    const az = { u: unitId, dado: a.dado, skill: s.id, bers: T.id };
    const p = prepara(B, u, s, az, T, true);
    const res = { min: p.pb, max: p.pb + p.monete * p.pm, monete: p.monete, rel: p.rel, scontro: false, vittoria: null, rivale: null };
    const libere = T.ced === 0 ? B.azioni.filter(x => x.u === T.id && !x.annullata && x.skill) : [];
    const dif = libere.find(x => x.bers === unitId) || libere.sort((x, y) => y.dado - x.dado)[0];
    if (!dif) return res;
    // L'avversario risponde solo se agisce dopo di noi o se ci ha scelto come bersaglio.
    if (!(dif.bers === unitId || a.dado >= dif.dado)) return res;
    const sR = E.SKILL[dif.skill], pR = prepara(B, T, sR, dif, u, true);
    const chA = Combat.chanceTesta(u), chB = Combat.chanceTesta(T);
    let vinte = 0; const N = 600;
    for (let k = 0; k < N; k++) {
      let cA = p.monete, cB = pR.monete, ignA = hasPass(u, 'prima_moneta_ignorata'), ignB = hasPass(T, 'prima_moneta_ignorata'), r = 0;
      while (cA > 0 && cB > 0 && r++ < 40) {
        let tA = 0, tB = 0; for (let i = 0; i < cA; i++) if (Math.random() < chA) tA++; for (let i = 0; i < cB; i++) if (Math.random() < chB) tB++;
        const pa = p.pb + tA * p.pm, pb = pR.pb + tB * pR.pm;
        if (pa > pb) { if (ignB) ignB = false; else cB--; } else if (pb > pa) { if (ignA) ignA = false; else cA--; }
      }
      if (cA > 0 && cB <= 0) vinte++;
    }
    return Object.assign(res, { scontro: true, vittoria: vinte / N, rivale: { id: T.id, skill: sR.id, min: pR.pb, max: pR.pb + pR.monete * pR.pm, monete: pR.monete } });
  }
  Combat.costoPiano = B => B.azioni.filter(a => get(B, a.u).lato === 'a' && !a.annullata).reduce((t, a) => t + E.SKILL[a.skill].costo, 0);
  Combat.pianoValido = B => Combat.costoPiano(B) <= B.ardore;

  Combat.esegui = function (B) {
    B.eventi = [];
    const costo = Combat.costoPiano(B);
    B.ardore -= costo;
    if (costo) ev(B, { t: 'ardore', valore: B.ardore });
    const ris = Combat.risonanza(B);
    Object.keys(ris).forEach(af => { if (bonusRisonanza(ris[af])) ev(B, { t: 'risonanza', aff: af, n: ris[af], pb: bonusRisonanza(ris[af]), msg: 'Risonanza di ' + E.AFFINITA[af].nome + ' ×' + ris[af] + ': +' + bonusRisonanza(ris[af]) + ' PB a quelle skill.' }); });
    eseguiAffondo(B);
    const ordine = B.azioni.slice().sort((x, y) => (y.dado - x.dado) || (B.rng() - 0.5));
    for (const a of ordine) {
      if (B.esito) break;
      if (a.usata) continue;
      const u = get(B, a.u);
      if (!u.vivo || u.ced > 0) { a.usata = true; continue; }
      // Sanguinamento: danno quando agisce (una volta per turno)
      if (!u.bleedTurno && u.stati.sanguinamento) {
        u.bleedTurno = true;
        const n = u.stati.sanguinamento;
        const pvDopo = sottraiPv(B, u, n);
        ev(B, { t: 'dot', id: u.id, tipo: 'sanguinamento', danno: n, pvDopo });
        addStato(B, u, 'sanguinamento', -Math.floor(n / 2));
        dopoDanno(B, u, null);
        if (!u.vivo || u.ced > 0) { a.usata = true; continue; }
      }
      u.bleedTurno = true;
      let T = get(B, a.bers);
      if (!T || !T.vivo) { const l = vivi(B, opposto(u.lato)); if (!l.length) break; T = pick(B, l); a.bers = T.id; }
      const s = E.SKILL[a.skill];
      ev(B, { t: 'azione', att: u.id, bers: T.id, skill: s.id, msg: u.breve + ' usa ' + s.nome + ' su ' + T.breve + '.' });
      const dif = T.ced === 0 ? azioneDifensiva(B, T, a) : null;
      if (dif) scontro(B, a, dif); else attaccoLibero(B, a, T);
    }
    fineTurno(B);
    return B.eventi;
  };

  /* ---------- Affondo (azione di squadra su nemico in Cedimento, costo 0) ---------- */
  /** Nemici attualmente in Cedimento (bersagli possibili dell'Affondo). */
  Combat.bersagliAffondo = B => vivi(B, 'n').filter(u => u.ced > 0);
  /** Imposta (o annulla con unitId=null) l'Affondo del turno. */
  Combat.pianificaAffondo = function (B, unitId, bersId) {
    if (!unitId) { B.affondo = null; return true; }
    const u = get(B, unitId), T = get(B, bersId);
    if (!u || !u.vivo || u.lato !== 'a' || u.ced > 0 || !T || !T.vivo || T.ced <= 0) return false;
    B.affondo = { u: unitId, bers: bersId }; return true;
  };
  function eseguiAffondo(B) {
    const af = B.affondo; B.affondo = null;
    if (!af) return;
    const u = get(B, af.u), T = get(B, af.bers);
    if (!u.vivo || u.ced > 0 || !T.vivo || T.ced <= 0) return;
    const s = E.SKILL[u.skills[0]];
    ev(B, { t: 'affondo', att: u.id, bers: T.id, skill: s.id, msg: 'AFFONDO! ' + u.breve + ' approfitta del Cedimento di ' + T.breve + '.' });
    const az = { u: u.id, skill: s.id, dado: Math.max(1, ...u.dadi), bers: T.id };
    applicaFx(B, s, 'use', u, T);
    const p = prepara(B, u, s, az, T);
    p.molt *= C.AFFONDO_MOLT;
    colpi(B, p, T, p.monete);
  }

  function fineTurno(B) {
    B.unita.forEach(u => {
      if (!u.vivo) return;
      const br = u.stati.bruciatura || 0;
      if (br) {
        const pvDopo = sottraiPv(B, u, br);
        ev(B, { t: 'dot', id: u.id, tipo: 'bruciatura', danno: br, pvDopo });
        addSanita(B, u, -1);
        addStato(B, u, 'bruciatura', -1);
        dopoDanno(B, u, null);
      }
    });
    B.unita.forEach(u => {
      if (!u.vivo) return;
      const sp = u.stati.splendore || 0;
      if (sp) addStato(B, u, 'splendore', -Math.ceil(sp / 2));
      if (u.ced > 0) { u.ced--; ev(B, { t: 'ced_agg', id: u.id, ced: u.ced }); }
      if (u.panico) { u.panico = false; addSanita(B, u, -15 - u.sanita); ev(B, { t: 'panico_fine', id: u.id }); }
      u.bleedTurno = false; u.splTurno = 0; u.evade = false; u.noCed = false;
    });
    controllaEsito(B);
    if (!B.esito && B.obiettivo && B.obiettivo.tipo === 'sopravvivi' && B.turno >= B.obiettivo.turni) B.esito = 'vittoria';
    if (B.esito) ev(B, { t: 'fine', esito: B.esito });
  }

  /** Stato delle Voci a fine battaglia (per il dungeon): chi cade si rialza al 25% dei PV con Sanità −15. */
  Combat.statoFinale = function (B) {
    const out = {};
    B.unita.filter(u => u.lato === 'a' && !u.npc).forEach(u => {
      out[u.def] = u.vivo ? { pv: u.pv, sanita: u.sanita, caduto: false } : { pv: Math.max(1, Math.round(u.pvMax * 0.25)), sanita: -15, caduto: true };
    });
    return out;
  };

  /* ---------- Snapshot per la UI ---------- */
  Combat.pubblica = u => ({
    id: u.id, lato: u.lato, def: u.def, nome: u.nome, breve: u.breve, aff: u.aff, pv: u.pv, pvMax: u.pvMax, sanita: u.sanita,
    stati: Object.assign({}, u.stati), ced: u.ced, vivo: u.vivo, panico: u.panico, boss: u.boss, colore: u.colore, sigla: u.sigla,
    passiva: u.passiva, skills: u.skills.slice(), npc: u.npc, lv: u.lv
  });
  Combat.snapshot = B => B.unita.map(Combat.pubblica);
})(typeof window !== 'undefined' ? window : globalThis);
