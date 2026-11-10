import { expectErr, expectOk } from '@vp/testing/result';
import { validateCropRect } from '../image-crop';

const IMAGE = { width: 2560, height: 1440 };

describe('@vp/validation: validateCropRect', () => {
  it.each([
    {
      name: 'the whole image at its own shape',
      rect: { x: 0, y: 0, width: 2560, height: 1440 },
      aspect: 16 / 9,
    },
    { name: 'a 6:1 band', rect: { x: 0, y: 100, width: 2400, height: 400 }, aspect: 6 },
    {
      name: 'a crop within the tolerance',
      rect: { x: 0, y: 0, width: 2400, height: 395 },
      aspect: 6,
    },
    { name: 'a free-shaped crop', rect: { x: 10, y: 10, width: 300, height: 700 }, aspect: null },
  ])('accepts $name', ({ rect, aspect }) => {
    expect(expectOk(validateCropRect('crops.desktop', rect, IMAGE, aspect))).toEqual(rect);
  });

  it.each([
    { name: 'a fractional edge', rect: { x: 0.5, y: 0, width: 2400, height: 400 }, aspect: 6 },
    { name: 'a negative origin', rect: { x: -1, y: 0, width: 2400, height: 400 }, aspect: 6 },
    { name: 'a zero height', rect: { x: 0, y: 0, width: 2400, height: 0 }, aspect: null },
    {
      name: 'a crop past the right edge',
      rect: { x: 200, y: 0, width: 2400, height: 400 },
      aspect: 6,
    },
    {
      name: 'a crop past the bottom edge',
      rect: { x: 0, y: 1200, width: 2400, height: 400 },
      aspect: 6,
    },
    { name: 'the wrong shape', rect: { x: 0, y: 0, width: 2400, height: 800 }, aspect: 6 },
  ])('rejects $name against its field', ({ rect, aspect }) => {
    expect(expectErr(validateCropRect('crops.desktop', rect, IMAGE, aspect))).toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'crops.desktop',
      image: IMAGE,
      aspect,
    });
  });
});
