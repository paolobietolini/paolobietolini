---
title: "Google Tag Manager Server-Side: Implementazione  On-Premise con Docker"
date: 2025-12-12
lang: it
description: "Implementare GTM Server-Side on-premise con Docker: setup container, configurazione DNS, reverse proxy Caddy, SSL automatico e deployment zero-downtime."
tags: [server-side, gtm, docker]
---

## Introduzione

Google Tag Manager Server-Side su Google Cloud Platform costa tipicamente 50-150 Euro al mese per traffico medio-alto.
Per molte aziende, questo si traduce in migliaia di Euro all'anno solo per il tracking.

Esiste un'alternativa: implementare GTM Server-Side su infrastruttura self-hosted.
Questa soluzione offre:

- **Riduzione costi**: VPS da $5-20/mese vs cloud managed
- **Compliance on-premise**: Essenziale per settori regolamentati (banking, healthcare, finance)
- **Controllo totale**: Zero dipendenza da rate limit o pricing changes di terze parti
- **Scalabilità prevedibile**: Costi fissi, nessuna sorpresa a fine mese

Questa guida tecnica mostra come implementare GTM Server-Side usando Docker su VPS o server on-premise, con focus su affidabilità, manutenibilità e costi contenuti.

**Quando ha senso questa soluzione:**

- Traffico medio-alto (>100k pageviews/mese) dove i costi GCP diventano significativi
- Necessità di mantenere dati on-premise per compliance
- Budget IT che preferisce CAPEX prevedibile a OPEX variabile
- Team tecnico in grado di gestire infrastruttura Docker

**Per chi è questa guida:**

- IT Manager che valutano alternative a soluzioni cloud managed
- DevOps Engineer che devono implementare soluzioni on-premise
- Consulenti che cercano opzioni cost-effective per clienti
- Data Engineer responsabili dell'infrastruttura di tracking

## Requisiti

Questo articolo dà per scontata la conoscenza di cosa sia Google Tag Manager Server Side. In caso contrario, ti rimando a [questo articolo](/posts/gtm-server-side-panoramica/).

