import { invalidLayoutMarkdown } from '../failures';

describe('@vp/validation: invalidLayoutMarkdown', () => {
  it('names the refusal on the failure', () => {
    expect(invalidLayoutMarkdown('html')).toEqual({
      code: 'LAYOUT_MARKDOWN_INVALID',
      message: 'Rich text refused: html',
      reason: 'html',
    });
  });
});
