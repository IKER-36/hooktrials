import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { junitReport, parseTrialConfig, runTrial } from '../../packages/cli/src/core.js';

function input(name: string) {
  return process.env[`INPUT_${name.replaceAll('-', '_').toUpperCase()}`]?.trim() ?? '';
}

async function main() {
  try {
    const configPath = input('config') || 'examples/payment-webhook.trial.yml';
    const endpoint = input('endpoint');
    const config = parseTrialConfig(await readFile(configPath, 'utf8'), {
      ...process.env,
      ...(endpoint ? { HOOKTRIALS_ENDPOINT_URL: endpoint } : {}),
    });
    const result = await runTrial(config);
    for (const attempt of result.attempts) {
      console.log(
        `${attempt.passed ? 'PASS' : 'FAIL'} attempt ${attempt.sequence}: expected ${attempt.expected}, received ${attempt.actual ?? 'ERROR'} (${attempt.durationMs}ms)`,
      );
    }
    if (input('json'))
      await writeFile(input('json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    if (input('junit')) await writeFile(input('junit'), junitReport(result), 'utf8');
    if (process.env.GITHUB_OUTPUT) {
      await appendFile(
        process.env.GITHUB_OUTPUT,
        `passed=${result.passed}\nsummary=${result.attempts.filter((item) => item.passed).length}/${result.attempts.length} attempts passed\n`,
        'utf8',
      );
    }
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
