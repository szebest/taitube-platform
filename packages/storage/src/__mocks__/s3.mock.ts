export const mockS3Client = {
  send: async () => ({ $metadata: { httpStatusCode: 200 } }),
};
