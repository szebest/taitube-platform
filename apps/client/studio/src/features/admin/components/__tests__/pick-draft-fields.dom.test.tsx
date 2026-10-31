import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { listAdminVideos } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import type { PickVideo } from '#app/features/admin/api/pick-videos';
import type { PickDraft } from '#app/features/admin/lib/pick-draft';
import { PickDraftFields, type PickDraftFieldsProps } from '../pick-draft-fields';
import { CATS } from './picks.fixture';

function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <AppProviders>{children}</AppProviders>
    </QueryClientProvider>
  );
}

const DRAFT: PickDraft = {
  video: CATS as PickVideo,
  startsAt: '2026-11-02T09:00',
  endsAt: '2026-11-03T09:00',
  note: 'Start here',
};

const renderFields = (props: Partial<PickDraftFieldsProps> = {}) => {
  const onChange = vi.fn();
  apiServer.use(
    mockEndpoint(listAdminVideos, () => HttpResponse.json({ items: [CATS], nextCursor: null }))
  );
  render(
    <PickDraftFields
      draft={DRAFT}
      onChange={onChange}
      issues={{ video: undefined, window: undefined, note: false }}
      {...props}
    />,
    { wrapper: Providers }
  );
  return { onChange };
};

describe('apps/client/studio: PickDraftFields', () => {
  it('shows the draft in its fields and in the preview beside them', async () => {
    renderFields();

    expect(screen.getByLabelText('Starts')).toHaveValue('2026-11-02T09:00');
    expect(screen.getByLabelText('Note')).toHaveValue('Start here');
    expect(screen.getByRole('region', { name: 'Preview' })).toHaveTextContent('Start here');
    expect(await screen.findByText('Picked: Cats at dawn')).toBeInTheDocument();
  });

  it('reports a change to one field at a time', () => {
    const { onChange } = renderFields();

    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'New' } });

    expect(onChange).toHaveBeenCalledWith({ note: 'New' });
  });

  it('shows the issues it is handed', () => {
    renderFields({
      issues: { video: 'Choose a video.', window: { kind: 'incomplete' }, note: true },
    });

    expect(screen.getByText('Choose a video.')).toBeInTheDocument();
    expect(screen.getByText('Set when the pick starts and ends.')).toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toBeInvalid();
  });
});
