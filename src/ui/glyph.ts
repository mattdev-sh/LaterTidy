const SVG_NS = 'http://www.w3.org/2000/svg';

/** Rebuilds the bundled glyph with createElementNS: the masthead lives in YouTube's DOM, no innerHTML. */
export function buildGlyph(source: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  const copy = (from: Element): Element => {
    const el = document.createElementNS(SVG_NS, from.localName);
    for (const attr of from.attributes) el.setAttribute(attr.name, attr.value);
    for (const child of from.children) el.append(copy(child));
    return el;
  };
  return copy(parsed) as SVGSVGElement;
}
