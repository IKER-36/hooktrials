#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fetchOpenApiDocument, listOpenApiOperations } from './catalog.js';

const { values } = parseArgs({
  options: {
    'api-origin': { type: 'string' },
    output: { type: 'string' },
    list: { type: 'boolean' },
    'operation-id': { type: 'string' },
  },
});

const apiOrigin = values['api-origin'] || process.env.HOOKTRIALS_API_ORIGIN;
if (!apiOrigin) {
  throw new Error('Usage: hooktrials-api --api-origin <url> [--list] [--output <file>]');
}

const document = await fetchOpenApiDocument(apiOrigin);
const operations = listOpenApiOperations(document);
const operationId = values['operation-id'];
if (operationId && !operations.some((operation) => operation.operationId === operationId)) {
  throw new Error(`Operation not found: ${operationId}`);
}

if (values.output) {
  await writeFile(values.output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(`OpenAPI catalogue written to ${values.output}`);
}

if (values.list) {
  for (const operation of operations) {
    console.log(`${operation.method.padEnd(6)} ${operation.path}  ${operation.operationId}`);
  }
} else if (!values.output) {
  console.log(`${document.info.title ?? 'API'} ${document.info.version ?? ''}`.trim());
  console.log(`${operations.length} documented operations`);
}
