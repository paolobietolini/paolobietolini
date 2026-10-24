---
title: Un DataLayer Coerente per il Tuo E-commerce Come Superare i Limiti dello Standard di Google
date: 2025-04-04
lang: it
description: Come progettare un dataLayer coerente per l'e-commerce, superando i limiti dello standard Google GA4 con una struttura dati scalabile e manutenibile.
---

Lavorando nel Digital Marketing sai quanto sia cruciale avere un **tracciamento preciso e affidabile** dei dati per prendere decisioni strategiche e ottimizzare le performance. Tuttavia, chiunque abbia implementato il tracciamento ecommerce di GA4 si sarà scontrato con alcune problematiche che possono rendere la gestione dei dati più complessa del necessario.

Lo standard proposto da Google, pur essendo un punto di partenza utile, presenta diversi problemi:

- **Struttura incoerente tra eventi**: eventi come `add_to_cart` e `page_view` seguono schemi diversi (`action_object` vs. `object_action`), complicando la standardizzazione della raccolta dati.
- **Ripetizione di informazioni inutili**: alcuni dati sono disponibili solo in eventi specifici quando potrebbero essere disponibili a livello globale (es. `user_id`, `currency`).

### **Perché questo è un problema?**

Per i **marketer**, significa avere poca flessibilità e poca scalabilità. Google oramai non detiene più il monopolio negli strumenti di analisi e una configurazione più elastica permette di semplificare l'integrazione parallela con altri sistemi di analytics (es. Adobe Analytics, Mixpanel), piattaforme di Customer Data Platform (CDP) e strumenti di marketing automation. Inoltre, una struttura dati più chiara facilita la creazione di segmenti di pubblico personalizzati e l'analisi del customer journey in modo più intuitivo.

Per i **developer**, significa dover scrivere codice più articolato per rispettare uno standard che in realtà può essere migliorato. Implementare un dataLayer coerente riduce la ridondanza del codice, semplifica la manutenzione e facilita l'onboarding di nuovi sviluppatori sul progetto. Inoltre, un dataLayer ben strutturato può migliorare le performance del sito, riducendo la quantità di dati inutili inviati.

### **La Soluzione: Un DataLayer Pulito, Coerente ed Efficiente**

In questo articolo vedremo un **approccio alternativo** per costruire un dataLayer più ordinato e pratico, che:

✅ Mantiene una struttura uniforme per ogni evento

✅ Evita la duplicazione di dati inutili

✅ Utilizza sempre la stessa chiave per gli elementi (es. `items[]`), indipendentemente dall’evento

✅ Semplifica la configurazione in GTM, riducendo il numero di variabili personalizzate necessarie

✅ Facilita l'integrazione con piattaforme di terze parti

✅ Migliora la leggibilità e la manutenibilità del codice

Se vuoi ridurre la complessità del tuo tracciamento e ottenere dati più puliti e facili da gestire, continua a leggere: ti mostrerò passo dopo passo come implementare un dataLayer **più intelligente e scalabile** per il tuo sito e/o e-commerce.

---

## **Variabili Permanenti nel DataLayer**

In Google Tag Manager, ogni variabile viene definita a livello di evento. Questo significa che, ogni volta che un evento presenta una o più variabili, il valore di queste verrà letto da GTM e rimarrà tale finché un nuovo evento non invierà un nuovo valore.

Ad esempio, supponiamo di avere la variabile `user_id`. Se questa viene inviata con un evento `login`, GTM manterrà questo valore anche per gli eventi successivi, a meno che un altro evento non la aggiorni. Questa caratteristica può essere sfruttata per **evitare di inviare ripetutamente le stesse informazioni** e ridurre il carico di dati superflui. È fondamentale definire quali informazioni sono realmente "permanenti" e quali potrebbero variare durante la sessione dell'utente.

## **Naming Convention**

Quando si tratta di raccolta di dati, il modo migliore per impostarla è stabilire convenzione relativa ai nomi nel dataLayer.
Questo non solo renderà più facile la lettura del codice, ma farà sì che tutti gli stakeholders possano capire facilmente il significato degli eventi e delle proprietà. Una naming convention ben definita è la base per una governance dei dati efficace.

