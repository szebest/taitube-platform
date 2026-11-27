import { screen } from '@testing-library/react';
import { search } from '@vp/api-contracts';
import { SMART_PLAYLIST_MAX_CHANNELS } from '@vp/domain';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { person } from '#app/features/library/__tests__/playlist-people';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import type { ChannelDraft } from '#app/features/library/utils/rules-form';
import { ChannelOperand } from '../channel-operand';

const ANA = { ...person(1, 'Ana'), bio: '', subscriberCount: 0 };
const BO = { ...person(2, 'Bo'), bio: '', subscriberCount: 0 };
const LABEL = `Channels, up to ${SMART_PLAYLIST_MAX_CHANNELS}`;

async function renderChannels(channels: ChannelDraft[]) {
  const onChange = vi.fn();
  const rendered = await renderPart(<ChannelOperand channels={channels} onChange={onChange} />, {
    handlers: [
      mockEndpoint(search, () =>
        HttpResponse.json({
          items: [ANA, BO].map((data) => ({ type: 'channel' as const, data })),
          nextCursor: null,
          tookMs: 1,
          total: 2,
          fuzzyFallback: false,
        })
      ),
    ],
  });
  return { ...rendered, onChange };
}

describe('apps/client/web: the channel operand', () => {
  it('adds the channel picked after the ones held', async () => {
    const { user, onChange } = await renderChannels([{ id: ANA.id, displayName: 'Ana' }]);

    await user.type(screen.getByRole('combobox', { name: LABEL }), 'b');

    expect(await screen.findByRole('option', { name: /Bo/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Ana/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Bo/ }));

    expect(onChange).toHaveBeenCalledWith([
      { id: ANA.id, displayName: 'Ana' },
      { id: BO.id, displayName: 'Bo' },
    ]);
  });

  it('drops a channel when its chip is removed', async () => {
    const { user, onChange } = await renderChannels([
      { id: ANA.id, displayName: 'Ana' },
      { id: BO.id, displayName: 'Bo' },
    ]);

    await user.click(screen.getByRole('button', { name: 'Remove Ana' }));

    expect(onChange).toHaveBeenCalledWith([{ id: BO.id, displayName: 'Bo' }]);
  });

  it('shows no chips for none held', async () => {
    await renderChannels([]);

    expect(screen.queryAllByRole('listitem')).toEqual([]);
    expect(screen.getByRole('combobox', { name: LABEL })).toBeInTheDocument();
  });

  it('stops offering the search at the limit', async () => {
    await renderChannels(
      Array.from({ length: SMART_PLAYLIST_MAX_CHANNELS }, (_, n) => ({
        id: person(n, `Ch${n}`).id,
        displayName: `Ch${n}`,
      }))
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(SMART_PLAYLIST_MAX_CHANNELS);
    expect(screen.queryByRole('combobox', { name: LABEL })).not.toBeInTheDocument();
  });
});
