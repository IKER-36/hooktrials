import { Check, ShieldCheck } from 'lucide-react';
import { CopyButton } from '../ui/CopyButton';

export type ProviderKitId =
  'generic' | 'stripe' | 'github' | 'shopify' | 'slack' | 'gitlab' | 'linear' | 'hubspot';

interface ProviderKitDefinition {
  name: string;
  setup: string;
  contract: string;
  event: string;
  headers: string[];
}

const KITS: Record<ProviderKitId, ProviderKitDefinition> = {
  generic: {
    name: 'Generic webhook',
    setup: 'Replace the destination URL in your provider with the public HookTrials URL.',
    contract: 'POST with a JSON body and content-type: application/json.',
    event: 'hooktrials.test',
    headers: ['content-type: application/json'],
  },
  stripe: {
    name: 'Stripe',
    setup: 'Create or edit the Stripe webhook endpoint, then paste the signing secret below.',
    contract: 'Stripe-Signature is checked when a signing secret is configured.',
    event: 'payment_intent.succeeded',
    headers: ['stripe-signature', 'content-type: application/json'],
  },
  github: {
    name: 'GitHub',
    setup: 'Edit the repository or organisation webhook and use the HookTrials URL.',
    contract: 'X-Hub-Signature-256, X-GitHub-Event and X-GitHub-Delivery are retained.',
    event: 'push',
    headers: ['x-github-event', 'x-github-delivery', 'x-hub-signature-256'],
  },
  shopify: {
    name: 'Shopify',
    setup: 'Point the topic subscription at HookTrials and keep the delivery headers enabled.',
    contract: 'Topic, webhook id and HMAC headers are retained for inspection.',
    event: 'orders/create',
    headers: ['x-shopify-topic', 'x-shopify-webhook-id', 'x-shopify-hmac-sha256'],
  },
  slack: {
    name: 'Slack',
    setup: 'Update the request URL in your Slack app and keep the signing secret private.',
    contract: 'Timestamp and signature headers are retained for replay-safe verification.',
    event: 'url_verification',
    headers: ['x-slack-request-timestamp', 'x-slack-signature'],
  },
  gitlab: {
    name: 'GitLab',
    setup: 'Add the HookTrials URL to the project or group webhook settings.',
    contract: 'Event, delivery UUID and token headers are retained as the inbound contract.',
    event: 'Push Hook',
    headers: ['x-gitlab-event', 'x-gitlab-webhook-uuid', 'x-gitlab-token'],
  },
  linear: {
    name: 'Linear',
    setup: 'Update the webhook URL in Linear and keep the signing secret configured.',
    contract: 'Event, delivery, timestamp and signature headers are retained.',
    event: 'Issue created',
    headers: ['linear-event', 'linear-delivery', 'linear-timestamp', 'linear-signature'],
  },
  hubspot: {
    name: 'HubSpot',
    setup: 'Use HookTrials as the receiving URL for the webhook subscription.',
    contract: 'HubSpot v3 signature and request timestamp are retained.',
    event: 'contact.creation',
    headers: ['x-hubspot-signature-v3', 'x-hubspot-request-timestamp'],
  },
};

export function ProviderKit({
  provider,
  ingestUrl,
  className = '',
}: {
  provider?: string | null;
  ingestUrl?: string | null;
  className?: string;
}) {
  const kit = KITS[(provider as ProviderKitId) ?? 'generic'] ?? KITS.generic;
  const url = ingestUrl ?? 'https://hooks.hooktrials.com/ht_your_route';
  const curl = `curl -X POST '${url}' -H 'content-type: application/json' -d '{"event":"${kit.event}","source":"manual-test"}'`;

  return (
    <section className={`ht-provider-kit ${className}`.trim()} aria-labelledby="provider-kit-title">
      <header className="ht-provider-kit-heading">
        <div>
          <p className="ht-kicker">PROVIDER KIT</p>
          <h2 id="provider-kit-title">{kit.name} setup</h2>
        </div>
        <ShieldCheck aria-hidden="true" />
      </header>
      <ol className="ht-provider-kit-steps">
        <li>
          <span>1</span>
          <div>
            <strong>Point the provider at HookTrials</strong>
            <p>{kit.setup}</p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Confirm the inbound contract</strong>
            <p>{kit.contract}</p>
          </div>
        </li>
      </ol>
      <div className="ht-provider-kit-contract">
        <div>
          <b>Headers to expect</b>
          <span>
            {kit.headers.map((header) => (
              <code key={header}>{header}</code>
            ))}
          </span>
        </div>
        <Check aria-hidden="true" />
      </div>
      <div className="ht-provider-kit-command">
        <div>
          <b>Send a safe test event</b>
          <CopyButton value={curl} label="Copy command" />
        </div>
        <code>{curl}</code>
      </div>
      <p className="ht-provider-kit-note">
        Use a synthetic payload whenever possible. HookTrials redacts secrets from operational
        evidence and never shows write-only credentials again.
      </p>
    </section>
  );
}
