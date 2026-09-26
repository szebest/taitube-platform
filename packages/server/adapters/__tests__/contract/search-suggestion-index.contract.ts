import { randomUUID } from 'node:crypto';
import type { SearchSuggestionIndexPort } from '@vp/core/ports';
import { SEARCH_SUGGESTIONS } from '@vp/domain';
import { expectOk } from '@vp/testing/result';

export interface SearchSuggestionIndexSubject {
  readonly index: SearchSuggestionIndexPort;
  close(): Promise<void>;
}

export type MakeSearchSuggestionIndexSubject = () => Promise<SearchSuggestionIndexSubject>;

export function describeSearchSuggestionIndexContract(
  makeSubject: MakeSearchSuggestionIndexSubject
): void {
  describe('SearchSuggestionIndex contract', () => {
    let subject: SearchSuggestionIndexSubject;
    let index: SearchSuggestionIndexPort;
    let stem: string;

    beforeAll(async () => {
      subject = await makeSubject();
      index = subject.index;
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      stem = `q${randomUUID().slice(0, 8)}`;
    });

    const record = async (text: string, times = 1) => {
      for (let n = 0; n < times; n += 1) expectOk(await index.record(text));
    };

    it('suggests nothing under a prefix nobody searched', async () => {
      expect(expectOk(await index.suggest(stem, 5))).toEqual([]);
    });

    it('completes a prefix with the most searched queries first', async () => {
      await record(`${stem} react`, 1);
      await record(`${stem} rust`, 3);
      await record(`${stem} ruby`, 2);

      expect(expectOk(await index.suggest(`${stem} r`, 5))).toEqual([
        `${stem} rust`,
        `${stem} ruby`,
        `${stem} react`,
      ]);
      expect(expectOk(await index.suggest(`${stem} ru`, 1))).toEqual([`${stem} rust`]);
    });

    it('files a query under its own full text too', async () => {
      await record(`${stem}x`);

      expect(expectOk(await index.suggest(`${stem}x`, 5))).toEqual([`${stem}x`]);
    });

    it('keeps only the most searched queries under one prefix', async () => {
      const extra = SEARCH_SUGGESTIONS.keptPerPrefix;
      await record(`${stem}-favourite`, 2);
      for (let n = 0; n < extra; n += 1) await record(`${stem}-${String(n).padStart(3, '0')}`);

      const kept = expectOk(await index.suggest(stem, extra + 5));

      expect(kept).toHaveLength(extra);
      expect(kept[0]).toBe(`${stem}-favourite`);
    });
  });
}
