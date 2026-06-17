import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { PlatformPayload } from './types';

const DB_NAME = 'taste-blend-db';
const STORE_NAME = 'payloads';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheRecord {
  id: string; // key is `${platform}:${username}`
  payload: PlatformPayload;
  fetchedAt: number;
}

interface TasteBlendDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: CacheRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<TasteBlendDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TasteBlendDB>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function getCached(platform: string, username: string): Promise<PlatformPayload | null> {
  const db = await getDB();
  const id = `${platform}:${username.toLowerCase()}`;
  const record = await db.get(STORE_NAME, id);

  if (!record) return null;

  const age = Date.now() - record.fetchedAt;
  if (age > TTL_MS) {
    // Stale
    await db.delete(STORE_NAME, id);
    return null;
  }

  return record.payload;
}

export async function setCached(platform: string, username: string, payload: PlatformPayload): Promise<void> {
  const db = await getDB();
  const id = `${platform}:${username.toLowerCase()}`;
  await db.put(STORE_NAME, {
    id,
    payload,
    fetchedAt: Date.now(),
  });
}

export interface HistoryItem {
  id: string;
  platform: 'mal' | 'letterboxd' | 'trakt';
  userA: string;
  userB: string;
  timestamp: number;
}

export async function purgeCachedUsers(platform: string, userA: string, userB: string): Promise<void> {
  const db = await getDB();
  const idA = `${platform}:${userA.toLowerCase()}`;
  const idB = `${platform}:${userB.toLowerCase()}`;
  await Promise.all([
    db.delete(STORE_NAME, idA),
    db.delete(STORE_NAME, idB),
  ]);
}

export function saveToHistory(platform: 'mal' | 'letterboxd' | 'trakt', userA: string, userB: string): void {
  try {
    const stored = localStorage.getItem('watch_overlap_history');
    let list: HistoryItem[] = stored ? JSON.parse(stored) : [];
    const id = `${platform}:${userA.toLowerCase()}:${userB.toLowerCase()}`;
    
    // Remove duplicate entries
    list = list.filter(item => item.id !== id);
    
    // Push new entry to the front
    list.unshift({
      id,
      platform,
      userA,
      userB,
      timestamp: Date.now(),
    });
    
    // Cap history at 5 recent searches
    if (list.length > 5) {
      list = list.slice(0, 5);
    }
    
    localStorage.setItem('watch_overlap_history', JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save comparison to history', e);
  }
}

