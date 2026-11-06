import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { variantNames } from '../../../lib/variant-names';
import { Card } from '..';
import type { CardRootProps } from '../card';
import { cardStyles } from '../card.variants';

const renderStatsCard = (props: CardRootProps = {}) =>
  render(
    <Card.Root {...props}>
      <Card.Header>
        <Card.Title asChild>
          <h2>Views</h2>
        </Card.Title>
        <Card.Description>Last 28 days</Card.Description>
        <Card.Action>
          <button type="button">Export</button>
        </Card.Action>
      </Card.Header>
      <Card.Body>1,204</Card.Body>
      <Card.Footer>Updated hourly</Card.Footer>
    </Card.Root>
  );

describe('@vp/ui: Card', () => {
  it.each(variantNames(cardStyles.variants.variant))(
    'heads a %s card with the title at the level the caller picks',
    (variant) => {
      renderStatsCard({ variant });

      expect(screen.getByRole('heading', { level: 2, name: 'Views' })).toBeInTheDocument();
      expect(screen.getByText('1,204')).toHaveAttribute('data-slot', 'card-body');
    }
  );

  it('becomes the link it is given, so the whole card is one target', () => {
    render(
      <Card.Root asChild>
        <a href="/watch/1">
          <Card.Title>Lisbon at night</Card.Title>
        </a>
      </Card.Root>
    );

    expect(screen.getByRole('link', { name: 'Lisbon at night' })).toHaveAttribute(
      'data-slot',
      'card'
    );
  });

  it('names a part used outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Card.Title>Views</Card.Title>)).toThrow(
      'Card.Title must be inside Card.Root'
    );
  });

  it('passes axe', async () => {
    renderStatsCard({ elevation: 2, size: 'sm' });

    expect(await axeViolations()).toEqual([]);
  });
});
