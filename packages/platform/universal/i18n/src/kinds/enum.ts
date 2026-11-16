import { unrenderable } from '@vp/intl';
import { err, ok } from '@vp/result';
import { defineKind, isConfigKey, isRecord } from '../kind';

type Labels = Readonly<Record<string, string>>;

const isLabels = (value: unknown): value is Labels =>
  isRecord(value) && Object.values(value).every((label) => typeof label === 'string');

/** `{state:enum}`: one of the keys of its required labels; the argument's type is those keys. */
export const enumKind = defineKind({
  name: 'enum',
  config: 'required',
  arg: isConfigKey,
  options: isLabels,
  render: (value, labels) => {
    const label = labels?.[value];
    return label === undefined ? err(unrenderable('enum', `no label for ${value}`)) : ok(label);
  },
});
