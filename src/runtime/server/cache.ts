import { createStorage } from 'unstorage';
import fsDriver from 'unstorage/drivers/fs-lite';
import { sanitizeHeaders, type StorageMetaHeaders } from '../utils/common';

/**
 * @param cacheDir Persistance cache directory.
 * @param defaultTTL Default TTL in seconds
 * @param extendThreshold Threshold in seconds to extend cache entry
 */
export function createIPXCache(cacheDir: string, defaultTTL = 86400, extendThreshold = 3600) {
  const store = createStorage<string>({ driver: fsDriver({ base: cacheDir }) });


  return <CacheStorage>{
    async get(path) {
      const raw = await store.getItemRaw(path);
      if (!Buffer.isBuffer(raw)) return;

      const meta = await store.getMeta(path) as StorageMetaHeaders;

      const expires = meta.expires ?
        new Date(meta.expires).getTime() :
        (new Date(meta?.mtime || 0).getTime() + defaultTTL * 1000);

      // Check if entry is close to expire and extend it
      if (Date.now() > expires - (extendThreshold * 1000)) {
        meta.expires = new Date( new Date().getTime() + (defaultTTL * 1000)).toUTCString();

        await store.setMeta(path, sanitizeHeaders(meta));
      } else if (Date.now() > expires) {
        // if expired, we will recreate it
        return;
      }

      return { meta, data: new Blob([raw]) };
    },

    async set(path, { data, meta }) {
      await Promise.all([
        store.setItemRaw(path, Buffer.isBuffer(data) ? data : await data.arrayBuffer()),
        store.setMeta(path, sanitizeHeaders(meta)),
      ]);
    },

    async del(path) {
      await store.removeItem(path);
    },

    async clear() {
      await store.clear();
    },
  };
}

interface CachedData {
  data: Blob;
  meta: StorageMetaHeaders;
}

type PayloadData = Omit<CachedData, 'data'> & { data: Blob | Buffer };

interface CacheStorage {
  set: (path: string, val: PayloadData) => Promise<void>;
  get: (path: string) => Promise<CachedData | undefined>;
  del: (path: string) => Promise<void>;
  clear: () => void;
}
