import { token } from '@kit/di';
import { TokenCells } from '../token-cells';

const Name = token<string>('Name');
const Other = token<string>('Name');

describe('packages/composition: TokenCells', () => {
  it('hands a cell back typed by the token it was stored under', () => {
    const cells = new TokenCells();
    cells.set(Name, { value: 'raw' });

    const cell: { readonly value: string } | undefined = cells.get(Name);

    expect(cell?.value).toBe('raw');
  });

  it('keys by token identity, so two tokens sharing a name never collide', () => {
    const cells = new TokenCells();
    cells.set(Name, { value: 'raw' });

    expect(cells.get(Other)).toBeUndefined();
  });
});
