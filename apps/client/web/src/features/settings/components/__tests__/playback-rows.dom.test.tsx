import { screen } from '@testing-library/react';
import { writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';

import { requestDevicePreferences } from '#app/features/settings/device/device-preferences';
import { getRouter } from '#app/router';

const renderPlayback = () => renderRoute(getRouter, '/settings/playback');

const saved = () => requestDevicePreferences().playback;

describe('apps/client/web: the playback rows', () => {
  afterEach(() => {
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it.each([
    { row: 'Default quality', start: 'Auto', pick: '720p', key: 'quality', value: '720p' },
    { row: 'Default speed', start: 'Normal', pick: '1.5x', key: 'speed', value: 1.5 },
  ])('keeps the $row picked on the device, starting from $start', async (change) => {
    const { user } = await renderPlayback();
    const select = await screen.findByRole('combobox', { name: change.row });
    expect(select).toHaveTextContent(change.start);

    await user.click(select);
    await user.click(await screen.findByRole('option', { name: change.pick }));

    expect(saved()[change.key as 'quality' | 'speed']).toBe(change.value);
  });

  it.each([
    { row: 'Hover preview', key: 'hoverPreview', before: true },
    { row: 'Stats overlay', key: 'statsOverlay', before: false },
  ] as const)('flips $row on the device from $before', async ({ row, key, before }) => {
    const { user } = await renderPlayback();
    const toggle = await screen.findByRole('switch', { name: row });
    expect(toggle).toHaveAttribute('aria-checked', String(before));

    await user.click(toggle);

    expect(saved()[key]).toBe(!before);
  });
});
