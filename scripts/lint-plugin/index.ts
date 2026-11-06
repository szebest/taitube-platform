import { definePlugin, defineRule } from 'vite-plus/lint/plugins';

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

export default definePlugin({
  meta: { name: 'house' },
  rules: { 'use-no-memo-reason': useNoMemoReason },
});
