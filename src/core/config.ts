import type { YtConfig } from './types';

const str = (x: unknown) => (typeof x === 'string' ? x : '');

/** The bridge reply crosses a world boundary: re-validate instead of trusting its shape. */
export function sanitizeConfig(raw: any): YtConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const loggedIn = raw.loggedIn === true;
  if (loggedIn && (!str(raw.clientVersion) || !raw.context || typeof raw.context !== 'object')) return null;
  return {
    apiKey: str(raw.apiKey), clientVersion: str(raw.clientVersion), context: raw.context ?? null,
    sessionIndex: str(raw.sessionIndex), delegatedSessionId: str(raw.delegatedSessionId),
    datasyncId: str(raw.datasyncId), visitorData: str(raw.visitorData), loggedIn, hl: str(raw.hl),
  };
}
