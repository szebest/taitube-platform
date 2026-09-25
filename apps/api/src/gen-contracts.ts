import { writeFile } from 'node:fs/promises';
import { OPENAPI_DOCUMENT_FILE, renderOpenApiDocument } from './composition/openapi-document';

const target = new URL(`../../../${OPENAPI_DOCUMENT_FILE}`, import.meta.url);

await writeFile(target, await renderOpenApiDocument());
console.log(`wrote ${OPENAPI_DOCUMENT_FILE}`);
