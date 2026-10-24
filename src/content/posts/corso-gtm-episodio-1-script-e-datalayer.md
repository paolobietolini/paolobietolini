---
title: "Corso Google Tag Manager, Episodio 1: lo script e il Data Layer"
date: 2026-07-11
lang: it
description: "Primo episodio del corso su Google Tag Manager: lo snippet riga per riga, il Data Layer come array su window, gli eventi di sistema e perché GTM conviene rispetto a gtag.js diretto."
---

📺 **Video completo:** [Corso Google Tag Manager, Episodio 1](https://www.youtube.com/watch?v=_gUw-1krK0k)

## Lo snippet, decodificato

Quando si installa GTM su un sito, la prima cosa richiesta è inserire lo script nell'`<head>`. Quasi nessuno lo legge: si copia e si incolla. Nel video lo smonto pezzo per pezzo, partendo dai parametri della funzione, quelle lettere apparentemente criptiche `w, d, s, l, i` sono semplicemente:

- `w` → `window`
- `d` → `document`
- `s` → `script`
- `l` → `dataLayer`
- `i` → l'ID del container

Sostituendo le abbreviazioni con i nomi completi, lo snippet diventa improvvisamente leggibile: non c'è nulla di magico, solo JavaScript minificato.

## `window` e la nascita del Data Layer

La prima istruzione crea, dentro l'oggetto globale `window`, un array chiamato `dataLayer`. `window` è il contenitore di tutto ciò che vive nel browser: la navigazione, gli eventi del mouse, i messaggi interni, esiste perfino su una pagina `about:blank` vuota. Il Data Layer, quindi, non è nient'altro che un array dentro quest'oggetto: **un contenitore di oggetti ordinati**.

La primissima cosa che lo snippet fa dopo aver creato l'array è un `push`: inserisce l'evento `gtm.start` con un timestamp in millisecondi. È il modo con cui lo script dice a Tag Manager "io esisto". Da lì in poi, il `push` è l'unico metodo con cui si comunica con il Data Layer.

## Gli eventi di sistema e i trigger nativi

Aprendo la preview di GTM su una pagina appena caricata si vede una sequenza precisa di eventi, e ognuno corrisponde a un trigger nativo dell'interfaccia:

| Evento nel Data Layer | Trigger in GTM                          |
| --------------------- | --------------------------------------- |
| `gtm.init`            | Initialization / Consent Initialization |
| `gtm.js`              | Container Loaded                        |
| `gtm.dom`             | DOM Ready                               |
| `gtm.load`            | Window Loaded                           |

Un dettaglio interessante che emerge nel video: non sempre il numero di eventi in preview corrisponde agli elementi nell'array `dataLayer`. Nel mio caso la preview mostrava sei eventi ma l'array ne conteneva quattro, `Initialization` e `Consent Initialization` vengono generati internamente dalla libreria, non passano dall'array. Il caso opposto, invece, più elementi nel Data Layer che eventi in preview, è il segnale che qualcosa non sta funzionando.

## Come viene caricata la libreria (e perché in modo asincrono)

La seconda parte dello snippet fa una cosa sola: `document.getElementsByTagName('script')[0]` individua il primo `<script>` presente nella pagina (nel mio sito era Common JS) e, tramite `insertBefore`, inserisce subito sopra un nuovo tag script con `src` puntato a `googletagmanager.com/gtm.js`. Quel file, la libreria gigante e offuscata che si scarica, è il vero cuore di Google Tag Manager. **L'interfaccia che usiamo tutti i giorni è solo un'astrazione di quello script**: ogni tag, trigger o variabile che creiamo con il punta-e-clicca si traduce in istruzioni contenute lì dentro.

Il punto cruciale è che il caricamento è **asincrono**. JavaScript, tramite il suo event loop, scarica la libreria in parallelo al rendering della pagina. Nel video lo misuro con il pannello Network: la richiesta parte a 88ms dal caricamento della pagina, il server risponde in ~17ms, e il download completo si chiude dopo circa 4,5 millisecondi. Se lo script fosse sincrono, il sito resterebbe bloccato per quei 4,5 millisecondi, e se i server di Google avessero un problema, la pagina non si caricherebbe affatto. L'asincronia rende il sito indipendente dal destino di GTM. (Questo dettaglio tornerà utile quando parleremo di server-side.)

## Perché GTM e non `gtag.js` diretto?

Si potrebbe tracciare tutto a mano con `gtag.js`, chiamando la funzione `gtag()` direttamente nel codice. Ma ci sono due problemi concreti:

**Dipendenza dal codice.** Ogni modifica al tracciamento, aggiungere un evento, rimuoverne uno, richiede di mettere mano al sorgente del sito. Chi non sviluppa deve contattare uno sviluppatore, pagarlo, aspettare. GTM astrae questa parte: una volta che il Data Layer è popolato, si crea un trigger _Custom Event_ su `view_item_list` e si lavora interamente dall'interfaccia.

**Smistamento multiplo.** Supponiamo di dover mandare lo stesso evento a GA4, Google Ads, Facebook e LinkedIn. La documentazione di `gtag.js` parla chiaro: supporta solo Google Ads, Analytics e Floodlight, per Facebook e LinkedIn servirebbero altri script, sempre a mano. Con GTM basta **un solo trigger** collegato a N tag: nel video creo un tag GA4 e uno Google Ads che ascoltano lo stesso `view_item_list`, tutto in punta-e-clicca.

## Tag, Trigger e Variabili

I tre elementi strutturali di GTM, che approfondiremo nei prossimi episodi:

- **Tag**, il servizio di destinazione: _dove_ mando i dati (GA4, Google Ads…).
- **Trigger**, la regola di attivazione: _quando_ parte il tag. Ogni volta che l'evento denominato dal trigger compare nel Data Layer, il tag scatta.
- **Variabili**, i valori aggiuntivi che arricchiscono il tag: _cosa_ mando insieme all'evento. Esempio nel video: `Page Path`, che sulla homepage vale semplicemente `/`.

## Dentro il Data Layer: indici, FIFO e "Message"

Il Data Layer viene letto da GTM con logica **First In, First Out**: il primo evento entrato è il primo processato. L'array si indicizza da `0` (l'elemento meno recente) a `n−1` (il più recente), come una pila di piatti dove quello appoggiato per primo sta sotto ed è il numero zero.

