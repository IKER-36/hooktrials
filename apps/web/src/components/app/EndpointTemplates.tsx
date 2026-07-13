import type { Scenario } from '../../lib/types';
import { StatusChip } from '../ui/StatusChip';

interface EndpointTemplate {
  id: string;
  name: string;
  endpointName: string;
  scenarioName: string;
  description: string;
  outcome: string;
  recommended?: boolean;
}

const ENDPOINT_TEMPLATES: EndpointTemplate[] = [
  {
    id: 'payload-inspector',
    name: 'Payload inspector',
    endpointName: 'payload-inspector',
    scenarioName: 'Basic inspection',
    description: 'Accept one delivery successfully and inspect its headers, body and metadata.',
    outcome: 'Learn what HookTrials captures',
    recommended: true,
  },
  {
    id: 'retry-recovery',
    name: 'Retry recovery',
    endpointName: 'retry-recovery-demo',
    scenarioName: 'Temporary outage',
    description: 'Return two server errors before recovering on the third delivery.',
    outcome: 'Prove that retries eventually recover',
  },
  {
    id: 'rate-limit',
    name: 'Rate-limit handling',
    endpointName: 'rate-limit-demo',
    scenarioName: 'Rate limited',
    description: 'Return 429 with Retry-After, then accept the next delivery.',
    outcome: 'Check whether retry guidance is respected',
  },
  {
    id: 'worst-day',
    name: 'Worst-day sequence',
    endpointName: 'resilience-demo',
    scenarioName: 'Unstable endpoint',
    description: 'Walk through an error, a delayed outage, throttling and final recovery.',
    outcome: 'Show the complete retry timeline',
  },
];

interface EndpointTemplatesProps {
  scenarios: Scenario[];
  activeId: string | null;
  disabled?: boolean;
  onSelect(templateId: string, endpointName: string, scenarioId: string): void;
}

export function EndpointTemplates({
  scenarios,
  activeId,
  disabled,
  onSelect,
}: EndpointTemplatesProps) {
  return (
    <section className="ht-template-section" aria-labelledby="endpoint-templates-title">
      <header>
        <div>
          <p className="ht-kicker">Quick start</p>
          <h2 id="endpoint-templates-title">Start from a test template</h2>
        </div>
        <p>
          Pick what you want to demonstrate. We configure the endpoint name and deterministic
          response sequence for you.
        </p>
      </header>

      <div className="ht-template-grid">
        {ENDPOINT_TEMPLATES.map((template) => {
          const scenario = scenarios.find((item) => item.name === template.scenarioName);
          const unavailable = disabled || !scenario;
          return (
            <button
              key={template.id}
              type="button"
              className={`ht-template-card ${activeId === template.id ? 'selected' : ''}`}
              disabled={unavailable}
              onClick={() => {
                if (scenario) onSelect(template.id, template.endpointName, scenario.id);
              }}
            >
              <span className="ht-template-topline">
                <b>{template.name}</b>
                {template.recommended ? <small>START HERE</small> : null}
              </span>
              <span className="ht-template-description">{template.description}</span>
              {scenario ? (
                <span className="ht-template-sequence" aria-label={scenario.name}>
                  {scenario.definition.steps.map((step, index) => (
                    <span key={index}>
                      {index > 0 ? <i aria-hidden="true">→</i> : null}
                      <StatusChip code={step.statusCode} />
                    </span>
                  ))}
                </span>
              ) : null}
              <span className="ht-template-outcome">{template.outcome}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
