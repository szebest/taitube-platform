import { screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { liveApi, liveStream } from '#app/features/live/__tests__/live-api.fixture';
import { renderLive } from '#app/features/live/__tests__/render-live';
import { LiveChatModeForm } from '../live-chat-mode-form';

function renderForm() {
  const { handlers, updates } = liveApi();
  const rendered = renderLive(<LiveChatModeForm stream={liveStream()} />, handlers);
  return { ...rendered, updates };
}

describe('apps/client/studio: LiveChatModeForm', () => {
  it('starts clean: nothing to save', () => {
    renderForm();

    expect(screen.getByRole('button', { name: 'Save chat mode' })).toBeDisabled();
  });

  it('saves the slow mode and subscribers-only as the chat settings of the stream', async () => {
    const { user, updates } = renderForm();

    await user.click(screen.getByRole('combobox', { name: 'Slow mode' }));
    await user.click(await screen.findByRole('option', { name: '30 seconds' }));
    await user.click(screen.getByRole('switch', { name: 'Subscribers only' }));
    await user.click(screen.getByRole('button', { name: 'Save chat mode' }));

    expect(await screen.findByText('Chat mode saved')).toBeInTheDocument();
    expect(updates).toEqual([{ chatSlowModeSeconds: 30, chatSubscribersOnly: true }]);
  });

  it('passes axe', async () => {
    renderForm();

    expect(await axeViolations()).toEqual([]);
  });
});
