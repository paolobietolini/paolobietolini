---
title: Measurement Protocol. Cos'è e come funziona
date: 2025-01-05
lang: it
description: Cos'è il Measurement Protocol di GA4 e come funziona. Guida completa con vantaggi, svantaggi, configurazione della chiave API e esempi pratici di invio dati.
tags: [ga4, server-side]
---

Google Analytics 4 (GA4) è una piattaforma potente per raccogliere e analizzare dati sul comportamento degli utenti. Ma cosa fare se vuoi inviare dati personalizzati a GA4, magari da un'applicazione o un sistema che non usa un browser? È qui che entra in gioco il Measurement Protocol.

### Cos'è il Measurement Protocol?

Il Measurement Protocol è un metodo che ti permette di inviare dati direttamente a GA4 tramite richieste HTTP. In parole semplici, è come compilare una lettera e spedirla a Google Analytics per registrare un evento.

Questo protocollo è utile quando:

- Vuoi monitorare eventi che avvengono offline, come una vendita in negozio.
- Vuoi integrare dati provenienti da sistemi esterni che non supportano nativamente GA4.
- Vuoi tracciare eventi personalizzati da un'applicazione server-side.

### Vantaggi del Measurment Protocol

#### Precisione nei dati

Il Measurment Protocol consente di trasmettere dati molto precisi al GA4.
Vediamo un esempio:
Un utente conferma un acquisto sul sito web e potrebbe:

- Pagare immediatamente,
- Non pagare affatto,
- Pagare con un ritardo

Inoltre, l'ordine può avere diversi stati di evasione, come ad esempio:

- In corso,
- Inviato al cliente,
- In attesa,
- Annullato dal cliente

Il tracciamento lato client (basato su gtag.js o Google Tag Manager) consente di tracciare gli acquisti dopo l'azione online scelta dall'utente, ad esempio facendo clic sul pulsante “Paga” prima del pagamento effettivo.
Di conseguenza, i dati sugli acquisti non pagati vengono inviati ad Analytics.
Utilizzando MP e i dati del CRM, è possibile scegliere con precisione quali ordini inviare a GA4, ad esempio solo le transazioni pagate, rendendo più preciso il monitoraggio.

#### Eventi offline

Il protocollo di misurazione consente la trasmissione di dati offline, che non sono tracciati di default in Google Analytics.

