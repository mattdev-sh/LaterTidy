export type Lang = 'en' | 'it';
type Plural = { one: string; other: string };
type Entry = string | Plural;

const en = {
  appName: 'LaterTidy', watchLater: 'Watch Later', dialogLabel: 'LaterTidy, Watch Later manager',
  classicView: 'Classic view', search: 'Search title, channel or note', refresh: 'Refresh', settings: 'Settings', help: 'Keyboard shortcuts',
  sort: 'Sort', gridView: 'Grid view', listView: 'List view', openFilters: 'Filters',
  'sort.youtube': 'YouTube order', 'sort.reverse': 'Reverse order', 'sort.shortest': 'Shortest', 'sort.longest': 'Longest',
  'sort.leastRemaining': 'Least time left', 'sort.channel': 'Channel A–Z', 'sort.newest': 'Newest published', 'sort.oldest': 'Oldest published',
  status: 'Status', 'status.all': 'All', 'status.notStarted': 'Not started', 'status.inProgress': 'In progress',
  'status.finished': 'Finished', 'status.unavailable': 'Unavailable', 'status.live': 'Live and upcoming', withNote: 'With note',
  categories: 'Categories', uncategorized: 'No category', newCategory: 'New category', categoryName: 'Category name',
  noCategories: 'None yet. Press c on a video to create one.', editCategory: 'Edit {name}', rename: 'Name', color: 'Color', deleteCategory: 'Delete category',
  deleteCategoryNote: 'Videos stay in Watch Later. Only this label goes.', categoryDeleted: 'Category {name} deleted',
  pickCategories: 'Categories', categoryFilter: 'Find or create', createCategory: 'Create {name}', categoryDot: 'Category: {name}',
  channels: 'Channels', channelSearch: 'Find channel', showAllChannels: 'Show all {n}', noChannels: 'No channels match',
  videoCount: { one: '{n} video', other: '{n} videos' },
  hoursUnit: { one: 'hour', other: 'hours' }, minutesUnit: 'min', timeLeft: 'time left',
  durationAxis: 'Filter by length', histogramLabel: 'Videos by length', handleMin: 'Shortest length', handleMax: 'Longest length', clearRange: 'Clear length filter',
  rangeAny: 'Any length', rangeFrom: '{a} to {b}', barTip: { one: '{n} video, {range}', other: '{n} videos, {range}' },
  budget: 'I have time for', budgetCustom: 'Minutes', budgetCustomLabel: 'Custom minutes', budgetEmpty: 'Nothing fits in {t}. Try a longer time or fewer filters.',
  budgetTotal: '{n} in {t}', anotherPick: 'Another pick', play: 'Play', budgetTitle: 'For the next {t}', cappedNote: 'Queues hold 50 videos, so only the first 50 play.',
  select: 'Select', selectDone: 'Done', selectAll: 'Select all {n}', selectionCount: { one: '{n} selected', other: '{n} selected' }, clearSelection: 'Clear selection',
  outsideFilters: '{n} outside the current filters', selectVideo: 'Select {title}',
  remove: 'Remove', removeAll: 'Remove all {n}', confirmRemove: 'Confirm: remove {n}', undo: 'Undo', undone: 'Restored',
  removed: { one: '{n} removed', other: '{n} removed' }, removing: 'Removing {done} of {total}',
  removeFailed: { one: '{n} not removed: {why}', other: '{n} not removed: {why}' }, retry: 'Retry',
  addToPlaylist: 'Add to playlist', moveOut: 'Remove from Watch Later', loadingPlaylists: 'Loading playlists', noPlaylists: 'No playlists found',
  added: { one: '{n} added to {name}', other: '{n} added to {name}' }, addFailed: { one: '{n} not added to {name}: {why}', other: '{n} not added to {name}: {why}' },
  alreadyIn: 'Already there', 'privacy.PRIVATE': 'Private', 'privacy.PUBLIC': 'Public', 'privacy.UNLISTED': 'Unlisted',
  moveTop: 'Move to top', moveBottom: 'Move to bottom', moved: { one: '{n} moved', other: '{n} moved' }, moveFailed: { one: '{n} not moved: {why}', other: '{n} not moved: {why}' },
  note: 'Note', editNote: 'Note for {title}', notePlaceholder: 'Why you saved this, what to look for', noteHint: 'Saved in this browser only', hasNote: 'Has a note', noteDone: 'Done',
  left: '{t} left', watched: 'Watched', liveNow: 'Live', upcoming: 'Upcoming', unavailableTitle: 'Unavailable video', unknownChannel: 'Unknown channel',
  syncing: '{a} of {b}', syncingCount: '{a} loaded', cancel: 'Cancel', cancelRefresh: 'Stop refresh', refreshFailed: 'Refresh stopped: {why}',
  stale: 'Showing the saved copy',
  'why.auth': 'YouTube rejected the session', 'why.http': 'YouTube returned an error', 'why.network': 'the connection dropped', 'why.parse': 'YouTube sent an unexpected reply', 'why.status': 'YouTube refused the change',
  loggedOutTitle: 'Sign in to see your Watch Later', loggedOutBody: 'LaterTidy reads the list from your YouTube account in this browser.', signIn: 'Sign in',
  emptyTitle: 'Watch Later is empty', emptyBody: 'Videos you save for later land here.',
  noMatchTitle: 'No videos match', noMatchBody: 'Filters hide everything in this list.', clearFilters: 'Clear filters',
  errorTitle: 'Could not load the list', errorBody: 'Reason: {why}.',
  autoOpen: 'Open on the Watch Later page', exportData: 'Export', exportJson: 'JSON', exportCsv: 'CSV', exportView: 'Current view', exportAll: 'Full list',
  importBackup: 'Import backup', importOk: 'Imported {c} categories, {a} assignments, {n} notes', importSkip: '{n} older notes skipped', importBad: 'That file is not a LaterTidy backup',
  clearData: 'Clear local data', clearDataConfirm: 'Confirm: delete everything', clearDataNote: 'Deletes the saved list, categories, notes and settings of every account in this browser. Your videos on YouTube stay.', cleared: 'Local data cleared',
  version: 'Version {v}', disclaimer: 'For YouTube. Not affiliated with YouTube.', localNote: 'Categories and notes live in this browser only and do not sync. Export a backup to keep them.',
  helpTitle: 'Keyboard shortcuts', close: 'Close',
  'key.search': 'Search', 'key.move': 'Move between videos', 'key.select': 'Select', 'key.open': 'Open video', 'key.remove': 'Remove', 'key.undo': 'Undo',
  'key.budget': 'I have time for', 'key.view': 'Switch grid and list', 'key.category': 'Categories', 'key.note': 'Note', 'key.esc': 'Close popover, then clear search, then clear selection, then exit', 'key.help': 'This sheet',
  masthead: 'Open LaterTidy',
} satisfies Record<string, Entry>;

