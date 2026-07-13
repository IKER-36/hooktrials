#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { junitReport, parseTrialConfig, runTrial } from './core.js';

const { values } = parseArgs({
  options: {
    config: { type: 'string', short: 'c' },
    json: { type: 'string' },
    junit: { type: 'string' },
  },
});

if (!values.config) throw new Error('Usage: hooktrials-trial --config <trial.yml>');
const config = parseTrialConfig(await readFile(values.config, 'utf8'));
const result = await runTrial(config);
for (const attempt of result.attempts) {
  const status = attempt.actual ?? 'ERROR';
  const mark = attempt.passed ? 'PASS' : 'FAIL';
  console.log(
    `${mark} attempt ${attempt.sequence}: expected ${attempt.expected}, received ${status} (${attempt.durationMs}ms)`,
  );
}
console.log(result.passed ? `PASS ${result.name}` : `FAIL ${result.name}`);
if (values.json) await writeFile(values.json, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
if (values.junit) await writeFile(values.junit, junitReport(result), 'utf8');
if (!result.passed) process.exitCode = 1;
