---
title: Problemi con il form listener per Elementor
date: 2024-10-17
lang: it
description: Come il listener per i form di Elementor può bloccare la Consent Mode di Google. Diagnosi e soluzione del conflitto tra script di tracciamento e consenso.
---

### Come il listener per i form di Elementor blocca la Consent Mode

#### ovvero sul perché non copincollare gli script da Internet

Per un cliente con Elementor ho integrato uno script trovato online per tracciare gli invii dei form dal suo sito. E mi ha causato due settimane di [mal di testa](https://www.youtube.com/watch?v=_M5aRJIH6Gc).
Ora, prendiamoci la manina e seguimi nella discesa verso la follia.

Lo script in questione, per inviare un evento al dataLayer al momento dell'invio del form, contiene queste righe

```js
 var origin_open = XMLHttpRequest.prototype.open;
 var origin_send = XMLHttpRequest.prototype.send;
 var form_data = "";

 XMLHttpRequest.prototype.send = function(body) {
	 form_data = Object.fromEntries(body);
	 origin_send.apply(this, arguments);
  };

XMLHttpRequest.prototype.open = function(method, url) {
    if(url.includes("admin-ajax.php")) {...}
```

Le righe che ci interessano sono `XMLHttpRequest.prototype.open` e `XMLHttpRequest.prototype.send` = che sovrascrivono i metodi standard di XHR.

#### Cos'è XHR?

XHR, che sta per XMLHttpRequest, ed è una tecnologia fondamentale nel web moderno. Pensate ad essa come a un "postino digitale" che lavora dietro le quinte dei siti web. Ecco come funziona e perché è importante:

In poche parole è un metodo che permette ai siti web di comunicare con i server senza dover ricaricare l'intera pagina.

Immaginate di poter aggiornare una parte di una pagina web senza dover aggiornare tutto il resto.

La Consent Mode di Google e i banner del consenso utilizzano questa tecnologia per passare le scelte degli utenti senza ricaricate la pagina.

Se volete XHR vedere all'opera utilizzate questo script:

```html
<script>
  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () {
    console.log('Chiamata XHR', arguments);
    return open.apply(this, arguments);
  };
</script>
```

Nella console del browser verranno stampate tutte le chiamate effettuate ai vari server.

![Console di Chrome con i log delle chiamate XHR intercettate, tra cui richieste verso admin-ajax.php, Cookiebot e Google Analytics](/images/blog/2024/XHR-chrome-log.png)

Per portare un esempio queste sono le chiamate HTTP che avvengono non appena carico una pagina:
Si noti come la seconda, terza e quarta chiamata appartengano a Google e Cookiebot.
La seconda richiesta scarica il container di GTM, la seconda contatta Cookiebot per scaricare il banner e i dati del consenso e la quarta invia i dati del consenso a Google.

Ora, ricordate che nelle prime righe avevamo notato come lo script di Elementor sovrascrivesse `open` e `send`. Questa sovrascrittura (tecnica del "monkey patching") avviene affinché lo script possa andare a leggere la conferma, da parte del server, della ricezione dei dati del form inviato.
Il problema nasce quando XHR viene sovrascritto prima ancora che Google riceva i dati del consenso.
Ci ritroviamo quindi con un consenso inviato ma non impostato nel pixel di Google:
![Consent Mode Checker con tutti i segnali di consenso in stato Unknown, sia predefinito che aggiornato](/images/blog/2024/consent-mode-checker-unknown.png)

Andando a togliere lo script noto invece che tutto torna come dovrebbe essere:
![Consent Mode Checker funzionante: stato predefinito denied e stato aggiornato granted in verde per tutti i segnali](/images/blog/2024/consent-mode-checker-green.png)

Non essendo però sicuro della cosa sono andato a spulciare la libreria gtag.js caricata nel sito (raggiungibile a https://www.googletagmanager.com/gtag/js) e ho potuto confermare che, infatti, XHR viene utilizzato per ricevere/inviare i dati del consenso in background.

#### Troubleshooting

Per capire cosa stesse accadendo ho impiegato più tempo di quanto mi faccia piacere ammettere.
Il processo però è stato divertente e abbastanza didattico.
Insieme al cliente abbiamo testato tutte le combinazioni di script: abbiamo rimosso e inserito GTM più volte, provato GTM server side con e senza Custom Loader, provato ad inserire il consenso via `gtag()` e a rimuovere Cookiebot.
Ad ogni combinazione il problema rimaneva o magari si risolveva fino al caricamento della pagina successivo.
Nei vari test avevo notato una cosa, che il problema si presentava solamente nelle pagine con i form.
A questo punto della storia vorrei ammettere di aver avuto un'epifania e di aver gridato Eureka! ma no, sono andato a dormire.

La mattina successiva ho inserito un container vuoto e, _magicamente_, il problema era sparito.
Ho inserito i tag uno ad uno e, ormai conscio di dove risiedesse la rogna, ho riscritto personalmente lo script per assicurarmi che non possa dare problemi.

Quindi, la morale è (sempre) quella, di non scaricare gli script da Internet senza sapere cosa stiano facendo e che, se avessi scritto il codice anziché farmi guidare dalla pigrizia, mi sarei evitato ore di frustrazione ma non avrei imparato niente.
Quindi, se avete tempo e modo, sperimentate ed imparate (fino a stamattina non sapevo cosa fosse questo XHR!) ma se siete di fretta, è meglio -paradossalmente- usare un po' di tempo per fare le cose correttamente anziché perderci tempo e sanità mentale dopo.
Ad maiora.

## L'impatto del listener dei form di Elementor sulla Consent Mode di Google

## Analisi delle implicazioni dell'implementazione di script di terze parti

L'integrazione di script di terze parti in un sito web può talvolta portare a conseguenze inaspettate. Questo articolo esamina un caso specifico in cui un listener per i form di Elementor ha interferito con il corretto funzionamento della Consent Mode di Google.

### Il contesto

Durante l'implementazione di uno script per il tracciamento degli invii dei form su un sito Elementor, è stato riscontrato un conflitto con la Consent Mode di Google. Lo script in questione conteneva le seguenti righe critiche:

```js
var origin_open = XMLHttpRequest.prototype.open;
var origin_send = XMLHttpRequest.prototype.send;
var form_data = "";

XMLHttpRequest.prototype.send = function(body) {
    form_data = Object.fromEntries(body);
    origin_send.apply(this, arguments);
};

XMLHttpRequest.prototype.open = function(method, url) {
    if(url.includes("admin-ajax.php")) {...}
}
```

Le righe `XMLHttpRequest.prototype.open` e `XMLHttpRequest.prototype.send` sovrascrivono i metodi standard di XHR, una pratica nota come "monkey patching".

### XMLHttpRequest (XHR) e il suo ruolo

XMLHttpRequest (XHR) è una tecnologia fondamentale che ha rivoluzionato lo sviluppo web, consentendo la creazione di applicazioni web dinamiche e interattive. Comprendere XHR è essenziale per gli sviluppatori web, in quanto è alla base di molte funzionalità moderne, inclusa la gestione del consenso degli utenti.

XHR è un'API che permette ai client (es: browser) di effettuare richieste HTTP o HTTPS ai server in modo asincrono. Ciò significa che le applicazioni web possono inviare e ricevere dati dal server senza dover ricaricare l'intera pagina, migliorando significativamente l'esperienza utente e le prestazioni delle applicazioni web.

## Caratteristiche chiave di XHR

1. **Comunicazione asincrona**: XHR consente l'invio di richieste al server in background, senza interrompere l'interazione dell'utente con la pagina.
2. **Supporto per diversi formati di dati**: Nonostante il nome suggerisca solo XML, XHR può gestire vari formati di dati, inclusi JSON, HTML e testo semplice.
3. **Controllo granulare**: Gli sviluppatori hanno un controllo dettagliato su headers, metodi HTTP e gestione delle risposte.
4. **Gestione degli eventi**: XHR fornisce eventi come `onreadystatechange`, che permettono di monitorare lo stato della richiesta e reagire di conseguenza

### L'origine del problema

La sovrascrittura dei metodi XHR da parte dello script per i form di Elementor ha interferito con il processo di invio dei dati di consenso a Google. Ciò ha portato a una situazione in cui il consenso veniva inviato ma non correttamente impostato nel pixel di Google.

### Processo di troubleshooting approfondito

L'identificazione e la risoluzione del problema hanno richiesto un'analisi sistematica e approfondita. Di seguito, il dettaglio del processo di troubleshooting:

1. **Analisi iniziale**:
   - Revisione del codice dello script di Elementor per identificare potenziali conflitti.
   - Ispezione delle chiamate di rete tramite gli strumenti per sviluppatori del browser per verificare l'invio corretto dei dati di consenso.
2. **Test di configurazione di Google Tag Manager (GTM)**:
   - Rimozione completa di GTM dal sito e successiva reinstallazione per escludere problemi di configurazione.
   - Implementazione di GTM con diverse modalità di caricamento, incluso il caricamento asincrono, per valutare l'impatto sui tempi di esecuzione.
3. **Sperimentazione con GTM server-side**:
   - Configurazione di un'istanza GTM server-side per verificare se il problema persistesse in un ambiente di elaborazione lato server.
   - Implementazione di un Custom Loader per GTM per controllare se il caricamento del container, dal server, potesse influire sul problema.
4. **Manipolazione diretta dei dati di consenso**:
   - Tentativo di impostazione manuale del consenso utilizzando la funzione `gtag()` per bypassare il consenso gestito dal banner di Cookiebot di Consent Mode.
   - Monitoraggio delle chiamate `gtag` tramite console per verificare la corretta esecuzione.
5. **Isolamento dei componenti di gestione del consenso**:
   - Rimozione temporanea di Cookiebot per determinare se il conflitto fosse specifico di questa soluzione di gestione del consenso.
   - Test con soluzioni alternative di gestione del consenso per isolare il problema.
6. **Analisi delle dipendenze di pagina**:
   - Revisione sistematica delle differenze tra pagine con e senza form.
   - Ispezione del DOM e degli script caricati in pagine problematiche vs pagine funzionanti.
7. **Debug progressivo**:
   - Implementazione di un container GTM vuoto per stabilire una baseline di funzionamento.
   - Aggiunta graduale di tag e trigger nel container GTM, monitorando l'impatto di ciascuna aggiunta sulla Consent Mode.
8. **Pulizia della cache di Wordpress e Cloudflare**
   - Pulizia della cache del browser, della CDN e di Wordpress per verificare che non ci fossero valori residui da precedenti implementazioni
   - Diminuzione della TTL (time-to-live) di Cloudflare per cercare di avere risultati quanto più possibile in _real-time_.
9. **Analisi approfondita di XHR**:
   - Implementazione di un hook di debug per XHR per monitorare tutte le chiamate:

   ```js
   var open = XMLHttpRequest.prototype.open;
   XMLHttpRequest.prototype.open = function () {
     console.log('Chiamata XHR', arguments);
     return open.apply(this, arguments);
   };
   ```

   - Analisi dettagliata del timing e dell'ordine delle chiamate XHR in relazione all'inizializzazione di GTM e alla gestione del consenso.

10. **Revisione della libreria gtag.js**:
    - Esame del codice sorgente di gtag.js (accessibile via [https://www.googletagmanager.com/gtag/js](https://www.googletagmanager.com/gtag/js)) per comprendere l'utilizzo interno di XHR.
    - Identificazione dei punti critici in cui gtag.js interagisce con XHR per la gestione del consenso.
11. **Riscrittura e test dello script**:
    - Sviluppo di una versione modificata dello script di tracciamento dei form che non interferisse con XHR.
    - Test approfonditi della nuova implementazione in vari scenari e configurazioni di pagina.

Questo processo di troubleshooting ha rivelato la complessità delle interazioni tra script personalizzati, librerie di terze parti e funzionalità native del browser. Ha inoltre evidenziato l'importanza di un approccio metodico e paziente nella risoluzione di problemi di integrazione web complessi.

### Conclusione

Per capire cosa stesse accadendo ho impiegato più tempo di quanto mi faccia piacere ammettere ma il processo però è stato divertente e piuttosto didattico.

Insieme al cliente abbiamo testato tutte le combinazioni di script: abbiamo rimosso e inserito GTM più volte, provato GTM server side con e senza Custom Loader, provato ad inserire il consenso via gtag() e a rimuovere Cookiebot.

Ad ogni combinazione il problema rimaneva o magari si risolveva fino al caricamento della pagina successivo.

Nei vari test avevo notato una cosa, che il problema si presentava solamente nelle pagine con i form.

A questo punto della storia vorrei ammettere di aver avuto un'epifania e di aver gridato Eureka! ma no, sono andato a dormire.

La mattina successiva ho inserito un container vuoto e, magicamente, il problema era sparito.

Ho inserito i tag uno ad uno e, ormai conscio di dove risiedesse la rogna, ho riscritto personalmente lo script per assicurarmi che non potesse dare problemi.

Quindi, la morale è (sempre) quella, di non scaricare gli script da Internet senza sapere cosa stiano facendo e che, se avessi scritto il codice anziché farmi guidare dalla pigrizia, mi sarei evitato ore di frustrazione (ma non avrei imparato niente).

Quindi, se avete tempo e modo, sperimentate ed imparate (fino a stamattina non sapevo cosa fosse questo XHR!) ma se siete di fretta, è meglio -paradossalmente- usare un po' di tempo per fare le cose correttamente anziché perderci tempo e sanità mentale dopo.
