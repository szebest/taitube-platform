import {
  APPEARANCE_SETTINGS,
  type AppearancePreferences,
  type MergePatch,
  mapSection,
  NOTIFICATION_SETTINGS,
  type NotificationPreferences,
  PLAYBACK_SETTINGS,
  type PlaybackPreferences,
  PRIVACY_SETTINGS,
  type PrivacyPreferences,
  type SectionDefinition,
  type Setting,
  type SettingValue,
  type TextKind,
  type TokenOverridesSetting,
} from '@vp/domain/settings';
import { ErrorCodes } from '@vp/errors';
import { assertNever } from '@vp/result';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';

type PatchValue<S extends Setting> = S extends TokenOverridesSetting
  ? Readonly<Record<string, string | null>>
  : SettingValue<S>;

const TEXT_FORMAT: Readonly<Record<TextKind, string>> = {
  preferenceId: 'Lowercase kebab-case id, up to 32 characters; null for the default',
  accent: '#rrggbb in any case, stored lowercase; null for the theme accent',
  languageTag: 'BCP 47 language tag; null to follow the video',
};

/** A free value's check is a `@vp/domain-rules` rule the service runs, so only its type is here. */
function valueSchema(setting: Setting): z.ZodType {
  switch (setting.type) {
    case 'choice':
      return z.literal(setting.options);
    case 'flag':
      return z.boolean();
    case 'text':
      return (setting.kind === 'accent' ? z.string().toLowerCase() : z.string())
        .nullable()
        .describe(TEXT_FORMAT[setting.kind]);
    case 'tokenOverrides':
      return z
        .record(z.string(), z.string())
        .describe('camelCase token group to set id, at most 16');
    default:
      return assertNever(setting, 'Setting');
  }
}

function patchValueSchema(setting: Setting): z.ZodType {
  const value =
    setting.type === 'tokenOverrides'
      ? z.record(z.string(), z.string().nullable())
      : valueSchema(setting);
  return value.nullish();
}

function sectionSchema<D extends SectionDefinition>(definition: D) {
  return z.object(
    mapSection<{ [K in keyof D]: z.ZodType<SettingValue<D[K]>, SettingValue<D[K]>> }>(
      definition,
      valueSchema
    )
  );
}

function sectionPatchSchema<D extends SectionDefinition>(definition: D) {
  return z.object(
    mapSection<{
      [K in keyof D]: z.ZodOptional<z.ZodType<PatchValue<D[K]> | null, PatchValue<D[K]> | null>>;
    }>(definition, patchValueSchema)
  );
}

const AppearancePreferencesSchema = sectionSchema(
  APPEARANCE_SETTINGS
) satisfies z.ZodType<AppearancePreferences>;
const PlaybackPreferencesSchema = sectionSchema(
  PLAYBACK_SETTINGS
) satisfies z.ZodType<PlaybackPreferences>;
const PrivacyPreferencesSchema = sectionSchema(
  PRIVACY_SETTINGS
) satisfies z.ZodType<PrivacyPreferences>;
const NotificationPreferencesSchema = sectionSchema(
  NOTIFICATION_SETTINGS
) satisfies z.ZodType<NotificationPreferences>;

const AppearancePatchSchema = sectionPatchSchema(APPEARANCE_SETTINGS) satisfies z.ZodType<
  MergePatch<AppearancePreferences>
>;
const PlaybackPatchSchema = sectionPatchSchema(PLAYBACK_SETTINGS) satisfies z.ZodType<
  MergePatch<PlaybackPreferences>
>;
const PrivacyPatchSchema = sectionPatchSchema(PRIVACY_SETTINGS) satisfies z.ZodType<
  MergePatch<PrivacyPreferences>
>;
const NotificationPatchSchema = sectionPatchSchema(NOTIFICATION_SETTINGS) satisfies z.ZodType<
  MergePatch<NotificationPreferences>
>;

const PreferencesSchema = z.object({
  appearance: AppearancePreferencesSchema.nullable(),
  playback: PlaybackPreferencesSchema.nullable(),
  privacy: PrivacyPreferencesSchema.nullable(),
  notifications: NotificationPreferencesSchema.nullable(),
  version: z.number().int().nonnegative().describe('0 until the first save'),
  updatedAt: z.string().nullable().describe('ISO 8601 timestamp of the last save'),
});

const UpdatePreferencesSchema = z.object({
  version: z.number().int().nonnegative().describe('The version the patch was based on'),
  appearance: AppearancePatchSchema.nullish(),
  playback: PlaybackPatchSchema.nullish(),
  privacy: PrivacyPatchSchema.nullish(),
  notifications: NotificationPatchSchema.nullish(),
});

const PreferencesConflictErrorSchema = z.object({
  field: z.literal('version'),
  current: PreferencesSchema,
});

export const getPreferences = defineEndpoint({
  method: 'GET',
  path: '/v1/me/preferences',
  tag: 'Account',
  summary: 'Get my saved preferences',
  description:
    'Appearance, playback, privacy and notifications for the caller. A section is null until its first save and complete from then on; an account that never saved any is at version 0.',
  status: 200,
  result: PreferencesSchema,
  errors: { 401: [ErrorCodes.UNAUTHORIZED], 403: [ErrorCodes.FORBIDDEN] },
});

export const updatePreferences = defineEndpoint({
  method: 'PATCH',
  path: '/v1/me/preferences',
  tag: 'Account',
  summary: 'Save my preferences',
  description:
    'A section left out stays as stored and null clears it. Inside a section a field left out stays, null resets it to its default, the first save of a section fills the rest from the defaults, and overrides merge by token group. A stale version is a 409 VERSION_CONFLICT whose errors[0] is { field: "version", current } with the stored document; nothing is written.',
  body: UpdatePreferencesSchema,
  status: 200,
  result: PreferencesSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    409: [ErrorCodes.VERSION_CONFLICT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export type PreferencesView = z.infer<typeof PreferencesSchema>;
export type UpdatePreferencesBody = z.infer<typeof UpdatePreferencesSchema>;
/** The one entry of `Problem.errors` on a `VERSION_CONFLICT` from `PATCH /v1/me/preferences`. */
export type PreferencesConflictError = z.infer<typeof PreferencesConflictErrorSchema>;
