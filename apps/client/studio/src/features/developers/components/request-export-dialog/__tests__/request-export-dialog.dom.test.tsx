import { screen, within } from '@testing-library/react';
import { ErrorCodes } from '@vp/errors';
import { renderDevelopers } from '#app/features/developers/__tests__/render-developers';

async function openDialog(state: Parameters<typeof renderDevelopers>[0] = {}) {
  const rendered = await renderDevelopers(state);
  const section = screen.getByRole('region', { name: 'Exports' });
  await rendered.user.click(within(section).getByRole('button', { name: 'Request export' }));
  return { ...rendered, dialog: await screen.findByRole('dialog', { name: 'Request an export' }) };
}

describe('apps/client/studio: RequestExportDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for every kind as CSV over everything by default', async () => {
    const { user, dialog, requests } = await openDialog();

    await user.click(within(dialog).getByRole('button', { name: 'Request export' }));

    expect(await screen.findByText('Export requested')).toBeInTheDocument();
    expect(requests.exports).toEqual([{ kind: 'video_analytics', format: 'csv', params: {} }]);
  });

  it('sends the days of the range picked, today included', async () => {
    const { user, dialog, requests } = await openDialog();

    await user.click(within(dialog).getByRole('radio', { name: 'JSON' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Range' }));
    await user.click(await screen.findByRole('option', { name: 'Last 7 days' }));
    await user.click(within(dialog).getByRole('button', { name: 'Request export' }));

    await vi.waitFor(() =>
      expect(requests.exports).toEqual([
        {
          kind: 'video_analytics',
          format: 'json',
          params: { from: '2026-03-04', to: '2026-03-10' },
        },
      ])
    );
  });

  it('offers an analytics viewer the analytics kinds only', async () => {
    const { user, dialog } = await openDialog({ role: 'analytics' });

    await user.click(within(dialog).getByRole('combobox', { name: 'Data' }));

    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Video analytics',
      'Channel analytics',
    ]);
  });

  it('says why a second export while one runs is refused', async () => {
    const { user, dialog } = await openDialog({ createFailure: ErrorCodes.EXPORT_IN_PROGRESS });

    await user.click(within(dialog).getByRole('button', { name: 'Request export' }));

    expect(await screen.findByText('The export was not requested.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Request an export' })).toBeInTheDocument();
  });
});
