import { looksLikeQuestion } from '../question-markers';

describe('@vp/validation: looksLikeQuestion', () => {
  it.each([
    { text: 'is this live?', result: true },
    { text: 'What song is this', result: true },
    { text: 'how do you do that', result: true },
    { text: 'Great video. Why is the sky blue', result: true },
    { text: 'nice!\nwhere can I buy it', result: true },
    { text: 'WHEN does it end', result: true },
    { text: 'qué es esto¿', result: true },
    { text: 'really？', result: true },
    { text: 'the what of it', result: false },
    { text: 'whatever', result: false },
    { text: 'however you like it', result: false },
    { text: 'I know who did it, so great video', result: false },
    { text: 'great video', result: false },
    { text: '', result: false },
  ])('is $result for "$text"', ({ text, result }) => {
    expect(looksLikeQuestion(text)).toBe(result);
  });
});
