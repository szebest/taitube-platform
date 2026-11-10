import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { AnalyticsEmpty } from '../analytics-empty';

describe('apps/client/studio: AnalyticsEmpty', () => {
  it('names what is missing and when the figures will come', async () => {
    render(
      <AppProviders>
        <AnalyticsEmpty />
      </AppProviders>
    );

    expect(screen.getByRole('heading', { name: 'No views in this range yet' })).toBeVisible();
    expect(
      screen.getByText('The figures and charts appear once a video has been watched.')
    ).toBeVisible();
    expect(await axeViolations()).toEqual([]);
  });
});
