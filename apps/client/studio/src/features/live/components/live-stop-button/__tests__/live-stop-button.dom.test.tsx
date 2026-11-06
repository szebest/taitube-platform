import { screen, within } from '@testing-library/react';
import { stopMyLiveStream } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { LIVE_STREAM_ID, mockEndpoint, problemReply } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';
import { liveApi, liveNow } from '#app/features/live/__tests__/live-api.fixture';
import { renderLive } from '#app/features/live/__tests__/render-live';
import { LiveStopButton } from '../live-stop-button';

function renderStop(handlers = liveApi(liveNow()).handlers) {
  return renderLive(<LiveStopButton streamId={LIVE_STREAM_ID} />, handlers);
}

describe('apps/client/studio: LiveStopButton', () => {
  it('asks before it stops, and stops nothing when the creator keeps streaming', async () => {
    const { handlers, stops } = liveApi(liveNow());
    const { user } = renderStop(handlers);

    await user.click(screen.getByRole('button', { name: 'Stop broadcast' }));
    expect(screen.getByRole('alertdialog', { name: 'Stop the broadcast?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep streaming' }));

    expect(stops).toEqual([]);
  });

  it('stops the stream once confirmed, and says so', async () => {
    const { handlers, stops } = liveApi(liveNow());
    const { user } = renderStop(handlers);

    await user.click(screen.getByRole('button', { name: 'Stop broadcast' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Stop broadcast' })
    );

    expect(await screen.findByText('Broadcast stopped')).toBeInTheDocument();
    expect(stops).toEqual([LIVE_STREAM_ID]);
  });

  it('toasts the presented error when the API refuses', async () => {
    const { user } = renderStop([
      mockEndpoint(stopMyLiveStream, () => problemReply(ErrorCodes.LIVE_STREAM_NOT_LIVE)),
    ]);

    await user.click(screen.getByRole('button', { name: 'Stop broadcast' }));
    const confirm = within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Stop broadcast',
    });
    await user.click(confirm);

    expect(await screen.findByText('The broadcast did not stop')).toBeInTheDocument();
    expect(screen.getByText('This stream is not live right now.')).toBeInTheDocument();
  });

  it('passes axe', async () => {
    renderStop();

    expect(await axeViolations()).toEqual([]);
  });
});
