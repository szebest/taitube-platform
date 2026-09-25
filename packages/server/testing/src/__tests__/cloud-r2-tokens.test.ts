import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { parse } from '@cdktf/hcl2json';

const MAIN_TF = path.resolve(__dirname, '../../../../../infra/terraform/main.tf');

interface TokenPolicy {
  permission_groups: string[];
  resources: Record<string, string>;
}

interface ApiToken {
  policy: TokenPolicy[];
}

const ITEM_READ = 'Workers R2 Storage Bucket Item Read';
const ITEM_WRITE = 'Workers R2 Storage Bucket Item Write';

const BUCKETS = ['raw', 'public'];

/** The bucket a token resource names, by the `cloudflare_r2_bucket.<name>` it interpolates. */
function bucketOf(resource: string): string {
  return (
    BUCKETS.find((bucket) => resource.includes(`cloudflare_r2_bucket.${bucket}.name`)) ?? resource
  );
}

/** Each bucket a token reaches, with the permission groups it holds there. */
function grantsOf(token: ApiToken | undefined): Record<string, string[]> {
  const grants: Record<string, string[]> = {};
  for (const policy of token?.policy ?? []) {
    for (const resource of Object.keys(policy.resources)) {
      const bucket = bucketOf(resource);
      grants[bucket] = [...(grants[bucket] ?? []), ...policy.permission_groups].sort();
    }
  }
  return grants;
}

async function apiTokens(file: string): Promise<Record<string, ApiToken>> {
  const parsed = await parse('main.tf', readFileSync(file, 'utf-8'));
  const declared: Record<string, ApiToken[]> = parsed.resource.cloudflare_api_token;
  const tokens: Record<string, ApiToken> = {};
  for (const [name, [token]] of Object.entries(declared)) {
    if (token) tokens[name] = token;
  }
  return tokens;
}

describe('cloud infrastructure: the scoped R2 tokens', () => {
  it('grants the worker token what the stages and housekeeping do on each bucket, and the API token raw only', async () => {
    const tokens = await apiTokens(MAIN_TF);

    expect(Object.keys(tokens).sort()).toEqual(['r2_api_app', 'r2_worker_app']);
    expect(grantsOf(tokens.r2_worker_app)).toEqual({
      raw: [ITEM_READ, ITEM_WRITE],
      public: [ITEM_READ, ITEM_WRITE],
    });
    expect(grantsOf(tokens.r2_api_app)).toEqual({ raw: [ITEM_READ, ITEM_WRITE] });
  });
});