**Tracciamento dell'intero percorso dell'utente**
Analytics consente di tracciare i clic su indirizzi e-mail e numeri di telefono, nonché la copia di tali dati da parte dell'utente. Consente di tracciare l'invio di moduli.
Tuttavia, non è in grado di trasmettere ciò che accade in seguito all'uscita dal sito.
Se l'utente ha ricevuto una risposta via e-mail o telefono e se è stato firmato un contratto, Analytics non ha accesso a tali dati perché queste azioni avvengono al di fuori del sito web.
Per inviare tali dati è necessario collegare i dati del frontend (azioni dell'utente sul sito) con i dati del backend (CRM, database) e inviarli ad Analytics utilizzando il Measurement Protocol.

**Conversioni dopo contatti e-mail e telefonici**
I dati sulle azioni eseguite al di fuori del sito possono essere integrati con MP. In questo caso, potrebbe mancare l'informazione sulla fonte di traffico assegnata alla conversione. Ciò è dovuto all'assenza di informazioni sulla sessione a cui può essere attribuita la conversione. Fortunatamente, esiste la possibilità di aggiungere manualmente queste informazioni.

**Dati sulla restituzione dei prodotti**
I resi dei prodotti avvengono spesso via e-mail, rendendo difficile il completamento di questi dati in Analytics. Il Measurment Protocol può tornare utile in questo caso.

**Tracciamento LTV più preciso**
Il Lifetime Value (LTV) è l'importo che un cliente spende in prodotti o servizi durante l'intero periodo di utilizzo dei servizi di un'azienda. Questo indicatore aiuta a distinguere i clienti che ritornano e acquistano regolarmente da quelli che fanno acquisti occasionali.

Nel contesto dell'ottimizzazione delle campagne pubblicitarie, si tratta di un'informazione importante. Per l'acquisizione di clienti con un elevato LTV, vale la pena spendere un budget pubblicitario maggiore o fissare un costo target per conversione (tCPA) più alto, perché si ripagherà nel lungo periodo. Se il sito offre pacchetti o abbonamenti rinnovabili, l'LTV aumenterà ogni mese. Misurarlo è difficile quando i rinnovi dei pacchetti avvengono al di fuori del sito. Il protocollo di misurazione può aiutare a completare i dati per misurare con maggiore precisione l'LTV e facilitare l'analisi dei dati e l'ottimizzazione delle campagne di marketing.

### Svantaggi del Measurement Protocol

- Purtroppo non è tutto oro quel che luccica,e il Measurement Protocol non fa eccezione. Questa soluzione non è facile da implementare e presenta diverse sfide.

- Collegare i dati del frontend e del backend richiede la collaborazione con un programmatore specializzato in entrambi i settori.

- L'implementazione lato programmatore richiede più tempo rispetto all'implementazione classica del codice client, il che potrebbe comportare costi di implementazione più elevati.

- Al momento della pubblicazione di questo articolo, Gennaio 2025, GA4 è ancora un prodotto in fase di sviluppo da parte di Google, che continua ad aggiungere nuove funzionalità e miglioramenti. La documentazione di GA4 non è ancora completa come lo era quella per GA3, e molte cose potrebbero cambiare, incluso il Measurement Protocol, man mano che GA4 diventa più user-friendly.

- Gli eventi inviati tramite MP sono per impostazione predefinita associati a valori "(not set)" in alcuni report (sopratutto se non vengono inviati `client_id` e/o `session_id`).

- Inviare eventi tramite MP con un ritardo di 72 ore rispetto all'orario della sessione dell'utente significa che GA4 non sarà in grado di collegare gli eventi alla sessione, il che potrebbe portare a valori "(not set)" nei report, ad esempio in Session – source/medium.

- Il MP non è un'implementazione server-to-server e non potrà essere utilizzata al posto di un'implementazione che includa anche il browser.

### Cosa Serve per Iniziare

Prima di cominciare, assicurati di avere:

1. **ID dello stream di dati**: Lo trovi nella sezione "Stream di dati" della tua proprietà GA4.
2. **Endpoint del Measurement Protocol**: Tutte le richieste vanno inviate all'URL `https://www.google-analytics.com/mp/collect`.
3. **Accesso a un editor di testo o un software per inviare richieste HTTP** (puoi iniziare con strumenti gratuiti come Postman o curl).
4. **[Pianificazione accurata](#stila-un-piano-di-tracciamento-preciso)**
5. **[Chiave API Segreta](#chiave-API)**

### Stila un piano di tracciamento preciso!

Il corretto funzionamento del Measurment Protocol richiede una precisa determinazione degli eventi da inviare.
Ogni transazione pagata o solo gli ordini evasi? Gli ordini annullati devono essere registrati come acquisti e resi, o esclusi dal tracciamento? Quanto più complesso è il processo di transazione, tanto più numerosi sono gli argomenti da considerare.
Il momento dell'inserimento dell'ordine e quello del pagamento possono differire in modo significativo, e superare le 72 ore dalla sessione utente complica l'implementazione.

### Chiave API

Come puoi immaginare potrebbe essere facile abusare di questo strumento e ricevere richieste non volute; d'altronde basterebbe inviare tutti i dati verso l'endopoint `https://www.google-analytics.com/mp/collect?measurement_id=G-000000`, no?
Per fortuna no.
Google ha aggiunto l'obbligo di inserimento, nella richiesta verso i loro server, di una chiave API disponibile solamente nella proprietà GA4 che riceverà i dati.
Non è quindi possibile inviare alcun dato tramite Measurment Protocol qualora la chiave API non sia stata inserita nella richiesta HTTP.

Per generare una nuova chiave API segreta segui questi passaggi:

- Accedi al pannello di amministrazione di GA4 > _Raccolta e modifica dei dati_ > _Stream di dati_ e aprire il flusso interessato
  ![Pannello di amministrazione GA4 aperto sulla sezione Stream di dati, con lo stream web da selezionare](/images/blog/2025/MP_ga4_data_stream.png)

- Scrolla e clicca _API Secret di Measurment Protocol_
  ![Dettagli dello stream web in GA4 con la voce "Measurement Protocol API secrets" evidenziata](/images/blog/2025/MP_API_Secret_selection.png)

- Accetta i _Termini e le condizioni_
  ![Finestra "Accettazione raccolta dati utente" da confermare prima di creare un API secret in GA4](/images/blog/2025/MP_TeC.png)

- Clicca su _Crea_
  ![Pannello "API secret di Measurement Protocol" con il pulsante Crea evidenziato](/images/blog/2025/MP_crea.png)

- Copia il codice alfanumerico al centro della schermata
  ![Elenco degli API secret in GA4 con il valore del secret appena creato pronto da copiare](/images/blog/2025/MP_API_k.png)

**Nota Bene**:

- Se credi che la chiave sia stata compromessa (ad es: ricevi richieste che non riconosci) puoi cancellare quella esistente e generarne un'altra. Clicca i tre puntini verticali **⋮** e clicca _Elimina_,
- La chiave API non deve **MAI** essere esposta o mostrata nel browser o nel codice frontend

### La Struttura di una Richiesta

Le richieste al Measurement Protocol devono essere inviate in formato JSON e includono alcuni parametri obbligatori. Ecco un esempio base:

```json
{
  "client_id": "123456789.1234567890",
  "events": [
    {
      "name": "example_event",
      "params": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ]
}
```

#### Spiegazione dei parametri:

- **client_id**: Un identificatore univoco per l'utente. Va recuperato dal cookie nel browser.
- **events**: Un array di eventi da registrare. Ogni evento deve avere un nome e, opzionalmente, parametri personalizzati.
- **params**: I parametri personalizzati associati all'evento.

### Passaggi Pratici per Inviare una Richiesta

1. **Preparare i dati**: Scrivi i parametri obbligatori (client_id, nome evento, ecc.).
2. **Strutturare la richiesta**: Segui il formato JSON.
3. **Inviare la richiesta**: Usa uno strumento come Postman o una qualsiasi libreria HTTP per inviarla a `https://www.google-analytics.com/mp/collect`.

#### Esempio di invio di una richiesta con fetch e JavaScript:

```javascript
const measurement_id = `G-XXXXXXXXXX`;
const api_secret = `<secret_value>`;

fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurement_id}&api_secret=${api_secret}`, {
  method: 'POST',
  body: JSON.stringify({
    client_id: '1234567890.9876543210',
    events: [
      {
        name: 'tutorial_begin',
        params: {
          timestamp_micros: '1736090309000000',
          campaign_id: 'google_1234',
          campaign: 'Summer_fun',
          source: 'google',
          medium: 'cpc',
          term: 'summer+travel',
          content: 'logolink',
          session_id: '123',
          engagement_time_msec: '100',
        },
      },
    ],
  }),
});
```

### Suggerimenti Finali

- **Testa sempre le richieste**: Prima di inviare eventi reali, verifica che funzionino correttamente.
- **Utilizza un client_id univoco**: Questo assicura che i dati siano associati correttamente agli utenti.
- **Consulta la documentazione ufficiale**: [Measurement Protocol di GA4](https://developers.google.com/analytics/devguides/collection/protocol/ga4) per ulteriori dettagli e opzioni avanzate.

## Bibliografia e risorse utili

Per approfondire ulteriormente il Measurment Protocol, ecco alcune risorse utili:

1. [Guida Ufficiale](https://developers.google.com/analytics/devguides/collection/protocol/ga4)

2. [Data Rocks](https://data.rocks/en/blog/what-is-measurement-protocol-ga4/)

3. [Optimize Smart](https://www.optimizesmart.com/what-is-measurement-protocol-in-google-analytics-4-ga4/)

**Nota**: I link forniti sono aggiornati al momento della stesura di questo articolo. Si consiglia di verificare sempre la disponibilità e l'attualità delle informazioni consultando direttamente le fonti.
