import { screen } from '@testing-library/react';

import {
  adminVideo,
  commentReport,
  renderModeration,
} from '#app/features/admin/components/__tests__/moderation.fixture';

describe('apps/client/studio: /admin/moderation', () => {
  it('shows the videos and the reported comments as two sections of one page', async () => {
    const video = adminVideo({ title: 'Cats' });
    const report = commentReport();
    await renderModeration('/admin/moderation', { videos: [[video]], reports: [[report]] });

    expect(await screen.findByRole('heading', { name: 'Videos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reported comments' })).toBeInTheDocument();
    expect(await screen.findByText('Cats')).toBeInTheDocument();
    expect(await screen.findByText(report.comment.content)).toBeInTheDocument();
  });

  it('keeps the filters of the URL across a reload of the same address', async () => {
    const { router } = await renderModeration('/admin/moderation?status=READY&junk=1');

    expect(await screen.findByRole('heading', { name: 'Videos' })).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ status: 'READY' });
  });
});
