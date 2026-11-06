import { APPEARANCE_MODES, PLANNED_PAGES } from '../command-actions';

describe('apps/client/web: command actions', () => {
  it('offers every appearance mode', () => {
    expect(APPEARANCE_MODES).toEqual(['system', 'dark', 'light', 'oled']);
  });

  it('plans the history page by its path', () => {
    expect(PLANNED_PAGES).toEqual([{ id: 'history', path: '/feed/history' }]);
  });
});
