import type { RuntimeConfig } from '@hooktrials/config';
import { type createLogger } from '@hooktrials/logger';
import type { RenderedEmail } from './templates.js';

type Recipient = { address: string; display_name?: string };

export function createMailer(config: RuntimeConfig, logger: ReturnType<typeof createLogger>) {
  async function send(input: {
    to: Recipient;
    email: RenderedEmail;
    tag: string;
  }): Promise<boolean> {
    if (!config.MAILEROO_API_KEY) {
      logger.warn({ tag: input.tag }, 'Email delivery skipped: Maileroo is not configured');
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${config.MAILEROO_BASE_URL.replace(/\/$/, '')}/emails`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.MAILEROO_API_KEY,
          'user-agent': 'HookTrials/0.16 email-service',
        },
        body: JSON.stringify({
          from: { address: config.MAIL_FROM_ADDRESS, display_name: config.MAIL_FROM_NAME },
          to: input.to,
          ...(config.MAIL_REPLY_TO ? { reply_to: { address: config.MAIL_REPLY_TO } } : {}),
          subject: input.email.subject,
          html: input.email.html,
          plain: input.email.plain,
          tracking: false,
          tags: { product: 'hooktrials', message: input.tag },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        logger.warn({ statusCode: response.status, tag: input.tag }, 'Maileroo rejected email');
        return false;
      }
      return true;
    } catch (error) {
      logger.warn({ error, tag: input.tag }, 'Maileroo email delivery failed');
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { send };
}
