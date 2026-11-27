import {
  type FormatFailure,
  type FormatInput,
  type IntlBinding,
  type KindContext,
  type ListDetail,
  type PresetTable,
  describeValue,
  resolveEntry,
  runKind,
  runParts,
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

export interface TextPart {
  readonly type: 'text';
  readonly text: string;
}

/** A placeholder whose kind has structure, `{names:list}`: its name and the detail a UI renders. */
export interface ListPart {
  readonly type: 'list';
  readonly name: string;
  readonly detail: ListDetail;
}

/** One piece of a rendered message: text as authored or formatted, or a list with its structure. */
export type MessagePart = TextPart | ListPart;

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

interface Placed {
  readonly kind: MessageKind;
  readonly token: string;
  readonly name: string;
  readonly value: unknown;
  readonly options: unknown;
}

type Place<T> = (placed: Placed, context: KindContext) => Result<T, FormatFailure>;

function bare(scope: RenderScope, name: string, value: unknown): Rendered {
  return typeof value === 'string' || typeof value === 'number'
    ? scope.intl.format(value)
    : err(wrongKind(`{${name}}`, describeValue(value)));
}

/** Walks the template once: text between placeholders as authored, each placeholder through `place`. */
function walk<T>(
  message: AnyMessage,
  args: unknown,
  scope: RenderScope,
  text: (text: string) => T,
  place: Place<T>
): Result<T[], FormatFailure> {
  const values = isRecord(args) ? args : {};
  const context = messageContext(scope);
  const { template, config } = message;
  const pieces: Result<T, FormatFailure>[] = [];
  let copied = 0;
  for (const { name, kind: kindName, start, end } of placeholders(template)) {
    pieces.push(ok(text(template.slice(copied, start))));
    const value = values[name];
    if (kindName === undefined) {
      pieces.push(map(bare(scope, name, value), text));
    } else {
      const token = `{${name}:${kindName}}`;
      const kind = scope.kinds.get(kindName);
      const entry = config[kindName]?.[name];
      pieces.push(
        kind === undefined
          ? err(unrenderable(token, `unknown kind ${kindName}`))
          : andThen(resolveEntry(scope.presets, kindName, entry, scope.chain), (options) =>
              place({ kind, token, name, value, options }, context)
            )
      );
    }
    copied = end;
  }
  pieces.push(ok(text(template.slice(copied))));
  return all(pieces);
}

/** Renders every placeholder through its kind, and so through `@kit/intl`; the text between, as authored. */
export function renderMessage(message: AnyMessage, args: unknown, scope: RenderScope): Rendered {
  const asText = (text: string) => text;
  const place: Place<string> = ({ kind, token, value, options }, context) =>
    runKind(kind, value, options, context, token);
  return map(walk(message, args, scope, asText, place), (texts) => texts.join(''));
}

/** The same message as parts: a placeholder whose kind has structure keeps it, the rest is text. */
export function renderParts(
  message: AnyMessage,
  args: unknown,
  scope: RenderScope
): Result<MessagePart[], FormatFailure> {
  const asText = (text: string): MessagePart => ({ type: 'text', text });
  const place: Place<MessagePart> = ({ kind, token, name, value, options }, context) =>
    kind.parts === undefined
      ? map(runKind(kind, value, options, context, token), asText)
      : map(runParts(kind, value, options, context, token), (detail) => ({
          type: 'list',
          name,
          detail,
        }));
  return map(walk(message, args, scope, asText, place), (parts) =>
    parts.filter((part) => part.type !== 'text' || part.text !== '')
  );
}
