import type { RuntimeConfig } from '@hooktrials/config';
import { type createLogger } from '@hooktrials/logger';
import type { RenderedEmail } from './templates.js';

type Recipient = { address: string; display_name?: string };

export function createMailer(config: RuntimeConfig, logger: ReturnType<typeof createLogger>) {
  function providerReference(response: Response, body: string): string | undefined {
    const headerReference =
      response.headers.get('x-request-id') ??
      response.headers.get('x-message-id') ??
      response.headers.get('x-maileroo-id');
    if (headerReference) return headerReference.slice(0, 120);
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const candidate = parsed.id ?? parsed.message_id ?? parsed.reference_id;
      return typeof candidate === 'string' ? candidate.slice(0, 120) : undefined;
    } catch {
      return undefined;
    }
  }

  function safeError(error: unknown): string {
    return error instanceof Error ? error.message.slice(0, 240) : 'unknown delivery error';
  }

  function safeProviderMessage(body: string): string | undefined {
    const sanitized = body
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
      .replace(/https?:\/\/\S+/gi, '[redacted url]')
      .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted token]')
      .replace(/\s+/g, ' ')
      .trim();
    return sanitized ? sanitized.slice(0, 240) : undefined;
  }

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
      const responseBody = await response.text();
      const reference = providerReference(response, responseBody);
      if (!response.ok) {
        logger.warn(
          {
            statusCode: response.status,
            tag: input.tag,
            reference,
            providerMessage: safeProviderMessage(responseBody),
          },
          'Maileroo rejected email',
        );
        return false;
      }
      logger.info(
        { statusCode: response.status, tag: input.tag, reference },
        'Maileroo accepted email',
      );
      return true;
    } catch (error) {
      logger.warn({ error: safeError(error), tag: input.tag }, 'Maileroo email delivery failed');
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { send };
}
