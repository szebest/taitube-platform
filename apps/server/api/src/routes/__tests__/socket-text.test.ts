import type { RawData } from 'ws';
import { socketText } from '../socket-text';

const FRAME = '{"type":"ping","note":"héllo"}';
const BYTES = Buffer.from(FRAME);

describe('apps/server/api/routes: socketText', () => {
  it.each<[string, RawData]>([
    ['a buffer', BYTES],
    ['an array of buffers', [BYTES.subarray(0, 5), BYTES.subarray(5)]],
    ['an array buffer', BYTES.buffer.slice(BYTES.byteOffset, BYTES.byteOffset + BYTES.byteLength)],
  ])('reads %s as the text it holds', (_name, raw) => {
    expect(socketText(raw)).toBe(FRAME);
  });
});
