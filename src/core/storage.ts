import { emptyMeta, sanitizeMeta } from './meta';
import type { Meta, Settings, Snapshot } from './types';

const VERSION_PREFIX = 'lb:v1:';
export const SETTINGS_KEY = 'lb:settings';
export const DEFAULT_SETTINGS: Settings = { autoOpen: true, view: 'grid', sort: 'youtube' };

export async function accountKey(datasyncId: string, sessionIndex: string): Promise<string> {
  const seed = datasyncId || `session-${sessionIndex || '0'}`;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export const snapshotKey = (acct: string) => `${VERSION_PREFIX}${acct}`;
export const metaKey = (acct: string) => `${VERSION_PREFIX}${acct}:meta`;
export const pendingKey = (acct: string) => `${VERSION_PREFIX}${acct}:pending`;

/** Storage may vanish when the extension reloads under a live page: reads fall back, writes no-op. */
const area = () => {
  try { return chrome.runtime?.id ? chrome.storage.local : null; } catch { return null; }
};

export async function read<T>(key: string): Promise<T | undefined> {
  try {
    const got = await area()?.get(key);
    return got?.[key] as T | undefined;
  } catch { return undefined; }
}

export async function write(key: string, value: unknown): Promise<boolean> {
  try {
    const a = area();
    if (!a) return false;
    await a.set({ [key]: value });
    return true;
  } catch { return false; }
}

export async function remove(keys: string[]): Promise<void> {
  try { await area()?.remove(keys); } catch { /* context gone */ }
}

export async function clearAll(): Promise<void> {
  try { await area()?.clear(); } catch { /* context gone */ }
}

export async function readSnapshot(acct: string): Promise<Snapshot | null> {
  const snap = await read<Snapshot>(snapshotKey(acct));
  return snap?.v === 1 && Array.isArray(snap.videos) ? snap : null;
}

export async function readMeta(acct: string): Promise<Meta> {
  return sanitizeMeta(await read(metaKey(acct))) ?? emptyMeta();
}

export async function readSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await read<Partial<Settings>>(SETTINGS_KEY)) };
}

export function onExternalChange(listener: (key: string, value: unknown) => void) {
  try {
    chrome.storage.onChanged.addListener((changes, name) => {
      if (name !== 'local') return;
      for (const [k, c] of Object.entries(changes)) listener(k, c.newValue);
    });
  } catch { /* context gone */ }
}
