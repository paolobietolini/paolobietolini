---
title: "DDIA: Capitolo 1 — Applicazioni affidabili, scalabili e manutenibili"
date: 2026-08-30
lang: it
description: ""
---
> Questi appunti fanno parte di un progetto di Learn in Public. Ogni settimana leggo e riassumo un capitolo di [Designing Data-Intensive Applications](https://dataintensive.net/) di Martin Klepmann. Gli appunti sono presi in inglese e tradotti in Italiano da Claude. </br>Contestualmente al libro sto lavorando ad un progetto di creazione ed ingestion di dati sintetici di GA4 verso Databricks: [Clickstream](https://github.com/paolobietolini/clickstream-lakehouse).</br>Gli appunti sono in Italiano perchè, mi pare, non esistano risorse in questa lingua.


*Appunti del 24.08.2026 — versione rivista e corretta*

---

## 0. Definizioni personali (pre-lettura)

Tre definizioni scritte **prima** di leggere il capitolo, come esercizio deliberato: fissare l'intuizione di partenza per poi misurare quanto si discosta da quella del libro. Non sono errori da correggere, sono il punto di partenza. Quello che interessa è la **distanza** — e in che direzione va.

---

### Reliability

| | |
|---|---|
| **Intuizione pre-lettura** | Il sistema in uso deve poter restituire il risultato atteso *indipendentemente* dalle condizioni/variabili impreviste. |
| **Kleppmann** | Il sistema continua a funzionare correttamente **anche in presenza** di avversità — hardware, software, umane — e le avversità sono quelle **anticipate** in fase di progetto. |

**Dove sta la distanza:** in una sola parola, *indipendentemente*. L'intuizione di partenza è **assoluta**, quella ingegneristica è **limitata**. Nessun sistema tollera qualsiasi fault possibile: si sceglie quali anticipare, e il resto è rischio accettato consapevolmente.

**Perché la distanza è interessante:** è esattamente il passaggio da una nozione ideale a una nozione progettuale. Tutto il resto della sezione reliability discende da questa limitazione — se l'affidabilità fosse assoluta non avrebbe senso parlare di categorie di fault, di trade-off, o di provocarli deliberatamente per testarli.

**Cosa mancava del tutto:** la reliability non riguarda solo il *risultato corretto*. Include anche mantenere un livello di performance accettabile e resistere ad accessi o usi non autorizzati.

---

### Scalability

| | |
|---|---|
| **Intuizione pre-lettura** | Il sistema cresce o decresce in linea al numero di utilizzatori. |
| **Kleppmann** | Capacità del sistema di far fronte a un **carico crescente**. Non è un'etichetta binaria: è sempre relativa a un modo specifico in cui il sistema cresce. |

**Dove sta la distanza:** su due assi separati.

1. **Cosa cresce.** L'intuizione ancorava il carico al *numero di utenti*. È la scelta di load parameter più naturale — ed è esattamente quella che l'esempio Twitter è costruito per demolire. Lì il numero di utenti e persino i tweet al secondo sono numeri innocui; quello che rompe il sistema è la distribuzione dei follower. Questo è il punto in cui l'intuizione pre-lettura e il capitolo divergono di più.
2. **Chi si muove.** "Cresce o decresce" mette il sistema come soggetto attivo: quella è l'**elasticità**, che nel libro esiste ma è una proprietà più stretta e non necessariamente desiderabile (vedi §3.5). La scalabilità è la domanda a monte, l'elasticità una delle risposte possibili.

**Perché la distanza è interessante:** l'intuizione conteneva già un concetto reale del libro, solo collocato al posto sbagliato nella gerarchia. Non era vaga, era *sfasata di un livello*.

---

### Maintainability

| | |
|---|---|
| **Intuizione pre-lettura** | Il sistema può essere revisionato, corretto e curato facilmente. |
| **Kleppmann** | Le persone che lavorano sul sistema — sviluppo e operations, nel tempo, anche chi non l'ha scritto — devono poter rispondere a nuove esigenze in modo produttivo. |

**Dove sta la distanza:** nel **soggetto**. L'intuizione tratta la manutenibilità come una proprietà del sistema; Kleppmann la tratta come una proprietà dell'**esperienza di chi ci lavora**. Il sistema non si mantiene: lo mantiene qualcuno.

**Perché la distanza è interessante:** è lo spostamento che rende sensati tutti e tre i principi che seguono. *Operability* riguarda il team operations, *simplicity* riguarda i nuovi ingegneri, *evolvability* riguarda chi dovrà modificare il codice. Con il sistema come soggetto, nessuno dei tre si giustifica; con le persone come soggetto, sono conseguenze dirette.

---

**Nota trasversale sulle tre.** Tutte e tre le intuizioni erano formulate come **proprietà statiche di un oggetto**. Il capitolo le riformula come **relazioni**: reliability è una relazione tra sistema e fault anticipati, scalability tra carico e performance, maintainability tra sistema e persone. È probabilmente la singola differenza più significativa tra il "prima" e il "dopo".

---

## 1. Contesto: applicazioni data-intensive

I problemi di oggi sono legati ai **dati**, non alla capacità di calcolo. I vincoli tipici riguardano:

- la **quantità** di dati;
- la **complessità** dei dati;
- la **velocità** con cui i dati cambiano.

Il panorama degli strumenti è sempre più sfumato: i confini tra le categorie si confondono. Redis, per esempio, nasce come datastore ma offre anche funzionalità di message queue; Kafka nasce come message queue ma offre garanzie di durabilità da database.

Al tempo stesso i requisiti applicativi sono così esigenti che nessun singolo strumento li copre tutti: si combinano più strumenti, ognuno efficiente per un compito specifico, **cuciti insieme dal codice applicativo**.

Facendo questo diventiamo di fatto **progettisti di sistemi di dati**, e ci troviamo davanti a domande su qualità del dato, performance e scalabilità che prima erano di competenza di chi scriveva il database.

Queste domande sono comuni alla maggior parte dei sistemi software e si raggruppano in tre proprietà:

| Proprietà | Definizione sintetica |
|---|---|
| **Reliability** | Il sistema continua a funzionare correttamente anche in presenza di guasti hardware, guasti software ed errori umani. |
| **Scalability** | Il sistema regge la crescita (volume di dati, volume di traffico, complessità). |
| **Maintainability** | Chi lavora sul sistema riesce a rispondere a nuove esigenze in modo produttivo. |

---

## 2. Reliability

### 2.1 Fault ≠ Failure

Questa distinzione mancava negli appunti ed è centrale in tutto il capitolo.

- **Fault (guasto):** un singolo componente devia dalla sua specifica.
- **Failure (fallimento):** il sistema **nel suo complesso** smette di erogare il servizio all'utente.

La probabilità di un fault non può essere ridotta a zero. L'obiettivo della progettazione è quindi costruire meccanismi di **fault tolerance** che impediscano ai fault di trasformarsi in failure.

Un sistema che anticipa i fault e li gestisce si dice **fault-tolerant** o **resilient**.

Durante lo sviluppo e la manutenzione ha senso **provocare deliberatamente i fault** per verificare che i meccanismi di tolleranza funzionino davvero (l'esempio classico è il Chaos Monkey di Netflix). Testare in questo modo aumenta la fiducia che i fault verranno gestiti correttamente quando si presenteranno da soli.

> **Eccezione importante:** in alcuni casi la prevenzione è preferibile alla cura, perché non esiste rimedio. È il caso della sicurezza: se un attaccante ha compromesso il sistema ed esfiltrato dati, l'evento non è annullabile.

I fault si classificano in tre categorie.

### 2.2 Hardware faults

Storicamente la ridondanza **hardware** (RAID, doppi alimentatori, CPU hot-swappable, gruppi di continuità) bastava. Poi sono cambiate due cose:

1. Con la crescita dei volumi, le applicazioni usano un numero sempre maggiore di macchine, e il tasso di guasti hardware cresce proporzionalmente.
2. Le piattaforme cloud (AWS e simili) sono progettate dando **priorità a flessibilità ed elasticità rispetto all'affidabilità della singola macchina**: un'istanza può diventare indisponibile senza preavviso.

Da qui il movimento verso sistemi che tollerano la perdita di **macchine intere** tramite tecniche di fault tolerance **software**, usate **al posto della, o in aggiunta alla, ridondanza hardware**.

Vantaggio operativo concreto: un sistema su singolo server richiede downtime pianificato per i riavvii (es. patch di sicurezza), mentre un sistema che tollera il guasto di una macchina può essere aggiornato **un nodo alla volta**, senza fermare l'intero servizio (*rolling upgrade*).

Caratteristica dei fault hardware: sono in larga parte **casuali e indipendenti** tra loro.

### 2.3 Software faults

Sono errori sistematici interni al sistema. Esempi:

- un bug che manda in crash ogni istanza a fronte di un input specifico (il caso del leap second del 2012 su Linux);
- un processo fuori controllo che satura una risorsa condivisa (CPU, memoria, disco, banda);
- un servizio da cui il sistema dipende che rallenta o smette di rispondere;
- **cascading failure**: un piccolo fault in un componente ne innesca uno in un altro, che a sua volta ne innesca altri.

Non esiste una soluzione rapida. Mitigazioni:

- ragionare con attenzione su assunzioni e interazioni del sistema;
- testing accurato;
- isolamento dei processi;
- permettere ai processi di andare in crash e riavviarsi;
- misurare, monitorare e analizzare il comportamento in produzione;
- self-check e assertion sulle garanzie che il sistema dovrebbe rispettare.

### 2.4 Human errors

Gli operatori umani sono la causa principale dei disservizi: uno studio citato nel libro attribuisce la maggior parte delle interruzioni a errori di configurazione, mentre i guasti hardware pesano solo per il 10–25%.

Approcci (gli appunti ne coprivano due, la lista completa è più ricca):

- progettare astrazioni, API e interfacce di amministrazione che rendano difficile sbagliare;
- **disaccoppiare i punti in cui le persone sbagliano di più dai punti in cui l'errore causa danni**: ambienti sandbox completi dove esplorare e sperimentare con dati reali senza toccare gli utenti;
- testare a tutti i livelli (unit test, integrazione dell'intero sistema, test manuali);
- rendere il **recovery rapido**: rollback veloce delle configurazioni, rollout graduale del codice, strumenti per ricalcolare i dati;
- monitoring dettagliato (metriche di performance, error rate — la *telemetria*);
- buone pratiche gestionali e formazione.

### 2.5 Perché conta

Un sistema affidabile riduce le perdite di produttività e di profitto, il danno reputazionale e il rischio legale. Ci sono situazioni in cui si può sacrificare consapevolmente l'affidabilità per ridurre i costi (un prototipo, un mercato non ancora validato), ma la scelta deve essere esplicita.

---

## 3. Scalability

**Scalability = capacità del sistema di far fronte a un carico crescente.**

Attenzione: non è un'etichetta binaria. Dire "X è scalabile" o "Y non scala" non significa nulla. La scalabilità è sempre **relativa a un modo specifico in cui il sistema cresce**, quindi la domanda sensata è: *se il sistema cresce in questo modo, quali sono le nostre opzioni per gestirlo?*

Per porre quella domanda servono due grandezze misurabili: un modo di **descrivere il carico** e un modo di **descrivere la performance**. Da qui i due sotto-paragrafi.

### 3.1 Descrivere il carico

Il carico si descrive con numeri, i **load parameters**, che dipendono dall'architettura del sistema. Esempi: richieste al secondo verso un web server, rapporto letture/scritture su un database, utenti simultaneamente attivi, hit rate di una cache.

Il punto non banale è **scegliere il parametro giusto**. A volte conta la media, a volte solo pochi casi estremi sono il collo di bottiglia.

### 3.2 L'esempio Twitter

L'esempio non serve a spiegare come si costruisce una timeline: serve a mostrare che **il parametro ovvio è quello sbagliato**.

Due operazioni principali:

| Operazione | Volume |
|---|---|
| Pubblicare un tweet | 4,6k richieste/sec in media, oltre 12k/sec di picco |
| Leggere la home timeline | 300k richieste/sec |

I 12k tweet/sec al picco sono un numero facile: qualunque database ci sta dentro. Il vero problema è il **fan-out**: quante persone devono ricevere ogni tweet.

**Approccio 1 — costo in lettura.** I tweet finiscono in una collezione globale. Alla lettura si cercano le persone seguite, si prendono i loro tweet e si fondono ordinati per tempo.

**Approccio 2 — costo in scrittura.** Ogni utente ha una cache della propria home timeline. Alla pubblicazione, il tweet viene inserito nella cache di ciascun follower. La lettura è banale perché il risultato è già pronto.

Twitter è partito dall'approccio 1 ed è passato al 2, perché le letture sono di **due ordini di grandezza** più frequenti delle scritture: conviene spostare il lavoro in scrittura.

Il costo però si sposta: con 75 follower di media, 4,6k tweet/sec diventano circa **345k scritture/sec** nelle cache. E la media nasconde il caso vero — un utente con 30 milioni di follower genera 30 milioni di scritture per un singolo tweet, mentre Twitter punta a consegnare i tweet entro 5 secondi.

**Da qui la soluzione ibrida:** fan-out in scrittura per gli utenti normali, e per il piccolo numero di celebrità i tweet vengono recuperati separatamente e fusi in lettura.

> **Morale:** il load parameter che conta per Twitter è la **distribuzione dei follower per utente** (pesata sulla frequenza dei tweet), non il volume di tweet al secondo. Scegliere il parametro sbagliato fa credere di avere un problema facile.

### 3.3 Descrivere la performance

Una volta identificati i load parameters, la scalabilità diventa due domande precise:

1. Se aumento un load parameter **mantenendo invariate le risorse**, come peggiora la performance?
2. Se aumento un load parameter e voglio la **performance invariata**, di quanto devo aumentare le risorse?

Anche qui servono numeri. Quali dipende dal tipo di sistema:

- **sistemi batch**: throughput, cioè record processati al secondo o tempo totale per completare un job su un dataset di una certa dimensione;
- **sistemi online**: **response time**, il tempo tra invio della richiesta e ricezione della risposta.

> **Precisazione terminologica** (spesso confusa): il **response time** è ciò che vede il client e include il tempo di elaborazione, i ritardi di rete e i ritardi di accodamento. La **latency** è il tempo in cui una richiesta resta in attesa di essere gestita. Non sono sinonimi.

### 3.4 Percentili

Il response time non è un numero, è una **distribuzione**: la stessa richiesta ripetuta dà tempi diversi ogni volta (context switch, perdita di pacchetti, garbage collection, page fault).

La **media aritmetica è una metrica pessima**, perché non dice quanti utenti hanno effettivamente sperimentato quel ritardo. Meglio i **percentili**:

- **p50 (mediana)**: metà delle richieste è più veloce di così. È il tempo "tipico" per l'utente medio.
- **p95, p99, p999**: le **tail latencies**, cioè quanto sono lente le richieste peggiori.

Perché le code contano davvero:

- **I clienti con le richieste più lente sono spesso quelli con più dati sull'account, cioè quelli che hanno acquistato di più** — i più preziosi. Amazon usa il p999 sui servizi interni proprio per questo, anche se riguarda 1 richiesta su 1000.
- Amazon ha rilevato che **100 ms in più di response time riducono le vendite dell'1%**; altri riportano che 1 secondo di rallentamento riduce la customer satisfaction del 16%.
- Amazon **non** ottimizza il p9999: il costo è troppo alto e il risultato dipende da eventi casuali fuori controllo.

Altri due concetti utili:

- **Head-of-line blocking:** ai percentili alti gran parte del response time è tempo di coda. Poche richieste lente bloccano quelle dietro. Per questo il response time va misurato **lato client**.
- **Tail latency amplification:** se una richiesta utente ne richiede diverse in backend, basta una chiamata lenta per rallentare tutto. La probabilità che una richiesta end-user sia lenta cresce con il numero di backend coinvolti.

I percentili si usano anche negli **SLO** e **SLA** (es. "response time mediano sotto 200 ms e p99 sotto 1s, disponibilità ≥ 99,9%").

### 3.5 Reggere il carico

Per far fronte a un carico crescente è spesso necessario **ripensare l'architettura**. Un'architettura adeguata a un certo ordine di grandezza va tipicamente ripensata a ogni salto significativo di carico.

- **Scale up (verticale):** macchine più potenti.
- **Scale out (orizzontale):** distribuire il carico su più macchine più piccole — *shared-nothing architecture*.

Le buone architetture di solito usano un **mix pragmatico** dei due: molte macchine piccole possono costare più di poche macchine grandi.

**Elasticità:** un sistema elastico aggiunge automaticamente risorse quando rileva un aumento di carico.

Ancora: distribuire servizi **stateless** su più macchine è relativamente semplice; portare un sistema **stateful** da singolo nodo a distribuito introduce molta complessità aggiuntiva. Per questo la regola pratica è tenere il database su un nodo solo finché costi o requisiti di alta disponibilità non obbligano al contrario.

> **Punto chiave che vale la pena fissare:** non esiste un'architettura scalabile universale. L'architettura dei sistemi che operano su larga scala è quasi sempre **specifica dell'applicazione**, perché è costruita attorno ad assunzioni su quali operazioni saranno frequenti e quali rare — cioè attorno ai load parameters. In una startup in fase iniziale, iterare rapidamente sulle funzionalità è di solito più importante che scalare per un carico futuro ipotetico.

---

## 4. Maintainability

La maggior parte del costo di un software non sta nello sviluppo iniziale ma nella **manutenzione continua**: correggere bug, tenere il sistema operativo, investigare guasti, adattarlo a nuove piattaforme e nuovi casi d'uso, ripagare debito tecnico, aggiungere funzionalità.

Tre principi di progettazione per ridurre il dolore:

| Principio | In una riga |
|---|---|
| **Operability** | Rendere semplice per il team operations far girare il sistema senza attriti. |
| **Simplicity** | Rendere semplice per i nuovi ingegneri capire il sistema. |
| **Evolvability** | Rendere semplice estendere e modificare il software. |

### 4.1 Operability

> Buone operations possono spesso aggirare i limiti di un software mediocre; un buon software non può funzionare in modo affidabile con operations mediocri.

Responsabilità tipiche del team operations:

- monitorare lo stato di salute del sistema e ripristinare rapidamente il servizio;
- **risalire alla causa radice** dei problemi;
- tenere aggiornati software e piattaforme, incluse le patch di sicurezza;
- osservare come i diversi sistemi si influenzano a vicenda;
- anticipare i problemi futuri (capacity planning);
- stabilire buone pratiche e strumenti per deployment e gestione della configurazione;
- eseguire attività di manutenzione complesse (migrazioni di piattaforma);
- definire processi che rendano le operations prevedibili;
- **preservare la conoscenza organizzativa** sul sistema quando le persone cambiano.

Il software può facilitare tutto questo con buona osservabilità, automazione, comportamento prevedibile, default sensati e buona documentazione.

### 4.2 Simplicity

Distinzione fondamentale (Moseley & Marks):

- **complessità essenziale**: intrinseca al problema che il software risolve;
- **complessità accidentale**: non intrinseca al problema, nasce solo dall'implementazione.

Sintomi di complessità accidentale: esplosione dello spazio degli stati, accoppiamento stretto tra moduli, dipendenze aggrovigliate, naming e terminologia incoerenti, hack per aggirare problemi di performance, casi speciali sparsi per il codice.

**Lo strumento migliore per rimuovere la complessità accidentale è l'astrazione.** Una buona astrazione nasconde i dettagli implementativi dietro una facciata pulita e comprensibile, ed è riutilizzabile.


### 4.3 Evolvability

I requisiti cambiano sempre: nuovi casi d'uso, nuove piattaforme, nuovi vincoli legali, crescita che impone modifiche architetturali.

Il mondo Agile fornisce pratiche e strumenti utili — **TDD** e **refactoring** — ma sono pensati per una scala locale e ridotta (pochi file di codice). Kleppmann usa il termine **evolvability** invece di "agility" proprio per parlare di questa proprietà **a livello di sistema di dati complessivo**.

La facilità con cui si modifica un sistema di dati è strettamente legata alla sua **semplicità** e alle sue **astrazioni**: sistemi semplici e ben astratti sono più facili da modificare. È per questo che i tre principi sono in quest'ordine.

---

## Riepilogo del capitolo

- **Requisiti funzionali**: cosa il sistema deve fare (memorizzare, recuperare, cercare, elaborare dati).
- **Requisiti non funzionali**: sicurezza, affidabilità, compliance, scalabilità, compatibilità, manutenibilità.
- **Reliability**: far funzionare il sistema correttamente anche quando qualcosa va storto. I fault possono essere hardware (casuali e indipendenti), software (sistematici e correlati) e umani (inevitabili). Le tecniche di fault tolerance impediscono che un fault diventi un failure visibile all'utente.
- **Scalability**: strategie per mantenere buone performance quando il carico cresce. Richiede prima di tutto di **quantificare carico e performance**; i percentili sono lo strumento corretto per il response time. In un sistema scalabile si può aggiungere capacità di calcolo restando affidabili.
- **Maintainability**: rendere la vita migliore ai team di sviluppo e operations. Buone astrazioni riducono la complessità e rendono il sistema più facile da modificare. Le persone sono il fattore dominante nei costi di un sistema di lunga vita.

Non esistono ricette semplici per rendere un'applicazione affidabile, scalabile e manutenibile — ma esistono pattern e tecniche ricorrenti, che sono l'oggetto dei capitoli successivi.