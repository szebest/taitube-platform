import { CommonErrorCodes } from '@kit/errors';
import { parseTheme, parseTokenSet } from '../parse';
import type { Theme } from '../schema/theme';
import { TOKEN_GROUPS, type TokenGroup, type TokenSet } from '../schema/token-group';

/** @public */
export interface AppearanceSubject {
  readonly themes: readonly Theme[];
  readonly defaultTheme: Theme;
  readonly offer: { readonly [G in TokenGroup]: readonly TokenSet<G>[] };
}

/** @public */
export type MakeAppearance = () => AppearanceSubject;

const duplicates = (ids: readonly string[]): string[] =>
  ids.filter((id, index) => ids.indexOf(id) !== index);

/** @public */
export function describeAppearanceContract(makeAppearance: MakeAppearance): void {
  describe('Appearance contract', () => {
    let appearance: AppearanceSubject;

    beforeEach(() => {
      appearance = makeAppearance();
    });

    it('offers each theme once, the default theme among them', () => {
      const ids = appearance.themes.map(({ id }) => id);

      expect(duplicates(ids)).toEqual([]);
      expect(ids).toContain(appearance.defaultTheme.id);
    });

    it('offers each set of a group once, filed under the group it belongs to', () => {
      const misfiled = TOKEN_GROUPS.flatMap((group) =>
        appearance.offer[group]
          .filter((set) => set.group !== group)
          .map(({ id }) => `${group}: ${id}`)
      );

      expect(misfiled).toEqual([]);
      expect(
        TOKEN_GROUPS.flatMap((group) => duplicates(appearance.offer[group].map(({ id }) => id)))
      ).toEqual([]);
    });

    it('offers, per group, the set each theme defaults to', () => {
      const unoffered = appearance.themes.flatMap(({ id, defaults }) =>
        TOKEN_GROUPS.filter(
          (group) => !appearance.offer[group].some((set) => set.id === defaults[group].id)
        ).map((group) => `${id}: ${group}`)
      );

      expect(unoffered).toEqual([]);
    });

    it('holds only themes and sets its schema parses', () => {
      const failed = [
        ...appearance.themes.map((theme) => parseTheme(theme)),
        ...TOKEN_GROUPS.flatMap((group) =>
          appearance.offer[group].map((set) => parseTokenSet(group, set))
        ),
      ].filter((parsed) => !parsed.ok);

      expect(failed).toEqual([]);
    });

    it('declines a theme that names a key its schema does not, as a validation failure', () => {
      expect(parseTheme({ ...appearance.defaultTheme, contractUnknown: true })).toMatchObject({
        ok: false,
        error: { code: CommonErrorCodes.VALIDATION_FAILED },
      });
    });
  });
}
