import { type IntlBinding, unrenderable, wrongKind } from '@kit/intl';
import { all, andThen, err, map, ok } from '@kit/result';
import { describeValue, isRecord, type Kind, type KindContext, type Rendered } from './kind';
import type { AnyMessage } from './message';
import { type PresetTable, resolveEntry } from './presets';
import { placeholders } from './template';

/** What a message renders against: the context's intl, the engine's kinds and presets, the locale chain. */
export interface RenderScope {
  readonly intl: IntlBinding;
  readonly kinds: ReadonlyMap<string, Kind>;
  readonly presets: PresetTable;
  readonly chain: readonly string[];
}

function formatAs(
  scope: RenderScope,
  token: string,
  kind: string,
  value: unknown,
  entry: unknown
): Rendered {
  const found = scope.kinds.get(kind);
  if (found === undefined) return err(unrenderable(token, `unknown kind ${kind}`));
  const context: KindContext = {
    intl: scope.intl,
    render: (inner, innerValue, innerEntry) =>
      formatAs(scope, token, inner, innerValue, innerEntry),
  };
  return andThen(resolveEntry(scope.presets, kind, entry, scope.chain), (options) =>
    found.format(token, value, options, context)
  );
}

function bare(scope: RenderScope, name: string, value: unknown): Rendered {
  return typeof value === 'string' || typeof value === 'number'
    ? scope.intl.format(value)
    : err(wrongKind(`{${name}}`, describeValue(value)));
}

/** Renders every placeholder through its kind, and so through `@vp/intl`; the text between, as authored. */
export function renderMessage(message: AnyMessage, args: unknown, scope: RenderScope): Rendered {
  const values = isRecord(args) ? args : {};
  const { template, config } = message;
  const pieces: Rendered[] = [];
  let copied = 0;
  for (const { name, kind, start, end } of placeholders(template)) {
    pieces.push(ok(template.slice(copied, start)));
    pieces.push(
      kind === undefined
        ? bare(scope, name, values[name])
        : formatAs(scope, `{${name}:${kind}}`, kind, values[name], config[kind]?.[name])
    );
    copied = end;
  }
  pieces.push(ok(template.slice(copied)));
  return map(all(pieces), (parts) => parts.join(''));
}
