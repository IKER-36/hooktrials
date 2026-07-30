#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { downloadAutomationEvidence, runAutomationEvent } from './automation.js';

const { values } = parseArgs({
  options: {
    'api-origin': { type: 'string' },
    'api-key': { type: 'string' },
    'endpoint-id': { type: 'string' },
    evidence: { type: 'boolean' },
    format: { type: 'string', default: 'json' },
    output: { type: 'string' },
    'expect-status': { type: 'string' },
  },
});

const apiOrigin = values['api-origin'] || process.env.HOOKTRIALS_API_ORIGIN;
const apiKey = values['api-key'] || process.env.HOOKTRIALS_API_KEY;
const endpointId = values['endpoint-id'];
if (!apiOrigin || !apiKey || !endpointId) {
  throw new Error(
    'Usage: hooktrials-run --endpoint-id <id> --api-origin <url> --api-key <write-key> [--evidence] [--output <file>]',
  );
}
if (values.format !== 'json' && values.format !== 'markdown') {
  throw new Error('--format must be json or markdown');
}
const expectedStatus = values['expect-status'] ? Number(values['expect-status']) : null;
if (
  expectedStatus !== null &&
  (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599)
) {
  throw new Error('--expect-status must be an HTTP status between 100 and 599');
}

const result = await runAutomationEvent({ apiOrigin, apiKey, endpointId });
console.log(
  `${result.accepted ? 'PASS' : 'FAIL'} event ${result.eventId ?? 'not-recorded'} · ${result.statusCode} · ${result.latencyMs}ms`,
);

if (values.evidence && result.eventId) {
  const evidence = await downloadAutomationEvidence({
    apiOrigin,
    apiKey,
    eventId: result.eventId,
    format: values.format,
  });
  const output =
    values.output ??
    `hooktrials-evidence-${result.eventId.slice(0, 8)}.${values.format === 'json' ? 'json' : 'md'}`;
  await writeFile(output, evidence, 'utf8');
  console.log(`Evidence written to ${output}`);
}

if (!result.accepted || (expectedStatus !== null && result.statusCode !== expectedStatus)) {
  process.exitCode = 1;
}
