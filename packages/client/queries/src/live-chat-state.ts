import type { LiveChatMessageView, LiveChatMode, LiveChatServerFrame } from '@vp/api-contracts';
import { type ErrorCode, ErrorCodes, isErrorCode } from '@vp/errors';
import { assertNever } from '@vp/result';

export type LiveChatLineState = 'sent' | 'pending' | 'failed' | 'removed';

/** A line the viewer sees: one the stream sent, or one of their own on its way. */
export interface LiveChatLine {
  key: string;
  id?: string;
  author: LiveChatMessageView['author'] | null;
  text: string;
  offsetMs?: number;
  state: LiveChatLineState;
}

export type LiveChatConnection = 'connecting' | 'open' | 'closed';

export interface LiveChatState {
  lines: LiveChatLine[];
  mode: LiveChatMode | null;
  canSend: boolean;
  canModerate: boolean;
  connection: LiveChatConnection;
  /** Why the last line the viewer sent was refused. */
  refusal: ErrorCode | null;
}

export type LiveChatAction =
  | { type: 'frame'; frame: LiveChatServerFrame }
  | { type: 'sending'; ref: string; text: string }
  | { type: 'unsent'; ref: string }
  | { type: 'connection'; connection: LiveChatConnection };

/** The most lines kept: older ones leave the top of the log. */
export const LIVE_CHAT_LINES_KEPT = 500;

export const INITIAL_LIVE_CHAT: LiveChatState = {
  lines: [],
  mode: null,
  canSend: false,
  canModerate: false,
  connection: 'connecting',
  refusal: null,
};

function sentLine(message: LiveChatMessageView): LiveChatLine {
  return {
    key: message.id,
    id: message.id,
    author: message.author,
    text: message.message,
    offsetMs: message.offsetMs,
    state: 'sent',
  };
}

function withMessage(lines: LiveChatLine[], message: LiveChatMessageView): LiveChatLine[] {
  if (!lines.some((line) => line.id === message.id)) {
    return [...lines, sentLine(message)].slice(-LIVE_CHAT_LINES_KEPT);
  }

  return updateLine(
    lines,
    (line) => line.id === message.id,
    (line) => ({
      ...sentLine(message),
      key: line.key,
      state: line.state === 'removed' ? 'removed' : 'sent',
    })
  );
}

function updateLine(
  lines: LiveChatLine[],
  matches: (line: LiveChatLine) => boolean,
  update: (line: LiveChatLine) => LiveChatLine
): LiveChatLine[] {
  return lines.map((line) => (matches(line) ? update(line) : line));
}

function applyFrame(state: LiveChatState, frame: LiveChatServerFrame): LiveChatState {
  switch (frame.type) {
    case 'hello':
      return {
        ...state,
        lines:
          frame.resume === 'replayed'
            ? state.lines
            : state.lines.filter((line) => line.state === 'pending' || line.state === 'failed'),
        mode: frame.mode,
        canSend: frame.canSend,
        canModerate: frame.canModerate,
        connection: 'open',
      };
    case 'message':
      return { ...state, lines: withMessage(state.lines, frame.message) };
    case 'removed':
      return {
        ...state,
        lines: updateLine(
          state.lines,
          (line) => line.id === frame.id,
          (line) => ({ ...line, state: 'removed' })
        ),
      };
    case 'mode':
      return { ...state, mode: frame.mode };
    case 'ack': {
      const echoed = state.lines.some((line) => line.id === frame.id && line.key !== frame.ref);
      const lines = echoed
        ? state.lines.filter((line) => line.key !== frame.ref)
        : updateLine(
            state.lines,
            (line) => line.key === frame.ref && line.state === 'pending',
            (line) => ({ ...line, id: frame.id, state: 'sent' })
          );
      return { ...state, lines, refusal: null };
    }
    case 'error':
      return {
        ...state,
        lines: updateLine(
          state.lines,
          (line) => line.key === frame.ref,
          (line) => ({ ...line, state: 'failed' })
        ),
        refusal: isErrorCode(frame.problem.code) ? frame.problem.code : ErrorCodes.INTERNAL,
      };
    default:
      return assertNever(frame, 'LiveChatServerFrame');
  }
}

/** What the chat shows, folded from the socket's frames and the viewer's own sends. */
export function liveChatReducer(state: LiveChatState, action: LiveChatAction): LiveChatState {
  switch (action.type) {
    case 'frame':
      return applyFrame(state, action.frame);
    case 'sending': {
      const others = state.lines.filter((line) => line.key !== action.ref);
      const line: LiveChatLine = {
        key: action.ref,
        author: null,
        text: action.text,
        state: 'pending',
      };
      return { ...state, lines: [...others, line].slice(-LIVE_CHAT_LINES_KEPT), refusal: null };
    }
    case 'unsent':
      return {
        ...state,
        lines: updateLine(
          state.lines,
          (line) => line.key === action.ref,
          (line) => ({ ...line, state: 'failed' })
        ),
      };
    case 'connection':
      return { ...state, connection: action.connection };
    default:
      return assertNever(action, 'LiveChatAction');
  }
}
