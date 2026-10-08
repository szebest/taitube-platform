import { render, screen } from '@testing-library/react';

import { THEMES, axeViolations } from '#app/__tests__/axe';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../card';

function StatsCard() {
  return (
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

describe('apps/web: Card', () => {
  it('heads its parts with the title', () => {
    render(<StatsCard />);

    const title = screen.getByRole('heading', { name: 'Views' });
    expect(title).toHaveAttribute('data-slot', 'card-title');
    expect(title.closest('[data-slot="card"]')).toHaveTextContent(
      'Last 28 days1,204Updated hourly'
    );
  });

  it.each(THEMES)('passes axe in the %s theme', async (theme) => {
    render(<StatsCard />);

    expect(await axeViolations(theme)).toEqual([]);
  });
});
