import {
  type FormatFailure,
  type FormatInput,
  type IntlBinding,
  type KindContext,
  type PresetTable,
  describeValue,
  resolveEntry,
  runKind,
  unrenderable,
  wrongKind,
} from '@kit/intl';
import { type Result, all, andThen, err, map, ok } from '@kit/result';
import { isRecord, type MessageKind } from './kind';
import type { AnyMessage } from './message';
import { placeholders } from './template';

type Rendered = Result<string, FormatFailure>;

/** What a message renders against: the context's intl, the engine's kinds and presets, the locale chain. */
export interface RenderScope {
  readonly intl: IntlBinding;
  readonly kinds: ReadonlyMap<string, MessageKind>;
  readonly presets: PresetTable;
  readonly chain: readonly string[];
}

/** The intl context a kind renders in, its nested `format` resolving presets as a config entry does. */
function messageContext(scope: RenderScope): KindContext {
  const { context } = scope.intl;
  const format = (value: FormatInput): Rendered => {
    if (typeof value !== 'object') return context.format(value);
    const options = resolveEntry(scope.presets, value.type, value.options, scope.chain);
    return andThen(options, (resolved) => context.format({ ...value, options: resolved }));
  };
  return { ...context, format };
}

function formatAs(
  scope: RenderScope,
  context: KindContext,
  token: string,
  name: string,
  value: unknown,
  entry: unknown
): Rendered {
  const kind = scope.kinds.get(name);
  if (kind === undefined) return err(unrenderable(token, `unknown kind ${name}`));
  return andThen(resolveEntry(scope.presets, name, entry, scope.chain), (options) =>
    runKind(kind, value, options, context, token)
  );
}

function bare(scope: RenderScope, name: string, value: unknown): Rendered {
  return typeof value === 'string' || typeof value === 'number'
    ? scope.intl.format(value)
    : err(wrongKind(`{${name}}`, describeValue(value)));
}

/** Renders every placeholder through its kind, and so through `@kit/intl`; the text between, as authored. */
export function renderMessage(message: AnyMessage, args: unknown, scope: RenderScope): Rendered {
  const values = isRecord(args) ? args : {};
  const context = messageContext(scope);
  const { template, config } = message;
  const pieces: Rendered[] = [];
  let copied = 0;
  for (const { name, kind, start, end } of placeholders(template)) {
    pieces.push(ok(template.slice(copied, start)));
    pieces.push(
      kind === undefined
        ? bare(scope, name, values[name])
        : formatAs(scope, context, `{${name}:${kind}}`, kind, values[name], config[kind]?.[name])
    );
    copied = end;
  }
  pieces.push(ok(template.slice(copied)));
  return map(all(pieces), (parts) => parts.join(''));
}
