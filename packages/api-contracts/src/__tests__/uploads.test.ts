import {
  StartUploadSchema,
  abortUpload,
  completeUpload,
  getUpload,
  issueUploadParts,
  startUpload,
} from '../uploads';

const start = {
  filename: 'clip.mp4',
  sizeBytes: 1024,
  contentType: 'video/mp4',
};

describe('packages/api-contracts: uploads', () => {
  it.each([
    [startUpload, 'POST', '/v1/uploads', 201],
    [getUpload, 'GET', '/v1/uploads/:uploadId', 200],
    [issueUploadParts, 'POST', '/v1/uploads/:uploadId/parts', 200],
    [completeUpload, 'POST', '/v1/uploads/:uploadId/complete', 202],
    [abortUpload, 'DELETE', '/v1/uploads/:uploadId', 204],
  ])('declares %#: $method $path', (contract, method, path, status) => {
    expect(contract.method).toBe(method);
    expect(contract.path).toBe(path);
    expect(contract.status).toBe(status);
  });

  it('leaves the strategy to the server unless the caller forces one', () => {
    expect(StartUploadSchema.parse(start).strategy).toBeUndefined();
    expect(StartUploadSchema.parse({ ...start, strategy: 'multipart' }).strategy).toBe('multipart');
    expect(StartUploadSchema.safeParse({ ...start, strategy: 'stream' }).success).toBe(false);
  });

  it('defaults a part-url batch to 100 starting at part 1', () => {
    expect(issueUploadParts.query?.parse({})).toEqual({ from: 1, count: 100 });
  });

  it('reports an over-size or unsupported upload as 422', () => {
    expect(startUpload.errors[422]).toEqual([
      'UPLOAD_TOO_LARGE',
      'UNSUPPORTED_CONTENT_TYPE',
      'QUOTA_EXCEEDED',
    ]);
  });
});
