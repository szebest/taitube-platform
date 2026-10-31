import { screen } from '@testing-library/react';
import { removeRecommendationFeedback } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { createToaster, ToastProvider } from '@vp/ui';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { FEEDBACK_ID } from '#app/features/recommendations/__tests__/recommendation-fixtures';
import { useUndoRecommendationFeedback } from '../use-undo-recommendation-feedback';

const withToasts = ({ children }: PropsWithChildren) => (
  <AppProviders>
    <ToastProvider toaster={createToaster()}>{children}</ToastProvider>
  </AppProviders>
);

describe('apps/client/web: useUndoRecommendationFeedback', () => {
  it('deletes the row of the caller', async () => {
    const removed: string[] = [];
    apiServer.use(
      mockEndpoint(removeRecommendationFeedback, ({ params }) => {
        removed.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      })
    );

    await runMutation(createQueryClient(), useUndoRecommendationFeedback, FEEDBACK_ID, withToasts);

    expect(removed).toEqual([FEEDBACK_ID]);
    expect(screen.queryByText('Could not undo that')).toBeNull();
  });
});
