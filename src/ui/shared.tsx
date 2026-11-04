import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { App, Popover } from '../app/app';
import { highlight } from '../core/search';

export const AppContext = createContext<App>(null as unknown as App);
export const useApp = () => useContext(AppContext);

export const anchorOf = (el: EventTarget | Element | null): Popover['anchor'] => {
  if (!(el instanceof Element)) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

export function Hl({ text, terms }: { text: string; terms: readonly string[] }) {
  if (!terms.length) return <>{text}</>;
  return <>{highlight(text, terms).map((p) => p.hit ? <mark>{p.text}</mark> : p.text)}</>;
}
