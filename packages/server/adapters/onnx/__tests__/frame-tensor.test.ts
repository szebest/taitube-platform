import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { packFrames } from '../frame-tensor';

const frame = (size: number, pixels: number[][]) => ({
  width: size,
  height: size,
  data: Uint8Array.from(pixels.flat()),
});

describe('packFrames', () => {
  it('lays each frame out one colour plane after another, scaled and normalised', () => {
    const red = frame(1, [[255, 0, 51]]);
    const blue = frame(1, [[0, 102, 255]]);

    const tensor = expectOk(packFrames([red, blue], { inputSize: 1, mean: 0.5, std: 0.5 }));

    expect([...tensor].map((value) => Number(value.toFixed(2)))).toEqual([
      1, -1, -0.6, -1, -0.2, 1,
    ]);
  });

  it('keeps pixels of a plane in reading order', () => {
    const wide = frame(2, [
      [10, 0, 0],
      [20, 0, 0],
      [30, 0, 0],
      [40, 0, 0],
    ]);

    const tensor = expectOk(packFrames([wide], { inputSize: 2, mean: 0, std: 1 }));

    expect([...tensor.subarray(0, 4)].map((value) => Math.round(value * 255))).toEqual([
      10, 20, 30, 40,
    ]);
  });

  it.each([
    {
      scenario: 'a frame of another size',
      given: frame(2, [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]),
      size: 3,
    },
    {
      scenario: 'a frame short of its pixels',
      given: { width: 2, height: 2, data: new Uint8Array(5) },
      size: 2,
    },
  ])('refuses $scenario', ({ given, size }) => {
    const failure = expectErr(packFrames([given], { inputSize: size, mean: 0, std: 1 }));

    expect(failure.code).toBe(ErrorCodes.SCREEN_MODEL_FAILED);
  });

  it('packs no frames into an empty tensor', () => {
    expect(expectOk(packFrames([], { inputSize: 4, mean: 0, std: 1 }))).toHaveLength(0);
  });
});
