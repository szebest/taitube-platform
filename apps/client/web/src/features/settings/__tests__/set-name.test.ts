import { setName } from '../set-name';

describe('apps/client/web: setName', () => {
  it.each([
    { id: 'airy', name: 'Airy' },
    { id: 'xlarge', name: 'Xlarge' },
    { id: 'Soft', name: 'Soft' },
    { id: '', name: '' },
  ])('reads $id as $name', ({ id, name }) => {
    expect(setName(id)).toBe(name);
  });
});
