import { render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { CustomizationSection } from '../customization-section';

type FooterProps = Parameters<typeof CustomizationSection.Footer>[0];

const renderSection = (footer: FooterProps) =>
  render(
    <CustomizationSection.Root>
      <CustomizationSection.Header>
        <CustomizationSection.Title>About</CustomizationSection.Title>
        <CustomizationSection.Description>What viewers read.</CustomizationSection.Description>
      </CustomizationSection.Header>
      <CustomizationSection.Body>
        <input aria-label="Field" />
      </CustomizationSection.Body>
      <CustomizationSection.Footer {...footer} />
    </CustomizationSection.Root>,
    { wrapper: AppProviders }
  );

describe('apps/client/studio: CustomizationSection', () => {
  it('names its form by its title, so each section is a landmark of its own', () => {
    renderSection({ saving: false, saved: false });

    expect(screen.getByRole('form', { name: 'About' })).toContainElement(
      screen.getByLabelText('Field')
    );
  });

  it.each([
    { scenario: 'saved', footer: { saving: false, saved: true }, text: 'Saved', role: 'status' },
    { scenario: 'saving', footer: { saving: true, saved: false }, text: 'Saving', role: 'status' },
    {
      scenario: 'refused',
      footer: { saving: false, saved: false, failure: 'Could not save.' },
      text: 'Could not save.',
      role: 'alert',
    },
  ])('says when it is $scenario', ({ footer, text, role }) => {
    renderSection(footer);

    expect(screen.getByRole(role)).toHaveTextContent(text);
  });

  it('keeps Save off while the section has nothing to save', () => {
    renderSection({ saving: false, saved: false, disabled: true });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('rejects a part used outside a section', () => {
    expect(() => render(<CustomizationSection.Title>x</CustomizationSection.Title>)).toThrow(
      'CustomizationSection.Title must be inside CustomizationSection.Root'
    );
  });
});
