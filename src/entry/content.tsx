import { render } from 'preact';
import { App } from '../app/app';
import { installKeyGuard } from '../app/keys';
import { sanitizeConfig } from '../core/config';
import { onExternalChange, readSettings } from '../core/storage';
import type { YtConfig } from '../core/types';
import { setLang, t } from '../i18n';
import css from '../ui/styles.css';
import { Root } from '../ui/root';
import glyph from '../../assets/icons/glyph.svg';
import { buildGlyph } from '../ui/glyph';

const HOST_ID = 'latertidy-root';
const BTN_ID = 'latertidy-masthead-button';

const app = new App();
let mounted = false;
let host: HTMLElement | null = null;
/** The user closed the overlay on this page view: don't auto-open again until they leave it. */
let dismissedUrl = '';

function requestConfig(): Promise<YtConfig | null> {
  return new Promise((resolve) => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    let answered = false; // The bridge replies synchronously, inside dispatchEvent.
    const onReply = (e: Event) => {
      answered = true;
      document.removeEventListener('latertidy:config', onReply);
      clearTimeout(timer);
      try { resolve(sanitizeConfig(JSON.parse((e as CustomEvent<string>).detail))); }
      catch { resolve(null); }
    };
    document.addEventListener('latertidy:config', onReply);
    const ask = () => {
      if (++tries > 25) {
        document.removeEventListener('latertidy:config', onReply);
        resolve(null);
        return;
      }
      document.dispatchEvent(new CustomEvent('latertidy:config-request'));
      if (!answered) timer = setTimeout(ask, 200);
    };
    ask();
  });
}

function mount() {
  if (mounted) return;
  mounted = true;
  host = document.createElement('div');
  host.id = HOST_ID;
  host.hidden = true;
  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  shadow.adoptedStyleSheets = [sheet];
  const container = document.createElement('div');
  container.className = 'root';
  shadow.append(container);
  document.documentElement.append(host);

  installKeyGuard(() => app.state.open, shadow);
  watchTheme();
  render(<Root app={app} />, container);
}

function watchTheme() {
  const apply = () => {
    const theme = document.documentElement.hasAttribute('dark') ? 'dark' : 'light';
    host?.setAttribute('data-theme', theme);
    if (app.state.theme !== theme) app.set({ theme });
  };
  apply();
  new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });
}

// Scroll lock lives on both elements because YouTube scrolls one or the other by layout.
let locked: Array<[HTMLElement, string]> = [];
app.onOpenChange = (open) => {
  if (host) host.hidden = !open;
  if (open) {
    locked = [document.documentElement, document.body].map((el) => [el, el.style.overflow]);
    for (const [el] of locked) el.style.overflow = 'hidden';
  } else {
    for (const [el, value] of locked) el.style.overflow = value;
    locked = [];
    dismissedUrl = location.href;
  }
};

let opening: Promise<void> | null = null;

function openOverlay() {
  mount();
  app.open();
  opening ??= (async () => {
    const cfg = await requestConfig();
    if (cfg) { await app.start(cfg); setMastheadLabel(); }
    else app.set({ phase: 'error', errorWhy: t('why.parse') });
  })().finally(() => { opening = null; });
  return opening;
}

function toggle() {
  if (app.state.open) app.close();
  else void openOverlay();
}

const isWatchLater = () => location.pathname === '/playlist' && new URLSearchParams(location.search).get('list') === 'WL';

async function checkRoute() {
  if (location.hash === '#latertidy') {
    history.replaceState(history.state, '', location.pathname + location.search);
    void openOverlay();
    return;
  }
  if (!isWatchLater()) { dismissedUrl = ''; return; }
  if (app.state.open || dismissedUrl === location.href) return;
  const { autoOpen } = await readSettings();
  if (autoOpen) void openOverlay();
}

// ---- masthead button ----
function setMastheadLabel() {
  const btn = document.getElementById(BTN_ID);
  if (btn) { btn.setAttribute('aria-label', t('masthead')); btn.title = t('masthead'); }
}

function ensureMastheadButton() {
  const slot = document.querySelector('ytd-masthead #end #buttons');
  if (!slot || document.getElementById(BTN_ID)) return;
  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.type = 'button';
  btn.style.cssText = 'width:40px;height:40px;margin-right:8px;padding:8px;border:0;border-radius:50%;background:transparent;'
    + 'color:var(--yt-spec-text-primary,currentColor);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none';
  btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--yt-spec-badge-chip-background,rgba(128,128,128,.2))'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
  btn.addEventListener('click', toggle);
  btn.append(buildGlyph(glyph));
  slot.prepend(btn);
  setMastheadLabel();
}

function watchMasthead() {
  let pending = false;
  const check = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; ensureMastheadButton(); }, 1000);
  };
  new MutationObserver(check).observe(document.documentElement, { childList: true, subtree: true });
  ensureMastheadButton();
}

// ---- wiring ----
try {
  chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
    if (msg?.type === 'toggle') toggle();
    if (msg?.type === 'open' && !app.state.open) void openOverlay();
  });
} catch { /* context gone */ }

onExternalChange((key, value) => app.onStorageChange(key, value));
// Fired on inner elements or on document depending on YouTube's build; capture on document sees both.
document.addEventListener('yt-navigate-finish', () => void checkRoute(), true);
document.addEventListener('yt-navigate-start', () => app.queue.commitNow(), true);
window.addEventListener('hashchange', () => void checkRoute());
window.addEventListener('pagehide', () => app.pagehide());
window.addEventListener('pageshow', (e) => { if (e.persisted) app.pageshow(); });

setLang(document.documentElement.lang || 'en');
watchMasthead();
void checkRoute();
