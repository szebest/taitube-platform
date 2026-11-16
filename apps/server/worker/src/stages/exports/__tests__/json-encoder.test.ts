import { jsonEncoder } from '../json-encoder';

const encode = (rows: Record<string, unknown>[]) => {
  const encoder = jsonEncoder();
  return [encoder.start, ...rows.map((row) => encoder.row(row)), encoder.end].join('');
};

describe('worker/exports: json encoder', () => {
  it.each([
    { scenario: 'no rows', rows: [] },
    { scenario: 'one row', rows: [{ id: 'c1', text: '=cmd' }] },
    {
      scenario: 'several rows',
      rows: [
        { id: 'c1', tags: ['a'] },
        { id: 'c2', tags: [] },
      ],
    },
  ])('writes one JSON array of $scenario', ({ rows }) => {
    expect(JSON.parse(encode(rows))).toEqual(rows);
  });

  it('keeps text as text, a formula included', () => {
    expect(encode([{ text: '=cmd' }])).toContain('"text":"=cmd"');
  });
});
