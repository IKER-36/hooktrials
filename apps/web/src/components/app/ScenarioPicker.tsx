import { StatusChip } from '../ui/StatusChip';
import type { Scenario, ScenarioStep } from '../../lib/types';

function stepNote(step: ScenarioStep): string | undefined {
  const notes: string[] = [];
  if (step.delayMs > 0) notes.push(`+${step.delayMs / 1000}s`);
  const retryAfter = Object.entries(step.headers ?? {}).find(
    ([key]) => key.toLowerCase() === 'retry-after',
  );
  if (retryAfter) notes.push(`Retry-After: ${retryAfter[1]}`);
  return notes.length > 0 ? notes.join(' · ') : undefined;
}

interface ScenarioPickerProps {
  scenarios: Scenario[];
  value: string | null;
  onChange(id: string): void;
  disabled?: boolean;
}

export function ScenarioPicker({ scenarios, value, onChange, disabled }: ScenarioPickerProps) {
  return (
    <fieldset className="ht-scenarios" disabled={disabled}>
      <legend>Failure scenario</legend>
      {scenarios.map((scenario) => (
        <label
          key={scenario.id}
          className={`ht-scenario-option ${scenario.id === value ? 'selected' : ''}`}
        >
          <input
            type="radio"
            name="scenarioId"
            value={scenario.id}
            checked={scenario.id === value}
            onChange={() => onChange(scenario.id)}
          />
          <span className="ht-scenario-name">{scenario.name}</span>
          <span className="ht-scenario-steps">
            {scenario.definition.steps.map((step, index) => (
              <span key={index} className="ht-scenario-step">
                {index > 0 ? <span aria-hidden="true">→</span> : null}
                <StatusChip code={step.statusCode} note={stepNote(step)} />
              </span>
            ))}
          </span>
          {scenario.definition.repeatLastStep ? (
            <small>Last response repeats for further retries.</small>
          ) : null}
        </label>
      ))}
    </fieldset>
  );
}