Un esperimento dal video: `dataLayer.push({event: 'lezione GTM'})` compare immediatamente in preview come evento. Ma il push funziona anche _senza_ la chiave `event`, ad esempio per passare solo un parametro come il titolo della lezione. In quel caso GTM lo tratta comunque come qualcosa a cui reagire e lo etichetta come **Message**. A cosa servano questi parametri lo vedremo più avanti; per ora conta la visualizzazione fisica: il Data Layer è un contenitore ordinato di elementi a cui Tag Manager risponde.

## Indice del video

| Timestamp                                                   | Argomento                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [00:00](https://www.youtube.com/watch?v=_gUw-1krK0k&t=0)    | Introduzione alla serie e presentazione dello shop demo                          |
| [00:53](https://www.youtube.com/watch?v=_gUw-1krK0k&t=53)   | Lo snippet riga per riga: `w, d, s, l, i` e caricamento asincrono della libreria |
| [03:42](https://www.youtube.com/watch?v=_gUw-1krK0k&t=222)  | Il Data Layer: array su `window`, `push()` e logica FIFO                         |
| [15:27](https://www.youtube.com/watch?v=_gUw-1krK0k&t=927)  | Perché GTM invece dell'implementazione manuale con `gtag.js`                     |
| [19:05](https://www.youtube.com/watch?v=_gUw-1krK0k&t=1145) | Tag, Trigger e Variabili: differenze strutturali                                 |
| [27:04](https://www.youtube.com/watch?v=_gUw-1krK0k&t=1624) | Riepilogo e anticipazioni sul prossimo episodio                                  |

## Prossimo episodio

Nella seconda lezione entreremo nell'interfaccia di Google Tag Manager e faremo una prima implementazione vera, capendo alcune regole di base. Il fondamento tecnico visto oggi renderà tutto più chiaro: sapere cosa fa l'interfaccia sotto il cofano è la differenza tra usare uno strumento e capirlo.
