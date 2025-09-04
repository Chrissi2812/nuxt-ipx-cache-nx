import type { ServerResponse } from 'node:http';

import { createIPXCache } from './cache';

import { PassThrough } from 'node:stream';
import { CaptureStream } from '../utils/capture-stream';
import { sanitizeHeaders } from '../utils/common';

import { sendStream, setHeaders, getHeader } from 'h3';
import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime';

export default defineNitroPlugin((nitroApp) => {
  const { ipxCache: config } = useRuntimeConfig();
  const ipxPrefix = `${config.ipxPrefix}/`;

  const cacheStore = createIPXCache(config.cacheDir, config.maxAge, config.extendThreshold);

  nitroApp.hooks.hook('request', async function (evt) {
    if (!evt.path.startsWith(ipxPrefix)) return;

    const originalRes = evt.node.res;
    const reqUrl = (evt.path || '')
      .replace(/http(s?):\/\/|,/g, '')
      .replaceAll(ipxPrefix, '')
      .replaceAll('&', '-');

    if (!getHeader(evt, 'cache-control')?.includes('ipx-purge')) {
      /** Load from cache if there is any */
      const cached = await cacheStore.get(reqUrl);
      if (cached) {
        setHeaders(evt, { ...(<HeadersInit>sanitizeHeaders(cached.meta)), 'cache-status': 'HIT' });
        return sendStream(evt, cached.data.stream());
      }
    }

    const passThrough = new PassThrough();
    const captureStream = new CaptureStream();
    passThrough.pipe(captureStream);

    const originalWrite = originalRes.write.bind(originalRes) as CustomStream<boolean>;
    const originalEnd = originalRes.end.bind(originalRes) as CustomStream<ServerResponse>;

    originalRes.write = <CustomStream<boolean>>((chunk, encoding, callback) => {
      passThrough.write(chunk, <BufferEncoding>encoding, callback);
      return originalWrite(chunk, <BufferEncoding>encoding, callback);
    });
    originalRes.end = <CustomStream<ServerResponse>>((chunk, encoding, callback) => {
      const expires = new Date(Date.now() + config.maxAge * 1000).toUTCString();
      if (chunk) passThrough.write(chunk, encoding as BufferEncoding, callback);

      setHeaders(evt, { expires, 'cache-status': 'MISS' });
      originalEnd(chunk, encoding, callback);
      if (originalRes.statusCode !== 200) return originalRes;

      const originHead = originalRes.getHeaders();
      const data = captureStream.getBuffer();
      const meta = sanitizeHeaders({
        ...originHead,
        expires,
        'content-length': data.byteLength,
      });

      cacheStore.set(reqUrl, { data, meta });
      return originalRes;
    });
  });
});

type CustomStream<T> = (
  chunk: unknown,
  encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
  callback?: (error: Error | null | undefined) => void
) => T;
