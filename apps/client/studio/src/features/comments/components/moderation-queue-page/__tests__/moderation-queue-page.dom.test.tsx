import { screen, within } from '@testing-library/react';
import { ErrorCodes } from '@vp/errors';
import { inboxComment } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { heldComment, renderQueue } from '#app/features/comments/__tests__/render-queue';

const ID = (n: number) => `0190c3a0-5e1d-7000-8000-00000000d0${String(n).padStart(2, '0')}`;
const AUTHOR = (n: number) => `0190c3a0-5e1d-7000-8000-00000000b0${String(n).padStart(2, '0')}`;

const withAuthor = (n: number, name: string) => ({
  userId: AUTHOR(n),
  channelId: null,
  handle: name.toLowerCase(),
  displayName: name,
  avatarUrl: null,
  isCreator: false,
});

const FIRST = heldComment({
  id: ID(1),
  content: 'Buy followers at example.com',
  author: withAuthor(1, 'Tomek'),
});
const SECOND = heldComment({
  id: ID(2),
  content: 'Where was this filmed?',
  author: withAuthor(2, 'Marta'),
});
const THIRD = heldComment({ id: ID(3), content: 'Lovely light', author: withAuthor(3, 'Ines') });
const HELD = [FIRST, SECOND, THIRD];

const option = (text: string) => screen.getByRole('option', { name: new RegExp(text) });
const open = () => screen.getByRole('article');
const idsOf = (requests: { bulks: { ids: string[] }[] }) => requests.bulks.map(({ ids }) => ids);

