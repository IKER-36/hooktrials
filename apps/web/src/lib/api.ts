const productionApiOrigin =
  window.location.hostname === 'app.hooktrials.com' ? 'https://api.hooktrials.com' : '/api';

export const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN ||
  (import.meta.env.DEV ? 'http://localhost:3001' : productionApiOrigin);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly detail?: string,
  ) {
    super(code);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new ApiError(response.status, body?.error ?? 'request_failed', body?.message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function readableError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Network error. Check your connection and try again.';
  const messages: Record<string, string> = {
    email_already_registered: 'An account already exists for this email.',
    registration_closed: 'Registration is closed on this installation.',
    invalid_credentials: 'Email or password is incorrect.',
    authentication_required: 'Your session has expired. Log in again to continue.',
    endpoint_limit_reached: 'You have reached the hosted endpoint limit.',
    invalid_scenario: 'That scenario is no longer available.',
    scenario_not_found: 'That custom scenario no longer exists.',
    scenario_in_use: 'Move endpoints away from this scenario before deleting it.',
    monitor_not_found: 'That monitor no longer exists.',
    target_blocked: error.detail ?? 'Target blocked by outbound network safety policy.',
    destination_required: 'Add a destination URL before enabling Observe or Protect.',
    production_confirmation_required: 'Confirm the production traffic impact before saving.',
    protect_not_available: 'Protect mode is not enabled on this build yet.',
    delivery_not_found: 'That delivery no longer exists.',
    delivery_not_retryable: 'Only failed or dead-letter deliveries can be retried.',
    signature_secret_required: 'Enter a signing secret before enabling this provider preset.',
    invalid_destination_status_range: 'Destination status minimum cannot exceed maximum.',
    alert_channel_not_configured: 'Configure an outgoing alert channel first.',
    evidence_not_found: 'This evidence link expired, was revoked or does not exist.',
    endpoint_not_found: 'That endpoint no longer exists.',
    event_not_found: 'That event is no longer available. It may have expired.',
    origin_not_allowed: 'This origin is not allowed to call the API.',
    validation_error: 'Please check the entered information.',
    internal_error: 'The server hit an unexpected error. Try again in a moment.',
  };
  return messages[error.code] ?? 'The request could not be completed.';
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
