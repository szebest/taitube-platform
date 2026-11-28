import { render, screen } from '@testing-library/react';
import { ErrorCodes } from '@vp/errors';
import { uuid } from '#app/__tests__/library-fixtures';
import { AppProviders } from '#app/__tests__/providers';
import { ItemResults, type ItemResultsProps } from '../item-results';

const renderResults = (props: Partial<ItemResultsProps> = {}) =>
  render(
    <ItemResults
      mode="copy"
      results={[
        { itemId: uuid(1), ok: true, duplicate: false },
        { itemId: uuid(2), ok: false, duplicate: false, code: ErrorCodes.VIDEO_NOT_FOUND },
        { itemId: uuid(3), ok: false, duplicate: false },
      ]}
      titleOf={(itemId) => (itemId === uuid(2) ? 'Old film' : undefined)}
      {...props}
    />,
    { wrapper: AppProviders }
  );

describe('apps/client/web: ItemResults', () => {
  it('names each refusal with its reason, an item the page does not know as untitled', () => {
    renderResults();

    expect(screen.getByText('Copied: 1')).toBeInTheDocument();
    expect(screen.getByText('Refused: 2')).toBeInTheDocument();
    expect(screen.getByText('Old film: its video is gone')).toBeInTheDocument();
    expect(screen.getByText(/: it was refused$/)).toBeInTheDocument();
  });
});
