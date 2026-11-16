import type {
  AppEnvKey,
  EnvGroup,
  EnvKeyDoc,
  EnvKeyShape,
  EnvRequirement,
  ExtraEnvKeyDoc,
} from '../../packages/server/env-schema/src/index';
import type { ExampleEntry } from './parse-example';

export interface EnvRow {
  name: string;
  type: string;
  defaultText: string;
  requiredIn: string;
  secret: boolean;
  readBy: string;
  description: string;
  example: string;
}

export interface ExtraRow {
  name: string;
  secret: boolean;
  consumer: string;
  description: string;
  example: string;
}

interface Section<Row> {
  id: string;
  title: string;
  summary: string;
  rows: Row[];
}

export interface EnvModel {
  groups: Section<EnvRow>[];
  extras: Section<ExtraRow>[];
  minimalLocal: { name: string; value: string }[];
}

export interface EnvModelInput {
  docs: Record<AppEnvKey, EnvKeyDoc>;
  groups: readonly { id: EnvGroup; title: string; summary: string }[];
  describe: (key: AppEnvKey) => EnvKeyShape;
  extraDocs: Record<string, ExtraEnvKeyDoc>;
  extraGroups: readonly { id: string; title: string; summary: string }[];
  platform: Record<string, string>;
  example: readonly ExampleEntry[];
}

const REQUIREMENT_TEXT: Record<EnvRequirement, string> = {
  always: 'always',
  production: 'production',
  'jwks-auth': 'AUTH_MODE=jwks',
};

function defaultText({ default: fallback }: EnvKeyShape): string {
  switch (fallback.kind) {
    case 'required':
      return 'required';
    case 'unset':
      return 'unset';
    case 'value':
      return fallback.value === '' ? 'empty' : `\`${fallback.value}\``;
  }
}

function rowOf(key: AppEnvKey, doc: EnvKeyDoc, shape: EnvKeyShape): EnvRow {
  return {
    name: key,
    type: shape.type,
    defaultText: defaultText(shape),
    requiredIn: (doc.requiredIn ?? []).map((when) => REQUIREMENT_TEXT[when]).join(', '),
    secret: doc.visibility === 'secret',
    readBy: doc.readBy.join(', '),
    description: doc.description,
    example: doc.example,
  };
}

function minimalLocal(input: EnvModelInput): EnvModel['minimalLocal'] {
  const live = new Map(
    input.example.filter((entry) => !entry.commented && entry.value !== '').map((e) => [e.key, e])
  );
  return (Object.keys(input.docs) as AppEnvKey[]).flatMap((key) => {
    const entry = live.get(key);
    const hasDefault = input.describe(key).default.kind === 'value';
    return entry && !hasDefault ? [{ name: key, value: entry.value }] : [];
  });
}

export function buildModel(input: EnvModelInput): EnvModel {
  const docKeys = Object.keys(input.docs) as AppEnvKey[];

  return {
    groups: input.groups.map(({ id, title, summary }) => ({
      id,
      title,
      summary,
      rows: docKeys
        .filter((key) => input.docs[key].group === id)
        .map((key) => rowOf(key, input.docs[key], input.describe(key))),
    })),
    extras: input.extraGroups.map(({ id, title, summary }) => ({
      id,
      title,
      summary,
      rows: Object.entries(input.extraDocs)
        .filter(([, doc]) => doc.group === id)
        .map(([name, doc]) => ({
          name,
          secret: doc.visibility === 'secret',
          consumer: input.platform[name] ?? doc.readBy.join(', '),
          description: doc.description,
          example: doc.example,
        })),
    })),
    minimalLocal: minimalLocal(input),
  };
}
