const DAY = 86_400_000;

// en + it, including YouTube's short forms ("3 gg fa", "2 mesi fa", "5 yr ago").
const UNITS: Record<string, number> = {
  second: 1 / 86400, seconds: 1 / 86400, sec: 1 / 86400, secs: 1 / 86400, s: 1 / 86400,
  secondo: 1 / 86400, secondi: 1 / 86400,
  minute: 1 / 1440, minutes: 1 / 1440, min: 1 / 1440, mins: 1 / 1440, minuto: 1 / 1440, minuti: 1 / 1440,
  hour: 1 / 24, hours: 1 / 24, hr: 1 / 24, hrs: 1 / 24, h: 1 / 24, ora: 1 / 24, ore: 1 / 24,
  day: 1, days: 1, d: 1, giorno: 1, giorni: 1, gg: 1, g: 1,
  week: 7, weeks: 7, wk: 7, wks: 7, settimana: 7, settimane: 7, sett: 7,
  month: 30.44, months: 30.44, mo: 30.44, mos: 30.44, mese: 30.44, mesi: 30.44,
  year: 365.25, years: 365.25, yr: 365.25, yrs: 365.25, y: 365.25, anno: 365.25, anni: 365.25, a: 365.25,
};

/** Returns approximate epoch ms, or null when the text can't be read. */
export function parseAge(text: string | null | undefined, now = Date.now()): number | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  // The word form is what's matched, so "Streamed", "Trasmesso", etc. are ignored around it.
  for (const m of lower.matchAll(/(\d+(?:[.,]\d+)?)\s*([a-zà-ù]+)\.?/g)) {
    const days = UNITS[m[2]!];
    if (days !== undefined) return now - parseFloat(m[1]!.replace(',', '.')) * days * DAY;
  }
  // "un anno fa", "a year ago", "an hour ago", "un mese fa", "una settimana fa"
  for (const m of lower.matchAll(/\b(?:a|an|un|una|un')\s*([a-zà-ù]+)/g)) {
    const days = UNITS[m[1]!];
    if (days !== undefined) return now - days * DAY;
  }
  return null;
}
