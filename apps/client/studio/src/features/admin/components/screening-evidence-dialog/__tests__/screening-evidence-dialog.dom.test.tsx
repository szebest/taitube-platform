import { screen, within } from '@testing-library/react';
import {
  renderScreening,
  screeningCase,
  screeningFinding,
} from '#app/features/admin/__tests__/screening.fixture';

const APPEALED = screeningCase({
  title: 'Held clip',
  reasons: [screeningFinding({ reason: 'NSFW', score: 0.8, flaggedShare: 0.4 })],
  flags: [screeningFinding({ reason: 'METADATA_SPAM', score: 0.5, signals: ['Too many links'] })],
  appeal: {
    id: '0190c3a0-5e1d-7000-8000-000000000b01',
    message: 'It is my own footage',
    createdAt: '2026-10-02T00:00:00.000Z',
    rejectedBy: null,
    resolvedAt: null,
  },
  decisionNote: 'Explicit frames',
});

const open = async (screening = APPEALED) => {
  const rendered = await renderScreening('/admin/screening', { cases: [[screening]] });
  await rendered.user.click(await screen.findByRole('button', { name: /^Evidence for/ }));
  return { ...rendered, dialog: await screen.findByRole('dialog') };
};

describe('apps/client/studio: ScreeningEvidenceDialog', () => {
  it('shows a block for each reason and flag, the appeal and the note', async () => {
    const { dialog } = await open();
    const inside = within(dialog);

    expect(dialog).toHaveAccessibleName('Evidence for Held clip');
    expect(inside.getByRole('region', { name: /Explicit content/ })).toBeInTheDocument();
    expect(inside.getByRole('region', { name: /Spam in the text/ })).toBeInTheDocument();
    expect(inside.getByText('It is my own footage')).toBeInTheDocument();
    expect(inside.getByText('Reason given: Explicit frames')).toBeInTheDocument();
  });

  it('states what the matcher cannot do', async () => {
    const { dialog } = await open();

    expect(within(dialog).getByText('What the matcher cannot do')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Heavy cropping, speed changes and re-recording a screen/)
    ).toBeInTheDocument();
  });

  it('shows no appeal or note when there are none', async () => {
    const { dialog } = await open(screeningCase({ title: 'Plain clip' }));

    expect(within(dialog).queryByText('Appeal from the creator')).toBeNull();
    expect(within(dialog).queryByText(/Reason given/)).toBeNull();
  });

  it('closes', async () => {
    const { user } = await open();

    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement);

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