describe('apps/client/studio: the review queue', () => {
  it('opens on the first held comment with its video, why it was held and its author history', async () => {
    const earlier = inboxComment({
      id: ID(9),
      content: 'An earlier comment',
      status: 'hidden',
      author: FIRST.author,
    });
    const { requests } = await renderQueue({ held: HELD, history: [FIRST, earlier] });

    expect(await within(open()).findByText('An earlier comment')).toBeInTheDocument();
    expect(within(open()).getByText('Buy followers at example.com')).toBeInTheDocument();
    expect(within(open()).getByText('Contains a link')).toBeInTheDocument();
    expect(within(open()).getByRole('link', { name: 'On Alfama at 5 a.m.' })).toBeInTheDocument();
    expect(within(open()).getByText('Hidden')).toBeInTheDocument();
    expect(within(open()).queryByText(/^Held$/)).not.toBeInTheDocument();
    expect(requests.authors).toEqual([AUTHOR(1)]);
    expect(option('Tomek')).toHaveAttribute('aria-current', 'true');
  });

  it.each([
    { keys: 'j', moves: 'Marta' },
    { keys: 'jj', moves: 'Ines' },
    { keys: 'jk', moves: 'Tomek' },
    { keys: 'k', moves: 'Tomek' },
    { keys: 'jjj', moves: 'Ines' },
  ])('moves to $moves after $keys', async ({ keys, moves }) => {
    const { user } = await renderQueue({ held: HELD });

    await user.keyboard(keys);

    expect(option(moves)).toHaveAttribute('aria-current', 'true');
    expect(within(open()).getByRole('heading', { name: moves })).toBeInTheDocument();
  });

  it('approves the open comment and lets its row leave at once', async () => {
    const { user, requests } = await renderQueue({ held: HELD });

    await user.keyboard('a');

    expect(await screen.findByText('1 comment updated')).toBeInTheDocument();
    expect(requests.bulks).toEqual([{ ids: [FIRST.id], action: { action: 'approve' } }]);
    expect(option('Marta')).toHaveAttribute('aria-current', 'true');
  });

  it('opens the reason dialog on r, picks a reason by number and removes on Enter', async () => {
    const { user, requests } = await renderQueue({ held: HELD });

    await user.keyboard('r');
    await user.keyboard('2{Enter}');

    expect(await screen.findByText('1 comment updated')).toBeInTheDocument();
    expect(requests.bulks).toEqual([
      {
        ids: [FIRST.id],
        action: { action: 'remove', disclosure: 'visible', reason: 'harassment' },
      },
    ]);
  });

  it('hides silently at once, and asks why once v made the next action visible', async () => {
    const { user, requests } = await renderQueue({ held: HELD });
    const toolbar = () => screen.getByRole('toolbar', { name: 'Actions on the open comment' });
    expect(
      await within(toolbar()).findByRole('button', { name: /^Hide · Silent/ })
    ).toBeInTheDocument();

    await user.keyboard('h');
    await vi.waitFor(() => expect(requests.bulks).toHaveLength(1));
    await user.keyboard('v');

    expect(within(toolbar()).getByRole('button', { name: /^Hide · Visible/ })).toBeInTheDocument();
    expect(within(toolbar()).getByRole('button', { name: /^Remove · Silent/ })).toBeInTheDocument();
    await user.keyboard('h');
    expect(await screen.findByRole('dialog', { name: 'Hide with a reason' })).toBeInTheDocument();
    await user.keyboard('{Enter}');

    await vi.waitFor(() => expect(requests.bulks).toHaveLength(2));
    expect(requests.bulks.map(({ action }) => action)).toEqual([
      { action: 'hide', disclosure: 'silent' },
      { action: 'hide', disclosure: 'visible', reason: 'spam' },
    ]);
  });

  it('flips each action from its own default, and back on a second v', async () => {
    const { user } = await renderQueue({ held: HELD });
    const toolbar = () => screen.getByRole('toolbar', { name: 'Actions on the open comment' });
    const button = (name: RegExp) => within(toolbar()).getByRole('button', { name });
    expect(await within(toolbar()).findByRole('button', { name: /^Hide · Silent/ })).toBeVisible();

    await user.keyboard('v');
    expect(button(/^Hide · Visible/)).toBeInTheDocument();
    expect(button(/^Remove · Silent/)).toBeInTheDocument();
    expect(button(/^Flip who is told/)).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('v');
    expect(button(/^Hide · Silent/)).toBeInTheDocument();
    expect(button(/^Remove · Visible/)).toBeInTheDocument();
  });

  it('sends no disclosure when the settings are not readable, so the API applies the channel default', async () => {
    const { user, requests } = await renderQueue({ held: HELD, settingsRefused: true });
    const toolbar = () => screen.getByRole('toolbar', { name: 'Actions on the open comment' });
    expect(
      await within(toolbar()).findByRole('button', { name: /^Hide · Channel default/ })
    ).toBeInTheDocument();

    await user.keyboard('h');
    await user.keyboard('{Enter}');
    await vi.waitFor(() => expect(requests.bulks).toHaveLength(1));
    await user.keyboard('v');
    await user.keyboard('r');
    await user.keyboard('{Enter}');

    await vi.waitFor(() => expect(requests.bulks).toHaveLength(2));
    expect(requests.bulks.map(({ action }) => action)).toEqual([
      { action: 'hide', reason: 'spam' },
      { action: 'remove', disclosure: 'visible', reason: 'spam' },
    ]);
  });

  it('bans the author after the dialog, and applies a visible ban with the end it was given', async () => {
    const { user, requests } = await renderQueue({ held: HELD });

    await user.keyboard('b');
    await user.keyboard('{Enter}');

    await vi.waitFor(() => expect(requests.bulks).toHaveLength(1));
    expect(requests.bulks[0]?.action).toMatchObject({ action: 'ban', reason: 'Spam' });
  });

  it('acts on the selected comments when x marked some, and names how many', async () => {
    const { user, requests } = await renderQueue({ held: HELD });

    await user.keyboard('x');
    await user.keyboard('jjx');
    expect(await screen.findByText('Acting on 2 selected comments')).toBeInTheDocument();
    await user.keyboard('a');

    await vi.waitFor(() => expect(idsOf(requests)).toEqual([[FIRST.id, THIRD.id]]));
  });

  it('does not take a key typed in a field of the dialog as a shortcut', async () => {
    const { user, requests } = await renderQueue({ held: HELD });

    await user.keyboard('r');
    await user.type(
      await screen.findByRole('textbox', { name: 'Note to the author' }),
      'a j k h b'
    );

    expect(requests.bulks).toEqual([]);
    await user.keyboard('{Escape}');
    expect(option('Tomek')).toHaveAttribute('aria-current', 'true');
  });

  it('lists the keys on ?', async () => {
    const { user } = await renderQueue({ held: HELD });

    await user.keyboard('?');

    const help = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(help).getAllByRole('term')).toHaveLength(9);
    expect(within(help).getByText('Remove, with a reason')).toBeInTheDocument();
  });

  it('runs the same actions from the buttons', async () => {
    const { user, requests } = await renderQueue({ held: HELD });

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    await vi.waitFor(() => expect(idsOf(requests)).toEqual([[SECOND.id]]));
  });

  it('puts the row back and says so when the call fails', async () => {
    const { user } = await renderQueue({
      held: HELD,
      bulk: () => HttpResponse.json({ code: ErrorCodes.INTERNAL }, { status: 500 }),
    });

    await user.keyboard('a');

    expect(await screen.findByText('Nothing was changed. Try again.')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Tomek/ })).toBeInTheDocument();
  });

  it('says there is nothing to review when no comment is held', async () => {
    await renderQueue({ held: [] });

    expect(await screen.findByText('Nothing to review')).toBeInTheDocument();
  });
});
