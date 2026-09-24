import type { S3Client } from '@aws-sdk/client-s3';

interface SentCommand {
  name: string;
  input: Record<string, unknown>;
}

export type CommandHandler = (input: Record<string, unknown>) => unknown;

export interface FakeS3 {
  client: S3Client;
  sent: SentCommand[];
  destroyed: () => boolean;
}

export function notFound(): Error {
  return Object.assign(new Error('Not Found'), {
    name: 'NotFound',
    $metadata: { httpStatusCode: 404 },
  });
}

export function fakeS3Client(handlers: Record<string, CommandHandler> = {}): FakeS3 {
  const sent: SentCommand[] = [];
  let destroyed = false;

  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const name = command.constructor.name;
      sent.push({ name, input: command.input });
      const handler = handlers[name];
      if (!handler) return {};
      return handler(command.input);
    },
    destroy: () => {
      destroyed = true;
    },
  };

  return { client: client as unknown as S3Client, sent, destroyed: () => destroyed };
}
