import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VIDEO_ID, video } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { CHAPTERS, serveVideoTools } from '#app/features/videos/__tests__/video-tools-api.fixture';
import { getRouter } from '#app/router';

async function renderChapters(
  options: Parameters<typeof serveVideoTools>[1] = {},
  chapters = CHAPTERS
) {
  const served = serveVideoTools(video({ title: 'Launch day', chapters }), options);
  await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=chapters`, {
    handlers: [signInBrowser()],
  });
  await screen.findByRole('heading', { name: 'Chapters' });
  return { ...served, user: userEvent.setup() };
}

const start = (n: number) => screen.getByRole('textbox', { name: `Start of chapter ${n}` });
const title = (n: number) => screen.getByRole('textbox', { name: `Title of chapter ${n}` });

describe('apps/client/studio: ChaptersPanel', () => {
  it('shows the stored chapters as rows of a start and a title', async () => {
    await renderChapters();

    expect(
      [start(1), start(2), start(3)].map((field) => (field as HTMLInputElement).value)
    ).toEqual(['0:00', '0:20', '1:00']);
    expect((title(2) as HTMLInputElement).value).toBe('Middle');
  });

  it('saves the rows sorted by time against the video version', async () => {
    const { api, state, user } = await renderChapters();
    const { version } = api.stored;

    await user.clear(start(3));
    await user.type(start(3), '0:10');
    await user.click(screen.getByRole('button', { name: 'Save chapters' }));

    expect(await screen.findByText('Chapters saved')).toBeInTheDocument();
    expect(state.chapterPuts).toEqual([
      {
        version,
        chapters: [
          { startMs: 0, title: 'Intro' },
          { startMs: 10_000, title: 'End' },
          { startMs: 20_000, title: 'Middle' },
        ],
      },
    ]);
  });

  it.each([
    {
      name: 'a start that is not minutes and seconds',
      change: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.clear(start(2));
        await user.type(start(2), 'soon');
      },
      message: 'Write each start as minutes and seconds, like 1:30.',
    },
    {
      name: 'a chapter removed so that two remain',
      change: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole('button', { name: 'Remove chapter 3' }));
      },
      message: 'Check the chapters: A video has 3 to 50 chapters',
    },
  ])('says what is wrong with $name and sends nothing', async ({ change, message }) => {
    const { state, user } = await renderChapters();

    await change(user);
    await user.click(screen.getByRole('button', { name: 'Save chapters' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(state.chapterPuts).toEqual([]);
  });

  it('fills the rows from the transcript suggestions and saves nothing', async () => {
    const suggestions = [
      { startMs: 0, title: 'Onions, garlic, sauce' },
      { startMs: 120_000, title: 'Airport, flight, passport' },
    ];
    const { state, user } = await renderChapters({ suggestions }, []);

    await user.click(screen.getByRole('button', { name: 'Suggest from transcript' }));

    expect(
      await screen.findByText('Suggestions filled in. Edit them, then save.')
    ).toBeInTheDocument();
    expect((start(2) as HTMLInputElement).value).toBe('2:00');
    expect((title(2) as HTMLInputElement).value).toBe('Airport, flight, passport');
    expect(state.chapterPuts).toEqual([]);
  });

  it('says so when the transcript gives nothing', async () => {
    const { user } = await renderChapters({ suggestions: [] }, []);

    await user.click(screen.getByRole('button', { name: 'Suggest from transcript' }));

    expect(await screen.findByText('The transcript gave no suggestions.')).toBeInTheDocument();
  });

  it('asks what to do on a version conflict, and saves again on the newest version', async () => {
    const { state, user } = await renderChapters({ conflicts: 1 });

    await user.click(screen.getByRole('button', { name: 'Save chapters' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /overwrite/i }));

    expect(await screen.findByText('Chapters saved')).toBeInTheDocument();
    expect(state.chapterPuts).toHaveLength(2);
  });

  it('has no accessibility violations', async () => {
    await renderChapters();

    expect(await axeViolations()).toEqual([]);
  });
});
