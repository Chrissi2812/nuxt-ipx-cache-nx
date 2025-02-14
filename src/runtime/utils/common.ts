import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function generateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath);
  return generateBufferHash(fileBuffer);
}

export function generateBufferHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
