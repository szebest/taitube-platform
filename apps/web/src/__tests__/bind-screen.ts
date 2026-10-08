import { screen, within } from '@testing-library/react';

export function bindScreen(): void {
  Object.assign(screen, within(document.body));
}
