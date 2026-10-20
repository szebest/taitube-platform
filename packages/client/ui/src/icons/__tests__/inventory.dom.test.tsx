import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ICONS } from '../inventory';

const LOGO = 'mark';

const drawnIds = () => {
  const sprite = readFileSync(
    resolve(import.meta.dirname, '../../../../../../docs/design/lib/icons.svg'),
    'utf8'
  );
  const symbols = new DOMParser()
    .parseFromString(sprite, 'image/svg+xml')
    .querySelectorAll('symbol');
  return [...symbols].map(({ id }) => id).filter((id) => id !== LOGO);
};

describe('@vp/ui: the icon inventory', () => {
  it('draws every id of the design library sprite but the logo, and nothing else', () => {
    expect(Object.keys(ICONS).sort()).toEqual(drawnIds().sort());
  });
});
