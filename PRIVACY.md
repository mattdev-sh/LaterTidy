# LaterTidy privacy policy

Last updated: 5 November 2026

[Italiano](#informativa-sulla-privacy-di-latertidy)

LaterTidy is a browser extension that helps you manage your Watch Later list for YouTube. LaterTidy is not affiliated with, endorsed by or sponsored by YouTube or Google.

## Short version

LaterTidy has no developer-operated servers or analytics. Your local notes, categories and settings stay in your browser. The developer never receives your playlist or local data.

## What LaterTidy connects to

LaterTidy sends API requests to youtube.com, using the session you already have when you are signed in to YouTube. It does this to:

- read your Watch Later list
- remove and reorder videos in that list
- add videos to your other playlists, when you ask it to, which also means reading your playlist names

These requests go directly from your browser to YouTube, as they do when you use the YouTube site. YouTube's own privacy policy applies to them. LaterTidy never sees or stores your Google password.

Video thumbnails load from YouTube image hosts such as `i.ytimg.com`. The sign-in link opens Google Accounts (`accounts.google.com`) when you choose it. These services receive the browser requests needed to display their content or sign you in.

LaterTidy does not send your notes or categories to YouTube, or to anyone else.

## What LaterTidy stores

Everything is kept locally in your browser, in `chrome.storage.local`:

- a cached copy of your video list
- the categories and notes you add to videos
- your settings
- playlist entry IDs for removals that could not be sent before the page closed

Cached playlists, categories, notes and pending removals are separated by a hash of the YouTube account ID. If that ID is unavailable, the session index is used as a fallback. Settings are shared across accounts in the same Chrome profile.

## What LaterTidy does not do

- It does not collect, sell or transfer your data.
- It does not use analytics, tracking, advertising or crash reporting.
- It does not load remote code.

## Your notes and categories stay on this device

Notes and categories stay in this browser. They do not sync across devices or Chrome profiles, and they are lost if you remove the extension without a backup. Exporting is the backup: the export file is saved wherever you choose, and it is yours to look after.

## Removing your data

Use "Clear local data" in LaterTidy's settings, or uninstall the extension. Either one removes what LaterTidy has stored in your browser. Neither one changes your playlists on YouTube.

## Changes

If this policy changes, the new version will be published here with a new date.

## Contact

[Matteo Mangia (@mattdev-sh)](https://github.com/mattdev-sh)

---

# Informativa sulla privacy di LaterTidy

Ultimo aggiornamento: 5 novembre 2026

[English](#latertidy-privacy-policy)

LaterTidy è un'estensione del browser che ti aiuta a gestire la playlist Guarda più tardi per YouTube. LaterTidy non è affiliata a YouTube o Google, né approvata o sponsorizzata da queste società.

## In breve

LaterTidy non ha server gestiti dallo sviluppatore e non usa strumenti di analisi. Note, categorie e impostazioni locali restano nel browser. Lo sviluppatore non riceve la tua playlist né i tuoi dati locali.

## Con cosa si collega LaterTidy

LaterTidy invia richieste API a youtube.com, usando la sessione già attiva quando hai effettuato l'accesso a YouTube. Lo fa per:

- leggere la tua playlist Guarda più tardi
- rimuovere e riordinare i video di quella playlist
- aggiungere video alle tue altre playlist, quando lo chiedi tu, il che comporta anche leggere i nomi delle playlist

Queste richieste partono direttamente dal tuo browser verso YouTube, come quando usi il sito di YouTube, e sono soggette all'informativa sulla privacy di YouTube. LaterTidy non vede e non salva la tua password Google.

Le miniature dei video vengono caricate da host di immagini di YouTube, come `i.ytimg.com`. Il link di accesso apre Google Accounts (`accounts.google.com`) quando lo scegli. Questi servizi ricevono le richieste del browser necessarie per mostrare i contenuti o effettuare l’accesso.

LaterTidy non invia le tue note o categorie a YouTube né a nessun altro.

## Cosa salva LaterTidy

Tutto viene conservato localmente nel browser, in `chrome.storage.local`:

- una copia in cache dell'elenco dei video
- le categorie e le note che aggiungi ai video
- le tue impostazioni
- gli ID delle voci della playlist per le rimozioni che non è stato possibile inviare prima della chiusura della pagina

Playlist in cache, categorie, note e rimozioni in attesa sono separate tramite un hash dell'ID account YouTube. Se l'ID non è disponibile, viene usato l'indice della sessione. Le impostazioni sono condivise tra gli account dello stesso profilo Chrome.

## Cosa non fa LaterTidy

- Non raccoglie, non vende e non trasferisce i tuoi dati.
- Non usa strumenti di analisi, tracciamento, pubblicità o segnalazione degli errori.
- Non carica codice remoto.

## Note e categorie restano su questo dispositivo

Note e categorie restano in questo browser. Non si sincronizzano tra dispositivi o profili Chrome e, se rimuovi l'estensione senza un backup, vanno perse. Il backup è l'esportazione: il file viene salvato dove scegli tu ed è tua responsabilità conservarlo.

## Eliminare i dati

Usa "Cancella dati locali" nelle impostazioni di LaterTidy, oppure disinstalla l'estensione. In entrambi i casi viene rimosso ciò che LaterTidy ha salvato nel browser. Le tue playlist su YouTube non cambiano.

## Modifiche

Se questa informativa cambia, la nuova versione verrà pubblicata qui con una nuova data.

## Contatti

[Matteo Mangia (@mattdev-sh)](https://github.com/mattdev-sh)
