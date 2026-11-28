import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { getChannel } from '@vp/api-contracts';
import { channel, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import type { ChannelDraft } from '#app/features/library/utils/rules-form';
import { ChannelChip } from '../channel-chip';

const CHANNEL = channel({ displayName: 'Night Kitchen' });

async function renderChip(draft: ChannelDraft, reply: () => Response) {
  const read = vi.fn(reply);
  const onRemove = vi.fn();
  const rendered = await renderPart(<ChannelChip channel={draft} onRemove={onRemove} />, {
    handlers: [mockEndpoint(getChannel, () => read())],
  });
  return { ...rendered, read, onRemove };
}

const FOUND = () => HttpResponse.json(CHANNEL);

describe('apps/client/web: the channel chip', () => {
  it('shows a channel picked in the form by its name, without reading it', async () => {
    const { read } = await renderChip({ id: CHANNEL.id, displayName: 'Night Kitchen' }, FOUND);

    expect(await screen.findByRole('button', { name: 'Remove Night Kitchen' })).toBeVisible();
    expect(await axeViolations()).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it('reads the name of a channel that came with saved rules', async () => {
    const { read } = await renderChip({ id: CHANNEL.id, displayName: null }, FOUND);

    expect(await screen.findByRole('button', { name: 'Remove Night Kitchen' })).toBeVisible();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('calls it Someone while the name is unread, and removes the channel on a click', async () => {
    const { user, onRemove } = await renderChip({ id: CHANNEL.id, displayName: null }, FOUND);

    await user.click(screen.getByRole('button', { name: 'Remove Someone' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
