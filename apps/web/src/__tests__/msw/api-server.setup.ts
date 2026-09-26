import { apiServer, endTest, listen } from './api-server';

beforeAll(listen);
afterEach(endTest);
afterAll(() => apiServer.close());