In questo paragrafo vedrai perché il framework _object-action_, proposto da [Segment](https://segment.com/academy/collecting-data/naming-conventions-for-clean-data/), è una soluzione efficace e scalabile.

### Benefici di una denominazione coerente

Se vuoi davvero sfruttare al massimo i tuoi dati (e il tuo investimento nel tracking), è importante porre attenzione a come vengono nominati gli eventi.
Se non lo fai, la gestione dei dati diventerà disordinata, perché diversi sviluppatori implementeranno il tracciamento in momenti diversi e con preferenze diverse, risultando in un miscuglio di eventi difficili da leggere e analizzare. Questa incoerenza può portare a interpretazioni errate dei dati e a decisioni di marketing inefficaci.

Ci sono molti modi diversi per denominare la stessa interazione dell'utente. Prendi, ad esempio, l'azione semplice di un utente che si iscrive a una newsletter. Potresti implementare l'evento come "Iscrizione", "Signup" o "Utente Iscritto".
Come puoi immaginare una denominazione incoerente porta a difficoltà nell'analisi sopratutto quando si ha a che fare con grandi set di dati. Una naming convention coerente porta i seguenti benefici:

- **Coerenza**: Il principale vantaggio di utilizzare un framework chiaro è la coerenza dei dati. Se tutti i diversi tipi di dati ed eventi sono denominati allo stesso modo diventerà più semplice fare un'analisi comparata tra diversi tool. E risulterà più semplice implementare un solo dataLayer per diversi strumenti. Questa coerenza si estende anche alla documentazione e alla formazione dei team.

- **Comodità**: È probabile che continuerai ad aggiungere nuovi tracciamenti man mano che la tua azienda lancia nuove funzionalità e prodotti. Avere una convenzione standardizzata sui nomi e sugli eventi, significa che ogni volta che uno sviluppatore implementa un nuovo tracciamento, non dovrà pensare a come farlo. Questo accelera il processo di implementazione e riduce il rischio di errori.

- **Chiarezza**: I data set crescono insieme all'azienda e con l'aumentare dei team coinvolti (marketing, analisi, prodotto etc...), rispettare degli standard, significa che tutti possono facilmente capire cosa significa ogni evento.
  Questo permette a te e ad i tuoi colleghi di eseguire analisi ad hoc e lanciare esperimenti utilizzando dati che sono organizzati e facili da comprendere. Una nomenclatura chiara facilita la comunicazione tra i diversi team e riduce le ambiguità.

## **Il framework object-action**

Secondo diverse fonti online, tra cui [Growth Method](https://growthmethod.com/object-action-framework/#:~:text=The%20object%2Daction%20framework%20states,Submitted%20and%20not%20Form%20Submit), il framework _object-action_ è ampiamente riconosciuto come una _best practice_ nel tracciamento degli eventi. È importante notare che, sebbene Google Analytics 4 utilizzi una sua nomenclatura standard, l'approccio _object-action_ può coesistere e anzi, arricchire l'analisi.

Il concetto alla base è semplice: ogni evento deve seguire la logica _oggetto_azione_.

- **Oggetto**: rappresenta l’elemento che vogliamo tracciare (es. un form, un link, un bottone, un carrello, una pagina).
- **Azione**: descrive l’interazione che avviene su quell’elemento (es. click, visualizzazione, invio).

Questo approccio offre un vantaggio immediato: semplifica l’analisi dei dati.
Ad esempio, se volessi analizzare il comportamento degli utenti durante la navigazione di una lista prodotti, basterebbe filtrare gli eventi con il prefisso `product__` (es. `productListView`, `productView`, `productSelect`). Questo aiuta a mantenere gli eventi ordinati in modo logico e facilita la lettura.

📌 _Nota:_ In GA4 la naming convention è differente, ma è possibile ovviare al problema utilizzando una **dimensione personalizzata a livello di evento** per conservare il nome originale dell'evento secondo la vostra naming convention (_object-action_). Questo vi permetterà di analizzare i dati in GA4 utilizzando la vostra struttura logica, pur mantenendo la compatibilità con il modello dati di Google.

### **Notazione, maiuscole e lingua**

Per garantire uniformità e leggibilità, è fondamentale stabilire delle regole chiare su due aspetti:

1. **La notazione (casing)**: esistono diversi modi per scrivere i nomi degli eventi, come `camelCasing`, `snake_casing`, `PascalCasing` e `kebab-casing`. L’importante è scegliere uno stile e mantenerlo coerente all'interno dell'intero dataLayer. La coerenza nella notazione riduce gli errori e migliora la comprensione del codice. Personalmente preferisco `camelCasing` e l'utilizzo della lingua inglese, in quanto sono convenzioni ampiamente utilizzate nella programmazione web e facilitano la collaborazione con team internazionali, ma la scelta dipende dalle esigenze, e dalle preferenze, aziendali. **È cruciale documentare la scelta effettuata.**
2. **L’uso degli spazi**: evitare gli spazi nei nomi degli eventi è una buona pratica per evitare fraintendimenti, sia per chi legge il codice sia per i sistemi che elaborano i dati. Per esempio, un nome con uno spazio potrebbe essere interpretato come due entità separate da alcuni strumenti di analisi. Gli spazi possono anche causare problemi con alcuni linguaggi di programmazione e piattaforme di analisi.

Infine, è essenziale prestare attenzione alla distinzione tra maiuscole e minuscole. Nei sistemi di tracciamento, `cart_add` e `Cart_Add` sarebbero considerati **eventi diversi**, causando inconsistenze nei dati e rendendo difficile l'aggregazione e l'analisi. Definire uno standard (solitamente tutto minuscolo o `camelCasing`) e seguirlo rigorosamente evita errori e rende il tracciamento più affidabile. L'implementazione di **validator automatizzati** nel processo di sviluppo può aiutare a garantire la conformità a queste regole.

Alcuni esempi di notazioni:

| Nome Eventi                                             | Notazione                  | Lingua                     |
| ------------------------------------------------------- | -------------------------- | -------------------------- |
| productView, cartAdd, formSubmit                        | Camel Casing               | Inglese                    |
| prodotto_visualizzazione, carrello_aggiunta, form_invio | Snake Casing               | Italiano                   |
| CartAdd, form_invio                                     | Mista, **non accettabile** | Mista, **non accettabile** |

## **Esempi pratici e proposte di implementazione**

Ora passiamo alla pratica! Ecco alcuni esempi che puoi copiare, personalizzare e adattare alle tue esigenze.

Oltre a seguire il framework _object-action_, un principio fondamentale è organizzare il _dataLayer_ in modo logico, separando gli oggetti in base alla loro funzione.
Ad esempio, non ha senso inviare dati generali dell’e-commerce, come la valuta, con ogni evento legato ai prodotti. Come abbiamo visto precedentemente il valore delle variabili viene mantenuto finché la pagina non viene chiusa o cambiata.
Una soluzione più efficiente sarebbe creare un oggetto globale dedicato al sito, che contenga informazioni di base sempre disponibili a ogni caricamento di pagina:

Questo oggetto globale può essere pushato nel `dataLayer` all'inizializzazione della pagina.

```javascript
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event: 'pageLoad',
  platform: {
    environment: 'production',
    country: 'IT',
    currency: 'EUR',
  },
  page: {
    pageCategory: {
      pageType: 'Homepage',
      category: 'home',
    },
    pageInfo: {
      pageLanguage: 'IT',
      cmsPath: 'content~home',
    },
  },
  user: {
    userIdSAP: '12345789',
    userIdSalesforce: '7845646',
    loggedIn: false,
    userId: '001124',
  },
  cart: {
    cartId: '1234546484',
    cartQuantity: 5,
    cartValue: 1000.0,
    cartProductLines: 3,
    items: [
      {
        productId: '12546',
        productSKU: 'ABC',
        productPrice: 12.99,
        productAvailability: 'IN_STOCK',
        productQuantity: 1,
        productCategory: 'home',
      },
      {
        // ... altri prodotti nel carrello
      },
    ],
  },
});
```

Data la persistenza degli eventi e degli oggetti nel dataLayer non ci sarà necessità di inviare nuovamente questi parametri con gli eventi successivi, infatti se nella stessa pagina volessi inviare l'evento relativo alla visualizzazione del prodotto, mi basterebbe inviare nel dataLayer l'oggetto `product`:

```js
window.dataLayer.push({
  event: 'productView',
  items: [
    {
      productId: '12546',
      productSKU: 'ABC',
      productPrice: 12.99,
      productAvailability: 'IN_STOCK',
      productQuantity: 1,
      productCategory: 'home',
      productVariantId: 'ABN-125',
      productVariant: 'green',
    },
  ],
});
```

Per una visualizzazione di una lista di prodotti, basterà' cambiare il nome dell'evento e aggiungere prodotti all'array `items`:

```js
window.dataLayer.push({
  event: 'productListView',
  items: [
    {
      productId: '12546',
      productSKU: 'ABC',
      productPrice: 12.99,
      productAvailability: 'IN_STOCK',
      productQuantity: 1,
      productCategory: 'home',
    },
    {
      productId: '78901',
      productSKU: 'DEF',
      productPrice: 19.99,
      productAvailability: 'OUT_OF_STOCK',
      productQuantity: 0,
      productCategory: 'electronics',
    },
  ],
});
```

Per le aggiunte/rimozioni dal carrello la logica utilizzata sarà la stessa

```js
window.dataLayer.push({
  event: 'cartAdd', //'cartRemove'
  items: [
    {
      productId: '12546',
      productSKU: 'ABC',
      productPrice: 12.99,
      productAvailability: 'IN_STOCK',
      productQuantity: 2,
      productCategory: 'home',
    },
  ],
});
```

### **Estensione dell'Oggetto `items`**

L'oggetto `items` può essere esteso con ulteriori informazioni rilevanti per la tua attività, come:

- `productBrand`: Marca del prodotto
- `productColor`: Colore del prodotto
- `productSize`: Taglia del prodotto
- `promotionId`: Identificativo della promozione applicata
- `promotionName`: Nome della promozione applicata
- `itemListName`: Nome della lista in cui è apparso l'articolo (es. "Prodotti Correlati", "Risultati Ricerca")
- `itemListId`: Identificativo della lista
- `itemPosition`: Posizione dell'articolo nella lista

### Eventi standardizzati per un E-commerce

Di seguito una proposta di azioni ed oggetti per un e commerce. La libertà di personalizzazione è indubbia, quindi adatta pure la tabella alle tue necessità'. Considera anche l'importanza di tracciare eventi legati alla **wishlist**, alle **recensioni**, ai **processi di checkout** (passaggi specifici) e alle **interazioni con i contenuti** (es. visualizzazione video prodotto).

| Oggetto  | Azione                                 | Esempi di Nomi Evento                         |
| -------- | -------------------------------------- | --------------------------------------------- |
| Prodotto | Visualizzazione                        | `productView`                                 |
| Prodotto | Click (selezione)                      | `productClick`                                |
| Prodotto | Aggiunta ai Preferiti                  | `productFavoriteAdd`, `productFavoriteRemove` |
| Carrello | Visualizzazione                        | `cartView`                                    |
| Carrello | Aggiornamento (quantità)               | `cartUpdate`                                  |
| Carrello | Condivisione                           | `cartShare`                                   |
| Carrello | Salvataggio (alla wishlist)            | `cartSave`                                    |
| Carrello | Eliminazione prodotto                  | `cartDelete`                                  |
| Carrello | Aggiunta prodotto                      | `cartAdd`                                     |
| Carrello | Rimozione prodotto                     | `cartRemove`                                  |
| Ordine   | Completamento                          | `orderComplete`                               |
| Ordine   | Aggiornamento (stato)                  | `orderUpdate`                                 |
| Ordine   | Annullamento                           | `orderCancel`                                 |
| Ordine   | Rimborso                               | `orderRefund`                                 |
| Checkout | Inizio                                 | `checkoutStart`                               |
| Checkout | Passaggio Informativo (es. spedizione) | `checkoutShippingInfo`, `checkoutPaymentInfo` |
| Checkout | Completamento Pagamento                | `checkoutPaymentComplete`                     |
| Form     | Visualizzazione                        | `formView`                                    |
| Form     | Interazione (es. focus su un campo)    | `formInteract`                                |
| Form     | Invio                                  | `formSubmit`                                  |
| Link     | Click (uscita dal sito)                | `linkClickOutbound`                           |
| Link     | Click (interno)                        | `linkClickInternal`                           |
| Ricerca  | Visualizzazione Box                    | `searchBoxView`                               |
| Ricerca  | Invio Query                            | `searchSubmit`                                |
| Ricerca  | Risultati Visualizzati                 | `searchResultsView`                           |
| Video    | Inizio Riproduzione                    | `videoStart`                                  |
| Video    | Pausa                                  | `videoPause`                                  |
| Video    | Completamento                          | `videoComplete`                               |
| Download | File Scaricato                         | `fileDownload`                                |

Questa tabella può essere espansa, modificata e personalizzata anche per altre categorie merceologiche (Hotel: `hotelView`, `bookingConfirm`; Blog: `articleView`, `commentSubmit`; Vetrine: `storeLocationView`, `getDirections` etc..). L'importante è mantenere la coerenza con il framework _object-action_.

### **Organizzare gli Eventi con le Categorie**

Per le aziende con più canali di raccolta dati (es. sito web, app mobile, portale aziendale), un’ulteriore ottimizzazione consiste nell'aggiungere una **categoria** agli eventi. Questo approccio consente di segmentare i dati in modo più chiaro e semplificare l’analisi incrociata tra diverse piattaforme. La categoria può essere inclusa direttamente nel nome dell'evento o come una proprietà separata nel `dataLayer`.

Ad esempio, utilizzando la prima opzione (nel nome dell'evento):

- `web:userSignUp` → Iscrizione effettuata sul sito web
- `app:userSignUp` → Iscrizione effettuata tramite app mobile
- `crm:userSignUp` → Iscrizione registrata nel CRM

Utilizzando una proprietà separata:

```javascript
window.dataLayer.push({
  event: 'userSignUp',
  eventCategory: 'web', // o 'app', o 'crm'
  // ... altre proprietà dell'evento
});
```

Entrambi gli approcci hanno i loro vantaggi. Includere la categoria nel nome dell'evento rende immediatamente chiaro l'origine, mentre una proprietà separata offre maggiore flessibilità per il filtraggio e la creazione di report in GA4 e altre piattaforme.

Questa suddivisione consente ai team di marketing, sviluppo e analisi di **filtrare rapidamente i dati**, evitando ambiguità e migliorando la leggibilità delle informazioni tracciate. Implementare una categorizzazione chiara e coerente è particolarmente utile per le aziende con ecosistemi digitali complessi, garantendo una gestione del dataLayer più ordinata e scalabile. **Definisci chiaramente le categorie che utilizzerai fin dall'inizio.**

### **Esempio di configurazione in Google Tag Manager**

Ecco un esempio di come configurare un evento `productView` in Google Tag Manager utilizzando la struttura del dataLayer proposta:

1. **Creazione di una Variabile Data Layer**:
   - Vai su **Variabili** > **Nuova**
   - Tipo: **Variabile livello dati**
   - Nome: `dl_product_items`
   - Percorso: `items`
     _Questo recupererà l'array di oggetti `items` dall'evento._

2. **Creazione di una Variabile Data Layer per un singolo parametro (es. `productId`)**:
   - Vai su **Variabili** > **Nuova**
   - Tipo: **Variabile livello dati**
   - Nome: `dl_product_id`
   - Percorso: `items.0.productId`
     _Questo recupererà il `productId` del primo elemento nell'array `items`. Potrebbe essere necessario creare variabili simili per altri parametri._

3. **Creazione di un Attivatore basato su Eventi**:
   - Vai su **Attivatori** > **Nuovo**
   - Tipo: **Evento personalizzato**
   - Nome evento: `productView`

4. **Configurazione di un Tag Google Analytics 4**:
   - Vai su **Tag** > **Nuovo**
   - Tipo: **Google Analytics: Evento GA4**
   - Tag di configurazione: _Seleziona il tuo tag di configurazione GA4_
   - Nome evento: `view_item` <- Dobbiamo utilizzare la naming convention [proposta da Google](https://support.google.com/analytics/answer/9267735?hl=it#online-sales)`

   - **Parametri evento**:
     - Fai clic su "Aggiungi riga" e crea i seguenti parametri (adattandoli alle tue esigenze):
       - Nome parametro: `items`
       - Valore: `{{dl_product_items}}` _(la variabile che recupera l'intero array `items`)_

   - **Dimensioni personalizzate (a livello di evento)**:
     - Se vuoi conservare il nome del tuo evento `object-action`:
       - Nome parametro: `original_event`
       - Valore: `productView` _(o usa una variabile dataLayer per recuperare dinamicamente il nome dell'evento)_

   - Seleziona l’attivatore creato (`productView`)

### **Utilizzo della Variabile Object Keys Remapper**

Come accennato, la variabile [Object Keys Remapper](https://tagmanager.google.com/gallery/#/owners/paolobtl/templates/gtm-template-object-remapper) può semplificare notevolmente la mappatura dell'oggetto `items` del tuo dataLayer personalizzato al formato atteso da GA4. Invece di creare manualmente diverse variabili dataLayer per ogni proprietà dell'elemento, puoi configurare la variabile Object Keys Remapper per trasformare l'oggetto `items` nel formato corretto (ad esempio, rinominando `productId` in `item_id`, `productPrice` in `price`, ecc.).

### **Considerazioni Finali e Prossimi Passi**

Implementare un dataLayer pulito, coerente ed efficiente richiede pianificazione e collaborazione tra i team di marketing e sviluppo. I passaggi successivi potrebbero includere:

- **Definire una documentazione dettagliata** della naming convention e della struttura del dataLayer.
- **Formare i team** sull'utilizzo del nuovo dataLayer.
- **Eseguire test approfonditi** per garantire la corretta implementazione del tracciamento.
- **Monitorare regolarmente la qualità dei dati** in GA4 e altre piattaforme.
- **Iterare e migliorare** il dataLayer in base alle nuove esigenze e ai feedback.

Adottando questo approccio, potrai ottenere dati più affidabili, semplificare la configurazione del tracciamento e sbloccare analisi più approfondite per guidare le tue strategie di marketing.

## Bibliografia e risorse utili

1.  [Google Developers - The data layer](https://developers.google.com/tag-platform/devguides/datalayer)
2.  [Analytics Mania - Complete Google Tag Manager Data Layer Tutorial](https://www.analyticsmania.com/post/ultimate-google-tag-manager-data-layer-tutorial/)
3.  [Stape - End-to-end guide on data layer in Google Tag Manager](https://stape.io/blog/end-to-end-guide-on-data-layer-in-google-tag-manager)
4.  [ObservePoint - Data Layer Best Practices for an Analytics Implementation](https://www.observepoint.com/blog-posts/data-layer-best-practices-analytics/)
5.  [Segment - Naming Conventions: Why You Need Them for Clean Data](https://segment.com/academy/collecting-data/naming-conventions-for-clean-data/)
6.  [Segment - Naming Conventions Best Practices](https://segment.com/docs/protocols/tracking-plan/best-practices/)
7.  [Medium (Alex Ran) - Naming Convention: How to name tracking events](https://alexzran.medium.com/naming-convention-how-to-name-tracking-events-605792071591)
8.  [Braze - Event Naming Conventions](https://www.braze.com/docs/user_guide/data_and_analytics/custom_data/event_naming_conventions/)
9.  [[GA4] Configurare gli eventi di e-commerce](https://support.google.com/analytics/answer/12200568?hl=it)
10. [Peak Metrics - Come tracciare l’Ecommerce in Google Analytics 4](https://www.peakmetrics.net/blog/web-analytics/configurazione-ecommerce-ga4/)

**Nota**: I link forniti sono aggiornati al momento della stesura di questo articolo. Si consiglia di verificare sempre la disponibilità e l'attualità delle informazioni consultando direttamente le fonti.
