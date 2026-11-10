import { groupDocs } from './env-doc';

export const STORAGE_DOCS = groupDocs('storage', {
  S3_ENDPOINT: {
    description:
      'The S3-compatible endpoint: MinIO locally, the R2 account endpoint in the cloud. A wrong host fails every upload and every playback fetch.',
    example: 'https://<account-id>.r2.cloudflarestorage.com',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  S3_REGION: {
    description: 'The signing region. R2 wants auto; MinIO accepts any value.',
    example: 'auto',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  S3_FORCE_PATH_STYLE: {
    description:
      'Addresses buckets as host/bucket instead of bucket.host. MinIO needs true; R2 and B2 need false.',
    example: 'false',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  S3_ACCESS_KEY_ID: {
    description:
      'The access key for the buckets. Optional outside production, required in it; a production boot refuses the MinIO default.',
    example: '<access key id>',
    visibility: 'secret',
    readBy: ['api', 'worker'],
    requiredIn: ['production'],
  },
  S3_SECRET_ACCESS_KEY: {
    description:
      'The secret that pairs with S3_ACCESS_KEY_ID. Optional outside production, required in it; a production boot refuses the MinIO default.',
    example: '<secret access key>',
    visibility: 'secret',
    readBy: ['api', 'worker'],
    requiredIn: ['production'],
  },
  S3_BUCKET_RAW: {
    description:
      'The bucket uploads land in before processing. Keep it private and give it the RAW_RETENTION_DAYS lifecycle rule.',
    example: 'vp-raw',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  S3_BUCKET_PUBLIC: {
    description:
      'The bucket holding renditions, thumbnails and playlists that CDN_BASE_URL serves. It must allow public reads.',
    example: 'vp-public',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  S3_PRESIGN_TTL_SEC: {
    description:
      'How long a presigned upload or part URL stays valid. Too short and slow connections fail mid-upload; the session itself outlives it.',
    example: '900',
    visibility: 'public',
    readBy: ['api'],
  },
  CDN_BASE_URL: {
    description:
      'The public origin media is served from, with or without a trailing slash. Every playlist, thumbnail and sprite URL the API returns starts with it.',
    example: 'https://cdn.taitube.local',
    visibility: 'public',
    readBy: ['api', 'worker'],
  },
  S3_MULTIPART_THRESHOLD_BYTES: {
    description:
      'Files above this size upload in parts instead of one request. Keep it at or above S3_PART_SIZE_MIN_BYTES.',
    example: '104857600',
    visibility: 'public',
    readBy: ['api'],
  },
  S3_PART_SIZE_MIN_BYTES: {
    description:
      'The smallest part a multipart upload may use. S3 rejects parts under 5 MB except the last one.',
    example: '8388608',
    visibility: 'public',
    readBy: ['api'],
  },
  S3_PART_SIZE_MAX_BYTES: {
    description:
      'The largest part a multipart upload may use; the API clamps the client plan to it.',
    example: '67108864',
    visibility: 'public',
    readBy: ['api'],
  },
  RAW_RETENTION_DAYS: {
    description:
      'How many days a raw upload is kept after processing before housekeeping deletes it. Mirror it in the bucket lifecycle rule.',
    example: '7',
    visibility: 'public',
    readBy: ['worker'],
  },
});

export const AUTH_DOCS = groupDocs('auth', {
  AUTH_MODE: {
    description:
      'dev verifies tokens against the public dev key (pnpm dev-token); jwks verifies against your IdP. Production refuses dev.',
    example: 'jwks',
    visibility: 'public',
    readBy: ['api'],
  },
  AUTH_JWKS_URL: {
    description:
      "Your identity provider's JWKS endpoint. Only read when AUTH_MODE=jwks, and then the schema fails without it.",
    example: 'https://idp.taitube.local/.well-known/jwks.json',
    visibility: 'public',
    readBy: ['api'],
    requiredIn: ['jwks-auth'],
  },
  AUTH_ISSUER: {
    description: 'The iss claim a token must carry. A mismatch rejects every request with 401.',
    example: 'https://idp.taitube.local/',
    visibility: 'public',
    readBy: ['api'],
  },
  AUTH_AUDIENCE: {
    description: 'The aud claim a token must carry. A mismatch rejects every request with 401.',
    example: 'vp-api',
    visibility: 'public',
    readBy: ['api'],
  },
  AUTH_ALGORITHMS: {
    description:
      'Comma list of signature algorithms a jwks token may use (RS256, RS384, RS512, ES256, ES384, ES512, EdDSA). Tokens signed otherwise are rejected.',
    example: 'RS256,ES256',
    visibility: 'public',
    readBy: ['api'],
  },
  AUTH_DEV_USER_ID: {
    description:
      'The user ADMIN_TOKEN acts as in dev mode. The seed provisions it; a different value needs a matching user row.',
    example: '00000000-0000-7000-8000-000000000001',
    visibility: 'public',
    readBy: ['api'],
  },
  ADMIN_TOKEN: {
    description:
      'The x-admin-token for /admin and Bull Board in dev mode. Production refuses any value: admin comes from a verified token role.',
    example: '<random 32 bytes>',
    visibility: 'secret',
    readBy: ['api'],
  },
});
