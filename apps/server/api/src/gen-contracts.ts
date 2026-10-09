import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENAPI_DOCUMENT_FILE, renderOpenApiDocument } from './composition/openapi-document';

const committed = fileURLToPath(new URL(`../../../${OPENAPI_DOCUMENT_FILE}`, import.meta.url));
const target = process.argv[2] ? resolve(process.argv[2]) : committed;

await writeFile(target, await renderOpenApiDocument());
process.stdout.write(`wrote ${target}\n`);
