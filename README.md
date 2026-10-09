# Echi d'Italia

Gioco a turni a "clash di monete" ambientato nella storia italiana (HTML/JS/CSS puri, nessuna libreria).

**Gioca online:** https://onewaywastaken.github.io/Project_Italy/

Da telefono: apri il link, ruota in orizzontale e, se vuoi, usa «Aggiungi a schermata Home» per giocare a schermo intero.

## Cosa c'è
- **Combattimento a scontri di monete**: dadi di velocità, monete Testa/Croce, Sanità, affinità, Concordie, **Risonanza**, Cedimento e Affondo; frecce sul campo con le intenzioni dei nemici e la **probabilità di vincere lo scontro** sulle carte skill; pianificazione automatica.
- **15 Voci** della storia italiana (figure SVG articolate, animazioni diverse per ogni skill, volti con espressioni), Echi nemici e 7 boss con fasi.
- **Campagna** in 7 capitoli (da Canne alla Seconda guerra mondiale) con dialoghi a scelte, mappa a nodi (scontri, eventi, negozi, riposo), finali e Codex storico.
- **Evocazioni**: banner a tema, garanzia, ×1/×10 con animazione e rivelazione delle rare, livelli Eco dai duplicati, storico, scambio Denari→Sigilli.
- **Skill in crescendo**: ogni moneta ha una mossa diversa (combo) e l'ultima è la mossa firma; tre gradi di potenza (base, media, culmine) con effetti sempre più forti, fino al cut-in, alla scena oscurata e allo squarcio finale.
- **Figure in vista di tre quarti** con scheletro coerente (busto, testa e braccia legati, braccio vicino davanti e lontano dietro), luce di contorno, immagini residue negli scatti.
- **Interfaccia minimal**: pannelli scuri con filo sottile, oro solo per ciò che è attivo, barra di navigazione a pillola.
- **Telefono**: il gioco si ridimensiona da solo se lo schermo è piccolo e rispetta tacca e barra home.
- Musica ed effetti sonori generati dal browser, effetti grafici per affinità, sfondi diversi per ogni epoca, tutorial interattivo saltabile, opzione «Qualità grafica: leggera» per telefoni meno potenti.

File principali: `combat.js` (motore, senza DOM) · `ui.js` (battaglia, effetti, suoni) · `art.js` (figure e sfondi SVG) · `figure.css` (animazioni) · `hub.js`, `campagna.js`, `story.js`, `gacha.js`, `archivio.js` (schermate) · `data*.js` (personaggi, skill, nemici, capitoli, dialoghi) · fogli di stile in ordine: `style.css` → `tema.css` → `battaglia-tema.css` → `rifinitura.css` → `minimal.css`.

Documenti: `design.md` (design del gioco) · `ARTE.md` (come sostituire le figure con i tuoi sprite).
