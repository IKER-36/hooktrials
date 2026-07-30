export interface AutomationRunResult {
  accepted: boolean;
  eventId: string | null;
  correlationKey: string;
  mode: string;
  statusCode: number;
  latencyMs: number;
  destinationTriggered: boolean;
}

export async function runAutomationEvent(
  input: { apiOrigin: string; apiKey: string; endpointId: string },
  fetcher: typeof fetch = fetch,
): Promise<AutomationRunResult> {
  const response = await fetcher(
    `${input.apiOrigin.replace(/\/$/, '')}/v1/automation/endpoints/${encodeURIComponent(input.endpointId)}/test-event`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ confirm: true }),
    },
  );
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
    throw new Error(code);
  }
  return body as unknown as AutomationRunResult;
}

export async function downloadAutomationEvidence(
  input: { apiOrigin: string; apiKey: string; eventId: string; format: 'json' | 'markdown' },
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher(
    `${input.apiOrigin.replace(/\/$/, '')}/v1/automation/events/${encodeURIComponent(input.eventId)}/export?format=${input.format}`,
    { headers: { authorization: `Bearer ${input.apiKey}` } },
  );
  const body = await response.text();
  if (!response.ok) {
    let code = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(body) as { error?: unknown };
      if (typeof parsed.error === 'string') code = parsed.error;
    } catch {
      // Keep the status-only error for non-JSON responses.
    }
    throw new Error(code);
  }
  return body;
}
