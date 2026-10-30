import { screen, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

const renderAt = (url: string) => renderRoute(getRouter, url);

const sectionNav = () =>
  within(screen.getByRole('navigation', { name: 'Settings sections', hidden: true }));

const sectionLinks = () =>
  sectionNav()
    .getAllByRole('link', { hidden: true })
    .map((link) => link.textContent);

describe('apps/client/web: the settings layout', () => {
  it('lists the sections, the page under appearance left out', async () => {
    await renderAt('/settings/playback');

    expect(sectionLinks()).toEqual([
      'Appearance',
      'Accessibility',
      'Playback',
      'Privacy',
      'Notifications',
      'Language',
    ]);
  });

  it.each([
    { url: '/settings/playback', current: 'Playback' },
    { url: '/settings/appearance/advanced', current: 'Appearance' },
  ])('marks $current as the section on screen at $url', async ({ url, current }) => {
    await renderAt(url);

    expect(
      sectionNav().getByRole('link', { name: current, current: 'page', hidden: true })
    ).toBeInTheDocument();
  });
});
