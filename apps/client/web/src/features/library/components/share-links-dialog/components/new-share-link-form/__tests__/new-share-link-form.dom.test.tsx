import { axeViolations } from '@kit/web-testing/dom';
import { screen, waitFor } from '@testing-library/react';
import { createPlaylistShareLink, type ShareLinkView } from '@vp/api-contracts';
import { MAX_ACTIVE_SHARE_LINKS, SHARE_LINK_LABEL_MAX_LENGTH } from '@vp/domain';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { NOW, uuid } from '#app/__tests__/library-fixtures';
import { LIST, renderPart } from '#app/features/library/__tests__/render-playlist';
import { NewShareLinkForm } from '../new-share-link-form';

const CREATED: ShareLinkView = {
  id: uuid(8800),
  token: 'abcdefghijklmnopqrstuv',
  label: null,
  expiresAt: null,
  revokedAt: null,
  createdAt: NOW,
  state: 'active',
  stats: { opens: 0, views: 0, watchSeconds: 0 },
};

async function renderForm(active = 0) {
  const bodies: unknown[] = [];
  const rendered = await renderPart(<NewShareLinkForm playlistId={LIST} active={active} />, {
    handlers: [
      mockEndpoint(createPlaylistShareLink, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(CREATED, { status: 201 });
      }),
    ],
  });
  return {
    ...rendered,
    bodies,
    label: screen.getByRole('textbox', { name: 'Label' }),
    create: screen.getByRole('button', { name: 'Create link' }),
  };
}

describe('apps/client/web: the new share link form', () => {
  it('creates a link that expires in 7 days by default, and empties the label', async () => {
    const { user, label, create, bodies } = await renderForm();

    expect(await axeViolations()).toEqual([]);
    await user.type(label, 'Class');
    await user.click(create);

    await waitFor(() => expect(bodies).toEqual([{ label: 'Class', expiresIn: '7d' }]));
    expect(await screen.findByText('Share link created')).toBeInTheDocument();
    await waitFor(() => expect(label).toHaveValue(''));
  });

  it('sends no label when none is typed, with the expiry chosen', async () => {
    const { user, create, bodies } = await renderForm();

    await user.click(screen.getByRole('combobox', { name: 'Expires after' }));
    await user.click(await screen.findByRole('option', { name: 'Never' }));
    await user.click(create);

    await waitFor(() => expect(bodies).toEqual([{ expiresIn: 'never' }]));
  });

  it.each([
    {
      case: 'a label too long',
      active: 0,
      typed: 'x'.repeat(SHARE_LINK_LABEL_MAX_LENGTH + 1),
      problem: `Use a label of up to ${SHARE_LINK_LABEL_MAX_LENGTH} characters`,
    },
    {
      case: 'the limit of working links reached',
      active: MAX_ACTIVE_SHARE_LINKS,
      typed: 'Class',
      problem: /limit|most/i,
    },
  ])('sends nothing and says why for $case', async ({ active, typed, problem }) => {
    const { user, label, create, bodies } = await renderForm(active);

    await user.type(label, typed);
    await user.click(create);

    expect(await screen.findByText(problem)).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });
});
