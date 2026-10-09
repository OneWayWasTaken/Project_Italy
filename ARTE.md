# Arte: come sostituire le figure SVG con i tuoi sprite

Ogni Voce e ogni nemico ha una voce in `E.ARTE` (file `data.js`). Di default `art.js` disegna una figura SVG a partire da
quella tabella (corpo, colori, abito, copricapo, arma, stile d'attacco). Per usare invece un tuo sprite, aggiungi un campo
`sprite` alla voce: **non serve toccare altro codice** (UI e animazioni leggono sempre `Arte.figura()`, `Arte.busto()`, `Arte.anima()`).

## 1. Immagine singola (PNG/WebP con sfondo trasparente)
```js
scipione: { ..., sprite: { src: 'img/scipione.png', w: 160, h: 240, busto: 'img/scipione_busto.png' } }
```
- Il personaggio deve **guardare a destra** (i nemici vengono specchiati dal CSS).
- `busto` è facoltativo (icona rotonda nell'HUD); senza, usa l'immagine intera.
- Idle, attacco, colpo subito, cedimento e morte sono simulati dal CSS (oscillazioni, rotazioni, flash).

## 2. Sprite sheet con animazioni vere
```js
sprite: {
  src: 'img/scipione_sheet.png', w: 128, h: 192,          // w,h = dimensione di UN frame
  anim: {                                                  // riga = riga dello sheet (0 = prima), frame = n° frame, fps
    idle:    { riga: 0, frame: 4, fps: 6 },                // in loop
    attacco: { riga: 1, frame: 6, fps: 14 },               // una volta, usata per tutti gli stili d'attacco
    colpo:   { riga: 2, frame: 2, fps: 8 },
    ced:     { riga: 3, frame: 2, fps: 4 },                // in loop mentre è in Cedimento
    morte:   { riga: 4, frame: 5, fps: 8 }
  }
  // opzionali: colonne, righe (se lo sheet ha più colonne/righe di quelle usate)
}
```
Lo sheet è una griglia di frame di uguale dimensione; le righe sono contate dall'alto.

## Struttura delle figure SVG (v2)
Ogni figura è fatta di pezzi articolati (`<div>` con il loro SVG, animati dal CSS in `figure.css`):
`f-tutto > f-mantello · f-capelli-d · f-gamba-a/b (> f-stinco-a/b) · f-torso · f-braccio-b (> f-avambraccio-b) · f-testa (> f-occhi, f-sopracciglia, f-bocca, f-urlo) · f-braccio-a (> f-avambraccio-a > f-arma)`.
Proporzioni "gacha" (testa grande), ombre cel con bordo netto (`url(#gCel)`, inserito da `Arte.defs()`), braccia e gambe con gomito e ginocchio.

## Stili d'attacco (SVG)
Ogni skill ha la sua animazione in `E.ANIM_SKILL` (data.js) o nel campo `anim` della skill; altrimenti vale `attacco` in `E.ARTE[id]`.
Stili disponibili (durata, momento d'impatto, distanza ed effetto in `Arte.ANIM`, art.js):
`fendente sweep doppio affondo lungo salto turbine carica colpo_scudo sparo sparo_rapido sparo_mira lancio lancio_alto benedizione invocazione preghiera raffica contrattacco grido` (+ `ele_carica ele_barrito ele_pestone` per l'elefante).

## Aggiungere un nuovo personaggio SVG
1. Aggiungi la Voce in `E.VOCI` (o il nemico in `E.NEMICI`).
2. Aggiungi `E.ARTE[id]` con gli stessi campi degli altri. Parti disponibili:
   - abiti: `tunica corazza toga veste_lunga manto_imperiale abito_dama veste_studioso saio gonna giubba uniforme abito_nero tuta cotta armatura civile`
   - capelli: `corto lungo trecce raccolto riccio calvo coda`
   - copricapi: `elmo_romano elmo_cartaginese elmo_medievale alloro corona velo_corona cappello_piuma berretto aviatore fazzoletto fedora basco cappellino_ciclista cappuccio cappuccio_aperto bicorno elmetto fascia`
   - armi: `gladio sciabola lancia bastone archibugio pistola falco libro compasso rotolo lettera cartella palma ruota`
   - scudi: `scutum clipeo` · accessori: `catene sciarpa` · viso: `occhiali benda` · barba: `barba pizzo baffi`
   - `eco: true` + `glow` per l'aspetto spettrale dei nemici, `scala` per ingrandire (es. boss 1.3).
   - volto: `espr` (`fiero sorriso gentile serio severo grinta`), `iride` (colore degli occhi), `eta: 'anziano'` (rughe).
   - personalità di riposo: `idle` (`fiero regale nervoso sereno curioso dondola sfrontato composto spettro pesante`) + `idleVars` per ritocchi.