export type Key = keyof typeof en;

const it: Record<Key, Entry> = {
  appName: 'LaterTidy', watchLater: 'Guarda più tardi', dialogLabel: 'LaterTidy, gestore di Guarda più tardi',
  classicView: 'Vista classica', search: 'Cerca titolo, canale o nota', refresh: 'Aggiorna', settings: 'Impostazioni', help: 'Scorciatoie da tastiera',
  sort: 'Ordina', gridView: 'Griglia', listView: 'Elenco', openFilters: 'Filtri',
  'sort.youtube': 'Ordine di YouTube', 'sort.reverse': 'Ordine inverso', 'sort.shortest': 'Più brevi', 'sort.longest': 'Più lunghi',
  'sort.leastRemaining': 'Meno tempo rimasto', 'sort.channel': 'Canale A–Z', 'sort.newest': 'Pubblicati di recente', 'sort.oldest': 'Pubblicati da più tempo',
  status: 'Stato', 'status.all': 'Tutti', 'status.notStarted': 'Da iniziare', 'status.inProgress': 'Iniziati',
  'status.finished': 'Finiti', 'status.unavailable': 'Non disponibili', 'status.live': 'Live e in programma', withNote: 'Con nota',
  categories: 'Categorie', uncategorized: 'Senza categoria', newCategory: 'Nuova categoria', categoryName: 'Nome della categoria',
  noCategories: 'Ancora nessuna. Premi c su un video per crearne una.', editCategory: 'Modifica {name}', rename: 'Nome', color: 'Colore', deleteCategory: 'Elimina categoria',
  deleteCategoryNote: 'I video restano in Guarda più tardi. Sparisce solo questa etichetta.', categoryDeleted: 'Categoria {name} eliminata',
  pickCategories: 'Categorie', categoryFilter: 'Cerca o crea', createCategory: 'Crea {name}', categoryDot: 'Categoria: {name}',
  channels: 'Canali', channelSearch: 'Cerca canale', showAllChannels: 'Mostra tutti i {n}', noChannels: 'Nessun canale trovato',
  videoCount: { one: '{n} video', other: '{n} video' },
  hoursUnit: { one: 'ora', other: 'ore' }, minutesUnit: 'min', timeLeft: 'da guardare',
  durationAxis: 'Filtra per durata', histogramLabel: 'Video per durata', handleMin: 'Durata minima', handleMax: 'Durata massima', clearRange: 'Togli il filtro durata',
  rangeAny: 'Qualsiasi durata', rangeFrom: 'da {a} a {b}', barTip: { one: '{n} video, {range}', other: '{n} video, {range}' },
  budget: 'Ho tempo per', budgetCustom: 'Minuti', budgetCustomLabel: 'Minuti a scelta', budgetEmpty: 'In {t} non ci sta nulla. Prova con più tempo o meno filtri.',
  budgetTotal: '{n} in {t}', anotherPick: 'Altra selezione', play: 'Riproduci', budgetTitle: 'Per i prossimi {t}', cappedNote: 'Una coda contiene 50 video: partono solo i primi 50.',
  select: 'Seleziona', selectDone: 'Fine', selectAll: 'Seleziona tutti i {n}', selectionCount: { one: '{n} selezionato', other: '{n} selezionati' }, clearSelection: 'Deseleziona',
  outsideFilters: '{n} fuori dai filtri attuali', selectVideo: 'Seleziona {title}',
  remove: 'Rimuovi', removeAll: 'Rimuovi tutti i {n}', confirmRemove: 'Conferma: rimuovi {n}', undo: 'Annulla', undone: 'Ripristinati',
  removed: { one: '{n} rimosso', other: '{n} rimossi' }, removing: 'Rimozione {done} di {total}',
  removeFailed: { one: '{n} non rimosso: {why}', other: '{n} non rimossi: {why}' }, retry: 'Riprova',
  addToPlaylist: 'Aggiungi a playlist', moveOut: 'Togli da Guarda più tardi', loadingPlaylists: 'Caricamento playlist', noPlaylists: 'Nessuna playlist trovata',
  added: { one: '{n} aggiunto a {name}', other: '{n} aggiunti a {name}' }, addFailed: { one: '{n} non aggiunto a {name}: {why}', other: '{n} non aggiunti a {name}: {why}' },
  alreadyIn: 'Già presente', 'privacy.PRIVATE': 'Privata', 'privacy.PUBLIC': 'Pubblica', 'privacy.UNLISTED': 'Non in elenco',
  moveTop: 'Sposta in cima', moveBottom: 'Sposta in fondo', moved: { one: '{n} spostato', other: '{n} spostati' }, moveFailed: { one: '{n} non spostato: {why}', other: '{n} non spostati: {why}' },
  note: 'Nota', editNote: 'Nota per {title}', notePlaceholder: 'Perché l’hai salvato, cosa cercare', noteHint: 'Salvata solo in questo browser', hasNote: 'Ha una nota', noteDone: 'Fine',
  left: '{t} rimasti', watched: 'Guardato', liveNow: 'Live', upcoming: 'In programma', unavailableTitle: 'Video non disponibile', unknownChannel: 'Canale sconosciuto',
  syncing: '{a} di {b}', syncingCount: '{a} caricati', cancel: 'Annulla', cancelRefresh: 'Ferma aggiornamento', refreshFailed: 'Aggiornamento interrotto: {why}',
  stale: 'Copia salvata',
  'why.auth': 'YouTube ha rifiutato la sessione', 'why.http': 'YouTube ha restituito un errore', 'why.network': 'la connessione si è interrotta', 'why.parse': 'YouTube ha inviato una risposta inattesa', 'why.status': 'YouTube ha rifiutato la modifica',
  loggedOutTitle: 'Accedi per vedere Guarda più tardi', loggedOutBody: 'LaterTidy legge l’elenco dal tuo account YouTube in questo browser.', signIn: 'Accedi',
  emptyTitle: 'Guarda più tardi è vuota', emptyBody: 'I video che salvi per dopo arrivano qui.',
  noMatchTitle: 'Nessun video trovato', noMatchBody: 'I filtri nascondono tutto l’elenco.', clearFilters: 'Togli i filtri',
  errorTitle: 'Elenco non caricato', errorBody: 'Motivo: {why}.',
  autoOpen: 'Apri nella pagina Guarda più tardi', exportData: 'Esporta', exportJson: 'JSON', exportCsv: 'CSV', exportView: 'Vista attuale', exportAll: 'Elenco completo',
  importBackup: 'Importa backup', importOk: 'Importate {c} categorie, {a} assegnazioni, {n} note', importSkip: '{n} note più vecchie ignorate', importBad: 'Questo file non è un backup di LaterTidy',
  clearData: 'Cancella dati locali', clearDataConfirm: 'Conferma: cancella tutto', clearDataNote: 'Cancella da questo browser elenco salvato, categorie, note e impostazioni di tutti gli account. I video su YouTube restano.', cleared: 'Dati locali cancellati',
  version: 'Versione {v}', disclaimer: 'Per YouTube. Non affiliato a YouTube.', localNote: 'Categorie e note restano solo in questo browser e non si sincronizzano. Esporta un backup per conservarle.',
  helpTitle: 'Scorciatoie da tastiera', close: 'Chiudi',
  'key.search': 'Cerca', 'key.move': 'Spostati tra i video', 'key.select': 'Seleziona', 'key.open': 'Apri il video', 'key.remove': 'Rimuovi', 'key.undo': 'Annulla',
  'key.budget': 'Ho tempo per', 'key.view': 'Passa da griglia a elenco', 'key.category': 'Categorie', 'key.note': 'Nota', 'key.esc': 'Chiude il popover, poi la ricerca, poi la selezione, poi LaterTidy', 'key.help': 'Questa scheda',
  masthead: 'Apri LaterTidy',
};

