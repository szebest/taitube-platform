import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { search } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { person } from '#app/features/library/__tests__/playlist-people';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import { ChannelPicker, type ChannelPickerProps } from '../channel-picker';

const ANA = { ...person(1, 'Ana'), bio: '', subscriberCount: 0 };
const BO = { ...person(2, 'Bo'), bio: '', subscriberCount: 0 };

async function renderPicker(found: (typeof ANA)[], props: Partial<ChannelPickerProps> = {}) {
  const asked: string[] = [];
  const onPick = vi.fn();
  const rendered = await renderPart(<ChannelPicker label="Channel" onPick={onPick} {...props} />, {
    handlers: [
      mockEndpoint(search, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json({
          items: found.map((data) => ({ type: 'channel' as const, data })),
          nextCursor: null,
          tookMs: 1,
          total: found.length,
          fuzzyFallback: false,
        });
      }),
    ],
  });
  return { ...rendered, asked, onPick, box: screen.getByRole('combobox', { name: 'Channel' }) };
}

describe('apps/client/web: the channel picker', () => {
  it('lists nothing until something is typed, then hands back the channel picked', async () => {
    const { user, box, onPick, asked } = await renderPicker([ANA, BO]);

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(asked).toEqual([]);
    expect(await axeViolations()).toEqual([]);

    await user.type(box, '@a');
    await user.click(await screen.findByRole('option', { name: /Ana/ }));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: ANA.id, handle: 'ana' }));
    expect(asked).toEqual(['a']);
    expect(box).toHaveValue('');
  });

  it('leaves out the channels already picked', async () => {
    const { user, box } = await renderPicker([ANA, BO], { exclude: [ANA.id] });

    await user.type(box, 'a');

    expect(await screen.findByRole('option', { name: /Bo/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Ana/ })).not.toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });

  it('says when no channel matches', async () => {
    const { user, box } = await renderPicker([]);

    await user.type(box, 'zz');

    expect(await screen.findByRole('status')).toHaveTextContent('No channel matches');
    expect(await axeViolations()).toEqual([]);
  });
});
