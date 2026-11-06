import { screen, within } from '@testing-library/react';
import { liveNow, liveStream } from '#app/features/live/__tests__/live-api.fixture';
import { renderLive } from '#app/features/live/__tests__/render-live';
import { LiveStats } from '../live-stats';

const STARTED = Date.parse('2026-11-05T10:00:00.000Z');

const figure = (label: string) => screen.getByText(label).closest('figure') as HTMLElement;

describe('apps/client/studio: LiveStats', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      now: STARTED + 3_725_000,
      toFake: ['Date', 'setInterval', 'clearInterval'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the viewers heard and the time live as a clock', () => {
    renderLive(
      <LiveStats stream={liveNow({ startedAt: new Date(STARTED).toISOString() })} viewers={42} />
    );

    expect(within(figure('Viewers now')).getByText('42')).toBeInTheDocument();
    expect(within(figure('Time live')).getByText('1:02:05')).toBeInTheDocument();
  });

  it('has no viewers or time to show while the stream is not live', () => {
    renderLive(<LiveStats stream={liveStream()} viewers={null} />);

    expect(within(figure('Viewers now')).getByText('No data yet')).toBeInTheDocument();
    expect(within(figure('Time live')).getByText('No data yet')).toBeInTheDocument();
  });

  it.each([
    {
      chat: { slowModeSeconds: 0, subscribersOnly: false },
      audience: 'Everyone can chat',
      slow: 'Slow mode off',
    },
    {
      chat: { slowModeSeconds: 30, subscribersOnly: true },
      audience: 'Subscribers only',
      slow: 'Slow mode: 30 seconds',
    },
  ])('describes the chat mode $audience, $slow', ({ chat, audience, slow }) => {
    renderLive(<LiveStats stream={liveStream({ chat })} viewers={null} />);

    expect(figure('Chat mode')).toHaveTextContent(audience);
    expect(figure('Chat mode')).toHaveTextContent(slow);
  });
});
