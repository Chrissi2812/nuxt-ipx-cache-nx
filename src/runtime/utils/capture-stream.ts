import { Writable, type WritableOptions } from 'node:stream';

export class CaptureStream extends Writable {
  private chunks: Buffer[];

  constructor(options?: WritableOptions) {
    super(options);
    this.chunks = [];
  }

  override _write(chunk: unknown, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(<string>chunk, encoding));
    callback();
  }

  getBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}