const dicts: Record<Lang, Record<string, Entry>> = { en, it };
let lang: Lang = 'en';

export const setLang = (hl: string) => { lang = hl.toLowerCase().startsWith('it') ? 'it' : 'en'; };
export const getLang = () => lang;

export const num = (n: number) => n.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US');

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  const entry = dicts[lang][key]!;
  const n = typeof vars.n === 'number' ? vars.n : 0;
  const raw = typeof entry === 'string' ? entry : n === 1 ? entry.one : entry.other;
  return raw.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return typeof v === 'number' ? num(v) : v ?? '';
  });
}

/** "42 min", "3 h 20 min". */
export function fmtDur(sec: number): string {
  const min = Math.round(sec / 60);
  if (sec > 0 && min === 0) return '<1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${num(h)} h ${m} min` : `${num(h)} h`;
}

/** Hero figure: value and unit are set at different sizes. */
export function heroTime(sec: number): { value: string; unit: string } {
  const hours = sec / 3600;
  if (sec < 3600) return { value: num(Math.round(sec / 60)), unit: t('minutesUnit') };
  if (hours < 10) {
    const value = hours.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { maximumFractionDigits: 1 });
    return { value, unit: t('hoursUnit', { n: hours === 1 ? 1 : 2 }) };
  }
  const n = Math.round(hours);
  return { value: num(n), unit: t('hoursUnit', { n }) };
}

/** Axis edge in compact form: "5 min", "1 h 15". */
export function fmtEdge(sec: number): string {
  if (sec < 60) return '0';
  if (sec < 600) { const m = Math.round(sec / 30) / 2; return `${String(m).replace('.', lang === 'it' ? ',' : '.')} min`; }
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = Math.round((min % 60) / 5) * 5;
  return m ? (m === 60 ? `${h + 1} h` : `${h} h ${m}`) : `${h} h`;
}
