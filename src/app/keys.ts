import { useLayoutEffect, useRef } from 'preact/hooks';

/**
 * While open, the window-capture guard stops key events before they reach any target, so
 * component onKeyDown props never fire. Key handling registers here instead. Newest layer runs
 * first; returning true consumes the event. Text insertion and native button activation are
 * default actions and keep working.
 */
export type KeyLayer = (e: KeyboardEvent, target: HTMLElement) => boolean;

const layers: KeyLayer[] = [];

export function dispatchKey(e: KeyboardEvent, target: HTMLElement): boolean {
  for (let i = layers.length - 1; i >= 0; i--) if (layers[i]!(e, target)) return true;
  return false;
}

/** Registers once and always calls the latest closure, so no keypress can see stale state. */
export function useKeyLayer(layer: KeyLayer) {
  const latest = useRef(layer);
  latest.current = layer;
  // Layout effect: a key right after a popover mounts must already find its layer.
  useLayoutEffect(() => {
    const call: KeyLayer = (e, target) => latest.current(e, target);
    layers.push(call);
    return () => { layers.splice(layers.indexOf(call), 1); };
  }, []);
}

export const isEditable = (el: HTMLElement) =>
  el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;

export const isActivatable = (el: HTMLElement) =>
  el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'slider';

/** Installs the isolation guard. Returns the uninstaller. */
export function installKeyGuard(isOpen: () => boolean, root: ShadowRoot) {
  // A consumed key may move focus; its keypress and keyup must not activate what got focus.
  let consumed = '';
  const onKey = (e: KeyboardEvent) => {
    if (e.key === consumed && e.type !== 'keydown') {
      if (e.type === 'keyup') consumed = '';
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!isOpen()) return;
    const target = (e.composedPath()[0] ?? root.host) as HTMLElement;
    if (e.type === 'keydown' && !e.isComposing) {
      if (dispatchKey(e, target)) {
        consumed = e.key;
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === 'Tab') trapTab(e, root);
    }
    if (e.metaKey || e.ctrlKey) return; // browser combos pass through
    e.stopImmediatePropagation();
  };
  for (const type of ['keydown', 'keyup', 'keypress'] as const) window.addEventListener(type, onKey, true);
  return () => { for (const type of ['keydown', 'keyup', 'keypress'] as const) window.removeEventListener(type, onKey, true); };
}

function trapTab(e: KeyboardEvent, root: ShadowRoot) {
  const scope = root.querySelector('[data-popover]') ?? root;
  const all = [...scope.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,textarea,[tabindex="0"]')]
    .filter((el) => el.offsetParent !== null);
  if (!all.length) return;
  const first = all[0]!, last = all[all.length - 1]!;
  const active = root.activeElement;
  if (e.shiftKey ? active === first || !active : active === last || !active) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
}
