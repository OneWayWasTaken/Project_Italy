/* ============================================================================
 * data_scene.js — le scene di dialogo (stile visual novel) in formato dati: prologhi, eventi del dungeon,
 * dialoghi pre-boss ed epiloghi dei 7 capitoli + i tre finali.
 *
 * Passi disponibili (vedi story.js):
 *   dialogo {chi, testo}     narra {testo}          entra {id, lato}      esce {id}
 *   scelta {domanda, opzioni:[{testo, flag:{k:v}, effetti:[...], vai:'etichetta'}]}
 *   etichetta {nome}   vai {a}   se {cond, allora:[..], altrimenti:[..]}   flag {set:{k:v}}
 *   effetto {pv, sanita, denari, sigilli, oggetto, bonus:{ardore,voto}, codex:[id]}     fine
 * cond: {flag, eq} oppure {somma:[chiavi], eq, min}.
 *
 * NOTA DI SCRITTURA: nomi e fatti sono storici; carattere, dialoghi e abilità delle Voci e degli Echi sono
 * INVENTATI. Nessuna frase è attribuita a persone reali come se fosse documentata.
 * ========================================================================== */
(function (root) {
  'use strict';
  const E = root.Echi;
  const D = (chi, testo) => ({ t: 'dialogo', chi, testo });
  const N = testo => ({ t: 'narra', testo });
  const SC = (domanda, opzioni) => ({ t: 'scelta', domanda, opzioni });
  const F = set => ({ t: 'flag', set });
  const EF = o => Object.assign({ t: 'effetto' }, o);
  const IF = (cond, allora, altrimenti) => ({ t: 'se', cond, allora, altrimenti: altrimenti || [] });
  const LBL = nome => ({ t: 'etichetta', nome });
  const GO = a => ({ t: 'vai', a });
  const ENTRA = (id, lato) => ({ t: 'entra', id, lato });
  const ESCE = id => ({ t: 'esce', id });
  const FINE = { t: 'fine' };
  E.SCENE = {};
  const scena = (id, sfondo, titolo, passi) => { E.SCENE[id] = { id, sfondo, titolo, passi }; };

  /** Blocco finale di ogni capitolo: l'Oblio Gentile propone di addolcire o dimenticare, il Custode sceglie. */
  const memoria = (n, soggetto, codex) => [
    ENTRA('oblio', 'dx'),
    D('oblio', 'Che fatica, ricordare. Il dolore di ' + soggetto + ' potrebbe diventare una storia dolce, o sparire del tutto. Io posso farlo per te, con gentilezza.'),
    SC('Come conservi questo ricordo?', [
      { testo: 'Ricordare tutto, anche ciò che pesa.', flag: { ['memoria' + n]: 'ricordare' }, effetti: [{ t: 'effetto', codex, sanita: 8 }] },
      { testo: 'Addolcirlo: tenere il racconto, smussare gli spigoli.', flag: { ['memoria' + n]: 'addolcire' }, effetti: [{ t: 'effetto', codex: [codex[0]], denari: 40 }] },
      { testo: 'Dimenticarlo: il peso sparisce.', flag: { ['memoria' + n]: 'dimenticare' }, effetti: [{ t: 'effetto', sigilli: 3 }] }
    ]),
    IF({ flag: 'memoria' + n, eq: 'ricordare' }, [D('custode', 'Ricorderò. Anche se fa male: soprattutto perché fa male.'), D('oblio', 'Come vuoi. Ma tornerò, Custode.')]),
    IF({ flag: 'memoria' + n, eq: 'addolcire' }, [D('custode', 'Terrò il racconto, ma non nasconderò i suoi spigoli a chi vorrà vederli.'), D('oblio', 'Un compromesso gentile. Mi piace.')]),
    IF({ flag: 'memoria' + n, eq: 'dimenticare' }, [D('custode', 'Meglio non sapere... forse.'), D('oblio', 'Vedi? È più leggero. Grazie, Custode.')]),
    ESCE('oblio'), FINE
  ];

  /* ===================================================================== */
  /* CAPITOLO I — Roma repubblicana · Eco di Canne                          */
  /* ===================================================================== */
  scena('cap1_prologo', 0, 'Prologo — Canne', [
    N("L'Archivio è silenzioso. Sullo scaffale più alto una luce rossa pulsa: un Eco si è incrinato. Il Rimorso ha deformato un ricordo."),
    ENTRA('custode', 'sx'),
    D('custode', "Canne. Estate del 216 a.C. Roma ha raccontato quella giornata in molti modi, e qui il racconto sta sanguinando."),
    N('Le Voci sono risonanze romanzate: nomi e fatti sono storici, ma carattere e parole sono inventati.'),
    ENTRA('scipione', 'dx'),
    D('scipione', "Mi chiamerete l'Africano, un giorno. Qui sono solo un giovane ufficiale che ha visto un esercito intero cadere."),
    ENTRA('spartaco', 'dx'),
    D('spartaco', "Non è la mia epoca... eppure conosco il peso di una sconfitta, e il sapore delle catene."),
    D('custode', "Il Rimorso ha mescolato i tempi. Dobbiamo attraversare l'Eco e incontrare chi lo tiene prigioniero."),
    SC('Chi apre la marcia?', [
      { testo: 'Scipione: conosce quel campo.', flag: { cap1_guida: 'scipione' } },
      { testo: 'Spartaco: ha occhi che non si fanno incantare.', flag: { cap1_guida: 'spartaco' } }
    ]),
    IF({ flag: 'cap1_guida', eq: 'scipione' }, [D('scipione', 'Seguitemi. Conosco il suono delle trombe cartaginesi.')], [D('spartaco', 'Io vado avanti. Dietro di me, tenetevi vicini.')]),
    FINE
  ]);
  scena('cap1_ev1', 0, 'I caduti di Canne', [
    N('Nella nebbia, volti senza colore: soldati che non sono mai tornati a casa. Le loro voci non sono parole, ma un mormorio.'),
    ENTRA('scipione', 'dx'),
    D('scipione', 'Non erano numeri sui registri. Avevano un nome, un villaggio, qualcuno che aspettava.'),
    SC('Cosa fate?', [
      { testo: 'Fermarsi ad ascoltare i caduti.', flag: { cap1_ascolto: true }, effetti: [{ t: 'effetto', sanita: -8, oggetto: 'incenso' }] },
      { testo: 'Proseguire senza guardarli.', flag: { cap1_ascolto: false }, effetti: [{ t: 'effetto', denari: 20 }] }
    ]),
    IF({ flag: 'cap1_ascolto', eq: true }, [D('custode', "Ascoltare costa Sanità, ma il ricordo ora è più chiaro. Prendi questo incenso: è la gratitudine degli Echi.")], [D('custode', 'A volte andare avanti è l\'unico modo di non cadere anche noi. Ma qualcosa resta indietro.')]),
    FINE
  ]);
  scena('cap1_ev2', 0, 'Le catene', [
    ENTRA('spartaco', 'dx'),
    N('Un cerchio di gladiatori-Eco chiede a Spartaco di raccontare la rivolta.'),
    D('spartaco', 'Mi vogliono dire che la mia rivolta fu soltanto giusta. Fu giusta, sì. Ma non innocente: chi fugge dalle catene a volte porta fuoco con sé.'),
    SC('Come racconti la rivolta?', [
      { testo: 'Giusta, ma non innocente: dire tutta la verità.', flag: { cap1_onesta: true }, effetti: [{ t: 'effetto', sanita: 10 }] },
      { testo: 'Solo giusta: la gloria è più semplice.', flag: { cap1_onesta: false }, effetti: [{ t: 'effetto', sanita: -5, denari: 30 }] }
    ]),
    IF({ flag: 'cap1_onesta', eq: true }, [D('spartaco', 'Dirlo tutto mi pesa meno che mentire.')], [D('spartaco', 'Facile così... ma a voi piaceva. A me no.')]),
    FINE
  ]);
  scena('cap1_boss', 0, 'Annibale, Eco di Canne', [
    ENTRA('annibale', 'dx'), ENTRA('scipione', 'sx'),
    D('annibale', 'Roma ricorda Canne come una ferita; Cartagine come un trionfo. Io sono entrambe le cose, e nessuna dice il vero.'),
    D('scipione', 'Tu sei solo l\'Eco di una giornata. La storia è più grande di un giorno.'),
    D('annibale', 'Eppure un giorno basta a cambiare un secolo. Mostrami che sai ricordarlo tutto, oppure resta qui a perderti.'),
    FINE
  ]);
  scena('cap1_epilogo', 0, 'Epilogo — Canne', [
    N("L'Eco di Canne si placa. La nebbia si dirada e il campo è soltanto un campo."),
    ENTRA('custode', 'sx'),
    D('custode', 'Non abbiamo cancellato nulla. Abbiamo solo smesso di mentire sul modo in cui è andata.'),
    ...memoria(1, 'Canne', ['cap1_a', 'cap1_b'])
  ]);

  /* ===================================================================== */
  /* CAPITOLO II — Impero · Eco dell'Incendio                               */
  /* ===================================================================== */
  scena('cap2_prologo', 1, 'Prologo — Il fuoco', [
    N('Una Roma di marmo e fiamme. Il cielo ha il colore di un tramonto che non finisce mai.'),
    ENTRA('custode', 'sx'),
    D('custode', 'Anno 64. Per nove giorni la città brucia. Le fonti discutono: forse nessuno lo volle, certo qualcuno ne approfittò.'),
    ENTRA('augusto', 'dx'),
    D('augusto', 'Ho dato a Roma una pace lunga. Non so quanto del suo prezzo sia stato pagato da altri.'),
    ENTRA('perpetua', 'dx'),
    D('perpetua', 'Io vengo da un tempo dopo questo rogo. Ma so cosa significa essere accusati per ciò in cui si crede.'),
    D('custode', 'Seguiamo il fumo. Al centro c\'è un Eco che canta mentre tutto brucia.'),
    FINE
  ]);
  scena('cap2_ev1', 1, 'Il capro espiatorio', [
    N('Persone legate ai pali di un giardino. Qualcuno ha deciso che la colpa è loro. Gli storici antichi riferiscono che Nerone accusò i cristiani; sulle cause del fuoco, nessuna certezza.'),
    ENTRA('perpetua', 'dx'),
    D('perpetua', 'Li accusano senza prove. Non posso restare ferma.'),
    SC('Cosa fate?', [
      { testo: 'Difendere gli accusati, a ogni costo.', flag: { cap2_difesa: true }, effetti: [{ t: 'effetto', pv: -0.12, bonus: { voto: 2 } }] },
      { testo: 'Osservare e cercare un modo meno rischioso.', flag: { cap2_difesa: false }, effetti: [{ t: 'effetto', sanita: -8 }] }
    ]),
    IF({ flag: 'cap2_difesa', eq: true }, [D('perpetua', 'Ci hanno colpiti, ma qualcuno ora sa che non erano soli.')], [D('perpetua', 'Ho obbedito alla prudenza. Non dimenticherò quei volti.')]),
    FINE
  ]);
  scena('cap2_ev2', 1, 'Il prezzo della pace', [
    ENTRA('augusto', 'dx'),
    N('Un banchetto di Echi che applaudono. Dietro di loro, ombre di chi non ebbe voce.'),
    D('augusto', 'Una pace richiede racconti. A volte i racconti nascondono. Dimmi, Custode: la pace vale ogni prezzo?'),
    SC('La tua risposta:', [
      { testo: 'Ogni prezzo va nominato, anche se la pace resta.', flag: { cap2_pace: 'nominare' }, effetti: [{ t: 'effetto', sanita: 8, oggetto: 'pozione' }] },
      { testo: 'La pace vale quasi ogni prezzo.', flag: { cap2_pace: 'accettare' }, effetti: [{ t: 'effetto', denari: 40 }] }
    ]),
    D('augusto', 'Ci rifletterò. Anche un impero dovrebbe imparare a rispondere.'),
    FINE
  ]);
  scena('cap2_boss', 1, "Nerone, Eco dell'Incendio", [
    ENTRA('nerone', 'dx'),
    D('nerone', 'Roma brucia e io canto. Chi mi darà torto, se il rogo è così bello?'),
    D('augusto', 'Un Eco che confonde bellezza e potere. Siamo qui per darti una forma onesta.'),
    D('nerone', 'Onesta? Il pubblico non la vuole. Il pubblico vuole il fuoco!'),
    FINE
  ]);
  scena('cap2_epilogo', 1, 'Epilogo — Il fuoco si spegne', [
    N('Le fiamme si sono spente. Resta un odore di cenere, e sotto la cenere i nomi di chi pagò.'),
    ENTRA('custode', 'sx'),
    D('custode', "Non sappiamo con certezza chi appiccò il fuoco. Sappiamo chi fu accusato, e questo è già una verità."),
    ...memoria(2, 'quell\'incendio', ['cap2_a', 'cap2_b'])
  ]);

  /* ===================================================================== */
  /* CAPITOLO III — Medioevo e Comuni · Eco della Torre                     */
  /* ===================================================================== */
  scena('cap3_prologo', 2, 'Prologo — La torre', [
    N('Campi, torri e campanili. Un vento freddo porta l\'odore di neve e di ferro.'),
    ENTRA('custode', 'sx'),
    D('custode', "Il Medioevo italiano: Comuni, papi, imperatori e signori. Qui un tiranno ha lasciato un'ombra lunga."),
    ENTRA('matilde', 'dx'),
    D('matilde', 'Ho conosciuto Canossa in inverno. Ho visto un re aspettare nel gelo e un papa decidere se perdonare.'),
    ENTRA('federico', 'dx'),
    D('federico', 'Io preferisco i falchi e le macchine. Ma vi seguirò: anche un curioso deve guardare la torre da vicino.'),
    FINE
  ]);
  scena('cap3_ev1', 2, 'Canossa', [
    ENTRA('matilde', 'dx'),
    N('Davanti a una porta chiusa, un uomo scalzo nella neve: l\'Eco di un re. Passano i giorni.'),
    D('matilde', 'Il papa dubita della sua sincerità. Il re ha una corona da riconquistare. Io posso mediare.'),
    SC('Qual è la tua mediazione?', [
      { testo: 'Perdono: una porta aperta può cambiare tutto.', flag: { cap3_perdono: true }, effetti: [{ t: 'effetto', sanita: 8, pv: 0.1 }] },
      { testo: 'Garanzie: il perdono senza prove è un rischio.', flag: { cap3_perdono: false }, effetti: [{ t: 'effetto', bonus: { ardore: 1 } }] }
    ]),
    D('matilde', 'La storia sa essere paziente. A noi tocca scegliere come esserlo.'),
    FINE
  ]);
  scena('cap3_ev2', 2, 'I rifugiati della torre', [
    N('Una piazza deserta. Dietro le porte, famiglie in fuga dalla Marca: sanno che nella torre non ci sono leggi.'),
    ENTRA('federico', 'dx'),
    D('federico', 'Un sapere che serve solo al potere diventa una gabbia. Possiamo aiutarli, ma costa tempo e risorse.'),
    SC('Aiutate i rifugiati?', [
      { testo: 'Sì: aprire un varco nelle mura.', flag: { cap3_rifugiati: true }, effetti: [{ t: 'effetto', pv: -0.1, sigilli: 2 }] },
      { testo: 'No: non possiamo permettercelo ora.', flag: { cap3_rifugiati: false }, effetti: [{ t: 'effetto', denari: 30, sanita: -6 }] }
    ]),
    FINE
  ]);
  scena('cap3_boss', 2, 'Ezzelino, Eco della Torre', [
    ENTRA('ezzelino', 'dx'),
    D('ezzelino', 'Il timore è una legge più solida delle leggi. Chi lo dimentica, perde ogni cosa.'),
    D('matilde', 'Un Eco che confonde forza e giustizia. Chiudiamo questo ciclo.'),
    FINE
  ]);
  scena('cap3_epilogo', 2, 'Epilogo — La torre cade', [
    N('La torre non è più che un ammasso di pietre. Dai campi tornano i rumori di una vita normale.'),
    ENTRA('custode', 'sx'),
    D('custode', 'Molti tiranni sono stati costruiti da chi ha scelto di tacere.'),
    ...memoria(3, 'quella torre', ['cap3_a', 'cap3_b'])
  ]);

  /* ===================================================================== */
  /* CAPITOLO IV — Rinascimento · Eco del Falò                              */
  /* ===================================================================== */
  scena('cap4_prologo', 3, 'Prologo — Firenze', [
    N('Una Firenze di cupole e botteghe. Nella piazza principale si accatasta legna: sembra una festa, ma il fumo è troppo scuro.'),
    ENTRA('custode', 'sx'),
    D('custode', "Il Rinascimento ha dato bellezza e dubbio. Qui un predicatore vuole bruciare ciò che chiama vanità."),
    ENTRA('leonardo', 'dx'),
    D('leonardo', 'Osservo prima di giudicare. Ma ho un taccuino pieno di cose che non vorrei vedere in cenere.'),
    ENTRA('caterina', 'dx'),
    D('caterina', 'Io difendo rocche, non idee. Ma capisco il valore di ciò che si difende con le unghie.'),
    FINE
  ]);
  scena('cap4_ev1', 3, 'Il falò delle vanità', [
    ENTRA('leonardo', 'dx'),
    N('Libri, specchi, dipinti: una montagna di cose che qualcuno ha deciso siano peccato. Tra i dipinti, uno è ancora salvabile.'),
    SC('Cosa fa Leonardo?', [
      { testo: 'Rischiare per salvare il dipinto.', flag: { cap4_dipinto: true }, effetti: [{ t: 'effetto', pv: -0.12, oggetto: 'benedizione' }] },
      { testo: "Osservare e ricordare a memoria quello che brucerà.", flag: { cap4_dipinto: false }, effetti: [{ t: 'effetto', sanita: -8, denari: 20 }] }
    ]),
    IF({ flag: 'cap4_dipinto', eq: true }, [D('leonardo', 'Salvata. Non perché fosse perfetta: perché qualcuno l\'ha fatta con cura.')], [D('leonardo', 'Disegnerò quello che ho visto. Sarà un altro modo di non farlo sparire.')]),
    FINE
  ]);
  scena('cap4_ev2', 3, 'La rocca di Ravaldino', [
    ENTRA('caterina', 'dx'),
    N('Mura, cannoni, fumo. Un Eco di prigionieri attende la sua sentenza.'),
    D('caterina', 'Ho resistito in questa rocca. Ora mi chiedono come tratterei chi si è arreso.'),
    SC('Come tratti i prigionieri?', [
      { testo: 'Clemenza: la forza non deve diventare crudeltà.', flag: { cap4_clemenza: true }, effetti: [{ t: 'effetto', sanita: 10 }] },
      { testo: 'Rigore: la fermezza protegge chi resta.', flag: { cap4_clemenza: false }, effetti: [{ t: 'effetto', denari: 40, sanita: -5 }] }
    ]),
    FINE
  ]);
  scena('cap4_boss', 3, 'Savonarola, Eco del Falò', [
    ENTRA('savonarola', 'dx'),
    D('savonarola', "Non bruciamo l'arte: bruciamo l'orgoglio. Chi ama davvero la bellezza non la mette sopra la coscienza."),
    D('leonardo', 'Chi sa guardare non brucia. Ma può imparare a farlo con cautela.'),
    FINE
  ]);
  scena('cap4_epilogo', 3, 'Epilogo — Cenere e disegni', [
    N('Il falò è spento. Nelle ceneri, fogli carbonizzati con il segno di mani che li hanno fatti.'),
    ENTRA('custode', 'sx'),
    D('custode', 'Difendere la bellezza non significa difendere ogni cosa. Ma bruciare tutto non è difesa di nulla.'),
    ...memoria(4, 'quel falò', ['cap4_a', 'cap4_b'])
  ]);

  /* ===================================================================== */
  /* CAPITOLO V — Risorgimento · Eco delle Cinque Giornate                  */
  /* ===================================================================== */
  scena('cap5_prologo', 4, 'Prologo — Barricate', [
    N('Barricate di carri e materassi. Qualcuno suona una campana. Nell\'aria, l\'odore di un tempo che cambia.'),
    ENTRA('custode', 'sx'),
    D('custode', "Milano, 1848. Poi i Mille, Teano, l'Unità. Un'Italia nata tra entusiasmo, politica e costi che pochi ricordano."),
    ENTRA('garibaldi', 'dx'),
    D('garibaldi', 'Non ho mai amato i discorsi. Preferisco muovermi. Ma questo Eco ha parlato troppo a lungo da solo.'),
    ENTRA('cavour', 'dx'),
    D('cavour', 'Si può fare una nazione con la spada, ma anche con le lettere. Io ho scelto la penna, e non mi pento.'),
    FINE
  ]);
  scena('cap5_ev1', 4, 'Bronte', [
    ENTRA('garibaldi', 'dx'),
    N('Un villaggio siciliano nel 1860: contadini che speravano nella terra e furono repressi da truppe garibaldine. Un episodio documentato che molti racconti dell\'Unità tacciono.'),
    D('garibaldi', 'Quel giorno non ero a Bronte, ma il mio nome era sulla bandiera. E un nome pesa anche quando non c\'è la mano.'),
    SC('Come lo ricordate?', [
      { testo: 'Chiedere giustizia, anche contro i nostri.', flag: { cap5_bronte: 'giustizia' }, effetti: [{ t: 'effetto', sanita: 8, pv: -0.08 }] },
      { testo: "Tacere per non spezzare l'unità.", flag: { cap5_bronte: 'silenzio' }, effetti: [{ t: 'effetto', denari: 40, sanita: -8 }] }
    ]),
    FINE
  ]);
  scena('cap5_ev2', 4, 'Teano', [
    ENTRA('cavour', 'dx'), ENTRA('garibaldi', 'dx'),
    N('Una strada polverosa. Due uomini che hanno contribuito a fare l\'Italia si incontreranno o si ignoreranno.'),
    D('cavour', 'Nessuna nazione si fa senza compromessi. Ma i compromessi devono avere un nome.'),
    SC('Cosa conta di più?', [
      { testo: 'Un patto chiaro, anche se costa orgoglio.', flag: { cap5_patto: true }, effetti: [{ t: 'effetto', bonus: { ardore: 1 } }] },
      { testo: "L'entusiasmo: senza slancio non si costruisce.", flag: { cap5_patto: false }, effetti: [{ t: 'effetto', pv: 0.12 }] }
    ]),
    FINE
  ]);
  scena('cap5_boss', 4, 'Radetzky, Eco delle Cinque Giornate', [
    ENTRA('radetzky', 'dx'),
    D('radetzky', "L'ordine è l'unica libertà che conosco. Fuori da esso c'è soltanto confusione."),
    D('garibaldi', 'C\'è un bel pezzo di mondo, fuori dalle tue linee.'),
    FINE
  ]);
  scena('cap5_epilogo', 4, 'Epilogo — Una nazione in costruzione', [
    N('Le barricate sono ferme. Nella piazza qualcuno canta un inno stonato, e va bene così.'),
    ENTRA('custode', 'sx'),
    D('custode', "Una nazione si fa con eroi, ma anche con tutte le persone che pagarono per essa senza avere un nome sulle bandiere."),
    ...memoria(5, "quell'Italia nascente", ['cap5_a', 'cap5_b'])
  ]);

  /* ===================================================================== */
  /* CAPITOLO VI — Prima guerra mondiale · Eco del Carso                    */
  /* ===================================================================== */
  scena('cap6_prologo', 5, 'Prologo — Il Carso', [
    N('Pietra bianca, filo spinato, un cielo grigio. Il rumore dell\'artiglieria arriva da lontano e non si ferma mai.'),
    ENTRA('custode', 'sx'),
    D('custode', 'Dal 1915 al 1917, dodici battaglie sull\'Isonzo. Eroismi e ordini senza senso, nello stesso fango.'),
    ENTRA('baracca', 'dx'),
    D('baracca', 'Io volo sopra tutto questo. Da lassù sembra quasi pulito. Quasi.'),
    ENTRA('mentil', 'dx'),
    D('mentil', 'Io vengo dalla Carnia. Porto pane e munizioni sulle spalle. Non mi sento un\'eroina: mi sento utile.'),
    FINE
  ]);
  scena('cap6_ev1', 5, 'La decimazione', [
    N('Un reparto allineato in silenzio. Un ordine ripetuto: estrarre a sorte un uomo ogni dieci. Casi di decimazione furono documentati durante la guerra.'),
    ENTRA('baracca', 'dx'),
    D('baracca', 'Se lo racconti, non è più soltanto gloria. Ma se non lo racconti, è un\'altra bugia.'),
    SC('Come lo ricordate?', [
      { testo: 'Raccontarlo per intero, con i nomi che si conoscono.', flag: { cap6_decimazione: true }, effetti: [{ t: 'effetto', sanita: -6, oggetto: 'incenso' }] },
      { testo: 'Non soffermarsi: la guerra è già abbastanza.', flag: { cap6_decimazione: false }, effetti: [{ t: 'effetto', denari: 30 }] }
    ]),
    FINE
  ]);
  scena('cap6_ev2', 5, 'La gerla', [
    ENTRA('mentil', 'dx'),
    N('Un sentiero di montagna, una gerla piena. Più su, soldati feriti attendono bende e acqua; più in là, altri aspettano munizioni.'),
    D('mentil', 'Posso portare una cosa sola, in questo viaggio. Scegli tu.'),
    SC('Cosa porta la gerla?', [
      { testo: 'Bende e acqua per i feriti.', flag: { cap6_gerla: 'feriti' }, effetti: [{ t: 'effetto', pv: 0.15 }] },
      { testo: 'Munizioni per chi regge la linea.', flag: { cap6_gerla: 'munizioni' }, effetti: [{ t: 'effetto', bonus: { ardore: 1 } }] }
    ]),
    FINE
  ]);
  scena('cap6_boss', 5, "L'Eco dell'Isonzo", [
    ENTRA('isonzo', 'dx'),
    D('isonzo', 'Dodici volte, dodici volte. E il fiume è sempre lì.'),
    D('mentil', 'Dietro ogni numero c\'è una persona. Lo dimostreremo.'),
    FINE
  ]);
  scena('cap6_epilogo', 5, 'Epilogo — Dopo la guerra', [
    N('Sul Carso rimane il vento. E, in lontananza, il suono di campane di paesi lontani.'),
    ENTRA('custode', 'sx'),
    D('custode', 'Dire «gloria» o «tragedia» non basta: servono entrambe le parole, e un silenzio per chi non ne ebbe nessuna.'),
    ...memoria(6, 'quella guerra', ['cap6_a', 'cap6_b'])
  ]);

  /* ===================================================================== */
  /* CAPITOLO VII — Seconda guerra mondiale · Eco del Silenzio             */
  /* (storia e dilemmi morali; nessuna glorificazione)                      */
  /* ===================================================================== */
  scena('cap7_prologo', 6, 'Prologo — Il Silenzio', [
    N('Strade senza voci. Un orologio fermo. Finestre chiuse da cui si sente un respiro trattenuto.'),
    ENTRA('custode', 'sx'),
    D('custode', 'Questo non è un Eco di battaglia. È l\'Eco di chi vide e non disse, di chi disse e rischiò, di chi non poté dire.'),
    ENTRA('perlasca', 'dx'),
    D('perlasca', 'Non ho fatto nulla di straordinario. Ho solo usato quello che avevo, nei giorni giusti.'),
    ENTRA('anselmi', 'dx'),
    D('anselmi', 'Avevo diciassette anni. Un giorno ho visto qualcosa che mi ha costretta a scegliere da che parte stare.'),
    ENTRA('bartali', 'dx'),
    D('bartali', 'Io pedalavo. Era tutto qui. E nelle ruote, a volte, portavo più di quanto sembrasse.'),
    FINE
  ]);
  scena('cap7_ev1', 6, 'I documenti', [
    ENTRA('perlasca', 'dx'),
    N('Budapest, 1944. Una stanza piena di persone che hanno bisogno di un documento, un nome, una protezione.'),
    D('perlasca', 'Posso dire di essere chi non sono. Rischio molto: e rischio anche chi si fida di me.'),
    SC('Cosa scegli?', [
      { testo: 'Rischiare: più persone possibile.', flag: { cap7_documenti: 'rischiare' }, effetti: [{ t: 'effetto', pv: -0.1, sigilli: 2, bonus: { voto: 2 } }] },
      { testo: 'Essere prudenti: poche persone, meno rischi.', flag: { cap7_documenti: 'prudenza' }, effetti: [{ t: 'effetto', sanita: 6 }] }
    ]),
    D('perlasca', 'Nessuna scelta è perfetta. Quella che ho fatto, la rifarei.'),
    FINE
  ]);
  scena('cap7_ev2', 6, 'La staffetta', [
    ENTRA('anselmi', 'dx'), ENTRA('bartali', 'dx'),
    N('Un posto di blocco. Una bicicletta con un telaio troppo pesante. Un messaggio nascosto in una tasca.'),
    D('anselmi', 'Se mi fermano, non ho una storia pronta. Se passo, forse qualcuno vive.'),
    SC('Come passate?', [
      { testo: 'Affidare il messaggio a Bartali.', flag: { cap7_staffetta: 'bartali' }, effetti: [{ t: 'effetto', bonus: { ardore: 1 }, oggetto: 'talismano' }] },
      { testo: 'Portarlo di persona, a piedi.', flag: { cap7_staffetta: 'anselmi' }, effetti: [{ t: 'effetto', pv: -0.1, sanita: 8 }] }
    ]),
    FINE
  ]);
  scena('cap7_boss', 6, 'Il Silenzio', [
    ENTRA('silenzio', 'dx'),
    D('silenzio', 'Non dire nulla è più comodo. Nessuno ti accusa e nessuno ti ringrazia.'),
    D('custode', 'Il Silenzio non si sconfigge: si attraversa. Proteggete i Testimoni finché il tempo non cambia.'),
    FINE
  ]);
  // Epilogo del capitolo VII: rivela l'Oblio e decide uno dei tre finali
  scena('cap7_epilogo', 6, 'Epilogo — Chi ricorda', [
    N('Il Silenzio si dissolve. Nell\'aria, un\'unica voce che parla piano.'),
    ENTRA('oblio', 'dx'),
    D('oblio', 'Sei arrivato fin qui, Custode. Sei stanco, vero? Io non sono il Rimorso: sono ciò che nasce quando il ricordo pesa troppo.'),
    D('custode', 'Lo so. Ti ho sempre sentito in ogni Eco. Dicevi: «Basta una carezza e tutto passa».'),
    D('oblio', 'Perché negarlo? Una memoria dolce non fa male a nessuno. Con l\'Italia intera, ti propongo lo stesso.'),
    SC('Qual è la tua scelta finale?', [
      { testo: 'Ricordare tutto, con onestà.', flag: { cap7_scelta: 'ricordare' } },
      { testo: 'Addolcire: ricordare, ma smussando.', flag: { cap7_scelta: 'addolcire' } },
      { testo: 'Dimenticare: lasciare che il peso sparisca.', flag: { cap7_scelta: 'dimenticare' } }
    ]),
    // Il finale dipende da questa scelta; le scene finali aggiungono sfumature in base a come hai ricordato nei capitoli precedenti
    IF({ flag: 'cap7_scelta', eq: 'ricordare' }, [F({ finale: 'ricordare' })]),
    IF({ flag: 'cap7_scelta', eq: 'dimenticare' }, [F({ finale: 'dimenticare' })]),
    IF({ flag: 'cap7_scelta', eq: 'addolcire' }, [F({ finale: 'addolcire' })]),
    ESCE('oblio'),
    FINE
  ]);

  /* ===================================================================== */
  /* FINALI                                                                  */
  /* ===================================================================== */
  scena('fine_ricordare', 6, 'Finale — Ricordare', [
    ENTRA('custode', 'sx'),
    N('Il Custode apre le finestre dell\'Archivio. Ogni Eco ritrova la sua voce, anche quelle che non piacciono.'),
    D('custode', 'Ricordare non è collezionare dolore. È dare a ogni storia il suo posto, perché non torni a fare male di nascosto.'),
    ENTRA('oblio', 'dx'),
    D('oblio', 'Mi sconfiggi? No. Mi rendi inutile. È più gentile ancora.'),
    IF({ somma: ['memoria1', 'memoria2', 'memoria3', 'memoria4', 'memoria5', 'memoria6'], eq: 'ricordare', min: 4 }, [D('custode', 'Non è stato un solo gesto: ogni Eco mi ha insegnato a non voltarmi altrove.')], [D('custode', 'Non sempre sono stato coerente. Ma ho imparato a tornare indietro e a guardare di nuovo.')]),
    N('FINE — «Ricordare»: la memoria onesta, con i suoi pesi e le sue luci. Grazie per aver giocato.'),
    FINE
  ]);
  scena('fine_addolcire', 6, 'Finale — Addolcire', [
    ENTRA('custode', 'sx'),
    N('Il Custode conserva i racconti ma ne addolcisce gli spigoli. L\'Archivio è più sereno e più silenzioso.'),
    D('custode', 'Forse bastava. Forse no. Qualcuno, un giorno, tornerà a guardare i bordi che abbiamo smussato.'),
    ENTRA('oblio', 'dx'),
    D('oblio', 'Vedi? Siamo più simili di quanto pensi.'),
    IF({ somma: ['memoria1', 'memoria2', 'memoria3', 'memoria4', 'memoria5', 'memoria6'], eq: 'dimenticare', min: 3 }, [N('Troppi ricordi, nel tempo, sono stati lasciati andare. La dolcezza ha il suo prezzo.')], [N('Molti ricordi sono rimasti interi: i bordi smussati sono pochi, e si possono ancora riaprire.')]),
    N('FINE — «Addolcire»: un compromesso che regge finché qualcuno non chiede la verità intera. Grazie per aver giocato.'),
    FINE
  ]);
  scena('fine_dimenticare', 6, 'Finale — Dimenticare', [
    ENTRA('custode', 'sx'),
    N('Gli Echi si spengono uno a uno, senza dolore. L\'Archivio è luminoso e vuoto.'),
    D('custode', 'Non ricordo perché ero qui... ma mi sento leggero.'),
    ENTRA('oblio', 'dx'),
    D('oblio', 'Sì. Molto leggero.'),
    N('FINE — «Dimenticare»: la quiete di chi non sa più. Puoi sempre riprovare e scegliere altrimenti.'),
    FINE
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
