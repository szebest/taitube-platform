import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../card';

function renderStatsCard() {
  return render(
    <Card>
      <CardHeader>
        <CardTitle>Views</CardTitle>
        <CardDescription>Last 28 days</CardDescription>
      </CardHeader>
      <CardContent>1,204</CardContent>
      <CardFooter>Updated hourly</CardFooter>
    </Card>
  );
}

describe('@vp/ui: Card', () => {
  it('heads its parts with the title', () => {
    renderStatsCard();

    const title = screen.getByRole('heading', { name: 'Views' });
    expect(title).toHaveAttribute('data-slot', 'card-title');
    expect(title.closest('[data-slot="card"]')).toHaveTextContent(
      'Last 28 days1,204Updated hourly'
    );
  });

  it('passes axe', async () => {
    renderStatsCard();

    expect(await axeViolations()).toEqual([]);
  });
});
