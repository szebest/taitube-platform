import { TOKEN_GROUPS } from '@kit/design-tokens';
import type { AppearanceSubject } from '@kit/design-tokens/contract';
import { CommonErrorCodes } from '@kit/errors';
import { DEFAULT_APPEARANCE } from '../appearance/preference';
import type { registerTheme } from '../appearance/register-theme';
import { REDUCED_MOTION, type resolveAppearance } from '../appearance/resolve';

/** @public */
export interface AppearanceRegistrySubject {
  readonly appearance: AppearanceSubject;
  readonly resolveAppearance: typeof resolveAppearance;
  readonly registerTheme: typeof registerTheme;
}

/** @public */
export type MakeAppearanceRegistry = () => AppearanceRegistrySubject;

const CUSTOM_ID = 'contract-custom';
const UNOFFERED_ID = 'contract-unoffered';
const SETTINGS = { reducedMotion: false };

/** @public */
export function describeAppearanceRegistryContract(makeSubject: MakeAppearanceRegistry): void {
  describe('Appearance registry contract', () => {
    let subject: AppearanceRegistrySubject;

    beforeEach(() => {
      subject = makeSubject();
    });

    const resolveWith = (preference: Partial<typeof DEFAULT_APPEARANCE>) =>
      subject.resolveAppearance({ ...DEFAULT_APPEARANCE, ...preference }, SETTINGS);

    it('resolves no choice to the default theme and the sets that theme defaults to', () => {
      const { theme, sets } = resolveWith({});

      expect(theme.id).toBe(subject.appearance.defaultTheme.id);
      expect(TOKEN_GROUPS.map((group) => sets[group].id)).toEqual(
        TOKEN_GROUPS.map((group) => subject.appearance.defaultTheme.defaults[group].id)
      );
    });

    it('resolves the id of an offered theme to that theme, and any other id to the default', () => {
      const offered = subject.appearance.themes.map(
        ({ id }) => resolveWith({ theme: id }).theme.id
      );

      expect(offered).toEqual(subject.appearance.themes.map(({ id }) => id));
      expect(resolveWith({ theme: UNOFFERED_ID }).theme.id).toBe(
        subject.appearance.defaultTheme.id
      );
    });

    it('takes the viewer override of an offered set, and counts one it does not offer as no choice', () => {
      const { defaultTheme, offer } = subject.appearance;
      const alternatives = TOKEN_GROUPS.flatMap((group) => {
        const other = offer[group].find(({ id }) => id !== defaultTheme.defaults[group].id);
        return other ? [{ group, id: other.id }] : [];
      });
      const chosen = Object.fromEntries(alternatives.map(({ group, id }) => [group, id]));
      const unoffered = Object.fromEntries(alternatives.map(({ group }) => [group, UNOFFERED_ID]));

      expect(
        alternatives.map(({ group }) => resolveWith({ overrides: chosen }).sets[group].id)
      ).toEqual(alternatives.map(({ id }) => id));
      expect(
        alternatives.map(({ group }) => resolveWith({ overrides: unoffered }).sets[group].id)
      ).toEqual(alternatives.map(({ group }) => defaultTheme.defaults[group].id));
    });

    it('forces the reduced motion set when the registry offers it', () => {
      const { defaultTheme, offer } = subject.appearance;
      const { sets } = subject.resolveAppearance(DEFAULT_APPEARANCE, { reducedMotion: true });

      expect(sets.motion.id).toBe(
        offer.motion.some(({ id }) => id === REDUCED_MOTION)
          ? REDUCED_MOTION
          : defaultTheme.defaults.motion.id
      );
    });

    it('registers a theme that arrives as data, and resolves a preference that names it', () => {
      const custom = { ...subject.appearance.defaultTheme, id: CUSTOM_ID, name: 'Custom' };
      const registered = subject.registerTheme(custom, null);

      expect(registered).toMatchObject({ ok: true, value: { theme: { id: CUSTOM_ID } } });
      if (registered.ok) {
        expect(
          subject.resolveAppearance(
            { ...DEFAULT_APPEARANCE, theme: CUSTOM_ID },
            { ...SETTINGS, registered: [registered.value.theme] }
          ).theme.id
        ).toBe(CUSTOM_ID);
      }
      expect(resolveWith({ theme: CUSTOM_ID }).theme.id).toBe(subject.appearance.defaultTheme.id);
    });

    it('declines a theme that reuses the id of a built-in one', () => {
      expect(subject.registerTheme(subject.appearance.defaultTheme, null)).toMatchObject({
        ok: false,
        error: { code: CommonErrorCodes.VALIDATION_FAILED, field: 'id' },
      });
    });

    it('declines a theme that defaults to a set the registry does not offer', () => {
      const { defaultTheme } = subject.appearance;
      const unoffered = {
        ...defaultTheme,
        id: CUSTOM_ID,
        defaults: {
          ...defaultTheme.defaults,
          motion: { ...defaultTheme.defaults.motion, id: UNOFFERED_ID },
        },
      };

      expect(subject.registerTheme(unoffered, null)).toMatchObject({
        ok: false,
        error: { code: CommonErrorCodes.VALIDATION_FAILED, field: 'defaults.motion' },
      });
    });
  });
}
