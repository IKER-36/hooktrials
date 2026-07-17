import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../../layouts/AppLayout';
import type { Scenario, ScenarioStep } from '../../lib/types';

const EMPTY_STEP: ScenarioStep = { statusCode: 500, delayMs: 0, headers: {} };

function cloneSteps(steps: ScenarioStep[]): ScenarioStep[] {
  return steps.map((step) => ({ ...step, headers: { ...step.headers } }));
}

function outcome(status: number): string {
  if (status >= 500) return 'server failure';
  if (status === 429) return 'rate limited';
  if (status >= 400) return 'client rejection';
  if (status >= 300) return 'redirect';
  return 'accepted';
}

export function ScenariosPage() {
  const { scenarios, endpoints, saveScenario, deleteScenario, reportError } = useDashboard();
  const [selectedId, setSelectedId] = useState<string | null>(scenarios[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? null;
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<ScenarioStep[]>([EMPTY_STEP]);
  const [repeatLastStep, setRepeatLastStep] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!creating && !selected && scenarios[0]) setSelectedId(scenarios[0].id);
  }, [creating, scenarios, selected]);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setSteps(cloneSteps(selected.definition.steps));
    setRepeatLastStep(selected.definition.repeatLastStep);
  }, [selected]);

  const endpointsUsingSelected = useMemo(
    () => endpoints.filter((endpoint) => endpoint.scenarioId === selected?.id).length,
    [endpoints, selected],
  );

  function startNew(source?: Scenario) {
    setCreating(true);
    setSelectedId(null);
    setName(source ? `${source.name} copy` : '');
    setSteps(source ? cloneSteps(source.definition.steps) : [{ ...EMPTY_STEP }]);
    setRepeatLastStep(source?.definition.repeatLastStep ?? true);
    setNotice(source ? 'Built-in copied. Give it a name and customize the sequence.' : '');
  }

  function updateStep(index: number, patch: Partial<ScenarioStep>) {
    setSteps((items) =>
      items.map((step, position) => (position === index ? { ...step, ...patch } : step)),
    );
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((items) => {
      const next = [...items];
      const currentStep = next[index];
      const targetStep = next[target];
      if (!currentStep || !targetStep) return items;
      next[index] = targetStep;
      next[target] = currentStep;
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const scenario = await saveScenario(
        { name, definition: { name, steps, repeatLastStep } },
        selected && !selected.builtIn ? selected.id : undefined,
      );
      setSelectedId(scenario.id);
      setCreating(false);
      setNotice(selected && !selected.builtIn ? 'Scenario updated.' : 'Custom scenario created.');
    } catch (error) {
      reportError(error);
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected || selected.builtIn) return;
    if (!window.confirm(`Delete “${selected.name}”?`)) return;
    try {
      await deleteScenario(selected);
      setCreating(true);
      setSelectedId(null);
      setName('');
      setSteps([{ ...EMPTY_STEP }]);
      setNotice('Scenario deleted.');
    } catch (error) {
      reportError(error);
    }
  }

  const readOnlyBuiltIn = Boolean(selected?.builtIn);

  return (
    <section className="ht-page" data-tour-section="scenarios">
      <header className="ht-page-head">
        <div>
          <p className="ht-kicker">Failure orchestration</p>
          <h1>Scenario Studio</h1>
          <p className="ht-muted-line">
            Model the exact response sequence your webhook sender must survive.
          </p>
        </div>
        <button type="button" className="button primary" onClick={() => startNew()}>
          New scenario
        </button>
      </header>

      <div className="ht-studio-grid">
        <aside className="ht-studio-library" aria-label="Scenario library">
          <header>
            <span>Scenario library</span>
            <small>{scenarios.length} total</small>
          </header>
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className={scenario.id === selectedId ? 'selected' : ''}
              onClick={() => {
                setNotice('');
                setCreating(false);
                setSelectedId(scenario.id);
              }}
            >
              <span>{scenario.name}</span>
              <small>
                {scenario.builtIn ? 'BUILT-IN' : 'CUSTOM'} · {scenario.definition.steps.length}{' '}
                STEPS
              </small>
            </button>
          ))}
        </aside>

        <form className="ht-studio-editor" onSubmit={(event) => void submit(event)}>
          <header>
            <div>
              <p className="ht-kicker">
                {readOnlyBuiltIn ? 'Reference recipe' : selected ? 'Edit recipe' : 'New recipe'}
              </p>
              <h2>{selected?.name ?? 'Untitled scenario'}</h2>
            </div>
            {readOnlyBuiltIn ? (
              <button
                type="button"
                className="button secondary compact"
                onClick={() => startNew(selected ?? undefined)}
              >
                Duplicate to edit
              </button>
            ) : null}
          </header>

          {readOnlyBuiltIn ? (
            <p className="ht-form-note">
              Built-ins are protected. Duplicate this recipe to customize it safely.
            </p>
          ) : null}
          {notice ? <p className="ht-form-note">{notice}</p> : null}

          <label className="ht-field">
            Scenario name
            <input
              value={name}
              minLength={2}
              maxLength={80}
              disabled={readOnlyBuiltIn}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <div className="ht-sequence-head">
            <div>
              <strong>Response sequence</strong>
              <small>Each delivery advances one step for the same event ID.</small>
            </div>
            {!readOnlyBuiltIn ? (
              <button
                type="button"
                className="button secondary compact"
                disabled={steps.length >= 20}
                onClick={() => setSteps((items) => [...items, { ...EMPTY_STEP }])}
              >
                + Add step
              </button>
            ) : null}
          </div>

          <div className="ht-step-list">
            {steps.map((step, index) => (
              <article className="ht-step-card" key={index}>
                <header>
                  <span>ATTEMPT {String(index + 1).padStart(2, '0')}</span>
                  <b className={step.statusCode >= 400 ? 'failure' : 'success'}>
                    {step.statusCode} · {outcome(step.statusCode)}
                  </b>
                </header>
                <div className="ht-step-fields">
                  <label className="ht-field">
                    HTTP status
                    <input
                      type="number"
                      min="100"
                      max="599"
                      value={step.statusCode}
                      disabled={readOnlyBuiltIn}
                      onChange={(event) =>
                        updateStep(index, { statusCode: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="ht-field">
                    Delay (ms)
                    <input
                      type="number"
                      min="0"
                      max="30000"
                      step="100"
                      value={step.delayMs}
                      disabled={readOnlyBuiltIn}
                      onChange={(event) =>
                        updateStep(index, { delayMs: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="ht-field ht-field-wide">
                    Response headers (JSON)
                    <textarea
                      value={JSON.stringify(step.headers)}
                      disabled={readOnlyBuiltIn}
                      onChange={(event) => {
                        try {
                          const headers = JSON.parse(event.target.value) as Record<string, string>;
                          updateStep(index, { headers });
                        } catch {
                          /* keep last valid headers while typing */
                        }
                      }}
                    />
                  </label>
                  <label className="ht-field ht-field-wide">
                    Response body (optional)
                    <textarea
                      value={step.body ?? ''}
                      maxLength={16384}
                      disabled={readOnlyBuiltIn}
                      placeholder='{"accepted":false}'
                      onChange={(event) =>
                        updateStep(index, { body: event.target.value || undefined })
                      }
                    />
                  </label>
                </div>
                {!readOnlyBuiltIn ? (
                  <footer>
                    <button
                      type="button"
                      onClick={() => moveStep(index, -1)}
                      disabled={index === 0}
                    >
                      ↑ Earlier
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(index, 1)}
                      disabled={index === steps.length - 1}
                    >
                      ↓ Later
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        setSteps((items) => items.filter((_, position) => position !== index))
                      }
                      disabled={steps.length === 1}
                    >
                      Remove
                    </button>
                  </footer>
                ) : null}
              </article>
            ))}
          </div>

          <label className="ht-repeat-control">
            <input
              type="checkbox"
              checked={repeatLastStep}
              disabled={readOnlyBuiltIn}
              onChange={(event) => setRepeatLastStep(event.target.checked)}
            />
            <span>
              <strong>Repeat final response</strong>
              <small>
                Later retries keep receiving the final step. Disabled means HookTrials returns 410.
              </small>
            </span>
          </label>

          {!readOnlyBuiltIn ? (
            <footer className="ht-studio-actions">
              {selected ? (
                <button
                  type="button"
                  className="button danger"
                  disabled={endpointsUsingSelected > 0}
                  title={
                    endpointsUsingSelected
                      ? `${endpointsUsingSelected} endpoint(s) use this scenario`
                      : ''
                  }
                  onClick={() => void removeSelected()}
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="button primary"
                disabled={saving || name.trim().length < 2}
              >
                {saving ? 'Saving…' : selected ? 'Save changes' : 'Create scenario'}
              </button>
            </footer>
          ) : null}
        </form>
      </div>
    </section>
  );
}
