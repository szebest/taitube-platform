import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createPick, updatePick } from '@vp/api-contracts';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import type { HttpHandler } from 'msw';

import { toLocalInput } from '#app/features/admin/lib/pick-schedule';
import { adminPick, CATS, inHours, refusedField, renderCuration } from './picks.fixture';

const EXISTING = adminPick({ startsAt: inHours(24), endsAt: inHours(48) });
const FREE_START = toLocalInput(inHours(100));
const FREE_END = toLocalInput(inHours(124));

const openNew = async (handlers: HttpHandler[] = []) => {
  const rendered = await renderCuration([EXISTING], { handlers });
  await rendered.user.click(await screen.findByRole('button', { name: 'Schedule a pick' }));
  return { ...rendered, dialog: await screen.findByRole('dialog') };
};

const chooseVideo = async (user: Awaited<ReturnType<typeof openNew>>['user']) =>
  user.click(await screen.findByRole('option', { name: 'Cats at dawn' }));

const setWindow = (startsAt: string, endsAt: string) => {
  fireEvent.change(screen.getByLabelText('Starts'), { target: { value: startsAt } });
  fireEvent.change(screen.getByLabelText('Ends'), { target: { value: endsAt } });
};

const save = (user: Awaited<ReturnType<typeof openNew>>['user']) =>
  user.click(screen.getByRole('button', { name: 'Save' }));

describe('apps/client/studio: PickDialog', () => {
  it('schedules the chosen video for a free window with its tidied note', async () => {
    const { user, requests } = await openNew();

    await chooseVideo(user);
    setWindow(FREE_START, FREE_END);
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  Start here ' } });
    await save(user);

    await waitFor(() =>
      expect(requests.created).toEqual([
        {
          videoId: CATS.id,
          startsAt: new Date(FREE_START).toISOString(),
          endsAt: new Date(FREE_END).toISOString(),
          note: 'Start here',
        },
      ])
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('previews the spotlight as the note is typed', async () => {
    const { user, dialog } = await openNew();

    await chooseVideo(user);
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Worth a look' } });

    const preview = within(dialog).getByRole('region', { name: 'Preview' });
    expect(within(preview).getByRole('heading', { name: 'Cats at dawn' })).toBeInTheDocument();
    expect(within(preview).getByText('Worth a look')).toBeInTheDocument();
  });

  it('shows an overlap with another pick before anything is saved', async () => {
    const { user, requests } = await openNew();

    await chooseVideo(user);
    setWindow(toLocalInput(inHours(30)), toLocalInput(inHours(40)));

    expect(screen.getByRole('alert')).toHaveTextContent(
      /This window overlaps another pick: Mountain lakes, /
    );
    await save(user);
    expect(requests.created).toEqual([]);
  });

  it.each([
    {
      name: 'a window that ends before it starts',
      start: 124,
      end: 100,
      message: 'A pick must end after it starts',
    },
    {
      name: 'a window already over',
      start: -48,
      end: -24,
      message: 'A pick must still be current or in the future',
    },
  ])('refuses $name', async ({ start, end, message }) => {
    const { user, requests } = await openNew();

    await chooseVideo(user);
    setWindow(toLocalInput(inHours(start)), toLocalInput(inHours(end)));
    await save(user);

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(requests.created).toEqual([]);
  });

  it('refuses a note over the limit, counting as it goes', async () => {
    const { user, requests } = await openNew();

    await chooseVideo(user);
    setWindow(FREE_START, FREE_END);
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'a'.repeat(281) } });
    await save(user);

    expect(screen.getByText('281 of 280')).toBeInTheDocument();
    expect(screen.getByText('Keep the note to 280 characters.')).toBeInTheDocument();
    expect(requests.created).toEqual([]);
  });

  it('asks for a video when none is chosen', async () => {
    const { user, requests } = await openNew();

    await save(user);

    expect(await screen.findByText('Choose a video.')).toBeInTheDocument();
    expect(requests.created).toEqual([]);
  });

  it.each([
    {
      name: 'a clash another admin just made',
      reply: () => problemReply('PICK_WINDOW_OVERLAP'),
      text: 'Another pick already holds part of that window.',
    },
    {
      name: 'a refused video',
      reply: () => refusedField('videoId'),
      text: 'Only a public, ready video can be picked.',
    },
    {
      name: 'a refused window',
      reply: () => refusedField('endsAt'),
      text: 'The window is not valid.',
    },
    {
      name: 'a refused note',
      reply: () => refusedField('note'),
      text: 'Keep the note to 280 characters.',
    },
  ])('shows $name on the form and keeps it open', async ({ reply, text }) => {
    const { user } = await openNew([mockEndpoint(createPick, reply)]);

    await chooseVideo(user);
    setWindow(FREE_START, FREE_END);
    await save(user);

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('says so when the pick could not be saved for another reason', async () => {
    const { user } = await openNew([mockEndpoint(createPick, () => problemReply('FORBIDDEN'))]);

    await chooseVideo(user);
    setWindow(FREE_START, FREE_END);
    await save(user);

    expect(await screen.findByText('The pick was not saved.')).toBeInTheDocument();
  });

  describe('editing', () => {
    const openEdit = async (handlers: HttpHandler[] = []) => {
      const rendered = await renderCuration([EXISTING], { handlers });
      const [chip] = await screen.findAllByRole('button', { name: /^Mountain lakes, / });
      await rendered.user.click(chip as HTMLElement);
      return { ...rendered, dialog: await screen.findByRole('dialog') };
    };

    it('opens with the pick in its fields and sends only what changed', async () => {
      const { user, requests } = await openEdit();

      expect(screen.getByLabelText('Starts')).toHaveValue(toLocalInput(EXISTING.startsAt));
      expect(screen.getByLabelText('Note')).toHaveValue('Start here');
      fireEvent.change(screen.getByLabelText('Note'), { target: { value: '' } });
      await save(user);

      await waitFor(() =>
        expect(requests.updated).toEqual([{ id: EXISTING.id, body: { note: null } }])
      );
    });

    it('keeps the window the pick already holds without calling it an overlap', async () => {
      await openEdit();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('closes without a request when nothing changed', async () => {
      const { user, requests } = await openEdit();

      await save(user);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(requests.updated).toEqual([]);
    });

    it('refuses a refused edit on the form', async () => {
      const { user } = await openEdit([
        mockEndpoint(updatePick, () => problemReply('PICK_WINDOW_OVERLAP')),
      ]);

      fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'New' } });
      await save(user);

      expect(
        await screen.findByText('Another pick already holds part of that window.')
      ).toBeInTheDocument();
    });

    it('offers to cancel the pick, after asking', async () => {
      const { user, requests } = await openEdit();

      await user.click(screen.getByRole('button', { name: 'Cancel this pick' }));
      await user.click(await screen.findByRole('button', { name: 'Cancel pick' }));

      await waitFor(() => expect(requests.cancelled).toEqual([EXISTING.id]));
    });
  });
});
