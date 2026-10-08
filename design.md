# ECHI D'ITALIA — Documento di design (Fase 0)

> Titolo di lavoro: **Echi d'Italia**. Gioco a turni in HTML/JS/CSS puri (canvas + DOM), senza librerie.
> Tutti i numeri sono **provvisori** e vanno bilanciati nelle fasi successive. Tutto ciò che è qui descritto
> finirà in tabelle di `data.js`, quindi ogni cifra è modificabile senza toccare la logica.

---

## 1. Cornice narrativa

Il giocatore è il **Custode**, l'ultimo archivista dell'**Archivio** (l'hub di gioco): una biblioteca sospesa fuori dal tempo
dove la memoria collettiva dell'Italia si conserva come **Echi**. Un fenomeno chiamato **il Rimorso** deforma gli Echi:
ciò che è stato taciuto, rimosso o addolcito dalla memoria diventa mostruoso e instabile. Il Custode entra negli Echi,
ne raccoglie i protagonisti (**Voci**, i personaggi giocabili) e affronta il **Nodo** di ogni epoca (il boss) per
restituire all'Eco una forma onesta.

- Le Voci non sono le persone reali: sono *risonanze* costruite dalla memoria. Questo permette di usare nomi e fatti storici
  con caratteri, dialoghi e abilità **inventati**, dichiarandolo nel gioco (vedi §9).
- Tono: serio ma non cupo a oltranza; ironia leggera nei capitoli antichi, sempre più sobrio verso il Novecento.
- Filo conduttore: *ricordare con onestà* (né mitizzare né cancellare). Il Rimorso non va "sconfitto": va **ascoltato** e superato.
- Antagonista di fondo: una voce dell'Archivio, **"l'Oblio Gentile"**, che propone di cancellare i ricordi dolorosi. Si rivela
  nel capitolo VII; il finale dipende dalle scelte (flag) accumulate.

### Capitoli (epoche)

| # | Epoca | Eco | Nodo (boss) |
|---|-------|-----|-------------|
| I | Roma repubblicana | L'Eco di Canne | Annibale Barca |
| II | Impero | L'Eco dell'Incendio | Nerone |
| III | Medioevo e Comuni | L'Eco della Torre | Ezzelino da Romano |
| IV | Rinascimento | L'Eco del Falò | Girolamo Savonarola |
| V | Risorgimento | L'Eco delle Cinque Giornate | Josef Radetzky |
| VI | Prima guerra mondiale | L'Eco del Carso | L'Eco dell'Isonzo (entità) |
| VII | Seconda guerra mondiale | L'Eco del Silenzio | Il Silenzio (entità) |

---

## 2. Sistema di combattimento (riassunto delle regole)

Meccanica ispirata ai *clash a monete*, con nomi e regole propri.

### 2.1 Risorse e statistiche
- **PV**: punti vita. **Sanità** (−45…+45, parte da 0): modifica la probabilità di "Testa" delle monete.
- **Velocità**: ogni Voce tira un **dado di velocità** (min–max di personaggio) a inizio turno; ordina le azioni e assegna chi contrasta chi.
- **Ardore**: risorsa di squadra. Inizio battaglia 3, +2 a turno (max 10). Le skill costano Ardore (0 / 2-3 / 5-6).
- **Schieramento**: 4 Voci in campo scelte da un roster; fino a 4 nemici.

### 2.2 Skill e monete
Ogni skill ha: **N monete**, **Potenza base (PB)**, **Potenza moneta (PM)**, **costo Ardore**, **affinità**, **effetti**.
- Ogni moneta viene lanciata: **Testa** con probabilità `50% + Sanità%` (limitata a 5%–95%), altrimenti **Croce**.
- **Potenza** = `PB + (numero di Teste tra le monete ancora integre × PM)`.
- Nella fase di pianificazione ogni Voce sceglie in anticipo la skill (tra le 3) e il bersaglio; il nemico mostra le sue intenzioni.

### 2.3 Scontro (clash)
1. Due azioni si "agganciano" quando una è diretta all'altra (la velocità maggiore sceglie il bersaglio; le azioni non agganciate colpiscono libere).
2. Si lanciano le monete e si confrontano le potenze. **Chi perde il confronto perde una moneta** (la sua prima ancora integra); si ripete finché uno dei due ha 0 monete.
3. Il vincitore colpisce con le monete rimaste: ogni moneta infligge `potenza finale × moltiplicatore affinità`.
4. Un'azione che resta senza monete è **spezzata**. Gli effetti "al colpo" si applicano solo se la moneta che li porta colpisce.

### 2.4 Sanità
- Vincere un clash, uccidere, usare effetti Splendore/Voto: **+Sanità**. Perdere un clash, subire un colpo critico, vedere un alleato crollare: **−Sanità**.
- A **−45** la Voce entra in **Panico** per 1 turno: monete a probabilità minima e non sceglie bersaglio. Poi la Sanità risale a −15.
- A **+45** ottiene **Esaltazione**: +1 PM a tutte le sue skill fino a fine battaglia.

### 2.5 Stagger (Cedimento)
- Soglie PV a 50% e 25%: la Voce/il nemico che le attraversa va in **Cedimento** per il turno seguente: nessuna azione, riceve +30% danno, le sue monete valgono 0 se agganciato.
- Un nemico cedevole può essere colpito da **Affondo** (azione di squadra a costo 0, bonus di danno).

### 2.6 Effetti di stato
| Stato | Affinità | Effetto |
|-------|----------|---------|
| **Sanguinamento** (n) | Sangue | Quando il bersaglio agisce subisce n danni; poi n si dimezza (arr. per eccesso). |
| **Bruciatura** (n) | Ingegno | A fine turno subisce n danni *e* −1 Sanità; poi n−1. |
| **Marchio** (n) | Astuzia | Il bersaglio subisce +5% danno per marchio (max 10 stack); si consuma 1 stack per colpo ricevuto. |
| **Formazione** (n) | Ordine | +1 PM ogni 3 stack (max +3); riduce di 5% per stack i danni subiti (max 50%). Si consuma 1 stack a ogni scontro perso. |
| **Voto** (n) | Fede | Ogni stack assorbe 3 danni e rende +1 Sanità quando assorbe; non scade a fine turno. |
| **Splendore** (n) | Gloria | +0,5 PB per stack (max +6); +2 Sanità a ogni vittoria in clash; si dimezza a fine turno. |
| **Panico** | — | Vedi §2.4. |

---

## 3. Le sei affinità

| Affinità | Tema | Stato firma | Idea di gioco |
|----------|------|-------------|---------------|
| **Gloria** | Trionfi, carisma, prestigio | Splendore | Si carica vincendo clash; danno esplosivo e Sanità alta. |
| **Ingegno** | Macchine, scienza, strategia | Bruciatura | Danno nel tempo, controllo della velocità, bonus per varietà di skill. |
| **Fede** | Devozione, sacrificio, comunità | Voto | Scudi, recupero di Sanità, resistenza ai colpi. |
| **Sangue** | Furia, rivolta, sopravvivenza | Sanguinamento | Alto rischio/alto danno, migliora a PV bassi. |
| **Ordine** | Leggi, legioni, disciplina | Formazione | Difesa solida, bonus di squadra, cala la variabilità. |
| **Astuzia** | Inganno, diplomazia, spionaggio | Marchio | Indebolisce, prepara colpi, punisce i bersagli già segnati. |

### 3.1 Ciclo di vantaggio
```
Ordine → Sangue → Astuzia → Ingegno → Fede → Gloria → (torna a) Ordine
```
Ognuna è forte contro la successiva e debole contro la precedente.

| Attaccante → Difensore | Perché (in-game) |
|---|---|
| Ordine → Sangue | La disciplina doma la furia |
| Sangue → Astuzia | La violenza spezza l'inganno |
| Astuzia → Ingegno | Lo spionaggio sabota le macchine |
| Ingegno → Fede | La ragione mette in crisi il dogma |
| Fede → Gloria | L'umiltà smonta la vanità |
| Gloria → Ordine | Il carisma travolge la burocrazia |

- **Vantaggio** (attaccante forte): PM +1 e danno ×1,25.
- **Svantaggio** (attaccante debole, cioè il senso inverso): PM −1 e danno ×0,8.

### 3.2 Concordia (sinergia di squadra)
Le coppie **opposte** nel ciclo formano una **Concordia**: *Ordine–Ingegno*, *Sangue–Fede*, *Astuzia–Gloria*.
Se in squadra ci sono due Voci di una coppia: +10% Sanità iniziale e +1 Ardore a inizio battaglia per ogni Concordia attiva.
Tre Concordie diverse in squadra sono impossibili con 4 Voci (massimo 2): è una scelta di composizione.

### 3.3 Affinità doppie e nemici
I nemici possono avere due affinità (primaria e secondaria): vale il vantaggio/svantaggio *peggiore* per chi attacca
e il *migliore* per chi difende, così le combinazioni creano puzzle di squadra senza diventare un foglio di calcolo.

---

## 4. Le Voci (personaggi giocabili) — 15

Legenda skill: `Monete · PB · PM · Costo`. Le tre skill sono **S1 base** (costo 0-1), **S2 tecnica** (2-3), **S3 culmine** (5-6).
Velocità = intervallo del dado. "★" = rarità (gacha): ★★★ comune, ★★★★ rara, ★★★★★ leggendaria.
Le 15 Voci sono distribuite 2 per epoca, con 3 per la Seconda guerra mondiale. Il ciclo duplicati potenzia le Voci (Fase 4).

### Capitolo I — Roma repubblicana

**1. Publio Cornelio Scipione, detto l'Africano** — Gloria · ★★★★★ · Comandante · PV 95 · Vel 4–7
Passiva **Console Vittorioso**: a inizio battaglia ottiene 1 Splendore per ogni alleato in vita.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Gladio Disciplinato | 2 · 4 · +3 · 0 | Al colpo: +1 Splendore. |
| Manovra Avvolgente | 3 · 4 · +3 · 2 | Se vince il clash: Marchio 2 sul bersaglio. |
| Giornata di Zama | 4 · 6 · +4 · 5 | Bersaglio singolo; +2 danno per stack di Splendore. |

**2. Spartaco** — Sangue · ★★★★ · Berserker · PV 105 · Vel 3–6
Passiva **Catene Spezzate**: +1 PM ogni 25% di PV mancanti (max +3).
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Colpo di Gladio | 2 · 4 · +3 · 0 | Al colpo: Sanguinamento 1. |
| Rete e Tridente | 3 · 3 · +3 · 2 | Se vince il clash: Sanguinamento 2 e −1 Velocità al bersaglio al turno seguente. |
| Rivolta degli Schiavi | 4 · 5 · +4 · 5 | Ogni moneta Testa che colpisce infligge 1 Sanguinamento. Costa 10% dei PV propri. |

### Capitolo II — Impero

**3. Augusto (Gaio Ottavio Turino)** — Ordine · ★★★★ · Supporto/guardia · PV 90 · Vel 3–5
Passiva **Pax**: a inizio turno gli alleati non in Cedimento ricevono 1 Formazione.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Ordine di Marcia | 2 · 4 · +2 · 0 | Al colpo: +1 Formazione a sé. |
| Editto | 2 · 3 · +3 · 2 | Se vince il clash: 2 Formazione a un alleato a scelta. |
| Pax Romana | 3 · 6 · +3 · 5 | Tutta la squadra subisce −30% danno per il turno; al colpo, il nemico perde 3 Splendore. |

**4. Vibia Perpetua** — Fede · ★★★★ · Tank/guaritrice · PV 85 · Vel 2–5
Passiva **Testimone**: quando un alleato va in Cedimento, tutta la squadra riceve +5 Sanità.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Preghiera nell'Arena | 2 · 3 · +3 · 0 | Al colpo: 2 Voto a sé. |
| Fermezza | 2 · 4 · +3 · 2 | Dona 2 Voto e +5 Sanità a un alleato. |
| Il Rifiuto | 3 · 5 · +4 · 5 | Ogni Voto che possiede aggiunge +1 PB (poi lo consuma a metà). |
*Nota di scrittura: martire storica; trattata con rispetto, nessuna beffa verso la fede. Dialoghi inventati.*

### Capitolo III — Medioevo e Comuni

**5. Federico II di Svevia** — Ingegno · ★★★★★ · Controllo/danno nel tempo · PV 80 · Vel 4–7
Passiva **Curiosità**: +1 PM quando usa una skill diversa da quella del turno precedente.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Falcone Addestrato | 2 · 4 · +3 · 0 | Al colpo: Bruciatura 1. |
| Macchina d'Assedio | 3 · 4 · +3 · 2 | Al colpo: Bruciatura 2; se il bersaglio è in Cedimento, +1 moneta. |
| Stupor Mundi | 4 · 5 · +4 · 5 | Raddoppia la Bruciatura già presente sul bersaglio (max 10). |

**6. Matilde di Canossa** — Ordine · ★★★★ · Tank · PV 100 · Vel 3–5
Passiva **Rocca Inespugnabile**: la prima volta in una battaglia che dovrebbe andare a 0 PV resta a 1 PV e ottiene 5 Formazione.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Lancia Canossiana | 2 · 4 · +3 · 0 | Al colpo: +1 Formazione a sé. |
| Mediazione | 2 · 3 · +3 · 2 | Se vince il clash: rimuove 3 stack di stato positivo dal bersaglio. |
| Il Castello Tiene | 3 · 5 · +3 · 5 | +5 Formazione a sé; per questo turno non va in Cedimento. |

### Capitolo IV — Rinascimento

**7. Leonardo da Vinci** — Ingegno · ★★★★★ · Gadgeteer · PV 75 · Vel 3–7
Passiva **Taccuino**: ogni skill diversa usata in battaglia dà 1 Appunto; con 5 Appunti la skill successiva ha +1 moneta (poi azzera).
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Balestra Girevole | 2 · 3 · +4 · 0 | Al colpo: Bruciatura 1. |
| Ornitottero | 3 · 3 · +3 · 2 | +2 al dado di Velocità al turno seguente; evita il primo colpo libero. |
| Il Grande Carro | 4 · 5 · +3 · 5 | Al colpo: Bruciatura 3; ignora il 30% di Formazione/Voto del bersaglio. |
*Nota: tutti gli ingegni attribuiti a Leonardo sono progetti/disegni; il gioco li tratta come "idee", non come armi realmente usate.*

**8. Caterina Sforza** — Astuzia · ★★★★ · Duellante · PV 90 · Vel 4–6
Passiva **Contessa di Forlì**: le sue skill infliggono +1 Marchio se il bersaglio ha meno PV di lei.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Colpo di Archibugio | 2 · 4 · +3 · 0 | Al colpo: Marchio 1. |
| Stratagemma di Ravaldino | 3 · 4 · +3 · 2 | Se vince il clash: Marchio 2 e −1 PM al bersaglio al turno seguente. |
| Rappresaglia | 3 · 6 · +3 · 5 | Danno ×1,5 sui bersagli con 3+ Marchi; consuma tutti i Marchi. |

### Capitolo V — Risorgimento

**9. Giuseppe Garibaldi** — Gloria · ★★★★★ · Attaccante carismatico · PV 100 · Vel 4–6
Passiva **Camicia Rossa**: ogni Testa su una moneta con PM ≥ 3 dà +1 Splendore (max 6 per turno).
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Sciabola | 2 · 4 · +3 · 0 | Al colpo: +1 Splendore. |
| Carica di Calatafimi | 3 · 4 · +3 · 2 | Se vince il clash: +2 Splendore; la prima moneta infligge danno doppio. |
| «Obbedisco» | 4 · 5 · +4 · 5 | Consuma tutto lo Splendore: +1 PB per stack. *(Titolo = telegramma documentato del 1866; unica frase di una persona reale usata, in una nota storica.)* |

**10. Camillo Benso, conte di Cavour** — Astuzia · ★★★★ · Debuffer/stratega · PV 70 · Vel 2–5
Passiva **Realpolitik**: i Marchi che infligge valgono +1 stack.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Lettera Riservata | 2 · 3 · +3 · 0 | Al colpo: Marchio 1. |
| Intesa di Plombières | 3 · 3 · +3 · 2 | Se vince il clash: Marchio 2 e +1 Ardore alla squadra. |
| Il Gran Tessitore | 4 · 4 · +4 · 5 | Detona i Marchi: +20% danno per stack consumato. |

### Capitolo VI — Prima guerra mondiale

**11. Francesco Baracca** — Gloria · ★★★★ · Assassino veloce · PV 70 · Vel 5–8
Passiva **Asso del Cielo**: se il suo dado di velocità è il più alto del turno, +1 moneta alla prima skill.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Picchiata | 2 · 4 · +3 · 0 | Al colpo: +1 Splendore. |
| Duello Aereo | 3 · 4 · +3 · 2 | Se più veloce del bersaglio: +2 PM; se vince il clash, +3 Sanità. |
| Cielo del Montello | 4 · 5 · +3 · 5 | Ignora i bersagli di scudo; +1 danno per punto di differenza di velocità. |

**12. Maria Plozner Mentil** — Fede · ★★★ · Supporto · PV 85 · Vel 2–4
Passiva **Portatrice**: a inizio turno dona 3 Sanità all'alleato con Sanità più bassa.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Gerla Pesante | 2 · 3 · +2 · 0 | Al colpo: 2 Voto a sé. |
| Sentiero Carnico | 2 · 3 · +3 · 2 | Dona 3 Voto a un alleato e +5 Sanità. |
| Il Carico | 3 · 4 · +3 · 5 | Tutti gli alleati recuperano il 15% dei PV massimi e ricevono 2 Voto. |
*Nota di scrittura: una delle portatrici carniche; storia di lavoro e sacrificio civile, non di gloria militare.*

### Capitolo VII — Seconda guerra mondiale

*In questo capitolo le skill non sono "armi da sparo": sono atti di resistenza, ingegno, aiuto e testimonianza. I nemici sono Echi di paura, obbedienza e silenzio (§6).*

**13. Giorgio Perlasca** — Astuzia · ★★★★★ · Protettore · PV 75 · Vel 3–6
Passiva **Falsa Identità**: la prima moneta che perderebbe in ogni clash è ignorata.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Lettera Protetta | 2 · 3 · +3 · 0 | Al colpo: Marchio 1; 1 Formazione a un alleato. |
| Documenti Perfetti | 2 · 3 · +3 · 2 | Dona a un alleato Voto 2; il nemico perde 1 Marchio sull'alleato. |
| Casa Protetta | 3 · 5 · +3 · 5 | Tutta la squadra: +3 Formazione, +10 Sanità, rimuove Sanguinamento e Bruciatura. |
*Nota: salvò molte persone a Budapest nel 1944. Il gioco evidenzia i dilemmi e il rischio, non il "trionfo".*

**14. Tina Anselmi** — Ordine · ★★★★ · Tattica/supporto · PV 80 · Vel 3–6
Passiva **Staffetta**: a inizio turno gli alleati ricevono +1 al dado di velocità più basso.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Messaggio Cifrato | 2 · 3 · +3 · 0 | Al colpo: +1 Formazione a un alleato. |
| Rete della Memoria | 3 · 4 · +3 · 2 | Se vince il clash: toglie 2 Marchi a un alleato e li dà al bersaglio. |
| Giustizia Paziente | 3 · 5 · +3 · 5 | +5 Formazione a sé e a un alleato; danno ×1,3 su bersagli con Marchio. |
*Nota: partecipò alla Resistenza giovanissima e fu poi figura politica; il gioco accenna al suo futuro come epilogo.*

**15. Gino Bartali** — Fede · ★★★★ · Mobilità · PV 85 · Vel 5–8
Passiva **Gamba da Campione**: +1 PM se il suo dado di velocità è ≥ 6.
| Skill | Monete · PB · PM · Costo | Effetto |
|---|---|---|
| Salita Dolomitica | 2 · 3 · +3 · 0 | Al colpo: 1 Voto a sé, +2 Sanità. |
| Telaio Segreto | 2 · 3 · +3 · 2 | Dona 2 Voto e +1 Velocità a un alleato a scelta. |
| Corsa Fino all'Alba | 4 · 4 · +3 · 5 | Ogni Voto posseduto → +1 PM; al colpo +3 Sanità alla squadra. |
*Nota: alcuni dettagli aneddotici sulla sua attività di soccorso sono discussi dagli storici; il gioco lo segnala nella voce del Codex.*

### Distribuzione affinità (stato attuale)
| Affinità | Voci |
|---|---|
| Gloria (3) | Scipione, Garibaldi, Baracca |
| Sangue (1) | Spartaco |
| Ordine (3) | Augusto, Matilde, Anselmi |
| Fede (3) | Perpetua, Mentil, Bartali |
| Ingegno (2) | Federico II, Leonardo |
| Astuzia (3) | Caterina, Cavour, Perlasca |

Sangue è sotto-rappresentata (1 sola Voce): vedi domanda 2 in §12.


---

## 5. Nemici comuni (tipologie per capitolo)

Tutti hanno `affinità`, `PV`, `velocità`, 2 skill; il roster base verrà ampliato dai dati.

| Cap. | Nemici base | Affinità |
|------|-------------|----------|
| I | Eco di Cartaginese · Elefante Spettrale · Legionario Dimenticato | Astuzia / Sangue / Ordine |
| II | Gladiatore Fumante · Pretoriano d'Ombra · Eco del Rogo | Sangue / Ordine / Gloria |
| III | Milizia della Torre · Mercenario di Ventura · Falconiere Tetro | Ordine / Sangue / Ingegno |
| IV | Bargello Cieco · Condottiero d'Ombra · Fantasma d'Artista | Ordine / Astuzia / Ingegno |
| V | Granatiere Bianco · Spia di Restaurazione · Patriota Frainteso | Ordine / Astuzia / Fede |
| VI | Eco di Trincea · Fante di Fango · Cecchino senza Nome | Sangue / Fede / Astuzia |
| VII | Eco dell'Obbedienza · Eco della Paura · Eco dell'Indifferenza | Ordine / Sangue / Fede |

---

## 6. Boss (uno per epoca)

| Cap. | Boss | Affin. | PV | Debole contro | Meccanica firma |
|------|------|--------|----|---------------|-----------------|
| I | **Annibale Barca** — *Eco di Canne* | Astuzia | 520 | Sangue | **Accerchiamento**: dopo il turno 3 le Voci sui lati ricevono Marchio; fase 2 evoca "Elefanti". |
| II | **Nerone** — *Eco dell'Incendio* | Gloria | 640 | Fede | **Grande Incendio**: ogni turno +1 Bruciatura a tutta la squadra, crescente. Fase 2: sprigiona Splendore al nemico ma costa Sanità a chi lo contrasta. |
| III | **Ezzelino da Romano** — *Eco della Torre* | Sangue | 700 | Ordine | **Terrore dei Sudditi**: evoca guardie che applicano Sanguinamento; spezzarle riduce la Sanità nemica. |
| IV | **Girolamo Savonarola** — *Eco del Falò* | Fede | 760 | Ingegno | **Falò delle Vanità**: distrugge Splendore e Appunti; 3 fasi; il pubblico (alleati) può essere "convertito" o difeso a seconda delle scelte. |
| V | **Josef Radetzky** — *Eco delle Cinque Giornate* | Ordine | 820 | Gloria | **Linea Immobile**: Formazione enorme che si rompe solo con clash vinti in sequenza; contrattacco ordinato. |
| VI | **L'Eco dell'Isonzo** — entità (non una persona) | Sangue/Ordine | 900 | Fede | **Dodici Offensive**: attacco ciclico su 12 turni; la Sanità cala per tutti; per resistere bisogna usare Voto. |
| VII | **Il Silenzio** — entità | cambia per fase | 1000 | — | **Non si sconfigge, si attraversa**: obiettivo = proteggere i *Testimoni* per 10 turni; la tua condotta (flag) cambia il finale. |

Note:
- Ogni boss ha dialogo pre-battaglia, fase 2 con mutamento di affinità secondaria e frase di congedo (tutta **inventata**, mai attribuita come citazione).
- Il cap. VII non ha un "nemico umano da sconfiggere": il boss è un'idea (silenzio, complicità, paura). Nessuna glorificazione di regimi o ideologie.

---

## 7. Struttura dei capitoli

Ogni capitolo è un file JSON/tabella in `data.js` con la stessa forma (§10).

1. **Prologo** — scena visual novel nell'Archivio: il Custode entra nell'Eco; presentazione della Voce del capitolo.
2. **Mappa a nodi** (dungeon) — 6-8 nodi: 3 combattimenti, 1 evento a scelta, 1 negozio (o riposo), 1 sorpresa, 1 boss. I PV e la Sanità **non si ripristinano** automaticamente tra i nodi.
3. **Eventi** — dilemmi morali con 2–3 scelte che impostano **flag** (es. `cap2_mostrare_pieta`, `cap7_testimone`).
4. **Boss** — clash a più fasi; il dialogo cambia in base ai flag.
5. **Epilogo** — scena finale con scelta di "memoria" (accettare o tacere un fatto), che sblocca **Pagine del Codex** e un oggetto.
6. **Ricompense** — Denari (valuta morbida), Sigilli (valuta gacha), frammenti di Voce, 1 Voce garantita al primo completamento.

### Progressione e sblocchi
- Cap. I è tutorial guidato (spiega monete, clash, Sanità).
- Il capitolo successivo si sblocca completando il precedente; si può rigiocare un capitolo con difficoltà **Eco Profondo** (ricompense migliori, flag diverse).
- Il finale (3 varianti) dipende dai flag raccolti: **Ricordare**, **Addolcire**, **Dimenticare**.

---

## 8. Economia e gacha (anticipazione, Fase 4)

- **Valute**: Denari (negozi, potenziamento), Sigilli (gacha), Frammenti (da duplicati). *Nessun acquisto con denaro reale.*
- Banner: *Standard* (tutte le Voci), *Epoca in Evidenza* (rate-up per un capitolo).
- Rate provvisori: ★★★ 70% · ★★★★ 25% · ★★★★★ 5%; **pity** soft da 60 pull, hard a 80; garanzia ★★★★+ ogni 10.
- Pull x1 (1 Sigillo) e x10 (10 Sigilli) con animazione; i **duplicati** diventano Frammenti che potenziano la Voce (livelli di "Eco" 1→5).

---

## 9. Linee guida di scrittura e tutela

- **Persone reali**: nomi e fatti storici sì; **carattere, abilità e dialoghi sono inventati** e dichiarati tali nel Codex ("Voce romanzata").
- **Mai frasi false attribuite** a persone reali come se fossero vere. L'unica eccezione sono formule storiche documentate (es. un telegramma noto), sempre con nota.
- Il Codex di ogni Voce contiene: scheda storica, cosa è inventato nel gioco, e (se serve) cautela su fatti discussi dagli storici.
- **Seconda guerra mondiale**: trattata come storia, con dilemmi morali (obbedienza, complicità, aiuto, perdita). Nessun culto di simboli o regimi; la violenza è mai estetizzata; si privilegiano vittime, testimoni e resistenze civili.
- Nessun riferimento, nome, grafica o testo di altri giochi o franchise; le meccaniche sono ispirate ma i nomi/regole/UI sono originali.

---

## 10. Architettura tecnica (anteprima)

```
index.html   — scheletro DOM + canvas
style.css    — layout, monete 3D CSS, animazioni
data.js      — TUTTE le tabelle: AFFINITA, STATI, VOCI, SKILL, NEMICI, BOSS, CAPITOLI, BANNER
combat.js    — velocità, pianificazione, clash, stagger, stati (logica pura, senza DOM)
story.js     — motore dialoghi/visual novel, scelte, flag
gacha.js     — pull, pity, duplicati
ui.js        — rendering, animazioni, input, canvas
main.js      — stato globale, salvataggio localStorage, game loop
```

Schema dati (esempio ridotto):
```js
VOCI.scipione = { id, nome, epoca, affinita:'gloria', rarita:5, pv:95, vel:[4,7],
                  skill:['gladio','manovra','zama'], passiva:'console_vittorioso', svg:'scipione' };
SKILL.gladio  = { id, nome, affinita:'gloria', monete:2, pb:4, pm:3, costo:0, effetti:[{su:'colpo',stato:'splendore',n:1}] };
CAPITOLI[0]   = { id:'cap1', titolo, nodi:[...], boss:'annibale', scene:'cap1_prologo' };
```
- Salvataggio: `localStorage['echi_save_v1']` con versione per migrazioni (roster, livelli, valute, flag, progressi).
- Grafica personaggi (Fase 2): SVG separati e sostituibili da sprite (`svg:'id'` → file o stringa).

---

## 11. Roadmap

| Fase | Contenuto |
|------|-----------|
| 0 | Questo documento (**in attesa di approvazione**). |
| 1 | Sistema di clash + animazioni (monete 3D CSS, scintille, shake, hit-stop, numeri, linee di clash). |
| 2 | Personaggi SVG con idle/attacco, sostituibili con sprite. |
| 3 | Storia visual novel: portrait, scelte, flag, capitoli in JSON. |
| 4 | Gacha: banner, rate, pity, x1/x10, duplicati, valuta. |
| 5 | Dungeon a nodi con danni persistenti. |

---

## 12. Punti da approvare

1. **Ciclo delle affinità** (§3.1) e le **Concordie** (§3.2): vanno bene?
2. **Squilibrio di affinità**: Sangue ha una sola Voce. Opzioni: (a) spostare **Caterina Sforza** ad Astuzia→Sangue (cambio le sue skill da Marchio a Sanguinamento), (b) aggiungere una 16ª Voce di Sangue (es. *Anita Garibaldi*, cap. V), (c) lasciare così. Consiglio (a).
3. **Boss del cap. I**: Annibale (nemico di Roma in Italia) va bene come "Nodo", o preferisci Pirro / un'entità?
4. **Cap. VI e VII**: boss astratti (Isonzo, Silenzio) anziché persone (es. Cadorna, un gerarca). Confermi l'approccio?
5. Numeri di gacha (rate/pity) e squadra da 4 Voci: ok?

*Fermo qui: aspetto il tuo via per la Fase 1.*
