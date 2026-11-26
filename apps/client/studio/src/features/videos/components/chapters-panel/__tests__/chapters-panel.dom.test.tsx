import { axeViolations } from '@kit/web-testing/dom';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { CHAPTERS, serveVideoTools } from '#app/features/videos/__tests__/video-tools-api.fixture';
import { getRouter } from '#app/router';

async function renderChapters(
  options: Parameters<typeof serveVideoTools>[1] = {},
  chapters = CHAPTERS,
  durationMs: number | null = 120_000
) {
  const served = serveVideoTools(
    video({ title: 'Launch day', chapters, durationMs: durationMs ?? undefined }),
    options
  );
  const rendered = await renderRoute(getRouter, `/videos/${VIDEO_ID}/edit?tab=chapters`, {
    handlers: [signInBrowser()],
  });
  await screen.findByRole('heading', { name: 'Chapters' });
  return { ...served, ...rendered, user: userEvent.setup() };
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

  it('ticks each chapter on the timeline by its time', async () => {
    const { container } = await renderChapters();

    expect(
      [...container.querySelectorAll('[data-slot="timeline-marker"]')].map((tick) =>
        tick.getAttribute('title')
      )
    ).toEqual(['Chapter 1 at 0:00', 'Chapter 2 at 0:20', 'Chapter 3 at 1:00']);
  });

  it('sets the start of a chapter from the scrub position', async () => {
    const { user } = await renderChapters();

    screen.getByRole('slider', { name: 'Scrub position' }).focus();
    await user.keyboard('{ArrowRight>5/}');
    await user.click(screen.getByRole('button', { name: 'Use the playhead for chapter 2' }));

    expect((start(2) as HTMLInputElement).value).toBe('0:05');
  });

  it('leaves the timeline and its buttons out when the length of the video is unknown', async () => {
    await renderChapters({}, CHAPTERS, null);

    expect(screen.queryByRole('slider', { name: 'Scrub position' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Use the playhead/ })).not.toBeInTheDocument();
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
