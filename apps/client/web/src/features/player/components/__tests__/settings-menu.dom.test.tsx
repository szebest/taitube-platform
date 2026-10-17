import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import { IntlProvider } from '@vp/intl-react';
import { axeViolations } from '@vp/web-testing/dom';
import { parseMaster } from '#app/features/player/__tests__/offline-hls';
import { VideoJsEngine } from '#app/features/player/engine/video-js-engine';
import { SettingsMenu } from '../settings-menu';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/features/player/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

afterEach(() => {
  vi.useRealTimers();
});

function renderMenu() {
  const user = userEvent.setup();
  const rendered = render(
    <IntlProvider locale="en" timeZone="UTC">
      <VideoJsEngine
        playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
        posterUrl="http://localhost:9000/posters/p.jpg"
        title="Launch day"
      >
        <SettingsMenu />
      </VideoJsEngine>
    </IntlProvider>
  );
  const video = rendered.container.querySelector('video');
  if (!video) throw new Error('the player rendered no <video>');
  const player = screen.getByRole('group', { name: 'Media player' });
  return { ...rendered, user, video, player };
}

async function openSubmenu(user: UserEvent, submenu: string) {
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(
    screen.getByRole('menuitem', { name: (accessibleName) => accessibleName.startsWith(submenu) })
  );
}

async function pick(user: UserEvent, submenu: string, choice: string) {
  await openSubmenu(user, submenu);
  screen.getByRole('menuitemradio', { name: choice }).focus();
  await user.keyboard('{Enter}');
}

function choiceNames(): string[] {
  return screen.getAllByRole('menuitemradio').map(({ textContent }) => textContent ?? '');
}

describe('apps/client/web: the player settings menu', () => {
  it('offers Auto at the playing height, then every rendition of the master, highest first', async () => {
    const { user, video } = renderMenu();
    await parseMaster(video, [360, 720, 1080], 720);

    await openSubmenu(user, 'Quality');

    expect(choiceNames()).toEqual(['Auto (720p)', '1080p', '720p', '360p']);
    expect(screen.getByRole('menuitemradio', { name: 'Auto (720p)' })).toBeChecked();
    expect(await axeViolations()).toEqual([]);
  });

  it.each([
    { picked: 'a rendition', picks: ['360p'], level: 0, checked: '360p' },
    {
      picked: 'Auto after a rendition',
      picks: ['360p', 'Auto (720p)'],
      level: -1,
      checked: 'Auto (720p)',
    },
  ])('hands hls.js the level of $picked', async ({ picks, level, checked }) => {
    const { user, video } = renderMenu();
    const hls = await parseMaster(video, [360, 720], 720);
    const nextLevel = vi.spyOn(hls, 'nextLevel', 'set');

    for (const choice of picks) {
      await pick(user, 'Quality', choice);
    }

    expect(nextLevel).toHaveBeenLastCalledWith(level);
    await openSubmenu(user, 'Quality');
    expect(screen.getByRole('menuitemradio', { name: checked })).toBeChecked();
  });

  it('offers no quality before the master lists its renditions', async () => {
    const { user } = renderMenu();

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getAllByRole('menuitem').map(({ textContent }) => textContent)).toEqual([
      'Playback speedNormal',
    ]);
  });

  it('plays at the speed picked from 0.25x to 2x', async () => {
    const { user, video } = renderMenu();

    await pick(user, 'Playback speed', '1.5x');

    expect(video.playbackRate).toBe(1.5);
    await openSubmenu(user, 'Playback speed');
    expect(choiceNames()).toEqual([
      '0.25x',
      '0.5x',
      '0.75x',
      'Normal',
      '1.25x',
      '1.5x',
      '1.75x',
      '2x',
    ]);
    expect(screen.getByRole('menuitemradio', { name: '1.5x' })).toBeChecked();
  });

  it('opens inside the player, so it stays on screen in fullscreen', async () => {
    const { user, player } = renderMenu();

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(within(player).getByRole('menu')).toBeInTheDocument();
  });

  it.each([
    { menu: 'open', visible: true },
    { menu: 'closed', visible: false },
  ])(
    'keeps the controls shown while playing idle with the menu $menu',
    async ({ menu, visible }) => {
      const { user, video, player } = renderMenu();
      Object.defineProperty(video, 'paused', { configurable: true, value: false });
      fireEvent(video, new Event('play'));

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      if (menu === 'closed') {
        await user.keyboard('{Escape}');
      }
      vi.useFakeTimers();
      fireEvent.pointerMove(player);
      await act(() => vi.advanceTimersByTimeAsync(5_000));

      expect(player.hasAttribute('data-controls-visible')).toBe(visible);
    }
  );
});
