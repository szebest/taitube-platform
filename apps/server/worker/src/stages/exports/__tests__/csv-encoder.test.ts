import { csvEncoder } from '../csv-encoder';

describe('worker/exports: csv encoder', () => {
  it.each([
    { scenario: 'plain text', value: 'hello', cell: 'hello' },
    { scenario: 'a comma', value: 'a,b', cell: '"a,b"' },
    { scenario: 'a quote', value: 'say "hi"', cell: '"say ""hi"""' },
    { scenario: 'a newline', value: 'one\ntwo', cell: '"one\ntwo"' },
    { scenario: 'a carriage return', value: 'one\r\ntwo', cell: '"one\r\ntwo"' },
    { scenario: 'a formula', value: '=cmd|"/c calc"!A1', cell: `"'=cmd|""/c calc""!A1"` },
    { scenario: 'a plus', value: '+1', cell: "'+1" },
    { scenario: 'a minus', value: '-1', cell: "'-1" },
    { scenario: 'an at sign', value: '@SUM(A1)', cell: "'@SUM(A1)" },
    { scenario: 'a tab', value: '\tx', cell: "'\tx" },
    { scenario: 'a formula sign later in the text', value: 'a=b', cell: 'a=b' },
    { scenario: 'a negative number', value: -5, cell: '-5' },
    { scenario: 'a number', value: 12.5, cell: '12.5' },
    { scenario: 'a boolean', value: false, cell: 'false' },
    { scenario: 'null', value: null, cell: '' },
    { scenario: 'a list', value: ['a', 'b c'], cell: 'a|b c' },
    { scenario: 'a list starting with a formula', value: ['=x', 'y'], cell: "'=x|y" },
  ])('writes $scenario as a safe cell', ({ value, cell }) => {
    expect(csvEncoder(['value']).row({ value })).toBe(`${cell}\r\n`);
  });

  it('writes the header, then each row in column order, every record CRLF-ended', () => {
    const encoder = csvEncoder(['id', 'text', 'likes']);

    const file = [
      encoder.start,
      encoder.row({ text: '=cmd', likes: 2, id: 'c1' }),
      encoder.row({ id: 'c2', text: 'two\nlines', likes: 0 }),
      encoder.end,
    ].join('');

    expect(file).toBe('id,text,likes\r\nc1,\'=cmd,2\r\nc2,"two\nlines",0\r\n');
  });
});
