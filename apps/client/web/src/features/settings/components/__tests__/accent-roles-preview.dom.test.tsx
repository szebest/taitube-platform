import { render, screen } from '@testing-library/react';
import { AppearanceProvider, DEFAULT_APPEARANCE } from '@vp/ui';

import { AppProviders } from '#app/__tests__/providers';
import { AccentRolesPreview } from '../accent-roles-preview';

const renderPreview = (hex: string, mode: 'dark' | 'light') =>
  render(
    <AppProviders>
      <AppearanceProvider stored={{ preference: { ...DEFAULT_APPEARANCE, mode }, source: 'none' }}>
        <AccentRolesPreview hex={hex} />
      </AppearanceProvider>
    </AppProviders>
  );

describe('apps/client/web: the accent roles preview', () => {
  it.each([
    { scenario: 'white on dark', mode: 'dark', hex: '#ffffff', verdict: 'Readable as picked' },
    {
      scenario: 'white on light',
      mode: 'light',
      hex: '#ffffff',
      verdict: /^Adjusted to #[0-9a-f]{6} so/i,
    },
    {
      scenario: 'near black on dark',
      mode: 'dark',
      hex: '#101010',
      verdict: /^Adjusted to #[0-9a-f]{6} so/i,
    },
  ] as const)('says whether $scenario holds as picked', ({ mode, hex, verdict }) => {
    renderPreview(hex, mode);

    expect(screen.getByRole('status')).toHaveTextContent(verdict);
  });

  it('lists the five derived roles, each with its contrast', () => {
    renderPreview('#3b82f6', 'dark');

    const roles = screen.getAllByRole('listitem');

    expect(roles).toHaveLength(5);
    for (const role of roles) {
      expect(role).toHaveTextContent(/\d+(\.\d)?:1/);
    }
    expect(roles.map((role) => role.textContent)).toEqual([
      expect.stringContaining('Accent'),
      expect.stringContaining('On hover'),
      expect.stringContaining('Soft'),
      expect.stringContaining('Text on accent'),
      expect.stringContaining('Accent text'),
    ]);
  });

  it('draws nothing for a value that is not a colour', () => {
    const { container } = renderPreview('red', 'dark');

    expect(container).toBeEmptyDOMElement();
  });
});
