import { randomUUID } from 'node:crypto';
import type { SearchSuggestionIndexPort } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface SearchSuggestionIndexSubject {
  readonly index: SearchSuggestionIndexPort;
  /** Ends the counting window of `text`, as if `countWindowSeconds` had passed. */
  endWindow(text: string): Promise<void>;
  close(): Promise<void>;
}

/** Small enough that a spec fills a prefix in a handful of writes. */
export const CONTRACT_KEPT_PER_PREFIX = 3;

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

    const searchedInWindows = async (text: string, windows: number) => {
      for (let n = 0; n < windows; n += 1) {
        expectOk(await index.record(text));
        await subject.endWindow(text);
      }
    };

    it('suggests nothing under a prefix nobody searched', async () => {
      expect(expectOk(await index.suggest(stem, 5))).toEqual([]);
    });

    it('completes a prefix with the queries searched in the most windows first', async () => {
      await searchedInWindows(`${stem} react`, 1);
      await searchedInWindows(`${stem} rust`, 3);
      await searchedInWindows(`${stem} ruby`, 2);

      expect(expectOk(await index.suggest(`${stem} r`, 5))).toEqual([
        `${stem} rust`,
        `${stem} ruby`,
        `${stem} react`,
      ]);
      expect(expectOk(await index.suggest(`${stem} ru`, 1))).toEqual([`${stem} rust`]);
    });

    it('counts a text once however often it is searched within one window', async () => {
      await searchedInWindows(`${stem}-a`, 1);
      for (let n = 0; n < 5; n += 1) expectOk(await index.record(`${stem}-b`));

      expect(expectOk(await index.suggest(stem, 5))).toEqual([`${stem}-b`, `${stem}-a`]);
    });

    it('files a query under its own full text too', async () => {
      await searchedInWindows(`${stem}x`, 1);

      expect(expectOk(await index.suggest(`${stem}x`, 5))).toEqual([`${stem}x`]);
    });

    it('lets a new query into a full prefix in place of the least searched one', async () => {
      await searchedInWindows(`${stem}-a`, 3);
      await searchedInWindows(`${stem}-b`, 2);
      await searchedInWindows(`${stem}-c`, 2);
      await searchedInWindows(`${stem}-d`, 1);

      expect(expectOk(await index.suggest(stem, 5))).toEqual([
        `${stem}-d`,
        `${stem}-a`,
        `${stem}-c`,
      ]);
    });
  });
}
