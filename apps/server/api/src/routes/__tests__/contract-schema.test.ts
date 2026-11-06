import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { contractSchema } from '../contract-schema';

const contract = {
  method: 'GET',
  path: '/v1/things/:id',
  tag: 'Things',
  summary: 'Get a thing',
  description: 'Reads one thing.',
  params: z.object({ id: z.string() }),
  status: 200,
  result: z.object({ id: z.string() }),
  errors: { 404: [ErrorCodes.VIDEO_NOT_FOUND] },
} as const;

describe('apps/server/api/routes: contract schema', () => {
  it('carries the contract tag, summary and description', () => {
    expect(contractSchema(contract)).toMatchObject({
      tags: ['Things'],
      summary: 'Get a thing',
      description: 'Reads one thing.',
    });
  });

  it('maps the success status to the result schema', () => {
    expect(contractSchema(contract).response[200]).toBe(contract.result);
  });

  it('renders each declared error status as a problem document', () => {
    const problem = contractSchema(contract).response[404];

    expect(problem?.safeParse({ code: 'FORBIDDEN' }).success).toBe(false);
    expect(
      problem?.safeParse({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'gone',
        code: ErrorCodes.VIDEO_NOT_FOUND,
        instance: '/v1/things/1',
      }).success
    ).toBe(true);
  });

  it('merges extra responses without displacing the contract statuses', () => {
    const notModified = z.undefined();
    const schema = contractSchema(contract, { responses: { 304: notModified } });

    expect(schema.response[304]).toBe(notModified);
    expect(schema.response[200]).toBe(contract.result);
  });

  it('opens an anonymous endpoint and hides an aliased path and an internal one', () => {
    expect(contractSchema(contract).security).toBeUndefined();
    expect(contractSchema({ ...contract, anonymous: true }).security).toEqual([]);
    expect(contractSchema(contract).hide).toBeUndefined();
    expect(contractSchema(contract, { hide: true }).hide).toBe(true);
    expect(contractSchema({ ...contract, internal: true }).hide).toBe(true);
  });

  it('takes X-Channel-Id on a channel-scoped endpoint and answers its refusals with 403', () => {
    const schema = contractSchema({
      ...contract,
      channelScoped: true,
      errors: { ...contract.errors, 403: [ErrorCodes.FORBIDDEN] },
    });
    const refusal = (code: string) =>
      schema.response[403]?.safeParse({
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'no',
        code,
        instance: '/v1/things/1',
      }).success;

    expect(schema.headers?.safeParse({ 'x-channel-id': 'not-a-uuid' }).success).toBe(false);
    expect([
      refusal(ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED),
      refusal(ErrorCodes.FORBIDDEN),
    ]).toEqual([true, true]);
    expect(contractSchema(contract).headers).toBeUndefined();
  });
});
