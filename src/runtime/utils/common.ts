import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { OutgoingHttpHeaders } from 'node:http';
import type { StorageMeta } from 'unstorage';

export async function generateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath);
  return generateBufferHash(fileBuffer);
}

export function generateBufferHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export type StorageMetaHeaders = StorageMeta & OutgoingHttpHeaders;
export function sanitizeHeaders(originHead: StorageMetaHeaders) {
  return {
    etag: originHead.etag,
    expires: originHead.expires,
    'content-type': originHead['content-type'],
    'cache-control': originHead['cache-control'],
    'last-modified': originHead['last-modified'],
    'content-length': originHead['content-length'],
  } satisfies OutgoingHttpHeaders;
}
