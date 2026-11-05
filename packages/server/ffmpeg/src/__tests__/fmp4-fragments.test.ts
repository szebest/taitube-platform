import { ErrorCodes } from '@vp/errors';
import { type Fmp4Fragment, Fmp4FragmentSplitter } from '../fmp4-fragments';

function box(type: string, payload: number[]): Uint8Array {
  const bytes = new Uint8Array(8 + payload.length);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  bytes.set(
    [...type].map((char) => char.charCodeAt(0)),
    4
  );
  bytes.set(payload, 8);
  return bytes;
}

function largeBox(type: string, payload: number[]): Uint8Array {
  const bytes = new Uint8Array(16 + payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 1);
  bytes.set(
    [...type].map((char) => char.charCodeAt(0)),
    4
  );
  view.setBigUint64(8, BigInt(bytes.length));
  bytes.set(payload, 16);
  return bytes;
}

function joined(...parts: Uint8Array[]): Uint8Array {
  return Uint8Array.from(parts.flatMap((part) => [...part]));
}

const ftyp = box('ftyp', [1, 2]);
const moov = box('moov', [3]);
const moof = box('moof', [4, 5]);
const mdat = box('mdat', [6, 7, 8]);
const stream = joined(ftyp, moov, moof, mdat, box('moof', [9]), box('mdat', [10]));

const EXPECTED: Fmp4Fragment[] = [
  { type: 'init', bytes: joined(ftyp, moov) },
  { type: 'media', bytes: joined(moof, mdat) },
  { type: 'media', bytes: joined(box('moof', [9]), box('mdat', [10])) },
];

function splitIn(chunkSize: number): Fmp4Fragment[] {
  const splitter = new Fmp4FragmentSplitter();
  const out: Fmp4Fragment[] = [];
  for (let offset = 0; offset < stream.length; offset += chunkSize) {
    out.push(...splitter.push(stream.subarray(offset, offset + chunkSize)));
  }
  return out;
}

describe('@vp/ffmpeg: Fmp4FragmentSplitter', () => {
  it.each([1, 3, 7, stream.length])(
    'yields the init segment and each fragment whole, read %i bytes at a time',
    (chunkSize) => {
      expect(splitIn(chunkSize)).toEqual(EXPECTED);
    }
  );

  it('reads a box whose size takes the 64-bit form', () => {
    const big = largeBox('mdat', [1, 2, 3]);

    expect(new Fmp4FragmentSplitter().push(joined(moof, big))).toEqual([
      { type: 'media', bytes: joined(moof, big) },
    ]);
  });

  it('drops boxes that belong to no fragment', () => {
    const splitter = new Fmp4FragmentSplitter();

    expect(splitter.push(joined(box('free', []), mdat, box('mfra', [1])))).toEqual([]);
  });

  it('refuses a box that claims to run to the end of the stream', () => {
    const endless = box('mdat', []);
    new DataView(endless.buffer).setUint32(0, 0);

    expect(() => new Fmp4FragmentSplitter().push(endless)).toThrow(
      expect.objectContaining({ code: ErrorCodes.FFMPEG_FAILED })
    );
  });
});
