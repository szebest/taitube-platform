import { definePlugin, defineRule } from 'vite-plus/lint/plugins';
import type { ESTree } from 'vite-plus/lint/plugins';

const OPT_OUTS: readonly string[] = ['use no memo', 'use no forget'];
const REASON = /^\s*no-memo:(.*)$/;
const PLACEHOLDERS: readonly string[] = ['', 'todo', 'tbd', '...', '-'];

function reasonOf(comment: { type: string; value: string } | undefined): string | undefined {
  if (comment?.type !== 'Line') return undefined;
  const reason = REASON.exec(comment.value)?.[1]?.trim();
  return reason === undefined || PLACEHOLDERS.includes(reason.toLowerCase()) ? undefined : reason;
}

/** A `"use no memo"` stands only under a `// no-memo: <reason>` line naming what the compiler cannot handle. */
const useNoMemoReason = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a `// no-memo: <reason>` line above every React Compiler opt-out.',
    },
    messages: {
      missingReason:
        '"{{directive}}" needs a `// no-memo: <reason>` line right above it, naming the bailout it works around',
    },
  },
  create(context) {
    return {
      ExpressionStatement(node) {
        const { directive } = node;
        if (typeof directive !== 'string' || !OPT_OUTS.includes(directive)) return;
        const above = context.sourceCode.getCommentsBefore(node).at(-1);
        const adjacent = above !== undefined && above.loc.end.line === node.loc.start.line - 1;
        if (adjacent && reasonOf(above) !== undefined) return;
        context.report({ node, messageId: 'missingReason', data: { directive } });
      },
    };
  },
});

/** An API the browser floor lacks may be used only in a file that checks `typeof` of it or calls it optionally. */
const guardNewerApis = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a `typeof` check or an optional call for each API listed as newer than the browser floor.',
    },
    messages: {
      unguarded:
        '`{{api}}` is newer than the browser floor: guard it with `typeof {{api}} !== "function"` or call it as `{{api}}?.()` in this file, or leave it out',
    },
    schema: [
      {
        type: 'object',
        properties: { apis: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const [options] = context.options;
    const apis: unknown =
      typeof options === 'object' && options !== null && !Array.isArray(options)
        ? options.apis
        : [];
    const apiNames = Array.isArray(apis) ? apis : [];
    const globalNames = new Map<string, string>(
      apiNames.flatMap((api: string) => (api.startsWith('window.') ? [[api.slice(7), api]] : []))
    );
    const guarded = new Set<string>();
    const uses: { node: ESTree.Node; api: string }[] = [];

    function record(node: ESTree.Node, api: string): void {
      const { parent } = node;
      const typeofCheck = parent?.type === 'UnaryExpression' && parent.operator === 'typeof';
      const optionalCall =
        parent?.type === 'CallExpression' && parent.callee === node && parent.optional;
      if (typeofCheck || optionalCall) guarded.add(api);
      else uses.push({ node, api });
    }

    function isGlobalReference(node: ESTree.Node & { name: string }): boolean {
      if (node.parent?.type === 'MemberExpression' || node.parent?.type === 'Property')
        return false;
      let scope: ReturnType<typeof context.sourceCode.getScope> | null =
        context.sourceCode.getScope(node);
      while (scope) {
        if (scope.set.get(node.name)?.defs.length) return false;
        scope = scope.upper;
      }
      return true;
    }

    return {
      MemberExpression(node) {
        const api = context.sourceCode.getText(node);
        if (apiNames.includes(api)) record(node, api);
      },
      Identifier(node) {
        const api = globalNames.get(node.name);
        if (api !== undefined && isGlobalReference(node)) record(node, api);
      },
      'Program:exit'() {
        for (const { node, api } of uses) {
          if (!guarded.has(api)) context.report({ node, messageId: 'unguarded', data: { api } });
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: 'house' },
  rules: { 'use-no-memo-reason': useNoMemoReason, 'guard-newer-apis': guardNewerApis },
});
