import { screen, within } from '@testing-library/react';
import { COMPACT_QUERY } from '@vp/ui';
import { VIDEO_ID } from '@vp/web-testing';
import { renderWatch } from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const LINK = `http://localhost:3000/watch/${VIDEO_ID}`;

async function openShare() {
  const rendered = await renderWatch();
  await rendered.user.click(screen.getByRole('button', { name: 'Share' }));
  return { ...rendered, dialog: await screen.findByRole('dialog', { name: 'Share this video' }) };
}

function stubCompactViewport() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        media: query,
        matches: query === COMPACT_QUERY,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList
  );
}

describe('apps/client/web: share dialog', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
  });

  it.each([
    { scenario: 'without the time', startAt: false, copied: LINK },
    { scenario: 'with the time the player is at', startAt: true, copied: `${LINK}?t=75` },
  ])('copies the link $scenario and says so', async ({ startAt, copied }) => {
    const { user, dialog } = await openShare();
    if (startAt) {
      await user.click(within(dialog).getByRole('checkbox', { name: 'Start at 01:15' }));
    }
    expect(within(dialog).getByRole('textbox', { name: 'Link' })).toHaveTextContent(copied);

    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(copied);
  });

  it('says so when the link cannot be copied', async () => {
    const { user, dialog } = await openShare();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText('The link could not be copied')).toBeInTheDocument();
  });

  it.each([
    { name: 'Share on X', origin: 'https://twitter.com/intent/tweet' },
    { name: 'Share on Facebook', origin: 'https://www.facebook.com/sharer/sharer.php' },
    { name: 'Share on WhatsApp', origin: 'https://wa.me/' },
    { name: 'Share on Telegram', origin: 'https://t.me/share/url' },
    { name: 'Share on Reddit', origin: 'https://www.reddit.com/submit' },
    { name: 'Share on Email', origin: 'mailto:' },
  ])('offers $name as a plain link that carries the video link', async ({ name, origin }) => {
    const { dialog } = await openShare();

    const target = within(dialog).getByRole('link', { name });

    expect(target.getAttribute('href')).toContain(origin);
    expect(target.getAttribute('href')).toContain(encodeURIComponent(LINK));
  });

  it('offers no share sheet where the device has none', async () => {
    const { dialog } = await openShare();

    expect(
      within(dialog).queryByRole('button', { name: 'Share with an app' })
    ).not.toBeInTheDocument();
  });

  it('hands the title and the link to the share sheet of the device', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const { user, dialog } = await openShare();

    await user.click(within(dialog).getByRole('button', { name: 'Share with an app' }));

    expect(share).toHaveBeenCalledWith({ title: 'Launch day', url: LINK });
  });

  it('is a drawer on a phone', async () => {
    stubCompactViewport();

    const { dialog } = await openShare();

    expect(dialog).toHaveAttribute('data-slot', 'drawer-content');
  });
});
