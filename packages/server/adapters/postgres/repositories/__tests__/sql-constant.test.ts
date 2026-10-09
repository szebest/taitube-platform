import { sqlParams, sqlText } from '../../scopes/__tests__/sql-text';
import { constant } from '../sql-constant';

describe('adapters/postgres: sql constant', () => {
  it.each([
    [1.5, '1.5'],
    [1000, '1000'],
    [0.6, '0.6'],
  ])('inlines %s as the literal %s, never a parameter', (value, literal) => {
    expect(sqlText(constant(value))).toBe(literal);
    expect(sqlParams(constant(value))).toEqual([]);
  });
});
