import { render, screen } from '@testing-library/react';
import { DeveloperSection } from '../developer-section';

describe('apps/client/studio: DeveloperSection', () => {
  it('names the region by its heading and puts its action beside it', () => {
    render(
      <DeveloperSection
        title="Webhooks"
        description="Signed deliveries."
        action={<button type="button">Add webhook</button>}
      >
        <p>Rows</p>
      </DeveloperSection>
    );

    const region = screen.getByRole('region', { name: 'Webhooks' });
    expect(region).toContainElement(screen.getByRole('heading', { level: 2, name: 'Webhooks' }));
    expect(region).toContainElement(screen.getByRole('button', { name: 'Add webhook' }));
    expect(region).toHaveTextContent('Signed deliveries.');
  });
});
