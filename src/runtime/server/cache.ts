import type { OutgoingHttpHeaders } from 'node:http';

import { createStorage } from 'unstorage';
import fsDriver from 'unstorage/drivers/fs-lite';

/**
 * @param cacheDir Persistance cache directory.
 * @param defaultTTL Default TTL in seconds
 */
export function createIPXCache(cacheDir: string, defaultTTL = 86400) {
  const store = createStorage<string>({ driver: fsDriver({ base: cacheDir }) });
  const timers = new Map<string, NodeJS.Timeout>();
  return <CacheStorage>{
    async get(path) {
      const raw = await store.getItemRaw(path);
      if (!Buffer.isBuffer(raw)) return;

      const meta = await store.getItem<OutgoingHttpHeaders>(`${path}.json`);
      const lastMod = new Date(meta?.expires || 0).getTime();
      const expiresIn = lastMod + defaultTTL * 1000;
      // Check if blob is expired using staled HTTP headers
      if (Date.now() > expiresIn) return;

      if (!timers.has(path)) {
        const timeout = setTimeout(() => this.del(path), expiresIn - Date.now());
        timers.set(path, timeout);
      }

      return { meta, data: new Blob([raw]) };
    },

    async set(path, { data, meta }, ttl = defaultTTL) {
      if (timers.has(path)) clearTimeout(timers.get(path));
      const timeout = setTimeout(() => this.del(path), ttl * 1000);

      await Promise.all([
        store.setItemRaw(path, Buffer.isBuffer(data) ? data : await data.arrayBuffer()),
        store.setItem(`${path}.json`, JSON.stringify(meta)),
      ]).catch(console.error);

      timers.set(path, timeout);
    },

    async del(path) {
      if (timers.has(path)) clearTimeout(timers.get(path));
      timers.delete(path);

      const promises = [store.removeItem(path), store.removeItem(`${path}.json`)];
      await Promise.all(promises).catch(() => void 0);
    },

    clear() {
      store.clear();
      for (const v of timers.values()) clearTimeout(v);
      timers.clear();
    },
  };
}

interface CachedData {
  data: Blob;
  meta: OutgoingHttpHeaders;
}

type PayloadData = Omit<CachedData, 'data'> & { data: Blob | Buffer };

interface CacheStorage {
  set: (path: string, val: PayloadData, ttl?: number) => Promise<void>;
  get: (path: string) => Promise<CachedData | undefined>;
  del: (path: string) => Promise<void>;
  clear: () => void;
}
