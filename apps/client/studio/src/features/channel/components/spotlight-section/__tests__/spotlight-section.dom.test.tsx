import { screen, within } from '@testing-library/react';
import { setMySpotlight } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw';
import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

const section = () => screen.getByRole('form', { name: 'Trailer and welcome back' });

describe('apps/client/studio: spotlight section', () => {
  it('opens on the default tab with nothing set and nothing to save', async () => {
    await renderCustomization();

    expect(within(section()).getByText('Trailer for visitors')).toBeInTheDocument();
    expect(within(section()).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('offers a tab for each language the app is translated into', async () => {
    await renderCustomization();

    expect(within(section()).getAllByRole('tab')).toHaveLength(2);
  });

  it('keeps a language with no description and no trailer out of what it saves', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderCustomization({}, [
      mockEndpoint(setMySpotlight, async ({ request }) => {
        const body = await request.json();
        bodies.push(body);
        return HttpResponse.json(body);
      }),
    ]);

    await user.click(within(section()).getAllByRole('tab')[1] as HTMLElement);
    await user.type(within(section()).getByLabelText(/Description in/), 'x');
    await user.clear(within(section()).getByLabelText(/Description in/));

    expect(within(section()).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(bodies).toEqual([]);
  });

  it.each([
    {
      scenario: 'a video that no longer qualifies',
      code: ErrorCodes.INVALID_SPOTLIGHT_VIDEO,
      words: 'A video must be public',
    },
    { scenario: 'any other failure', code: ErrorCodes.INTERNAL, words: 'Could not save' },
  ])('says so for $scenario', async ({ code, words }) => {
    const { user } = await renderCustomization({}, [
      mockEndpoint(setMySpotlight, () => problemReply(code)),
    ]);

    await user.click(within(section()).getAllByRole('tab')[1] as HTMLElement);
    await user.type(within(section()).getByLabelText(/Description in/), 'Opis');
    await user.click(within(section()).getByRole('button', { name: 'Save' }));

    expect(await within(section()).findByText(new RegExp(words))).toBeInTheDocument();
  });
});
