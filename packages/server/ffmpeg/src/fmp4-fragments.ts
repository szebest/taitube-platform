import { ErrorCodes, TransientError } from '@vp/errors';

/**
 * What a fragmented MP4 on a pipe is made of, for a packager: the init segment (`ftyp` + `moov`)
 * once, then one `moof` + `mdat` pair per fragment.
 */
export type Fmp4Fragment =
  | { type: 'init'; bytes: Uint8Array }
  | { type: 'media'; bytes: Uint8Array };

/** ISO/IEC 14496-12 4.2: a 32-bit size and a four-letter type; size 1 puts a 64-bit size after the type. */
const BOX_HEADER = { bytes: 8, largeBytes: 16 } as const;

interface BoxHeader {
  type: string;
  size: number;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

function readHeader(bytes: Uint8Array): BoxHeader | undefined {
  if (bytes.length < BOX_HEADER.bytes) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = String.fromCharCode(...bytes.subarray(4, BOX_HEADER.bytes));
  const size = view.getUint32(0);
  if (size !== 1) return { type, size };
  if (bytes.length < BOX_HEADER.largeBytes) return undefined;
  return { type, size: Number(view.getBigUint64(BOX_HEADER.bytes)) };
}

/**
 * Splits a fragmented MP4 byte stream into its init segment and its fragments. It reads box headers
 * only: a fragment's timing is the encoder's, set by the arguments that produced the stream.
 */
export class Fmp4FragmentSplitter {
  private buffered: Uint8Array = new Uint8Array(0);
  private header: Uint8Array[] = [];
  private fragment: Uint8Array[] = [];

  push(chunk: Uint8Array): Fmp4Fragment[] {
    this.buffered = this.buffered.length === 0 ? chunk : concat([this.buffered, chunk]);
    const out: Fmp4Fragment[] = [];

    for (let box = this.nextBox(); box !== undefined; box = this.nextBox()) {
      const emitted = this.accept(box.type, box.bytes);
      if (emitted) out.push(emitted);
    }
    return out;
  }

  private nextBox(): { type: string; bytes: Uint8Array } | undefined {
    const header = readHeader(this.buffered);
    if (header === undefined) return undefined;
    if (header.size < BOX_HEADER.bytes) {
      throw new TransientError(
        ErrorCodes.FFMPEG_FAILED,
        `fMP4 box ${header.type} has an unsupported size ${header.size}`
      );
    }
    if (this.buffered.length < header.size) return undefined;

    const bytes = this.buffered.subarray(0, header.size);
    this.buffered = this.buffered.subarray(header.size);
    return { type: header.type, bytes: bytes.slice() };
  }

  private accept(type: string, bytes: Uint8Array): Fmp4Fragment | undefined {
    switch (type) {
      case 'ftyp':
        this.header = [bytes];
        return undefined;
      case 'moov':
        return { type: 'init', bytes: concat([...this.header, bytes]) };
      case 'moof':
        this.fragment = [bytes];
        return undefined;
      case 'mdat': {
        if (this.fragment.length === 0) return undefined;
        const media = concat([...this.fragment, bytes]);
        this.fragment = [];
        return { type: 'media', bytes: media };
      }
      default:
        return undefined;
    }
  }
}