- **CPU e Memoria**

  Sebbene non abbia trovato una documentazione ufficiale sulle risorse minime da utilizzare, in [questa guida](https://developers.google.com/tag-platform/tag-manager/server-side/cloud-run-setup-guide?provisioning=automatic) si fa riferimento a un'istanza di Cloud Run con 1 vCPU e 500 MB di RAM.

  Le mie istanze di GTM server-side, al momento al minimo, stanno consumando circa 200 MB di RAM.

  Quindi diciamo che le caratteristiche menzionate da Google possono andare bene.

  Chiaramente, per un sito ad alto traffico, servono più CPU e più memoria.

  Nell'articolo parlerò principalmente della mia implementazione per questo blog, la scalabilit&agrave; è lasciata all'utente. [In fondo](#scalabilit%C3%A0), ad ogni modo, ci sono delle osservazioni a riguardo.

- Docker o Docker Compose
- Caddy o un reverse proxy
- Tag Manager, contenitore Web e Server
- Sottodominio

## Setup Iniziale

### Contenitore Tag Manager

Per utilizzare il tagging lato server, crea un nuovo contenitore del server di Tag Manager:

- Fai clic su Account > menu Altre azioni accanto al nome account pertinente.
- Scegli Crea contenitore.
- In Piattaforma di destinazione, scegli Server.
- Fai clic su Crea.

Durante o dopo aver creato il contenitore Server clicca sull'ID dello stesso in alto a destra (GTM-12345), scegli l'opzione _Provisioning Manuale_. Verrà mostrata una stringa in Base64 simile a questa:
`SWYgeW91IGRlY3JpcHRlZCB0aGlzLCBjb21lIGFuZCBzYXkgSGkhIG9uIExpbmtlZGluIDop`
![Finestra "Install Google Tag Manager" con l'opzione di provisioning manuale selezionata e la stringa Container Config da copiare](/images/blog/2025/sgtm-manual-provisioning.webp)

Copiala, la utilizzeremo in seguito.

Questa stringa, decriptata, restituisce i seguenti dati:

```
id=GTM-12345
env=1
auth=KqmEMI8P@cwLGh4GF8YMb
```

Ovvero i riferimenti al contenitore che verranno passati successivamente all'immagine Docker.

## Configurazione DNS e sottodomini

Per il deploy di Google Tag Manager Server Side utilizzeremo due sottodomini: uno che farà da endpoint (o destinazione) dei dati inviati dal contenitore Web, e un altro impiegato internamente per generare l'anteprima.

Per questo articolo verrà impiegato il dominio fittizio `ecommerce.comm`.

Nel tuo gestore DNS crea due record A (e AAAA se utilizzi IPv6) che puntino all'IP del tuo server dove il nome del record sarà il sottodominio che vorrai utilizzare:

| Type | Name         | IPv4        | Proxy? |
| ---- | ------------ | ----------- | ------ |
| A    | sgtm         | 203.0.113.0 | No     |
| A    | sgtm-preview | 203.0.113.0 | No     |

> 💡
> L'emissione di certificati HTTPS, se si utilizza Caddy, è automatica, altrimenti dovrai provvedere a questo aspetto. Tag Manager si aspetta il protocollo HTTPS.

Per questa implementazione saranno necessarie _almeno_ due istanze Docker separate:

- Server di anteprima
- Server di tagging

Entrambi i server utilizzano la stessa immagine Docker presente a `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable`.

## Implementazione Docker

### Variabili d'ambiente

Crea il file `.env` dal quale Docker prenderà i valori delle variabili in fase di creazione del container.

In questo file inseriremo la variabile `CONTAINER_CONFIG`, che abbiamo trovato dopo aver creato il [contenitore server](#contenitore-tag-manager) e la variabile `PREVIEW_SERVER_URL`, ovvero il sottodominio relativo al server di anteprima.

Se sei in un ambiente Unix-like (Linux o macOS), da terminale esegui:

```bash
echo "IMAGE=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable" >> .env
echo "CONTAINER_CONFIG=SWYgeW91IGRlY3JpcHRlZCB0aGlzLCBjb21lIGFuZCBzYXkgSGkhIG9uIExpbmtlZGluIDop" >> .env
echo "PREVIEW_SERVER_URL=https://sgtm-preview.ecommerce.comm" >> .env
```

Per Windows (PowerShell) i comandi sono:

```powershell
Add-Content .env "IMAGE=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable"
Add-Content .env "CONTAINER_CONFIG=SWYgeW91IGRlY3JpcHRlZCB0aGlzLCBjb21lIGFuZCBzYXkgSGkhIG9uIExpbmtlZGluIDop"
Add-Content .env "PREVIEW_SERVER_URL=https://sgtm-preview.ecommerce.comm"
```

Oppure per Windows (Command Prompt):

```cmd
echo IMAGE=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable >> .env
echo CONTAINER_CONFIG=SWYgeW91IGRlY3JpcHRlZCB0aGlzLCBjb21lIGFuZCBzYXkgSGkhIG9uIExpbmtlZGluIDop >> .env
echo PREVIEW_SERVER_URL=https://sgtm-preview.ecommerce.comm >> .env
```

> 💡
> I valori nel file `.env` saranno diversi rispetto a quelli utilizzati in questo esempio, eccetto per la variabile `IMAGE`

### Server di anteprima

Nel tuo file Docker Compose inserisci quanto segue:

```yaml
gtm_preview:
  image: ${IMAGE}
  container_name: sgtm-preview
  environment:
    CONTAINER_CONFIG: ${CONTAINER_CONFIG}
    RUN_AS_PREVIEW_SERVER: 'true'
  restart: always
  ports:
    - '127.0.0.1:8082:8080'
```

### Server di tagging

Il cluster del/dei server di tracking è l'endpoint verso il quale mandare i dati e il punto di ingresso verso il server di anteprima, verso il quale viene eseguito un proxy.
In poche parole le richieste che arrivano al server di tagging vengono reindirizzate al server di anteprima, e smistate verso gli altri endpoint (Google Ads, GA4, Meta etc).
Infatti le variabili obbligatorie per questo server sono `CONTAINER_CONFIG` e `PREVIEW_SERVER_URL`.
A seguire, lo snippet da inserire nel file Docker Compose

```yaml
gtm_production:
  image: ${IMAGE}
  container_name: sgtm-prod
  environment:
    CONTAINER_CONFIG: ${CONTAINER_CONFIG}
    PREVIEW_SERVER_URL: ${PREVIEW_SERVER_URL}
  restart: always
  ports:
    - '127.0.0.1:8081:8080'
```

> 💡
> Le porte esposte sull'host sono `8081` e `8082`, puoi cambiarle in base alle tue necessità.
> Nota come stia utilizzando `127.0.0.1` per il loopback su `localhost` (`::1` su IPv6). Misura utile per non esporre suddette porte a tutta l'Internet e non aprirle dal firewall. Utilizzeremo un reverse proxy proprio per questo.

Dopo aver terminato la configurazione del file Docker Compose esegui:
`docker compose up -d` per (ri)creare e far partire i container

### Health Check

Per controllare che i container siano online esegui due chiamate a `localhost` tramite `curl`:

```bash
curl -i localhost:8081/healthz

HTTP/1.1 200 OK
Content-Type: text/plain
Date: Sat, 24 Oct 1987 12:00:00 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked
```

```bash
curl -i localhost:8082/healthy

HTTP/1.1 200 OK
Content-Type: text/plain
Date: Sun, 16 Sept 1990 12:00:00 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked
```

Puoi anche eseguire `docker ps` per accertarti che i container siano sani e stiano andando.

| CONTAINER ID | IMAGE                                                | COMMAND                | CREATED  | STATUS                | PORTS                    | NAMES        |
| ------------ | ---------------------------------------------------- | ---------------------- | -------- | --------------------- | ------------------------ | ------------ |
| cGFvbG8K     | gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable | "/nodejs/bin/node se…" | Ages ago | Up 19 hours (healthy) | 127.0.0.1:8081->8080/tcp | sgtm-prod    |
| YmlldG9saW5p | gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable | "/nodejs/bin/node se…" | Tomorrow | Up 19 hours (healthy) | 127.0.0.1:8082->8080/tcp | sgtm-preview |

> 💡
> Il container Docker include un comando di controllo di integrità predefinito, `HEALTHCHECK CMD ["/nodejs/bin/node", "/app/health_checker_bin.js"]`, che esegue query sull'endpoint `/healthy` periodicamente.<br>Se utilizzi il controllo di integrità di Docker, puoi modificare le impostazioni seguendo le [istruzioni](https://docs.docker.com/reference/dockerfile/#healthcheck).

## Configurazione Reverse Proxy

È giunto il momento di esporre i nostri container su Internet, per farlo utilizzeremo Caddy (qualsiasi altro reverse proxy va bene, l'importante è che, come accennato, vengano emessi certificati TLS/SSL).

### Setup Caddy

Ho configurato il mio Caddyfile come segue

```json
{
        # Email per l'emissione dei certificati TLS/SSL tramite Let's Encrypt
        email server@ecommerce.comm
}

sgtm-preview.ecommerce.comm {
        reverse_proxy localhost:8082 {
                # Passa gli header della richiesta originale al container Docker
                header_up X-Real-IP {remote_host}
                header_up X-Forwarded-For {remote_host}
                header_up X-Forwarded-Proto {scheme}
                header_up Host sgtm-preview.ecommerce.comm

                # Timeout per le connessioni HTTP
                transport http {
                        read_timeout 30s
                        write_timeout 30s
                }
        }

        # Comprime le risposte HTTP utilizzando zstd (preferito) o gzip
        # Riduce la banda utilizzata e velocizza il caricamento
        encode zstd gzip

        # Salva i log delle richieste in formato JSON
        # Utile per debugging e analisi del traffico
        log {
                output file /var/log/caddy/sgtm-preview.log
                format json
        }
}

sgtm.ecommerce.comm {
        reverse_proxy localhost:8081 {
                # Passa gli header della richiesta originale al container Docker
                header_up X-Real-IP {remote_host}
                header_up X-Forwarded-For {remote_host}
                header_up X-Forwarded-Proto {scheme}
                header_up Host sgtm.ecommerce.comm

                # Timeout per le connessioni HTTP
                transport http {
                        read_timeout 30s
                        write_timeout 30s
                }
        }

        # Comprime le risposte HTTP utilizzando zstd (preferito) o gzip
        # Riduce la banda utilizzata e velocizza il caricamento
        encode zstd gzip

        # Salva i log delle richieste in formato JSON
        # Utile per debugging e analisi del traffico
        log {
                output file /var/log/caddy/sgtm-tagging.log
                format json
        }
}
```

Dopo aver salvato le modifiche esegui questo comando per formattare e caricare le nuove impostazioni.
`sudo caddy fmt --overwrite && sudo caddy reload`

> 💡
> Il file di configurazione utilizza alcune direttive utili:
>
> - `encode`: comprime le risposte HTTP per ridurre l'utilizzo di banda
> - `log`: registra tutte le richieste in file JSON per debugging e monitoraggio
> - `header_up`: passa gli header originali (IP, host, protocollo) ai container Docker

## Validazione e Test

### Configurare l'URL del contenitore

In Tag Manager, vai al contenitore del server.
In **Amministrazione > Impostazioni contenitore**, inserisci l'URL del server di tagging (`sgtm.ecommerce.comm`) nel campo **URL contenitore server** e fai clic su **Salva**.

![Impostazioni del contenitore GTM con piattaforma di destinazione Server e l'URL del server di tagging inserito nel campo dedicato](/images/blog/2025/sgtm-container_settings.webp)

> 💡
> Se hai mappato più sottodomini per il server di tagging dovrai eseguire il reverse proxy di ognuno di essi verso la stessa porta in `localhost`.
> Ricorda di aggiungerli in Tag Manager, nella sezione **Amministrazione > Contenitore**

### Test con modalità anteprima

Nel workspace di Tag Manager, visualizza l'anteprima del container facendo clic su Anteprima e verifica che la pagina di anteprima venga caricata. In un'altra scheda del browser, vai a qualsiasi percorso nell'URL contenitore del server.
Puoi eseguire una richiesta di test manualmente cliccando i tre puntini verticali in alto a destra **⋮** e selezionare **Invia richieste manualmente**.

Nel terminale incolla il comando `curl`

```bash
curl -H 'x-gtm-server-preview: hdxaG9Y6cXFVvzB9EkZTqmm26Nm4WxhWynRFedYqsECfzUtraIERiquqJjfjzlqaizw=' 'https://sgtm.ecommerce.comm/g/collect?v=2&en=page_view&tid=G-1234&cid=123.456&dl=https%3A%2F%2Fexample.com%2F'
```

Se la pagina di anteprima mostra la richiesta inviata, allora tutto è configurato correttamente.

> 💡
> Accertati che la pagina di anteprima mostri l'URL del server di tagging `sgtm.ecommerce.comm`

## Troubleshooting

#### Container non si avvia

**Sintomo:** `docker ps` non mostra i container o status è "Restarting"

**Soluzione:**

```bash
# Controlla i log
docker logs sgtm-prod
docker logs sgtm-preview

# Verifica variabili d'ambiente
docker inspect sgtm-prod | grep -A 10 Env
```

Cause comuni:

- Variabile `CONTAINER_CONFIG` errata o mancante
- Porta già in uso (cambia mapping in docker-compose)
- Immagine corrotta (rifai `docker pull`)

#### Certificati SSL non emessi

**Sintomo:** Browser mostra errore SSL, Caddy non riesce a ottenere certificati

**Soluzione:**

```bash
# Verifica log Caddy
journalctl -u caddy -f

# Controlla DNS
dig sgtm.ecommerce.comm
nslookup sgtm.ecommerce.comm
```

Cause comuni:

- DNS non punta all'IP corretto
- Porte 80/443 non aperte nel firewall
- Record DNS ancora in propagazione (attendi 24-48h)

#### Preview non funziona

**Sintomo:** Modalità anteprima in GTM non mostra richieste

**Soluzione:**

Verifica che l'header `x-gtm-server-preview` sia presente nella richiesta:

```bash
curl -H 'x-gtm-server-preview: TUO_TOKEN_QUI' \
  'https://sgtm.ecommerce.comm/g/collect?v=2&en=page_view'
```

Controlla nei log di Caddy che le richieste arrivino:

```bash
tail -f /var/log/caddy/sgtm-tagging.log | grep preview
```

Cause comuni:

- `PREVIEW_SERVER_URL` configurato male nel container prod
- Container preview non in ascolto sulla porta corretta
- Caddy non passa correttamente gli header (`header_up`)

#### Errore 502 Bad Gateway

**Sintomo:** Caddy restituisce 502, GTM non risponde

**Soluzione:**

```bash
# Verifica che i container siano up
docker ps

# Testa direttamente localhost
curl -i localhost:8081/healthz

# Controlla timeout in Caddy
grep timeout /etc/caddy/Caddyfile
```

Cause comuni:

- Container crashato o non avviato
- Timeout troppo basso in Caddy (aumenta a 60s se necessario)
- Container in overload (scala orizzontalmente)

#### Tag non vengono inviati alle destinazioni

**Sintomo:** GTM funziona ma i dati non arrivano a GA4/Ads/Meta

**Soluzione:**

Verifica la configurazione del container Web in GTM:

- Server URL deve puntare a `https://sgtm.ecommerce.comm`
- Tag lato client devono essere configurati per inviare a server-side
- Controlla in GTM Preview che i tag server-side si attivino

Controlla i log del container:

```bash
docker logs sgtm-prod | grep error
```

## Scalabilit&agrave;

L'implementazione descritta in questo articolo è pensata per blog e siti a traffico medio-basso. Per la maggior parte dei casi, un singolo server di tagging e uno di anteprima sono più che sufficienti.

### Quando scalare

Se il tuo sito riceve traffico continuo e consistente, potresti aver bisogno di scalare orizzontalmente. Google raccomanda di configurare i server di tagging come **cluster** piuttosto che come singola istanza, per garantire migliore disponibilità e prestazioni.

**Nota importante:** ogni istanza del server deve avere **al massimo 1 vCPU**. vCPU aggiuntive non vengono utilizzate e influiscono negativamente sulla scalabilit&agrave; automatica. È preferibile avere 3 istanze con 1 vCPU ciascuna piuttosto che una singola istanza con 3 vCPU.

### Opzioni per il clustering

Per creare un cluster di server di tagging hai due opzioni principali:

- **Docker Swarm**: più semplice da configurare, ideale se stai già usando Docker Compose. Permette di scalare i servizi con un singolo comando e gestisce automaticamente il load balancing.
- **Kubernetes**: più complesso ma più potente, consigliato per infrastrutture enterprise o se hai già familiarità con K8s. Offre orchestrazione avanzata e self-healing automatico.

Qualsiasi sia la soluzione scelta, ricorda che ogni istanza del cluster deve essere configurata con le **stesse variabili d'ambiente**: `CONTAINER_CONFIG` e `PREVIEW_SERVER_URL` devono essere identiche su tutti i nodi.

### Server di anteprima

Il server di anteprima **non ha bisogno di scalare**. Una singola istanza è sufficiente poiché viene utilizzata solo durante il debug e la configurazione dei tag, non per il traffico di produzione.

### Load balancer

Se implementi un cluster, dovrai configurare un load balancer davanti ai server di tagging per distribuire il traffico. Caddy può gestire questa funzionalità nativamente, oppure puoi utilizzare nginx, HAProxy o il load balancer del tuo cloud provider.

In Docker Swarm, il load balancing interno è gestito automaticamente. In Kubernetes, puoi usare un Service di tipo LoadBalancer o un Ingress Controller.

## Oltre la Base: Same-Origin e Tag Gateway

Questa implementazione self-hosted apre la strada a configurazioni più avanzate che approfondirò in articoli successivi.

**Same-Origin Implementation**: una volta che hai il controllo completo del tuo server GTM, puoi configurarlo per servire il contenitore dallo stesso dominio del tuo sito (es. `ecommerce.comm/gtm` invece di `sgtm.ecommerce.comm`). Questo approccio migliora significativamente la privacy, riduce i problemi con gli ad-blocker e rende il tracking praticamente indistinguibile dal traffico normale del sito.

**Google Tag Gateway**: con il server self-hosted puoi implementare il Tag Gateway, un layer aggiuntivo che semplifica la gestione delle destinazioni (Google Ads, GA4, Meta) e ottimizza l'invio dei dati. Particolarmente utile se gestisci multiple proprietà o hai bisogno di routing complessi dei dati.

Entrambe queste configurazioni meritano articoli dedicati, ma è importante sapere che il controllo totale sul server rende possibile implementarle senza limitazioni.

## How-to

### Aggiornamenti

Quando Google Tag Manager notifica una nuova versione del contenitore, è necessario aggiornare l'immagine Docker.

#### Procedura base

Per un aggiornamento standard con breve interruzione del servizio:

```bash
docker compose down
docker pull gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable
docker compose up -d
```

**Cosa succede:**

1. `docker compose down` → Ferma ed elimina i container attivi
2. `docker pull` → Scarica l'ultima versione dell'immagine GTM
3. `docker compose up -d` → Ricrea i container con la nuova immagine

> 💡
> Verifica che nel tuo `docker-compose.yml` l'immagine sia esattamente `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable`, altrimenti Docker userà quella definita nel file ignorando il pull manuale.

#### Aggiornamento automatico

Per forzare il pull automatico senza comandi separati:

```bash
docker compose up -d --pull always
```

#### Verifica dell'aggiornamento

Controlla che la nuova immagine sia in uso:

```bash
docker images | grep gtm-cloud-image
```

Verifica che i container siano sani:

```bash
docker ps
curl -i localhost:8081/healthz
curl -i localhost:8082/healthy
```

#### Zero-downtime deployment (opzionale)

Se non puoi permetterti interruzioni del servizio, hai due approcci:

**Opzione 1: Istanze parallele**

Definisci due servizi nel `docker-compose.yml`:

```yaml
services:
  gtm_prod_v1:
    image: gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable
    container_name: sgtm-prod-v1
    ports:
      - '127.0.0.1:8081:8080'
    # ... resto configurazione

  gtm_prod_v2:
    image: gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable
    container_name: sgtm-prod-v2
    ports:
      - '127.0.0.1:8083:8080'
    # ... stessa configurazione
```

Aggiorna e avvia la v2:

```bash
docker compose pull gtm_prod_v2
docker compose up -d gtm_prod_v2
```

Testa che funzioni, poi switcha il traffico in Caddy verso la porta 8083. Una volta verificato:

```bash
docker compose stop gtm_prod_v1
docker compose rm gtm_prod_v1
```

**Opzione 2: Blue/Green deployment**

Crea due file compose separati (`docker-compose.blue.yml` e `docker-compose.green.yml`) e alterna tra loro:

```bash
# Deploy green
docker compose -f docker-compose.green.yml up -d

# Testa e switcha traffico in Caddy

# Ferma blue
docker compose -f docker-compose.blue.yml down
```

---

### Manutenzione Ordinaria

#### Pulizia immagini Docker

Docker accumula immagini vecchie nel tempo. Per pulire quelle inutilizzate:

```bash
# Rimuove immagini non utilizzate
docker image prune -a

# Pulizia completa (immagini, container, volumi, network)
docker system prune -a
```

> ⚠️
> Attenzione: `docker system prune -a` elimina TUTTO ciò che non è in uso, inclusi volumi e network personalizzati. Usa con cautela.

#### Rotazione log

I log di Caddy crescono indefinitamente. Configura la rotazione automatica creando `/etc/logrotate.d/caddy`:

```
/var/log/caddy/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    postrotate
        systemctl reload caddy
    endscript
}
```

Oppure pulisci manualmente:

```bash
# Svuota i log mantenendo i file
truncate -s 0 /var/log/caddy/sgtm-tagging.log
truncate -s 0 /var/log/caddy/sgtm-preview.log
```

#### Monitoraggio risorse

Controlla periodicamente il consumo di risorse:

```bash
# Statistiche real-time dei container
docker stats

# Consumo disco Docker
docker system df

# Log dei container in tempo reale
docker logs -f sgtm-prod
```

Se noti consumi anomali, controlla i log di GTM in Caddy per identificare traffico inaspettato.

### Backup e Restore

#### Cosa backuppare

File essenziali da salvare:

```bash
# Crea directory backup
mkdir -p ~/gtm-backup

# Copia configurazioni
cp .env ~/gtm-backup/
cp docker-compose.yml ~/gtm-backup/
cp /etc/caddy/Caddyfile ~/gtm-backup/

# Opzionale: backup log recenti
cp /var/log/caddy/sgtm-*.log ~/gtm-backup/
```

#### Backup automatico

Crea uno script `/usr/local/bin/backup-gtm.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backup/gtm/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

cp ~/.env "$BACKUP_DIR/"
cp ~/docker-compose.yml "$BACKUP_DIR/"
cp /etc/caddy/Caddyfile "$BACKUP_DIR/"

# Comprimi e pulisci backup vecchi di 30+ giorni
tar -czf "$BACKUP_DIR.tar.gz" -C /backup/gtm "$(date +%Y-%m-%d)"
rm -rf "$BACKUP_DIR"
find /backup/gtm -name "*.tar.gz" -mtime +30 -delete
```

Aggiungi a crontab per esecuzione settimanale:

```bash
crontab -e
# Aggiungi: ogni domenica alle 3:00
0 3 * * 0 /usr/local/bin/backup-gtm.sh
```

#### Restore rapido

In caso di disaster, ripristina da backup:

```bash
# Ripristina file configurazione
cp ~/gtm-backup/.env ~/
cp ~/gtm-backup/docker-compose.yml ~/
cp ~/gtm-backup/Caddyfile /etc/caddy/

# Ricrea container
docker compose down
docker compose up -d

# Ricarica Caddy
sudo caddy reload
```

> 💡
> Il `CONTAINER_CONFIG` nel file `.env` è legato al contenitore GTM. Se ricrei il contenitore Server in Google Tag Manager dovrai aggiornare questa stringa.

### Load Balancer

Quando usi Google Tag Manager Server-Side (GTM SS) e attivi la modalità anteprima, il server container impiega più tempo del normale per rispondere,fino a 20 secondi.
La modalità preview deve:

- stabilire una connessione continua con il server GTM,
- ricevere eventi e log in tempo reale.

Se il CDN o il load balancer interrompe la connessione troppo presto, tutto si interrompe.

In Caddy, nel paragrafo [dedicato](#setup-caddy), abbiamo impostato il timeout a 30 secondi.

---

## Conclusioni

Terminato questo lunghissimo, e spero esaustivo, articolo.
Ho voluto racchiudere tutto ciò che ho imparato in questa esperienza.

Tra le domande che mi sono fatto con maggior frequenza durante questa implementazione, una è stata: _ne vale davvero la pena?_

La risposta, nonostante le difficoltà iniziali, è **sì**, per vari motivi:

**Controllo e resilienza**: Internet come la conosciamo sta cambiando. Sempre meno aziende controllano sempre più infrastrutture. Comodo? Sì. Ma ci espone a rischi concreti come dimostrano gli outage di AWS e Cloudflare citati all'inizio. Ridurre le dipendenze da servizi terzi significa avere un'alternativa quando gli altri vanno giù.

**Conoscenza**: La complessità ripaga con competenze che nessuno può toglierti. Nell'economia della delega totale, capire davvero come funzionano le cose sotto il cofano è un vantaggio competitivo raro.

**Risparmio**: I costi iniziali (VPS/Server on-premise + tempo) si ammortizzano rapidamente. La mia VPS da 5€/mese fa girare questo sito, GTM server-side, e altri 4-5 servizi. Fare la stessa cosa su Google Cloud? Minimo 50-100€/mese, più il rischio di aumenti improvvisi.

La soddisfazione finale? Immensa, come promesso all'inizio.

Se hai domande o vuoi condividere la tua implementazione, scrivimi su [LinkedIn](https://www.linkedin.com/in/paolobietolini/).
