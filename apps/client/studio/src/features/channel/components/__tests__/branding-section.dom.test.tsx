import { screen, within } from '@testing-library/react';
import { issueChannelImageUpload } from '@vp/api-contracts';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import axios from 'axios';
import { HttpResponse } from 'msw/http';

import {
  renderCustomization,
  savesChannel,
} from '#app/features/channel/__tests__/render-customization';

const section = () => screen.getByRole('form', { name: 'Picture and banner' });
const save = () => within(section()).getByRole('button', { name: 'Save' });
const picture = () => within(section()).getByRole('img', { name: 'Picture preview' });

const PNG = (name = 'me.png') => new File(['abcd'], name, { type: 'image/png' });

function issuesKeys(bodies: unknown[] = []) {
  return mockEndpoint(issueChannelImageUpload, async ({ request }) => {
    const body = (await request.json()) as { kind: string };
    bodies.push(body);
    return HttpResponse.json(
      {
        key: `channels/c1/${body.kind}/i1.png`,
        uploadUrl: `http://localhost:9000/public/channels/c1/${body.kind}/i1.png`,
        headers: {},
        expiresAt: '2026-01-01T01:00:00.000Z',
      },
      { status: 201 }
    );
  });
}

function choose(
  user: Awaited<ReturnType<typeof renderCustomization>>['user'],
  label: RegExp,
  file: File
) {
  const input = within(section())
    .getByText(label)
    .closest('div')
    ?.querySelector('input[type="file"]');
  if (!input) throw new Error(`No file input under ${label}`);
  return user.upload(input as HTMLInputElement, file);
}

describe('apps/client/studio: branding section', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('previews the picture and the banner the channel has, with their guides', async () => {
    await renderCustomization({
      avatarUrl: 'https://cdn.test/a.png',
      bannerUrl: 'https://cdn.test/b.png',
    });

    expect(picture()).toHaveAttribute('src', 'https://cdn.test/a.png');
    expect(within(section()).getByRole('img', { name: 'Banner preview' })).toHaveAttribute(
      'src',
      'https://cdn.test/b.png'
    );
    expect(within(section()).getAllByText(/keep .* inside the guide/)).toHaveLength(2);
  });

  it('previews a chosen file at once, uploads it, and saves the key it was stored under', async () => {
    const bodies: unknown[] = [];
    const saved: unknown[] = [];
    const put = vi.spyOn(axios, 'put').mockResolvedValue({});
    const { user } = await renderCustomization({}, [issuesKeys(bodies), savesChannel({}, saved)]);

    await choose(user, /Drop a picture here/, PNG());
    expect(picture()).toHaveAttribute('src', 'blob:local-preview');
    await user.click(save());

    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ kind: 'avatar', contentType: 'image/png', sizeBytes: 4 }]);
    expect(put).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([{ avatarKey: 'channels/c1/avatar/i1.png' }]);
  });

  it('sends no address for an image the creator took away', async () => {
    const saved: unknown[] = [];
    const { user } = await renderCustomization({ bannerUrl: 'https://cdn.test/b.png' }, [
      savesChannel({}, saved),
    ]);

    await user.click(within(section()).getByRole('button', { name: 'Remove banner' }));
    expect(within(section()).queryByRole('img', { name: 'Banner preview' })).toBeNull();
    await user.click(save());

    expect(await within(section()).findByText('Saved')).toBeInTheDocument();
    expect(saved).toEqual([{ bannerUrl: null }]);
  });

  it('refuses a picture over its size cap and keeps the section from saving', async () => {
    const { user } = await renderCustomization();
    const heavy = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });

    await choose(user, /Drop a picture here/, heavy);

    expect(
      await within(section()).findByText(/exceeds the maximum upload size/)
    ).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('shows the failure and saves nothing when the upload does not go through', async () => {
    const saved: unknown[] = [];
    vi.spyOn(axios, 'put').mockRejectedValue(new Error('network'));
    apiServer.use(issuesKeys());
    const { user } = await renderCustomization({}, [savesChannel({}, saved)]);

    await choose(user, /Drop a banner here/, PNG('banner.png'));
    await user.click(save());

    expect(await within(section()).findByText('Could not save. Try again.')).toBeInTheDocument();
    expect(saved).toEqual([]);
  });
});
