import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { AnalyticsRangeSwitch } from '../analytics-range-switch';

describe('apps/client/studio: AnalyticsRangeSwitch', () => {
  it('offers each range the API has and marks the current one', () => {
    render(
      <AppProviders>
        <AnalyticsRangeSwitch value="30d" onChange={vi.fn()} />
      </AppProviders>
    );

    expect(
      screen
        .getAllByRole('radio', { name: /days/ })
        .map((radio) => [radio.textContent, radio.getAttribute('aria-checked')])
    ).toEqual([
      ['7 days', 'false'],
      ['30 days', 'true'],
      ['90 days', 'false'],
    ]);
    expect(screen.getByRole('radiogroup', { name: 'Time range' })).toBeInTheDocument();
  });

  it('hands over the range that is picked', async () => {
    const onChange = vi.fn();
    render(
      <AppProviders>
        <AnalyticsRangeSwitch value="30d" onChange={onChange} />
      </AppProviders>
    );

    await userEvent.click(screen.getByRole('radio', { name: '90 days' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('90d');
  });
});
