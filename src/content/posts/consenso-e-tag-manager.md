---
title: "Consenso e tag manager: cosa succede davvero"
date: 2026-07-14
lang: it
description: Cosa fa il tag manager prima e dopo il clic sul banner dei cookie.
---

Il banner dei cookie sembra un dettaglio grafico. In realtà decide quali richieste partono dal browser, e in che momento. Vale la pena capire cosa succede sotto.

## Prima del clic

Quando la pagina si carica, l'utente non ha ancora scelto nulla. Il tag manager parte comunque, ma con uno stato di consenso di default: di solito tutto negato.

In questo stato i tag che rispettano il consenso o non partono affatto, o partono in una modalità ridotta, senza cookie e senza identificativi. È qui che si gioca la conformità: se un tag scrive un cookie prima della scelta, il problema c'è già, qualunque cosa faccia il banner dopo.

## Il clic

Quando l'utente accetta o rifiuta, la piattaforma di gestione del consenso aggiorna lo stato. Il tag manager riceve l'aggiornamento come un evento, esattamente come un qualsiasi `dataLayer.push`.

Da quel momento i trigger vengono valutati con il nuovo stato. I tag che erano in attesa possono partire, quelli negati restano fermi.

## Dopo il clic

Il punto delicato è l'ordine. Se l'evento di pagina viene elaborato prima dell'aggiornamento del consenso, quella pagina viene misurata con lo stato vecchio. Se viene elaborato dopo, con quello nuovo.

Per questo, quando controllo un'implementazione, guardo sempre tre cose:

1. lo stato di default, prima di qualsiasi interazione;
2. l'evento di aggiornamento, e quando arriva rispetto alla visualizzazione di pagina;
3. le richieste di rete, prima e dopo la scelta.

Le richieste di rete sono la prova finale. Il pannello del tag manager dice cosa avrebbe dovuto succedere; il pannello di rete dice cosa è successo davvero.
