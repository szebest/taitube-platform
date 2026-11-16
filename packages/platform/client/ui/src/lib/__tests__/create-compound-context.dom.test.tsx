import { render, screen } from '@testing-library/react';
import { createCompoundContext } from '../create-compound-context';

const [ShelfContext, useShelf] = createCompoundContext<{ size: string }>('Shelf');

function ShelfTitle({ part }: { part?: string }) {
  return <h2>{useShelf(part).size}</h2>;
}

const renderTitle = ({ inRoot, part }: { inRoot: boolean; part?: string }) =>
  render(
    inRoot ? (
      <ShelfContext value={{ size: 'lg' }}>
        <ShelfTitle part={part} />
      </ShelfContext>
    ) : (
      <ShelfTitle part={part} />
    )
  );

describe('@vp/ui: createCompoundContext', () => {
  it('hands a part what its root shares', () => {
    renderTitle({ inRoot: true, part: 'Title' });

    expect(screen.getByRole('heading', { name: 'lg' })).toBeInTheDocument();
  });

  it.each([
    { part: 'Title', message: 'Shelf.Title must be inside Shelf.Root' },
    { part: undefined, message: 'A Shelf part must be inside Shelf.Root' },
  ])('names the part outside its root: $message', ({ part, message }) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderTitle({ inRoot: false, part })).toThrow(message);
  });
});
