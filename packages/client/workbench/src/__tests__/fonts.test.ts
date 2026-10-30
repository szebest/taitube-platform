import { latinFaces } from '../fonts';

describe('packages/client/workbench: latinFaces', () => {
  it('keeps the faces that cover the Latin-1 block first, whatever else they cover', () => {
    const latin = { unicodeRange: 'U+0-FF,U+131,U+2000-206F' };
    const faces = [{ unicodeRange: 'U+100-2BA,U+1E00-1E9F' }, latin, { unicodeRange: 'U+400-45F' }];

    expect(latinFaces(faces)).toEqual([latin]);
  });
});
