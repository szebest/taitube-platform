import { defineKind, unrenderable } from '@kit/intl';
import { err, ok } from '@kit/result';
import { isConfigKey, isRecord, messageKind } from '../kind';

type Labels = Readonly<Record<string, string>>;

const isLabels = (value: unknown): value is Labels =>
  isRecord(value) && Object.values(value).every((label) => typeof label === 'string');

/** `{state:enum}`: one of the keys of its required labels; the argument's type is those keys. */
export const enumKind = messageKind(
  defineKind({
    name: 'enum',
    arg: isConfigKey,
    options: (value, kind) =>
      isLabels(value) ? ok(value) : err(unrenderable(kind, 'labels that are not all text')),
    render: (value, labels) => {
      const label = labels?.[value];
      return label === undefined ? err(unrenderable('enum', `no label for ${value}`)) : ok(label);
    },
  }),
  'required'
);
