#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { downloadAutomationEvidence } from './automation.js';

const { values } = parseArgs({
  options: {
    'api-origin': { type: 'string' },
    'api-key': { type: 'string' },
    'event-id': { type: 'string' },
    format: { type: 'string', default: 'json' },
    output: { type: 'string' },
  },
});

const apiOrigin = values['api-origin'] || process.env.HOOKTRIALS_API_ORIGIN;
const apiKey = values['api-key'] || process.env.HOOKTRIALS_API_KEY;
const eventId = values['event-id'];
if (!apiOrigin || !apiKey || !eventId) {
  throw new Error(
    'Usage: hooktrials-evidence --event-id <id> --api-origin <url> --api-key <read-key> [--format json|markdown] [--output <file>]',
  );
}
if (values.format !== 'json' && values.format !== 'markdown') {
  throw new Error('--format must be json or markdown');
}

const body = await downloadAutomationEvidence({
  apiOrigin,
  apiKey,
  eventId,
  format: values.format,
});
if (values.output) {
  await writeFile(values.output, body, 'utf8');
  console.log(`Evidence written to ${values.output}`);
} else {
  process.stdout.write(body);
}
