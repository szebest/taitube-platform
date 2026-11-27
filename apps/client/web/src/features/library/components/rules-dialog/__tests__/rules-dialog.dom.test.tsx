import { screen, waitFor, within } from '@testing-library/react';
import { updatePlaylist } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail } from '#app/__tests__/library-fixtures';
import {
  chooseFromMore,
  LAZY,
  LIST,
  renderPlaylist,
  VIDEOS,
} from '#app/features/library/__tests__/render-playlist';
import { LazyRulesDialog } from '#app/features/library/components/rules-dialog/rules-dialog.lazy';

const RULES = {
  match: 'all' as const,
  conditions: [{ field: 'newer_than' as const, days: 14 }],
  sort: 'popular' as const,
  limit: 25,
};

beforeAll(() => LazyRulesDialog.preload());

describe('apps/client/web: the edit rules dialog', () => {
  it('starts from the saved rules and saves the change of the owner', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderPlaylist({ rules: RULES }, [
      mockEndpoint(updatePlaylist, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(playlistDetail(LIST, VIDEOS, { rules: RULES }));
      }),
    ]);

    await chooseFromMore(user, 'Edit rules');
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit rules' }, LAZY));

    expect(dialog.getByText('14 days')).toBeInTheDocument();
    await user.click(dialog.getByRole('radio', { name: 'Any condition' }));
    await user.click(dialog.getByRole('button', { name: 'Save rules' }));

    await waitFor(() => expect(bodies).toEqual([{ rules: { ...RULES, match: 'any' } }]));
    expect(await screen.findByText('Rules saved')).toBeInTheDocument();
  });
});
