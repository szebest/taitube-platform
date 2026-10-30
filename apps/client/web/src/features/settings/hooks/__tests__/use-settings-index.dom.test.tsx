import { renderHook } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { SETTING_ROWS } from '../../settings-index';
import { useSettingsIndex } from '../use-settings-index';

const renderIndex = () =>
  renderHook(() => useSettingsIndex(), { wrapper: AppProviders }).result.current;

describe('useSettingsIndex', () => {
  it('words every row, with the page it is on', () => {
    const index = renderIndex();

    expect(index).toHaveLength(SETTING_ROWS.length);
    expect(index.filter((entry) => !(entry.label && entry.keywords && entry.sectionTitle))).toEqual(
      []
    );
    expect(index.find(({ id }) => id === 'radius')).toMatchObject({
      label: 'Corners',
      to: '/settings/appearance/advanced',
      sectionTitle: 'Fine-tune the look',
    });
  });
});
