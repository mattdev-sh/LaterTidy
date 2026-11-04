# Chrome Web Store listing

Copy for the Developer Dashboard. Check the placeholders and the feature list against the final build before submitting.

## Name

LaterTidy: Watch Later manager

## Short description

Field limit: 132 characters.

**EN**

Find, sort out and bulk-remove videos in your Watch Later list for YouTube. Data stays in your browser. Not affiliated with YouTube.

**IT**

Cerca, organizza e rimuovi in blocco i video di Guarda più tardi per YouTube. I dati restano nel browser. Non affiliata a YouTube.

## Long description

### EN

LaterTidy is a manager for your Watch Later list for YouTube. If the list has grown to hundreds of videos, it helps you see what is in there, decide what to keep and clear the rest.

Find videos
- Search across titles, channels and your own notes.
- Filter by length with a duration histogram.
- See how much watch time is left, in total and for the current selection.

Organize
- Sort videos into your own categories.
- Add a note to any video.
- Add videos to your other playlists.

Clean up
- Select several videos and remove them together, with a progress indicator.
- Undo the latest removal for up to 8 seconds. Another removal batch or navigation commits it early.

Plan what to watch
- Set a time budget and get a queue of videos that fits it.

Work your way
- Use keyboard shortcuts for common actions.
- Export your data and import it again.
- LaterTidy follows YouTube's light or dark theme and its language. The interface is available in English and Italian.

Your data
LaterTidy has no servers, no analytics and no third parties. API requests go to youtube.com using your existing session. Thumbnails load from YouTube image hosts, and the sign-in link opens Google Accounts. Your cached list, categories, notes and settings are stored locally in your browser. Notes and categories don't sync across devices, so use export as your backup. You can remove everything with "Clear local data" or by uninstalling the extension.

LaterTidy is an independent project. It is not affiliated with, endorsed by or sponsored by YouTube or Google.

### IT

LaterTidy ti aiuta a gestire la playlist Guarda più tardi per YouTube. Se la lista è arrivata a centinaia di video, ti permette di vedere cosa contiene, scegliere cosa tenere ed eliminare il resto.

Trova i video
- Cerca tra titoli, canali e le tue note.
- Filtra per durata con un istogramma.
- Vedi quanto tempo di visione resta, in totale e per la selezione corrente.

Organizza
- Dividi i video in categorie tue.
- Aggiungi una nota a qualsiasi video.
- Aggiungi i video alle tue altre playlist.

Fai pulizia
- Seleziona più video e rimuovili insieme, seguendo l'avanzamento.
- Puoi annullare l’ultima rimozione per un massimo di 8 secondi. Una nuova rimozione o la navigazione la conferma prima.

Scegli cosa guardare
- Indica quanto tempo hai a disposizione e ottieni una coda di video adatta.

Lavora come preferisci
- Usa le scorciatoie da tastiera per le azioni più comuni.
- Esporta i tuoi dati e importali di nuovo.
- LaterTidy segue il tema chiaro o scuro di YouTube e la sua lingua. L'interfaccia è disponibile in italiano e in inglese.

I tuoi dati
LaterTidy non ha server, non usa strumenti di analisi e non coinvolge terze parti. Le richieste API vanno a youtube.com usando la sessione già attiva. Le miniature vengono caricate dagli host di immagini di YouTube e il link di accesso apre Google Accounts. L'elenco in cache, le categorie, le note e le impostazioni sono salvati localmente nel browser. Note e categorie non si sincronizzano tra dispositivi, quindi usa l'esportazione come backup. Puoi eliminare tutto con "Cancella dati locali" o disinstallando l'estensione.

LaterTidy è un progetto indipendente. Non è affiliata a YouTube o Google, né approvata o sponsorizzata da queste società.

## Category

Suggested: Productivity > Tools. Alternative: Lifestyle > Entertainment. Confirm against the options the dashboard shows.

## Language

Default language: English. Add Italian as a second listing language, using the IT copy above.

## Single purpose

LaterTidy has one purpose: to help users manage their YouTube Watch Later playlist, by finding, organizing and removing the videos in it.

## Permission justifications

**`storage`**

Saves the cached Watch Later list, the user's categories and notes, and settings in `chrome.storage.local`, so they persist between sessions. This data never leaves the browser.

**Host permission `https://www.youtube.com/*`**

LaterTidy runs on youtube.com to add its button and manager panel to the page, and uses the user's existing YouTube session to read the Watch Later list, remove and reorder videos in it, and add videos to the user's other playlists. It does not access any other site.

## Remote code

No, LaterTidy does not use remote code. All JavaScript is included in the extension package.

## Data use disclosure

Privacy policy URL: `<privacy policy URL>` (host `PRIVACY.md` publicly and paste the link here)

Contact email: `<contact email>`

| Data type | Answer | Notes |
| --- | --- | --- |
| Personally identifiable information | Not collected | A hash of the YouTube account id is kept locally to separate accounts. It is not transmitted. |
| Health information | Not collected | |
| Financial and payment information | Not collected | |
| Authentication information | Not collected | LaterTidy uses the browser's existing YouTube session. It does not read or store passwords. |
| Personal communications | Not collected | |
| Location | Not collected | |
| Web history | Not collected | LaterTidy does not record browsing. The Watch Later list is covered under website content. |
| User activity | Handled locally only | The user's selections, categories and settings stay in the browser. Not sold, not transferred. |
| Website content | Handled locally only | The Watch Later list, video details and the user's notes stay in the browser. Not sold, not transferred. |

The dashboard form has no "handled locally" option. LaterTidy's position is that nothing leaves the browser, so no data type is collected by the developer. If the form's current wording counts local handling as collection, tick "User activity" and "Website content" and keep the certifications below. Decide this against the live form.

Certifications, all to be confirmed:

- User data is not sold or transferred to third parties, outside the approved use cases.
- User data is not used or transferred for purposes unrelated to the item's single purpose.
- User data is not used or transferred to determine creditworthiness or for lending purposes.

## Screenshot captions

Dashboard size: 1280x800 or 640x400. Use fictional sample data only, and show no real channels, accounts or thumbnails.

| # | EN | IT |
| --- | --- | --- |
| 1 | Your whole Watch Later list, with the time left to watch | Tutta la tua lista Guarda più tardi, con il tempo di visione rimanente |
| 2 | Search titles, channels and your notes | Cerca tra titoli, canali e note |
| 3 | Filter by length with the duration histogram | Filtra per durata con l'istogramma |
| 4 | Remove many videos at once, with up to 8 seconds to undo | Rimuovi molti video insieme, con un massimo di 8 secondi per annullare |
| 5 | Set a time budget and get a queue that fits | Indica il tempo a disposizione e ottieni una coda adatta |
| 6 | Local categories and notes, in light or dark theme | Categorie e note locali, con tema chiaro o scuro |
