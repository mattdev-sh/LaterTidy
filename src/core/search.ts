/** Folds one char: lowercase, no diacritics. May return '' or several chars. */
function foldChar(ch: string): string {
  return ch.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

export function terms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

export interface Part { text: string; hit: boolean }

/** Splits text into plain and matched parts, mapping folded matches back to the original. */
export function highlight(text: string, queryTerms: readonly string[]): Part[] {
  if (!queryTerms.length || !text) return [{ text, hit: false }];
  let folded = '';
  const map: number[] = []; // folded index → original code-unit index
  let i = 0;
  for (const ch of text) {
    const f = foldChar(ch);
    for (let k = 0; k < f.length; k++) map.push(i);
    folded += f;
    i += ch.length;
  }
  map.push(text.length);
  const hit = new Uint8Array(text.length);
  for (const term of queryTerms) {
    for (let at = folded.indexOf(term); at !== -1; at = folded.indexOf(term, at + term.length)) {
      const end = map[at + term.length]!;
      for (let k = map[at]!; k < end; k++) hit[k] = 1;
    }
  }
  const parts: Part[] = [];
  let start = 0;
  for (let k = 1; k <= text.length; k++) {
    if (k === text.length || hit[k] !== hit[start]) {
      parts.push({ text: text.slice(start, k), hit: hit[start] === 1 });
      start = k;
    }
  }
  return parts;
}

/** Position of the first match in `text`, or -1. Used to centre note previews on the hit. */
export function firstHitIndex(text: string, queryTerms: readonly string[]): number {
  const parts = highlight(text, queryTerms);
  let at = 0;
  for (const p of parts) {
    if (p.hit) return at;
    at += p.text.length;
  }
  return -1;
}
