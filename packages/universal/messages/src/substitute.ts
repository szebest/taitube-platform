import { type FormatFailure, type IntlBinding, unrenderable, wrongKind } from '@vp/intl';
import { type Result, all, andThen, err, map, ok } from '@vp/result';
import type { Message, MessageConfig } from './define';

/** `{name}` or `{name:type}` - the whole placeholder grammar; branches carry `{?}` instead. */
const PLACEHOLDER = /\{(\w+)(?::(\w+))?\}/g;
const COUNT_IN_BRANCH = '{?}';

type Rendered = Result<string, FormatFailure>;

function describe(value: unknown): string {
  return Array.isArray(value) ? 'array' : typeof value;
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function plural(name: string, count: number, config: MessageConfig, intl: IntlBinding): Rendered {
  const branches = config.plural?.[name];
  if (branches === undefined) return err(unrenderable('message', `no plural branches for ${name}`));
  return andThen(intl.pluralCategory(count, branches.type), (category) =>
    map(intl.format({ type: 'number', value: count, options: branches.formatter }), (digits) =>
      (branches[category] ?? branches.other).replaceAll(COUNT_IN_BRANCH, digits)
    )
  );
}

function enumeration(name: string, key: string, config: MessageConfig): Rendered {
  const label = config.enum?.[name]?.[key];
  return label === undefined
    ? err(unrenderable('message', `no ${name} label for ${key}`))
    : ok(label);
}

function placeholder(
  name: string,
  kind: string | undefined,
  value: unknown,
  config: MessageConfig,
  intl: IntlBinding
): Rendered {
  const token = kind === undefined ? `{${name}}` : `{${name}:${kind}}`;
  const declined = err(wrongKind(token, describe(value)));
  switch (kind) {
    case undefined:
      return typeof value === 'string' || typeof value === 'number' ? intl.format(value) : declined;
    case 'number':
      return typeof value === 'number'
        ? intl.format({ type: 'number', value, options: config.number?.[name] })
        : declined;
    case 'date':
      return typeof value === 'string'
        ? intl.format({ type: 'date', value, options: config.date?.[name] })
        : declined;
    case 'list':
      return isStringList(value)
        ? intl.format({ type: 'list', value, options: config.list?.[name] })
        : declined;
    case 'plural':
      return typeof value === 'number' ? plural(name, value, config, intl) : declined;
    case 'enum':
      return typeof value === 'string' ? enumeration(name, value, config) : declined;
    default:
      return err(unrenderable('message', `unknown placeholder type ${kind}`));
  }
}

export interface Placeholder {
  readonly token: string;
  readonly name: string;
  readonly kind: string | undefined;
  readonly index: number;
}

/** The placeholders `Params` reads at the type level, read here at runtime by the same grammar. */
export function placeholders(template: string): Placeholder[] {
  return Array.from(template.matchAll(PLACEHOLDER), (match) => ({
    token: match[0],
    name: match[1] ?? '',
    kind: match[2],
    index: match.index,
  }));
}

/** Renders every placeholder through `@vp/intl`, so a message and a direct format agree. */
export function substitute(
  message: Message,
  args: Readonly<Record<string, unknown>>,
  intl: IntlBinding
): Rendered {
  const { template, config } = message;
  const pieces: Rendered[] = [];
  let copied = 0;
  for (const { token, name, kind, index } of placeholders(template)) {
    pieces.push(ok(template.slice(copied, index)));
    pieces.push(placeholder(name, kind, args[name], config, intl));
    copied = index + token.length;
  }
  pieces.push(ok(template.slice(copied)));
  return map(all(pieces), (parts) => parts.join(''));
}
